/* NoSeuTempo — comportamentos do site */
(function () {
  function initIcons() {
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    }
  }

  // Header sombra ao rolar
  function initHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Menu mobile
  function initMobileNav() {
    var header = document.querySelector('.site-header');
    var toggle = document.querySelector('.nav-toggle');
    if (!header || !toggle) return;
    toggle.addEventListener('click', function () {
      header.classList.toggle('open');
    });
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { header.classList.remove('open'); });
    });
  }

  // Reveal on scroll — bulletproof: nunca deixa conteúdo preso invisível
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!els.length) return;

    var revealAll = function () { els.forEach(function (e) { e.classList.add('in'); }); };
    var revealInView = function () {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      els.forEach(function (e) {
        if (e.classList.contains('in')) return;
        var r = e.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh * 0.98) e.classList.add('in');
      });
    };

    if (!('IntersectionObserver' in window)) { revealAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    els.forEach(function (e) { io.observe(e); });

    // Revela o que já está visível, depois do primeiro layout/paint
    requestAnimationFrame(function () { requestAnimationFrame(revealInView); });
    setTimeout(revealInView, 80);
    window.addEventListener('load', function () { revealInView(); setTimeout(revealInView, 150); });
    // Failsafe absoluto: garante que NADA fique invisível
    setTimeout(revealAll, 600);
  }

  // Anel de progresso (anima quando visível)
  function initRings() {
    document.querySelectorAll('.ring[data-value]').forEach(function (ring) {
      var val = parseInt(ring.getAttribute('data-value'), 10) || 0;
      var circle = ring.querySelector('.ring-fg');
      if (!circle) return;
      var r = circle.r.baseVal.value;
      var c = 2 * Math.PI * r;
      circle.style.strokeDasharray = c;
      circle.style.strokeDashoffset = c;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            circle.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)';
            circle.style.strokeDashoffset = c * (1 - val / 100);
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.5 });
      io.observe(ring);
    });
  }

  // Alturas aleatórias estáveis para as ondas de áudio
  function initWaves() {
    document.querySelectorAll('.sp-wave').forEach(function (wave) {
      wave.querySelectorAll('span').forEach(function (bar, i) {
        var base = 20 + Math.abs(Math.sin(i * 1.7)) * 60;
        bar.style.height = base + '%';
        bar.style.animationDelay = (i * 0.05) + 's';
        bar.style.animationDuration = (0.9 + (i % 4) * 0.12) + 's';
      });
    });
  }

  // Parallax suave (mouse + scroll) nos elementos [data-parallax]
  function initParallax() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (!nodes.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var mx = 0, my = 0, sy = 0;
    var raf = null;
    function apply() {
      nodes.forEach(function (n) {
        var f = parseFloat(n.getAttribute('data-parallax')) || 0.05;
        var tx = mx * f * 40;
        var ty = my * f * 40 + sy * f * -0.25;
        n.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
      });
      raf = null;
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(apply); }
    window.addEventListener('mousemove', function (e) {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    }, { passive: true });
    window.addEventListener('scroll', function () { sy = window.scrollY; schedule(); }, { passive: true });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    initIcons();
    initHeaderScroll();
    initMobileNav();
    initReveal();
    initRings();
    initWaves();
    initParallax();
  });
})();
