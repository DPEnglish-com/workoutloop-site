/* =========================================================================
   WorkoutLoop 宣传站 · 交互
   策略见 site/DESIGN.md 第 6 节：一个编排时刻（hero 截图揭示），
   其余动效只服务于层级与状态。无滚动劫持、无循环动画、无视差。
   零依赖。
   ========================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 阅读进度细线 ----------------------------------------------------
     只在滚动时更新，用 transform 而非 width（避免每帧触发布局计算）。
     到顶时归零并隐藏，不常驻。 */
  function initReadProgress() {
    if (reduceMotion) return;

    var bar = document.createElement("div");
    bar.className = "read-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    var ticking = false;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var ratio = max > 0 ? Math.min(doc.scrollTop / max, 1) : 0;
      bar.style.transform = "scaleX(" + ratio + ")";
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ---- 导航滚动状态 ----------------------------------------------------
     内容滚到导航之下时补一条 1px 细线，给"下方还有内容"的状态提示。 */
  function initHeader() {
    var header = document.getElementById("site-header");
    if (!header) return;

    var ticking = false;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
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

  function init() {
    initReadProgress();
    initHeader();
    initReveal();
    initShotFallback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
