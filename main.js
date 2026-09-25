/* =========================================================================
   WorkoutLoop 宣传站 · 交互
   策略见 site/DESIGN.md 第 6 节：每次动效都要能一句话说明理由，
   全部一次性、不循环。无滚动劫持、无循环动画、无视差。零依赖。

   滚动相关的四件事（进度线、导航状态、导航滑块、时间轴当前步）
   共用一个 scroll 监听 + 一个 rAF，避免四个监听各自触发重排。
   ========================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 阅读进度细线 ----------------------------------------------------
     只在滚动时更新，用 transform 而非 width（避免每帧触发布局计算）。
     到顶时归零，不常驻。 */
  function makeReadProgress() {
    if (reduceMotion) return null;

    var bar = document.createElement("div");
    bar.className = "read-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    return function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var ratio = max > 0 ? Math.min(doc.scrollTop / max, 1) : 0;
      bar.style.transform = "scaleX(" + ratio + ")";
    };
  }

  /* ---- 导航滚动状态 ----------------------------------------------------
     内容滚到导航之下时补一条 1px 细线，给"下方还有内容"的状态提示。 */
  function makeHeaderState() {
    var header = document.getElementById("site-header");
    if (!header) return null;
    return function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
  }

  /* ---- 导航滑块：当前在哪个区块 ----------------------------------------
     滑块回答「我读到哪了」。它只在进入某个区块后出现，回到顶部时收起。 */
  function makeNavSpy() {
    var nav = document.getElementById("site-nav");
    if (!nav) return null;

    var marker = nav.querySelector(".nav-marker");
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    if (!marker || !links.length) return null;

    var pairs = links.map(function (a) {
      var id = a.getAttribute("href").slice(1);
      var section = document.getElementById(id);
      return section ? { link: a, section: section } : null;
    }).filter(Boolean);
    if (!pairs.length) return null;

    var current = null;

    function place(link) {
      // 位置用 translateX，宽度用 scaleX —— 两者都是 transform，
      // 不触发布局重排。基准宽度从 CSS 读，避免和样式表里的数字对不上。
      var base = parseFloat(
        window.getComputedStyle(marker).getPropertyValue("--nav-base")
      ) || 240;
      marker.style.setProperty("--nav-x", link.offsetLeft + "px");
      marker.style.setProperty("--nav-scale", String(link.offsetWidth / base));
      marker.classList.add("is-on");
    }

    function update() {
      // 判定线放在视口上方约三分之一处，比"顶部对齐"更符合阅读直觉
      var line = window.scrollY + window.innerHeight * 0.34;
      var active = null;
      for (var i = 0; i < pairs.length; i++) {
        if (pairs[i].section.offsetTop <= line) active = pairs[i];
      }
      if (active === current) return;
      if (current) {
        current.link.classList.remove("is-active");
        current.link.removeAttribute("aria-current");
      }
      current = active;
      if (current) {
        current.link.classList.add("is-active");
        // 视觉状态同时要给辅助技术一个说法，不能只靠颜色
        current.link.setAttribute("aria-current", "true");
        place(current.link);
      } else {
        marker.classList.remove("is-on");
      }
    }

    // 窗口尺寸变化会改变 offsetLeft，重新贴合当前项
    window.addEventListener("resize", function () {
      if (current) place(current.link);
    }, { passive: true });

    return update;
  }

  /* ---- 时间轴：当前读到第几步 ------------------------------------------
     四步是一个有顺序的过程，青绿线扫过当前那一步的上边缘，
     表示进度；不是装饰。 */
  function makeStepsSpy() {
    var list = document.getElementById("steps");
    if (!list) return null;

    var items = Array.prototype.slice.call(list.children);
    if (!items.length) return null;

    var current = null;

    function update() {
      var line = window.innerHeight * 0.42;
      var active = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].getBoundingClientRect().top <= line) active = items[i];
      }
      // 整段还在视口下方时不高亮任何一步
      if (items[0].getBoundingClientRect().top > line) active = null;
      if (active === current) return;
      current = active;
      items.forEach(function (li) { li.classList.toggle("is-current", li === current); });
    }

    return update;
  }

  /* ---- 首屏分段入场 ----------------------------------------------------
     标题 → 正文 → 操作 → 事实依次上浮（延迟写在 CSS 里）。
     首屏不该等 IntersectionObserver，挂载后立即进场。 */
  function initRise() {
    var items = document.querySelectorAll(".rise");
    if (!items.length) return;

    if (reduceMotion) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add("is-in"); });
      return;
    }
    // 双 rAF：确保初始状态先被计算，否则可能跳过过渡直接显示
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        Array.prototype.forEach.call(items, function (el) { el.classList.add("is-in"); });
      });
    });
  }

  /* ---- 入场揭示 --------------------------------------------------------
     用 IntersectionObserver，不做滚动监听。
     每个元素只揭示一次（unobserve），避免来回滚动反复播放。
     同一批元素按 DOM 顺序做 70ms 递延，形成阅读节奏。 */
  function initReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      // 同一帧里命中的元素一起递延，避免每个元素各自计时导致节奏散乱
      var batch = entries.filter(function (e) { return e.isIntersecting; });
      batch.forEach(function (entry, i) {
        var el = entry.target;
        el.style.transitionDelay = (i * 70) + "ms";
        el.classList.add("is-visible");
        observer.unobserve(el);
      });
    }, {
      // 元素露出约 12% 时触发，略早于完全进入视口，滚动更顺
      threshold: 0.12,
      rootMargin: "0px 0px -8% 0px"
    });

    Array.prototype.forEach.call(items, function (el) { observer.observe(el); });

    // 安全网：观察器在某些环境（无头浏览器、极窄视口、被 iframe 收起）
    // 可能始终不报告可见，元素就会一直停在 opacity:0。这里在首屏时间之后
    // 强制放行仍然隐藏的元素，宁可少一次动画，也不能让内容读不到。
    window.setTimeout(function () {
      Array.prototype.forEach.call(items, function (el) {
        if (!el.classList.contains("is-visible")) {
          el.style.transitionDelay = "0ms";
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      });
    }, 1200);
  }

  /* ---- 截图延迟加载兜底 ------------------------------------------------
     webp 已用 loading="lazy"，但老浏览器忽略该属性。
     这里只做兜底：真正解码失败时给出可读的替代文本样式，
     不伪造占位图。 */
  function initShotFallback() {
    var imgs = document.querySelectorAll(".shot img");
    Array.prototype.forEach.call(imgs, function (img) {
      img.addEventListener("error", function () {
        var fig = img.closest(".shot");
        if (fig) fig.classList.add("is-broken");
      });
    });
  }

  /* ---- 页脚年份 --------------------------------------------------------
     写死在 HTML 里迟早会过期，交给 JS 保持正确；无 JS 时显示的仍是合理值。 */
  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function init() {
    var updaters = [
      makeReadProgress(),
      makeHeaderState(),
      makeNavSpy(),
      makeStepsSpy()
    ].filter(Boolean);

    if (updaters.length) {
      var ticking = false;
      function run() {
        updaters.forEach(function (fn) { fn(); });
        ticking = false;
      }
      function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(run);
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      run();
    }

    initRise();
    initReveal();
    initShotFallback();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
