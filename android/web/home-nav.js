// 桌面导航：5 列 × 2 行；左右越过行边缘时翻页，空位不获得选择。
(() => {
  const pages = document.getElementById("pages"), COLS = 5, PER = 10;
  let selected = null, active = false;
  const cells = () => Array.from(pages.querySelectorAll(".cell[data-pkg]"));
  const pageAt = () => Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
  function paint(c) {
    pages.querySelectorAll(".selected").forEach(x => {
      x.classList.remove("selected"); x.setAttribute("aria-selected", "false");
    });
    selected = c;
    if (active && c) { c.classList.add("selected"); c.setAttribute("aria-selected", "true"); }
  }
  function select(c, scroll = false) {
    paint(c);
    if (scroll && c) {
      const p = Array.from(pages.children).indexOf(c.parentElement);
      // 立即定位：长按连续导航时不受滚动动画的中间页影响。
      pages.scrollTo({left: p * pages.clientWidth, behavior: "instant"});
    }
  }
  function sync() {
    const all = cells(), start = pageAt() * PER;
    if (!selected || !selected.isConnected || !all.slice(start, start + PER).includes(selected)) {
      select(all[start] || null);
    }
  }
  window.homeNav = {
    move(dir) {
      const all = cells(); if (!all.length) return;
      active = true; sync();
      const i = all.indexOf(selected); if (i < 0) return;
      const p = Math.floor(i / PER), slot = i % PER, row = Math.floor(slot / COLS), col = slot % COLS;
      let target = i;
      if (dir === "up" && row > 0) target = i - COLS;
      if (dir === "down" && row === 0 && all[i + COLS]) target = i + COLS;
      if (dir === "left" || dir === "right") {
        const delta = dir === "left" ? -1 : 1;
        const start = p * PER + row * COLS;
        const end = Math.min(start + COLS, all.length) - 1;
        if ((delta < 0 && col > 0) || (delta > 0 && i < end)) target = i + delta;
        else {
          const np = p + delta;
          if (np >= 0 && np * PER < all.length) {
            const first = np * PER, last = Math.min(first + PER, all.length) - 1;
            const rowStart = first + row * COLS;
            // 下一页没有这一行时，落到它唯一的一行。
            const base = rowStart <= last ? rowStart : first;
            target = delta > 0 ? base : Math.min(base + COLS - 1, last);
          }
        }
      }
      select(all[target], true);
    },
    open() {
      active = true; sync(); paint(selected);
      if (selected) window.DuoHome.launch(selected.dataset.pkg);
    },
    refresh() { sync(); paint(selected); }
  };
  pages.addEventListener("scroll", sync, {passive:true});
  window.addEventListener("resize", () => { if (selected) select(selected, true); });
  pages.addEventListener("pointerdown", e => {
    const c = e.target.closest(".cell[data-pkg]");
    active = false; paint(c || selected);
  });
  document.addEventListener("keydown", e => {
    const dir = {ArrowLeft:"left", ArrowRight:"right", ArrowUp:"up", ArrowDown:"down"}[e.key];
    if (dir) { e.preventDefault(); window.homeNav.move(dir); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!e.repeat) window.homeNav.open(); }
  });
})();
