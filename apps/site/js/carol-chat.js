/* ============================================================
   NoSeuTempo — Widget "Precisa de ajuda?" (flutuante)
   Fluxo: recepção do NoSeuTempo → triagem
   - Dúvidas (aula/plataforma/sugestão) = assistente de IA
   - "Conversar com a Carol" = 2ª tela → após escolher opção,
     aparece o botão "Falar com a Carol no WhatsApp"
   ============================================================ */
(function () {
  'use strict';

  var API = window.NST_API || 'https://api.noseutempo.app';

  /* WhatsApp da Carol (formato internacional, sem + nem espaços) */
  var WA_NUMBER = '5521983385253';
  function waLink(text) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text); }

  document.addEventListener('DOMContentLoaded', function () {
    var token = localStorage.getItem('nst.token');
    if (!token) return; // só para alunos logados

    /* Ícone de assistente (carinha com fone, contorno em degradê) */
    function assistIcon(px, id) {
      return '<svg viewBox="0 0 48 48" width="' + px + '" height="' + px + '" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="' + id + '" x1="6" y1="8" x2="42" y2="44" gradientUnits="userSpaceOnUse">' +
        '<stop stop-color="#36B0F4"/><stop offset="1" stop-color="#9B5DE5"/></linearGradient></defs>' +
        '<g fill="none" stroke="url(#' + id + ')" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 25v-3a12 12 0 0 1 24 0v3"/>' +
          '<rect x="7.5" y="22.5" width="6.5" height="10" rx="3.25"/>' +
          '<rect x="34" y="22.5" width="6.5" height="10" rx="3.25"/>' +
          '<rect x="15" y="15" width="18" height="18" rx="6"/>' +
          '<path d="M20.5 28a4.5 4.5 0 0 0 7 0"/>' +
          '<path d="M37 32.5v2a3.5 3.5 0 0 1-3.5 3.5H27"/>' +
          '<circle cx="25" cy="38" r="1.7"/>' +
        '</g>' +
        '<circle cx="21" cy="23.5" r="1.25" fill="url(#' + id + ')"/>' +
        '<circle cx="27" cy="23.5" r="1.25" fill="url(#' + id + ')"/>' +
      '</svg>';
    }

    /* ── Dados do aluno preenchidos automaticamente ── */
    var studentName = '';
    try { studentName = localStorage.getItem('nst.nome') || ''; } catch (e) {}
    fetch(API + '/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (u) { if (u && u.nome) { studentName = u.nome; try { localStorage.setItem('nst.nome', u.nome); } catch (e) {} } })
      .catch(function () {});

    function currentPageName() {
      var p = (location.pathname.split('/').pop() || '').toLowerCase();
      var map = {
        'plataforma.html': 'Início', 'cursos.html': 'Cursos', 'treino-extra.html': 'Aprender Brincando',
        'geni.html': 'Geni IA', 'aula.html': 'Aula', 'pagamento.html': 'Pagamento',
        'sucesso.html': 'Sucesso', 'index.html': 'Página inicial', '': 'Início'
      };
      return map[p] || document.title || 'Plataforma';
    }
    function buildWa(motivo) {
      var nome = studentName || '';
      var curso = '', modulo = '';
      try { curso = localStorage.getItem('nst.ctx.curso') || ''; modulo = localStorage.getItem('nst.ctx.modulo') || ''; } catch (e) {}
      if (!curso) curso = 'Espanhol';
      var ctx = '';
      if (nome) ctx += 'Aluno: ' + nome + '\n';
      ctx += 'Curso: ' + curso + '\n';
      if (modulo) ctx += 'Módulo: ' + modulo + '\n';
      ctx += 'Página: ' + currentPageName();
      return 'Olá, Carol!\n\nVim pela plataforma NoSeuTempo.\n\n' + ctx + '\n\n' + motivo;
    }

    var root = document.createElement('div');
    root.id = 'carol-widget-root';
    root.innerHTML =
      '<div class="ccw-box hidden" id="ccw-box" role="dialog" aria-label="Precisa de ajuda?">' +
        '<div class="ccw-header">' +
          '<button class="ccw-back hidden" id="ccw-back" aria-label="Voltar">‹</button>' +
          '<span class="ccw-hav" id="ccw-hav">🌸</span>' +
          '<div class="ccw-hinfo">' +
            '<strong class="ccw-htitle" id="ccw-htitle">Precisa de ajuda?</strong>' +
            '<span class="ccw-status"><span class="ccw-status-dot"></span>online</span>' +
          '</div>' +
          '<button class="ccw-icon-btn" id="ccw-close" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="ccw-body" id="ccw-body"></div>' +
        '<div class="ccw-foot hidden" id="ccw-foot">' +
          '<textarea class="ccw-input" id="ccw-input" placeholder="Escreva sua mensagem…" rows="1" aria-label="Sua mensagem"></textarea>' +
          '<button class="ccw-send" id="ccw-send" aria-label="Enviar">➤</button>' +
        '</div>' +
      '</div>' +

      /* ── Botão flutuante ── */
      '<div class="carol-fab" id="carol-fab">' +
        '<span class="carol-fab-bubble" id="carol-fab-bubble">' +
          'Precisa de ajuda?' +
          '<button class="carol-fab-x" id="carol-fab-x" aria-label="Fechar aviso">✕</button>' +
        '</span>' +
        '<button class="carol-fab-avatar" id="carol-fab-face" aria-label="Precisa de ajuda?">' +
          '<img class="carol-fab-pic" src="assets/assistente.png" alt="Assistente" />' +
          '<span class="carol-fab-dot"></span>' +
        '</button>' +
      '</div>';

    document.body.appendChild(root);

    /* estilos do fluxo (inline — não depende de CSS externo) */
    var st = document.createElement('style');
    st.textContent =
      '#carol-widget-root .hidden{display:none!important;}' +
      '#carol-fab-face{background:#fff!important;border-color:#9B5DE5!important;display:grid!important;place-items:center!important;overflow:visible!important;}' +
      '.carol-fab-pic{border-radius:50%;}' +
      '#carol-widget-root .carol-fab-dot{bottom:3px;right:3px;width:12px;height:12px;border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25);}' +
      '.ccw-hav{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;font-size:19px;flex:none;overflow:hidden;}' +
      '.ccw-hav img{width:100%;height:100%;object-fit:cover;object-position:center top;}' +
      '.ccw-hav-pic,.carol-fab-pic{width:100%;height:100%;object-fit:contain!important;object-position:center!important;}' +
      '.ccw-back{background:rgba(255,255,255,.18);border:0;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:1.15rem;line-height:1;display:grid;place-items:center;flex:none;}' +
      '.ccw-back:hover{background:rgba(255,255,255,.34);}' +
      '.ccw-intro{font-size:.85rem;line-height:1.45;color:#1A2B4A;padding:12px 14px;}' +
      '#carol-widget-root .ccw-box{display:flex;flex-direction:column;height:560px;max-height:calc(100vh - 110px);}' +
      '#carol-widget-root .ccw-body{flex:1 1 auto;min-height:0;max-height:none;padding:12px 12px;}' +
      '.ccw-opt{display:flex;align-items:center;gap:11px;width:100%;text-align:left;background:#fff;border:1.5px solid #E4ECF4;border-radius:14px;padding:9px 12px;margin-top:8px;cursor:pointer;transition:border-color .15s,transform .15s,box-shadow .15s;font-family:inherit;}' +
      '.ccw-opt:hover{border-color:#1FA6A8;transform:translateY(-1px);box-shadow:0 6px 16px rgba(31,154,171,.12);}' +
      '.ccw-opt .em{font-size:20px;line-height:1.15;flex:none;}' +
      '.ccw-opt-img{width:26px;height:26px;border-radius:50%;object-fit:cover;object-position:center top;display:block;}' +
      '.ccw-opt .tt{font-weight:700;font-size:.9rem;color:#1A2B4A;display:block;}' +
      '.ccw-opt .ds{font-size:.76rem;color:#6B7A8D;line-height:1.35;display:block;margin-top:2px;}' +
      '.ccw-wa{display:flex;align-items:center;justify-content:center;gap:9px;margin:14px 0 4px;background:#25D366;color:#fff;font-weight:700;font-size:.86rem;text-decoration:none;padding:12px 14px;border-radius:13px;box-shadow:0 6px 16px rgba(37,211,102,.30);}' +
      '.ccw-wa:hover{filter:brightness(1.04);}' +
      '.ccw-wa svg{flex:none;}' +
      '.ccw-msg{display:flex;margin-top:10px;}' +
      '.ccw-msg.me{justify-content:flex-end;}' +
      '.ccw-msg .b{max-width:84%;padding:10px 13px;border-radius:15px;font-size:.86rem;line-height:1.5;}' +
      '.ccw-msg.carol .b{background:#E3F4F1;border:1.5px solid #CDEAE4;color:#1A2B4A;border-bottom-left-radius:5px;}' +
      '.ccw-msg.me .b{background:#1FA6A8;color:#fff;border-bottom-right-radius:5px;}' +
      '.ccw-typing .b{display:inline-flex;gap:4px;}' +
      '.ccw-typing .b i{width:6px;height:6px;border-radius:50%;background:#1FA6A8;display:inline-block;animation:ccwBlink 1.1s infinite;}' +
      '.ccw-typing .b i:nth-child(2){animation-delay:.18s}.ccw-typing .b i:nth-child(3){animation-delay:.36s}' +
      '@keyframes ccwBlink{0%,80%,100%{opacity:.25}40%{opacity:1}}';
    document.head.appendChild(st);

    var face   = document.getElementById('carol-fab-face');
    var bubble = document.getElementById('carol-fab-bubble');
    var fabX   = document.getElementById('carol-fab-x');
    var box     = document.getElementById('ccw-box');
    var close   = document.getElementById('ccw-close');
    var back    = document.getElementById('ccw-back');
    var title   = document.getElementById('ccw-htitle');
    var hav     = document.getElementById('ccw-hav');
    var bodyEl  = document.getElementById('ccw-body');
    var foot    = document.getElementById('ccw-foot');
    var input   = document.getElementById('ccw-input');
    var send    = document.getElementById('ccw-send');

    var CAROL_IMG = '<img src="assets/carol-foto.png" alt="Carol" onerror="this.onerror=null;this.src=\'assets/carol-avatar.png\'" />';
    var backTarget = null;
    var hist = [];

    function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function scrollDown(){ bodyEl.scrollTop = bodyEl.scrollHeight; }
    function setHeader(t, avatar, showBack){ title.textContent = t; hav.innerHTML = avatar; back.classList.toggle('hidden', !showBack); }
    function showFooter(s){ foot.classList.toggle('hidden', !s); }

    function opt(key, em, tt, ds){
      return '<button class="ccw-opt" data-opt="' + key + '"><span class="em">' + em + '</span>' +
             '<span class="tx"><span class="tt">' + tt + '</span>' +
             (ds ? '<span class="ds">' + ds + '</span>' : '') + '</span></button>';
    }
    function bindOpts(handler){
      var list = bodyEl.querySelectorAll('.ccw-opt');
      for (var i = 0; i < list.length; i++) {
        (function (b) { b.onclick = function () { handler(b.getAttribute('data-opt')); }; })(list[i]);
      }
    }

    /* ── TELA 1: recepção / menu ── */
    function renderMenu(){
      backTarget = null;
      setHeader('Como posso te ajudar hoje?', '<img class="ccw-hav-pic" src="assets/assistente.png" alt="Assistente" />', false);
      showFooter(false);
      bodyEl.innerHTML =
        '<div class="ccw-bubble ccw-intro">' +
          'Oi! Que bom ter você aqui. 💙<br><br>' +
          'O <b>NoSeuTempo</b> é o seu espaço para aprender de um jeito leve e no seu ritmo.<br><br>' +
          'Estou por aqui para te apoiar no que for preciso.' +
        '</div>' +
        opt('aula', '<svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cbgrad" x1="6" y1="4" x2="34" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#B49AF6"/><stop offset="1" stop-color="#8C6CE6"/></linearGradient></defs><path d="M11 5h18a6 6 0 0 1 6 6v11a6 6 0 0 1-6 6H17l-6.5 6 1-6H11a6 6 0 0 1-6-6V11a6 6 0 0 1 6-6z" fill="url(#cbgrad)"/><circle cx="14.5" cy="15.5" r="2.3" fill="#fff"/><circle cx="20" cy="15.5" r="2.3" fill="#fff"/><circle cx="25.5" cy="15.5" r="2.3" fill="#fff"/></svg>', 'Dúvida sobre a aula', 'Exercícios, conteúdo, vocabulário e atividades.') +
        opt('plataforma', '💻', 'Dúvida sobre a plataforma', 'Acesso, navegação e funcionalidades.') +
        opt('sugestao', '💡', 'Sugestão ou melhoria', 'Ideias para deixar o NoSeuTempo ainda melhor.') +
        opt('carol', '<img class="ccw-opt-img" src="assets/carol-foto.png" alt="Carol" onerror="this.onerror=null;this.src=\'assets/carol-avatar.png\'">', 'Conversar com a Carol', 'Compartilhe sua experiência ou envie uma mensagem.');
      bindOpts(function (key) {
        if (key === 'carol') renderCarol();
        else renderChat(key);
      });
      scrollDown();
    }

    /* ── Dúvidas via assistente de IA ── */
    var CHAT_INFO = {
      aula:       { title: '💬 Dúvida sobre a aula',       intro: 'Claro! 😊 Me conta qual é a sua dúvida sobre a aula — exercício, vocabulário, conteúdo… eu te ajudo.' },
      plataforma: { title: '💻 Dúvida sobre a plataforma', intro: 'Tranquilo! 😊 Qual é a sua dúvida sobre a plataforma? (acesso, navegação, como usar algo…)' },
      sugestao:   { title: '💡 Sugestão ou melhoria',      intro: 'Adoramos sugestões! 💡 Pode escrever sua ideia para deixar o NoSeuTempo ainda melhor — eu anoto com carinho.' }
    };
    function renderChat(cat){
      var info = CHAT_INFO[cat] || CHAT_INFO.aula;
      backTarget = renderMenu;
      setHeader(info.title, '<img class="ccw-hav-pic" src="assets/assistente.png" alt="Assistente" />', true);
      hist = [{ role: 'carol', text: info.intro }];
      bodyEl.innerHTML = '<div class="ccw-bubble">' + info.intro + '</div><div id="ccw-msgs"></div>';
      showFooter(true);
      input.value = '';
      setTimeout(function () { input.focus(); }, 60);
      scrollDown();
    }

    function addMsg(text, who){
      var msgs = document.getElementById('ccw-msgs'); if (!msgs) return null;
      var row = document.createElement('div');
      row.className = 'ccw-msg ' + (who === 'me' ? 'me' : 'carol');
      row.innerHTML = '<div class="b">' + esc(text) + '</div>';
      msgs.appendChild(row); scrollDown(); return row;
    }
    function addTyping(){
      var msgs = document.getElementById('ccw-msgs'); if (!msgs) return null;
      var row = document.createElement('div');
      row.className = 'ccw-msg carol ccw-typing';
      row.innerHTML = '<div class="b"><i></i><i></i><i></i></div>';
      msgs.appendChild(row); scrollDown(); return row;
    }

    function enviar(){
      if (foot.classList.contains('hidden')) return;
      var msg = input.value.trim();
      if (!msg) { input.focus(); return; }
      addMsg(msg, 'me');
      hist.push({ role: 'aluno', text: msg });
      input.value = '';
      send.disabled = true;
      var t = addTyping();
      fetch(API + '/api/carol/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ history: hist.slice(-12), userText: msg })
      })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        if (t) t.remove();
        var reply = (d && d.reply) || 'Estou aqui pra ajudar! 💙';
        addMsg(reply, 'carol');
        hist.push({ role: 'carol', text: reply });
        send.disabled = false;
      })
      .catch(function () {
        if (t) t.remove();
        addMsg('Tive um probleminha para responder agora. 💙 Se quiser, volte e escolha "Conversar com a Carol".', 'carol');
        send.disabled = false;
      });
    }

    /* ── TELA 2: Conversar com a Carol ── */
    function renderCarol(){
      backTarget = renderMenu;
      setHeader('Conversar com a Carol', CAROL_IMG, true);
      showFooter(false);
      bodyEl.innerHTML =
        '<div class="ccw-bubble">' +
          'A Carol adora receber mensagens dos alunos. 💙<br><br>' +
          'Se quiser compartilhar sua experiência, fazer uma sugestão ou simplesmente mandar uma mensagem, escolha uma opção abaixo.' +
        '</div>' +
        opt('elogio', '<svg viewBox="0 0 36 36" width="27" height="27" xmlns="http://www.w3.org/2000/svg"><path d="M18 30.7C9.6 25.2 6 20.6 6 15.3 6 11.6 8.8 9 12 9c2.2 0 4.2 1.1 5.3 2.9.3.5 1.1.5 1.4 0C19.8 10.1 21.8 9 24 9c3.2 0 6 2.6 6 6.3 0 5.3-3.6 9.9-12 15.4z" fill="#F2566B"/><path d="M29 7l2.4-2.2M31 11l3-.7M27.5 4l.5-2.6" stroke="#F2566B" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>', 'Fazer um elogio', 'Conte algo que você gostou.') +
        opt('sugestao', '<svg viewBox="0 0 36 36" width="27" height="27" xmlns="http://www.w3.org/2000/svg"><path d="M8 6h20a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H16l-5.5 5 .7-5H8a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z" fill="#F6A623"/><path d="M18 9.8a3.6 3.6 0 0 1 2.3 6.4c-.5.4-.8 1-.8 1.5h-3c0-.6-.3-1.1-.8-1.5A3.6 3.6 0 0 1 18 9.8z" fill="#fff"/><rect x="16.7" y="18" width="2.6" height="1.5" rx=".7" fill="#fff"/></svg>', 'Dar uma sugestão', 'Tem uma ideia para melhorar?') +
        opt('problema', '<svg viewBox="0 0 36 36" width="27" height="27" xmlns="http://www.w3.org/2000/svg"><path d="M18 5.5c.9 0 1.7.5 2.2 1.3l12 20.8c1 1.7-.2 3.9-2.2 3.9H6c-2 0-3.2-2.2-2.2-3.9l12-20.8c.5-.8 1.3-1.3 2.2-1.3z" fill="#5B9BF0"/><rect x="16.5" y="14" width="3" height="9" rx="1.5" fill="#fff"/><circle cx="18" cy="27" r="1.7" fill="#fff"/></svg>', 'Reportar um problema', 'Encontrou algo que não está certo?') +
        opt('conversar', '<svg viewBox="0 0 36 36" width="27" height="27" xmlns="http://www.w3.org/2000/svg"><path d="M10 5h16a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H16l-5.5 5 .8-5H10a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5z" fill="#9B7EDE"/><circle cx="13.5" cy="14.5" r="1.8" fill="#fff"/><circle cx="18" cy="14.5" r="1.8" fill="#fff"/><circle cx="22.5" cy="14.5" r="1.8" fill="#fff"/></svg>', 'Conversar com a Carol', 'Quero mandar uma mensagem.');
      bindOpts(function (key) {
        var a = CAROL_AFTER[key] || CAROL_AFTER.conversar;
        if (a.ntext) {
          try {
            fetch(API + '/api/notifications/add', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ type: a.ntype || 'comunicacao', text: a.ntext, key: 'contato-' + key + '-' + new Date().toISOString().slice(0, 10) })
            });
          } catch (e) {}
        }
        var w = window.open(waLink(buildWa(a.motivo)), '_blank');
        if (!w) renderCarolAfter(key); /* se o pop-up for bloqueado, mostra a tela com o botão */
      });
      scrollDown();
    }

    var CAROL_AFTER = {
      elogio:    { msg: 'Que alegria! A Carol vai amar ler o seu elogio.',
                   motivo: 'Gostaria de compartilhar um elogio:',
                   ntype: 'reconhecimento', ntext: 'Recebemos seu elogio com muito carinho. Obrigado por compartilhar! 🌟' },
      sugestao:  { msg: 'Adoramos ideias! Conte sua sugestão que a Carol vai considerar com carinho.',
                   motivo: 'Tenho uma sugestão para melhorar a plataforma:',
                   ntype: 'comunicacao', ntext: 'Recebemos sua sugestão. Vamos analisar com carinho — obrigado por ajudar a melhorar o NoSeuTempo! 💙' },
      problema:  { msg: 'Obrigada por avisar! Conte o que aconteceu que a Carol vai cuidar disso.',
                   motivo: 'Encontrei um problema na plataforma.\n\nDescrição do problema:',
                   ntype: 'comunicacao', ntext: 'Recebemos seu reporte. Vamos cuidar disso o quanto antes. Obrigado por avisar! 💙' },
      conversar: { msg: 'A Carol vai adorar falar com você.',
                   motivo: 'Gostaria de conversar com você sobre minha experiência na plataforma.',
                   ntype: 'comunicacao', ntext: 'Que bom que você quer conversar! A Carol vai adorar te ouvir. 💙' }
    };
    function renderCarolAfter(key){
      var a = CAROL_AFTER[key] || CAROL_AFTER.conversar;
      backTarget = renderCarol;
      setHeader('Conversar com a Carol', CAROL_IMG, true);
      showFooter(false);
      bodyEl.innerHTML =
        '<div class="ccw-bubble">' + a.msg + '<br><br>É só tocar no botão abaixo para falar direto com a Carol no WhatsApp. 📱</div>' +
        '<a class="ccw-wa" href="' + waLink(buildWa(a.motivo)) + '" target="_blank" rel="noopener">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.511 5.26l-.999 3.648 3.737-.98zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>' +
          'Falar com a Carol no WhatsApp' +
        '</a>';
      scrollDown();
    }

    /* ── Abrir / fechar / navegação ── */
    function openBox()  { box.classList.remove('hidden'); }
    function closeBox() { box.classList.add('hidden'); }

    face.addEventListener('click', function () {
      if (box.classList.contains('hidden')) openBox(); else closeBox();
    });
    close.addEventListener('click', closeBox);
    back.addEventListener('click', function () { if (backTarget) backTarget(); });

    send.addEventListener('click', enviar);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
    });

    /* Botão X do balão flutuante: esconde o aviso, mantém só o rostinho */
    if (fabX && bubble) {
      fabX.addEventListener('click', function (e) {
        e.stopPropagation();
        bubble.style.display = 'none';
        try { localStorage.setItem('nst.carolHint', 'off'); } catch (e2) {}
      });
      try { if (localStorage.getItem('nst.carolHint') === 'off') bubble.style.display = 'none'; } catch (e3) {}
    }

    renderMenu();
  });
})();
