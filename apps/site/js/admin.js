/* ============================================================
   NoSeuTempo — admin.js
   ============================================================ */
(function () {
  'use strict';

  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? location.origin
    : (window.NST_API || 'https://api.noseutempo.app');
  var token = localStorage.getItem('nst.token');

  /* ── Redireciona se não logado ou não admin ──────────────── */
  if (!token) { location.href = 'login.html?next=admin.html'; return; }

  /* ── Utilitários ─────────────────────────────────────────── */
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    headers['Authorization'] = 'Bearer ' + token;
    return fetch(API + path, Object.assign({}, opts, { headers: headers }));
  }

  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }

  function fmt(n) { return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—'; }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ── Verificar admin ─────────────────────────────────────── */
  api('/api/me').then(function (r) { return r.json(); }).then(function (me) {
    if (!me.admin) {
      alert('Acesso restrito a administradores.');
      location.href = 'plataforma.html';
      return;
    }
    document.getElementById('sb-nome').textContent  = me.nome;
    document.getElementById('sb-email').textContent = me.email;
    document.getElementById('sb-avatar').textContent = me.nome[0].toUpperCase();
    loadPage(currentPage());
  }).catch(function () { location.href = 'login.html'; });

  /* ── Navegação ───────────────────────────────────────────── */
  function currentPage() {
    return location.hash.replace('#', '') || 'dashboard';
  }

  function loadPage(page) {
    document.querySelectorAll('.sb-link').forEach(function (l) {
      l.classList.toggle('active', l.dataset.page === page);
    });
    document.getElementById('admin-title').textContent = {
      dashboard: 'Dashboard',
      usuarios:  'Usuários',
      vendas:    'Vendas',
      studio:    '✨ Estúdio com IA',
      cursos:    'Cursos',
      matriculas:'Matrículas manuais',
    }[page] || 'Admin';

    var pages = ['dashboard','usuarios','vendas','studio','cursos','matriculas'];
    pages.forEach(function (p) {
      document.getElementById('page-' + p).classList.toggle('hidden', p !== page);
    });

    if (page === 'dashboard')  loadDashboard();
    if (page === 'usuarios')   loadUsuarios();
    if (page === 'vendas')     loadVendas();
    if (page === 'cursos')     loadCursos();
    if (page === 'matriculas') initMatricula();
    if (page === 'studio')     initStudio();
  }

  /* ══════════════════════════════════════════════════════════
     ESTÚDIO COM IA
  ══════════════════════════════════════════════════════════ */
  function studioHealth() {
    var el = document.getElementById('studio-health');
    if (!el) return;
    api('/api/admin/studio/health').then(function (r) { return r.json(); }).then(function (h) {
      el.style.display = 'block';
      var active = (h.order || []);
      var soFree = active.length === 1 && active[0] === 'gemini';
      if (!h.ready) {
        el.style.background = '#FDE8E8'; el.style.border = '1.5px solid #F2B8B8'; el.style.color = '#8B2C2C';
        el.innerHTML = '🔴 <b>Motor de IA sem provedor configurado.</b><br>' + esc(h.hint || '');
      } else if (soFree) {
        el.style.background = '#FFF4E5'; el.style.border = '1.5px solid #F0C98A'; el.style.color = '#7A4E12';
        el.innerHTML = '🟡 <b>Rodando só no Gemini gratuito (limite ~20 cursos-aula/dia).</b> ' +
          'Para conteúdo de alto nível sem travar, adicione uma chave <b>Groq</b> (grátis em console.groq.com) ou <b>OpenRouter</b> no <code>.env</code> da API. ' +
          'O motor passa a usar fallback automático: ' + esc(active.join(' → ')) + '.';
      } else {
        el.style.background = '#E7F6EF'; el.style.border = '1.5px solid #BCE3CE'; el.style.color = '#1E6B47';
        el.innerHTML = '🟢 <b>Motor pronto.</b> Fallback automático: ' + esc(active.join(' → ')) + '.';
      }
    }).catch(function () {});
  }

  function initStudio() {
    studioHealth();
    var form    = document.getElementById('form-studio');
    var progress= document.getElementById('studio-progress');
    var result  = document.getElementById('studio-result');
    var barEl   = document.getElementById('studio-bar');
    var statusEl= document.getElementById('studio-status');
    var pctEl   = document.getElementById('studio-pct');
    var notesEl = document.getElementById('studio-notes');
    var warnEl  = document.getElementById('st-result-warn');
    var btn     = document.getElementById('btn-gerar');
    if (!form || form._initialized) return;
    form._initialized = true;

    function note(msg) {
      if (!notesEl) return;
      notesEl.style.display = 'block';
      var line = document.createElement('div');
      line.textContent = msg;
      notesEl.appendChild(line);
      notesEl.scrollTop = notesEl.scrollHeight;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var topic     = document.getElementById('st-topic').value.trim();
      var category  = document.getElementById('st-category').value;
      var difficulty= document.getElementById('st-difficulty').value;
      var duration  = document.getElementById('st-duration').value;
      var audience  = document.getElementById('st-audience').value.trim();
      if (!topic) { toast('Informe o tema do curso.', 'err'); return; }

      result.classList.add('hidden');
      progress.classList.remove('hidden');
      if (notesEl) { notesEl.innerHTML = ''; notesEl.style.display = 'none'; }
      btn.disabled = true; btn.textContent = '⏳ Gerando…';
      barEl.style.width = '0%'; statusEl.textContent = 'Conectando à IA…';
      var gotError = null;

      fetch(API + '/api/admin/studio/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ topic: topic, category: category, difficulty: difficulty, duration: Number(duration), audience: audience }),
      }).then(function (r) {
        var reader = r.body.getReader();
        var decoder = new TextDecoder();
        var buf = '';
        function read() {
          return reader.read().then(function (chunk) {
            if (chunk.done) return;
            buf += decoder.decode(chunk.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(function (line) {
              if (!line.startsWith('data: ')) return;
              var ev;
              try { ev = JSON.parse(line.slice(6)); } catch (e) { return; }
              if (ev.type === 'start') {
                note('▶ Provedores ativos: ' + ((ev.providers || []).join(' → ') || 'nenhum'));
              } else if (ev.type === 'progress') {
                barEl.style.width = ev.percent + '%';
                statusEl.textContent = ev.message || '';
                pctEl.textContent = ev.percent + '%';
              } else if (ev.type === 'note') {
                note(ev.message || '');
              } else if (ev.type === 'error') {
                gotError = ev;
              } else if (ev.type === 'done') {
                barEl.style.width = '100%'; pctEl.textContent = '100%';
                var rep = ev.report || {};
                setTimeout(function () {
                  progress.classList.add('hidden');
                  document.getElementById('st-result-title').textContent = ev.course.titulo;
                  document.getElementById('st-result-desc').textContent  = ev.course.descricao;
                  if (warnEl) {
                    if (rep.failedCount > 0) {
                      warnEl.style.display = 'block';
                      warnEl.innerHTML = '⚠️ <b>' + rep.failedCount + ' de ' + rep.totalLessons + ' aula(s) não foram geradas</b> (IA sem saldo/cota no momento). ' +
                        'Adicione uma chave Groq grátis no .env e use o botão <b>Regenerar</b> em cada aula pendente. ' +
                        'Provedores usados: ' + Object.keys(rep.providerCounts || {}).join(', ') + '.';
                    } else { warnEl.style.display = 'none'; }
                  }
                  document.getElementById('btn-ver-curso').onclick = function () { verConteudo(ev.course.id); };
                  result.classList.remove('hidden');
                  btn.disabled = false; btn.textContent = '✨ Gerar curso com IA';
                  toast(rep.failedCount > 0 ? 'Curso criado com ' + rep.failedCount + ' aula(s) pendente(s).' : 'Curso "' + ev.course.titulo + '" criado! 🎉', rep.failedCount > 0 ? 'err' : 'ok');
                  loadCursos();
                }, 600);
              }
            });
            return read();
          });
        }
        return read();
      }).then(function () {
        if (gotError) {
          progress.classList.add('hidden');
          btn.disabled = false; btn.textContent = '✨ Gerar curso com IA';
          toast('Erro: ' + (gotError.message || 'falha na IA'), 'err');
          if (gotError.quota && gotError.hint) { studioHealth(); note('💡 ' + gotError.hint); }
        }
      }).catch(function (err) {
        progress.classList.add('hidden');
        btn.disabled = false; btn.textContent = '✨ Gerar curso com IA';
        toast('Erro: ' + (err.message || err), 'err');
      });
    });

    document.getElementById('btn-gerar-outro').addEventListener('click', function () {
      result.classList.add('hidden');
      document.getElementById('st-topic').value = '';
    });
  }

  window.usarSugestao = function (el) {
    document.getElementById('st-topic').value = el.textContent;
    document.getElementById('st-topic').focus();
  };

  document.querySelectorAll('.sb-link[data-page]').forEach(function (l) {
    l.addEventListener('click', function (e) {
      e.preventDefault();
      location.hash = l.dataset.page;
    });
  });
  window.addEventListener('hashchange', function () { loadPage(currentPage()); });

  document.getElementById('btn-logout').addEventListener('click', function () {
    localStorage.removeItem('nst.token');
    location.href = 'login.html';
  });

  /* ══════════════════════════════════════════════════════════
     DASHBOARD
  ══════════════════════════════════════════════════════════ */
  function loadDashboard() {
    api('/api/admin/stats').then(function (r) { return r.json(); }).then(function (s) {
      document.getElementById('st-total').textContent   = s.total_users;
      document.getElementById('st-paid').textContent    = s.total_paid;
      document.getElementById('st-free').textContent    = s.total_free;
      document.getElementById('st-receita').textContent = fmt(s.receita_total);
      document.getElementById('st-cursos').textContent  = s.total_courses;
      document.getElementById('st-vendas').textContent  = s.total_sales;
    });
  }

  /* ══════════════════════════════════════════════════════════
     USUÁRIOS
  ══════════════════════════════════════════════════════════ */
  var userFilter = 'all', userQ = '';

  function loadUsuarios() {
    var url = '/api/admin/users?q=' + encodeURIComponent(userQ);
    if (userFilter !== 'all') url += '&filter=' + userFilter;
    var tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="6"><div class="spinner"></div></td></tr>';

    api(url).then(function (r) { return r.json(); }).then(function (list) {
      document.getElementById('users-count').textContent = list.length + ' usuário(s)';
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="em-ic">👤</div><p>Nenhum usuário encontrado.</p></div></td></tr>';
        return;
      }
      tbody.innerHTML = list.map(function (u) {
        var ehGratuito = (u.gratuito || u.plano === 'gratuito');
        var cur = (!u.paid) ? 'sem' : (ehGratuito ? 'gratuito' : (u.plano || 'anual'));
        var statusBadge = u.pagante
          ? '<span class="badge badge--green">✓ Pagante · ' + esc(u.plano || '—') + '</span>'
          : (ehGratuito
              ? '<span class="badge badge--gray">🎁 Gratuito</span>'
              : '<span class="badge badge--gray">Sem acesso</span>');
        function opt(v, l) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + l + '</option>'; }
        return '<tr>' +
          '<td><strong>' + esc(u.nome) + '</strong><br><small style="color:var(--muted)">' + esc(u.email) + '</small></td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + (u.admin ? '<span class="badge badge--teal">Admin</span>' : '<span class="badge badge--gray">Aluno</span>') + '</td>' +
          '<td>' + fmtDate(u.criado) + '</td>' +
          '<td style="white-space:nowrap">' +
            '<select class="status-sel" onchange="setUserStatus(\'' + u.id + '\',this.value)" style="padding:6px 9px;border:1.5px solid var(--line);border-radius:9px;font-size:.82rem;background:#fff;cursor:pointer;font-family:inherit">' +
              opt('sem', 'Sem acesso') + opt('gratuito', 'Gratuito (cortesia)') + opt('mensal', 'Pago · Mensal') + opt('anual', 'Pago · Anual') + opt('vitalicio', 'Pago · Vitalício') +
            '</select> ' +
            '<button class="btn btn--sm btn--ghost" onclick="toggleAdmin(\'' + u.id + '\',' + u.admin + ')">' + (u.admin ? '👤 Rebaixar' : '⭐ Admin') + '</button> ' +
            '<button class="btn btn--sm btn--danger" onclick="deleteUser(\'' + u.id + '\',\'' + esc(u.nome) + '\')">🗑</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    });
  }

  // Filtros
  document.querySelectorAll('#page-usuarios .ftab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#page-usuarios .ftab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      userFilter = btn.dataset.filter;
      loadUsuarios();
    });
  });
  document.getElementById('users-search').addEventListener('input', function () {
    userQ = this.value;
    loadUsuarios();
  });

  function actResult(r) { return r.json().then(function (d) { return { ok: r.ok, d: d || {} }; }); }

  window.togglePaid = function (id, plano, isPaid) {
    if (!confirm(isPaid ? 'Revogar acesso deste aluno?' : 'Liberar acesso deste aluno?')) return;
    api('/api/admin/users/' + id + '/toggle-paid', { method: 'POST', body: JSON.stringify({ plano: plano }) })
      .then(actResult)
      .then(function (res) {
        if (!res.ok) { toast(res.d.error || 'Erro ao atualizar.', 'err'); return; }
        toast(res.d.paid ? '✅ Acesso liberado!' : '🔒 Acesso revogado.', res.d.paid ? 'ok' : '');
        loadUsuarios();
      })
      .catch(function () { toast('Erro de conexão.', 'err'); });
  };

  window.setUserStatus = function (id, status) {
    api('/api/admin/users/' + id + '/status', { method: 'POST', body: JSON.stringify({ status: status }) })
      .then(actResult)
      .then(function (res) {
        if (!res.ok) { toast(res.d.error || 'Erro ao atualizar.', 'err'); return; }
        toast('Status atualizado.', 'ok'); loadUsuarios();
      })
      .catch(function () { toast('Erro de conexão.', 'err'); });
  };

  window.toggleAdmin = function (id, isAdmin) {
    if (!confirm(isAdmin ? 'Remover role de admin?' : 'Tornar este usuário administrador?')) return;
    api('/api/admin/users/' + id + '/toggle-admin', { method: 'POST' })
      .then(actResult)
      .then(function (res) {
        if (!res.ok) { toast(res.d.error || 'Erro ao atualizar.', 'err'); return; }
        toast('Role atualizada.', 'ok'); loadUsuarios();
      })
      .catch(function () { toast('Erro de conexão.', 'err'); });
  };

  window.deleteUser = function (id, nome) {
    if (!confirm('Deletar "' + nome + '"? Esta ação não pode ser desfeita.')) return;
    api('/api/admin/users/' + id, { method: 'DELETE' })
      .then(actResult)
      .then(function (res) {
        if (!res.ok) { toast(res.d.error || 'Erro ao deletar.', 'err'); return; }
        toast('Usuário deletado.', 'ok'); loadUsuarios();
      })
      .catch(function () { toast('Erro ao deletar.', 'err'); });
  };

  /* ══════════════════════════════════════════════════════════
     VENDAS
  ══════════════════════════════════════════════════════════ */
  function loadVendas() {
    var tbody = document.getElementById('sales-tbody');
    tbody.innerHTML = '<tr><td colspan="6"><div class="spinner"></div></td></tr>';

    api('/api/admin/sales').then(function (r) { return r.json(); }).then(function (list) {
      document.getElementById('sales-count').textContent = list.length + ' venda(s)';
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="em-ic">💳</div><p>Nenhuma venda registrada ainda.</p></div></td></tr>';
        return;
      }
      var total = list.reduce(function (s, v) { return s + (v.valor || 0); }, 0);
      document.getElementById('sales-total').textContent = fmt(total);
      tbody.innerHTML = list.map(function (s) {
        return '<tr>' +
          '<td>' + fmtDate(s.data) + '</td>' +
          '<td><strong>' + esc(s.nome) + '</strong><br><small style="color:var(--muted)">' + esc(s.email) + '</small></td>' +
          '<td><span class="badge badge--teal">' + esc(s.plano || '—') + '</span></td>' +
          '<td><strong>' + fmt(s.valor || 0) + '</strong></td>' +
          '<td>' + (s.origem === 'manual'
            ? '<span class="badge badge--orange">Manual</span>'
            : '<span class="badge badge--green">Mercado Pago</span>') + '</td>' +
          '<td style="font-size:.78rem;color:var(--muted)">' + esc(s.payment_id || '—') + '</td>' +
        '</tr>';
      }).join('');
    });
  }

  /* ══════════════════════════════════════════════════════════
     CURSOS
  ══════════════════════════════════════════════════════════ */
  var currentCourse = null;

  function loadCursos() {
    var list = document.getElementById('courses-list');
    list.innerHTML = '<div class="spinner"></div>';

    api('/api/courses').then(function (r) { return r.json(); }).then(function (courses) {
      document.getElementById('courses-count').textContent = courses.length + ' curso(s)';
      if (!courses.length) {
        list.innerHTML = '<div class="empty"><div class="em-ic">📚</div><p>Nenhum curso criado ainda. Crie o primeiro!</p></div>';
        return;
      }
      list.innerHTML = courses.map(function (c) {
        return '<div class="course-row" style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)">' +
          '<div style="flex:none;width:48px;height:48px;border-radius:12px;background:var(--teal-soft);display:grid;place-items:center;font-size:1.4rem">' +
            (c.capa ? '<img src="' + esc(c.capa) + '" style="width:48px;height:48px;object-fit:cover;border-radius:12px">' : '📚') +
          '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700">' + esc(c.titulo) + '</div>' +
            '<div style="font-size:.82rem;color:var(--muted)">' + c.modulos + ' módulo(s) · Criado em ' + fmtDate(c.criado) + '</div>' +
          '</div>' +
          '<button class="btn btn--sm btn--ghost" onclick="verConteudo(\'' + c.id + '\')">👁 Visualizar</button>' +
          '<button class="btn btn--sm btn--teal" onclick="editCourse(\'' + c.id + '\')">✏️ Editar</button>' +
          '<button class="btn btn--sm btn--danger" onclick="deleteCourse(\'' + c.id + '\',\'' + esc(c.titulo) + '\')">🗑</button>' +
        '</div>';
      }).join('');
    });
  }

  /* ───────── Visualizador de conteúdo (árvore completa) ───────── */
  var BLOCK_LABELS = {
    concept:'📘 Conceito', example:'🧩 Exemplo', audio_vocab:'🔊 Ouça e repita',
    quick_check:'⚡ Check rápido', multiple_choice:'🔠 Múltipla escolha', true_false:'✅ Verdadeiro/Falso',
    fill_blank:'✍️ Complete a lacuna', drag_order:'🔀 Ordene', match_pairs:'🔗 Conecte pares',
    scenario_choice:'🎭 Cenário', reflection:'💭 Reflexão', voice_challenge:'🎙️ Desafio de voz', mission:'🎯 Missão'
  };

  function renderBlock(b) {
    var d = b.data || b; var t = b.type || d.type || '?';
    var label = BLOCK_LABELS[t] || ('• ' + t);
    var body = '';
    function p(x){ return x ? '<div style="font-size:.84rem;color:var(--navy);margin-top:3px">' + esc(String(x)) + '</div>' : ''; }
    if (t === 'concept' || t === 'example') { body = p(d.title) + p(d.body || d.scenario) + p(d.takeaway); }
    else if (t === 'audio_vocab') { body = p(d.instruction) + (Array.isArray(d.words) ? '<div style="font-size:.82rem;color:var(--muted);margin-top:3px">' + d.words.map(function(w){return esc((w.emoji||'')+' '+(w.word||'')+(w.translation?(' — '+w.translation):''));}).join(' · ') + '</div>' : ''); }
    else if (t === 'quick_check' || t === 'multiple_choice') { body = p(d.question) + (Array.isArray(d.options) ? '<div style="font-size:.8rem;color:var(--muted);margin-top:3px">' + d.options.map(function(o,i){return (i===d.correctIndex?'✔ ':'') + esc(o);}).join(' / ') + '</div>' : ''); }
    else if (t === 'true_false') { body = p(d.statement) + p('Resposta: ' + (d.answer ? 'Verdadeiro' : 'Falso')); }
    else if (t === 'fill_blank') { body = p(d.template) + p('Resposta: ' + (d.correctAnswers||[]).join(', ')); }
    else if (t === 'drag_order') { body = p(d.instruction) + p((d.items||[]).join(' → ')); }
    else if (t === 'match_pairs') { body = p(d.instruction) + p((d.leftItems||[]).join(', ') + '  ↔  ' + (d.rightItems||[]).join(', ')); }
    else if (t === 'scenario_choice') { body = p(d.scenario) + p(d.question) + (Array.isArray(d.choices)?'<div style="font-size:.8rem;color:var(--muted);margin-top:3px">'+d.choices.map(function(c){return (c.isBest?'✔ ':'')+esc(c.text);}).join(' / ')+'</div>':''); }
    else if (t === 'reflection') { body = p(d.question) + p(d.prompt); }
    else if (t === 'voice_challenge') { body = p(d.instruction) + p(d.tip); }
    else if (t === 'mission') { body = p(d.title) + p(d.description); }
    else { body = p(d.title || d.body || JSON.stringify(d).slice(0,120)); }
    return '<div style="border-left:3px solid var(--teal);background:#fff;border-radius:8px;padding:8px 12px;margin:6px 0">' +
      '<div style="font-size:.78rem;font-weight:700;color:var(--teal-deep)">' + label + '</div>' + body + '</div>';
  }

  function renderLesson(courseId, ui, li, unit, l) {
    var failed = l.failed ? '<span style="font-size:.7rem;font-weight:700;color:#B23B3B;background:#FDE8E8;padding:2px 8px;border-radius:99px;margin-left:6px">pendente</span>' : '';
    var blocks = (l.blocks || []);
    var types = blocks.map(function(b){ return (b.type||(b.data&&b.data.type)); });
    var chips = types.map(function(tp){ return '<span style="font-size:.68rem;background:var(--teal-soft);color:var(--teal-deep);padding:1px 7px;border-radius:99px;margin:1px">' + esc((BLOCK_LABELS[tp]||tp||'?').replace(/^\S+\s/, '')) + '</span>'; }).join(' ');
    return '<details style="border:1px solid var(--line);border-radius:10px;margin:8px 0;background:var(--bg)">' +
      '<summary style="cursor:pointer;padding:11px 14px;list-style:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span style="font-weight:700;font-size:.9rem">' + esc(l.title) + failed + '</span>' +
        '<span style="font-size:.76rem;color:var(--muted)">' + blocks.length + ' bloco(s) · ' + (l.estimatedMinutes||3) + ' min</span>' +
        '<button class="btn btn--sm btn--teal" style="margin-left:auto" onclick="event.preventDefault();previewLesson(\'' + courseId + '\',' + ui + ',' + li + ')">👁 Ver como aluno</button>' +
        '<button class="btn btn--sm btn--ghost" onclick="event.preventDefault();regenLesson(\'' + courseId + '\',\'' + l.id + '\',this)">🔄 Regenerar</button>' +
      '</summary>' +
      '<div style="padding:4px 14px 12px"><div style="margin-bottom:8px">' + chips + '</div>' + blocks.map(renderBlock).join('') + '</div>' +
    '</details>';
  }

  window.verConteudo = function (id) {
    var modal = document.getElementById('modal-content');
    var body  = document.getElementById('mc-body');
    modal.classList.remove('hidden');
    body.innerHTML = '<div class="spinner"></div>';
    api('/api/courses/' + id + '/content').then(function (r) {
      if (!r.ok) throw new Error('Este curso não tem conteúdo gerado pela IA (criado manualmente ou ainda vazio).');
      return r.json();
    }).then(function (c) {
      var units = c.units || [];
      var totalLessons = units.reduce(function(s,u){return s+(u.lessons||[]).length;},0);
      var totalBlocks = units.reduce(function(s,u){return s+(u.lessons||[]).reduce(function(a,l){return a+(l.blocks||[]).length;},0);},0);
      var pendentes = units.reduce(function(s,u){return s+(u.lessons||[]).filter(function(l){return l.failed;}).length;},0);
      document.getElementById('mc-title').textContent = c.titulo || 'Conteúdo do curso';
      document.getElementById('mc-sub').textContent = units.length + ' módulos · ' + totalLessons + ' aulas · ' + totalBlocks + ' blocos · ' + (c.totalEstimatedMinutes||0) + ' min';
      var warn = pendentes > 0 ? '<div style="background:#FFF4E5;border:1.5px solid #F0C98A;border-radius:12px;padding:12px 14px;font-size:.85rem;color:#7A4E12;margin-bottom:14px">⚠️ <b>' + pendentes + ' aula(s) pendente(s)</b> (não geradas por falta de saldo de IA). Use 🔄 Regenerar em cada uma após configurar uma chave com saldo.</div>' : '';
      var toolbar = '<div style="display:flex;justify-content:flex-end;margin-bottom:14px">' +
        '<button class="btn btn--sm btn--teal" onclick="previewLesson(\'' + c.id + '\',0,0)">👁 Pré-visualizar como aluno (do início)</button>' +
        '</div>';
      body.innerHTML = toolbar + warn + units.map(function (u, ui) {
        return '<div style="margin-bottom:18px">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">' +
            '<span style="font-size:1.3rem">' + esc(u.icon||'📦') + '</span>' +
            '<h3 style="margin:0;font-size:1.05rem">Módulo ' + (ui+1) + ': ' + esc(u.title) + '</h3>' +
          '</div>' +
          (u.motivacao ? '<p style="font-size:.82rem;color:var(--muted);margin:0 0 6px 36px">' + esc(u.motivacao) + '</p>' : '') +
          '<div style="margin-left:8px">' + (u.lessons||[]).map(function(l, li){ return renderLesson(c.id, ui, li, u, l); }).join('') + '</div>' +
        '</div>';
      }).join('');
    }).catch(function (e) {
      body.innerHTML = '<div class="empty" style="padding:40px"><div class="em-ic">📭</div><p>' + esc(e.message || 'Erro ao carregar conteúdo.') + '</p></div>';
    });
  };

  window.previewLesson = function (courseId, ui, li) {
    var url = 'aula.html?course=' + encodeURIComponent(courseId) + '&unit=' + (ui || 0) + '&lesson=' + (li || 0) + '&preview=1&v=2';
    window.open(url, '_blank', 'noopener');
  };

  window.regenLesson = function (courseId, lessonId, btnEl) {
    var orig = btnEl.textContent; btnEl.disabled = true; btnEl.textContent = '⏳ Gerando…';
    api('/api/admin/courses/' + courseId + '/lessons/' + lessonId + '/regenerate', { method: 'POST', body: '{}' })
      .then(function (r) { return r.json().then(function(d){ return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { toast('Erro: ' + (res.d.error || 'falha'), 'err'); btnEl.disabled = false; btnEl.textContent = orig; return; }
        toast('Aula regenerada (via ' + (res.d.provider || 'IA') + ')! 🎉', 'ok');
        verConteudo(courseId); // recarrega a árvore
      })
      .catch(function () { toast('Erro ao regenerar.', 'err'); btnEl.disabled = false; btnEl.textContent = orig; });
  };

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'mc-close') document.getElementById('modal-content').classList.add('hidden');
  });

  // Criar curso
  document.getElementById('btn-new-course').addEventListener('click', function () {
    currentCourse = null;
    document.getElementById('course-form-title').textContent = 'Novo curso';
    document.getElementById('cf-titulo').value = '';
    document.getElementById('cf-descricao').value = '';
    document.getElementById('cf-capa').value = '';
    document.getElementById('modal-course').classList.remove('hidden');
  });

  document.getElementById('btn-save-course').addEventListener('click', function () {
    var titulo    = document.getElementById('cf-titulo').value.trim();
    var descricao = document.getElementById('cf-descricao').value.trim();
    var capa      = document.getElementById('cf-capa').value.trim();
    if (!titulo) { toast('Título obrigatório.', 'err'); return; }

    var url    = currentCourse ? '/api/admin/courses/' + currentCourse : '/api/admin/courses';
    var method = currentCourse ? 'PUT' : 'POST';

    api(url, { method: method, body: JSON.stringify({ titulo: titulo, descricao: descricao, capa: capa }) })
      .then(function (r) { return r.json(); })
      .then(function (c) {
        toast(currentCourse ? '✅ Curso atualizado!' : '✅ Curso criado!', 'ok');
        document.getElementById('modal-course').classList.add('hidden');
        loadCursos();
        if (!currentCourse) editCourse(c.id); // abre editor de módulos
      })
      .catch(function () { toast('Erro ao salvar.', 'err'); });
  });

  document.getElementById('btn-cancel-course').addEventListener('click', function () {
    document.getElementById('modal-course').classList.add('hidden');
  });

  window.editCourse = function (id) {
    currentCourse = id;
    api('/api/courses/' + id).then(function (r) { return r.json(); }).then(function (c) {
      document.getElementById('course-form-title').textContent = 'Editar: ' + c.titulo;
      document.getElementById('cf-titulo').value    = c.titulo;
      document.getElementById('cf-descricao').value = c.descricao || '';
      document.getElementById('cf-capa').value      = c.capa || '';
      document.getElementById('modal-course').classList.remove('hidden');
      renderModulos(c);
    });
  };

  function renderModulos(c) {
    var el = document.getElementById('modulos-container');
    el.classList.remove('hidden');
    document.getElementById('modulos-lista').innerHTML = (c.modulos || []).map(function (m, mi) {
      return '<div class="modulo-card">' +
        '<div class="modulo-head" onclick="toggleModulo(\'' + m.id + '\')">' +
          '<span>📦</span><span style="flex:1">' + esc(m.titulo) + '</span>' +
          '<span style="font-size:.78rem;color:var(--muted)">' + (m.aulas?.length || 0) + ' aula(s)</span>' +
          '<button class="btn btn--icon btn--sm" onclick="event.stopPropagation();addAula(\'' + c.id + '\',\'' + m.id + '\')">+ Aula</button>' +
        '</div>' +
        '<div class="modulo-body" id="modulo-' + m.id + '">' +
          (m.aulas && m.aulas.length ? m.aulas.map(function (a) {
            var ico = a.tipo === 'video' ? '🎬' : a.tipo === 'pdf' ? '📄' : '📝';
            return '<div class="aula-row">' +
              '<span class="ar-ic">' + ico + '</span>' +
              '<div class="ar-info">' +
                '<div class="ar-titulo">' + esc(a.titulo) + '</div>' +
                '<div class="ar-meta">' +
                  '<span class="tipo-badge tipo-' + a.tipo + '">' + a.tipo + '</span>' +
                  (a.duracao ? ' · ' + esc(a.duracao) : '') +
                  (a.url ? ' · <a href="' + esc(a.url) + '" target="_blank" style="color:var(--teal)">link</a>' : '') +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('') : '<p style="color:var(--muted);font-size:.88rem">Nenhuma aula ainda. Clique em "+ Aula" para adicionar.</p>') +
        '</div>' +
      '</div>';
    }).join('') +
    '<button class="btn btn--ghost" style="width:100%;margin-top:10px" onclick="addModulo(\'' + c.id + '\')">+ Adicionar módulo</button>';
  }

  window.toggleModulo = function (id) {
    var el = document.getElementById('modulo-' + id);
    if (el) el.classList.toggle('open');
  };

  window.addModulo = function (courseId) {
    var titulo = prompt('Título do módulo:');
    if (!titulo) return;
    api('/api/admin/courses/' + courseId + '/modulos', {
      method: 'POST', body: JSON.stringify({ titulo: titulo })
    }).then(function () {
      toast('Módulo adicionado!', 'ok');
      api('/api/courses/' + courseId).then(function (r) { return r.json(); }).then(renderModulos);
    });
  };

  window.addAula = function (courseId, moduloId) {
    var titulo   = prompt('Título da aula:');
    if (!titulo) return;
    var tipo     = prompt('Tipo (video / pdf / texto):', 'video') || 'video';
    var url      = prompt('URL do vídeo/PDF (opcional):') || '';
    var duracao  = prompt('Duração (ex: 5:30)  — opcional:') || '';
    api('/api/admin/courses/' + courseId + '/modulos/' + moduloId + '/aulas', {
      method: 'POST', body: JSON.stringify({ titulo: titulo, tipo: tipo, url: url, duracao: duracao })
    }).then(function () {
      toast('Aula adicionada!', 'ok');
      api('/api/courses/' + courseId).then(function (r) { return r.json(); }).then(renderModulos);
    });
  };

  window.deleteCourse = function (id, titulo) {
    if (!confirm('Deletar o curso "' + titulo + '"? Os módulos e aulas também serão removidos.')) return;
    api('/api/admin/courses/' + id, { method: 'DELETE' })
      .then(function () { toast('Curso deletado.', 'ok'); loadCursos(); })
      .catch(function () { toast('Erro ao deletar.', 'err'); });
  };

  /* ══════════════════════════════════════════════════════════
     MATRÍCULAS MANUAIS
  ══════════════════════════════════════════════════════════ */
  function initMatricula() {
    var matPlanoSel = document.getElementById('mat-plano');
    if (matPlanoSel) matPlanoSel.addEventListener('change', function () {
      var w = document.getElementById('mat-valor-wrap');
      if (w) w.style.display = (matPlanoSel.value === 'custom') ? '' : 'none';
    });

    document.getElementById('form-matricula').onsubmit = function (e) {
      e.preventDefault();
      var email = document.getElementById('mat-email').value.trim();
      var plano = document.getElementById('mat-plano').value;
      var gratuito = (plano === 'gratuito');
      var valor = (document.getElementById('mat-valor') || {}).value || '';
      if (plano === 'custom' && (valor === '' || Number(valor) < 0)) { toast('Informe o valor.', 'err'); return; }
      if (!email) { toast('Informe o e-mail.', 'err'); return; }
      api('/api/admin/enroll', { method: 'POST', body: JSON.stringify({ email: email, plano: plano, gratuito: gratuito, valor: valor }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            toast('✅ Matrícula de ' + d.nome + (d.gratuito ? ' liberada como GRATUITO (não conta como venda)!' : ' liberada (' + d.plano + ')!'), 'ok');
            document.getElementById('mat-email').value = '';
            document.getElementById('mat-resultado').innerHTML =
              '<div class="badge badge--green" style="padding:10px 16px;font-size:.92rem">✅ ' + esc(d.nome) + ' — ' + esc(d.email) + ' — ' + esc(d.plano) + '</div>';
          } else {
            toast(d.error || 'Erro.', 'err');
          }
        })
        .catch(function () { toast('Erro de conexão.', 'err'); });
    };
  }

  /* ── Sidebar mobile toggle ──────────────────────────────── */
  var btnToggle = document.getElementById('btn-sb-toggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', function () {
      document.querySelector('.sidebar').classList.toggle('open');
    });
  }
})();
