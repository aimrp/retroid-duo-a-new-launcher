// 排序只保存包名；应用列表以系统为准，新应用追加，未安装的保留位置供重装恢复。
(() => {
  const KEY = "duo.home.order.v1", PER = 10, HOLD = 550;
  const pages = document.getElementById("pages");
  let apps = [], gesture = null, edgeTimer = null, edgeDir = 0;
  let onChange = () => {}, hint = null;
  function readOrder() {
    try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? [...new Set(a.filter(x => typeof x === "string"))] : []; }
    catch (_) { return []; }
  }
  function ordered(list) {
    const order = readOrder(), known = new Set(order);
    // 已有自定义顺序时，新装应用按出现顺序固定追加。
    if (order.length) {
      const added = list.map(a => a.pkg).filter(pkg => !known.has(pkg));
      if (added.length) { order.push(...added); try { localStorage.setItem(KEY, JSON.stringify(order)); } catch (_) {} }
    }
    const rank = new Map(order.map((pkg, i) => [pkg, i]));
    return list.slice().sort((a,b) => (rank.get(a.pkg) ?? Infinity) - (rank.get(b.pkg) ?? Infinity));
  }
  function save() {
    try {
      const current = apps.map(a => a.pkg), present = new Set(current);
      const previous = readOrder(), merged = [], remaining = current.slice();
      // 缺席的包名保留原来的槽位，其余槽位按新排序填入。
      for (const pkg of previous) {
        if (!present.has(pkg)) merged.push(pkg);
        else if (remaining.length) merged.push(remaining.shift());
      }
      localStorage.setItem(KEY, JSON.stringify(merged.concat(remaining)));
      return true;
    } catch (_) { return false; }
  }
  function setHint(text) { if (hint) hint.textContent = text; }
  function stopEdge() { clearTimeout(edgeTimer); edgeTimer = null; edgeDir = 0; }
  function currentPage() { return Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth)); }
  function showPage(p) { pages.scrollTo({left:p * pages.clientWidth, behavior:"instant"}); }
  function cleanup() {
    if (!gesture) return;
    clearTimeout(gesture.timer); stopEdge();
    if (gesture.ghost) gesture.ghost.remove();
    pages.querySelectorAll(".down,.drag-source,.drop-target").forEach(el => el.classList.remove("down","drag-source","drop-target"));
    if (pages.hasPointerCapture && pages.hasPointerCapture(gesture.id)) pages.releasePointerCapture(gesture.id);
    gesture = null;
    setHint("摇杆选择 · A 打开 · 长按拖动排序");
  }
  function positionGhost() {
    if (!gesture || !gesture.ghost) return;
    gesture.ghost.style.left = gesture.x + "px";
    gesture.ghost.style.top = gesture.y + "px";
  }
  function targetAtPoint() {
    if (!gesture || !gesture.dragging) return;
    pages.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));
    const rect = pages.getBoundingClientRect(), x = gesture.x, y = gesture.y;
    gesture.target = null;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) { stopEdge(); return; }
    const el = document.elementFromPoint(x,y), cell = el && el.closest(".cell[data-index]");
    if (cell && pages.contains(cell)) {
      gesture.target = Math.min(Number(cell.dataset.index), apps.length - 1);
      cell.classList.add("drop-target");
    }
    const margin = Math.min(38, rect.width * .08);
    const dir = x < rect.left + margin ? -1 : x > rect.right - margin ? 1 : 0;
    const next = currentPage() + dir;
    if (!dir || next < 0 || next >= pages.children.length) { stopEdge(); return; }
    if (edgeDir !== dir) {
      stopEdge(); edgeDir = dir;
      edgeTimer = setTimeout(function turn() {
        if (!gesture || !gesture.dragging) return;
        const n = currentPage() + edgeDir;
        if (n < 0 || n >= pages.children.length) { stopEdge(); return; }
        showPage(n);
        // 给滚动布局一帧，再更新落点；停在边缘可连续翻页。
        requestAnimationFrame(() => { if (gesture && gesture.dragging) targetAtPoint(); });
        if (edgeDir) edgeTimer = setTimeout(turn, 700);
      }, 650);
    }
  }
  function startDrag() {
    if (!gesture || gesture.scrolling || !gesture.cell.isConnected) return;
    gesture.dragging = true;
    gesture.cell.classList.remove("down"); gesture.cell.classList.add("drag-source");
    const ghost = gesture.cell.cloneNode(true);
    ghost.className = "drag-ghost"; ghost.removeAttribute("data-pkg"); ghost.removeAttribute("data-index");
    document.body.appendChild(ghost); gesture.ghost = ghost;
    positionGhost(); setHint("拖动到目标位置松开 · 靠边翻页"); targetAtPoint();
  }
  function down(e) {
    if (gesture || !e.isPrimary || e.button !== 0) return;
    const cell = e.target.closest(".cell[data-pkg]");
    gesture = {id:e.pointerId, cell, pkg:cell ? cell.dataset.pkg : null, x:e.clientX, y:e.clientY,
      startX:e.clientX, startY:e.clientY, startScroll:pages.scrollLeft, dragging:false, scrolling:false, target:null};
    if (cell) cell.classList.add("down");
    pages.setPointerCapture(e.pointerId);
    if (cell) gesture.timer = setTimeout(startDrag, HOLD);
  }
  function move(e) {
    if (!gesture || gesture.id !== e.pointerId) return;
    gesture.x=e.clientX; gesture.y=e.clientY;
    const dx=e.clientX-gesture.startX, dy=e.clientY-gesture.startY;
    if (!gesture.dragging && (Math.abs(dx)>12 || Math.abs(dy)>12)) {
      clearTimeout(gesture.timer); if (gesture.cell) gesture.cell.classList.remove("down"); gesture.scrolling=true;
    }
    if (gesture.dragging) { e.preventDefault(); positionGhost(); targetAtPoint(); }
    else if (gesture.scrolling) { e.preventDefault(); pages.scrollLeft=gesture.startScroll-dx; }
  }
  function up(e) {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g=gesture;
    if (g.dragging) {
      targetAtPoint();
      const from=apps.findIndex(a=>a.pkg===g.pkg), to=g.target;
      if (from>=0 && to!=null && from!==to) {
        const [a]=apps.splice(from,1); apps.splice(to,0,a);
        const saved=save(); cleanup(); onChange(apps.slice());
        if (!saved) setHint("排序未能保存，请检查存储空间");
        return;
      }
    } else if (g.scrolling) {
      const dx=e.clientX-g.startX, pageWidth=pages.clientWidth;
      const start=Math.round(g.startScroll/Math.max(1,pageWidth));
      const page=Math.max(0,Math.min(pages.children.length-1, start+(Math.abs(dx)>pageWidth*.15 ? (dx<0 ? 1 : -1) : 0)));
      cleanup(); showPage(page); return;
    } else {
      const pkg=g.pkg, el=document.elementFromPoint(e.clientX,e.clientY);
      const c=el && el.closest(".cell[data-pkg]");
      const tap=c===g.cell && Math.abs(e.clientX-g.startX)<=12 && Math.abs(e.clientY-g.startY)<=12;
      cleanup(); if (pkg && tap) window.DuoHome.launch(pkg); return;
    }
    cleanup();
  }
  pages.addEventListener("pointerdown", down);
  pages.addEventListener("pointermove", move);
  pages.addEventListener("pointerup", up);
  pages.addEventListener("pointercancel", e => { if (gesture && e.pointerId===gesture.id) cleanup(); });
  pages.addEventListener("lostpointercapture", e => { if (gesture && e.pointerId===gesture.id) cleanup(); });
  window.addEventListener("blur", cleanup);
  document.addEventListener("visibilitychange", () => { if (document.hidden) cleanup(); });
  window.homeOrder = {
    init(callback, hintEl) { onChange=callback; hint=hintEl; },
    update(list) { cleanup(); apps=ordered(list); return apps.slice(); },
    isDragging() { return !!(gesture && gesture.dragging); }
  };
})();
