/* ============================================================
   NoSeuTempo â€” platform.js (dashboard, player, jogos, papo)
   ------------------------------------------------------------
   UX neurodivergente recorrente:
   - Feedback SEMPRE positivo (sem "errado!" em vermelho agressivo).
   - Um passo por vez, alvos grandes, reforÃ§o com emoji/Ã¡udio.
   - Progresso Ã© memÃ³ria externa: atualiza a barra do topo.
   ============================================================ */
(function () {
  "use strict";
  const NST = window.NST || {};

  /* ============================================================
     0) GATE DE ACESSO (conta + pagamento, verificado no servidor)
     - NÃ£o logado  -> vai para login
     - Logado sem pagar -> conteÃºdo bloqueado + banner pra pagar
     - Logado e pago -> libera tudo
     ============================================================ */
  async function applyAccessGate() {
    const banner = document.getElementById("locked-banner");
    const gated = document.getElementById("gated-content");
    if (!gated) return;

    const me = await NST.me();
    if (!me) { location.href = "login.html"; return; } // precisa logar

    // mostra o nome do aluno, se houver onde
    const nomeEl = document.getElementById("aluno-nome");
    if (nomeEl) nomeEl.textContent = me.nome;

    if (!me.paid) {
      gated.classList.add("is-locked");
      if (banner) banner.style.display = "flex";
    } else {
      gated.classList.remove("is-locked");
      if (banner) banner.style.display = "none";
    }
  }

  /* ============================================================
     1) BARRA DE PROGRESSO (Ã‚ncora de MemÃ³ria)
     ============================================================ */
  const RING_CIRC = 2 * Math.PI * 50; // r=50 -> ~314.16

  function renderProgress(value) {
    const fill = document.getElementById("progress-fill");
    const pct = document.getElementById("progress-pct");
    if (fill) fill.style.width = value + "%";
    if (pct) pct.textContent = value + "%";
    // anel
    const ring = document.getElementById("ring-fg");
    const ringPct = document.getElementById("ring-pct");
    const ringBar = document.getElementById("ring-bar");
    if (ring) {
      ring.setAttribute("stroke-dasharray", RING_CIRC.toFixed(1));
      ring.setAttribute("stroke-dashoffset", (RING_CIRC * (1 - value / 100)).toFixed(1));
    }
    if (ringPct) ringPct.textContent = value + "%";
    if (ringBar) ringBar.style.width = value + "%";
  }

  function initProgress() {
    const value = NST.getProgress ? NST.getProgress() : 65;
    // pequeno atraso para a animaÃ§Ã£o acontecer ao entrar
    setTimeout(() => renderProgress(value), 250);
  }
  // AvanÃ§a o progresso ao concluir atividades (reforÃ§o de avanÃ§o)
  function bumpProgress(delta) {
    const v = NST.setProgress((NST.getProgress() || 65) + delta);
    renderProgress(v);
  }

  /* ============================================================
     2) PLAYER DE VÃDEO (o "player")
     Legenda LIGADA por padrÃ£o; velocidade ajustÃ¡vel; teclado.
     Funciona mesmo sem arquivo de vÃ­deo (mostra fallback amigÃ¡vel).
     ============================================================ */
  function initPlayer() {
    const player = document.getElementById("lesson-player");
    if (!player) return;
    const video = player.querySelector("video");
    const playBtn = player.querySelector(".pp");
    const bar = player.querySelector(".player-bar");
    const played = player.querySelector(".played");
    const time = player.querySelector(".player-time");
    const speedBtn = player.querySelector(".speed");
    const ccBtn = player.querySelector(".cc");
    const fallback = player.querySelector(".poster-fallback");

    const speeds = [0.75, 1, 1.25];
    let speedIx = 1;

    function fmt(s) {
      if (!isFinite(s)) return "0:00";
      const m = Math.floor(s / 60);
      const ss = String(Math.floor(s % 60)).padStart(2, "0");
      return m + ":" + ss;
    }
    function toggle() {
      if (!video) return;
      if (video.paused) video.play().catch(() => {}); else video.pause();
    }
    if (playBtn) playBtn.addEventListener("click", toggle);
    if (fallback) fallback.addEventListener("click", toggle);

    if (video) {
      video.addEventListener("play", () => { if (playBtn) playBtn.textContent = "â¸"; if (fallback) fallback.style.display = "none"; });
      video.addEventListener("pause", () => { if (playBtn) playBtn.textContent = "â–¶"; });
      video.addEventListener("timeupdate", () => {
        const p = (video.currentTime / video.duration) * 100 || 0;
        if (played) played.style.width = p + "%";
        if (time) time.textContent = fmt(video.currentTime) + " / " + fmt(video.duration);
      });
      video.addEventListener("ended", () => { bumpProgress(5); });
      // legenda ligada por padrÃ£o (apoio leitura+Ã¡udio)
      video.addEventListener("loadedmetadata", () => {
        if (video.textTracks && video.textTracks[0]) video.textTracks[0].mode = "showing";
      });
    }
    if (bar)
      bar.addEventListener("click", (e) => {
        if (!video || !video.duration) return;
        const rect = bar.getBoundingClientRect();
        video.currentTime = ((e.clientX - rect.left) / rect.width) * video.duration;
      });
    if (speedBtn)
      speedBtn.addEventListener("click", () => {
        speedIx = (speedIx + 1) % speeds.length;
        if (video) video.playbackRate = speeds[speedIx];
        speedBtn.textContent = speeds[speedIx] + "x";
      });
    if (ccBtn)
      ccBtn.addEventListener("click", () => {
        ccBtn.classList.toggle("active");
        if (video && video.textTracks && video.textTracks[0])
          video.textTracks[0].mode = ccBtn.classList.contains("active") ? "showing" : "hidden";
      });

    // PronÃºncia do vocabulÃ¡rio lateral (Web Speech â€” voz em espanhol)
    player.closest(".lesson-layout")?.querySelectorAll(".vocab-row button").forEach((b) =>
      b.addEventListener("click", () => speak(b.dataset.say, "es-ES"))
    );
  }

  /* SÃ­ntese de voz reutilizÃ¡vel (apoio auditivo) */
  function speak(text, lang) {
    if (!("speechSynthesis" in window) || !text) return;
    // Usa a voz feminina es-ES compartilhada quando disponível
    if (window.NSTVoice && window.NSTVoice.speak) { window.NSTVoice.speak(text); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || "es-ES";
    u.rate = 0.9;
    u.pitch = 1.12;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  NST.speak = speak;

  /* ============================================================
     3) JOGO â€” ARRASTAR E SOLTAR (conectar imagem â†” palavra)
     ============================================================ */
  function initDragDrop() {
    const game = document.getElementById("game-dnd");
    if (!game) return;
    const chips = game.querySelectorAll(".chip.draggable");
    const zones = game.querySelectorAll(".dropzone");
    const feedback = game.querySelector(".game-feedback");
    let solved = 0;

    chips.forEach((chip) => {
      chip.setAttribute("draggable", "true");
      chip.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", chip.dataset.key));
      // toque/clique: fala a palavra (apoio auditivo)
      chip.addEventListener("click", () => speak(chip.dataset.say, "es-ES"));
    });

    zones.forEach((zone) => {
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("over"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("over");
        if (zone.classList.contains("correct")) return;
        const key = e.dataTransfer.getData("text/plain");
        const chip = game.querySelector('.chip[data-key="' + key + '"]');
        if (key === zone.dataset.key) {
          // acerto: encaixa visualmente e celebra
          zone.classList.add("correct");
          zone.querySelector(".slot").innerHTML = chip.querySelector(".emoji").outerHTML;
          chip.style.visibility = "hidden";
          speak(zone.dataset.say, "es-ES");
          solved++;
          showFeedback(feedback, "ok", randomPraise());
          if (solved === zones.length) { bumpProgress(8); showFeedback(feedback, "ok", "Â¡IncreÃ­ble! VocÃª conectou tudo! ðŸŽ‰ðŸ’™"); }
        } else {
          // "erro" tratado com gentileza (sem puniÃ§Ã£o)
          showFeedback(feedback, "try", "Quase! Tenta outra combinaÃ§Ã£o ðŸ™‚ VocÃª consegue.");
        }
      });
    });
  }

  /* ============================================================
     4) JOGO â€” ESTOURAR BOLHAS (achar a traduÃ§Ã£o certa)
     ============================================================ */
  function initBubbles() {
    const arena = document.getElementById("bubbles");
    if (!arena) return;
    const promptEl = document.getElementById("bubble-prompt");
    const feedback = arena.parentElement.querySelector(".game-feedback");

    // pares pergunta(pt) -> resposta(es) + distratores
    const rounds = [
      { ask: "Ã¡gua", right: "agua", wrong: ["leche", "pan", "cafÃ©"] },
      { ask: "obrigado", right: "gracias", wrong: ["hola", "adiÃ³s", "perdÃ³n"] },
      { ask: "bom dia", right: "buenos dÃ­as", wrong: ["buenas noches", "hola", "salud"] },
    ];
    let r = 0;

    function layout() {
      arena.innerHTML = "";
      const round = rounds[r];
      promptEl.innerHTML = 'Estoure a bolha que significa <b>â€œ' + round.ask + 'â€</b>';
      const opts = shuffle([round.right, ...round.wrong]);
      opts.forEach((word, i) => {
        const b = document.createElement("button");
        b.className = "bubble";
        b.textContent = word;
        b.style.left = 20 + (i % 2) * 200 + Math.random() * 30 + "px";
        b.style.top = 30 + Math.floor(i / 2) * 150 + Math.random() * 20 + "px";
        b.addEventListener("click", () => {
          speak(word, "es-ES");
          if (word === round.right) {
            b.classList.add("pop");
            showFeedback(feedback, "ok", randomPraise());
            bumpProgress(3);
            r = (r + 1) % rounds.length;
            setTimeout(layout, 700);
          } else {
            showFeedback(feedback, "try", "Essa nÃ£o era â€” sem problema! Tenta de novo ðŸ’™");
          }
        });
        arena.appendChild(b);
      });
    }
    layout();
  }

  /* ============================================================
     5) MOMENTO PAPO â€” chat de voz com IA (estilo WhatsApp)
     Grava Ã¡udio real via MediaRecorder; IA responde com feedback
     motivador. Sem microfone? Cai num modo simulado amigÃ¡vel.
     ============================================================ */
  function initMomentoPapo() {
    const papo = document.getElementById("momento-papo");
    if (!papo) return;
    const body = papo.querySelector(".papo-body");
    const recBtn = papo.querySelector(".record-btn");
    const hint = papo.querySelector(".record-hint");

    // Roteiro de situaÃ§Ã£o real (pedir uma Ã¡gua)
    const script = [
      { say: "Â¡Hola! Bienvenido. Â¿QuÃ© te gustarÃ­a tomar?", tip: "Dica: vocÃª pode pedir uma Ã¡gua ðŸ’§" },
      { say: "Â¡Perfecto! Â¿Con gas o sin gas?", tip: "Tente responder: â€œsin gas, por favorâ€." },
      { say: "Â¡Muy bien! Ahora mismo te la traigo. ðŸ¥¤", tip: "VocÃª mandou super bem!" },
    ];
    let step = 0;
    let mediaRecorder = null;
    let chunks = [];
    let recording = false;

    // primeira fala da IA â€” sÃ³ aparece se o usuÃ¡rio navegar atÃ© esta seÃ§Ã£o
    if (papo.closest('section')?.getBoundingClientRect().top < window.innerHeight) {
      addIAMessage(script[0].say, 3);
    } else {
      // aguarda o aluno rolar atÃ© o Momento Papo
      const observer = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) {
          addIAMessage(script[0].say, 3);
          observer.disconnect();
        }
      }, { threshold: 0.3 });
      observer.observe(papo);
    }

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: "audio/webm" });
          handleUserAudio(URL.createObjectURL(blob));
        };
        mediaRecorder.start();
        recording = true;
        recBtn.classList.add("recording");
        recBtn.textContent = "â¹";
        hint.textContent = "Gravandoâ€¦ toque para enviar";
      } catch (err) {
        // Sem permissÃ£o/microfone: modo simulado (nunca trava o aluno)
        hint.textContent = "Microfone indisponÃ­vel â€” enviando exemplo ðŸ™‚";
        handleUserAudio(null);
      }
    }
    function stopRecording() {
      if (mediaRecorder && recording) mediaRecorder.stop();
      recording = false;
      recBtn.classList.remove("recording");
      recBtn.textContent = "ðŸŽ¤";
      hint.textContent = "Toque para responder por voz";
    }
    recBtn.addEventListener("click", () => (recording ? stopRecording() : startRecording()));

    /* Mostra a mensagem de voz do aluno + dispara "anÃ¡lise" da IA */
    function handleUserAudio(url) {
      addUserAudio(url);
      // "processando o Ã¡udio" â€” bolha de digitando
      const typing = addTyping();
      setTimeout(() => {
        typing.remove();
        // feedback acolhedor e motivador (simulado)
        addFeedbackCard();
        step++;
        if (step < script.length) {
          setTimeout(() => addIAMessage(script[step].say, 2 + step), 600);
        } else {
          bumpProgress(10);
          setTimeout(() => addIAMessage("Â¡Lo lograste! Estoy muy orgullosa de ti, sigue así. ðŸ’™", 3), 600);
        }
      }, 1800);
    }

    /* ---- helpers de UI do chat ---- */
    function scroll() { body.scrollTop = body.scrollHeight; }

    function addIAMessage(text, dur) {
      const el = document.createElement("div");
      el.className = "msg ia";
      el.innerHTML =
        '<div class="audio-line"><button title="Ouvir">â–¶</button>' +
        wave() + '<span class="dur">0:0' + (dur || 2) + '</span></div>' +
        '<div style="margin-top:8px">' + text + "</div>";
      el.querySelector("button").addEventListener("click", () => speak(text, "es-ES"));
      body.appendChild(el);
      scroll();
      // speak removido â€” sÃ³ toca quando o aluno clicar em â–¶
    }
    function addUserAudio(url) {
      const el = document.createElement("div");
      el.className = "msg me";
      el.innerHTML = '<div class="audio-line"><button title="Ouvir">â–¶</button>' + wave() + '<span class="dur">0:03</span></div>';
      el.querySelector("button").addEventListener("click", () => {
        if (url) new Audio(url).play();
      });
      body.appendChild(el);
      scroll();
    }
    function addTyping() {
      const el = document.createElement("div");
      el.className = "msg ia";
      el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      body.appendChild(el);
      scroll();
      return el;
    }
    function addFeedbackCard() {
      const tips = [
        "Sua pronÃºncia ficou bem clara! Continue assim.",
        "VocÃª falou com confianÃ§a â€” isso Ã© o mais importante!",
        "Quase nativo! SÃ³ capriche um pouquinho no â€œrrâ€. ðŸ™‚",
      ];
      const el = document.createElement("div");
      el.className = "feedback-card";
      el.innerHTML =
        '<div class="stars">â­â­â­â­</div>' +
        "<b>Â¡Muy bien!</b> VocÃª foi Ã³timo. " +
        '<div class="tip">ðŸ’¡ ' + tips[Math.floor((step) % tips.length)] + "</div>";
      body.appendChild(el);
      scroll();
    }
    function wave() {
      let s = '<span class="wave">';
      const hs = [10, 16, 22, 12, 18, 8, 20, 14, 10, 16];
      hs.forEach((h) => (s += '<i style="height:' + h + 'px"></i>'));
      return s + "</span>";
    }
  }

  /* ============================================================
     UtilitÃ¡rios
     ============================================================ */
  function showFeedback(el, kind, msg) {
    if (!el) return;
    el.className = "game-feedback show " + kind;
    el.textContent = msg;
  }
  function randomPraise() {
    const p = ["Â¡Muy bien! ðŸŽ‰", "Â¡Excelente! ðŸ’™", "Â¡Perfecto! âœ¨", "Isso! VocÃª acertou ðŸ‘"];
    return p[Math.floor(Math.random() * p.length)];
  }
  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ============================================================
     JOGO DA MEMÃ“RIA â€” Conecta nÃºmero do mÃªs com nome
     Uso: <div class="memory-game" data-pairs='[{"a":"1","b":"enero"},{"a":"2","b":"febrero"}]'></div>
     ============================================================ */
  function initMemoryGame() {
    document.querySelectorAll('.memory-game').forEach(function(container) {
      if (container._init) return; container._init = true;
      var raw = [];
      try { raw = JSON.parse(container.dataset.pairs || '[]'); } catch(e) {}
      if (!raw.length) raw = [
        {a:'1',b:'enero'},{a:'2',b:'febrero'},{a:'3',b:'marzo'},
        {a:'4',b:'abril'},{a:'5',b:'mayo'},{a:'6',b:'junio'},
        {a:'7',b:'julio'},{a:'8',b:'agosto'},{a:'9',b:'septiembre'},
        {a:'10',b:'octubre'},{a:'11',b:'noviembre'},{a:'12',b:'diciembre'}
      ];
      // Usa apenas 6 pares por rodada para nÃ£o cansar
      var pairs = raw.slice(0, 6);
      var cards = [];
      pairs.forEach(function(p) { cards.push({val:p.a,pair:p.b,id:'a'}); cards.push({val:p.b,pair:p.a,id:'b'}); });
      // Embaralha
      for (var i=cards.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=cards[i];cards[i]=cards[j];cards[j]=t;}

      var flipped=[], matched=0, timer=null, seconds=0;
      var uid = container.id || ('mg-'+Math.random().toString(36).slice(2));
      container.innerHTML = '<div class="mg-timer">â±ï¸ <span id="mg-time-'+uid+'">0:00</span></div><div class="mg-grid"></div><div class="mg-feedback"></div><button class="btn btn--ghost mg-restart">ðŸ”„ Novo jogo</button>';
      var grid = container.querySelector('.mg-grid');
      var feedback = container.querySelector('.mg-feedback');
      var timeEl = container.querySelector('.mg-timer span');

      function startTimer(){ timer=setInterval(function(){ seconds++; var m=Math.floor(seconds/60),s=seconds%60; timeEl.textContent=m+':'+(s<10?'0':'')+s; },1000); }
      function stopTimer(){ clearInterval(timer); }
      startTimer();

      cards.forEach(function(card) {
        var el = document.createElement('div');
        el.className = 'mg-card';
        el.dataset.val = card.val;
        el.dataset.pair = card.pair;
        el.innerHTML = '<div class="mg-front">?</div><div class="mg-back">'+card.val+'</div>';
        el.addEventListener('click', function() {
          if (el.classList.contains('flipped')||el.classList.contains('matched')||flipped.length>=2) return;
          el.classList.add('flipped');
          flipped.push(el);
          if (flipped.length===2) {
            var a=flipped[0],b=flipped[1];
            var isMatch = (a.dataset.val===b.dataset.pair && b.dataset.val===a.dataset.pair);
            if (isMatch) {
              a.classList.add('matched'); b.classList.add('matched');
              matched++; flipped=[];
              feedback.textContent='âœ… Par encontrado!';
              if (matched===pairs.length){ stopTimer(); feedback.textContent='ðŸŽ‰ Muito bem! VocÃª encontrou todos os pares em '+timeEl.textContent+'!'; }
            } else {
              setTimeout(function(){ a.classList.remove('flipped'); b.classList.remove('flipped'); flipped=[]; feedback.textContent='Tente novamente! ðŸ’ª'; },900);
            }
          }
        });
        grid.appendChild(el);
      });
      container.querySelector('.mg-restart').addEventListener('click', function() {
        stopTimer(); seconds=0; matched=0; flipped=[];
        container._init=false; container.innerHTML=''; initMemoryGame();
      });
    });
  }

  /* ============================================================
     SOPA DE LETRAS â€” Word search interativo
     Uso: <div class="word-search" data-words='["LUNES","MARTES","MIÃ‰RCOLES"]'></div>
     ============================================================ */
  function initWordSearch() {
    document.querySelectorAll('.word-search').forEach(function(container) {
      if (container._init) return; container._init = true;
      var words = [];
      try { words = JSON.parse(container.dataset.words || '[]'); } catch(e) {}
      if (!words.length) words = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO'];
      words = words.map(function(w){ return w.toUpperCase().replace(/Ã‰/g,'E').replace(/Ã/g,'A').replace(/Ã“/g,'O').replace(/Ãš/g,'U').replace(/Ã/g,'I'); });

      var SIZE = 10;
      var grid = Array.from({length:SIZE}, function(){ return Array(SIZE).fill(''); });
      var placed = [];
      var dirs = [[0,1],[1,0],[1,1],[0,-1],[-1,0]];

      function placeWord(word) {
        for (var attempt=0; attempt<50; attempt++) {
          var dir = dirs[Math.floor(Math.random()*dirs.length)];
          var r=Math.floor(Math.random()*SIZE), c=Math.floor(Math.random()*SIZE);
          var positions=[];
          var ok=true;
          for (var i=0;i<word.length;i++){
            var nr=r+dir[0]*i, nc=c+dir[1]*i;
            if(nr<0||nr>=SIZE||nc<0||nc>=SIZE){ok=false;break;}
            if(grid[nr][nc]&&grid[nr][nc]!==word[i]){ok=false;break;}
            positions.push([nr,nc]);
          }
          if(ok){ positions.forEach(function(p,i){ grid[p[0]][p[1]]=word[i]; }); placed.push({word:word,positions:positions}); return true; }
        }
        return false;
      }

      words.forEach(function(w){ placeWord(w); });
      var LETTERS='ABCDEFGHIJKLMNOPRSTUVXYZ';
      for(var r=0;r<SIZE;r++) for(var c=0;c<SIZE;c++) if(!grid[r][c]) grid[r][c]=LETTERS[Math.floor(Math.random()*LETTERS.length)];

      var found=new Set(), selecting=false, startCell=null, selectedCells=[];
      container.innerHTML='<div class="ws-grid"></div><div class="ws-words"></div><div class="ws-feedback"></div>';
      var gridEl=container.querySelector('.ws-grid');
      var wordsEl=container.querySelector('.ws-words');
      var feedbackEl=container.querySelector('.ws-feedback');
      gridEl.style.gridTemplateColumns='repeat('+SIZE+',1fr)';

      var cellEls=[];
      grid.forEach(function(row,ri){
        row.forEach(function(letter,ci){
          var cell=document.createElement('div');
          cell.className='ws-cell'; cell.textContent=letter;
          cell.dataset.r=ri; cell.dataset.c=ci;
          cell.addEventListener('mousedown',function(e){ e.preventDefault(); selecting=true; startCell=cell; selectedCells=[cell]; cell.classList.add('selecting'); });
          cell.addEventListener('mouseenter',function(){
            if(!selecting) return;
            selectedCells.forEach(function(s){s.classList.remove('selecting');}); selectedCells=[];
            var r0=+startCell.dataset.r,c0=+startCell.dataset.c,r1=+cell.dataset.r,c1=+cell.dataset.c;
            var dr=Math.sign(r1-r0),dc=Math.sign(c1-c0);
            var rr=r0,cc=c0;
            while(rr!==r1||cc!==c1){ var el=cellEls[rr][cc]; el.classList.add('selecting'); selectedCells.push(el); rr+=dr; cc+=dc; }
            var el2=cellEls[r1][c1]; el2.classList.add('selecting'); selectedCells.push(el2);
          });
          gridEl.appendChild(cell);
          if(!cellEls[ri]) cellEls[ri]=[];
          cellEls[ri][ci]=cell;
        });
      });

      document.addEventListener('mouseup',function(){
        if(!selecting) return; selecting=false;
        var word=selectedCells.map(function(s){return s.textContent;}).join('');
        var rword=word.split('').reverse().join('');
        var match=placed.find(function(p){return p.word===word||p.word===rword;});
        if(match&&!found.has(match.word)){
          found.add(match.word);
          selectedCells.forEach(function(s){s.classList.remove('selecting');s.classList.add('found');});
          var wi=wordsEl.querySelector('[data-w="'+match.word+'"]');
          if(wi) wi.classList.add('found-word');
          feedbackEl.textContent='âœ… '+match.word+'!';
          if(found.size===placed.length) feedbackEl.textContent='ðŸŽ‰ ParabÃ©ns! VocÃª encontrou todas as palavras!';
        } else {
          selectedCells.forEach(function(s){s.classList.remove('selecting');});
          feedbackEl.textContent='';
        }
        selectedCells=[];
      });

      words.forEach(function(w){
        var span=document.createElement('span'); span.className='ws-word'; span.textContent=w; span.dataset.w=w; wordsEl.appendChild(span);
      });
    });
  }

  /* ============================================================
     ORDENA LETRAS â€” Anagrama interativo
     Uso: <div class="letter-order" data-words='["LUNES","MARTES"]'></div>
     ============================================================ */
  function initLetterOrder() {
    document.querySelectorAll('.letter-order').forEach(function(container) {
      if (container._init) return; container._init = true;
      var words = [];
      try { words = JSON.parse(container.dataset.words || '[]'); } catch(e) {}
      if (!words.length) words = ['LUNES','MARTES','MIÃ‰RCOLES','JUEVES','VIERNES','SÃBADO','DOMINGO'];
      var idx=0;

      function render() {
        var word=words[idx].toUpperCase();
        var letters=word.split('').sort(function(){return Math.random()-.5;});
        container.innerHTML='<div class="lo-progress">'+(idx+1)+'/'+words.length+'</div><div class="lo-scrambled"></div><div class="lo-answer"></div><div class="lo-feedback"></div><div class="lo-btns"><button class="btn btn--ghost btn--sm lo-clear">ðŸ”„ Limpar</button><button class="btn btn--primary btn--sm lo-check">âœ“ Verificar</button></div>';
        var scrambled=container.querySelector('.lo-scrambled');
        var answer=container.querySelector('.lo-answer');
        var feedback=container.querySelector('.lo-feedback');

        letters.forEach(function(l){
          var btn=document.createElement('button');
          btn.className='lo-letter'; btn.textContent=l;
          btn.addEventListener('click',function(){
            if(btn.classList.contains('used')) return;
            btn.classList.add('used');
            var slot=document.createElement('div'); slot.className='lo-slot'; slot.textContent=l;
            slot.dataset.letter=l;
            slot.addEventListener('click',function(){ btn.classList.remove('used'); slot.remove(); });
            answer.appendChild(slot);
          });
          scrambled.appendChild(btn);
        });

        container.querySelector('.lo-clear').addEventListener('click',function(){
          container.querySelectorAll('.lo-letter').forEach(function(b){b.classList.remove('used');});
          answer.innerHTML=''; feedback.textContent='';
        });

        container.querySelector('.lo-check').addEventListener('click',function(){
          var attempt=Array.from(answer.querySelectorAll('.lo-slot')).map(function(s){return s.textContent;}).join('');
          if(attempt===word){
            feedback.innerHTML='âœ… Correto! <strong>'+word+'</strong>';
            feedback.style.color='var(--green)';
            setTimeout(function(){ idx=(idx+1)%words.length; render(); },1200);
          } else {
            feedback.textContent='Quase lÃ¡! Tente de novo ðŸ’ª';
            feedback.style.color='var(--orange)';
          }
        });
      }
      render();
    });
  }

  /* ============================================================
     DITADO COM ÃUDIO â€” OuÃ§a e escreva
     Uso: <div class="dictado" data-words='[{"word":"lunes","hint":"1Âº dia da semana"}]' data-lang="es-ES"></div>
     ============================================================ */
  function initDictado() {
    document.querySelectorAll('.dictado').forEach(function(container) {
      if (container._init) return; container._init = true;
      var items = [];
      try { items = JSON.parse(container.dataset.words || '[]'); } catch(e) {}
      if (!items.length) items = [
        {word:'lunes',hint:'1Âº dia da semana'},{word:'martes',hint:'2Âº dia'},{word:'miÃ©rcoles',hint:'3Âº dia'},
        {word:'jueves',hint:'4Âº dia'},{word:'viernes',hint:'5Âº dia'},{word:'sÃ¡bado',hint:'fim de semana'},{word:'domingo',hint:'fim de semana'}
      ];
      var lang = container.dataset.lang || 'es-ES';
      var idx=0, score=0;

      function speakWord(text) {
        if(!window.speechSynthesis) return;
        var u=new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=0.8;
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      }

      function render() {
        var item=items[idx];
        container.innerHTML='<div class="dc-progress">'+score+'/'+items.length+' corretas</div>'
          +'<button class="dc-play btn btn--teal">ðŸ”Š Ouvir</button>'
          +'<input class="dc-input" type="text" placeholder="Escreva o que ouviuâ€¦" autocomplete="off" autocorrect="off" />'
          +'<div class="dc-hint hidden" style="color:var(--muted);font-size:.88rem">ðŸ’¡ Dica: '+item.hint+'</div>'
          +'<div class="dc-btns"><button class="btn btn--ghost btn--sm dc-dica">ðŸ’¡ Dica</button><button class="btn btn--primary btn--sm dc-check">âœ“ Verificar</button></div>'
          +'<div class="dc-feedback"></div>';
        var input=container.querySelector('.dc-input');
        var feedback=container.querySelector('.dc-feedback');
        container.querySelector('.dc-play').addEventListener('click',function(){ speakWord(item.word); });
        container.querySelector('.dc-dica').addEventListener('click',function(){ container.querySelector('.dc-hint').classList.remove('hidden'); });
        container.querySelector('.dc-check').addEventListener('click',function(){
          var attempt=input.value.trim().toLowerCase();
          var correct=item.word.toLowerCase();
          if(attempt===correct){
            score++; feedback.innerHTML='âœ… Correto! <strong>'+item.word+'</strong>'; feedback.style.color='var(--green)';
            setTimeout(function(){
              idx=(idx+1)%items.length;
              if(idx===0){
                container.innerHTML='<div style="text-align:center;padding:24px"><div style="font-size:2rem">ðŸŽ‰</div><strong>Ditado completo! '+score+'/'+items.length+' corretas.</strong><br><button class="btn btn--teal" onclick="this.closest(\'.dictado\')._init=false;this.closest(\'.dictado\').innerHTML=\'\';initDictado()">RecomeÃ§ar</button></div>';
                return;
              }
              render(); // sem auto-play â€” aluno clica em ðŸ”Š quando quiser
            },1200);
          } else {
            feedback.textContent='Quase lÃ¡! Tente de novo ðŸ’ª (dica: '+item.hint+')'; feedback.style.color='var(--orange)';
            input.value=''; input.focus();
          }
        });
        input.addEventListener('keydown',function(e){ if(e.key==='Enter') container.querySelector('.dc-check').click(); });
        // sem auto-play â€” aluno clica em ðŸ”Š para ouvir
      }
      render();
    });
  }

  /* ============================================================
     INFOGRÃFICO COM ÃUDIO â€” Visual vocab com pronÃºncia
     Uso: <div class="audio-vocab" data-title="Los dÃ­as de la semana" data-lang="es-ES"
           data-words='[{"word":"lunes","trans":"segunda-feira","emoji":"ðŸ“…","color":"#E2F3F5"}]'></div>
     ============================================================ */
  function initAudioVocab() {
    document.querySelectorAll('.audio-vocab').forEach(function(container) {
      if (container._init) return; container._init = true;
      var words=[]; try { words=JSON.parse(container.dataset.words||'[]'); } catch(e) {}
      var lang=container.dataset.lang||'es-ES';
      var title=container.dataset.title||'VocabulÃ¡rio';

      function speakVocab(text){ if(!window.speechSynthesis) return; var u=new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=0.75; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }

      container.innerHTML='<h4 class="av-title">'+title+'</h4><div class="av-grid"></div><p class="av-tip">ðŸ‘† Toque em qualquer palavra para ouvir a pronÃºncia</p>';
      var grid=container.querySelector('.av-grid');
      words.forEach(function(w){
        var card=document.createElement('div'); card.className='av-card';
        if(w.color) card.style.background=w.color;
        card.innerHTML=(w.emoji?'<span class="av-emoji">'+w.emoji+'</span>':'')+'<span class="av-word">'+w.word+'</span>'+(w.trans?'<span class="av-trans">'+w.trans+'</span>':'')+'<button class="av-play" aria-label="Ouvir '+w.word+'">ðŸ”Š</button>';
        card.querySelector('.av-play').addEventListener('click',function(e){ e.stopPropagation(); speakVocab(w.word); card.classList.add('playing'); setTimeout(function(){card.classList.remove('playing');},1000); });
        card.addEventListener('click',function(){ speakVocab(w.word); card.classList.add('playing'); setTimeout(function(){card.classList.remove('playing');},1000); });
        grid.appendChild(card);
      });
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    applyAccessGate();
    initProgress();
    initPlayer();
    initDragDrop();
    initBubbles();
    initMomentoPapo();
    initMemoryGame();
    initWordSearch();
    initLetterOrder();
    initDictado();
    initAudioVocab();
  });
})();


