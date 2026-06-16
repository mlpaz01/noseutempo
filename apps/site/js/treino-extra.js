(function () {
  'use strict';

  var API = window.NST_API || 'https://api.noseutempo.app';
  var token = localStorage.getItem('nst.token');
  if (!token) { location.href = 'login.html?next=treino-extra.html'; return; }

  var state = { courses: [], contents: {}, selectedCourse: null, selectedUnit: 0, selectedLesson: 0, activities: [], active: 0 };
  var qs = new URLSearchParams(location.search);

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function api(path) {
    return fetch(API + path, { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) { if (!r.ok) throw new Error('Falha ao carregar.'); return r.json(); });
  }

  function speak(text) {
    if (window.NSTVoice && window.NSTVoice.speak) return window.NSTVoice.speak(text);
    if (!('speechSynthesis' in window) || !text) return;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 0.92;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function sortCourses(courses) {
    return (Array.isArray(courses) ? courses : []).slice().sort(function (a, b) {
      return (Date.parse(b.criado || '') || 0) - (Date.parse(a.criado || '') || 0);
    });
  }

  function currentContent() { return state.contents[state.selectedCourse && state.selectedCourse.id]; }
  function currentUnit() { var c = currentContent(); return c && c.units && c.units[state.selectedUnit]; }
  function currentLesson() { var u = currentUnit(); return u && u.lessons && u.lessons[state.selectedLesson]; }

  function normalizeWords(words) {
    return (Array.isArray(words) ? words : []).map(function (w) {
      if (typeof w === 'string') return { word: w, hint: '' };
      return {
        word: String(w.word || w.term || w.text || w.a || ''),
        hint: String(w.translation || w.meaning || w.hint || w.b || ''),
        emoji: w.emoji || ''
      };
    }).filter(function (w) { return w.word; }).slice(0, 8);
  }

  function activitiesFromLesson(lesson) {
    var out = [];
    var extra = lesson && lesson.extraPractice;
    if (extra) {
      var focus = normalizeWords(extra.focusWords || extra.words || []);
      var cards = normalizeWords(extra.cards || []);
      if (focus.length) out.push({ type: 'vocab', title: extra.title || 'Palavras da aula', words: focus });
      if (cards.length >= 2) out.push({ type: 'memory', title: 'Memória visual', pairs: cards.slice(0, 6).map(function (w) { return { a: w.word, b: w.hint || w.word }; }) });
      if (Array.isArray(extra.prompts)) {
        extra.prompts.slice(0, 4).forEach(function (p) {
          if (p && Array.isArray(p.options)) out.push({ type: 'quiz', title: p.title || 'Escolha com calma', question: p.question, options: p.options, correctIndex: Number(p.correctIndex) || 0, explanation: p.explanation || '' });
        });
      }
    }

    (lesson && lesson.blocks || []).forEach(function (b) {
      var d = b.data || b;
      var t = b.type || d.type;
      if (t === 'audio_vocab') {
        var words = normalizeWords(d.words);
        if (words.length) out.push({ type: 'vocab', title: d.title || 'Ouça e repita', words: words });
        if (words.length >= 2) out.push({ type: 'memory', title: 'Memória da aula', pairs: words.slice(0, 6).map(function (w) { return { a: w.word, b: w.hint || w.word }; }) });
      }
      if (t === 'match_pairs' && Array.isArray(d.leftItems) && Array.isArray(d.rightItems)) {
        out.push({ type: 'match', title: 'Conecte os pares', left: d.leftItems.slice(0, 5), right: d.rightItems.slice(0, 5), pairs: d.correctPairs || [] });
      }
      if ((t === 'quick_check' || t === 'multiple_choice') && Array.isArray(d.options)) {
        out.push({ type: 'quiz', title: 'Escolha com calma', question: d.question, options: d.options, correctIndex: Number(d.correctIndex) || 0, explanation: d.explanation || '' });
      }
      if (t === 'fill_blank' && Array.isArray(d.wordBank)) {
        out.push({ type: 'quiz', title: 'Complete com apoio', question: String(d.template || '').replace(/_+/g, '_____'), options: d.wordBank, correctIndex: Math.max(0, d.wordBank.findIndex(function (x) { return String(x).toLowerCase() === String((d.correctAnswers || [])[0] || '').toLowerCase(); })), explanation: d.explanation || d.hint || '' });
      }
      if (t === 'drag_order' && Array.isArray(d.correctOrder || d.items)) {
        out.push({ type: 'order', title: d.instruction || 'Coloque em ordem', items: (d.correctOrder || d.items).slice(0, 5), explanation: d.explanation || '' });
      }
    });

    if (!out.length && lesson) {
      out.push({ type: 'quiz', title: 'Primeiro passo', question: 'Qual é a ideia principal desta aula?', options: [lesson.title, 'Pular tudo', 'Fazer com pressa'], correctIndex: 0, explanation: 'Isso. Uma ideia por vez já é um ótimo começo.' });
    }
    return out.slice(0, 8);
  }

  function renderPicker() {
    var el = document.getElementById('practice-picker');
    if (!el) return;
    if (!state.courses.length) {
      el.innerHTML = '<div class="practice-empty"><h2>Nenhum curso ainda</h2><p>Crie um curso no Estúdio com IA e os treinos aparecerão aqui.</p></div>';
      return;
    }
    var course = state.selectedCourse;
    var content = currentContent();
    var units = content && content.units || [];
    el.innerHTML =
      '<p class="nst-eyebrow">Escolha o treino</p>' +
      '<h2>' + esc(course ? course.titulo : 'Seus cursos') + '</h2>' +
      '<div class="practice-selects">' +
        '<label>Curso<select id="practice-course">' + state.courses.map(function (c) { return '<option value="' + esc(c.id) + '"' + (course && c.id === course.id ? ' selected' : '') + '>' + esc(c.titulo) + '</option>'; }).join('') + '</select></label>' +
        '<label>Unidade<select id="practice-unit">' + units.map(function (u, i) { return '<option value="' + i + '"' + (i === state.selectedUnit ? ' selected' : '') + '>' + esc(u.title || ('Unidade ' + (i + 1))) + '</option>'; }).join('') + '</select></label>' +
        '<label>Aula<select id="practice-lesson">' + ((units[state.selectedUnit] && units[state.selectedUnit].lessons) || []).map(function (l, i) { return '<option value="' + i + '"' + (i === state.selectedLesson ? ' selected' : '') + '>' + esc(l.title || ('Aula ' + (i + 1))) + '</option>'; }).join('') + '</select></label>' +
      '</div>' +
      '<div class="practice-list">' + state.activities.map(function (a, i) {
        return '<button class="' + (i === state.active ? 'active' : '') + '" data-activity="' + i + '"><span>' + (i + 1) + '</span><b>' + esc(a.title) + '</b><small>' + labelFor(a.type) + '</small></button>';
      }).join('') + '</div>';

    document.getElementById('practice-course').onchange = function () { selectCourse(this.value, 0, 0); };
    document.getElementById('practice-unit').onchange = function () { state.selectedUnit = Number(this.value) || 0; state.selectedLesson = 0; rebuild(); };
    document.getElementById('practice-lesson').onchange = function () { state.selectedLesson = Number(this.value) || 0; rebuild(); };
    Array.prototype.forEach.call(el.querySelectorAll('[data-activity]'), function (btn) {
      btn.onclick = function () { state.active = Number(btn.dataset.activity) || 0; renderPicker(); renderStage(); };
    });
  }

  function labelFor(type) {
    return { vocab: 'ouvir', memory: 'pares', match: 'conectar', quiz: 'escolher', order: 'ordenar' }[type] || 'praticar';
  }

  function renderStage() {
    var el = document.getElementById('practice-stage');
    var a = state.activities[state.active];
    if (!el) return;
    if (!a) {
      el.innerHTML = '<div class="practice-empty"><h2>Sem treino nesta aula</h2><p>A Geni ainda não encontrou atividades para este ponto.</p></div>';
      return;
    }
    if (a.type === 'vocab') return renderVocab(el, a);
    if (a.type === 'memory') return renderMemory(el, a);
    if (a.type === 'match') return renderMatch(el, a);
    if (a.type === 'order') return renderOrder(el, a);
    return renderQuiz(el, a);
  }

  function stageHead(a) {
    var lesson = currentLesson();
    return '<div class="practice-head"><div><p class="nst-eyebrow">' + esc(labelFor(a.type)) + '</p><h2>' + esc(a.title) + '</h2><p>' + esc(lesson && lesson.title || 'Treino extra') + '</p></div><img src="assets/geni-ia-maos-sem-fundo-v2.png" alt=""></div>';
  }

  function renderVocab(el, a) {
    el.innerHTML = stageHead(a) + '<div class="practice-vocab">' + a.words.map(function (w) {
      return '<button data-say="' + esc(w.word) + '"><span>' + esc(w.emoji || '•') + '</span><b>' + esc(w.word) + '</b><small>' + esc(w.hint || 'toque para ouvir') + '</small></button>';
    }).join('') + '</div><div class="practice-feedback" id="practice-feedback">Toque em uma palavra e repita no seu ritmo.</div>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-say]'), function (btn) {
      btn.onclick = function () { speak(btn.dataset.say); feedback('Boa. Ouvir primeiro ajuda o cérebro a organizar.'); };
    });
  }

  function renderQuiz(el, a) {
    el.innerHTML = stageHead(a) + '<div class="practice-question">' + esc(a.question || 'Escolha a melhor opção.') + '</div><div class="practice-options">' + (a.options || []).map(function (o, i) {
      return '<button data-option="' + i + '">' + esc(o) + '</button>';
    }).join('') + '</div><div class="practice-feedback" id="practice-feedback">Sem pressa. Leia uma opção por vez.</div>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-option]'), function (btn) {
      btn.onclick = function () {
        var ok = Number(btn.dataset.option) === Number(a.correctIndex);
        btn.classList.add(ok ? 'ok' : 'try');
        feedback(ok ? (a.explanation || 'Isso. Você encontrou um bom caminho.') : 'Quase. Tente olhar para a pista principal da pergunta.');
      };
    });
  }

  function renderMemory(el, a) {
    var cards = [];
    (a.pairs || []).slice(0, 6).forEach(function (p, idx) {
      cards.push({ id: idx, text: p.a });
      cards.push({ id: idx, text: p.b });
    });
    cards.sort(function () { return Math.random() - 0.5; });
    el.innerHTML = stageHead(a) + '<div class="practice-memory">' + cards.map(function (c, i) {
      return '<button data-card="' + i + '" data-pair="' + c.id + '"><span>?</span><b>' + esc(c.text) + '</b></button>';
    }).join('') + '</div><div class="practice-feedback" id="practice-feedback">Vire dois cartões e encontre os pares.</div>';
    var open = [];
    Array.prototype.forEach.call(el.querySelectorAll('[data-card]'), function (btn) {
      btn.onclick = function () {
        if (btn.classList.contains('open') || btn.classList.contains('done') || open.length >= 2) return;
        btn.classList.add('open');
        open.push(btn);
        if (open.length === 2) {
          if (open[0].dataset.pair === open[1].dataset.pair) {
            open[0].classList.add('done'); open[1].classList.add('done'); open = [];
            feedback('Par encontrado. Muito bom.');
          } else {
            feedback('Ainda não foi esse par. Respira e tenta de novo.');
            setTimeout(function () { open.forEach(function (b) { b.classList.remove('open'); }); open = []; }, 800);
          }
        }
      };
    });
  }

  function renderMatch(el, a) {
    var right = (a.right || []).slice().sort(function () { return Math.random() - 0.5; });
    el.innerHTML = stageHead(a) + '<div class="practice-match"><div>' + (a.left || []).map(function (x, i) {
      return '<button data-left="' + i + '">' + esc(x) + '</button>';
    }).join('') + '</div><div>' + right.map(function (x) {
      return '<button data-right="' + esc(x) + '">' + esc(x) + '</button>';
    }).join('') + '</div></div><div class="practice-feedback" id="practice-feedback">Escolha um item de cada lado.</div>';
    var left = null;
    Array.prototype.forEach.call(el.querySelectorAll('[data-left]'), function (btn) {
      btn.onclick = function () { left = Number(btn.dataset.left); el.querySelectorAll('[data-left]').forEach(function (b) { b.classList.remove('active'); }); btn.classList.add('active'); };
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-right]'), function (btn) {
      btn.onclick = function () {
        if (left == null) return feedback('Primeiro escolha um item do lado esquerdo.');
        var expected = a.pairs && a.pairs[left] ? a.right[a.pairs[left][1]] : a.right[left];
        if (String(expected) === btn.dataset.right) { btn.classList.add('ok'); feedback('Conectou direitinho.'); }
        else feedback('Quase. Procure a ideia mais parecida.');
      };
    });
  }

  function renderOrder(el, a) {
    var items = (a.items || []).slice();
    var shuffled = items.slice().sort(function () { return Math.random() - 0.5; });
    el.innerHTML = stageHead(a) + '<div class="practice-order">' + shuffled.map(function (x) {
      return '<button data-order="' + esc(x) + '">' + esc(x) + '</button>';
    }).join('') + '</div><div class="practice-answer" id="practice-answer"></div><div class="practice-feedback" id="practice-feedback">Toque na ordem correta.</div>';
    var chosen = [];
    Array.prototype.forEach.call(el.querySelectorAll('[data-order]'), function (btn) {
      btn.onclick = function () {
        if (btn.disabled) return;
        chosen.push(btn.dataset.order);
        btn.disabled = true;
        document.getElementById('practice-answer').textContent = chosen.join(' > ');
        if (chosen.length === items.length) {
          var ok = chosen.join('|') === items.join('|');
          feedback(ok ? (a.explanation || 'Ordem completa. Muito bom.') : 'A sequência ainda pode melhorar. Recarregue este treino e tente de novo com calma.');
        }
      };
    });
  }

  function feedback(text) {
    var el = document.getElementById('practice-feedback');
    if (el) el.textContent = text;
  }

  function rebuild() {
    state.activities = activitiesFromLesson(currentLesson());
    state.active = 0;
    renderPicker();
    renderStage();
  }

  function selectCourse(id, unit, lesson) {
    state.selectedCourse = state.courses.find(function (c) { return c.id === id; }) || state.courses[0];
    state.selectedUnit = Number(unit) || 0;
    state.selectedLesson = Number(lesson) || 0;
    if (!state.selectedCourse) return rebuild();
    var cid = state.selectedCourse.id;
    var done = state.contents[cid]
      ? Promise.resolve(state.contents[cid])
      : api('/api/courses/' + encodeURIComponent(cid) + '/content').then(function (content) { state.contents[cid] = content; });
    done.then(rebuild).catch(function () {
      document.getElementById('practice-stage').innerHTML = '<div class="practice-empty"><h2>Não foi possível carregar este curso.</h2><p>Tente outro curso ou volte mais tarde.</p></div>';
    });
  }

  function init() {
    var logout = document.getElementById('practice-logout');
    if (logout) logout.onclick = function () { localStorage.removeItem('nst.token'); location.href = 'login.html'; };
    api('/api/courses').then(function (courses) {
      state.courses = sortCourses(courses);
      selectCourse(qs.get('course') || (state.courses[0] && state.courses[0].id), qs.get('unit'), qs.get('lesson'));
    }).catch(function () {
      document.getElementById('practice-picker').innerHTML = '<div class="practice-empty"><h2>Não carregou agora</h2><p>Verifique sua conexão e tente novamente.</p></div>';
      document.getElementById('practice-stage').innerHTML = '';
    });
  }

  init();
})();
