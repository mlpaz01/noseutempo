'use strict';
/**
 * NoSeuTempo — TTS na nuvem (voz feminina es-ES, entonação natural)
 * Provedores: Azure Neural (Elvira/Abril) e OpenAI TTS (nova/shimmer).
 * Cache em disco: cada frase é gerada UMA vez e reutilizada (economiza $).
 */
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const CACHE = path.join(__dirname, '..', 'data', 'tts-cache');
fs.mkdirSync(CACHE, { recursive: true });

function cacheFile(provider, voice, text) {
  const h = crypto.createHash('sha1').update(provider + '|' + voice + '|' + text).digest('hex');
  return path.join(CACHE, h + '.mp3');
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/* ── Azure Neural TTS ── */
async function synthAzure(text, voice) {
  const key    = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'brazilsouth';
  if (!key) throw new Error('azure-nao-configurado');
  const v = voice || 'es-ES-ElviraNeural';
  const ssml =
    `<speak version='1.0' xml:lang='es-ES'>` +
    `<voice name='${v}'><prosody rate='-6%'>${escapeXml(text)}</prosody></voice></speak>`;
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'NoSeuTempo',
    },
    body: ssml,
  });
  if (!r.ok) throw new Error('azure-http-' + r.status + ': ' + (await r.text()).slice(0, 180));
  return Buffer.from(await r.arrayBuffer());
}

/* ── OpenAI TTS ── */
async function synthOpenAI(text, voice) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('openai-nao-configurado');
  const v = voice || 'nova';
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: v,
      input: text,
      response_format: 'mp3',
      instructions: 'Habla en español de España, con voz femenina, cálida, paciente y natural. Ritmo pausado, ideal para estudiantes que están aprendiendo.',
    }),
  });
  if (!r.ok) throw new Error('openai-http-' + r.status + ': ' + (await r.text()).slice(0, 180));
  return Buffer.from(await r.arrayBuffer());
}

async function synth(provider, voice, text) {
  text = String(text || '').trim().slice(0, 600);
  if (!text) throw new Error('texto-vazio');
  const file = cacheFile(provider, voice || '', text);
  try { if (fs.existsSync(file)) return fs.readFileSync(file); } catch (e) {}
  let buf;
  if (provider === 'azure')       buf = await synthAzure(text, voice);
  else if (provider === 'openai') buf = await synthOpenAI(text, voice);
  else throw new Error('provider-invalido');
  try { fs.writeFileSync(file, buf); } catch (e) {}
  return buf;
}

module.exports = { synth };
