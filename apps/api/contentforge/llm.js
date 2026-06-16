'use strict';

/**
 * NoSeuTempo ContentForge - LLM engine
 *
 * Orquestra provedores com fallback automatico:
 * - Groq
 * - Gemini
 * - OpenRouter
 *
 * Gemini usa uma lista curta de modelos atuais por padrao:
 * GEMINI_MODEL (primario) e gemini-2.5-flash-lite como fallback.
 * A lista pode ser substituida por GEMINI_MODELS ou GEMINI_FALLBACK_MODELS.
 */

const { parseLenientJson } = require('./jsonparse');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const providerCooldown = {};
const QUOTA_COOLDOWN_MS = Number(process.env.AI_PROVIDER_QUOTA_COOLDOWN_MS || 10 * 60 * 1000);

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

const MAX_TOKENS = {
  groq:       () => Number(process.env.GROQ_MAX_TOKENS || 6000),
  openrouter: () => Number(process.env.OPENROUTER_MAX_TOKENS || 6000),
};

function shortErr(err, max = 220) {
  return String(err && err.message || err || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function numericOr(fallback, value) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function providerOrder() {
  const raw = (process.env.AI_PROVIDER_ORDER || 'groq,gemini,openrouter')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  return raw.filter(p => MODELS[p] && !seen.has(p) && seen.add(p) && KEYS[p]());
}

function geminiModels() {
  const primary = MODELS.gemini();
  const raw = process.env.GEMINI_MODELS || process.env.GEMINI_FALLBACK_MODELS || `${primary},gemini-2.5-flash-lite`;
  const seen = new Set();
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(m => !seen.has(m) && seen.add(m));
}

function getProviderStatus() {
  return {
    order: providerOrder(),
    providers: Object.keys(MODELS).map(p => ({
      name:       p,
      configured: !!KEYS[p](),
      model:      p === 'gemini' ? geminiModels().join(',') : MODELS[p](),
      maxTokens:  p === 'groq'
        ? MAX_TOKENS.groq()
        : p === 'openrouter'
          ? (() => {
              const model = MODELS.openrouter();
              const configuredMax = numericOr(2200, MAX_TOKENS.openrouter());
              const anthropicSafeMax = numericOr(2200, Number(process.env.OPENROUTER_ANTHROPIC_MAX_TOKENS || 2200));
              return /^anthropic\//i.test(model) ? Math.min(configuredMax, anthropicSafeMax) : configuredMax;
            })()
          : null,
    })),
    anyConfigured: Object.keys(KEYS).some(p => !!KEYS[p]()),
  };
}

function isQuotaError(err) {
  const m = String(err && err.message || err || '');
  return /402|payment required|credit|billing|429|quota|rate.?limit|too many requests|insufficient|exceeded/i.test(m);
}

function isTransientError(err) {
  const m = String(err && err.message || err || '');
  return /(^|\D)(500|502|503|504)(\D|$)|service unavailable|unavailable|currently experiencing|overloaded|temporar|timeout|timed.?out|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(m);
}

function isTokenOrSizeError(err) {
  const m = String(err && err.message || err || '');
  return /(^|\D)(400|413|422)(\D|$)|context_length_exceeded|max_tokens_exceeded|token_limit_exceeded|string_too_long|payload too large|request too large|too many tokens|context length|max[_ -]?tokens|prompt too long|body too large|invalid_request/i.test(m);
}

async function callOpenAICompat({ baseUrl, key, model, system, user, temperature, headers, maxTokens, responseFormat = true }) {
  const body = {
    model,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens || undefined,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
  };
  if (responseFormat) body.response_format = { type: 'json_object' };

  const resp = await fetch(baseUrl, {
    method: 'POST',
    headers: Object.assign({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }, headers || {}),
    body: JSON.stringify(body),
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
    maxTokens: MAX_TOKENS.groq(),
  });
}

async function callOpenRouter({ system, user, temperature, onNote }) {
  const model = MODELS.openrouter();
  const supportsResponseFormat = !/^anthropic\//i.test(model);
  const configuredMax = numericOr(2200, MAX_TOKENS.openrouter());
  const anthropicSafeMax = numericOr(2200, Number(process.env.OPENROUTER_ANTHROPIC_MAX_TOKENS || 2200));
  const initialMax = /^anthropic\//i.test(model)
    ? Math.min(configuredMax, anthropicSafeMax)
    : configuredMax;
  const retryBudgets = Array.from(new Set([
    initialMax,
    Math.min(initialMax, 1800),
    Math.min(initialMax, 1200),
  ].filter(n => Number.isFinite(n) && n > 0))).sort((a, b) => b - a);

  let lastErr;
  for (let i = 0; i < retryBudgets.length; i++) {
    const maxTokens = retryBudgets[i];
    try {
      return await callOpenAICompat({
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        key: KEYS.openrouter(), model, system, user, temperature,
        maxTokens,
        responseFormat: supportsResponseFormat,
        headers: {
          'HTTP-Referer': process.env.SITE_URL || 'https://noseutempo.app',
          'X-Title': 'NoSeuTempo ContentForge',
        },
      });
    } catch (err) {
      lastErr = err;
      if (!isTokenOrSizeError(err) || i === retryBudgets.length - 1) throw err;
      const nextBudget = retryBudgets[i + 1];
      onNote && onNote(`openrouter devolveu limite/tamanho (${shortErr(err, 140)}); reduzindo para ${nextBudget} tokens.`);
      await sleep(700);
    }
  }

  throw lastErr;
}

let _genCache = null;
async function callGemini({ system, user, temperature, onNote }) {
  if (!_genCache) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    _genCache = new GoogleGenerativeAI(KEYS.gemini());
  }

  const models = geminiModels();
  let lastErr;

  for (const modelName of models) {
    try {
      const model = _genCache.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: temperature ?? 0.7,
        },
      });
      const result = await model.generateContent([{ text: system }, { text: user }]);
      if (modelName !== models[0]) onNote && onNote(`Gemini respondeu com fallback ${modelName}`);
      return parseLenientJson(result.response.text());
    } catch (err) {
      lastErr = err;
      const transient = isTransientError(err);
      onNote && onNote(`Gemini modelo ${modelName} falhou${transient ? ' (temporario)' : ''}: ${String(err.message || err).slice(0, 120)}`);
      if (transient && modelName !== models[models.length - 1]) await sleep(800);
    }
  }

  throw lastErr;
}

const CALLERS = { groq: callGroq, gemini: callGemini, openrouter: callOpenRouter };

async function generateJson(opts) {
  const configuredOrder = providerOrder();
  if (!configuredOrder.length) {
    const e = new Error('NENHUM_PROVEDOR_IA: configure GROQ_API_KEY, GEMINI_API_KEY ou OPENROUTER_API_KEY no .env');
    e.code = 'NO_PROVIDER';
    throw e;
  }

  const now = Date.now();
  const order = configuredOrder.filter(provider => !providerCooldown[provider] || providerCooldown[provider] <= now);
  if (!order.length) {
    Object.keys(providerCooldown).forEach(provider => { delete providerCooldown[provider]; });
    order.push(...configuredOrder);
  }

  const retries = opts.retries ?? 1;
  const note = opts.onNote || (() => {});
  let lastErr;

  for (const provider of order) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await CALLERS[provider]({
          system: opts.system,
          user: opts.user,
          temperature: opts.temperature,
          onNote: note,
        });
        if (provider !== order[0] || attempt > 0) {
          note(`Respondido por ${provider}${attempt ? ` (tentativa ${attempt + 1})` : ''}`);
        }
        return { data, provider };
      } catch (err) {
        lastErr = err;
        const quota = isQuotaError(err);
        const transient = isTransientError(err);
        const detail = shortErr(err, 170);
        if (quota) {
          providerCooldown[provider] = Date.now() + QUOTA_COOLDOWN_MS;
          note(`${provider} recusou por credito/limite: ${detail}. Pulando para o proximo provedor.`);
        } else if (transient) {
          note(`${provider} instavel agora: ${detail}. Tentando alternativa.`);
        } else {
          note(`${provider} falhou: ${detail}. Tentando alternativa.`);
        }
        if ((quota || transient) && attempt < retries) {
          await sleep((transient ? 1200 : 1500) * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  const e = new Error(`TODOS_PROVEDORES_FALHARAM: ${String(lastErr && lastErr.message || lastErr).slice(0, 200)}`);
  e.code = 'ALL_FAILED';
  e.cause = lastErr;
  throw e;
}

module.exports = {
  generateJson,
  getProviderStatus,
  providerOrder,
  isQuotaError,
  isTransientError,
};
