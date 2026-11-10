/* STOP · The Stompers · 下屏：指挥台（双方状态、技能冷却、关卡进度）、菜单可触摸点选 */
(function () {
  'use strict';
  const ART = window.ART, LINK = window.LINK, SH = window.SH;
  const W = 256, H = 192;
  const cv = document.getElementById('c'), cx = cv.getContext('2d');
  const FONT = '"Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","PingFang SC",sans-serif';
  let S = 5, OX = 0, OY = 0;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    S = Math.min(cv.width / W, cv.height / H); OX = (cv.width - W * S) / 2; OY = (cv.height - H * S) / 2;
  }
  addEventListener('resize', resize); resize();

  let V = { scene: 'intro', t: 0 }, t = 0, hpShown = null, flash = {}, hits = [];
  let vmAt = 0; // 最近一次收到状态时的本地帧号
  LINK.on(m => { if (m && m.type === 'vm') { V = m.vm; vmAt = t; (V.pulses || []).forEach(p => flash[p] = 30); } });

  const P = (x) => OX + x * S, Q = (y) => OY + y * S;
  function rect(x, y, w, h, c) { cx.fillStyle = c; cx.fillRect(P(x), Q(y), w * S, h * S); }
  function frame(x, y, w, h, fill, edge) {
    rect(x, y, w, h, edge || '#1a1426'); rect(x + 1, y + 1, w - 2, h - 2, fill);
    rect(x + 1, y + 1, w - 2, 1, 'rgba(255,255,255,0.12)');
  }
  function txt(s, x, y, size, color, align, weight) {
    s = I18N.tr(s, V.lang);
    cx.font = `${weight || 900} ${Math.round(size * S)}px ${FONT}`;
    const tw = cx.measureText(s).width, maxW = 248 * S;
    if (tw > maxW) cx.font = `${weight || 900} ${Math.floor(size * S * maxW / tw)}px ${FONT}`;
    cx.textAlign = align || 'left'; cx.textBaseline = 'middle';
    cx.fillStyle = '#1a1426'; cx.fillText(s, P(x) + S * 0.6, Q(y) + S * 0.6);
    cx.fillStyle = color || '#fff'; cx.fillText(s, P(x), Q(y));
  }
  function spr(name, x, y, sc, flip, pal) {
    const c = ART.mk(name, pal, flip);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(c, P(x), Q(y), c.width * sc * S, c.height * sc * S);
  }
  // 可点的区域
  function hot(id, x, y, w, h) { hits.push({ id, x, y, w, h }); }
  function onTap(e) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const pt = e.changedTouches ? e.changedTouches[0] : e;
    const x = ((pt.clientX - r.left) * dpr - OX) / S, y = ((pt.clientY - r.top) * dpr - OY) / S;
    for (const h of hits) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { LINK.send({ type: 'tap', id: h.id }); tapFx = { x, y, t: 0 }; return; }
  }
  let tapFx = null;
  cv.addEventListener('touchstart', e => { e.preventDefault(); onTap(e); }, { passive: false });
  cv.addEventListener('mousedown', onTap);

  function bg() {
    cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
    rect(0, 0, W, H, '#211a35');
    // 细网格
    for (let y = 0; y < H; y += 8) rect(0, y, W, 1, 'rgba(255,255,255,0.025)');
  }

  // —— 按键菱形（与掌机丝印位置一致） ——
  function btnDiamond(cxp, cyp, items) {
    const pos = { X: [0, -1], Y: [-1, 0], A: [1, 0], B: [0, 1] };
    const col = { A: '#e0344c', B: '#f5c84a', X: '#3f8fd9', Y: '#2fb38c' };
    for (const k of ['X', 'Y', 'A', 'B']) {
      const it = items[k]; if (!it) continue;
      const bx = cxp + pos[k][0] * 46, by = cyp + pos[k][1] * 17;
      const ready = it.cd == null || it.cd <= 0;
      const active = it.active;
      frame(bx - 22, by - 7, 44, 14, active ? '#4a3d78' : '#2c2447', active ? '#ffe066' : '#1a1426');
      // 圆钮
      cx.beginPath(); cx.arc(P(bx - 15), Q(by), 5 * S, 0, Math.PI * 2); cx.fillStyle = ready ? col[k] : '#555067'; cx.fill();
      if (!ready) { // 冷却扇形
        cx.beginPath(); cx.moveTo(P(bx - 15), Q(by)); cx.arc(P(bx - 15), Q(by), 5 * S, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - it.cd)); cx.closePath(); cx.fillStyle = col[k]; cx.globalAlpha = 0.65; cx.fill(); cx.globalAlpha = 1;
      }
      txt(k, bx - 15, by + 0.3, 6, '#fff', 'center');
      txt(it.label, bx - 7, by + 0.3, 6.2, ready ? '#ffffff' : '#9a95b5', 'left', 700);
      if (it.badge) txt(it.badge, bx + 19, by + 0.3, 5, '#cfe8ff', 'right', 600);
    }
  }

  // 标题两行：中文版是“名字：进击的 NPC”，英文版是代码里的 STOP 名 + NPCs Strike Back
  function titleLines(y) {
    const T = window.SH_TITLE;
    if (V.lang === 'en') { txtRaw(T.full, W / 2, y, 11, '#ffe066'); txtRaw('NPCs Strike Back', W / 2, y + 14, 7, '#cfe8ff'); }
    else { txtRaw(T.cn, W / 2, y, 9, '#ffffff'); txtRaw('进击的 NPC', W / 2, y + 14, 10, '#ffe066'); }
  }
  function txtRaw(s, x, y, size, color, align) { const l = V.lang; V.lang = 'zh'; txt(s, x, y, size, color, align || 'center'); V.lang = l; }
  // 竖向菜单项：高亮由 V.menu 决定，touch 与摇杆共用同一高亮
  function menuItem(id, y, label, on) {
    frame(16, y, W - 32, 20, on ? '#4a3d78' : '#2c2447', on ? '#ffe066' : '#1a1426');
    txt((on ? '▶ ' : '   ') + label, W / 2, y + 10, 7.5, on ? '#ffe066' : '#ffffff', 'center', 800);
    hot(id, 16, y, W - 32, 20);
  }
  function drawLang() {
    txt('设置', W / 2, 14, 11, '#ffe066', 'center');
    const rows = [
      ['语言', V.langSel === 'zh' ? '中文' : 'English', 1],
      ['音乐', V.music ? '开' : '关', 0],
      ['返回标题', '', 0],
    ];
    rows.forEach((r, i) => {
      const y = 44 + i * 26, on = i === V.smenu;
      frame(16, y - 11, W - 32, 22, on ? '#4a3d78' : '#2c2447', on ? '#ffe066' : '#1a1426');
      txt((on ? '▶ ' : '   ') + r[0], 24, y, 7.5, on ? '#ffe066' : '#ffffff', 'left', 800);
      if (r[1]) (r[2] ? txtRaw : txt)(r[1], W - 26, y, 8, on ? '#ffe066' : '#cfe8ff', 'right', 800);
      hot('s:' + i, 16, y - 11, W - 32, 22);
    });
    txt('上下选择 · 左右调整 · B 返回', W / 2, 152, 6, '#8a86a0', 'center', 600);
  }

  // ———————— 各场景 ————————
  function drawIntro() {
    const it = V.intro || {};
    titleLines(40);
    txt('按 START 跳过', W / 2, 168, 6.5, (t >> 5) % 2 ? '#cfe8ff' : '#8a86a0', 'center', 600);
    hot('start', 0, 0, W, H);
  }

  function drawTitle() {
    titleLines(13);
    menuItem('start', 40, '开始守关', V.menu === 0);
    menuItem('settings', 64, '设置 · 语言 / 音乐', V.menu === 1);
    menuItem('exit', 88, '退出游戏 · 回到桌面', V.menu === 2);
    // 操作卡片
    frame(8, 112, W - 16, 60, '#241d3b', '#1a1426');
    txt('操作', 16, 121, 7, '#cfe8ff', 'left', 700);
    btnDiamond(128, 144, { X: { label: '投掷' }, Y: { label: '召唤' }, A: { label: '跳跃' }, B: { label: '冲撞' } });
    txt('规则：勇者只能踩你的头才算打中你；他从侧面碰到你就会受伤。', W / 2, 180, 5.2, '#8a86a0', 'center', 600);
  }

  const TIPS = [
    '勇者落下来时按 B 冲撞：冲撞中被踩不掉血。',
    '勇者顶开问号块会掉出勇气果，抢先吃掉能回 1 颗心！',
    '你扔出去的东西被勇者踩停后会被踢回来，闪红的会打到你。',
    '你冲撞时撞到闪红的投掷物，会把它弹回去。',
    '小兵能逼勇者跳起来——趁他落地前去堵他。',
    '火焰勇者会远程扔火球，冲撞能把火球弹掉。',
    '勇者顶出绿色果子会多一条命——抢先吃掉它！',
    '戴螺旋桨帽的勇者能在空中再起飞一次，别站在他正下方。',
    '勇者吃了无敌星，10 秒内碰到就掉血——赶紧跑，等它闪烁结束。',
  ];
  function drawPlay() {
    const g = V.g; if (!g) return;
    // 顶栏
    frame(0, 0, W, 20, '#2c2447');
    txt(`${g.world}/3  ${g.name} · ${g.line}`, 6, 10, 7, '#ffe066', 'left');
    txt(`${Math.floor(g.secs / 60)}:${String(g.secs % 60).padStart(2, '0')}`, 214, 10, 7, '#cfe8ff', 'center', 700);
    frame(232, 3, 20, 14, '#3b2f63'); txt('II', 242, 10, 7, '#ffffff', 'center'); hot('pause', 228, 0, 28, 20);

    // 守关者卡
    const d = g.def, hurt = flash.defHurt > 0;
    frame(4, 24, 122, 78, hurt && (t >> 2) % 2 ? '#6b2a3c' : '#2c2447', '#1a1426');
    const K = ART.KINDS[d.kind] || ART.KINDS.turtle, pn = d.dash ? ((t >> 2) % 2 ? 'spin1' : 'spin2') : (hurt ? K.hurt : ((t >> 4) % 2 ? K.walk2 : K.walk1));
    const pc = ART.S[pn], ps = pc[0].length > 18 ? 2.2 : 3;
    spr(pn, 34 - pc[0].length * ps / 2, 92 - pc.length * ps, ps, K.faceLeft, d.dash ? K.fx : null);
    txt(d.name, 62, 34, 8, '#ffffff');
    txt('守关者 · 你', 62, 46, 5.5, '#7dffb0', 'left', 700);
    for (let i = 0; i < d.max; i++) spr(i < d.hp ? 'heart' : 'heartE', 60 + (i % 4) * 15, 56 + Math.floor(i / 4) * 15, 2);
    txt(`${d.minion || '小兵'} ${d.minions}/${d.maxMinions}`, 62, 93, 5.5, '#c7a6ff', 'left', 700);

    // 勇者卡
    const h = g.hero, pw = flash.powerup > 0 || flash.nextHero > 0;
    frame(130, 24, 122, 78, pw && (t >> 2) % 2 ? '#6b5a2a' : '#2c2447');
    const hs = h.tier > 0 ? 'heroB_stand' : 'heroS_stand';
    spr(h.dead ? 'heroS_dead' : hs, 138, h.tier > 0 ? 30 : 46, 2.6, false, h.tier === 2 ? ART.firePal : null);
    txt('勇者', 178, 34, 8, '#ffffff');
    txt(`第 ${h.round + 1} 位`, 178, 46, 5.5, '#ffb38a', 'left', 700);
    if (h.star > 0) txt(`★ 无敌 ${h.star}s`, 248, 46, 5.5, (t >> 2) % 2 ? '#ffe066' : '#ff9f43', 'right', 800);
    else if (h.prop) txt('螺旋桨', 248, 46, 5.5, '#7dffb0', 'right', 800);
    txt(h.dead ? '倒下了' : h.form, 178, 58, 7, h.tier === 2 ? '#ff9f43' : '#ffe066');
    txt('剩余命', 178, 72, 5.5, '#cfe8ff', 'left', 700);
    for (let i = 0; i < Math.max(3, h.lives); i++) {
      const alive = i < h.lives;
      rect(178 + i * 12, 78, 9, 9, alive ? '#8fa3c0' : '#3a3352'); rect(178 + i * 12, 78, 9, 2, alive ? '#e0344c' : '#3a3352');
    }
    if (h.next) txt(`下一位：${h.next}`, 178, 95, 5.5, '#8a86a0', 'left', 600);

    // 技能
    frame(4, 106, 248, 66, '#241d3b');
    btnDiamond(128, 139, {
      X: { label: (d.skills || {}).X || '投掷', cd: d.shellCd },
      Y: { label: (d.skills || {}).Y || '召唤', cd: d.minions >= d.maxMinions ? 1 : d.summonCd, badge: '' },
      A: { label: '跳跃' },
      B: { label: (d.skills || {}).B || '冲撞', cd: d.dash ? 0 : d.dashCd, active: d.dash },
    });
    // 提示轮播
    const tip = TIPS[Math.floor(t / 420) % TIPS.length];
    txt('💡 ' + tip, W / 2, 182, 5.6, '#cfe8ff', 'center', 600);

    if (V.paused) drawPause();
    if (g.phase === 'victory') banner('守住了！', '#ffe066');
    if (g.phase === 'defeat') banner('防线失守', '#ff8a8a');
  }
  function banner(s, c) { frame(30, 70, 196, 40, '#1a1426', c); txt(s, W / 2, 90, 14, c, 'center'); }

  function drawPause() {
    rect(0, 0, W, H, 'rgba(10,8,24,0.85)');
    txt('暂停', W / 2, 16, 10, '#ffe066', 'center');
    const items = ['继续', '重新开始', 'A/B 键对调' + (V.swap && V.swap.ab ? '（已对调）' : ''), 'X/Y 键对调' + (V.swap && V.swap.xy ? '（已对调）' : ''), '音乐：' + (V.music ? '开' : '关'), '回到标题', '退出游戏'];
    items.forEach((s, i) => {
      const y = 28 + i * 21, on = i === V.pmenu;
      frame(48, y, 160, 20, on ? '#4a3d78' : '#2c2447', on ? '#ffe066' : '#1a1426');
      txt(s, W / 2, y + 10, 7.5, on ? '#ffe066' : '#ffffff', 'center', 800);
      hot('pm:' + i, 48, y, 160, 20);
    });
    txt('按键检测：' + (V.raw || '按任意键…'), W / 2, 184, 5.5, '#8a86a0', 'center', 600);
  }

  function drawResult() {
    const r = V.result || {}, g = V.g || {};
    const held = r.held != null ? r.held : 0;
    txt('防线失守 · 公主被带走了', W / 2, 26, 12, '#ff8a8a', 'center');
    frame(20, 44, 216, 56, '#2c2447');
    const st = r.stats || { stomps: 0, heroHits: 0 };
    txt(`这一局 ${r.runSecs || 0} 秒`, 34, 58, 7, '#ffffff', 'left', 700);
    txt(`三道防线守住了 ${held} 道`, 34, 74, 7, '#ffffff', 'left', 700);
    txt(`被踩 ${st.stomps} 次`, 140, 58, 7, '#ffffff', 'left', 700);
    txt(`打中勇者 ${st.heroHits} 次`, 140, 74, 7, '#ffffff', 'left', 700);
    dots(W / 2, 116, 3);
    txt('三关必须全部守住，公主才不会被救走。', W / 2, 140, 6.5, '#cfe8ff', 'center', 700);
    frame(20, 152, 104, 26, '#3b2f63', '#ffe066'); txt('A 从第一关重开', 72, 165, 7.5, '#ffe066', 'center'); hot('restart', 20, 152, 104, 26);
    frame(132, 152, 104, 26, '#2c2447'); txt('B 回到标题', 184, 165, 7.5, '#ffffff', 'center'); hot('title', 132, 152, 104, 26);
  }

  function dots(cx0, y, done) {
    const names = ['草原', '地下水道', '黄昏城墙'];
    for (let i = 0; i < 3; i++) {
      const x = cx0 + (i - 1) * 60;
      const lost = i < done && (V.lines || [])[i] === 'lost';
      if (i < 2) rect(x + 6, y - 0.5, 48, 1, i < done ? '#ffe066' : '#4a4366');
      cx.beginPath(); cx.arc(P(x), Q(y), 5 * S, 0, Math.PI * 2); cx.fillStyle = lost ? '#ff6b6b' : i < done ? '#7dffb0' : i === done ? '#ffe066' : '#4a4366'; cx.fill();
      txt(lost ? '✗' : i < done ? '✓' : String(i + 1), x, y + 0.3, 6, '#1a1426', 'center');
      txt(names[i], x, y + 11, 5.5, i <= done ? '#ffffff' : '#8a86a0', 'center', 700);
    }
  }
  // —— 第一关跨屏挖地道：勇者从上屏的竖井掉下来，在成绩卡 / 按钮 / 屏幕底之间按重力走一圈，靠着卡片右侧搭梯子爬回上屏 ——
  // 时刻用上屏的 t（随状态每 4 帧发来一次），中间几帧本地补齐，保证两块屏对得上
  function bypassT() { return V.cleared.t + Math.min(4, t - vmAt); }
  function dots2(list) { for (const [x, y, s, c] of list) rect(x, y, s, s, c); }
  function drawBypassBottom() {
    const BP = window.SH_BYPASS, T = BP.T1, B = BP.B1, r = BP.r1;
    const tt = bypassT(), ct = tt - T.inT; // ct = 下屏路线上的时刻
    const brk = T.digT + T.digLen;         // 上屏竖井挖穿的那一刻
    // 入口：顶边被挖开一个洞，先往下掉土
    if (tt >= brk - 6) {
      rect(B.inX - 8, 0, 16, 3, '#241b38'); rect(B.inX - 9, 3, 18, 1, '#7e3b22');
      dots2(BP.spray(tt - (brk - 6), B.inX, 2, { len: 26, every: 2, floor: B.card - 1, dir: 'down' }));
    }
    // 出口：顶边往上挖开
    const up = T.digUpSeg;
    if (ct >= up.t0) {
      const eu = ct - up.t0;
      rect(B.ladderX - 8, 0, 16, 3, '#241b38'); rect(B.ladderX - 9, 3, 18, 1, '#7e3b22');
      if (eu < up.dur + 20) dots2(BP.spray(eu, B.ladderX, 6, { len: up.dur, every: 2, floor: B.floor, dir: 'down' }));
    }
    // 梯子
    const lt = r.ladderAt(ct);
    if (lt != null && ct < r.dur + 120) {
      const lx0 = B.ladderX - 5;
      rect(lx0, lt, 2, B.floor - lt, '#6e4126'); rect(lx0 + 9, lt, 2, B.floor - lt, '#6e4126');
      for (let y = B.floor - 3; y > lt + 1; y -= 6) rect(lx0 + 2, y, 7, 1, '#a0683a');
      rect(lx0 - 1, lt, 1, B.floor - lt, '#1a1426'); rect(lx0 + 11, lt, 1, B.floor - lt, '#1a1426');
    }
    // 落地扬起的灰
    for (const L of r.lands) {
      const u = ct - L.t; if (u < 0 || u > 14) continue;
      for (let i = 0; i < 4; i++) { const s = i < 2 ? -1 : 1, d = 3 + u * (0.6 + (i % 2) * 0.4); rect(L.x + s * d - 1, L.y - 2 - (i % 2) - u * 0.1, 2, 1, `rgba(230,220,255,${1 - u / 14})`); }
    }
    // 人
    const p = r.at(ct); if (!p) return;
    let name = 'heroS_stand', face = p.face;
    if (p.pose === 'jump') name = 'heroS_jump';
    else if (p.pose === 'run') name = (t >> 2) % 2 ? 'heroS_run' : 'heroS_stand';
    else if (p.pose === 'climb') { name = 'heroS_climb'; face = (p.seg.digUp ? (t >> 3) : Math.floor(p.y / 6)) % 2 ? -1 : 1; }
    const c = ART.S[name];
    // 爬进顶边的洞时，头先没进去
    if (p.y < 18) { cx.save(); cx.beginPath(); cx.rect(P(0), Q(0), W * S, H * S); cx.clip(); }
    spr(name, Math.round(p.x - c[0].length / 2), Math.round(p.y - c.length), 1, face < 0, null);
    if (p.y < 18) cx.restore();
    if (p.seg.digUp) { // 举着铲子往上挖
      const sx = Math.round(p.x + 4), tip = ((t >> 3) % 2) ? 1 : 4;
      rect(sx, tip + 2, 1, Math.max(1, p.y - 12 - tip), '#6e4126'); rect(sx - 2, tip, 5, 2, '#b9b9c8');
    }
  }
  function drawBreached() {
    const c = V.breached || {}, g = V.g || {};
    txt(`第 ${c.stage} 道防线 · 失守了`, W / 2, 26, 12, '#ff8a8a', 'center');
    frame(20, 44, 216, 56, '#2c2447');
    const K = ART.KINDS[(g.def || {}).kind] || ART.KINDS.turtle, pc = ART.S[K.hurt];
    spr(K.hurt, 52 - pc[0].length, 94 - pc.length * 2, 2, K.faceLeft);
    txt((g.def || {}).name || '', 84, 62, 8, '#ffffff');
    txt(`坚持了 ${g.secs || 0} 秒 · 勇者闯过去了`, 84, 80, 6.5, '#cfe8ff', 'left', 700);
    dots(W / 2, 118, c.stage || 1);
    txt('公主还在，守住剩下的防线。', W / 2, 142, 6.5, '#ff9a9a', 'center', 700);
    txt(`下一位守关者：${c.next || ''}`, W / 2, 156, 7, '#7dffb0', 'center');
    if (c.ready) { frame(68, 168, 120, 20, '#3b2f63', '#ffe066'); txt('A 继续', W / 2, 178, 7.5, '#ffe066', 'center'); hot('next', 68, 168, 120, 20); }
  }
  function drawCleared() {
    const c = V.cleared || {}, g = V.g || {};
    txt(`第 ${c.stage} 道防线 · 守住了！`, W / 2, 26, 12, '#ffe066', 'center');
    frame(20, 44, 216, 56, '#2c2447');
    const K = ART.KINDS[(g.def || {}).kind] || ART.KINDS.turtle, pc = ART.S[K.walk1];
    spr(K.walk1, 52 - pc[0].length, 94 - pc.length * 2, 2, K.faceLeft);
    txt((g.def || {}).name || '', 84, 62, 8, '#ffffff');
    txt(`用时 ${g.secs || 0} 秒 · 剩余 ${(g.def || {}).hp || 0} ♥`, 84, 80, 6.5, '#cfe8ff', 'left', 700);
    dots(W / 2, 124, c.stage || 1);
    txt(`下一位守关者：${c.next || ''}`, W / 2, 152, 7.5, '#7dffb0', 'center');
    if (c.ready) { frame(68, 164, 120, 20, '#3b2f63', '#ffe066'); txt('A 继续', W / 2, 174, 7.5, '#ffe066', 'center'); hot('next', 68, 164, 120, 20); }
    else { frame(68, 164, 120, 20, '#2c2447', '#1a1426'); txt('A 继续', W / 2, 174, 7.5, '#6f6a8a', 'center'); } // 动画没放完：按钮先灰着（勇者会从上面走过）
    if (c.bypass && window.SH_BYPASS && c.t != null) drawBypassBottom();
  }

  // ———— 结局：守关日志 ————
  function drawEnding() {
    const e = V.ending || {};
    txt('守关日志', 12, 14, 9, '#ffe066');
    frame(8, 26, 240, 96, '#2c2447');
    spr(e.plain ? 'turtleP_walk1' : 'turtle_walk1', 12, 71, 1.5); spr('shroom', 36, 74, 1.5); spr('dragon', 56, 64, 1.5, true);
    txt('三位守关者', 48, 108, 5.5, '#cfe8ff', 'center', 700);
    const hd = e.held != null ? e.held : 3, bt = e.beaten != null ? e.beaten : 9;
    const rows = [['击退勇者', `${bt} / 9`, bt >= 9 ? '#7dffb0' : '#ffe066'], ['守住防线', `${hd} / 3`, hd >= 3 ? '#7dffb0' : '#ffe066'], ['总用时', `${e.secs || 0} 秒`, '#ffffff'],
      ['城门', e.gateLost ? '已失守' : '守住了', e.gateLost ? '#ff6b6b' : '#7dffb0']];
    rows.forEach((r, i) => { const y = 42 + i * 20; txt(r[0], 92, y, 7, '#cfe8ff', 'left', 700); txt(r[1], 236, y, 8, r[2], 'right'); rect(92, y + 8, 144, 1, 'rgba(255,255,255,0.08)'); });
    if (e.gateLost) { // 盖章
      cx.save(); cx.translate(P(184), Q(104)); cx.rotate(-0.2);
      cx.strokeStyle = 'rgba(224,52,76,0.9)'; cx.lineWidth = S * 1.4; cx.strokeRect(-34 * S, -9 * S, 68 * S, 18 * S);
      cx.font = `900 ${Math.round(9 * S)}px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = 'rgba(224,52,76,0.9)'; cx.fillText('剧情需要', 0, 0.5 * S);
      cx.restore();
    }
    if (e.credits) {
      txt('谢谢你，让一个 NPC 当了一回主角。', W / 2, 138, 7.5, '#ffffff', 'center', 800);
      if (e.end) { frame(20, 164, 104, 20, '#3b2f63', '#ffe066'); txt('A 重新开始', 72, 174, 7.5, '#ffe066', 'center'); hot('restart', 20, 164, 104, 20);
        frame(132, 164, 104, 20, '#2c2447'); txt('B 回到标题', 184, 174, 7, '#ffffff', 'center'); hot('endtitle', 132, 164, 104, 20); }
    }
  }

  function loop() {
    t++; hits = [];
    for (const k in flash) if (flash[k] > 0) flash[k]--;
    bg();
    const s = V.scene;
    if (s === 'lang') drawLang();
    else if (s === 'intro') drawIntro();
    else if (s === 'title') drawTitle();
    else if (s === 'ending') drawEnding();
    else if (s === 'levelIntro' || s === 'play') drawPlay();
    else if (s === 'result') drawResult();
    else if (s === 'cleared') drawCleared();
    else if (s === 'breached') drawBreached();
    if (tapFx) { tapFx.t++; cx.strokeStyle = 'rgba(255,224,102,' + (1 - tapFx.t / 15) + ')'; cx.lineWidth = S; cx.beginPath(); cx.arc(P(tapFx.x), Q(tapFx.y), (4 + tapFx.t) * S, 0, Math.PI * 2); cx.stroke(); if (tapFx.t > 15) tapFx = null; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.__draw = () => { const r = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; loop(); window.requestAnimationFrame = r; }; // 调试：手动画一帧
})();
