/* ============================================================
   NoSeuTempo — Backend v3 (alunos + admin + cursos + MP)
   ============================================================ */
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const fs      = require("fs");
const path    = require("path");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const app = express();
app.use(express.json());

/* ── Configuração ──────────────────────────────────────────── */
const PORT        = process.env.PORT        || 3001;
const SITE_URL    = process.env.SITE_URL    || "https://noseutempo.app";
const API_URL     = process.env.API_URL     || "https://api.noseutempo.app";
const ACCESS_TOKEN= process.env.MP_ACCESS_TOKEN;
const JWT_SECRET  = process.env.JWT_SECRET  || "mude-no-env";

app.use(cors({
  origin: [SITE_URL, "https://www.noseutempo.app", "https://admin.noseutempo.app"],
}));
const mp = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });

/* ── ContentForge (Estúdio de criação com IA) ──────────────── */
const { generateCourse } = require("./contentforge/agent");
const { CATEGORIAS }     = require("./contentforge/planner");
const { getProviderStatus, providerOrder } = require("./contentforge/llm");
const { generateLessonBlocks } = require("./contentforge/generator");
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

/* ── Planos ────────────────────────────────────────────────── */
const PLANOS = {
  mensal:    { title: "NoSeuTempo · Mensal",    price: 39.0  },
  anual:     { title: "NoSeuTempo · Anual",     price: 297.0 },
  vitalicio: { title: "NoSeuTempo · Vitalício", price: 597.0 },
};

/* ── JSON "DB" helpers ─────────────────────────────────────── */
const DATA = path.join(__dirname, "data");
fs.mkdirSync(DATA, { recursive: true });

function readJson(file, def = []) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8")); }
  catch { return def; }
}
function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA, file), JSON.stringify(data, null, 2));
}

let users   = readJson("users.json",   []);
let courses = readJson("courses.json", []);
let sales   = readJson("sales.json",   []);

const saveUsers   = () => writeJson("users.json",   users);
const saveCourses = () => writeJson("courses.json", courses);
const saveSales   = () => writeJson("sales.json",   sales);

let notifs = readJson("notifications.json", []);
const saveNotifs = () => writeJson("notifications.json", notifs);

/* ── Progresso do aluno (aulas concluídas, %, sequência) ── */
let progress = readJson("progress.json", {});
const saveProgress = () => writeJson("progress.json", progress);
function courseContent(id) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, "course-content", `${id}.json`), "utf8")); }
  catch { return null; }
}
function courseContentStats(id) {
  const content = courseContent(id);
  const units = Array.isArray(content?.units) ? content.units : [];
  const lessons = units.reduce((sum, unit) => sum + (Array.isArray(unit.lessons) ? unit.lessons.length : 0), 0);
  const blocks = units.reduce((sum, unit) => sum + (Array.isArray(unit.lessons)
    ? unit.lessons.reduce((lessonSum, lesson) => lessonSum + (Array.isArray(lesson.blocks) ? lesson.blocks.length : 0), 0)
    : 0), 0);
  const failed = units.reduce((sum, unit) => sum + (Array.isArray(unit.lessons)
    ? unit.lessons.filter(lesson => lesson && lesson.failed).length
    : 0), 0);
  return {
    hasContent: !!content,
    lessons,
    blocks,
    failed,
    generatedBy: content?.generatedBy || null,
    editadoEm: content?.editadoEm || null,
  };
}
function ymd(dt) { return dt.toISOString().slice(0, 10); }
function computeStreak(days) {
  if (!days || !days.length) return 0;
  const set = new Set(days);
  const cur = new Date();
  if (!set.has(ymd(cur))) { cur.setDate(cur.getDate() - 1); if (!set.has(ymd(cur))) return 0; }
  let streak = 0;
  while (set.has(ymd(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
  return streak;
}
function createNotif(userId, type, text, key) {
  const allowed = ["motivacao", "progresso", "comunicacao", "reconhecimento"];
  const t = allowed.includes(type) ? type : "motivacao";
  if (key && notifs.some(n => String(n.userId) === String(userId) && n.key === key)) return null;
  const n = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    userId: String(userId), type: t, text: String(text || "").slice(0, 300),
    key: key || null, read: false, createdAt: new Date().toISOString(),
  };
  notifs.push(n); saveNotifs(); return n;
}

const byEmail = (e)  => users.find(u => u.email === String(e).toLowerCase());
const byId    = (id) => users.find(u => String(u.id) === String(id));
/* Trial de 24h: acesso temporário sem pagamento */
const trialAtivo = (u) => !!(u && u.trialUntil && Date.now() < new Date(u.trialUntil).getTime());
const temAcesso  = (u) => !!(u && (u.paid || trialAtivo(u)));
/* Anti-abuso: limite de trials por IP/dispositivo */
let trialIps = readJson("trial-ips.json", {});
const saveTrialIps = () => writeJson("trial-ips.json", trialIps);
const clientIp = (req) => ((req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || (req.socket && req.socket.remoteAddress) || "";
const podeTrialIp = (ip) => { if (!ip) return true; const r = trialIps[ip]; return !r || (r.count || 0) < 3; };
function grantTrial(user, ip) {
  if (!podeTrialIp(ip)) return false;
  user.trialUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  user.trialStartedAt = new Date().toISOString();
  if (ip) { user.trialIp = ip; trialIps[ip] = { count: ((trialIps[ip] && trialIps[ip].count) || 0) + 1, last: new Date().toISOString() }; saveTrialIps(); }
  return true;
}

/* ── Auth middleware ───────────────────────────────────────── */
const gerarToken = (u) => jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: "30d" });

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = byId(payload.id);
    if (!req.user) throw new Error("not found");
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida. Faça login de novo." });
  }
}

function isAdmin(req, res, next) {
  if (!req.user || !req.user.admin)
    return res.status(403).json({ error: "Acesso restrito a administradores." });
  next();
}

/* ═══════════════════════════════════════════════════════════
   ROTAS PÚBLICAS
═══════════════════════════════════════════════════════════ */

/* Health */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "noseutempo-backend", alunos: users.length })
);

/* Registrar */
app.post("/api/registrar", (req, res) => {
  try {
    const nome  = String(req.body.nome  || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const senha = String(req.body.senha || "");
    if (!nome || !email.includes("@") || senha.length < 6)
      return res.status(400).json({ error: "Preencha nome, e-mail válido e senha (mín. 6 caracteres)." });
    if (byEmail(email))
      return res.status(409).json({ error: "Esse e-mail já tem conta. Tente fazer login." });
    const user = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      nome, email,
      senha_hash: bcrypt.hashSync(senha, 10),
      paid: false, plano: null, admin: false,
      criado: new Date().toISOString(),
    };
    if (req.body.trial) grantTrial(user, clientIp(req));
    users.push(user); saveUsers();
    createNotif(user.id, "motivacao", "Seja muito bem-vindo(a) ao NoSeuTempo! Cada passo conta — vamos no seu ritmo, sem pressão. 💙", "welcome");
    res.json({ token: gerarToken(user), nome: user.nome, paid: user.paid, admin: !!user.admin, trial: !!user.trialUntil, trialUntil: user.trialUntil || null });
  } catch (e) {
    console.error("registrar:", e);
    res.status(500).json({ error: "Erro ao cadastrar." });
  }
});

/* Login */
app.post("/api/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "");
  const user  = byEmail(email);
  if (!user || !bcrypt.compareSync(senha, user.senha_hash))
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  res.json({ token: gerarToken(user), nome: user.nome, paid: user.paid, admin: !!user.admin });
});

/* Me */
app.get("/api/me", auth, (req, res) => {
  res.json({
    id: req.user.id, nome: req.user.nome, email: req.user.email,
    paid: !!req.user.paid, plano: req.user.plano, admin: !!req.user.admin,
    perfilCompleto: !!req.user.perfilCompleto,
    trialUntil: req.user.trialUntil || null,
    trialAtivo: trialAtivo(req.user),
    acesso: temAcesso(req.user),
  });
});

/* Iniciar trial de 24h (aluno logado, sem pagamento e sem trial anterior) */
app.post("/api/trial/start", auth, (req, res) => {
  const u = req.user;
  if (u.paid) return res.json({ ok: true, already: "paid" });
  if (u.trialUntil) return res.json({ ok: true, trialUntil: u.trialUntil, ativo: trialAtivo(u), already: true });
  const ok = grantTrial(u, clientIp(req));
  saveUsers();
  res.json({ ok: true, trialUntil: u.trialUntil || null, ativo: trialAtivo(u), bloqueado: !ok });
});

/* ── Perfil de Aprendizagem (alimenta a adaptação da Geni IA) ── */
app.get("/api/me/perfil", auth, (req, res) => {
  res.json({ perfil: req.user.perfil || null, perfilCompleto: !!req.user.perfilCompleto });
});
app.post("/api/me/perfil", auth, (req, res) => {
  const p = req.body && typeof req.body === "object" ? req.body : {};
  req.user.perfil = p;
  req.user.perfilCompleto = true;
  req.user.perfilAt = new Date().toISOString();
  saveUsers();
  res.json({ ok: true });
});

/* Resumo curto do perfil para injetar nos prompts da Geni */
function perfilResumo(user) {
  const p = user && user.perfil;
  if (!p || !p.tipo) return "";
  const arr = (x) => Array.isArray(x) ? x.filter(Boolean).join(", ") : (x || "");
  const partes = [];
  partes.push(`tipo: ${p.tipo}`);
  if (p.nome) partes.push(`nome: ${p.nome}`);
  if (p.idade) partes.push(`idade: ${p.idade}`);
  if (arr(p.diagnostico)) partes.push(`diagnóstico/suspeita: ${arr(p.diagnostico)}`);
  if (arr(p.dificuldade)) partes.push(`principal dificuldade: ${arr(p.dificuldade)}`);
  if (arr(p.ajuda)) partes.push(`ajuda a aprender: ${arr(p.ajuda)}`);
  if (arr(p.aprendeMelhor)) partes.push(`aprende melhor: ${arr(p.aprendeMelhor)}`);
  if (p.hiperfoco) partes.push(`hiperfoco/interesse: ${p.hiperfoco}`);
  if (p.interesses) partes.push(`interesses: ${p.interesses}`);
  if (arr(p.frustracao)) partes.push(`gatilhos de frustração: ${arr(p.frustracao)}`);
  if (p.obs) partes.push(`observação: ${p.obs}`);
  return partes.join(" · ");
}

/* ── Criar pagamento ────────────────────────────────────────── */
app.post("/api/criar-pagamento", auth, async (req, res) => {
  try {
    const plano = PLANOS[req.body.plano] ? req.body.plano : "anual";
    const dados = PLANOS[plano];
    const preference = new Preference(mp);
    const result = await preference.create({
      body: {
        items: [{ title: dados.title, quantity: 1, currency_id: "BRL", unit_price: dados.price }],
        payer: { name: req.user.nome, email: req.user.email },
        back_urls: {
          success: `${SITE_URL}/sucesso.html`,
          pending: `${SITE_URL}/sucesso.html`,
          failure: `${SITE_URL}/pagamento.html?status=falhou`,
        },
        auto_return: "approved",
        notification_url: `${API_URL}/api/webhook`,
        external_reference: String(req.user.id),
        metadata: { plano, user_id: req.user.id },
        statement_descriptor: "NOSEUTEMPO",
      },
    });
    res.json({ id: result.id, init_point: result.init_point });
  } catch (e) {
    console.error("criar-pagamento:", e);
    res.status(500).json({ error: "Não foi possível criar o pagamento." });
  }
});

/* ── Liberar usuário (interno) ──────────────────────────────── */
function liberarUsuario(userId, plano, paymentId, gratuito, valorOverride) {
  const u = byId(userId);
  if (!u) return null;
  u.paid  = true;
  if (gratuito) { u.plano = "gratuito"; u.gratuito = true; }
  else { if (plano) u.plano = plano; u.gratuito = false; }
  saveUsers();
  // Registra a venda (matrícula GRATUITA não conta como venda)
  const jaExiste = paymentId && sales.find(s => s.payment_id === paymentId);
  if (!gratuito && !jaExiste) {
    sales.push({
      id:         Date.now().toString(36),
      payment_id: paymentId || null,
      user_id:    u.id,
      nome:       u.nome,
      email:      u.email,
      plano:      plano || u.plano,
      valor:      (valorOverride != null && valorOverride !== "") ? Number(valorOverride) : (plano ? (PLANOS[plano]?.price || 0) : 0),
      data:       new Date().toISOString(),
      origem:     paymentId ? "mercadopago" : "manual",
    });
    saveSales();
  }
  console.log(`✅ Acesso liberado: ${u.email} (${plano || "?"})`);
  return u;
}

/* ── Confirmar (volta do checkout) ─────────────────────────── */
app.get("/api/confirmar", auth, async (req, res) => {
  try {
    const paymentId = req.query.payment_id;
    if (!paymentId) return res.json({ paid: !!req.user.paid });
    const payment = new Payment(mp);
    const p = await payment.get({ id: paymentId });
    if (p.status === "approved" && String(p.external_reference) === String(req.user.id)) {
      liberarUsuario(req.user.id, p.metadata?.plano, paymentId);
      return res.json({ paid: true, status: "approved" });
    }
    res.json({ paid: !!req.user.paid, status: p.status });
  } catch (e) {
    console.error("confirmar:", e);
    res.json({ paid: !!req.user.paid });
  }
});

/* ── Webhook ─────────────────────────────────────────────── */
app.post("/api/webhook", async (req, res) => {
  try {
    const type = req.query.type || req.body.type;
    const id   = req.query["data.id"] || req.body?.data?.id;
    if (type === "payment" && id) {
      const payment = new Payment(mp);
      const p = await payment.get({ id });
      if (p.status === "approved" && p.external_reference)
        liberarUsuario(p.external_reference, p.metadata?.plano, id);
      console.log(`🔔 Webhook pgto ${id} -> ${p.status}`);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("webhook:", e);
    res.sendStatus(200);
  }
});

/* ═══════════════════════════════════════════════════════════
   ROTAS ADMIN  /api/admin/*
   Todas exigem auth + isAdmin
═══════════════════════════════════════════════════════════ */

/* Stats do dashboard */
app.get("/api/admin/stats", auth, isAdmin, (_req, res) => {
  const pagantes = users.filter(u => u.paid && u.plano !== "gratuito" && !u.gratuito);
  const receita  = sales.reduce((s, v) => s + (v.valor || 0), 0);
  res.json({
    total_users:   users.length,
    total_paid:    pagantes.length,
    total_free:    users.length - pagantes.length,
    total_courses: courses.length,
    total_sales:   sales.length,
    receita_total: receita,
  });
});

/* Listar usuários */
app.get("/api/admin/users", auth, isAdmin, (req, res) => {
  const q      = (req.query.q || "").toLowerCase();
  const filter = req.query.filter; // "paid" | "free" | "admin"
  const isPagante = (u) => !!u.paid && u.plano !== "gratuito" && !u.gratuito;
  let list = users.map(u => ({
    id: u.id, nome: u.nome, email: u.email,
    paid: !!u.paid, plano: u.plano, gratuito: !!u.gratuito, pagante: isPagante(u), admin: !!u.admin,
    criado: u.criado,
  }));
  if (q) list = list.filter(u => u.nome.toLowerCase().includes(q) || u.email.includes(q));
  if (filter === "paid")  list = list.filter(u => u.pagante);
  if (filter === "free")  list = list.filter(u => !u.pagante);
  if (filter === "admin") list = list.filter(u => u.admin);
  res.json(list);
});

/* Liberar / revogar acesso */
app.post("/api/admin/users/:id/toggle-paid", auth, isAdmin, (req, res) => {
  const u = byId(req.params.id);
  if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
  u.paid = !u.paid;
  if (!u.paid) { u.plano = null; }
  else { u.plano = req.body.plano || "anual"; }
  saveUsers();
  if (u.paid) liberarUsuario(u.id, u.plano, null);
  res.json({ id: u.id, paid: u.paid, plano: u.plano });
});

/* Definir status de pagamento (dropdown) */
app.post("/api/admin/users/:id/status", auth, isAdmin, (req, res) => {
  const u = byId(req.params.id);
  if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
  const status = String(req.body.status || "");
  if (status === "sem") { u.paid = false; u.plano = null; u.gratuito = false; }
  else if (status === "gratuito") { u.paid = true; u.plano = "gratuito"; u.gratuito = true; }
  else if (["mensal", "anual", "vitalicio"].includes(status)) { u.paid = true; u.plano = status; u.gratuito = false; }
  else return res.status(400).json({ error: "Status inválido." });
  saveUsers();
  res.json({ ok: true, id: u.id, paid: u.paid, plano: u.plano, gratuito: !!u.gratuito });
});

/* Promover / rebaixar admin */
app.post("/api/admin/users/:id/toggle-admin", auth, isAdmin, (req, res) => {
  const u = byId(req.params.id);
  if (!u) return res.status(404).json({ error: "Usuário não encontrado." });
  if (u.id === req.user.id) return res.status(400).json({ error: "Não pode alterar sua própria role." });
  u.admin = !u.admin;
  saveUsers();
  res.json({ id: u.id, admin: u.admin });
});

/* Deletar usuário */
app.delete("/api/admin/users/:id", auth, isAdmin, (req, res) => {
  const idx = users.findIndex(u => String(u.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado." });
  if (users[idx].id === req.user.id) return res.status(400).json({ error: "Não pode deletar a si mesmo." });
  users.splice(idx, 1);
  saveUsers();
  res.json({ ok: true });
});

/* Matrícula manual */
app.post("/api/admin/enroll", auth, isAdmin, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const gratuito = !!req.body.gratuito;
  let plano = gratuito ? "gratuito" : (req.body.plano || "anual");
  let valorOverride = null;
  if (!gratuito && req.body.plano === "custom") {
    plano = "personalizado";
    valorOverride = Number(req.body.valor) || 0;
  }
  const u = byEmail(email);
  if (!u) return res.status(404).json({ error: "Nenhum aluno com esse e-mail." });
  liberarUsuario(u.id, gratuito ? null : plano, null, gratuito, valorOverride);
  res.json({ ok: true, nome: u.nome, email: u.email, plano, gratuito, valor: valorOverride });
});

/* ═══════════════════════════════════════════════════════════
   ESTÚDIO DE CRIAÇÃO COM IA  /api/admin/studio/*
═══════════════════════════════════════════════════════════ */

/* Categorias disponíveis */
app.get("/api/admin/studio/categorias", auth, isAdmin, (_req, res) => {
  res.json(CATEGORIAS);
});

/* Saúde do motor de IA — quais provedores estão configurados/ativos */
app.get("/api/admin/studio/health", auth, isAdmin, (_req, res) => {
  const status = getProviderStatus();
  res.json({
    ...status,
    ready: status.order.length > 0,
    hint: status.order.length === 0
      ? "Nenhum provedor de IA configurado. Adicione GROQ_API_KEY (grátis em console.groq.com), GEMINI_API_KEY ou OPENROUTER_API_KEY no .env e reinicie a API."
      : `Motor pronto. Ordem de fallback: ${status.order.join(" → ")}.`,
  });
});

/* Gerar curso com IA — streaming de progresso via SSE */
app.post("/api/admin/studio/gerar", auth, isAdmin, async (req, res) => {
  const { topic, category, audience, duration, difficulty } = req.body;
  if (!topic) return res.status(400).json({ error: "Tema obrigatório." });
  if (providerOrder().length === 0)
    return res.status(503).json({ error: "Nenhum provedor de IA configurado. Adicione GROQ_API_KEY (grátis), GEMINI_API_KEY ou OPENROUTER_API_KEY no .env e reinicie a API." });

  // SSE headers para progresso em tempo real
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    send("start", { message: "Iniciando geração do curso…", providers: providerOrder() });

    const course = await generateCourse({
      topic, category, audience,
      duration:   Number(duration)   || 60,
      difficulty: difficulty         || "basico",
      onProgress: async (percent, message) => { send("progress", { percent, message }); },
      onNote:     (message) => { send("note", { message }); },
    });

    // Recarregar índice de cursos na memória
    courses = readJson("courses.json", []);

    send("done", { course: {
      id:      course.id,
      titulo:  course.titulo,
      descricao: course.descricao,
      category: course.category,
      modulos:  course.units.length,
    }, report: course.report || null });
  } catch (e) {
    console.error("[Studio] Erro:", e);
    const raw = String(e.message || e);
    const quota = /429|quota|sem.?saldo|no_provider/i.test(raw);
    const transient = /500|502|503|504|service unavailable|currently experiencing|temporar|timeout|overloaded|all_failed/i.test(raw);
    const friendly = transient
      ? "A IA ficou instavel agora. Tente gerar novamente em alguns instantes; o motor ja tenta Gemini Flash e Flash-Lite antes de desistir."
      : (e.message || "Erro ao gerar curso.");
    send("error", {
      message: friendly,
      quota: quota || transient,
      transient,
      hint: quota
        ? "A IA esta sem saldo/cota. Configure um provedor com saldo (Groq e uma boa opcao: console.groq.com) no .env e reinicie a API."
        : transient
          ? "Se continuar acontecendo, adicione GROQ_API_KEY ou OPENROUTER_API_KEY para ter fallback real alem do Gemini."
          : "",
    });
  } finally {
    res.end();
  }
});

/* Regenerar UMA aula que falhou (ou que você quer refazer) */
app.post("/api/admin/courses/:cid/lessons/:lid/regenerate", auth, isAdmin, async (req, res) => {
  try {
    if (providerOrder().length === 0)
      return res.status(503).json({ error: "Nenhum provedor de IA configurado." });
    const contentFile = path.join(DATA, "course-content", `${req.params.cid}.json`);
    if (!fs.existsSync(contentFile)) return res.status(404).json({ error: "Curso não encontrado." });
    const course = JSON.parse(fs.readFileSync(contentFile, "utf8"));

    let unit, lesson;
    for (const u of (course.units || [])) {
      const l = (u.lessons || []).find(l => l.id === req.params.lid);
      if (l) { unit = u; lesson = l; break; }
    }
    if (!lesson) return res.status(404).json({ error: "Aula não encontrada." });

    const prevTitles = (unit.lessons || []).filter(l => l.order < lesson.order).map(l => l.title);
    const data = await generateLessonBlocks({ category: course.category, audience: req.body.audience }, {
      courseTitle: course.titulo, courseCategory: course.category,
      unitTitle: unit.title, unitMotivacao: unit.motivacao || "",
      lessonTitle: lesson.title, previousLessonTitles: prevTitles,
    });
    lesson.blocks = data.blocks || [];
    lesson.estimatedMinutes = data.estimatedMinutes || lesson.estimatedMinutes || 3;
    lesson.failed = false;
    fs.writeFileSync(contentFile, JSON.stringify(course, null, 2));
    res.json({ ok: true, lesson: { id: lesson.id, title: lesson.title, blocks: lesson.blocks, estimatedMinutes: lesson.estimatedMinutes }, provider: data._provider });
  } catch (e) {
    console.error("[Studio] Regenerar aula:", e);
    res.status(500).json({ error: e.message || "Erro ao regenerar aula." });
  }
});

/* Salvar conteúdo completo editado de um curso (edição inline no admin) */
app.put("/api/admin/courses/:id/content", auth, isAdmin, (req, res) => {
  try {
    const contentFile = path.join(DATA, "course-content", `${req.params.id}.json`);
    if (!fs.existsSync(contentFile)) return res.status(404).json({ error: "Conteúdo não encontrado." });
    const existing = JSON.parse(fs.readFileSync(contentFile, "utf8"));
    const incoming = req.body || {};
    // Só permitimos sobrescrever campos editáveis (evita corromper ids)
    const merged = { ...existing };
    if (incoming.titulo)    merged.titulo    = incoming.titulo;
    if (incoming.descricao !== undefined) merged.descricao = incoming.descricao;
    if (incoming.tagline   !== undefined) merged.tagline   = incoming.tagline;
    if (incoming.capa      !== undefined) merged.capa      = incoming.capa;
    if (Array.isArray(incoming.units))    merged.units     = incoming.units;
    merged.editadoEm = new Date().toISOString();
    fs.writeFileSync(contentFile, JSON.stringify(merged, null, 2));

    // Sincroniza o índice resumido (titulo/descricao/modulos)
    const idx = courses.find(c => c.id === req.params.id);
    if (idx) {
      idx.titulo = merged.titulo; idx.descricao = merged.descricao;
      idx.modulos = merged.units?.length || idx.modulos;
      if (incoming.capa !== undefined) idx.capa = incoming.capa;
      saveCourses();
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[Studio] Salvar conteúdo:", e);
    res.status(500).json({ error: e.message || "Erro ao salvar." });
  }
});

/* Obter conteúdo completo de um curso (blocos) */
app.get("/api/courses/:id/content", auth, (req, res) => {
  const contentFile = path.join(DATA, "course-content", `${req.params.id}.json`);
  if (!fs.existsSync(contentFile))
    return res.status(404).json({ error: "Conteúdo não encontrado." });
  res.json(JSON.parse(fs.readFileSync(contentFile, "utf8")));
});

/* ── Listar vendas ──────────────────────────────────────────── */
app.get("/api/admin/sales", auth, isAdmin, (req, res) => {
  const list = [...sales].sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json(list);
});

/* ═══════════════════════════════════════════════════════════
   CURSOS  /api/admin/courses
═══════════════════════════════════════════════════════════ */
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* Listar cursos para o admin com status do conteudo gerado */
app.get("/api/admin/courses", auth, isAdmin, (_req, res) => {
  res.json(courses.map(c => ({
    id:       c.id,
    titulo:   c.titulo,
    descricao:c.descricao,
    tagline:  c.tagline || "",
    capa:     c.capa,
    category: c.category,
    difficulty: c.difficulty,
    totalMinutes: c.totalMinutes || c.totalEstimatedMinutes || 0,
    modulos: typeof c.modulos === "number" ? c.modulos : (c.modulos?.length || 0),
    criado:   c.criado,
    ...courseContentStats(c.id),
  })));
});

/* Listar cursos (público, para a plataforma) */
app.get("/api/courses", (_req, res) => {
  res.json(courses.map(c => ({
    id:       c.id,
    titulo:   c.titulo,
    descricao:c.descricao,
    tagline:  c.tagline || "",
    capa:     c.capa,
    category: c.category,
    difficulty: c.difficulty,
    totalMinutes: c.totalMinutes || c.totalEstimatedMinutes || 0,
    // modulos já vem como número no índice; ou como array no objeto completo
    modulos: typeof c.modulos === "number" ? c.modulos : (c.modulos?.length || 0),
    criado:   c.criado,
  })));
});

/* Detalhes de um curso */
app.get("/api/courses/:id", auth, (req, res) => {
  const c = courses.find(c => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Curso não encontrado." });
  res.json(c);
});

/* Criar curso */
app.post("/api/admin/courses", auth, isAdmin, (req, res) => {
  const { titulo, descricao, capa } = req.body;
  if (!titulo) return res.status(400).json({ error: "Título obrigatório." });
  const course = {
    id: newId(), titulo, descricao: descricao || "", capa: capa || "",
    modulos: [], criado: new Date().toISOString(),
  };
  courses.push(course); saveCourses();
  res.status(201).json(course);
});

/* Atualizar curso */
app.put("/api/admin/courses/:id", auth, isAdmin, (req, res) => {
  const c = courses.find(c => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Curso não encontrado." });
  const { titulo, descricao, capa, modulos } = req.body;
  if (titulo)    c.titulo    = titulo;
  if (descricao !== undefined) c.descricao = descricao;
  if (capa !== undefined)      c.capa      = capa;
  if (modulos)   c.modulos   = modulos;
  saveCourses();
  res.json(c);
});

/* Deletar curso */
app.delete("/api/admin/courses/:id", auth, isAdmin, (req, res) => {
  const idx = courses.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Curso não encontrado." });
  courses.splice(idx, 1); saveCourses();
  res.json({ ok: true });
});

/* ── Adicionar módulo a um curso ─────────────────────────── */
app.post("/api/admin/courses/:id/modulos", auth, isAdmin, (req, res) => {
  const c = courses.find(c => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: "Curso não encontrado." });
  const modulo = {
    id: newId(), titulo: req.body.titulo || "Novo módulo",
    aulas: [],
  };
  c.modulos.push(modulo); saveCourses();
  res.status(201).json(modulo);
});

/* ── Adicionar aula a um módulo ─────────────────────────── */
app.post("/api/admin/courses/:cid/modulos/:mid/aulas", auth, isAdmin, (req, res) => {
  const c = courses.find(c => c.id === req.params.cid);
  if (!c) return res.status(404).json({ error: "Curso não encontrado." });
  const m = c.modulos.find(m => m.id === req.params.mid);
  if (!m) return res.status(404).json({ error: "Módulo não encontrado." });
  const aula = {
    id:       newId(),
    titulo:   req.body.titulo   || "Nova aula",
    tipo:     req.body.tipo     || "video", // video | pdf | texto
    url:      req.body.url      || "",
    duracao:  req.body.duracao  || "",
    descricao:req.body.descricao|| "",
  };
  m.aulas.push(aula); saveCourses();
  res.status(201).json(aula);
});

/* ═══════════════════════════════════════════════════════════
   GRAVAÇÕES DE VOZ  /api/recordings
═══════════════════════════════════════════════════════════ */

/* Salvar gravação de voz do bate-papo com a Geni */
app.post("/api/recordings", auth, async (req, res) => {
  try {
    const { lessonId, courseId, audioBase64, mimeType, duration, geniQuestion } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "Audio obrigatório." });

    const recDir = path.join(__dirname, "data", "recordings");
    fs.mkdirSync(recDir, { recursive: true });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const ext = (mimeType || "audio/webm").includes("mp4") ? "mp4" : "webm";
    const filename = `${id}.${ext}`;
    const filepath = path.join(recDir, filename);

    // Salva o arquivo de áudio
    const buf = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(filepath, buf);

    // Salva metadados
    const metaFile = path.join(recDir, "index.json");
    let meta = [];
    try { meta = JSON.parse(fs.readFileSync(metaFile, "utf8")); } catch {}
    meta.push({
      id, filename,
      userId: req.user.id, userName: req.user.nome, userEmail: req.user.email,
      courseId: courseId || null, lessonId: lessonId || null,
      geniQuestion: geniQuestion || null,
      duration: duration || 0,
      createdAt: new Date().toISOString()
    });
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

    res.json({ ok: true, id, filename });
  } catch (e) {
    console.error("recordings:", e);
    res.status(500).json({ error: "Erro ao salvar gravação." });
  }
});

/* Listar gravações (admin) */
app.get("/api/recordings", auth, (req, res) => {
  if (!req.user.admin) return res.status(403).json({ error: "Sem permissão." });
  try {
    const metaFile = path.join(__dirname, "data", "recordings", "index.json");
    const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : [];
    res.json(meta.reverse()); // mais recentes primeiro
  } catch (e) { res.status(500).json({ error: "Erro." }); }
});

/* Servir arquivo de áudio (admin) */
app.get("/api/recordings/:filename", auth, (req, res) => {
  if (!req.user.admin) return res.status(403).json({ error: "Sem permissão." });
  const fp = path.join(__dirname, "data", "recordings", req.params.filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: "Não encontrado." });
  res.sendFile(fp);
});

/* ═══════════════════════════════════════════════════════════
   MENSAGENS PARA A CAROL  /api/contact  /api/messages
═══════════════════════════════════════════════════════════ */

/* Enviar mensagem para a Carol */
app.post("/api/contact", auth, (req, res) => {
  try {
    const { message } = req.body;
    if (!message || String(message).trim().length < 3)
      return res.status(400).json({ error: "Mensagem muito curta." });

    const msgFile = path.join(__dirname, "data", "messages.json");
    let msgs = [];
    try { msgs = JSON.parse(fs.readFileSync(msgFile, "utf8")); } catch {}
    msgs.push({
      id: Date.now().toString(36),
      userId: req.user.id, userName: req.user.nome, userEmail: req.user.email,
      message: String(message).trim(),
      createdAt: new Date().toISOString(),
      read: false
    });
    fs.writeFileSync(msgFile, JSON.stringify(msgs, null, 2));
    createNotif(req.user.id, "comunicacao", "Recebemos sua mensagem com carinho. A Carol vai ler com atenção e responder em breve. 💙");
    console.log(`📩 Mensagem de ${req.user.nome}: ${String(message).substring(0,60)}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao enviar." }); }
});

/* Listar mensagens (admin) */
app.get("/api/messages", auth, (req, res) => {
  if (!req.user.admin) return res.status(403).json({ error: "Sem permissão." });
  try {
    const msgFile = path.join(__dirname, "data", "messages.json");
    const msgs = fs.existsSync(msgFile) ? JSON.parse(fs.readFileSync(msgFile, "utf8")) : [];
    res.json(msgs.reverse());
  } catch { res.status(500).json({ error: "Erro." }); }
});

/* ── GENI IA — conversação (mesmo token/arquitetura do ContentForge) ── */
app.post("/api/geni/respond", auth, async (req, res) => {
  if (providerOrder().length === 0) return res.status(503).json({ error: "sem-ia" });
  try {
    const { geniRespond } = require("./contentforge/geni");
    const out = await geniRespond({
      curso:    req.body.curso,
      modulo:   req.body.modulo,
      aula:     req.body.aula,
      history:  req.body.history,
      userText: req.body.userText,
      perfil:   perfilResumo(req.user),
    });
    res.json(out);
  } catch (e) {
    console.error("geni/respond:", e);
    res.status(500).json({ error: "erro" });
  }
});

/* ── Assistente da Carol (IA de suporte) ── */
app.post("/api/carol/respond", auth, async (req, res) => {
  if (providerOrder().length === 0) return res.status(503).json({ error: "sem-ia" });
  try {
    const { carolRespond } = require("./contentforge/carol");
    const out = await carolRespond({
      history:   req.body.history,
      userText:  req.body.userText,
    });
    res.json(out);
  } catch (e) {
    console.error("carol/respond:", e);
    res.status(500).json({ error: "erro" });
  }
});

/* ── TTS na nuvem (voz feminina natural — Azure / OpenAI) ── */
app.post("/api/tts", auth, async (req, res) => {
  try {
    const { synth } = require("./contentforge/tts");
    const provider = String(req.body.provider || "azure");
    const voice    = req.body.voice ? String(req.body.voice) : "";
    const text     = String(req.body.text || "");
    const buf = await synth(provider, voice, text);
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch (e) {
    console.error("tts:", e.message);
    const code = /nao-configurado/.test(e.message) ? 503 : 500;
    res.status(code).json({ error: e.message });
  }
});

/* ── Notificações (acompanhamento do aluno) ── */
/* Video interativo da aula (job assincrono via fal.ai, com fallback local) */
app.post("/api/videos/generate", auth, async (req, res) => {
  try {
    const { createVideoJob, publicJob } = require("./contentforge/video");
    const job = await createVideoJob({ userId: req.user.id, body: req.body || {} });
    res.json(publicJob(job));
  } catch (e) {
    console.error("videos/generate:", e);
    res.status(500).json({ error: e.message || "Erro ao iniciar video." });
  }
});

app.get("/api/videos/:id/status", auth, async (req, res) => {
  try {
    const { getVideoJobForUser, publicJob } = require("./contentforge/video");
    const job = await getVideoJobForUser(req.user.id, req.params.id);
    if (!job) return res.status(404).json({ error: "Video nao encontrado." });
    res.json(publicJob(job));
  } catch (e) {
    console.error("videos/status:", e);
    res.status(500).json({ error: e.message || "Erro ao consultar video." });
  }
});

app.get("/api/notifications", auth, (req, res) => {
  const list = notifs
    .filter(n => String(n.userId) === String(req.user.id))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  res.json({ notifications: list.slice(0, 50), unread: list.filter(n => !n.read).length });
});
app.post("/api/notifications/read", auth, (req, res) => {
  let changed = false;
  notifs.forEach(n => { if (String(n.userId) === String(req.user.id) && !n.read) { n.read = true; changed = true; } });
  if (changed) saveNotifs();
  res.json({ ok: true });
});
app.post("/api/notifications/add", auth, (req, res) => {
  if (!String(req.body.text || "").trim()) return res.status(400).json({ error: "texto" });
  const n = createNotif(req.user.id, req.body.type, req.body.text, req.body.key);
  res.json({ ok: true, created: !!n });
});

/* ── PROGRESSO ───────────────────────────────────────────── */
/* Resumo do progresso do aluno: % por curso + jornada (aulas, palavras, sequência) */
app.get("/api/progress", auth, (req, res) => {
  const uid = String(req.user.id);
  const up = progress[uid] || { lessons: {}, last: {}, days: [] };
  const done = new Set(Object.keys(up.lessons || {})); // "courseId:lessonId"
  const coursesOut = {};
  let aulas = 0, palavras = 0;

  courses.forEach(ci => {
    const content = courseContent(ci.id);
    if (!content) return;
    let total = 0, comp = 0;
    (content.units || []).forEach(u => (u.lessons || []).forEach(l => {
      total++;
      if (done.has(ci.id + ":" + l.id)) {
        comp++;
        (l.blocks || []).forEach(b => {
          const d = b.data || b;
          if ((b.type || d.type) === "audio_vocab" && Array.isArray(d.words)) palavras += d.words.length;
        });
      }
    }));
    if (total > 0 || comp > 0) {
      coursesOut[ci.id] = {
        completed: comp, total, percent: total ? Math.round((comp / total) * 100) : 0,
        last: (up.last && up.last[ci.id]) || null,
      };
    }
    aulas += comp;
  });

  res.json({ courses: coursesOut, summary: { aulasConcluidas: aulas, palavras, streak: computeStreak(up.days || []) } });
});

/* Marcar uma aula como concluída */
app.post("/api/progress/complete", auth, (req, res) => {
  const uid = String(req.user.id);
  const { courseId, lessonId, unitIndex, lessonIndex } = req.body || {};
  if (!courseId || !lessonId) return res.status(400).json({ error: "courseId e lessonId obrigatórios." });
  const up = progress[uid] || (progress[uid] = { lessons: {}, last: {}, days: [] });
  up.lessons = up.lessons || {};
  const firstTime = !up.lessons[courseId + ":" + lessonId];
  up.lessons[courseId + ":" + lessonId] = { at: new Date().toISOString() };
  up.last = up.last || {};
  up.last[courseId] = { unit: Number(unitIndex) || 0, lesson: Number(lessonIndex) || 0, at: new Date().toISOString() };
  up.days = up.days || [];
  const today = new Date().toISOString().slice(0, 10);
  if (up.days.indexOf(today) === -1) up.days.push(today);
  up.updatedAt = new Date().toISOString();
  saveProgress();
  res.json({ ok: true, firstTime });
});

/* ═══════════════════════════════════════════════════════════
   DESAFIOS (diagnóstico acolhedor + adaptação pela Geni IA)
   "O problema nunca é o aluno." Não é prova: identifica
   dificuldades para a Geni adaptar o ensino.
═══════════════════════════════════════════════════════════ */

/* Monta o desafio a partir das questões já existentes no módulo (ordem determinística) */
function buildChallenge(content, unitIndex) {
  const unit = (content.units || [])[unitIndex];
  if (!unit) return null;
  const qs = [];
  (unit.lessons || []).forEach(l => {
    (l.blocks || []).forEach(b => {
      const d = b.data || b;
      const t = b.type || d.type;
      if ((t === "quick_check" || t === "multiple_choice") && Array.isArray(d.options) && typeof d.correctIndex === "number") {
        qs.push({ text: d.question, options: d.options.slice(), correctIndex: d.correctIndex, topic: l.title });
      } else if (t === "true_false" && typeof d.statement === "string") {
        qs.push({ text: d.statement, options: ["Verdadeiro", "Falso"], correctIndex: d.answer ? 0 : 1, topic: l.title });
      } else if (t === "fill_blank" && Array.isArray(d.wordBank) && d.wordBank.length) {
        const correct = (d.correctAnswers && d.correctAnswers[0]) || "";
        let ci = d.wordBank.findIndex(w => String(w).toLowerCase() === String(correct).toLowerCase());
        if (ci < 0) ci = 0;
        qs.push({ text: "Complete: " + String(d.template || "").replace(/_+/g, " _____ "), options: d.wordBank.slice(), correctIndex: ci, topic: l.title });
      }
    });
  });
  return { unitTitle: unit.title, unitId: unit.id, unitIcon: unit.icon || "🎯", questions: qs.slice(0, 10) };
}

/* Diretórios de cache (desafios completados por IA + material adaptado por aluno) */
const CH_DIR = path.join(DATA, "challenges");
const AD_DIR = path.join(DATA, "adapted");
try { fs.mkdirSync(CH_DIR, { recursive: true }); fs.mkdirSync(AD_DIR, { recursive: true }); } catch (e) {}
const chPath = (courseId, ui) => path.join(CH_DIR, `${courseId}_${ui}.json`);
const adPath = (uid, courseId, ui) => path.join(AD_DIR, `${uid}_${courseId}_${ui}.json`);

/* Gera, com a IA, as questões que faltam para fechar 10 (contextualizadas ao módulo) */
async function generateExtraQuestions(content, unit, faltam, existentes) {
  if (providerOrder().length === 0 || faltam <= 0) return [];
  const { generateJson } = require("./contentforge/llm");
  const topics = (unit.lessons || []).map(l => l.title);
  const sys = `Você cria questões de DIAGNÓSTICO acolhedoras (pt-BR) para o NoSeuTempo, plataforma para pessoas neurodivergentes. NÃO é prova: questões claras, do cotidiano, sem pegadinha, uma ideia por questão.
Responda SOMENTE JSON válido:
{ "questions": [ { "text":"enunciado curto e claro", "options":["op1","op2","op3"], "correctIndex":0, "topic":"um dos tópicos informados" } ] }`;
  const usr = `Curso: ${content.titulo}\nMódulo: ${unit.title}\nTópicos (use exatamente um destes como "topic"): ${topics.join(" | ")}\nNÃO repita estas questões já existentes: ${existentes.map(q => q.text).slice(0, 12).join(" / ")}\nGere EXATAMENTE ${faltam} novas questões de múltipla escolha (3 opções, 1 correta).`;
  try {
    const { data } = await generateJson({ system: sys, user: usr, temperature: 0.6, retries: 1 });
    const arr = Array.isArray(data.questions) ? data.questions : [];
    return arr
      .filter(q => q && q.text && Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctIndex === "number")
      .slice(0, faltam)
      .map(q => ({
        text: String(q.text),
        options: q.options.map(String),
        correctIndex: Math.max(0, Math.min(q.options.length - 1, q.correctIndex | 0)),
        topic: q.topic || topics[0] || "Geral",
        ai: true,
      }));
  } catch (e) { console.error("[Desafios] extra Q:", e.message); return []; }
}

/* Obtém o desafio (cacheado): questões do módulo + completadas por IA até 10 */
async function getOrBuildChallenge(content, courseId, ui) {
  try { return JSON.parse(fs.readFileSync(chPath(courseId, ui), "utf8")); } catch (e) {}
  const unit = (content.units || [])[ui];
  if (!unit) return null;
  const base = buildChallenge(content, ui);
  let qs = base.questions;
  if (qs.length < 10) {
    const extra = await generateExtraQuestions(content, unit, 10 - qs.length, qs);
    qs = qs.concat(extra);
  }
  const ch = { unitTitle: base.unitTitle, unitId: base.unitId, unitIcon: base.unitIcon, questions: qs.slice(0, 10) };
  try { fs.writeFileSync(chPath(courseId, ui), JSON.stringify(ch, null, 2)); } catch (e) {}
  return ch;
}

/* Gera (assíncrono) o material adaptado: uma mini-aula nova focada nos temas difíceis */
async function generateAdapted(uid, courseId, ui, content, unit, praticar, perfil) {
  const p = adPath(uid, courseId, ui);
  try { fs.writeFileSync(p, JSON.stringify({ status: "preparing", topics: praticar, at: new Date().toISOString() })); } catch (e) {}
  if (providerOrder().length === 0) {
    try { fs.writeFileSync(p, JSON.stringify({ status: "unavailable", topics: praticar })); } catch (e) {}
    return;
  }
  try {
    const { generateJson } = require("./contentforge/llm");
    const sys = `Você é a GENI do NoSeuTempo. Crie uma MINI-AULA adaptada, ULTRA simples e acolhedora (pt-BR), para pessoas neurodivergentes que tiveram dificuldade. É uma NOVA forma de ensinar: linguagem do cotidiano, analogias, passos curtos, sem jargão, sem cobrança, sem nota.
Use estes blocos (campos no nível raiz, SEM "data"):
- concept: { "type":"concept","title","body","emoji" }
- example: { "type":"example","character","scenario","takeaway" }
- quick_check: { "type":"quick_check","question","options":[3 strings],"correctIndex","explanation" }
- fill_blank: { "type":"fill_blank","template":"frase com ____","correctAnswers":[".."],"wordBank":[4 strings],"hint","explanation" }
- reflection: { "type":"reflection","question","prompt" }
Responda SOMENTE JSON: { "title":"Título acolhedor", "blocks":[ 4 a 6 blocos, começando por concept ] }`;
    const usr = `Curso: ${content.titulo}\nMódulo: ${unit.title}\nTemas com dificuldade (FOQUE NISTO): ${praticar.join(", ")}\n${perfil ? `Perfil do aluno (adapte exemplos/ritmo/tom, sem citar diagnóstico): ${perfil}\n` : ""}Crie a mini-aula adaptada: explicação simplificada + 1 exemplo do dia a dia + 1 atividade leve + 1 reflexão.`;
    const { data } = await generateJson({ system: sys, user: usr, temperature: 0.7, retries: 1 });
    const blocks = Array.isArray(data.blocks) ? data.blocks : [];
    fs.writeFileSync(p, JSON.stringify({
      status: blocks.length ? "ready" : "error",
      topics: praticar,
      lesson: { title: data.title || "Material adaptado", blocks },
      at: new Date().toISOString(),
    }, null, 2));
  } catch (e) {
    console.error("[Desafios] adapted:", e.message);
    try { fs.writeFileSync(p, JSON.stringify({ status: "error", topics: praticar })); } catch (e2) {}
  }
}

/* GET — obtém o desafio do módulo (sem expor as respostas certas) */
app.get("/api/desafios/:courseId/:unitIndex", auth, async (req, res) => {
  const content = courseContent(req.params.courseId);
  if (!content) return res.status(404).json({ error: "Curso não encontrado." });
  const ui = Number(req.params.unitIndex) || 0;
  const ch = await getOrBuildChallenge(content, req.params.courseId, ui);
  if (!ch || !ch.questions.length) return res.status(404).json({ error: "Este módulo ainda não tem questões para o desafio." });
  res.json({
    courseId: req.params.courseId, courseTitle: content.titulo,
    unitIndex: ui, unitTitle: ch.unitTitle, unitIcon: ch.unitIcon,
    total: ch.questions.length,
    questions: ch.questions.map((q, i) => ({ id: i, text: q.text, options: q.options, topic: q.topic })),
  });
});

/* GET — material adaptado do aluno para um módulo (status: preparing | ready | none) */
app.get("/api/desafios/material/:courseId/:unitIndex", auth, (req, res) => {
  const p = adPath(String(req.user.id), req.params.courseId, Number(req.params.unitIndex) || 0);
  try { return res.json(JSON.parse(fs.readFileSync(p, "utf8"))); }
  catch (e) { return res.json({ status: "none" }); }
});

/* POST — recebe as respostas, gera a análise acolhedora da Geni e registra a tentativa */
app.post("/api/desafios/responder", auth, async (req, res) => {
  try {
    const uid = String(req.user.id);
    const { courseId, unitIndex, answers } = req.body || {};
    const content = courseContent(courseId);
    if (!content) return res.status(404).json({ error: "Curso não encontrado." });
    const ui = Number(unitIndex) || 0;
    const ch = await getOrBuildChallenge(content, courseId, ui);
    if (!ch) return res.status(404).json({ error: "Módulo não encontrado." });
    const unit = (content.units || [])[ui];

    const ans = Array.isArray(answers) ? answers : [];
    const byTopic = {}; // topic -> {ok, total}
    let acertos = 0;
    ch.questions.forEach((q, i) => {
      const chosen = ans[i];
      const correct = chosen === q.correctIndex;
      if (correct) acertos++;
      const tp = q.topic || "Geral";
      byTopic[tp] = byTopic[tp] || { ok: 0, total: 0 };
      byTopic[tp].total++; if (correct) byTopic[tp].ok++;
    });
    const total = ch.questions.length;
    const dominio  = Object.keys(byTopic).filter(t => byTopic[t].ok === byTopic[t].total);
    const praticar = Object.keys(byTopic).filter(t => byTopic[t].ok <  byTopic[t].total);

    // Histórico + detecção de frustração
    const up = progress[uid] || (progress[uid] = { lessons: {}, last: {}, days: [] });
    up.desafios = up.desafios || {};
    const key = courseId + ":" + (Number(unitIndex) || 0);
    const store = up.desafios[key] || (up.desafios[key] = { attempts: [] });
    const prev = store.attempts;
    const ratio = total ? acertos / total : 1;
    const lastPrev = prev[prev.length - 1];
    const repetido = !!(lastPrev && praticar.some(t => (lastPrev.praticar || []).includes(t)));
    const frustracao = (prev.length >= 2 && ratio < 0.6) || (ratio < 0.5 && repetido) || prev.length >= 3 && praticar.length > 0;
    store.attempts.push({ at: new Date().toISOString(), acertos, total, praticar });
    if (store.attempts.length > 20) store.attempts = store.attempts.slice(-20);
    saveProgress();

    // Análise acolhedora pela Geni (IA) — com fallback se a IA estiver indisponível
    let mensagem = "", recomendacoes = [], materialAdaptado = "";
    try {
      if (providerOrder().length) {
        const { generateJson } = require("./contentforge/llm");
        const sys = `Você é a GENI, tutora de IA do NoSeuTempo (pt-BR), acolhedora e sem julgamento, para pessoas neurodivergentes.
FILOSOFIA: "O problema nunca é o aluno. Se não aprendeu, ainda não encontramos a melhor forma de ensinar."
REGRAS: nunca use nota, porcentagem, "aprovado/reprovado/falhou/desempenho ruim". Tom leve, breve, encorajador. Foque no próximo passo.
Responda SOMENTE JSON:
{
 "mensagem": "2-3 frases acolhedoras analisando o desafio (sem números)",
 "recomendacoes": [ {"tipo":"explicacao|jogo|conversa|desafio|video","titulo":"curto","motivo":"curto"} ],
 "materialAdaptado": "1-2 frases: uma explicação simplificada do tema mais difícil, do jeito mais fácil de entender"
}`;
        const usr = `Curso: ${content.titulo}\nMódulo: ${ch.unitTitle}\nDominou: ${dominio.join(", ") || "—"}\nPraticar mais: ${praticar.join(", ") || "—"}\nFrustração detectada: ${frustracao ? "sim" : "não"}\n${perfilResumo(req.user) ? `Perfil do aluno (adapte tom/exemplos, sem rotular): ${perfilResumo(req.user)}\n` : ""}Gere a análise da Geni.`;
        const { data } = await generateJson({ system: sys, user: usr, temperature: 0.6, retries: 1 });
        mensagem = String(data.mensagem || "");
        recomendacoes = Array.isArray(data.recomendacoes) ? data.recomendacoes.slice(0, 5) : [];
        materialAdaptado = String(data.materialAdaptado || "");
      }
    } catch (e) { console.error("[Desafios] IA:", e.message); }

    if (!mensagem) {
      mensagem = praticar.length
        ? "Você já domina bastante coisa deste módulo! Vamos praticar com calma os pontos que ainda parecem difíceis — no seu tempo. 💙"
        : "Você mandou muito bem neste módulo! Que tal seguir em frente quando quiser? 💙";
    }
    if (!recomendacoes.length && praticar.length) {
      recomendacoes = [
        { tipo: "explicacao", titulo: "Explicação simplificada", motivo: "Rever " + praticar[0] + " do jeito mais fácil" },
        { tipo: "jogo", titulo: "Jogos recomendados", motivo: "Fixar brincando" },
        { tipo: "conversa", titulo: "Conversa guiada com a Geni", motivo: "Praticar falando, sem medo de errar" },
      ];
    }

    // Material adaptado REAL: a Geni gera uma mini-aula nova focada nos temas difíceis.
    // Gera quando há temas a praticar e ainda não existe um material pronto/sendo preparado.
    let materialDisponivel = false;
    if (praticar.length && unit) {
      materialDisponivel = true;
      let existente = null;
      try { existente = JSON.parse(fs.readFileSync(adPath(uid, courseId, ui), "utf8")); } catch (e) {}
      const precisaGerar = !existente || ["none", "error", "unavailable"].includes(existente.status) || frustracao;
      if (precisaGerar) {
        // fire-and-forget: não bloqueia a resposta
        generateAdapted(uid, courseId, ui, content, unit, praticar, perfilResumo(req.user)).catch(e => console.error("[Desafios] adapted bg:", e.message));
      }
    }

    res.json({
      acertos, total,
      analise: { dominio, praticar, mensagem },
      recomendacoes,
      frustracao,
      materialAdaptado: frustracao ? (materialAdaptado || "Estou preparando uma nova forma de explicar " + (praticar[0] || "este conteúdo") + " especialmente para você.") : "",
      materialDisponivel,
      courseId, unitIndex: ui,
      tentativa: store.attempts.length,
    });
  } catch (e) {
    console.error("[Desafios] responder:", e);
    res.status(500).json({ error: e.message || "Erro ao processar o desafio." });
  }
});

app.listen(PORT, () => console.log(`✅ Backend NoSeuTempo v3 na porta ${PORT}`));
