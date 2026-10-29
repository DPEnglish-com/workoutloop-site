// WorkoutLoop 官网：主题、顶栏分隔线、年份。无外部请求。
(function () {
  'use strict';

  var root = document.documentElement;
  var themeBtn = document.getElementById('theme-toggle');

  function syncTheme() {
    var dark = root.getAttribute('data-theme') === 'dark';
    if (themeBtn) {
      themeBtn.textContent = dark ? '浅色' : '深色';
      themeBtn.setAttribute('aria-label', dark ? '切换为浅色主题' : '切换为深色主题');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0E0E0F' : '#F6F5F1');
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('workoutloop-theme', next); } catch (e) {}
      syncTheme();
    });
  }
  syncTheme();

  var head = document.getElementById('top');
  function onScroll() {
    if (!head) return;
    if (window.scrollY > 8) head.setAttribute('data-stuck', '');
    else head.removeAttribute('data-stuck');
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('shown'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  }
})();
