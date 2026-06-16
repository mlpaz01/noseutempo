'use strict';
/**
 * NoSeuTempo ContentForge — AGENT
 *
 * Orquestra o planner + generator para criar um curso completo.
 * Salva o resultado em data/courses.json e data/course-content/<id>/
 */

const { plan }                  = require('./planner');
const { generateLessonBlocks }  = require('./generator');
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONTENT_DIR = path.join(DATA_DIR, 'course-content');

function ensureDirs() {
  fs.mkdirSync(DATA_DIR,    { recursive: true });
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
}

function readJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Gera um curso completo e salva no banco.
 *
 * @param {object} opts
 * @param {string} opts.topic
 * @param {string} opts.category        - Ver CATEGORIAS no planner.js
 * @param {string} [opts.audience]
 * @param {number} [opts.duration]      - minutos (default 60)
 * @param {string} [opts.difficulty]    - basico | intermediario | avancado
 * @param {string} opts.geminiKey
 * @param {Function} [opts.onProgress]  - (percent, message) => void
 * @returns {Promise<object>}           - Objeto do curso salvo
 */
async function generateCourse(opts) {
  ensureDirs();
  opts.duration   = opts.duration   || 60;
  opts.difficulty = opts.difficulty || 'basico';
  opts.audience   = opts.audience   || 'adultos brasileiros que querem aprender de forma acessível';

  const progress = opts.onProgress || (() => {});
  const note     = opts.onNote     || (() => {});

  // Telemetria: quais provedores responderam e quantas aulas falharam
  const providerCounts = {};
  const failedLessons  = [];
  const bumpProvider = (p) => { if (p) providerCounts[p] = (providerCounts[p] || 0) + 1; };

  // ─── 1. PLANEJAR ─────────────────────────────────────────
  await progress(2, 'Pensando na estrutura do curso…');
  const outline = await plan({ ...opts, onNote: note });

  const courseId = newId();
  const totalLessons = outline.units.reduce((s, u) => s + (u.lessonTitles?.length || 0), 0);
  let lessonsDone = 0;

  // ─── 2. GERAR AULAS ──────────────────────────────────────
  const units = [];
  for (let ui = 0; ui < outline.units.length; ui++) {
    const unitOutline = outline.units[ui];
    await progress(
      15 + Math.round((lessonsDone / totalLessons) * 75),
      `Criando unidade ${ui + 1}: ${unitOutline.title}…`
    );

    const lessons = [];
    const prevTitles = [];
    for (let li = 0; li < unitOutline.lessonTitles.length; li++) {
      const lessonTitle = unitOutline.lessonTitles[li];
      await progress(
        15 + Math.round((lessonsDone / totalLessons) * 75),
        `Aula ${lessonsDone + 1}/${totalLessons}: ${lessonTitle}…`
      );

      let lessonData;
      try {
        lessonData = await generateLessonBlocks({ ...opts, onNote: note }, {
          courseTitle:          outline.title,
          courseCategory:       opts.category,
          unitTitle:            unitOutline.title,
          unitMotivacao:        unitOutline.motivação || unitOutline.motivacao || '',
          lessonTitle:          lessonTitle,
          previousLessonTitles: [...prevTitles],
        });
        bumpProvider(lessonData._provider);
        delete lessonData._provider;
      } catch (e) {
        console.error(`[ContentForge] Erro na aula "${lessonTitle}":`, e.message);
        failedLessons.push(lessonTitle);
        note(`⚠️ Aula "${lessonTitle}" não pôde ser gerada: ${String(e.message || e).slice(0, 140)}`);
        lessonData = {
          estimatedMinutes: 3,
          _failed: true,
          blocks: [{ type: 'concept', data: { title: lessonTitle, body: 'Conteúdo ainda não gerado (IA indisponível no momento). Você pode regenerar esta aula pelo Estúdio.', emoji: '⏳' } }],
        };
      }

      lessons.push({
        id:                newId(),
        title:             lessonTitle,
        estimatedMinutes:  lessonData.estimatedMinutes || 3,
        extraPractice:     lessonData.extraPractice || null,
        blocks:            lessonData.blocks || [],
        order:             li,
        failed:            !!lessonData._failed,
      });
      prevTitles.push(lessonTitle);
      lessonsDone++;

      // Pequena pausa para não estourar rate limit
      if (li < unitOutline.lessonTitles.length - 1) await sleep(600);
    }

    units.push({
      id:          newId(),
      title:       unitOutline.title,
      description: unitOutline.description,
      icon:        unitOutline.icon || '📚',
      motivacao:   unitOutline.motivação || unitOutline.motivacao || '',
      order:       ui,
      lessons,
    });

    if (ui < outline.units.length - 1) await sleep(800);
  }

  // ─── 3. MONTAR OBJETO FINAL ───────────────────────────────
  const course = {
    id:          courseId,
    titulo:      outline.title,
    descricao:   outline.description,
    tagline:     outline.tagline || '',
    category:    opts.category || 'estudos',
    difficulty:  opts.difficulty,
    capa:        '',   // URL pode ser preenchida depois
    coverImageQuery: outline.coverImageQuery || '',
    totalEstimatedMinutes: units.reduce(
      (s, u) => s + u.lessons.reduce((ls, l) => ls + l.estimatedMinutes, 0), 0
    ),
    units,
    criado:      new Date().toISOString(),
    generatedBy: 'contentforge-noseutempo-v2',
    report: {
      totalLessons,
      failedLessons,                 // títulos das aulas que não puderam ser geradas
      failedCount: failedLessons.length,
      providerCounts,                // ex: { groq: 14, gemini: 1 }
      ok: failedLessons.length === 0,
    },
  };

  // ─── 4. SALVAR ────────────────────────────────────────────
  const coursesFile = path.join(DATA_DIR, 'courses.json');
  const courses = readJson(coursesFile, []);
  // Versão resumida no índice (sem os blocos completos)
  courses.push({
    id:          course.id,
    titulo:      course.titulo,
    descricao:   course.descricao,
    tagline:     course.tagline,
    category:    course.category,
    difficulty:  course.difficulty,
    capa:        course.capa,
    modulos:     course.units.length,
    totalMinutes:course.totalEstimatedMinutes,
    criado:      course.criado,
  });
  writeJson(coursesFile, courses);

  // Conteúdo completo em arquivo separado
  writeJson(path.join(CONTENT_DIR, `${courseId}.json`), course);

  // Resumo final para o usuário (provedores usados + aulas com falha)
  const usados = Object.entries(providerCounts).map(([p, n]) => `${p}: ${n}`).join(' · ') || 'nenhum';
  if (failedLessons.length) {
    note(`⚠️ ${failedLessons.length}/${totalLessons} aula(s) não geraram (IA sem saldo). Provedores: ${usados}.`);
    await progress(100, `Curso "${course.titulo}" criado com ${failedLessons.length} aula(s) pendente(s). Veja o aviso abaixo.`);
  } else {
    note(`✓ Todas as ${totalLessons} aulas geradas. Provedores: ${usados}.`);
    await progress(100, `Curso "${course.titulo}" criado com sucesso! 🎉`);
  }
  return course;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = { generateCourse };
