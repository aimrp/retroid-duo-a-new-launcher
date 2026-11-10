/* STOP · The Stompers · 上屏：主游戏、开场动画、标题、选角、结算。游戏状态由上屏主导，下屏只显示与点选。 */
(function () {
  'use strict';
  const SH = window.SH, ART = window.ART, AU = window.AUDIO, IN = window.INPUT, LINK = window.LINK;
  const W = 320, H = 180;
  const TITLE = window.SH_TITLE;
  const cv = document.getElementById('c'), cx = cv.getContext('2d');
  const lo = document.createElement('canvas'); lo.width = W; lo.height = H;
  const lx = lo.getContext('2d');
  const FONT = '"Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","PingFang SC",sans-serif';
  let S = 6, OX = 0, OY = 0, DRAW = true;
  let LANG = (window.I18N && I18N.get()) || 'zh';

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    S = Math.min(cv.width / W, cv.height / H);
    const si = Math.floor(S); if (si >= 1 && S - si < 0.3) S = si;
    OX = Math.floor((cv.width - W * S) / 2); OY = Math.floor((cv.height - H * S) / 2);
  }
  addEventListener('resize', resize); resize();

  // ---------- 文字（高清层，坐标用逻辑像素） ----------
  function txt(s, x, y, size, color, align, opts) {
    if (!DRAW) return;
    opts = opts || {};
    if (!opts.raw) s = I18N.tr(s, LANG);
    cx.font = `${opts.weight || 900} ${Math.round(size * S)}px ${opts.font || FONT}`;
    const maxW = (opts.maxW || 312) * S, tw = cx.measureText(s).width;
    if (tw > maxW) cx.font = `${opts.weight || 900} ${Math.floor(size * S * maxW / tw)}px ${opts.font || FONT}`;
    cx.textAlign = align || 'left'; cx.textBaseline = 'middle';
    const X = OX + x * S, Y = OY + y * S;
    if (opts.shadow !== false) { cx.fillStyle = opts.shadowColor || '#1a1426'; cx.fillText(s, X + S * 0.8, Y + S * 0.8); }
    if (opts.stroke) { cx.lineWidth = S * 1.2; cx.strokeStyle = opts.stroke; cx.strokeText(s, X, Y); }
    cx.fillStyle = color || '#fff'; cx.fillText(s, X, Y);
  }
  // 像素化文字（画在低清层，阈值化 → 真像素字）
  const ptCache = {};
  function pixelText(s, size, color, outline) {
    const key = s + size + color + outline;
    if (ptCache[key]) return ptCache[key];
    const t = document.createElement('canvas'), tx = t.getContext('2d');
    tx.font = `900 ${size}px ${FONT}`;
    const w = Math.ceil(tx.measureText(s).width) + 4, h = Math.ceil(size * 1.3) + 4;
    t.width = w; t.height = h;
    tx.font = `900 ${size}px ${FONT}`; tx.textBaseline = 'top'; tx.fillStyle = '#000'; tx.fillText(s, 2, 2);
    const id = tx.getImageData(0, 0, w, h), o = document.createElement('canvas'); o.width = w + 2; o.height = h + 2;
    const ox2 = o.getContext('2d'), mask = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (id.data[(j * w + i) * 4 + 3] > 110) mask.push([i, j]);
    if (outline) { ox2.fillStyle = outline; for (const [i, j] of mask) ox2.fillRect(i, j, 3, 3); }
    ox2.fillStyle = color; for (const [i, j] of mask) ox2.fillRect(i + 1, j + 1, 1, 1);
    return (ptCache[key] = o);
  }

  // ---------- 场景背景 ----------
  function hillY(x, seed, amp, base) { return base - Math.abs(Math.sin((x + seed) / 37)) * amp - Math.abs(Math.sin((x + seed * 2) / 19)) * amp * 0.35; }
  let bgCache = null;
  function buildBG(noCastle) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#6cc4ff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#8fd6ff'; g.fillRect(0, 70, W, 40);
    g.fillStyle = '#b4e6ff'; g.fillRect(0, 110, W, 50);
    // 远山（原创：圆顶双色）
    for (let x = 0; x < W; x++) {
      const y1 = Math.round(hillY(x, 11, 30, 140));
      g.fillStyle = '#7dc26a'; g.fillRect(x, y1, 1, H - y1);
      g.fillStyle = '#5aa64f'; g.fillRect(x, y1, 1, 1);
    }
    for (let x = 0; x < W; x++) {
      const y2 = Math.round(hillY(x, 83, 18, 156));
      g.fillStyle = '#4fae4a'; g.fillRect(x, y2, 1, H - y2);
      g.fillStyle = '#2f7f33'; g.fillRect(x, y2, 1, 1);
      if ((x * 7) % 23 === 0) { g.fillStyle = '#9be36a'; g.fillRect(x, y2 + 3, 1, 2); }
    }
    if (!noCastle) {
    // 城墙（右侧，大门在 304）
    g.fillStyle = '#6d6d86'; g.fillRect(292, 40, 28, 116);
    g.fillStyle = '#55556a';
    for (let y = 40; y < 156; y += 8) for (let x = 292 + ((y / 8) % 2) * 6; x < 320; x += 12) g.fillRect(x, y, 1, 8);
    for (let y = 40; y < 156; y += 8) g.fillRect(292, y, 28, 1);
    g.fillStyle = '#6d6d86'; for (let x = 292; x < 320; x += 8) g.fillRect(x, 34, 5, 6);
    g.fillStyle = '#1a1426'; g.fillRect(291, 34, 1, 122);
    // 旗帜
    g.fillStyle = '#1a1426'; g.fillRect(305, 14, 1, 20);
    g.fillStyle = '#2fb38c'; g.fillRect(306, 14, 10, 7); g.fillStyle = '#f4e2ad'; g.fillRect(309, 16, 4, 3);
    }
    // 灌木
    for (const bx of [58, 150, 236]) {
      for (let i = 0; i < 26; i++) {
        const hh = Math.round(7 + Math.sin(i / 3.2) * 4);
        g.fillStyle = '#2f9c45'; g.fillRect(bx + i, 156 - hh, 1, hh);
        g.fillStyle = '#1d6b2f'; g.fillRect(bx + i, 156 - hh, 1, 1);
      }
    }
    return c;
  }
  const clouds = [{ x: 30, y: 22, s: 1 }, { x: 140, y: 12, s: 1.4 }, { x: 230, y: 30, s: 0.9 }, { x: 290, y: 8, s: 1.2 }];
  function drawCloud(x, y, s) {
    const r = [[0, 4, 18], [3, 1, 12], [7, -2, 7]];
    lx.fillStyle = '#ffffff';
    for (const [dx, dy, w] of r) lx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), Math.round(w * s), Math.round(6 * s));
    lx.fillStyle = '#d6f0ff'; lx.fillRect(Math.round(x), Math.round(y + 9 * s), Math.round(18 * s), 1);
  }
  function buildCave() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0f0d1f'); gr.addColorStop(1, '#2a2445');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let y = 24; y < 168; y += 12) for (let x = ((y / 12) % 2) * 10 - 10; x < W; x += 20) {
      g.fillStyle = ((x * 7 + y * 3) % 5 === 0) ? '#2b2747' : '#221e3a'; g.fillRect(x + 1, y + 1, 18, 10);
    }
    for (const ax of [56, 164, 244]) { // 拱门
      g.fillStyle = '#100d1e'; g.fillRect(ax, 104, 36, 64);
      for (let dx = 0; dx < 36; dx++) { const h = Math.round(Math.sqrt(Math.max(0, 324 - (dx - 17.5) * (dx - 17.5)))); g.fillRect(ax + dx, 104 - h, 1, h); }
    }
    for (let i = 0; i < 15; i++) { // 钟乳石（挂在天花板下面）
      const x = (i * 29 + 7) % W, L = 6 + (i * 13) % 14;
      if (x < 54 || x > 286) continue;
      for (let j = 0; j < L; j++) { const w = Math.max(1, Math.round((L - j) / L * 5)); g.fillStyle = j < 2 ? '#3d3660' : '#332d52'; g.fillRect(x - Math.floor(w / 2), 24 + j, w, 1); }
    }
    for (const [x, y] of [[30, 40], [120, 30], [214, 46], [270, 34], [100, 146], [236, 150]]) { // 水晶
      g.fillStyle = 'rgba(94,224,255,0.16)'; g.fillRect(x - 4, y - 3, 10, 10);
      g.fillStyle = '#5ee0ff'; g.fillRect(x, y, 2, 4); g.fillRect(x - 1, y + 1, 4, 2);
    }
    // 天花板上面那道缝（又黑又窄），左边一直通到底
    g.fillStyle = '#07060f'; g.fillRect(0, 0, 292, 16); g.fillRect(0, 16, 48, 8);
    g.fillStyle = '#15122a'; for (let x = 0; x < 292; x += 9) g.fillRect(x, 0, 5, 1 + (x * 7) % 3);
    g.fillStyle = '#3a3458'; g.fillRect(292, 0, 28, 168); // 右侧石墙
    g.fillStyle = '#2a2445'; for (let y = 0; y < 168; y += 8) g.fillRect(292, y, 28, 1);
    g.fillStyle = '#1a1426'; g.fillRect(291, 16, 1, 152);
    g.fillStyle = '#07060f'; g.fillRect(292, 0, 12, 16); // 城墙上的通道口（勇者从天花板上走进去）
    g.fillStyle = '#1a1426'; g.fillRect(304, 0, 1, 16); g.fillRect(292, 16, 13, 1);
    return c;
  }
  function buildWall() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#2b1d4f'); gr.addColorStop(0.5, '#b04a6a'); gr.addColorStop(0.8, '#f08a50'); gr.addColorStop(1, '#f7c46a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let r = 24; r > 0; r -= 2) { g.fillStyle = r > 18 ? 'rgba(255,214,120,0.25)' : '#ffd27a'; g.beginPath(); g.arc(92, 118, r, 0, Math.PI * 2); g.fill(); }
    for (const [x, w, h] of [[14, 18, 58], [44, 12, 40], [150, 22, 70], [184, 14, 46], [236, 20, 62]]) { // 远处塔楼
      g.fillStyle = '#4a2c55'; g.fillRect(x, 156 - h, w, h);
      for (let i = 0; i < w; i += 6) g.fillRect(x + i, 152 - h, 3, 4);
    }
    g.fillStyle = '#6d6d86'; g.fillRect(0, 122, 292, 34); // 近处城墙
    for (let x = 0; x < 292; x += 12) g.fillRect(x, 114, 7, 8);
    g.fillStyle = '#55556a';
    for (let y = 122; y < 156; y += 8) { g.fillRect(0, y, 292, 1); for (let x = ((y - 122) / 8 % 2) * 6; x < 292; x += 12) g.fillRect(x, y, 1, 8); }
    g.fillStyle = '#6d6d86'; g.fillRect(292, 40, 28, 116); // 右侧塔
    g.fillStyle = '#55556a'; for (let y = 40; y < 156; y += 8) g.fillRect(292, y, 28, 1);
    g.fillStyle = '#6d6d86'; for (let x = 292; x < 320; x += 8) g.fillRect(x, 34, 5, 6);
    g.fillStyle = '#1a1426'; g.fillRect(291, 34, 1, 122); g.fillRect(305, 14, 1, 20);
    g.fillStyle = '#d83b2b'; g.fillRect(306, 14, 10, 7); g.fillStyle = '#ffb347'; g.fillRect(309, 16, 4, 3);
    return c;
  }
  const BGS = {};
  function getBG(id) {
    id = id || 'grass';
    if (!BGS[id]) BGS[id] = id === 'cave' ? buildCave() : id === 'wall' ? buildWall() : (bgCache = bgCache || buildBG());
    return BGS[id];
  }
  function drawBackground(t, id) {
    lx.drawImage(getBG(id), 0, 0);
    if (id !== 'cave') for (const c of clouds) drawCloud(((c.x + t * 0.05 * c.s) % 360) - 30, c.y, c.s);
  }

  function spr(name, x, y, flip, pal, flipV) {
    const c = ART.mk(name, pal, flip);
    if (flipV) { lx.save(); lx.translate(0, Math.round(y) * 2 + c.height); lx.scale(1, -1); lx.drawImage(c, Math.round(x), Math.round(y)); lx.restore(); }
    else lx.drawImage(c, Math.round(x), Math.round(y));
  }

  const SOLID_PAL = {
    cave: { ground: { v: '#6f8aa8', t: '#4a5f7a', T: '#2c3a50', c: '#4a4a66', C: '#2e2e44', d: '#66668a' }, brick: { c: '#5a6f8c', C: '#34425a', d: '#8aa0c0' } },
    wall: { ground: { v: '#b9b9c8', t: '#8c8ca0', T: '#5f5f75', c: '#7d6a5a', C: '#4f4036', d: '#a08870' }, brick: { c: '#8c8ca0', C: '#55556a', d: '#b9b9c8' } },
  };
  function drawSolids(st) {
    const SP = SOLID_PAL[st.level && st.level.id] || {};
    for (const s of st.solids) {
      const by = s.bump > 0 ? -Math.round(Math.sin((8 - s.bump) / 8 * Math.PI) * 4) : 0;
      if (s.kind === 'ground') {
        for (let x = 0; x < W; x += 16) { spr('ground', x, s.y, false, SP.ground); lx.drawImage(ART.mk('ground', SP.ground), 0, 5, 16, 11, x, s.y + 16, 16, 11); }
      } else if (s.kind === 'brick') spr('brick', s.x, s.y + by, false, SP.brick);
      else if (s.kind === 'q') spr(s.active ? 'qblock' : 'qused', s.x, s.y + by);
      else if (s.kind === 'pipe') {
        for (let y = s.y + 8; y < s.y + s.h; y += 2) spr('pipeBody', s.x, y);
        spr('pipeTop', s.x, s.y);
      } else if (s.kind === 'gate') spr('gate', 304, ((st.level && st.level.groundY) || 156) - 52);
      else if (s.kind === 'ceil') { // 天花板：一排半高的石砖
        const im = ART.mk('brick', SP.brick);
        for (let x = s.x; x < s.x + s.w; x += 16) { const w = Math.min(16, s.x + s.w - x); lx.drawImage(im, 0, 0, w, s.h, x, s.y, w, s.h); }
        lx.fillStyle = '#1a1426'; lx.fillRect(s.x, s.y + s.h - 1, s.w, 1); lx.fillRect(s.x, s.y, 1, s.h);
      }
    }
  }

  function heroSprite(h, tick) {
    const big = h.tier > 0 && !(h.grow > 0 && (h.grow >> 2) % 2);
    const p = big ? 'heroB_' : 'heroS_';
    if (h.dead) return 'heroS_dead';
    if (!h.onGround && !h.emerging) return p + 'jump';
    if (Math.abs(h.vx) > 0.3 && (h.anim >> 2) % 2) return p + 'run';
    return p + 'stand';
  }
  function drawHero(h, tick, st) {
    if (h.inv > 0 && !h.emerging && (tick >> 2) % 2 && !h.dead) return;
    const name = heroSprite(h, tick), c = ART.S[name];
    const sh = c.length, x = h.x - 1, y = h.y + h.h - sh;
    let pal = h.tier === 2 ? ART.firePal : null;
    if (h.star > 0 && !h.dead && (h.star > 120 || (tick >> 2) % 2)) pal = ART.rainbow[(tick >> 2) % ART.rainbow.length];
    if (h.prop && !h.dead) { // 头顶螺旋桨
      const px = Math.round(x + 6), py = Math.round(y - 2), ph = (tick >> 1) % 4, wv = [6, 3, 1, 3][ph];
      lx.fillStyle = '#1a1426'; lx.fillRect(px - 1, py - 1, 2, 3);
      lx.fillStyle = '#7dffb0'; lx.fillRect(px - wv, py - 2, wv * 2, 1);
    }
    if (h.emerging > 0 && st) {
      const pipe = st.solids.find(s => s.kind === 'pipe');
      lx.save(); lx.beginPath(); lx.rect(0, 0, W, pipe.y); lx.clip();
      spr(name, x, y, h.face < 0, pal); lx.restore();
    } else spr(name, x, y, h.face < 0, pal);
  }
  function drawDefender(d, tick, plain) {
    if (d.inv > 0 && !d.dead && (tick >> 2) % 2 && d.squash <= 0) return;
    const K = ART.KINDS[d.kind || 'turtle'];
    const flip = K.faceLeft ? d.face > 0 : d.face < 0;
    const place = (name, flipV) => { const c = ART.S[name]; spr(name, Math.round(d.x + d.w / 2 - c[0].length / 2), Math.round(d.y + d.h - c.length), flip, null, flipV); };
    if (d.dash > 0) { spr((tick >> 1) % 2 ? 'spin1' : 'spin2', Math.round(d.x + d.w / 2 - 8), d.y + d.h - 12, d.face < 0, K.fx); return; }
    if (d.dead) { place(K.hurt, true); return; }
    const P = plain && K.plain;
    let name;
    if (d.squash > 0) name = plain && K.plainHurt ? K.plainHurt : K.hurt;
    else if (!d.onGround) name = P || K.jump;
    else if (Math.abs(d.vx) > 0.2 && (d.anim >> 3) % 2) name = P || K.walk2;
    else name = P || K.walk1;
    place(name);
  }

  function drawWorld(st, t) {
    const K = ART.KINDS[st.def.kind] || ART.KINDS.turtle;
    drawBackground(t, st.level && st.level.id);
    drawSolids(st);
    for (const it of st.items) {
      const k = it.type || 'grow', yy = it.y + (it.rise > 0 || k === 'star' ? 0 : Math.round(Math.sin(it.life / 6)));
      if (k === 'star') spr('starItem', it.x, yy, false, (it.life >> 2) % 2 ? null : ART.starFlash);
      else if (k === 'prop') spr('propItem', it.x, yy);
      else if (k === 'life') spr('item', it.x, yy, false, ART.lifePal);
      else spr('item', it.x, yy);
    }
    if (st.phase !== 'defeat') drawHero(st.hero, st.tick, st);
    for (const m of st.minions) {
      if (m.dead) { if (m.flip) spr('beetle1', m.x, m.y + m.dead * 1.5, false, K.minionPal, true); else spr('beetle_flat', m.x, m.y, false, K.minionPal); }
      else spr((m.anim >> 3) % 2 ? 'beetle1' : 'beetle2', m.x, m.y - 1, m.vx < 0, K.minionPal);
    }
    for (const s of st.shells) {
      if (s.fire) { spr((st.tick >> 2) % 2 ? 'dfire1' : 'dfire2', s.x, s.y, s.vx < 0); continue; }
      const pal = s.state === 'kicked' ? ART.kicked : K.fx;
      const n = s.state === 'still' ? 'shell1' : ((st.tick >> 2) % 2 ? 'shell1' : 'shell2');
      if (s.state === 'still' && s.life > TUNE().shell.stillLife - 60 && (st.tick >> 2) % 2) continue;
      spr(n, s.x, s.y, false, pal);
    }
    drawDefender(st.def, st.tick);
    if (st.phase === 'defeat') drawHero(st.hero, st.tick, st);
    for (const f of st.fireballs) spr((st.tick >> 2) % 2 ? 'fire1' : 'fire2', f.x, f.y);
    for (const f of st.fx) drawFx(f);
  }
  function TUNE() { return SH.TUNE; }
  function drawFx(f) {
    const k = f.t / f.life;
    if (f.kind === 'puff') {
      lx.fillStyle = `rgba(255,255,255,${1 - k})`;
      const r = 2 + k * 8;
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; lx.fillRect(Math.round(f.x + Math.cos(a) * r) - 1, Math.round(f.y + Math.sin(a) * r * 0.6) - 1, 3, 3); }
    } else if (f.kind === 'star') {
      lx.fillStyle = (f.t >> 1) % 2 ? '#ffe066' : '#ffffff';
      const r = 4 + k * 12;
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; const X = Math.round(f.x + Math.cos(a) * r), Y = Math.round(f.y + Math.sin(a) * r); lx.fillRect(X - 1, Y, 3, 1); lx.fillRect(X, Y - 1, 1, 3); }
    } else if (f.kind === 'spark') {
      lx.fillStyle = (f.t >> 1) % 2 ? '#ffd43b' : '#c7a6ff';
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + k * 3; lx.fillRect(Math.round(f.x + Math.cos(a) * k * 10), Math.round(f.y + Math.sin(a) * k * 10), 2, 2); }
    }
  }

  function blit(shake) {
    if (!DRAW) return;
    cx.imageSmoothingEnabled = false;
    cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
    let sx = 0, sy = 0;
    if (shake > 0) { sx = Math.round((Math.random() - 0.5) * shake) * S; sy = Math.round((Math.random() - 0.5) * shake) * S; }
    cx.drawImage(lo, OX + sx, OY + sy, W * S, H * S);
  }
  function dim(a) { lx.fillStyle = `rgba(10,8,24,${a})`; lx.fillRect(0, 0, W, H); }

  // ======================= 应用状态 =======================
  // 自动演示（录视频用）：APK 用 intent 参数 demo=<种子>，浏览器用 top.html?demo=<种子>。
  // 各画面自动往下走，守关者由机器人操作；同一个种子每次打出来的过程完全一样。
  const DEMO = (() => {
    try {
      const v = (window.GameBridge && window.GameBridge.demoSeed && window.GameBridge.demoSeed()) || new URLSearchParams(location.search).get('demo');
      if (v === 'ending') return { seed: 45, ending: true }; // 直接看结局
      if (v === 'cutscenes') return { seed: 45, cutscenes: true, manual: true }; // 过场预览
      return v ? { seed: +v || 45 } : null;
    } catch (e) { return null; }
  })();
  if (DEMO) AU.init();
  const app = {
    scene: 'intro', langSel: LANG, t: 0, diff: localStorage.getItem('sh_diff') || 'normal', menu: 0, smenu: 0, sel: 0,
    level: 0, runSecs: 0, retry: 0, game: null, attract: null, paused: false, pmenu: 0, floats: [], shake: 0, result: null, tipT: 0, stats: null,
  };
  const DIFFS = ['easy', 'normal', 'hard'], DIFF_CN = { easy: '简单', normal: '普通', hard: '困难' };
  const PMENU = ['继续', '重新开始', 'A/B 键对调', 'X/Y 键对调', '音乐', '回到标题', '退出游戏'];
  // 退出到掌机桌面（APK 里由原生层关掉上下两屏并回到系统桌面）
  function exitGame() { AU.stop(); if (window.GameBridge && window.GameBridge.exit) window.GameBridge.exit(); else go('intro'); }

  function startRun() { app.preview = false; app.level = 0; app.runSecs = 0; app.retry = 0; app.lines = []; app.beaten = 0; go('levelIntro'); }
  // 过场预览：假装三关都守住了，依次播 第一关挖地道 → 第二关飞天花板 → 三关全胜结局（设置里进，或 demo=cutscenes）
  function previewCleared(level) {
    app.level = level; app.retry = 0;
    const g = SH.createGame({ level, seed: 7 + level, difficulty: 'normal' });
    g.phase = 'victory'; g.phaseT = 0; g.tick = (38 + level * 9) * 60; g.def.hp = 3 - level % 2;
    app.game = g; app.result = { win: true, secs: Math.round(g.tick / 60), hp: g.def.hp, stats: g.stats, defX: g.def.x };
    app.lines[level] = 'held'; app.beaten += 3;
    AU.stop(); AU.sfx('victory'); go('cleared');
  }
  function startPreview() { AU.init(); app.preview = true; app.runSecs = 0; app.lines = []; app.beaten = 0; previewCleared(0); }
  function go(scene) {
    app.scene = scene; app.t = 0;
    if (scene === 'title') { AU.play('title'); app.attract = null; app.menu = 0; app.preview = false; }
    if (scene === 'lang') { app.langSel = LANG; app.smenu = 0; }
    if (scene === 'levelIntro') {
      const lv = SH.LEVELS[app.level];
      app.game = SH.createGame({ level: app.level, seed: DEMO ? DEMO.seed + app.level * 101 + app.retry * 7 : (Date.now() & 0xffff) + 1, difficulty: 'normal' });
      app.floats = []; AU.play(lv.id === 'cave' ? 'cave' : lv.id === 'wall' ? 'wall' : 'grass');
    }
    if (scene === 'play') { app.paused = false; }
    if (scene === 'ending') {
      AU.stop(); app.endMusic = false; app.endDone = 0; app.leaving = 0;
      const all = heldCount() >= 3;
      NARR[4][2] = all ? '我们守住了每一次。' : '我们没能守住每一次，可最后这一道，我们守住了。';
      NARR[4][3] = all ? 'We held the line. Every single time.' : "We didn't hold every line. But we held the last one.";
    }
  }

  // ---------- 开场动画 ----------
  const INTRO = {
    l0: '大王掳走了公主，命我们三个守住城门。',
    l0en: 'The Demon King took the princess. We three were told to guard the gate.',
    l1: '谁说我们天生就是配角？',
    l1en: "Who says we're born to be supporting characters?",
    l2: '这一次，我们三个，也要当一回主角。',
    l2en: 'This time, the three of us get to be the main characters too.',
  };
  const IT = { stomp: 70, dark: 150, l0: 155, l1: 300, up: 330, band: 372, l2: 440, logo: 610, end: 820 };
  function introActors(t) {
    // 勇者
    const h = { x: 0, y: 0, w: 10, h: 14, vx: 2.6, face: 1, onGround: true, tier: 0, anim: t, inv: 0, emerging: 0 };
    const tx = 172 - 0.4 * Math.min(t, IT.stomp);
    if (t < 34) { h.x = -12 + 2.6 * t; h.y = 142; }
    else if (t < IT.stomp) { const u = t - 34; h.x = -12 + 2.6 * t; h.y = 142 - (5.84 * u - 0.15 * u * u); h.onGround = false; }
    else { const u = t - IT.stomp; h.x = -12 + 2.6 * IT.stomp + 2.4 * u; const yy = 126 - (4.2 * u - 0.15 * u * u); h.y = Math.min(142, yy); h.onGround = yy >= 142; }
    const d = { x: tx - 7, y: 140, w: 14, h: 16, vx: t < IT.stomp ? -0.4 : 0, face: -1, onGround: true, anim: t, inv: 0, squash: 0, dash: 0, dead: false };
    if (t >= IT.stomp && t < IT.up) d.squash = 1;
    if (t >= IT.up) { d.face = 1; const u = t - IT.up; if (u < 24) { d.y = 140 - (3 * u - 0.25 * u * u > 0 ? 3 * u - 0.25 * u * u : 0); d.onGround = d.y >= 140; } }
    return { h, d };
  }
  function typed(s, t0, t, speed) {
    s = I18N.tr(s, LANG); speed = (speed || 4) * (LANG === 'en' ? 0.4 : 1);
    const n = Math.max(0, Math.floor((t - t0) / speed)); return s.slice(0, n);
  }
  // 标题字：中文版用中文长名做大字；英文版保留代码里的 STOP / 副名，下面加 NPCs Strike Back
  function titleArt(y, t0) {
    if (LANG === 'en') {
      const L1 = pixelText(TITLE.main, 30, '#ffe066', '#1a1426'), L2 = pixelText(TITLE.sub, 20, '#ffffff', '#1a1426');
      lx.drawImage(L1, Math.round(W / 2 - L1.width / 2), Math.round(y));
      if (t0 > 10) lx.drawImage(L2, Math.round(W / 2 - L2.width / 2), Math.round(y + 38));
    } else {
      const L1 = pixelText(TITLE.cn, 18, '#ffffff', '#1a1426'), L2 = pixelText('进击的 NPC', 30, '#ffe066', '#1a1426');
      lx.drawImage(L1, Math.round(W / 2 - L1.width / 2), Math.round(y + 2));
      if (t0 > 10) lx.drawImage(L2, Math.round(W / 2 - L2.width / 2), Math.round(y + 28));
    }
    if (t0 > 22) { lx.fillStyle = '#e0344c'; lx.fillRect(Math.round(W / 2 - 60), Math.round(y + 64), 120, 3); }
  }
  function titleSub(y) { if (LANG === 'en') txt('NPCs Strike Back', 160, y, 10, '#ffffff', 'center', { raw: true }); }

  // ---------- 设置（语言 / 音乐 / 返回）；从标题进入，默认中文 ----------
  function setLang(l) { LANG = l; I18N.set(l); }
  function cycleLang() { app.langSel = app.langSel === 'zh' ? 'en' : 'zh'; setLang(app.langSel); }
  function sceneLang(inp) {
    if (inp.pressed.B) { AU.init(); AU.sfx('select'); go('title'); return; }
    if (inp.pressed.up || inp.pressed.down) { app.smenu = (app.smenu + (inp.pressed.up ? 2 : 1)) % 3; AU.init(); AU.sfx('select'); }
    if (inp.pressed.left || inp.pressed.right || inp.pressed.A || inp.pressed.START) {
      if (app.smenu === 0) { cycleLang(); AU.sfx('select'); }
      else if (app.smenu === 1) { AU.toggleMusic(); AU.sfx('select'); }
      else { AU.init(); AU.sfx('confirm'); go('title'); return; }
    }
    drawBackground(app.t); dim(0.6); blit(0);
    txt('设置', 160, 26, 13, '#ffe066', 'center');
    const rows = [
      ['语言', app.langSel === 'zh' ? '中文' : 'English', 1],
      ['音乐', AU.musicOn ? '开' : '关', 0],
      ['返回标题', '', 0],
    ];
    rows.forEach((r, i) => {
      const y = 54 + i * 28, on = i === app.smenu;
      cx.fillStyle = on ? '#3b2f63' : '#2c2447';
      cx.fillRect(OX + 40 * S, OY + (y - 11) * S, 240 * S, 23 * S);
      cx.strokeStyle = on ? '#ffe066' : '#1a1426'; cx.lineWidth = S * 1.5;
      cx.strokeRect(OX + 40 * S, OY + (y - 11) * S, 240 * S, 23 * S);
      txt((on ? '▶ ' : '   ') + r[0], 52, y, 9, on ? '#ffe066' : '#ffffff');
      if (r[1]) txt(r[1], 268, y, 9, on ? '#ffe066' : '#cfe8ff', 'right', { raw: !!r[2] });
    });
    txt('上下选择 · 左右调整 · B 返回', 160, 158, 8, '#8a86a0', 'center');
  }

  function sceneIntro(inp) {
    const t = app.t;
    if (t > 20 && (inp.pressed.START || inp.pressed.A)) { AU.init(); go('title'); return; }
    if (t === IT.stomp) { AU.sfx('stomp'); app.shake = 4; }
    if (t === IT.band) AU.sfx('powerup');
    if (t === IT.logo) { AU.sfx('slam'); app.shake = 8; }
    if ((t > IT.l0 && t < IT.l0 + INTRO.l0.length * 4 || t > IT.l1 && t < IT.l1 + INTRO.l1.length * 4 || t > IT.l2 && t < IT.l2 + INTRO.l2.length * 4) && t % 4 === 0) AU.sfx('type');
    if (t >= IT.end) { go('title'); return; }
    drawBackground(t);
    const fake = { solids: SH.LEVELS[0].solids.filter(s => s.kind === 'ground' || s.kind === 'gate').map(s => Object.assign({ bump: 0 }, s)) };
    drawSolids(fake);
    const a = introActors(t);
    if (t >= IT.stomp - 1 && t < IT.stomp + 30) drawFx({ kind: 'star', x: a.d.x + 7, y: 140, t: t - IT.stomp + 1, life: 30 });
    if (t > IT.dark) dim(Math.min(0.62, (t - IT.dark) / 60));
    // 聚光
    if (t >= IT.up) {
      const r = Math.min(40, (t - IT.up) * 1.5);
      const gr = lx.createRadialGradient(a.d.x + 7, 148, 2, a.d.x + 7, 148, r);
      gr.addColorStop(0, 'rgba(255,240,180,0.55)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
      lx.fillStyle = gr; lx.fillRect(a.d.x - 40, 100, 94, 60);
    }
    drawDefender(a.d, t, t < IT.band);
    if (t >= IT.band && t < IT.band + 30) drawFx({ kind: 'spark', x: a.d.x + 12, y: 142, t: t - IT.band, life: 30 });
    if (a.h.x < W + 20) drawHero(a.h, t);
    if (t >= IT.logo) {
      const k = Math.min(1, (t - IT.logo) / 14);
      dim(0.25 * k);
      titleArt(-40 + k * 66, t - IT.logo);
    }
    blit(app.shake);
    if (t > IT.l0 && t < IT.logo) txt(typed(INTRO.l0, IT.l0, t), 160, 40, 8, '#cfe8ff', 'center', { weight: 700 });
    if (t > IT.l1 && t < IT.logo) txt(typed(INTRO.l1, IT.l1, t), 160, 62, 11, '#ffffff', 'center');
    if (t > IT.l2 && t < IT.logo) txt(typed(INTRO.l2, IT.l2, t), 160, 84, 11, '#ffe066', 'center');
    if (t > IT.logo + 30) { titleSub(118); txt(LANG === 'en' ? '进击的 NPC · 现在开始' : '现在开始', 160, 138, 9, '#ffffff', 'center'); }
  }

  // ---------- 标题 ----------
  function titleAction(i) {
    AU.init(); AU.sfx('confirm');
    if (i === 0) startRun();
    else if (i === 1) go('lang');
    else exitGame();
  }
  function sceneTitle(inp) {
    if (!app.attract || app.attract.phase === 'victory' && app.attract.phaseT > 120 || app.attract.phase === 'defeat' && app.attract.phaseT > 160) {
      app.attract = SH.createGame({ level: SH.LEVELS.length - 1, seed: (Math.random() * 1e9) | 0 }); app.attract.difficulty = 'normal';
    }
    SH.step(app.attract, { def: SH_AI.defender(app.attract, 0.8) });
    if (DEMO && app.t === 240) { AU.sfx('confirm'); startRun(); return; }
    if (inp.pressed.up || inp.pressed.down) { app.menu = (app.menu + (inp.pressed.up ? 2 : 1)) % 3; AU.init(); AU.sfx('select'); }
    if (inp.pressed.A || inp.pressed.START) { titleAction(app.menu); return; }
    if (inp.pressed.B) { exitGame(); return; }
    if (inp.pressed.SELECT) { AU.init(); AU.sfx('select'); AU.toggleMusic(); }
    drawWorld(app.attract, app.t);
    dim(0.45);
    titleArt(20, 99);
    blit(0);
    titleSub(104);
    if ((app.t >> 5) % 2 === 0) txt('上下选择 · A 确认', 160, 140, 9, '#ffe066', 'center');
    txt('B 退出游戏', 160, 152, 7, '#cfe8ff', 'center', { weight: 700 });
  }

  // ---------- 关卡开场 ----------
  function sceneLevelIntro(inp) {
    const g = app.game;
    drawWorld(g, app.t);
    const k = Math.min(1, app.t / 20);
    dim(0.5 * (app.t < 110 ? 1 : Math.max(0, 1 - (app.t - 110) / 30)));
    blit(0);
    if (app.t < 120) {
      txt(`第 ${app.level + 1} / ${SH.LEVELS.length} 关`, 160, 56 - (1 - k) * 20, 9, '#cfe8ff', 'center');
      txt(`${g.level.name} · ${g.level.line}`, 160, 76, 16, '#ffe066', 'center');
      const D = SH.DEFENDERS[g.def.kind];
      if (app.t > 30) txt(`守关者：${D.name}　「${D.line}」`, 160, 98, 8, '#7dffb0', 'center', { weight: 700 });
      if (app.t > 50) txt(['勇者有 3 条命，问号块里有变大果和加命果。', '注意：这一关的勇者学会了螺旋桨帽——会二段跳，还能慢慢飘。', '最后一道防线：勇者带上了无敌星，碰到他就要掉血，快跑！'][app.level], 160, 114, 6.5, '#ffffff', 'center', { weight: 600 });
    }
    if (app.t >= 140 || (app.t > 30 && (inp.pressed.A || inp.pressed.START))) go('play');
  }

  // ---------- 游戏 ----------
  function sceneplay(inp) {
    const g = app.game;
    if (inp.pressed.START) { app.paused = !app.paused; app.pmenu = 0; AU.sfx('pause'); }
    if (app.paused) { pauseMenu(inp); }
    else {
      const di = {
        left: inp.held.left, right: inp.held.right, jump: inp.held.A, jumpP: inp.pressed.A,
        atkP: inp.pressed.B, skillP: inp.pressed.X || !!inp.rflick, summonP: inp.pressed.Y,
        aimX: inp.rflick || (Math.abs(inp.axes.rx) > 0.4 ? inp.axes.rx : 0),
      };
      if (window.__botDefender || DEMO) Object.assign(di, SH_AI.defender(g, 0.7));
      SH.step(g, { def: di });
      handleEvents(g);
      if ((g.phase === 'victory' && g.phaseT > 150) || (g.phase === 'defeat' && g.phaseT > 210)) {
        app.result = { win: g.phase === 'victory', secs: Math.round(g.tick / 60), hp: g.def.hp, stats: g.stats, defX: g.def.x };
        const last = app.level >= SH.LEVELS.length - 1;
        app.lines[app.level] = app.result.win ? 'held' : 'lost';
        app.beaten += app.result.win ? 3 : Math.max(0, 3 - g.heroLives);
        app.runSecs += app.result.secs;
        if (app.result.win) { if (!last) { AU.stop(); AU.sfx('victory'); go('cleared'); } else { app.result.secs = app.runSecs; go('ending'); } return; }
        if (!last) { AU.stop(); AU.sfx('defeat'); go('breached'); return; } // 前两关失守：勇者大摇大摆进下一关
        AU.stop(); go('result'); AU.sfx('defeat'); // 最后一关失守：公主被救走
        return;
      }
    }
    drawWorld(g, g.tick);
    if (app.paused) dim(0.55);
    blit(app.shake);
    drawFloats();
    if (g.phase === 'spawn' && g.heroRound > 0) txt(`第 ${g.heroRound + 1} 位勇者：${SH.HERO_FORMS[g.hero.tier].name}！`, 160, 40, 11, '#ffe066', 'center');
    if (g.phase === 'heroDown') txt(g.heroLives > 0 ? `勇者倒下了！还剩 ${g.heroLives} 条命…` : '勇者的命全用完了！', 160, 50, 11, '#ffffff', 'center');
    if (g.phase === 'victory') txt('守住了！', 160, 60, 22, '#ffe066', 'center');
    if (g.phase === 'defeat') txt('防线失守……公主被救走了', 160, 60, 16, '#ff8a8a', 'center');
    if (app.paused) {
      txt('暂停', 160, 26, 14, '#ffe066', 'center');
      PMENU.forEach((m, i) => {
        let label = m;
        if (i === 2) label += IN.swap.ab ? '：已对调' : '：默认';
        if (i === 3) label += IN.swap.xy ? '：已对调' : '：默认';
        if (i === 4) label += AU.musicOn ? '：开' : '：关';
        txt((i === app.pmenu ? '▶ ' : '   ') + label, 118, 52 + i * 15, 8.5, i === app.pmenu ? '#ffe066' : '#ffffff');
      });
      txt('最近按键：' + (IN.lastRaw || '—'), 160, 172, 5.5, '#8a86a0', 'center', { weight: 500 });
    }
  }
  function pauseMenu(inp) {
    if (inp.pressed.up) { app.pmenu = (app.pmenu + PMENU.length - 1) % PMENU.length; AU.sfx('select'); }
    if (inp.pressed.down) { app.pmenu = (app.pmenu + 1) % PMENU.length; AU.sfx('select'); }
    if (inp.pressed.B) { app.paused = false; }
    if (inp.pressed.A) pauseAction(app.pmenu);
  }
  function pauseAction(i) {
    AU.sfx('confirm');
    if (i === 0) app.paused = false;
    if (i === 1) go('levelIntro');
    if (i === 2) IN.setSwap('ab', !IN.swap.ab);
    if (i === 3) IN.setSwap('xy', !IN.swap.xy);
    if (i === 4) AU.toggleMusic();
    if (i === 5) go('title');
    if (i === 6) exitGame();
  }

  const EV_SFX = { jump: null, stomp: 'stomp', squish: 'squish', dash: 'dash', thud: 'thud', throw: 'throw', summon: 'summon', bonk: 'bonk', qhit: 'qhit', clank: 'clank', kick: 'kick', shrink: 'hurtHero', heroDie: 'heroDie', defHurt: 'defHurt', powerup: 'powerup', eat: 'eat', fire: 'fire' };
  function handleEvents(g) {
    for (const e of g.events) {
      if (e.type === 'jump') AU.sfx(e.who === 'def' ? 'jump' : 'heroJump');
      else if (EV_SFX[e.type]) AU.sfx(EV_SFX[e.type]);
      if (e.type === 'defHurt') { app.shake = 6; float('-1', e.x + 7, e.y - 4, '#ff6b6b'); }
      if (e.type === 'thud') app.shake = 3;
      if (e.type === 'shrink') float(e.lost === 'prop' ? '打掉螺旋桨！' : '打掉强化！', e.x + 5, e.y - 6, '#ffe066');
      if (e.type === 'heroDie') { app.shake = 5; const SK = SH.DEFENDERS[g.def.kind]; float(e.src === 'shell' ? SK.skills.X + '击倒！' : e.src === 'dash' ? SK.skills.B + '击倒！' : e.src === 'minion' ? SK.minion + '立功！' : '撞倒了！', e.x + 5, e.y - 6, '#ffe066'); }
      if (e.type === 'powerup') float(({ star: '无敌星！10 秒', prop: '螺旋桨帽！', life: '+1 条命！' })[e.kind] || SH.HERO_FORMS[e.tier].name + '！', e.x + 5, e.y - 8, e.kind === 'star' ? '#ffe066' : e.kind === 'life' ? '#7dffb0' : '#ff9f43');
      if (e.type === 'powerup' && e.kind === 'life') AU.sfx('heart');
      if (e.type === 'spin') AU.sfx('rise');
      if (e.type === 'breath') AU.sfx('dash');
      if (e.type === 'starEnd') float('无敌结束', e.x + 5, e.y - 8, '#cfe8ff');
      if (e.type === 'eat') float('抢吃！+1 ♥', e.x + 7, e.y - 6, '#7dffb0');
      if (e.type === 'clank') float('叮！', e.x + 7, e.y - 4, '#cfe8ff');
      if (e.type === 'pickup') float('回收', e.x + 6, e.y - 4, '#cfe8ff');
      if (e.type === 'victory') AU.stop();
      if (e.type === 'defeat') { AU.stop(); AU.sfx('heroDie'); }
      if (['defHurt', 'heroDie', 'shrink', 'powerup', 'eat', 'nextHero', 'victory', 'defeat'].includes(e.type)) bottomPulse(e.type);
    }
  }
  function float(text, x, y, color) { app.floats.push({ text, x, y, color, t: 0 }); }
  function drawFloats() {
    for (const f of app.floats) { f.t++; txt(f.text, f.x, f.y - f.t * 0.35, 7, f.color, 'center'); }
    app.floats = app.floats.filter(f => f.t < 60);
  }

  // ---------- 守住一关 ----------
  const CLEARED = [
    ['第一道防线，守住了！', '勇者见正面打不过，抡起铲子往下挖，从地底下绕到你身后，溜进了地下水道。'],
    ['第二道防线，也守住了！', '勇者顶到一顶螺旋桨帽，从左边缺口飞上天花板，踩着你头顶走了过去。下一关是城墙，他再也绕不掉了。'],
  ];
  function nextLevel() {
    AU.sfx('confirm');
    if (app.preview) { // 预览：直接接下一段过场，最后进结局
      app.runSecs += Math.round(app.game.tick / 60);
      if (app.level === 0) { previewCleared(1); return; }
      app.level = 2; app.result = { win: true, secs: app.runSecs + 52, hp: 2, stats: { stomps: 7, heroHits: 8 }, defX: 200 }; go('ending'); return;
    }
    app.level++; app.retry = 0; go('levelIntro');
  }
  // ======== 守住一关后，勇者绕开你的过场（时间轴与路线在 bypass.js，上下屏共用） ========
  const BP = window.SH_BYPASS;
  function heroAt(name, x, feetY, face, pal) { // x = 脚底中心
    const c = ART.S[name];
    spr(name, Math.round(x - c[0].length / 2), Math.round(feetY - c.length), face < 0, pal);
  }
  function drawPose(p, t, clip) {
    let name = 'heroS_stand', face = p.face;
    if (p.pose === 'jump') name = 'heroS_jump';
    else if (p.pose === 'run') name = (t >> 2) % 2 ? 'heroS_run' : 'heroS_stand';
    else if (p.pose === 'climb') { name = 'heroS_climb'; face = Math.floor(p.y / 6) % 2 ? -1 : 1; }
    if (clip) { lx.save(); lx.beginPath(); lx.rect(clip[0], clip[1], clip[2], clip[3]); lx.clip(); }
    heroAt(name, p.x, p.y, face, null);
    if (clip) lx.restore();
  }
  function dirt(list) { for (const [x, y, s, c] of list) { lx.fillStyle = c; lx.fillRect(x, y, s, s); } }
  function shovel(x, handY, down) { // 铲子：down = 铲头扎进土里；否则举起来、铲头上带着土
    const tip = down ? handY + 9 : handY - 11;
    lx.fillStyle = '#6e4126'; lx.fillRect(x, Math.min(handY, tip), 1, Math.abs(tip - handY) + 1);
    lx.fillStyle = '#1a1426'; lx.fillRect(x - 2, tip - 1, 5, 4);
    lx.fillStyle = '#b9b9c8'; lx.fillRect(x - 1, tip, 3, 2);
    if (!down) { lx.fillStyle = '#c8643a'; lx.fillRect(x - 2, tip - 2, 5, 1); }
  }
  function propeller(x, y, t, spin) { // 螺旋桨帽：头顶一根杆 + 桨叶
    const wv = spin ? [6, 3, 1, 3][(t >> 1) % 4] : 5;
    lx.fillStyle = '#1a1426'; lx.fillRect(x - 1, y - 2, 2, 3);
    lx.fillStyle = '#7dffb0'; lx.fillRect(x - wv, y - 3, wv * 2, 1);
  }
  function bang(x, y) { // 守关者头上冒的「!」
    lx.fillStyle = '#1a1426'; lx.fillRect(x - 2, y - 1, 4, 10);
    lx.fillStyle = '#ffe066'; lx.fillRect(x - 1, y, 2, 5); lx.fillRect(x - 1, y + 6, 2, 2);
  }
  // 竖井剖面（宽 16，从 top 挖到 bot）
  function shaft(cx, top, bot, gy) {
    if (bot <= top) return;
    const x0 = cx - 8;
    lx.fillStyle = '#2a1810'; lx.fillRect(x0, top, 16, bot - top);
    lx.fillStyle = '#4a2a18'; lx.fillRect(x0, top, 2, bot - top);
    lx.fillStyle = '#170c07'; lx.fillRect(x0 + 13, top, 3, bot - top);
    lx.fillStyle = '#7e3b22';
    for (let y = Math.ceil(top / 3) * 3; y < bot - 1; y += 3) { const j = (y * 7) % 5; if (j === 1) lx.fillRect(x0 - 1, y, 1, 2); if (j === 3) lx.fillRect(x0 + 16, y, 1, 2); }
    lx.fillStyle = '#3d2214'; for (let y = Math.ceil(top / 5) * 5; y < bot; y += 5) lx.fillRect(x0 + 4 + (y * 3) % 7, y, 2, 1);
    if (top <= gy) { lx.fillStyle = '#1a1426'; lx.fillRect(x0 - 1, gy, 1, 4); lx.fillRect(x0 + 16, gy, 1, 4); }
  }
  function mound(cx, k, side, gy) { // 井口旁边越堆越高的土
    if (k <= 0) return;
    const w = Math.round(4 + k * 9), h = 1 + k * 4, x = side < 0 ? cx - 9 - w : cx + 9;
    for (let i = 0; i < w; i++) {
      const hh = Math.max(1, Math.round(h * Math.sin((i + 0.5) / w * Math.PI)));
      lx.fillStyle = '#1a1426'; lx.fillRect(x + i, gy - hh - 1, 1, 1);
      lx.fillStyle = (i * 5) % 3 ? '#8a5a2b' : '#c8643a'; lx.fillRect(x + i, gy - hh, 1, hh);
    }
  }
  function ladderIn(cx, top, bot) { // 竖井里的梯子
    lx.fillStyle = '#6e4126'; lx.fillRect(cx - 5, top, 2, bot - top); lx.fillRect(cx + 4, top, 2, bot - top);
    lx.fillStyle = '#a0683a'; for (let y = top + 2; y < bot; y += 5) lx.fillRect(cx - 3, y, 7, 1);
  }
  // 守关者：先走回自己的岗位（x=262），然后站着看
  function stagedDef(g, t, faceOverride) {
    const d = Object.assign({}, g.def), k = Math.min(1, t / 50), home = 262;
    d.x = g.def.x + (home - g.def.x) * k; d.y = (g.level.groundY || 156) - d.h;
    d.vx = k < 1 && Math.abs(home - g.def.x) > 2 ? 1 : 0; d.anim = t; d.onGround = true;
    d.face = d.vx ? Math.sign(home - g.def.x) : (faceOverride || -1);
    d.inv = 0; d.dash = 0; d.squash = 0; d.dead = false;
    return d;
  }

  // —— 第一关：挖竖井钻到下屏，再从你身后挖上来 ——
  function bypass1(t, layer) {
    const T = BP.T1, gy = T.ground;
    const du = t - T.digT, depth = du < 0 ? 0 : Math.min(24, du / T.digLen * 24);
    const up = T.digUpSeg, upS = T.inT + up.t0, eu = t - upS;
    const exitDepth = eu < 0 ? 0 : Math.min(24, eu / up.dur * 24);
    if (layer === 'back') {
      if (depth > 0) { shaft(T.digX, gy, gy + depth, gy); mound(T.digX, depth / 24, -1, gy); mound(T.digX, depth / 24 * 0.8, 1, gy); }
      if (exitDepth > 0) {
        shaft(T.exitX, 180 - exitDepth, 180, gy);
        if (exitDepth >= 24) { const k = Math.min(1, (eu - up.dur) / 12); mound(T.exitX, 0.5 * k, -1, gy); mound(T.exitX, 0.7 * k, 1, gy); }
        ladderIn(T.exitX, exitDepth >= 24 ? gy - 8 : 180 - exitDepth + 2, 180);
      }
      return;
    }
    // —— 前景：人、铲子、飞起来的土 ——
    if (t < T.emerge) { drawPose({ x: T.pipeX, y: T.pipeTop + 16 - t / T.emerge * 16, face: 1, pose: 'stand' }, t, [0, 0, W, T.pipeTop]); return; }
    if (t < T.hopT) { drawPose({ x: T.pipeX, y: T.pipeTop, face: 1, pose: 'stand' }, t); return; }
    if (t < T.digT) { const p = t - T.hopT < T.hop.dur ? T.hop.at(t - T.hopT) : { x: T.digX, y: gy, face: 1, pose: 'stand' }; drawPose(p, t); return; }
    if (t < T.goneT) {
      const fallU = du - T.digLen, feet = fallU < 0 ? gy + depth : gy + 24 + 0.5 * BP.G * fallU * fallU;
      const swing = (du >> 3) % 2 === 0; // 一下扎土，一下把土扬出去
      drawPose({ x: T.digX, y: feet, face: 1, pose: fallU < 0 && !swing ? 'jump' : 'stand' }, t);
      if (fallU < 0) shovel(T.digX + 5, feet - 9, swing);
      if (du < T.digLen + 20) dirt(BP.spray(du, T.digX, gy - 3, { len: T.digLen, every: 4, floor: gy - 1 }));
      return;
    }
    // 人在下屏：这里只剩两个洞；从下面往上挖时，土往竖井里掉，挖穿那一下往外爆
    if (eu >= 0 && eu < up.dur + 20) {
      if (exitDepth < 24) dirt(BP.spray(eu, T.exitX, 180 - exitDepth, { len: up.dur, every: 2, floor: 182, dir: 'down' }));
      else dirt(BP.spray(eu - up.dur, T.exitX, gy - 2, { len: 10, every: 1, floor: gy - 1 }));
    }
    if (t >= T.climbFrom && t < T.exitT) drawPose({ x: T.exitX, y: Math.max(gy, 198 - (t - T.climbFrom) * 1.2), face: 1, pose: 'climb' }, t);
    else if (t >= T.exitT) {
      const p = T.exit.at(t - T.exitT);
      if (p) drawPose(p, t, [0, 0, 304, H]); // 钻进城门那一下被门挡住
    }
  }
  // —— 第二关：顶到螺旋桨帽，从左边缺口飞到天花板上面走过去 ——
  function bypass2(t, layer) {
    if (layer === 'back') return;
    const T = BP.T2, G = BP.G;
    if (t < T.grabT) spr('propItem', T.pipeX - 6, T.itemY + Math.round(Math.sin(t / 8) * 1.5));
    if (t >= T.grabT && t < T.grabT + 24) drawFx({ kind: 'star', x: T.pipeX, y: T.itemY + 6, t: t - T.grabT, life: 24 });
    const jy = u => T.pipeTop + T.jumpV * u + 0.5 * G * u * u;
    let p = null, prop = 0, clip = null;
    if (t < T.emerge) { p = { x: T.pipeX, y: T.pipeTop + 16 - t / T.emerge * 16, face: 1, pose: 'stand' }; clip = [0, 0, W, T.pipeTop]; }
    else if (t < T.jumpT) p = { x: T.pipeX, y: T.pipeTop, face: 1, pose: 'stand' };
    else if (t < T.flyT) { p = { x: T.pipeX, y: jy(t - T.jumpT), face: 1, pose: 'jump' }; prop = t >= T.grabT ? 1 : 0; }
    else if (t < T.flyT + T.flyLen) { // 螺旋桨一开，减速升进天花板上面的缝里
      const y0 = jy(T.flyT - T.jumpT), k = (t - T.flyT) / T.flyLen;
      p = { x: T.pipeX, y: y0 + (T.ceilTop - 2 - y0) * (1 - (1 - k) * (1 - k)), face: 1, pose: 'jump' }; prop = 2;
    } else if (t < T.walkT) { // 往右飘，落到天花板顶面
      const k = (t - T.flyT - T.flyLen) / T.slideLen, e = k * k * (3 - 2 * k);
      p = { x: T.pipeX + (62 - T.pipeX) * e, y: T.ceilTop - 2 + 2 * k, face: 1, pose: k < 0.85 ? 'jump' : 'stand' }; prop = k < 0.85 ? 2 : 1;
    } else if (t < T.walkT + T.walkLen) { // 在天花板上面走过你的头顶，钻进右边城墙的通道
      p = { x: 62 + (t - T.walkT) * 1.5, y: T.ceilTop, face: 1, pose: 'run' }; clip = [0, 0, T.ceilEnd + 1, H];
    }
    if (!p) return;
    drawPose(p, t, clip);
    if (prop && p.y > 17) propeller(Math.round(p.x), Math.round(p.y - 16), t, prop === 2);
  }
  function clearedDone() { return app.level === 0 ? BP.T1.doneT : BP.T2.doneT; }
  function bypassSfx(t, L1) {
    if (L1) {
      const T = BP.T1, du = t - T.digT, up = T.inT + T.digUpSeg.t0;
      if (t === T.hopT) AU.sfx('jump');
      if (du >= 0 && du < T.digLen && du % 16 === 0) AU.sfx('thud');
      if (t === T.digT + T.digLen) AU.sfx('crumble');
      for (const L of BP.r1.lands) if (t === T.inT + L.t) AU.sfx('thud'); // 下屏落地
      const ls = BP.r1.segs.find(s => s.ladder); if (t === T.inT + ls.t0 + 4) AU.sfx('clank');
      if (t >= up && t < up + T.digUpSeg.dur && (t - up) % 8 === 0) AU.sfx('crumble');
      if (t === T.exitT || t === T.exitT + T.exit.segs[0].dur + T.exit.segs[1].dur) AU.sfx('jump');
    } else {
      const T = BP.T2;
      if (t === T.jumpT) AU.sfx('jump');
      if (t === T.grabT) AU.sfx('powerup');
      if (t === T.flyT) AU.sfx('rise');
    }
  }
  function sceneCleared(inp) {
    const g = app.game, c = CLEARED[app.level] || CLEARED[0], t = app.t, L1 = app.level === 0;
    const done = clearedDone(), B = L1 ? bypass1 : bypass2;
    if (t === 100) AU.play('title');
    bypassSfx(t, L1);
    SH.step(g, { def: {} });
    // 守关者：第一关勇者在背后冒出来时回头；第二关眼睛跟着头顶上的勇者
    let face = -1, alarm = false;
    if (L1) { const T = BP.T1; if (t > T.exitT + 10) { face = 1; alarm = t < T.exitT + 60; } }
    else { const T = BP.T2, hx = 62 + (t - T.walkT) * 1.5; if (t > T.walkT && hx > 200 && hx < T.ceilEnd + 8) { face = hx > 268 ? 1 : -1; alarm = true; } }
    const d = stagedDef(g, t, face);
    drawBackground(t, g.level.id);
    drawSolids(g);
    B(t, 'back');
    drawDefender(d, t);
    if (alarm) bang(Math.round(d.x + d.w / 2), Math.round(d.y - 13));
    dim(Math.min(0.35, t / 40));
    B(t, 'front');
    blit(0);
    if (t > 20) txt(c[0], 160, 44, 18, '#ffe066', 'center');
    if (t > 60) txt(typed(c[1], 60, t, 3), 160, 80, 7.5, '#ffffff', 'center', { weight: 700 });
    const nd = SH.DEFENDERS[SH.LEVELS[app.level + 1].defender];
    if (t > 200) txt(`下一位守关者：${nd.name}`, 160, 106, 9, '#7dffb0', 'center');
    if (t > done && (t >> 5) % 2) txt('按 A 继续', 160, 140, 8, '#cfe8ff', 'center');
    // 动画放完才提示；看过的人按 A 也能直接跳过
    if ((t > 90 && (inp.pressed.A || inp.pressed.START)) || (DEMO && t > done + 30)) nextLevel();
  }

  // ---------- 前两关失守：勇者光明正大地闯进下一关 ----------
  const BREACHED = [
    ['第一道防线失守……', '勇者踩着你走了过去，大摇大摆推开城门，进了地下水道。'],
    ['第二道防线也失守了……', '勇者一路闯过水道，直奔城墙。只剩最后一道防线了！'],
  ];
  function sceneBreached(inp) {
    const g = app.game, c = BREACHED[app.level] || BREACHED[0], t = app.t;
    if (t === 90) AU.playWaltz('dread');
    SH.step(g, { def: {} });
    drawWorld(g, g.tick); dim(Math.min(0.5, t / 40));
    { // 勇者走过倒下的守关者，推门进了下一关
      const gy = g.level.groundY || 156, x = Math.min(320, 150 + t * 0.8), wk = (t >> 3) % 2;
      lx.save(); lx.beginPath(); lx.rect(0, 0, 304, H); lx.clip();
      spr(wk ? 'heroB_run' : 'heroB_stand', Math.round(x), gy - 24, false, app.level ? ART.firePal : null); lx.restore();
    }
    blit(0);
    if (t > 10) txt(c[0], 160, 40, 17, '#ff8a8a', 'center');
    if (t > 40) txt(typed(c[1], 40, t, 3), 160, 68, 7.5, '#ffffff', 'center', { weight: 700 });
    const nd = SH.DEFENDERS[SH.LEVELS[app.level + 1].defender];
    if (t > 120) txt(`下一位守关者：${nd.name}`, 160, 96, 9, '#7dffb0', 'center');
    if (t > 150) txt('不管前面守没守住，最后一道防线都得硬碰硬。', 160, 114, 6.5, '#cfe8ff', 'center', { weight: 600 });
    if (t > 160 && (t >> 5) % 2) txt('按 A 继续', 160, 140, 8, '#cfe8ff', 'center');
    if ((t > 60 && (inp.pressed.A || inp.pressed.START)) || (DEMO && t > 260)) { AU.stop(); nextLevel(); }
  }

  // ---------- 结算（最后一道防线失守：公主被救走） ----------
  function sceneResult(inp) {
    if (app.t === 110) AU.playWaltz('dread');
    const r = app.result, g = app.game;
    if (app.t > 30) {
      if (inp.pressed.A || inp.pressed.START || (DEMO && app.t > 200)) { AU.sfx('confirm'); app.retry++; go('levelIntro'); return; }
      if (inp.pressed.B) { AU.sfx('select'); go('title'); return; }
    }
    SH.step(g, { def: {} });
    drawWorld(g, g.tick); dim(0.6);
    { const px = Math.max(-30, 300 - app.t * 0.7), wk = (app.t >> 3) % 2; // 勇者带着公主离开
      const gy = g.level.groundY || 156; spr(wk ? 'princess2' : 'princess', px + 16, gy - 22, true); spr(wk ? 'heroB_run' : 'heroB_stand', px, gy - 24, true, ART.firePal); }
    blit(0);
    txt(`${app.game.level.line}失守……`, 160, 30, 18, '#ff8a8a', 'center');
    txt('勇者冲过了这条线，一路杀进城堡，把公主救走了。', 160, 56, 8, '#ffffff', 'center', { weight: 700 });
    txt(`坚持了 ${r.secs} 秒 · 他还剩 ${app.game.heroLives} 条命 · 游戏失败`, 160, 72, 7, '#cfe8ff', 'center', { weight: 700 });
    txt('提示：他从上方落下时按 B 缩壳——冲撞中被踩不掉血。', 160, 88, 7, '#cfe8ff', 'center', { weight: 600 });
    txt('这是最后一道防线。按 A 再守一次。', 160, 104, 7, '#cfe8ff', 'center', { weight: 600 });
    txt('A 重守最后一道防线     B 回到标题', 160, 140, 9, '#ffe066', 'center');
  }

  // ======================= 结局 =======================
  // 守住三位勇者之后：勇者带着伙伴和神力回来，拆了城门、救走公主；只剩我们几个 NPC 在夕阳里。
  const ET = {
    dark: 150, glow: 330, rise: 360, fairy: 430, knight: 470, l1: 380, l2: 470, l3: 560,
    charge: 700, dash: 740,
    beams: [[780, 96, 64, 128, 108], [830, 224, 192, 256, 108], [880, 160, 136, 184, 64]], // [开始帧, 光柱 x, 方块 x1, x2, y]
    gate: 960, princess: 1060, walkup: 1140, meet: 1200, leave: 1260, sunset: 1380, up: 1460, bandana: 1500,
    n1: 1540, n2: 1690, nk: 1840, n3: 1990, n4: 2140, n5: 2290, credits: 2460,
    crEnd: 4800, restart: 5420, // 结尾曲（69 秒）从 leave(1260) 开始：约 59 秒出 THE END，歌放完（约 69 秒）出重新开始
  };
  const NARR = [ // [出现帧, 消失帧, 中文, 英文（下屏）]
    [ET.dark + 20, ET.rise, '……可勇者，总会再回来。', '...But heroes always come back.'],
    [ET.l1, ET.charge, '他带来了一整队伙伴，', 'He brought a whole squad of companions,'],
    [ET.l2, ET.charge, '带来了上天赐予的神力，', 'power from the heavens,'],
    [ET.l3, ET.charge, '还有——主角光环。', 'and the one thing we never had: plot armor.'],
    [ET.n1, ET.credits, '我们守住了每一次。', 'We held the line. Every single time.'],
    [ET.n2, ET.credits, '可这个故事，从来不是为我们写的。', 'But this story was never written for us.'],
    [ET.nk, ET.credits, '他们荡平了我们三个，又冲进去，把掳走公主的大王也打败了。', 'They flattened us, stormed in, and beat the King who took the princess.'],
    [ET.n3, ET.credits, '但就在刚才那一会儿——', 'And yet, for a little while—'],
    [ET.n4, ET.credits, '有一双手握着手柄，替我们跳，替我们挡，替我们拼命。', 'someone held the controller, and jumped, and fought, for us.'],
    [ET.n5, ET.credits, '那一会儿，我们是主角。', 'For that little while, we were the main character.'],
  ];
  const CREDITS = [
    ['h', 'CAST'], ['g'], ['s', '主演'], ['n', '壳壳队长 …… 你'], ['n', '菇菇长老 …… 你'], ['n', '熔岩龙王 …… 你'], ['n', '小兵们 …… 你召唤的'], ['n', '问号块 …… 本色出演'], ['n', '城门 …… 已拆除'],
    ['g'], ['s', '特别出演'], ['n', '勇者 …… 永远的主角'], ['n', '伙伴大军 …… 十几个勇者'], ['n', '公主 …… 永远的女一号'], ['n', '大王 …… 掳走公主的那位'],
    ['g'], ['s', '以及'], ['n', '握着手柄的你'],
  ];
  const CR_GAP = 13, CR_Y0 = 185;
  const CR_SPEED = (CR_Y0 + CREDITS.length * CR_GAP - 70) / (ET.crEnd - ET.credits);
  const END_T = ET.crEnd;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const STARS = Array.from({ length: 44 }, (_, i) => [(i * 73 + 11) % 320, (i * 37 + 5) % 104, i * 1.7]);
  const BLOCKS = SH.LEVELS.find(l => l.id === 'grass').solids.filter(s => s.kind === 'brick' || s.kind === 'q');
  let bgRuin = null;
  const SQUAD_N = 14; // 伙伴大军：十几个勇者
  const SQUAD_PALS = [ART.knightPal, ART.firePal, ART.starPal, ART.knightPal, null, ART.firePal, ART.knightPal, ART.starPal, ART.knightPal, ART.firePal, ART.starPal, ART.knightPal, ART.firePal, null];

  function beamOf(b) { return ET.beams.find(B => b.y === B[4] && b.x >= B[2] && b.x < B[3]); }
  function heroPath(t, t0, sx, stand) { // 从水管钻出 → 跳下 → 走到 stand
    if (t < t0) return null;
    const u = t - t0;
    if (u < 48) return { x: sx, b: 148 - u * 0.5, face: 1, clip: true };
    if (u < 80) { const v = u - 48; return { x: sx + v * 0.9, b: Math.min(156, 124 - (2 * v - 0.1 * v * v)), face: 1, air: true }; }
    const x0 = sx + 32 * 0.9, x = Math.min(stand, x0 + (u - 80) * 0.7);
    return { x, b: 156, face: 1, walk: x < stand };
  }
  function actors(t) {
    const a = {};
    // 勇者
    let h = heroPath(t, ET.rise, 15, 108);
    if (h && t >= ET.walkup) { const x = Math.min(140, 108 + (t - ET.walkup) * 0.6); h = { x, b: 156, face: 1, walk: x < 140 }; }
    if (h && t >= ET.leave) h = { x: 140 - (t - ET.leave) * 0.9, b: 156, face: -1, walk: true };
    a.hero = h;
    // 伙伴大军：十几个勇者从水管里涌出来，站成一片，一起前压、一起撤离
    a.squad = Array.from({ length: SQUAD_N }, (_, i) => {
      const t0 = ET.knight + i * 6;
      const stand = 46 + (i % 7) * 8;
      let m = heroPath(t, t0, 15 + (i % 3) * 2, stand);
      if (!m) return null;
      m.pal = SQUAD_PALS[i % SQUAD_PALS.length];
      if (t >= ET.charge && t < ET.gate) { m.x = stand + Math.min((t - ET.charge) * 1.4, 30); m.walk = true; }
      else if (t >= ET.gate) { m.x = stand + 30; m.walk = false; }
      if (t >= ET.leave) { m.x = m.x - (t - ET.leave) * 0.9; m.face = -1; m.walk = true; }
      return m;
    });
    if (t >= ET.princess) {
      let x = Math.max(154, 296 - (t - ET.princess) * 1.0), walk = x > 154;
      if (t >= ET.leave) { x = 154 - (t - ET.leave) * 0.9; walk = true; }
      a.princess = { x, b: 156, face: -1, walk };
    }
    // 守关者
    const tx = 200, x0 = (app.result && app.result.defX) || 200;
    const hitX = 122, tHit = ET.dash + (tx - hitX) / 3.5, landX = hitX + 2.2 * 26.7;
    const d = { x: tx, y: 140, w: 14, h: 16, vx: 0, face: -1, onGround: true, anim: 0, inv: 0, squash: 0, dash: 0, dead: false };
    if (t < ET.dark) { // 走回城门前，欢呼
      const k = clamp01(t / 110); d.x = x0 + (tx - x0) * k; d.face = Math.abs(tx - x0) > 1 && k < 1 ? Math.sign(tx - x0) : -1;
      d.vx = k < 1 ? 1 : 0; d.anim = t;
      if (k >= 1) { const u = t % 30; if (u < 20) { d.y = 140 - (3 * u - 0.15 * u * u); d.onGround = false; } }
    }
    else if (t >= ET.dash && t < tHit) { d.x = tx - (t - ET.dash) * 3.5; d.dash = 1; }
    else if (t >= tHit && t < ET.up) { const u = t - tHit; d.x = Math.min(landX, hitX + 2.2 * u); d.y = Math.min(140, 140 - (4 * u - 0.15 * u * u)); d.dead = true; }
    else if (t >= ET.up) { const u = t - ET.up; d.x = landX; if (u < 16) d.y = 140 - (2 * u - 0.125 * u * u); }
    a.def = d; a.tHit = tHit; a.landX = landX;
    // 菇菇长老、熔岩龙王：一起庆祝，一起被弹飞，一起回来坐着
    a.allies = [['shroom', tx - 34, 14, 15, ET.charge + 24, 46], ['dragon', tx + 52, 20, 20, ET.charge + 8, 62]].map(([kind, hx, w, h, tc, sit]) => {
      const o = { kind, x: hx, y: 156 - h, w, h, vx: 0, face: -1, onGround: true, anim: t, inv: 0, squash: 0, dash: 0, dead: false };
      if (t < ET.dark) { const u = (t + (kind === 'dragon' ? 12 : 22)) % 30; if (t > 30 && u < 20) { o.y = 156 - h - (3 * u - 0.15 * u * u); o.onGround = false; } }
      else if (t >= ET.up + 20) { const stop = landX + sit; o.x = Math.max(stop, 340 - (t - ET.up - 20) * 0.5); o.vx = o.x > stop ? 1 : 0; }
      else if (t >= tc) {
        const th = tc + (hx - 126) / 1.4;
        if (t < th) { o.x = hx - (t - tc) * 1.4; o.vx = 1; }
        else { const u = t - th; o.x = 126 + 2 * u; o.y = 156 - h - (4 * u - 0.12 * u * u); o.dead = true; o.th = th; }
      }
      return o;
    });
    // 甲虫兵
    a.beetles = [tx + 20, tx + 34].map((b0, i) => {
      if (t >= ET.up + 20) { const stop = landX + 18 + i * 13, x = Math.max(stop, 330 + i * 20 - (t - ET.up - 20) * 0.5); return { x, y: 146, walk: x > stop, face: -1 }; }
      if (t < ET.charge) return { x: b0, y: 146, walk: false, face: -1 };
      const th = ET.charge + (b0 - 124) / 1.2;
      if (t < th) return { x: b0 - (t - ET.charge) * 1.2, y: 146, walk: true, face: -1 };
      const u = t - th; return { x: 124 + 2 * u, y: 146 - (4.5 * u - 0.12 * u * u), flip: true, th };
    });
    return a;
  }

  function drawPerson(name, p, pal, t) {
    const c = ART.S[name], y = Math.round(p.b - c.length + (p.walk && (t >> 3) % 2 ? -1 : 0));
    if (p.clip) { lx.save(); lx.beginPath(); lx.rect(0, 0, W, 124); lx.clip(); spr(name, p.x, y, p.face < 0, pal); lx.restore(); }
    else spr(name, p.x, y, p.face < 0, pal);
  }
  function aura(x, y, t, k) {
    const r = (20 + 2 * Math.sin(t / 8)) * k;
    const g = lx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(255,245,190,0.55)'); g.addColorStop(0.6, 'rgba(255,214,90,0.22)'); g.addColorStop(1, 'rgba(255,214,90,0)');
    lx.fillStyle = g; lx.fillRect(x - r, y - r, r * 2, r * 2);
    lx.fillStyle = (t >> 2) % 2 ? '#fff3b0' : '#ffe066';
    for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2 + t / 30; lx.fillRect(Math.round(x + Math.cos(an) * r * 0.85), Math.round(y + Math.sin(an) * r * 0.85), 1, 1); }
  }
  function halo(x, y) {
    lx.fillStyle = '#fff3b0';
    for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2; lx.fillRect(Math.round(x + Math.cos(an) * 5), Math.round(y + Math.sin(an) * 1.5), 1, 1); }
  }
  function beam(x, u) {
    if (u < 0 || u > 40) return;
    const w = u < 10 ? u * 1.4 : Math.max(0, 14 - (u - 10) * 0.5);
    lx.fillStyle = 'rgba(255,214,90,0.45)'; lx.fillRect(Math.round(x - w), 0, Math.round(w * 2), 156);
    lx.fillStyle = 'rgba(255,255,240,0.9)'; lx.fillRect(Math.round(x - w / 3), 0, Math.max(1, Math.round(w * 2 / 3)), 156);
  }
  function debris(b, t, t0, seed) {
    for (let j = 0; j < 4; j++) {
      const u = t - t0, vx = (((seed * 37 + j * 11) % 9) - 4) * 0.35, vy = -2 - ((seed * 13 + j * 7) % 5) * 0.6;
      const x0 = b.x + (j % 2) * 8, y0 = b.y + (j >> 1) * 8;
      const tl = (-vy + Math.sqrt(vy * vy - 0.48 * (y0 - 152))) / 0.24, uu = Math.min(u, tl);
      const x = x0 + vx * uu, y = Math.min(152, y0 + vy * uu + 0.12 * uu * uu);
      lx.fillStyle = '#1a1426'; lx.fillRect(Math.round(x), Math.round(y), 5, 4);
      lx.fillStyle = b.kind === 'q' ? '#f7b733' : '#c8643a'; lx.fillRect(Math.round(x), Math.round(y), 4, 3);
    }
  }

  function endWorld(t) {
    const a = actors(t);
    const fall = t >= ET.gate + 14;
    if (!bgCache) bgCache = buildBG();
    if (fall && !bgRuin) bgRuin = buildBG(true);
    lx.drawImage(fall ? bgRuin : bgCache, 0, 0);
    if (fall) { // 城堡下沉
      const dy = Math.min(150, (t - ET.gate - 14) * 0.8);
      lx.save(); lx.beginPath(); lx.rect(0, 0, W, 156); lx.clip();
      lx.drawImage(bgCache, 288, 10, 32, 146, 288, 10 + dy, 32, 146); spr('gate', 304, 104 + dy); lx.restore();
    }
    const night = clamp01((t - 1800) / 600);
    for (const c of clouds) drawCloud(((c.x + t * 0.05 * c.s) % 360) - 30, c.y, c.s);
    // 地面、水管、还没被拆的方块
    const solids = [{ x: 0, y: 156, w: 320, h: 24, kind: 'ground', bump: 0 }, { x: 12, y: 124, w: 28, h: 32, kind: 'pipe', bump: 0 }];
    BLOCKS.forEach(b => { const B = beamOf(b); if (!B || t < B[0] + 10) solids.push(Object.assign({}, b, { bump: 0, active: true })); });
    drawSolids({ solids });
    if (!fall) spr('gate', 304, 104);
    BLOCKS.forEach((b, i) => { const B = beamOf(b); if (B && t >= B[0] + 10) debris(b, t, B[0] + 10, i + 3); });
    if (fall) { // 废墟堆
      const hp = Math.min(1, (t - ET.gate - 14) / 90);
      for (let i = 0; i < 9; i++) {
        const hh = Math.round((6 + ((i * 7) % 5) * 3) * hp), x = 284 + i * 4;
        lx.fillStyle = '#1a1426'; lx.fillRect(x - 1, 156 - hh - 1, 6, hh + 1);
        lx.fillStyle = i % 2 ? '#6d6d86' : '#55556a'; lx.fillRect(x, 156 - hh, 4, hh);
      }
    }
    // 甲虫兵、守关者
    a.beetles.forEach(m => {
      if (m.flip) { if (m.y < 200) spr('beetle1', m.x, m.y, false, null, true); }
      else spr(m.walk && (t >> 3) % 2 ? 'beetle2' : 'beetle1', m.x, m.y, m.face < 0);
    });
    a.allies.forEach(o => { if (o.y < 200) drawDefender(o, t); });
    drawDefender(a.def, t, t >= ET.bandana);
    // 掉落的红头巾
    if (t >= ET.bandana) {
      const u = t - ET.bandana, bx = a.landX + 10 - Math.min(u, 150) * 0.22, by = Math.min(154, 141 + u * 0.1 + Math.sin(u / 10) * 2);
      lx.fillStyle = '#e0344c'; lx.fillRect(Math.round(bx), Math.round(by), 4, 2); lx.fillStyle = '#9c1f33'; lx.fillRect(Math.round(bx) + 3, Math.round(by) + 1, 2, 1);
    }
    // 勇者一行
    const powered = t >= ET.charge && t < ET.gate + 60;
    // 伙伴大军（画在公主/勇者后面）
    a.squad.forEach(m => {
      if (m && m.x > -20) drawPerson(m.air ? 'heroB_jump' : (m.walk && (t >> 3) % 2 ? 'heroB_run' : 'heroB_stand'), m, m.pal || ART.knightPal, t);
    });
    if (a.princess && a.princess.x > -20) drawPerson(a.princess.walk && (t >> 3) % 2 ? 'princess2' : 'princess', a.princess, null, t);
    if (a.hero && a.hero.x > -20) drawPerson(a.hero.air ? 'heroB_jump' : (a.hero.walk && (t >> 3) % 2 ? 'heroB_run' : 'heroB_stand'), a.hero, powered && (t >> 2) % 2 ? ART.starPal : ART.firePal, t);

    // —— 天色 ——
    const storm = clamp01((t - ET.dark) / 120) * 0.5 * (1 - clamp01((t - ET.leave) / 160));
    if (storm > 0) { lx.fillStyle = `rgba(20,16,48,${storm})`; lx.fillRect(0, 0, W, H); }
    const sun = clamp01((t - ET.leave) / 160);
    if (sun > 0) {
      const g = lx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(120,60,140,${0.5 * sun})`); g.addColorStop(0.45, `rgba(255,120,80,${0.5 * sun})`); g.addColorStop(0.8, `rgba(255,190,110,${0.35 * sun})`); g.addColorStop(1, `rgba(60,20,40,${0.4 * sun})`);
      lx.fillStyle = g; lx.fillRect(0, 0, W, H);
    }
    if (night > 0) {
      lx.fillStyle = `rgba(10,8,34,${night * 0.62})`; lx.fillRect(0, 0, W, H);
      for (const [x, y, ph] of STARS) if (Math.sin(t / 25 + ph) > 0.2 - night) { lx.fillStyle = `rgba(255,250,220,${night})`; lx.fillRect(x, y, 1, 1); }
    }
    // —— 光（压在天色上面才亮） ——
    if (t >= ET.glow && t < ET.rise + 60) { const k = clamp01((t - ET.glow) / 30) * (1 - clamp01((t - ET.rise - 30) / 30)); lx.fillStyle = `rgba(255,230,140,${0.5 * k})`; lx.fillRect(10, 0, 32, 124); }
    if (a.hero && a.hero.x > -20) {
      const hx = a.hero.x + 6, hb = a.hero.b;
      aura(hx, hb - 12, t, powered ? 1.4 : 1);
      halo(hx, hb - 27);
    }
    if (t >= ET.fairy && a.hero) {
      const r = Math.min(16, (t - ET.fairy) * 0.5), fx = a.hero.x + 2 + Math.cos(t / 18) * r, fy = a.hero.b - 34 + Math.sin(t / 9) * 4;
      if (fx > -10) spr((t >> 3) % 2 ? 'fairy' : 'fairy2', fx, fy);
    }
    for (const B of ET.beams) beam(B[1], t - B[0]);
    beam(306, t - ET.gate);
    // 撞到光环被弹开的火花
    const sp = (x, y, u) => { if (u >= 0 && u < 20) drawFx({ kind: 'star', x, y, t: u, life: 20 }); };
    sp(124, 146, t - a.tHit);
    a.beetles.forEach(m => { if (m.th) sp(128, 150, t - m.th); });
    a.allies.forEach(o => { if (o.th) sp(130, 146, t - o.th); });
    if (t >= ET.meet && t < ET.meet + 100) spr('heart', 148, Math.round(118 - (t - ET.meet) * 0.25));
    return a;
  }

  function sceneEnding(inp) {
    const t = app.t;
    // 时间线上的音效与震屏
    const at = T => t === Math.floor(T);
    if (t === 1) AU.sfx('victory');
    if (t === 100) AU.play('title');
    if (at(ET.dark)) AU.playWaltz('dread');
    if (at(ET.glow) || at(ET.knight)) AU.sfx('rise');
    if (at(ET.charge)) { AU.sfx('dash'); app.shake = 6; }
    if (t > ET.charge && t < ET.gate && t % 14 === 0) app.shake = Math.max(app.shake, 2);
    if (at(ET.rise + 30) || at(ET.fairy)) AU.sfx('chime');
    for (const B of ET.beams) { if (at(B[0])) AU.sfx('beam'); if (at(B[0] + 10)) app.shake = 7; }
    if (at(ET.gate)) AU.sfx('beam');
    if (at(ET.gate + 14)) { AU.sfx('crumble'); app.shake = 9; }
    if (t > ET.gate + 14 && t < ET.gate + 100 && t % 10 === 0) app.shake = Math.max(app.shake, 3);
    if (at(ET.meet)) AU.sfx('heart');
    if (at(ET.leave - 60)) AU.fadeOut(1);
    if (at(ET.leave) && !app.endMusic) { AU.playEnding(); app.endMusic = true; }

    if (app.leaving) { if (++app.leaving > 120) { if (app.leaveTo === 'run') { if (app.preview) startPreview(); else startRun(); } else go('title'); return; } }
    else if (t < ET.credits) {
      if (t > 60 && inp.pressed.START) { app.t = ET.credits; if (!app.endMusic) { AU.playEnding(); app.endMusic = true; } }
    } else if (t < ET.restart) {
      if (inp.pressed.START) app.t = ET.restart;
    } else {
      if (inp.pressed.A || inp.pressed.START) { AU.fadeOut(2.5); app.leaving = 1; app.leaveTo = 'run'; }
      else if (inp.pressed.B || (DEMO && t > ET.restart + 300)) { AU.fadeOut(2.5); app.leaving = 1; app.leaveTo = 'title'; }
    }
    endWorld(app.t);
    if (t >= ET.credits) dim(Math.min(0.45, (t - ET.credits) / 120));
    if (app.leaving) dim(Math.min(1, app.leaving / 100));
    blit(app.shake);
    if (app.leaving) return;
    // 胜利余韵
    if (t < ET.dark) txt(heldCount() >= 3 ? '三道防线，全部守住了！' : '最后一道防线，守住了！', 160, 48, 15, '#ffe066', 'center');
    // 旁白
    NARR.forEach((n, i) => {
      if (t < n[0] || t >= n[1]) return;
      const grp = n[1] === ET.rise ? 0 : n[1] === ET.charge ? 1 : 2;
      const idx = grp === 0 ? 0 : grp === 1 ? i - 1 : i - 4;
      const y = grp === 0 ? 40 : grp === 1 ? 24 + idx * 14 : 22 + idx * 15;
      const last = i === NARR.length - 1;
      cx.globalAlpha = clamp01((n[1] - t) / 40);
      txt(typed(n[2], n[0], t, grp === 2 ? 5 : 4), 160, y, grp === 2 && idx === 3 ? 7.5 : 9, last ? '#ffe066' : grp === 2 ? '#f4ead8' : '#ffffff', 'center', { weight: 800 });
      cx.globalAlpha = 1;
    });
    // 片尾字幕
    if (t >= ET.credits && t < END_T + 60) {
      const u = t - ET.credits;
      CREDITS.forEach((c, i) => {
        const y = CR_Y0 - u * CR_SPEED + i * CR_GAP;
        if (!c[1] || y < 6 || y > 124) return;
        cx.globalAlpha = clamp01((y - 6) / 16) * clamp01((124 - y) / 16) * clamp01((END_T + 60 - t) / 60);
        if (c[0] === 'h') txt(c[1], 160, y, 12, '#ffe066', 'center');
        else if (c[0] === 's') txt(c[1], 160, y, 6.5, '#cfa8ff', 'center', { weight: 700 });
        else txt(c[1], 160, y, 8, '#ffffff', 'center', { weight: 700 });
        cx.globalAlpha = 1;
      });
    }
    if (t >= END_T) {
      const k = clamp01((t - END_T) / 90);
      cx.globalAlpha = k;
      txt('THE END', 160, 40, 18, '#ffe066', 'center');
      txt('谢谢你，让一个 NPC 当了一回主角。', 160, 74, 9, '#ffffff', 'center', { weight: 800 });
      cx.globalAlpha = 1;
      if (t >= ET.restart) {
        cx.globalAlpha = clamp01((t - ET.restart) / 60);
        txt('▶ A 重新开始', 120, 170, 8, '#ffe066', 'center');
        txt('B 回到标题', 210, 170, 7, '#cfe8ff', 'center', { weight: 700 });
        cx.globalAlpha = 1;
      }
    } else if (t > 60 && t < ET.credits) txt('START 跳到片尾', 314, 174, 5, 'rgba(207,232,255,0.5)', 'right', { weight: 600, shadow: false });
  }

  function heldCount() { return (app.lines || []).filter(x => x === 'held').length; }
  function endingVM() {
    const t = app.t, r = app.result || {};
    let en = '';
    for (const n of NARR) if (t >= n[0] && t < n[1]) en = n[3];
    return { t, en, gateLost: t >= ET.gate + 14, plain: t >= ET.bandana, credits: t >= ET.credits, end: t >= ET.restart,
      secs: r.secs, hp: r.hp, stats: r.stats, held: heldCount(), beaten: Math.min(9, app.beaten || 0) };
  }
  window.__ET = ET;

  // ======================= 下屏同步 =======================
  let pulses = [];
  function bottomPulse(type) { pulses.push(type); }
  function vm() {
    const o = { lang: LANG, langSel: app.langSel, scene: app.scene, t: app.t, diff: app.diff, diffCn: DIFF_CN[app.diff], sel: app.sel, paused: app.paused, pmenu: app.pmenu, menu: app.menu, smenu: app.smenu,
      swap: IN.swap, music: AU.musicOn, raw: IN.lastRaw, pulses };
    if (app.scene === 'intro') { o.intro = { t: app.t, en: app.t > IT.l2 ? INTRO.l2en : app.t > IT.l1 ? INTRO.l1en : '', IT }; }
    const g = app.game;
    if (g && (app.scene === 'play' || app.scene === 'levelIntro' || app.scene === 'result' || app.scene === 'cleared' || app.scene === 'breached')) {
      const d = g.def, h = g.hero, T = SH.TUNE.def;
      o.g = {
        world: g.level.world, name: g.level.name, line: g.level.line, phase: g.phase,
        def: { kind: d.kind, skills: SH.DEFENDERS[d.kind].skills, minion: SH.DEFENDERS[d.kind].minion, name: SH.DEFENDERS[d.kind].name, hp: d.hp, max: d.maxHp, dash: d.dash > 0, dashCd: d.dash > 0 ? 1 : d.dashCd / T.dashCd, shellCd: d.shellCd / T.shellCd, summonCd: d.summonCd / T.summonCd, minions: g.minions.filter(m => !m.dead).length, maxMinions: T.maxMinions },
        hero: { lives: g.heroLives, star: Math.ceil(h.star / 60), prop: !!h.prop, round: g.heroRound, tier: h.tier, form: SH.HERO_FORMS[h.tier].name, next: g.heroRound < 2 ? SH.HERO_FORMS[Math.min(2, g.heroRound + 1)].name : null, dead: h.dead },
        secs: Math.floor(g.tick / 60), shells: g.shells.length, items: g.items.length,
      };
    }
    if (app.scene === 'result') o.result = app.result;
    o.lines = app.lines || [];
    if (app.scene === 'breached') o.breached = { stage: app.level + 1, next: SH.DEFENDERS[SH.LEVELS[app.level + 1].defender].name, ready: app.t > 60 };
    if (app.scene === 'cleared') o.cleared = { stage: app.level + 1, next: SH.DEFENDERS[SH.LEVELS[app.level + 1].defender].name, ready: app.t > clearedDone(), t: app.t, bypass: app.level === 0 };
    if (app.scene === 'ending') o.ending = endingVM();
    pulses = [];
    return o;
  }
  LINK.on(m => {
    if (!m || m.type !== 'tap') return;
    AU.init();
    const id = m.id;
    if (id.startsWith('s:') && app.scene === 'lang') {
      const i = +id.slice(2); app.smenu = i;
      if (i === 0) { cycleLang(); AU.sfx('select'); }
      else if (i === 1) { AU.toggleMusic(); AU.sfx('select'); }
      else { AU.sfx('confirm'); go('title'); }
    }
    else if (id === 'settings' && app.scene === 'title') { AU.sfx('select'); go('lang'); }
    else if (id === 'start' && (app.scene === 'title' || app.scene === 'intro')) { AU.sfx('confirm'); if (app.scene === 'intro') go('title'); else startRun(); }
    else if (id === 'diff' && app.scene === 'title') { app.diff = DIFFS[(DIFFS.indexOf(app.diff) + 1) % 3]; localStorage.setItem('sh_diff', app.diff); AU.sfx('select'); }
    else if (id === 'pause' && app.scene === 'play') { app.paused = !app.paused; app.pmenu = 0; AU.sfx('pause'); }
    else if (id.startsWith('pm:') && app.scene === 'play' && app.paused) { app.pmenu = +id.slice(3); pauseAction(app.pmenu); }
    else if (id === 'next' && app.scene === 'breached' && app.t > 60) { AU.stop(); nextLevel(); }
    else if (id === 'retry' && app.scene === 'result') { AU.sfx('confirm'); app.retry++; go('levelIntro'); }
    else if (id === 'next' && app.scene === 'cleared' && app.t > clearedDone()) nextLevel();
    else if ((id === 'restart' || id === 'endtitle') && app.scene === 'ending' && app.t >= ET.restart && !app.leaving) { AU.fadeOut(2.5); app.leaving = 1; app.leaveTo = id === 'restart' ? 'run' : 'title'; }
    else if (id === 'title' && (app.scene === 'result' || app.scene === 'ending')) { AU.stop(); go('title'); }
    else if (id === 'music') { AU.init(); AU.sfx('select'); AU.toggleMusic(); }
    else if (id === 'exit') exitGame();
  });

  // ======================= 主循环 =======================
  const SCENES = { lang: sceneLang, intro: sceneIntro, title: sceneTitle, levelIntro: sceneLevelIntro, play: sceneplay, cleared: sceneCleared, breached: sceneBreached, result: sceneResult, ending: sceneEnding };
  let last = performance.now(), acc = 0, frame = 0;
  function loop(now) {
    acc += Math.min(100, now - last); last = now;
    let steps = 0;
    const need = Math.min(3, Math.floor(acc / (1000 / 60)));
    if (acc > 1000 / 60 * 3) acc = 1000 / 60 * 3;
    while (acc >= 1000 / 60 && steps < 3) {
      acc -= 1000 / 60; steps++;
      DRAW = steps >= need;
      const inp = IN.poll();
      if (inp.pressed.START || inp.pressed.A) AU.init();
      app.t++;
      if (app.shake > 0) app.shake *= 0.85, app.shake < 0.5 && (app.shake = 0);
      SCENES[app.scene](inp);
      frame++;
      if (frame % 4 === 0) LINK.send({ type: 'vm', vm: vm() });
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  ART.check();
  window.__app = app; // 调试用
  window.__go = go;
  if (DEMO && DEMO.cutscenes) startPreview();
  else if (DEMO && DEMO.ending) { app.result = { win: true, secs: 45, hp: 3, stats: { stomps: 7, heroHits: 8 }, defX: 200 }; go('ending'); }
  // 调试：不依赖 requestAnimationFrame 手动推进若干帧
  window.__stepScene = n => { for (let i = 0; i < (n || 1); i++) { DRAW = true; app.t++; SCENES[app.scene](IN.poll()); } LINK.send({ type: 'vm', vm: vm() }); return app.t; };
})();
