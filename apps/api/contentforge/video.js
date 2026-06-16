'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { turminhaPrompt, TURMINHA_ASSETS } = require('./turminha');
const { COURSE_VISUAL_DNA, LESSON_VISUAL_BLUEPRINT } = require('./visual_reference');

const DATA_DIR = path.join(__dirname, '..', 'data');
const JOB_FILE = path.join(DATA_DIR, 'video-jobs.json');
const FAL_ENDPOINT = process.env.FAL_VIDEO_ENDPOINT || 'fal-ai/kling-video/v3/pro/image-to-video';
const TURMINHA_REFERENCE_URL = process.env.TURMINHA_REFERENCE_URL || 'https://noseutempo.app/assets/geni-ia-maos-sem-fundo-v2.png';

function readJobs() {
  try { return JSON.parse(fs.readFileSync(JOB_FILE, 'utf8')); }
  catch { return []; }
}

function writeJobs(jobs) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(JOB_FILE, JSON.stringify(jobs, null, 2));
}

function clean(s, max) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max || 500);
}

function pickStyle(style) {
  const raw = clean(style, 24).toLowerCase();
  if (['visual', 'narrativo', 'pratico'].includes(raw)) return raw;
  return 'visual';
}

function buildEducationalVideoPrompt(params) {
  const topic = clean(params.topic || params.title || 'uma ideia da aula', 180);
  const text = clean(params.text || params.detail || '', 600);
  const style = pickStyle(params.style);
  const targetAge = clean(params.targetAge || 'alunos brasileiros', 80);
  const signal = clean(params.signal || '', 80);
  const focusCharacter = clean(params.focusCharacter || '', 40);

  const styleLine = style === 'narrativo'
    ? 'warm storybook animation, gentle movements, everyday scene, friendly characters'
    : style === 'pratico'
      ? 'clear step-by-step demonstration, hands-on learning, calm pacing'
      : 'colorful educational animation, simple visual metaphors, friendly atmosphere';

  const supportLine = signal === 'low_confidence'
    ? 'Break the idea into very small parts, repeat the key concept visually, and avoid visual clutter.'
    : signal === 'sensory_overload'
      ? 'Use soft colors, minimal elements, slow movement, and a calm composition.'
      : 'Keep the pacing calm and encouraging, with one idea at a time.';

  return [
    turminhaPrompt(),
    COURSE_VISUAL_DNA,
    LESSON_VISUAL_BLUEPRINT,
    `Short educational animated video for NoSeuTempo about: "${topic}".`,
    text ? `Lesson context: ${text}.` : '',
    `Audience: ${targetAge}. Inclusive neurodivergent-friendly learning, Brazilian Portuguese classroom context.`,
    focusCharacter ? `Focus the scene on ${focusCharacter}, keeping Geni as the consistent NoSeuTempo guide.` : 'Focus the scene on Geni as the consistent NoSeuTempo guide.',
    `Visual style: ${styleLine}.`,
    supportLine,
    'Build a concrete beautiful learning scene: soft background, one clear visual metaphor, cute didactic objects, calm camera, gentle expressions, and a visible action that explains the idea.',
    'For science or nature lessons, prefer bright simple landscapes, friendly plants, sun, water, clouds, soil, cards, and sparkle accents only when useful.',
    'For abstract lessons, turn the idea into tangible props: cards, paths, blocks, notebooks, small maps, or a cozy study table.',
    'Use Geni as the main visual creator. Avoid the old Turminha group cast; if a learner appears, keep them secondary and generic.',
    'No text overlays except very short readable Portuguese labels if needed. No logos. High quality 16:9 composition.'
  ].filter(Boolean).join(' ');
}

function fallbackStoryboard(params, prompt) {
  const topic = clean(params.topic || params.title || 'esta ideia', 120);
  const text = clean(params.text || params.detail || '', 220);
  return {
    title: topic,
    prompt,
    cast: ['Geni'],
    referenceSheet: TURMINHA_ASSETS.referenceSheet,
    scenes: [
      { label: 'Cena', text: `Um fundo calmo e bonito mostra ${topic} com objetos fofos e poucos estimulos.` },
            { label: 'Geni', text: text || `Geni mostra ${topic} como uma coisa pequena por vez.` },
            { label: 'Cena', text: `Geni cria uma cena simples do dia a dia para explicar ${topic}.` },
            { label: 'Agora', text: 'Geni espera o aluno seguir para o proximo passo quando quiser.' },
    ],
  };
}

function findReusableJob({ userId, courseId, unitIndex, lessonIndex, blockIndex, variationKey }) {
  const jobs = readJobs();
  const hasFalKey = !!(process.env.FAL_KEY || process.env.FAL_API_KEY);
  return jobs
    .filter(j =>
      String(j.userId) === String(userId) &&
      String(j.courseId) === String(courseId) &&
      Number(j.unitIndex) === Number(unitIndex) &&
      Number(j.lessonIndex) === Number(lessonIndex) &&
      Number(j.blockIndex) === Number(blockIndex) &&
      (variationKey ? String(j.variationKey || '') === String(variationKey) : true) &&
      ['queued', 'generating', 'ready'].includes(j.status) &&
      !(hasFalKey && j.provider === 'local-fallback')
    )
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
}

async function falFetch(url, opts) {
  const key = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
  if (!key) {
    const e = new Error('FAL_KEY_NAO_CONFIGURADA');
    e.code = 'NO_FAL_KEY';
    throw e;
  }
  const headers = Object.assign({ 'Authorization': `Key ${key}` }, (opts && opts.headers) || {});
  if (!headers['Content-Type'] && opts && opts.body) headers['Content-Type'] = 'application/json';
  const resp = await fetch(url, Object.assign({}, opts, { headers }));
  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!resp.ok) {
    const e = new Error(`fal.ai ${resp.status}: ${text.slice(0, 300)}`);
    e.status = resp.status;
    throw e;
  }
  return json;
}

async function submitFalVideo(prompt) {
  const url = `https://queue.fal.run/${FAL_ENDPOINT}`;
  const isImageVideo = /image-to-video|reference-to-video/.test(FAL_ENDPOINT);
  const input = {
    prompt,
    duration: process.env.FAL_VIDEO_DURATION || '5',
    aspect_ratio: '16:9',
    generate_audio: false,
    negative_prompt: 'blur, distorted faces, distorted hands, unreadable text, watermark, subtitles, extra buttons, UI overlay, low quality, scary expression',
    cfg_scale: 0.65,
  };
  if (isImageVideo) {
    input.start_image_url = TURMINHA_REFERENCE_URL;
  }
  const data = await falFetch(url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return {
    requestId: data.request_id || data.requestId || '',
    statusUrl: data.status_url || '',
    responseUrl: data.response_url || '',
  };
}

async function refreshFalJob(job) {
  if (!job || !job.statusUrl || job.status === 'ready' || job.status === 'failed') return job;
  const status = await falFetch(job.statusUrl, { method: 'GET' });
  const remoteStatus = String(status.status || '').toUpperCase();

  if (remoteStatus === 'COMPLETED') {
    const result = await falFetch(job.responseUrl, { method: 'GET' });
    const data = result.data || result;
    const videoUrl = data?.video?.url || data?.output?.url || data?.url || '';
    if (!videoUrl) throw new Error('Video pronto, mas sem URL retornada.');
    return Object.assign({}, job, {
      status: 'ready',
      videoUrl,
      updatedAt: new Date().toISOString(),
    });
  }
  if (remoteStatus === 'FAILED' || remoteStatus === 'ERROR') {
    return Object.assign({}, job, {
      status: 'failed',
      error: status.error || status.detail || 'Falha ao gerar video.',
      updatedAt: new Date().toISOString(),
    });
  }
  return Object.assign({}, job, {
    status: remoteStatus === 'IN_QUEUE' ? 'queued' : 'generating',
    updatedAt: new Date().toISOString(),
  });
}

async function createVideoJob({ userId, body }) {
  const courseId = clean(body.courseId, 80);
  const unitIndex = Number(body.unitIndex) || 0;
  const lessonIndex = Number(body.lessonIndex) || 0;
  const blockIndex = Number(body.blockIndex) || 0;
  const variationKey = clean(body.variationKey, 80);
  const focusCharacter = clean(body.focusCharacter, 40);
  const reusable = findReusableJob({ userId, courseId, unitIndex, lessonIndex, blockIndex, variationKey });
  if (reusable) return reusable;

  const prompt = clean(body.falPrompt, 1800) || buildEducationalVideoPrompt({
    topic: body.title || body.topic,
    text: [body.text, body.detail].filter(Boolean).join(' '),
    style: body.style,
    targetAge: body.targetAge,
    signal: body.signal,
    focusCharacter,
  });
  const now = new Date().toISOString();
  const job = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
    userId: String(userId),
    courseId,
    unitIndex,
    lessonIndex,
    blockIndex,
    blockType: clean(body.blockType, 40),
    variationKey,
    focusCharacter,
    title: clean(body.title || body.topic || 'Video da aula', 160),
    prompt,
    status: 'queued',
    provider: 'fal.ai',
    videoUrl: '',
    requestId: '',
    statusUrl: '',
    responseUrl: '',
    fallback: null,
    error: '',
    createdAt: now,
    updatedAt: now,
  };

  const jobs = readJobs();
  try {
    const falJob = await submitFalVideo(prompt);
    Object.assign(job, falJob, { status: 'generating' });
  } catch (e) {
    job.status = e.code === 'NO_FAL_KEY' ? 'ready' : 'failed';
    job.provider = e.code === 'NO_FAL_KEY' ? 'local-fallback' : 'fal.ai';
    job.error = clean(e.message, 300);
    job.fallback = fallbackStoryboard(body, prompt);
  }
  jobs.push(job);
  writeJobs(jobs.slice(-500));
  return job;
}

async function getVideoJobForUser(userId, jobId) {
  const jobs = readJobs();
  const idx = jobs.findIndex(j => j.id === jobId && String(j.userId) === String(userId));
  if (idx < 0) return null;
  let job = jobs[idx];
  if (['queued', 'generating'].includes(job.status)) {
    try {
      job = await refreshFalJob(job);
    } catch (e) {
      job = Object.assign({}, job, {
        status: 'failed',
        error: clean(e.message, 300),
        fallback: job.fallback || fallbackStoryboard(job, job.prompt),
        updatedAt: new Date().toISOString(),
      });
    }
    jobs[idx] = job;
    writeJobs(jobs);
  }
  return job;
}

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    provider: job.provider,
    videoUrl: job.videoUrl || '',
    fallback: job.fallback || null,
    error: job.error || '',
    title: job.title || '',
    updatedAt: job.updatedAt,
  };
}

module.exports = {
  createVideoJob,
  getVideoJobForUser,
  publicJob,
  buildEducationalVideoPrompt,
};
