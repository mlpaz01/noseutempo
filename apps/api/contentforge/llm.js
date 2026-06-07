'use strict';
/**
 * NoSeuTempo ContentForge — MOTOR DE IA (LLM Engine)
 *
 * Orquestra múltiplos provedores de IA com FALLBACK AUTOMÁTICO:
 *   1. Groq        (Llama 3.3 70B)  — limite gratuito alto, muito rápido
 *   2. Gemini      (gemini-2.5-flash)
 *   3. OpenRouter  (modelos :free)
 *
 * Quando um provedor falha por COTA (429) ou erro, o motor cai
 * automaticamente para o próximo — então a geração nunca trava por
 * "falta de crédito de token" enquanto houver ao menos 1 provedor com saldo.
 *
 * Não exige nenhuma dependência npm extra além de @google/generative-ai
 * (Groq e OpenRouter usam fetch nativo do Node 18+ via API OpenAI-compatible).
 *
 * Configuração (.env):
 *   GEMINI_API_KEY=...
 *   GROQ_API_KEY=...
 *   OPENROUTER_API_KEY=...
 *   AI_PROVIDER_ORDER=groq,gemini,openrouter   (opcional; ordem de tentativa)
 *   GROQ_MODEL=llama-3.3-70b-versatile          (opcional)
 *   GEMINI_MODEL=gemini-2.5-flash               (opcional)
 *   OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free (opcional)
 */

const { parseLenientJson } = require('./jsonparse');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const MODELS = {
  groq:       () => process.env.GROQ_MODEL       || 'llama-3.3-70b-versatile',
  gemini:     () => process.env.GEMINI_MODEL     || 'gemini-2.5-flash',
  openrouter: () => process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
};

const KEYS = {
  groq:       () => process.env.GROQ_API_KEY       || '',
  gemini:     () => process.env.GEMINI_API_KEY     || '',
  openrouter: () => process.env.OPENROUTER_API_KEY || '',
};

/** Ordem de provedores: env > padrão. Só inclui os que têm chave. */
function providerOrder() {
  const raw = (process.env.AI_PROVIDER_ORDER || 'groq,gemini,openrouter')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  return raw.filter(p => MODELS[p] && !seen.has(p) && seen.add(p) && KEYS[p]());
}

/** Status dos provedores — usado pelo endpoint de saúde do Estúdio. */
function getProviderStatus() {
  return {
    order: providerOrder(),
    providers: Object.keys(MODELS).map(p => ({
      name:       p,
      configured: !!KEYS[p](),
      model:      MODELS[p](),
    })),
    anyConfigured: Object.keys(KEYS).some(p => !!KEYS[p]()),
  };
}

function isQuotaError(err) {
  const m = String(err && err.message || err || '');
  return /429|quota|rate.?limit|too many requests|insufficient|exceeded/i.test(m);
}

/* ─── Provedor: API OpenAI-compatible (Groq + OpenRouter) ─────────── */
async function callOpenAICompat({ baseUrl, key, model, system, user, temperature, headers }) {
  const resp = await fetch(baseUrl, {
    method: 'POST',
    headers: Object.assign({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }, headers || {}),
    body: JSON.stringify({
      model,
      temperature: temperature ?? 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    const err = new Error(`[${resp.status}] ${txt.slice(0, 300)}`);
    err.status = resp.status;
    throw err;
  }
  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content || '';
  return parseLenientJson(content);
}

async function callGroq({ system, user, temperature }) {
  return callOpenAICompat({
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    key: KEYS.groq(), model: MODELS.groq(), system, user, temperature,
  });
}

async function callOpenRouter({ system, user, temperature }) {
  return callOpenAICompat({
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    key: KEYS.openrouter(), model: MODELS.openrouter(), system, user, temperature,
    headers: {
      'HTTP-Referer': process.env.SITE_URL || 'https://noseutempo.app',
      'X-Title': 'NoSeuTempo ContentForge',
    },
  });
}

/* ─── Provedor: Gemini ────────────────────────────────────────────── */
let _genCache = null;
async function callGemini({ system, user, temperature }) {
  if (!_genCache) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    _genCache = new GoogleGenerativeAI(KEYS.gemini());
  }
  const model = _genCache.getGenerativeModel({
    model: MODELS.gemini(),
    generationConfig: { responseMimeType: 'application/json', temperature: temperature ?? 0.7 },
  });
  const result = await model.generateContent([{ text: system }, { text: user }]);
  return parseLenientJson(result.response.text());
}

const CALLERS = { groq: callGroq, gemini: callGemini, openrouter: callOpenRouter };

/**
 * Gera JSON a partir de um prompt, tentando os provedores em ordem.
 *
 * @param {object} opts
 * @param {string} opts.system        - prompt de sistema
 * @param {string} opts.user          - mensagem do usuário
 * @param {number} [opts.temperature]
 * @param {number} [opts.retries]     - tentativas por provedor em caso de 429 (padrão 1)
 * @param {Function} [opts.onNote]    - (msg) => void, para logar tentativas/fallbacks
 * @returns {Promise<{data:object, provider:string}>}
 */
async function generateJson(opts) {
  const order = providerOrder();
  if (!order.length) {
    const e = new Error('NENHUM_PROVEDOR_IA: configure GROQ_API_KEY, GEMINI_API_KEY ou OPENROUTER_API_KEY no .env');
    e.code = 'NO_PROVIDER';
    throw e;
  }

  const retries = opts.retries ?? 1;
  const note = opts.onNote || (() => {});
  let lastErr;

  for (const provider of order) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await CALLERS[provider]({
          system: opts.system, user: opts.user, temperature: opts.temperature,
        });
        if (provider !== order[0] || attempt > 0) {
          note(`✓ Respondido por ${provider}${attempt ? ` (tentativa ${attempt + 1})` : ''}`);
        }
        return { data, provider };
      } catch (err) {
        lastErr = err;
        const quota = isQuotaError(err);
        note(`✗ ${provider} falhou${quota ? ' (cota/limite)' : ''}: ${String(err.message || err).slice(0, 120)}`);
        // Em erro de cota, espera curto e tenta de novo no mesmo provedor; senão pula direto
        if (quota && attempt < retries) { await sleep(1500 * (attempt + 1)); continue; }
        break; // próximo provedor
      }
    }
  }
  const e = new Error(`TODOS_PROVEDORES_FALHARAM: ${String(lastErr && lastErr.message || lastErr).slice(0, 200)}`);
  e.code = 'ALL_FAILED';
  e.cause = lastErr;
  throw e;
}

module.exports = { generateJson, getProviderStatus, providerOrder, isQuotaError };
