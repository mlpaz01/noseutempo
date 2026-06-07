/* ============================================================
   NoSeuTempo — Voz da Geni (SEMPRE feminina, español de España)
   Robusto: espera as vozes carregarem, prioriza vozes femininas
   conhecidas e o "Google español"; se só houver voz masculina,
   sobe o tom para soar feminino.
   ============================================================ */
(function () {
  var V = (window.NSTVoice = window.NSTVoice || {});
  var chosen = null;
  var queue = [];

  /* nomes femininos comuns (Win/Mac/Chrome) + Google español (feminina) */
  var FEMALE = /(helena|elvira|laura|m[oó]nica|marisol|sabina|paulina|dalia|luc[ií]a|paloma|conchita|esperanza|penelope|female|mujer|femenin|google\s+espa)/i;
  var MALE   = /(pablo|jorge|diego|carlos|juan|miguel|enrique|ra[uú]l|[aá]lvaro|male|hombre|masculin)/i;

  function all() { try { return (window.speechSynthesis.getVoices() || []); } catch (e) { return []; } }

  /* voz OFICIAL padrão da Geni (para todos os alunos, salvo escolha manual) */
  var DEFAULT_VOICE = 'cloud:openai:sage';
  V.DEFAULT = DEFAULT_VOICE;

  function saved() { try { return localStorage.getItem('nst.voiceName') || ''; } catch (e) { return ''; } }
  /* voz efetiva: SEMPRE a voz oficial (Sage). Sem seletor — fixa para todos.
     (saved()/choose() permanecem para uso futuro, mas não afetam a fala.) */
  function effective() { return DEFAULT_VOICE; }
  V.effectiveName = effective;

  function pick() {
    var vs = all(); if (!vs.length) return null;
    // 0) voz escolhida manualmente pelo usuário (tem prioridade total)
    var pref = saved();
    if (pref) { var s = vs.find(function (v) { return v.name === pref; }); if (s) return s; }
    var es = vs.filter(function (v) { return /^es/i.test(v.lang); });
    // 1) feminina explícita em espanhol
    var f = es.find(function (v) { return FEMALE.test(v.name) && !MALE.test(v.name); });
    if (f) return f;
    // 2) Google español (feminina) em qualquer lista
    var g = vs.find(function (v) { return /google\s+espa/i.test(v.name); });
    if (g) return g;
    // 3) qualquer espanhol NÃO masculino
    var n = es.find(function (v) { return !MALE.test(v.name); });
    if (n) return n;
    // 4) última opção: primeira voz espanhol disponível
    return es[0] || null;
  }

  function refresh() {
    var c = pick();
    if (c) { chosen = c; flush(); }
  }

  function flush() { while (queue.length) { _say(queue.shift()); } }

  function _say(text) {
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 0.86;
    if (chosen) {
      u.voice = chosen;
      u.lang  = chosen.lang || 'es-ES';
      /* se, no pior caso, a única voz for masculina, sobe MUITO o tom */
      u.pitch = MALE.test(chosen.name) ? 1.7 : 1.25;
    } else {
      u.lang = 'es-ES';
      u.pitch = 1.4;
    }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    window.speechSynthesis.speak(u);
  }

  V.get = function () { if (!chosen) chosen = pick(); return chosen; };
  /* utilitário de depuração: NSTVoice.list() lista as vozes do navegador */
  V.list = function () { return all().map(function (v) { return v.name + ' [' + v.lang + ']' + (v.default ? ' (default)' : ''); }); };

  /* todas as vozes (objetos), espanhol primeiro */
  V.voices = function () {
    var vs = all().slice();
    return vs.sort(function (a, b) {
      var ae = /^es/i.test(a.lang) ? 0 : 1, be = /^es/i.test(b.lang) ? 0 : 1;
      if (ae !== be) return ae - be;
      return a.name.localeCompare(b.name);
    });
  };
  V.isFemale = function (v) { return v && FEMALE.test(v.name) && !MALE.test(v.name); };
  V.isMale   = function (v) { return v && MALE.test(v.name); };
  V.savedName = saved;
  /* define manualmente a voz pelo nome; '' volta ao automático */
  V.choose = function (name) {
    try { if (name) localStorage.setItem('nst.voiceName', name); else localStorage.removeItem('nst.voiceName'); } catch (e) {}
    chosen = pick();
    return chosen;
  };

  /* ── Vozes na NUVEM (servidor) — femininas e naturais ── */
  V.cloudOptions = function () {
    return [
      { value: 'cloud:openai:nova',    label: '☁️ OpenAI · Nova 👩 (suave)' },
      { value: 'cloud:openai:shimmer', label: '☁️ OpenAI · Shimmer 👩 (clara)' },
      { value: 'cloud:openai:coral',   label: '☁️ OpenAI · Coral 👩 (calorosa)' },
      { value: 'cloud:openai:sage',    label: '☁️ OpenAI · Sage 👩 (serena)' },
    ];
  };
  function apiBase() { return (window.NST_API || 'https://api.noseutempo.app'); }
  function token() { try { return localStorage.getItem('nst.token') || ''; } catch (e) { return ''; } }
  var curAudio = null;
  function speakCloud(text, provider, voice) {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; }
    fetch(apiBase() + '/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify({ text: text, provider: provider, voice: voice }),
    })
      .then(function (r) { if (!r.ok) throw new Error('tts-' + r.status); return r.blob(); })
      .then(function (b) { var url = URL.createObjectURL(b); curAudio = new Audio(url); curAudio.play(); })
      .catch(function () { _say(text); }); /* reserva: voz do navegador */
  }

  V.speak = function (text) {
    if (!text) return;
    var pref = effective();
    if (pref.indexOf('cloud:') === 0) {
      var p = pref.split(':');
      return speakCloud(text, p[1], p.slice(2).join(':'));
    }
    if (!window.speechSynthesis) return;
    if (!chosen) chosen = pick();
    if (!chosen && !all().length) { queue.push(text); return; } /* espera vozes carregarem */
    _say(text);
  };

  if (window.speechSynthesis) {
    refresh();
    window.speechSynthesis.onvoiceschanged = refresh;
    setTimeout(refresh, 300);
    setTimeout(refresh, 1200);
  }
})();
