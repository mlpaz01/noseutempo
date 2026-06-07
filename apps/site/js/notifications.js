/* ============================================================
   NoSeuTempo — Notificações (acompanhamento do aluno)
   Sino com contador (só quando há não lidas) + painel acolhedor.
   Tipos: motivacao 💙 · progresso 📚 · comunicacao 💬 · reconhecimento 🌟
   ============================================================ */
(function () {
  'use strict';
  var API = window.NST_API || 'https://api.noseutempo.app';

  document.addEventListener('DOMContentLoaded', function () {
    var token = localStorage.getItem('nst.token'); if (!token) return;
    var bell = document.querySelector('.nsthd-bell'); if (!bell) return;
    var badge = bell.querySelector('.nsthd-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'nsthd-badge'; bell.appendChild(badge); }
    badge.textContent = ''; badge.style.display = 'none';

    /* estilos do painel */
    var st = document.createElement('style');
    st.textContent =
      '#nst-notif{position:fixed;width:360px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #E6EBF2;border-radius:18px;box-shadow:0 24px 60px rgba(27,43,74,.22);z-index:120;overflow:hidden;font-family:\'Poppins\',system-ui,sans-serif;}' +
      '#nst-notif.hidden{display:none;}' +
      '.nstn-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #F0F3F8;}' +
      '.nstn-head h4{margin:0;font-size:1rem;font-weight:800;color:#1A2B4A;}' +
      '.nstn-head .clr{background:none;border:0;color:#1FA6A8;font-size:.76rem;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.nstn-head .clr:hover{text-decoration:underline;}' +
      '.nstn-list{max-height:62vh;overflow-y:auto;}' +
      '.nstn-item{display:flex;gap:11px;padding:13px 16px;border-bottom:1px solid #F4F6FA;}' +
      '.nstn-item:last-child{border-bottom:0;}' +
      '.nstn-item.unread{background:#F2FAFB;}' +
      '.nstn-ic{width:34px;height:34px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:17px;}' +
      '.nstn-tx{font-size:.86rem;line-height:1.45;color:#26344F;}' +
      '.nstn-time{font-size:.72rem;color:#9AA6B6;margin-top:3px;}' +
      '.nstn-empty{padding:36px 22px;text-align:center;color:#8A95A6;font-size:.9rem;line-height:1.6;}';
    document.head.appendChild(st);

    var panel = document.createElement('div');
    panel.id = 'nst-notif'; panel.className = 'hidden';
    panel.innerHTML =
      '<div class="nstn-head"><h4>Notificações</h4><button class="clr" id="nstn-clear">Marcar como lidas</button></div>' +
      '<div class="nstn-list" id="nstn-list"></div>';
    document.body.appendChild(panel);
    var listEl = document.getElementById('nstn-list');

    var META = {
      motivacao:      { ic: '💙', bg: '#E7F0FF' },
      progresso:      { ic: '📚', bg: '#E2F3F0' },
      comunicacao:    { ic: '💬', bg: '#EEE9FB' },
      reconhecimento: { ic: '🌟', bg: '#FCF1DA' }
    };
    function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function rel(iso){
      try {
        var d = new Date(iso), s = Math.floor((Date.now() - d.getTime()) / 1000);
        if (s < 60) return 'agora';
        var m = Math.floor(s/60); if (m < 60) return 'há ' + m + ' min';
        var h = Math.floor(m/60); if (h < 24) return 'há ' + h + 'h';
        var dd = Math.floor(h/24); if (dd === 1) return 'ontem';
        if (dd < 7) return 'há ' + dd + ' dias';
        return d.toLocaleDateString('pt-BR');
      } catch (e) { return ''; }
    }
    function setBadge(n){
      if (n > 0) { badge.textContent = n > 9 ? '9+' : String(n); badge.style.display = 'flex'; }
      else { badge.textContent = ''; badge.style.display = 'none'; }
    }
    function render(d){
      var items = (d && d.notifications) || [];
      setBadge((d && d.unread) || 0);
      if (!items.length) {
        listEl.innerHTML = '<div class="nstn-empty">Você está em dia! 💙<br>Suas novidades aparecerão aqui conforme você avança.</div>';
        return;
      }
      listEl.innerHTML = items.map(function (n) {
        var m = META[n.type] || META.motivacao;
        return '<div class="nstn-item' + (n.read ? '' : ' unread') + '">' +
          '<span class="nstn-ic" style="background:' + m.bg + '">' + m.ic + '</span>' +
          '<div><div class="nstn-tx">' + esc(n.text) + '</div><div class="nstn-time">' + rel(n.createdAt) + '</div></div>' +
          '</div>';
      }).join('');
    }

    var seeded = false;
    function add(type, text, key){
      return fetch(API + '/api/notifications/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ type: type, text: text, key: key })
      });
    }
    function seedIfEmpty(d){
      if (seeded || !(d && d.notifications && d.notifications.length === 0)) return;
      seeded = true;
      add('motivacao', 'Seja muito bem-vindo(a) ao NoSeuTempo! Cada passo conta — vamos no seu ritmo, sem pressão. 💙', 'welcome')
        .then(function () { return add('reconhecimento', 'Que bom ter você aqui. Obrigado por fazer parte do NoSeuTempo. 🌟', 'obrigado'); })
        .then(function () { load(); })
        .catch(function () {});
    }
    function load(){
      fetch(API + '/api/notifications', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d) { render(d); seedIfEmpty(d); } })
        .catch(function () {});
    }
    function markRead(){
      fetch(API + '/api/notifications/read', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }).catch(function () {});
    }

    function position(){
      var r = bell.getBoundingClientRect();
      panel.style.top = (r.bottom + 10) + 'px';
      panel.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
      panel.style.left = 'auto';
    }
    function open(){ position(); panel.classList.remove('hidden'); setBadge(0); markRead(); }
    function close(){ panel.classList.add('hidden'); }

    bell.addEventListener('click', function (e) {
      e.preventDefault();
      if (panel.classList.contains('hidden')) open(); else close();
    });
    document.getElementById('nstn-clear').addEventListener('click', function () { setBadge(0); markRead(); load(); });
    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('hidden') && !panel.contains(e.target) && !bell.contains(e.target)) close();
    });
    window.addEventListener('resize', function () { if (!panel.classList.contains('hidden')) position(); });

    load();
    setInterval(load, 60000);
  });
})();
