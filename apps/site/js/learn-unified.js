(function () {
  'use strict';

  var API = window.NST_API || 'https://api.noseutempo.app';
  var token = localStorage.getItem('nst.token');
  if (!token) { location.href = 'login.html'; return; }

  var state = { courses: [], progress: { courses: {}, summary: {} }, current: null, content: null };
  var labels = { basico: 'iniciante', intermediario: 'intermediario', avancado: 'avancado' };
  var qs = new URLSearchParams(location.search);
  var previewMode = qs.get('preview') === '1';
  var forcedCourseId = qs.get('course') || '';
  var forcedUnitIndex = Number(qs.get('unit') || 0);
  var forcedLessonIndex = Number(qs.get('lesson') || 0);

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function safeIndex(n) {
    n = Number(n);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function courseTime(c) {
    var t = c && c.criado ? Date.parse(c.criado) : 0;
    return isNaN(t) ? 0 : t;
  }

  function sortCourses(courses) {
    return (Array.isArray(courses) ? courses : []).slice().sort(function (a, b) {
      return courseTime(b) - courseTime(a);
    });
  }

  function hrefFor(course, unit, lesson) {
    var safeUnit = safeIndex(unit);
    var safeLesson = safeIndex(lesson);
    return 'aula.html?course=' + encodeURIComponent(course.id) + '&unit=' + safeUnit + '&lesson=' + safeLesson + '&v=carol1' + (previewMode ? '&preview=1' : '');
  }

  function treinoHrefFor(course, unit, lesson) {
    var safeUnit = safeIndex(unit);
    var safeLesson = safeIndex(lesson);
    return 'treino-extra.html?course=' + encodeURIComponent(course.id) + '&unit=' + safeUnit + '&lesson=' + safeLesson + (previewMode ? '&preview=1' : '');
  }

  function pageHrefFor(page) {
    if (!previewMode || !forcedCourseId) return page;
    return page + '?preview=1&course=' + encodeURIComponent(forcedCourseId) + '&unit=' + safeIndex(forcedUnitIndex) + '&lesson=' + safeIndex(forcedLessonIndex);
  }

  function pickCurrent() {
    var byId = state.progress.courses || {};
    var ranked = state.courses.map(function (c, idx) {
      var p = byId[c.id] || {};
      var pct = Number(p.percent) || 0;
      var rank = pct > 0 && pct < 100 ? 0 : (pct === 0 ? 1 : 2);
      return { course: c, progress: p, rank: rank, idx: idx };
    }).sort(function (a, b) {
      return a.rank - b.rank || courseTime(b.course) - courseTime(a.course) || a.idx - b.idx;
    });
    if (forcedCourseId) {
      var forced = ranked.find(function (item) { return item.course && item.course.id === forcedCourseId; });
      if (forced) {
        state.current = forced;
        return;
      }
    }
    state.current = ranked[0] || null;
  }

  function loadContentForCurrent() {
    if (!state.current) return Promise.resolve(null);
    var c = state.current.course;
    return fetch(API + '/api/courses/' + encodeURIComponent(c.id) + '/content', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (content) {
      state.content = content;
      return content;
    }).catch(function () { return null; });
  }

  function lessonInfo() {
    var current = state.current || {};
    var p = current.progress || {};
    var unitIndex = p.last && Number.isFinite(Number(p.last.unit)) ? Number(p.last.unit) : 0;
    var lessonIndex = p.last && Number.isFinite(Number(p.last.lesson)) ? Number(p.last.lesson) : 0;
    if (previewMode && current.course && current.course.id === forcedCourseId) {
      unitIndex = safeIndex(forcedUnitIndex);
      lessonIndex = safeIndex(forcedLessonIndex);
    }
    var unit = state.content && state.content.units && state.content.units[unitIndex];
    if (!unit && state.content && Array.isArray(state.content.units) && state.content.units.length) {
      unitIndex = 0;
      unit = state.content.units[0];
    }
    var lesson = unit && unit.lessons && unit.lessons[lessonIndex];
    if (!lesson && unit && Array.isArray(unit.lessons) && unit.lessons.length) {
      lessonIndex = 0;
      lesson = unit.lessons[0];
    }
    return {
      unitIndex: unitIndex,
      lessonIndex: lessonIndex,
      title: (lesson && lesson.title) || (current.course && current.course.titulo) || 'Sua próxima aula',
      unitTitle: (unit && unit.title) || (current.course && current.course.category) || 'Aprender',
      totalLessons: p.total || countLessons(state.content),
      completed: p.completed || 0,
      percent: Number(p.percent) || 0
    };
  }

  function countLessons(content) {
    return content && Array.isArray(content.units)
      ? content.units.reduce(function (sum, u) { return sum + ((u.lessons || []).length); }, 0)
      : 0;
  }

  function renderHome() {
    var main = document.getElementById('home-root');
    if (!main) return;
    if (!state.courses.length) {
      main.innerHTML = '<div class="nst-card empty-state">A Geni ainda não encontrou cursos disponíveis para você.</div>';
      return;
    }
    var current = state.current.course;
    var info = lessonInfo();
    var href = hrefFor(current, info.unitIndex, info.lessonIndex);
    var treinoHref = treinoHrefFor(current, info.unitIndex, info.lessonIndex);
    var cursosHref = pageHrefFor('cursos.html');
    var summary = state.progress.summary || {};
    main.innerHTML =
      '<section class="nst-hero">' +
        '<article class="nst-card continue-card">' +
          '<div class="lesson-art" aria-hidden="true"></div>' +
          '<div class="continue-copy">' +
            '<p class="nst-eyebrow">' + (previewMode ? 'Prévia da jornada' : 'Minha página inicial') + '</p>' +
            '<h2>Tudo pronto para aprender no seu tempo.</h2>' +
            '<p>Seu espaço foi organizado do seu jeito. A Geni separou o próximo passo com calma.</p>' +
            '<h3>' + esc(info.title) + '</h3>' +
            '<p>' + esc(info.unitTitle) + ' - passo ' + (info.lessonIndex + 1) + ' de ' + Math.max(1, info.totalLessons || 1) + '</p>' +
            '<div class="progress-row"><div class="progress-track"><span style="width:' + info.percent + '%"></span></div><b>' + info.percent + '%</b></div>' +
            '<div class="chip-row"><span>áudio + imagem</span><span>com exemplos</span><span>pouco estímulo</span></div>' +
            '<div class="nst-actions"><a class="nst-btn primary" href="' + href + '">' + (previewMode ? 'Abrir aula' : 'Continuar aula') + '</a><a class="nst-btn ghost" href="' + treinoHref + '">Treino extra</a><a class="nst-btn ghost" href="' + cursosHref + '">Ver cursos</a></div>' +
          '</div>' +
        '</article>' +
        '<aside class="nst-card geni-side">' +
          '<div><p class="nst-eyebrow">Geni IA</p><h2>Posso explicar de outro jeito.</h2><p>Quando uma etapa pesar, eu transformo em imagem, história ou passos pequenos.</p><div class="geni-bubble">Sem pressa. Uma ideia por vez.</div></div>' +
          '<img src="assets/geni-ia-maos-sem-fundo-v2.png" alt="Geni IA">' +
        '</aside>' +
      '</section>' +
      '<section><div class="section-title"><div><h2>O que você pode fazer agora</h2><p>Escolha um caminho leve para continuar.</p></div></div>' +
        '<div class="quick-grid">' +
          '<a class="quick-card" href="' + href + '"><span>1</span><h3>' + (previewMode ? 'Abrir aula' : 'Continuar aula') + '</h3><p>Voltar para onde parou.</p></a>' +
          '<a class="quick-card" href="' + treinoHref + '"><span>2</span><h3>Treino extra</h3><p>Praticar com jogos leves.</p></a>' +
          '<a class="quick-card" href="geni.html"><span>3</span><h3>Conversar com a Geni IA</h3><p>Tirar dúvidas e pedir exemplos.</p></a>' +
          '<a class="quick-card" href="' + cursosHref + '"><span>4</span><h3>Escolher outro curso</h3><p>Ver tudo que está disponível.</p></a>' +
        '</div></section>' +
      '<section class="two-grid">' +
        '<article class="small-card"><span>T</span><h3>Meus temas favoritos</h3><p>A Geni usa exemplos curtos, imagens bonitas e pouco estímulo.</p><div class="chip-row"><span>áudio + imagem</span><span>frases curtas</span><span>sem pressa</span></div></article>' +
        '<article class="small-card"><span>OK</span><h3>Minhas conquistas</h3><p>' + (summary.aulasConcluidas || 0) + ' aulas concluídas, ' + (summary.palavras || 0) + ' palavras e ' + (summary.streak || 0) + ' dias de sequência.</p></article>' +
      '</section>';
  }

  function renderCourses() {
    var grid = document.getElementById('courses-root');
    if (!grid) return;
    if (!state.courses.length) {
      grid.innerHTML = '<div class="nst-card empty-state">Os cursos criados no Estúdio aparecerão aqui.</div>';
      return;
    }
    var byId = state.progress.courses || {};
    grid.innerHTML = state.courses.map(function (c) {
      var p = byId[c.id] || {};
      var pct = Number(p.percent) || 0;
      var last = p.last || {};
      if (previewMode && c.id === forcedCourseId) last = { unit: safeIndex(forcedUnitIndex), lesson: safeIndex(forcedLessonIndex) };
      var href = hrefFor(c, last.unit || 0, last.lesson || 0);
      return '<a class="course-card" href="' + href + '">' +
        '<div class="course-cover"></div>' +
        '<h3>' + esc(c.titulo) + '</h3>' +
        '<p>' + esc(c.descricao || c.tagline || 'Uma jornada leve criada pela Geni.') + '</p>' +
        '<div class="progress-row"><div class="progress-track"><span style="width:' + pct + '%"></span></div><b>' + pct + '%</b></div>' +
        '<div class="course-meta">' +
          (c.difficulty ? '<span class="course-tag">' + esc(labels[c.difficulty] || c.difficulty) + '</span>' : '') +
          (c.totalMinutes ? '<span class="course-tag">' + c.totalMinutes + ' min</span>' : '') +
          (c.modulos ? '<span class="course-tag">' + c.modulos + ' módulos</span>' : '') +
        '</div>' +
      '</a>';
    }).join('');
  }

  function init() {
    Promise.all([
      fetch(API + '/api/courses').then(function (r) { return r.json(); }).catch(function () { return []; }),
      fetch(API + '/api/progress', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function (r) { return r.ok ? r.json() : { courses: {}, summary: {} }; })
        .catch(function () { return { courses: {}, summary: {} }; })
    ]).then(function (arr) {
      state.courses = sortCourses(arr[0]);
      state.progress = arr[1] || { courses: {}, summary: {} };
      pickCurrent();
      return loadContentForCurrent();
    }).then(function () {
      renderHome();
      renderCourses();
    }).catch(function () {
      var home = document.getElementById('home-root');
      var courses = document.getElementById('courses-root');
      if (home) home.innerHTML = '<div class="nst-card empty-state">Não foi possível carregar seu início agora.</div>';
      if (courses) courses.innerHTML = '<div class="nst-card empty-state">Não foi possível carregar os cursos agora.</div>';
    });
  }

  init();
})();
