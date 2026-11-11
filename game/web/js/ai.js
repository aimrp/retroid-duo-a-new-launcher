/* 进击的 NPC · AI
 * SH_AI.hero(st)     勇者 AI：躲壳/甲虫、抢问号块变强、预测抛物线去踩守关者、火焰形态远程放火球
 * SH_AI.defender(st) 守关者机器人：只给模拟器调平衡和标题画面演示用，玩家实际自己操作 */
(function (root) {
  'use strict';
  const SH = root.SH;
  const cx = b => b.x + b.w / 2;
  const bot = b => b.y + b.h;

  // 每一条命的水平：反应帧数、失误率、想变强的概率
  const SKILL = [
    { react: 15, err: 0.30, power: 0.75, aim: 7 },
    { react: 12, err: 0.22, power: 0.85, aim: 5 },
    { react: 9, err: 0.15, power: 0.9, aim: 3 },
  ];
  const DIFF = { easy: 1.45, normal: 1.0, hard: 0.65 };

  function skillOf(st) {
    const base = SKILL[Math.min(2, st.heroRound)], k = st.level.ai || 1;
    return { react: Math.round(base.react * k), err: Math.min(0.6, base.err * k), power: base.power, aim: base.aim * k };
  }

  /** 预测：按某个操作模拟未来若干帧，看能否踩中守关者。返回命中帧或 -1 */
  function predictStomp(st, dir, jump, frames, noise) {
    const h = st.hero, d = st.def, P = SH.TUNE.hero;
    const b = { x: h.x, y: h.y, w: h.w, h: h.h, vx: h.vx, vy: h.vy, onGround: h.onGround };
    let dxp = d.x + noise, dyp = d.y, dvx = d.dash > 0 ? d.vx : d.vx * 0.6, dashLeft = d.dash;
    if (jump && b.onGround) { b.vy = -P.jump; b.onGround = false; }
    const solids = st.solids;
    for (let t = 1; t <= frames; t++) {
      const prevBottom = b.y + b.h;
      b.vx += dir * (b.onGround ? P.acc : P.accAir);
      if (Math.abs(b.vx) > P.max) b.vx = Math.sign(b.vx) * P.max;
      if (!dir && b.onGround) b.vx *= 0.8;
      SH.applyGravity(b, jump && t < 22);
      SH.moveBody(b, solids);
      if (dashLeft > 0) { dashLeft--; if (!dashLeft) dvx *= 0.3; }
      dxp = Math.max(0, Math.min(304 - d.w, dxp + dvx));
      const dd = { x: dxp, y: dyp, w: d.w, h: d.h };
      if (SH.overlap(b, dd)) {
        if (b.vy > 0 && prevBottom <= dyp + 6) return t;
        return -1; // 撞上侧面
      }
      if (b.onGround && t > 3 && jump) return -1;
    }
    return -1;
  }

  /** 找到包含 x、高度为 y 的平台 */
  function ledgeAt(lv, x, y) {
    for (const L of lv.ledges) if (x >= L.x1 - 2 && x <= L.x2 + 2 && Math.abs(L.y - y) < 4) return L;
    return null;
  }

  /** 导航：去 (tx, 站立高度 ty)。返回 {dir, jump} */
  function navigate(st, tx, ty, m) {
    const h = st.hero, lv = st.level, hc = cx(h), hb = bot(h);
    const out = { dir: 0, jump: false };
    if (ty < hb - 14) {
      // 目标在更高的平台
      let L = ledgeAt(lv, tx, ty);
      if (!L) { out.dir = Math.sign(tx - hc); return out; }
      // 当前高度跳不上去（>60px）先去中间层
      if (hb - L.y > 60) {
        let best = null;
        for (const M of lv.ledges) {
          if (M.y > L.y + 10 && hb - M.y <= 60 && hb - M.y > 14) {
            const dist = Math.min(Math.abs(hc - M.x1), Math.abs(hc - M.x2));
            if (!best || dist < best.d) best = { L: M, d: dist };
          }
        }
        if (best) L = best.L; else { out.dir = Math.sign(tx - hc); return out; }
      }
      const under = hc > L.x1 - 6 && hc < L.x2 + 6;
      const leftEdge = L.x1 - 14, rightEdge = L.x2 + 14;
      const side = Math.abs(hc - leftEdge) < Math.abs(hc - rightEdge) ? -1 : 1;
      const edgeX = side < 0 ? leftEdge : rightEdge;
      if (under) { out.dir = side; return out; }
      if (Math.abs(hc - edgeX) < 8 && h.onGround) { out.jump = true; out.dir = -side; return out; }
      out.dir = Math.sign(edgeX - hc);
      return out;
    }
    out.dir = Math.abs(tx - hc) < 3 ? 0 : Math.sign(tx - hc);
    return out;
  }

  function heroAI(st) {
    const h = st.hero, d = st.def, rnd = st.rng;
    const sk = skillOf(st);
    let m = st.ai;
    if (!m) m = st.ai = { think: 0, goal: 'attack', hold: 0, dodgeAt: {}, wantPower: rnd() < sk.power, keepDist: 0, wait: 0, noise: 0, lastX: h.x, stuck: 0 };
    const inp = { left: false, right: false, jump: false, jumpP: false, run: false, fireP: false };
    if (m.hold > 0) { m.hold--; inp.jump = true; }
    const hc = cx(h), dc = cx(d), dx = dc - hc;
    const sameBand = Math.abs(bot(h) - bot(d)) < 12;
    let dir = 0, wantJump = false, steer = null;

    // —— 思考节奏 ——
    if (--m.think <= 0) {
      m.think = sk.react + Math.floor(rnd() * 6);
      m.noise = (rnd() - 0.5) * 2 * sk.aim;
      const activeQ = st.solids.filter(s => s.kind === 'q' && s.active);
      if (st.items.some(i => i.rise <= 0)) m.goal = 'item';
      else if ((h.tier < 2 || (!h.prop && st.level.items && st.level.items.prop) || (st.level.items && st.level.items.star)) && m.wantPower && activeQ.length && rnd() < 0.7) m.goal = 'power';
      else if (h.tier === 2 && rnd() < 0.8) m.goal = 'snipe';
      else m.goal = 'attack';
      if (rnd() < 0.12) m.wait = 10 + Math.floor(rnd() * 20); // 偶尔犹豫
      // 卡住检测
      if (Math.abs(h.x - m.lastX) < 2 && h.onGround) m.stuck++; else m.stuck = 0;
      m.lastX = h.x;
    }

    // —— 1. 躲避威胁（壳、甲虫、冲撞） ——
    const threats = [];
    for (const s of st.shells) if (s.state === 'moving') threats.push(s);
    for (const mm of st.minions) if (!mm.dead) threats.push(mm);
    if (d.dash > 0) threats.push(d);
    let dodge = false;
    for (const t of threats) {
      if (Math.abs(bot(t) - bot(h)) > 14) continue;
      const rel = (cx(t) - hc);
      const closing = -(t.vx - h.vx) * Math.sign(rel);
      if (closing <= 0.1) { if (Math.abs(rel) < (t.w + h.w) / 2 + 4 && h.onGround) dodge = true; continue; }
      const gap = Math.abs(rel) - (t.w + h.w) / 2;
      const tti = gap / closing;
      const key = t === d ? 'def' : (t.x | 0) + ':' + (t.vx > 0);
      if (m.dodgeAt[key] === undefined) m.dodgeAt[key] = rnd() < sk.err ? Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 14);
      if (tti <= m.dodgeAt[key] && h.onGround) dodge = true;
    }
    if (st.tick % 120 === 0) m.dodgeAt = {};
    if (dodge) { wantJump = true; dir = Math.sign(dx) || h.face; }

    // —— 2. 空中：微调方向去踩，或者避开落点 ——
    if (!h.onGround) {
      let best = null;
      if (h.vy > -2) {
        for (const sd of [Math.sign(dx), 0, -Math.sign(dx)]) {
          const t = predictStomp(st, sd, inp.jump, 40, m.noise);
          if (t > 0 && (!best || t < best.t)) best = { sd, t };
        }
      }
      if (best) steer = best.sd;
      else if (Math.abs(dx) < 26 && bot(h) < d.y + 4) steer = -Math.sign(dx) || 1; // 别落在他旁边
    }

    // —— 3. 目标 ——
    if (m.wait > 0 && !dodge) { m.wait--; }
    else if (!dodge) {
      if (m.goal === 'item') {
        const it = st.items.filter(i => i.rise <= 0).sort((a, b) => Math.abs(cx(a) - hc) - Math.abs(cx(b) - hc))[0];
        if (it) { const n = navigate(st, cx(it), bot(it), m); dir = n.dir; wantJump = n.jump; }
        else m.goal = 'attack';
      } else if (m.goal === 'power') {
        const qs = st.solids.filter(s => s.kind === 'q' && s.active);
        const q = qs.sort((a, b) => Math.abs(cx(a) - hc) - Math.abs(cx(b) - hc))[0];
        if (!q) m.goal = 'attack';
        else {
          // 站在方块下方的地面（或平台）
          const standY = bot(h);
          const qc = q.x + q.w / 2;
          if (q.y + q.h < standY && standY - (q.y + q.h) < 56) {
            if (Math.abs(qc - hc) < 4) { dir = 0; if (h.onGround) wantJump = true; }
            else dir = Math.sign(qc - hc);
          } else { const n = navigate(st, qc, st.level.groundY || 156, m); dir = n.dir; wantJump = n.jump; }
        }
      } else if (m.goal === 'snipe') {
        const dist = Math.abs(dx);
        if (sameBand || Math.abs(bot(h) - bot(d)) < 20) {
          if (dist < 56) dir = -Math.sign(dx);
          else if (dist > 130) dir = Math.sign(dx);
          if (h.face !== Math.sign(dx)) { dir = Math.sign(dx); }
          if (h.face === Math.sign(dx) && h.fireCd <= 0 && rnd() < 0.35) inp.fireP = true;
          if (Math.abs(h.x - 0) < 6 || h.x > 292) wantJump = h.onGround && rnd() < 0.2; // 被逼到墙角就跳
        } else {
          const n = navigate(st, dc, bot(d), m); dir = n.dir; wantJump = n.jump;
        }
      } else {
        // 进攻：靠近，看准时机起跳踩头
        if (Math.abs(bot(h) - bot(d)) > 14 && bot(d) < bot(h)) {
          const n = navigate(st, dc, bot(d), m); dir = n.dir; wantJump = n.jump;
        } else {
          dir = Math.sign(dx);
          if (h.onGround && st.tick % 2 === 0) {
            const tj = predictStomp(st, Math.sign(dx), true, 50, m.noise);
            if (tj > 0) wantJump = true;
            else {
              const tw = predictStomp(st, Math.sign(dx), false, 30, m.noise);
              if (tw < 0 && Math.abs(dx) < 28 + Math.abs(d.vx) * 6 && sameBand) {
                // 太近又踩不到：跳过去或后撤
                if (rnd() < 0.5) wantJump = true; else dir = -Math.sign(dx);
              }
            }
          }
          if (Math.abs(dx) > 90) inp.run = true;
        }
      }
    }

    // 无敌星：直接冲过去撞
    if (h.star > 0) {
      steer = null; dir = Math.sign(dx) || h.face; inp.run = true;
      wantJump = h.onGround && (bot(d) < bot(h) - 12 || (Math.abs(dx) < 40 && !d.onGround) || m.stuck > 2);
    }
    // 螺旋桨：空中二段起飞、按住慢慢飘着找踩点
    if (h.prop && !h.onGround) {
      if (!h.spun && h.vy > 0.6 && h.star <= 0 && (Math.abs(dx) < 70 || m.goal === 'item') && rnd() < 0.1 + 0.1 * (1 - sk.err)) { inp.jumpP = true; m.hold = 30; }
      if (bot(h) < d.y && Math.abs(dx) < 40) m.hold = Math.max(m.hold, 4);
    }
    // 卡住了就跳
    if (m.stuck > 4 && h.onGround) { wantJump = true; m.stuck = 0; }

    if (steer !== null) dir = steer;
    if (wantJump && h.onGround) { inp.jumpP = true; inp.jump = true; m.hold = 20 + Math.floor(rnd() * 6); }
    if (dir < 0) inp.left = true; else if (dir > 0) inp.right = true;
    return inp;
  }

  // ———————————— 守关者机器人 ————————————
  function defenderAI(st, level) {
    const d = st.def, h = st.hero, rnd = st.rng;
    const q = level == null ? 0.7 : level; // 0..1 水平
    let m = st.dai;
    if (!m) m = st.dai = { think: 0, move: 0, pref: 34 };
    const inp = { left: false, right: false, jump: false, jumpP: false, atkP: false, skillP: false, summonP: false, aimX: 0 };
    if (st.phase !== 'fight' || d.dead) return inp;
    const hc = cx(h), dc = cx(d), dx = hc - dc, adx = Math.abs(dx);
    const hdir = Math.sign(dx) || 1;
    let dir = 0;
    if (h.star > 0 && m.react !== false) { // 无敌星：逃
      dir = -hdir; if ((dc < 24 && dir < 0) || (dc > 284 && dir > 0)) { dir = hdir; if (d.onGround && adx < 50) inp.jumpP = true; }
      if (adx < 30 && d.onGround && rnd() < 0.2) inp.jumpP = true;
      if (dir < 0) inp.left = true; else inp.right = true; inp.jump = inp.jumpP; return inp;
    }
    if (--m.think <= 0) { m.think = Math.round(6 + (1 - q) * 14 + rnd() * 6); m.pref = 26 + rnd() * 30; m.react = rnd() < q; }
    // 头顶危险
    const above = bot(h) <= d.y + 2 && adx < 26 && h.vy > -1 && d.y - bot(h) < 46;
    if (above && m.react) {
      if (d.dashCd <= 0 && rnd() < 0.6) { inp.atkP = true; dir = -hdir; }
      else dir = -hdir;
    }
    // 飞来的火球 / 被踢的壳
    for (const f of st.fireballs) if (Math.abs(cx(f) - dc) < 36 && Math.sign(f.vx) === Math.sign(dc - cx(f)) && m.react) { if (d.dashCd <= 0) inp.atkP = true; else inp.jumpP = true; }
    for (const s of st.shells) if (s.state === 'kicked' && Math.abs(cx(s) - dc) < 44 && Math.sign(s.vx) === Math.sign(dc - cx(s)) && m.react) { if (d.dashCd <= 0) inp.atkP = true; else inp.jumpP = true; }
    if (!above) {
      // 进攻
      const band = Math.abs(bot(h) - bot(d)) < 12;
      if (band && adx < 70 && adx > 14 && d.dashCd <= 0 && h.onGround && rnd() < 0.08 * q + 0.02) { inp.atkP = true; dir = hdir; }
      if (Math.abs(bot(h) - bot(d)) < 16 && d.shellCd <= 0 && adx > 36 && rnd() < 0.05) { inp.skillP = true; inp.aimX = hdir; d.face = hdir; }
      if (d.summonCd <= 0 && rnd() < 0.012) { d.face = hdir; inp.summonP = true; }
      // 走位：保持一定距离
      if (!dir) {
        if (adx > m.pref + 8) dir = hdir; else if (adx < m.pref - 10) dir = -hdir;
        if ((dc < 20 && dir < 0) || (dc > 290 && dir > 0)) dir = 0;
      }
      // 吃道具
      const it = st.items.find(i => i.rise <= 0 && Math.abs(cx(i) - dc) < 50 && Math.abs(bot(i) - bot(d)) < 10);
      if (it) dir = Math.sign(cx(it) - dc);
      if (rnd() < 0.004) inp.jumpP = true;
    }
    // 会扇翅膀的龙：往下掉、勇者在头顶附近时补一下二连跳
    if (d.kind === 'dragon' && !d.onGround && !d.flapped && d.vy > 0.5 && Math.abs(cx(st.hero) - dc) < 40 && rnd() < 0.08) inp.jumpP = true;
    if (dir < 0) inp.left = true; else if (dir > 0) inp.right = true;
    inp.jump = inp.jumpP;
    return inp;
  }

  root.SH_AI = { hero: heroAI, defender: defenderAI, predictStomp };
})(typeof window !== 'undefined' ? window : globalThis);
