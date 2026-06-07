/* ============================================================
   NoSeuTempo — main.js (compartilhado)
   - Toggle de fonte OpenDyslexic (persistido)
   - Menu mobile
   - Conta do aluno: token JWT + chamadas autenticadas à API
   ============================================================ */
(function () {
  "use strict";
  const NST = (window.NST = window.NST || {});

  NST.KEYS = {
    font: "nst.font",
    token: "nst.token",        // token de login (JWT)
    progress: "nst.progress",  // % concluído (memória externa local)
  };

  /* ---------- Sessão / conta ---------- */
  NST.getToken = () => localStorage.getItem(NST.KEYS.token);
  NST.setToken = (t) => localStorage.setItem(NST.KEYS.token, t);
  NST.isLogged = () => !!NST.getToken();
  NST.logout = () => { localStorage.removeItem(NST.KEYS.token); location.href = "index.html"; };

  /* Chamada à API já com o token (se houver) */
  NST.api = function (path, opts) {
    opts = opts || {};
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    const t = NST.getToken();
    if (t) headers.Authorization = "Bearer " + t;
    return fetch((window.NST_API || "") + path, Object.assign({}, opts, { headers }));
  };

  /* Dados do aluno logado (ou null) */
  NST.me = async function () {
    if (!NST.getToken()) return null;
    try {
      const r = await NST.api("/api/me");
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  };

  /* ---------- Progresso local (Âncora de Memória) ---------- */
  NST.getProgress = () => {
    const v = parseInt(localStorage.getItem(NST.KEYS.progress), 10);
    return Number.isFinite(v) ? v : 65;
  };
  NST.setProgress = (pct) => {
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    localStorage.setItem(NST.KEYS.progress, String(v));
    return v;
  };

  /* ---------- Fonte para dislexia ---------- */
  function applyFont(mode) { document.body.classList.toggle("dyslexic", mode === "dyslexic"); }
  NST.initFontToggle = function () {
    const saved = localStorage.getItem(NST.KEYS.font) || "padrao";
    applyFont(saved);
    const input = document.getElementById("font-toggle");
    if (input) {
      input.checked = saved === "dyslexic";
      input.addEventListener("change", () => {
        const mode = input.checked ? "dyslexic" : "padrao";
        localStorage.setItem(NST.KEYS.font, mode);
        applyFont(mode);
      });
    }
  };

  /* ---------- Menu mobile + estado de login na navbar ---------- */
  NST.initNav = function () {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (toggle && links) {
      toggle.addEventListener("click", () => links.classList.toggle("open"));
      links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => links.classList.remove("open")));
    }
    // Botão "Entrar" vira "Sair" quando logado
    const entrar = document.querySelector("[data-entrar]");
    if (entrar && NST.isLogged()) {
      entrar.textContent = "Sair";
      entrar.href = "#";
      entrar.addEventListener("click", (e) => { e.preventDefault(); NST.logout(); });
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    NST.initFontToggle();
    NST.initNav();
  });
})();
