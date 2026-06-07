'use strict';
// Extrai e parseia JSON mesmo que o LLM adicione texto em volta
function parseLenientJson(text) {
  text = text.trim();
  // Remove blocos de código markdown
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  // Tenta parse direto
  try { return JSON.parse(text); } catch {}
  // Tenta extrair o primeiro { } ou [ ]
  const start = text.search(/[{\[]/);
  const end   = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  throw new Error(`Não foi possível extrair JSON da resposta: ${text.slice(0, 200)}`);
}
module.exports = { parseLenientJson };
