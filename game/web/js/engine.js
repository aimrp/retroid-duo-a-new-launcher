/* STOP · The Stompers · 游戏核心逻辑（纯逻辑，无 DOM）。浏览器与 Node 模拟器共用。
 * 坐标：逻辑分辨率 320×180，60 帧/秒定步长。速度单位 px/帧。 */
(function (root) {
  'use strict';
  const W = 320, H = 180;
  const T = 16;

  // ---------- 随机数（可复现） ----------
  function makeRng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // ---------- 数值（经模拟器调参，见 sim/README） ----------
  const TUNE = {
    grav: 0.30, gravFast: 0.62, maxFall: 6.2,
    hero: { acc: 0.16, accAir: 0.11, fric: 0.14, max: 1.75, run: 2.15, jump: 5.95, bounce: 4.6, bounceHold: 6.0 },
    def: { acc: 0.16, accAir: 0.12, fric: 0.18, max: 1.35, jump: 5.55,
      hp: 6, dashSpeed: 3.5, dashFrames: 26, dashCd: 50, shellCd: 200, summonCd: 400, maxMinions: 2, inv: 200, healBetween: 4 },
    shell: { speed: 3.0, kick: 3.6, bounces: 3, stillLife: 240 },
    minion: { speed: 0.7 },
    fire: { speed: 3.2, cd: 40, max: 2, bounceV: 2.7, life: 110 },
    qRespawn: 780,
    heroInv: 100, spawnInv: 90,
    heroLives: 3, starFrames: 600, spin: 6.0, propFall: 1.3, maxLives: 5,
  };

  // ---------- 关卡 ----------
  function blocks(x0, y, n, qAt) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: x0 + i * T, y, w: T, h: T, kind: qAt && qAt.indexOf(i) >= 0 ? 'q' : 'brick' });
    return out;
  }
  // 三道防线：勇者一路往城堡推进。ai = 勇者反应/失误倍率（越大越笨）
  function frame3(extra) {
    return [{ x: -16, y: -200, w: 16, h: 400, kind: 'wall' }, { x: 304, y: -200, w: 32, h: 400, kind: 'gate' },
      { x: 0, y: 156, w: 320, h: 24, kind: 'ground' }, { x: 12, y: 124, w: 28, h: 32, kind: 'pipe' }].concat(extra);
  }
  const LEVELS = [
    {
      id: 'grass', world: 1, name: '草原', en: 'GRASSLAND', line: '第一道防线', defender: 'turtle', open: true, ai: 1.5,
      items: { grow: 6, life: 2 }, starts: [[0, 0], [1, 0], [2, 0]],
      solids: [].concat(
        [{ x: -16, y: -200, w: 16, h: 400, kind: 'wall' },
         { x: 304, y: -200, w: 32, h: 400, kind: 'gate' },
         { x: 0, y: 156, w: 320, h: 24, kind: 'ground' },
         { x: 12, y: 124, w: 28, h: 32, kind: 'pipe' }],
        blocks(64, 108, 4, [1]),
        blocks(192, 108, 4, [2]),
        blocks(136, 64, 3, null)),
      ledges: [{ x1: 64, x2: 128, y: 108 }, { x1: 192, x2: 256, y: 108 }, { x1: 136, x2: 184, y: 64 }, { x1: 12, x2: 40, y: 124 }],
      heroSpawn: { x: 21, y: 124 }, defSpawn: { x: 262, y: 156 },
    },
    {
      id: 'cave', world: 2, name: '地下水道', en: 'UNDERGROUND', line: '第二道防线', defender: 'shroom', open: true, ai: 1.1,
      // 道具池（权重）与三位勇者出场装备 [形态, 螺旋桨]
      items: { grow: 4, prop: 4, life: 2 }, starts: [[0, 0], [1, 0], [2, 1]],
      // 地下水道：地板只有 12 像素，整层（水管/方块）跟着下移 12，跳跃手感不变；顶上一条石砖天花板，天花板上面留一道刚好够人走的缝，最左边不封口
      groundY: 168, ceil: { x: 48, y: 16, h: 8 },
      solids: [{ x: -16, y: -200, w: 16, h: 400, kind: 'wall' }, { x: 304, y: -200, w: 32, h: 400, kind: 'gate' },
        { x: 0, y: 168, w: 320, h: 12, kind: 'ground' }, { x: 12, y: 136, w: 28, h: 32, kind: 'pipe' },
        { x: 48, y: 16, w: 256, h: 8, kind: 'ceil' },
        // 对战时左边缺口上方有一道看不见的顶，免得勇者在对战中飞到天花板上面去卡住
        { x: 0, y: -200, w: 48, h: 224, kind: 'cap' }].concat(blocks(72, 124, 3, [1]), blocks(184, 124, 3, [1]), blocks(120, 84, 5, null)),
      ledges: [{ x1: 72, x2: 120, y: 124 }, { x1: 184, x2: 232, y: 124 }, { x1: 120, x2: 200, y: 84 }, { x1: 12, x2: 40, y: 136 }],
      heroSpawn: { x: 21, y: 136 }, defSpawn: { x: 262, y: 168 },
    },
    {
      id: 'wall', world: 3, name: '黄昏城墙', en: 'CASTLE WALL', line: '最后一道防线', defender: 'dragon', open: true, ai: 0.9,
      items: { grow: 3, prop: 3, star: 2, life: 2 }, starts: [[1, 0], [1, 0], [2, 1]], heroLives: 4, // 最后一关勇者多一条命（经模拟调过）
      solids: frame3([].concat(blocks(72, 104, 3, [1]), blocks(224, 104, 3, [1]), blocks(128, 68, 4, null))),
      ledges: [{ x1: 72, x2: 120, y: 104 }, { x1: 224, x2: 272, y: 104 }, { x1: 128, x2: 192, y: 68 }, { x1: 12, x2: 40, y: 124 }],
      heroSpawn: { x: 21, y: 124 }, defSpawn: { x: 262, y: 156 },
    },
  ];

  const DEFENDERS = {
    shroom: { name: '菇菇长老', en: 'ELDER SPORE', w: 14, h: 15, open: true, hpBonus: 0,
      skills: { B: '翻滚', X: '掷孢子', Y: '小蘑菇' }, minion: '小蘑菇', line: '这条水道，谁也别想钻过去。' },
    dragon: { name: '熔岩龙王', en: 'MAGMA KING', w: 20, h: 20, open: true, hpBonus: 0,
      skills: { B: '冲锋', X: '吐火球', Y: '小火龙' }, jumpMul: 1.2, fire: true, shellCd: 140, minion: '小火龙', drakes: true, flap: true, line: '公主就在我身后。想过去？先过我。' },
    turtle: { name: '壳壳队长', en: 'CAPTAIN SHELL', w: 14, h: 16, open: true, hpBonus: 0,
      skills: { B: '冲撞', X: '甩壳', Y: '甲虫兵' }, minion: '甲虫兵', line: '第一道防线，交给我。' },
  };

  const HERO_FORMS = [
    { name: '小勇者', en: 'SMALL', w: 10, h: 14 },
    { name: '大勇者', en: 'BIG', w: 10, h: 22 },
    { name: '火焰勇者', en: 'FIRE', w: 10, h: 22 },
  ];

  // ---------- 物理 ----------
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  /** 移动一个刚体并与实体方块碰撞。返回 {hitX, headHit} */
  function moveBody(b, solids) {
    let hitX = false, headHit = null;
    // 横向只处理“这一步横着撞上的”方块：本来就嵌在里面的（被踩高、变大等挤进去的）交给竖向推出，
    // 否则会被按横向推到整块地板/天花板的尽头，甩出关卡外一直往下掉（第二关天花板下踩头的卡死 bug）
    const inside = b.vx !== 0 ? solids.filter(s => overlap(b, s)) : [];
    b.x += b.vx;
    for (const s of solids) {
      if (!overlap(b, s) || inside.includes(s)) continue;
      if (b.vx > 0) b.x = s.x - b.w; else if (b.vx < 0) b.x = s.x + s.w;
      else { // 静止时被挤入（如出生），按中心推出
        if (b.x + b.w / 2 < s.x + s.w / 2) b.x = s.x - b.w; else b.x = s.x + s.w;
      }
      hitX = true;
    }
    const wasGround = b.onGround;
    b.onGround = false;
    b.y += b.vy;
    for (const s of solids) {
      if (!overlap(b, s)) continue;
      if (b.vy > 0) { b.y = s.y - b.h; b.vy = 0; b.onGround = true; }
      else if (b.vy < 0) {
        b.y = s.y + s.h; b.vy = 0.5;
        // 头顶最接近中心的那块
        if (!headHit || Math.abs((s.x + s.w / 2) - (b.x + b.w / 2)) < Math.abs((headHit.x + headHit.w / 2) - (b.x + b.w / 2))) headHit = s;
      }
    }
    // 贴地检测（vy=0 时也要知道是否站在地上）
    if (!b.onGround && b.vy >= 0) {
      const probe = { x: b.x, y: b.y + 1, w: b.w, h: b.h };
      for (const s of solids) if (overlap(probe, s)) { b.onGround = true; break; }
    }
    b.justLanded = b.onGround && !wasGround;
    return { hitX, headHit };
  }

  function applyGravity(b, holdJump) {
    const g = (b.vy < 0 && holdJump) ? TUNE.grav : TUNE.gravFast;
    b.vy = Math.min(TUNE.maxFall, b.vy + g);
  }

  function walk(b, dir, max, acc, accAir, fric) {
    const a = b.onGround ? acc : accAir;
    if (dir) {
      b.vx += dir * a;
      if (Math.abs(b.vx) > max) b.vx = Math.sign(b.vx) * Math.max(max, Math.abs(b.vx) - fric);
      b.face = dir;
    } else if (b.onGround) {
      if (Math.abs(b.vx) <= fric) b.vx = 0; else b.vx -= Math.sign(b.vx) * fric;
    } else {
      b.vx *= 0.985;
    }
  }

  const DIFF_HP = { normal: 3 };

  // ---------- 创建 ----------
  function createGame(opts) {
    opts = opts || {};
    const lv = LEVELS[opts.level || 0];
    const st = {
      W, H, tick: 0, rng: makeRng(opts.seed || 12345),
      level: lv, levelIndex: opts.level || 0,
      phase: 'spawn', phaseT: 0,
      solids: lv.solids.map(s => Object.assign({ active: true, timer: 0, bump: 0 }, s)),
      def: null, hero: null,
      heroLives: lv.heroLives || TUNE.heroLives, heroRound: 0,
      shells: [], minions: [], fireballs: [], items: [], fx: [],
      events: [], stats: { stomps: 0, heroHits: 0, rounds: [] },
      roundT: 0, difficulty: opts.difficulty || 'normal',
    };
    const ds = DEFENDERS[lv.defender];
    // 守关者血量：默认 3 滴；前面每丢一道防线少一滴（最少 1 滴），由外面按战绩传入 opts.hp
    const HP0 = opts.hp != null ? Math.max(1, opts.hp | 0) : DIFF_HP.normal + (ds.hpBonus || 0);
    st.def = {
      kind: lv.defender, x: lv.defSpawn.x, y: lv.defSpawn.y - ds.h, w: ds.w, h: ds.h, vx: 0, vy: 0, face: -1,
      onGround: true, hp: HP0, maxHp: HP0, inv: 0, dash: 0, dashCd: 0, shellCd: 60, summonCd: 120,
      squash: 0, coyote: 0, jumpBuf: 0, dead: false, anim: 0,
    };
    spawnHero(st);
    return st;
  }

  function spawnHero(st) {
    const lv = st.level, ld = (lv.starts || [[0, 0], [1, 0], [2, 0]])[Math.min(2, st.heroRound)], tier = ld[0], f = HERO_FORMS[tier];
    st.hero = {
      x: lv.heroSpawn.x - f.w / 2 + 1, y: lv.heroSpawn.y + 4, w: f.w, h: f.h, vx: 0, vy: 0, face: 1,
      onGround: false, tier, inv: TUNE.spawnInv, fireCd: 0, dead: false, deadT: 0, anim: 0, emerging: Math.ceil(f.h / 0.6) + 1, grow: 0,
      kickGrace: 0, prevBottom: 0, star: 0, prop: !!ld[1], spun: false,
    };
    st.hero.y = lv.heroSpawn.y; // 从管口冒出
    st.phase = 'spawn'; st.phaseT = 0;
    st.ai = null;
    st.roundT = 0;
  }

  function setForm(h, tier) {
    const f = HERO_FORMS[tier], bottom = h.y + h.h;
    h.tier = tier; h.w = f.w; h.h = f.h; h.y = bottom - h.h;
  }

  function ev(st, type, x, y, extra) { st.events.push(Object.assign({ type, x, y }, extra || {})); }
  function puff(st, x, y, kind, life) { st.fx.push({ kind: kind || 'puff', x, y, t: 0, life: life || 24 }); }

  // ---------- 主循环一步 ----------
  /** input = { def: DefInput, hero: HeroInput|undefined }；hero 缺省时由 AI 控制 */
  function step(st, input) {
    st.events = [];
    st.tick++; st.phaseT++;
    const di = (input && input.def) || {};
    const solids = st.solids.filter(s => true);

    // 方块计时
    for (const s of st.solids) {
      if (s.bump > 0) s.bump--;
      if (s.kind === 'q' && !s.active) { if (--s.timer <= 0) { s.active = true; ev(st, 'qback', s.x, s.y); } }
    }
    for (const f of st.fx) f.t++;
    st.fx = st.fx.filter(f => f.t < f.life);

    if (st.phase === 'victory' || st.phase === 'defeat') { stepEnd(st, solids); return st; }

    // ----- 守关者 -----
    stepDefender(st, di, solids);

    // ----- 勇者 -----
    const h = st.hero;
    if (st.phase === 'spawn') {
      h.y -= 0.6; h.emerging--;
      if (h.emerging <= 0) { st.phase = 'fight'; st.phaseT = 0; h.vy = -1; }
    } else if (st.phase === 'fight') {
      st.roundT++;
      const hi = (input && input.hero) || root.SH_AI.hero(st);
      stepHero(st, hi, solids);
      // 兜底：勇者无论如何跑出了关卡（掉到地板下、甩到墙外），放回出生管口上面，不让对战卡死
      if (h.y > H + 24 || h.x < -8 || h.x > W) {
        Object.assign(h, { x: st.level.heroSpawn.x - h.w / 2 + 1, y: st.level.heroSpawn.y - h.h, vx: 0, vy: 0, onGround: false, inv: TUNE.spawnInv, spun: false });
        st.ai = null;
        puff(st, h.x + h.w / 2, h.y + h.h, 'puff');
      }
    } else if (st.phase === 'heroDown') {
      h.deadT++;
      if (h.deadT > 24) { h.vy = Math.min(6, h.vy + 0.35); h.y += h.vy; }
      if (h.deadT >= 130) {
        if (st.heroLives > 0) {
          st.heroRound++;
          const d = st.def; d.hp = Math.min(d.maxHp, d.hp + TUNE.def.healBetween);
          st.shells = []; st.fireballs = []; st.items = [];
          spawnHero(st);
          ev(st, 'nextHero', 0, 0, { round: st.heroRound });
        } else {
          st.phase = 'victory'; st.phaseT = 0; ev(st, 'victory', 0, 0);
        }
      }
    }

    stepShells(st, solids);
    stepMinions(st, solids);
    stepFireballs(st, solids);
    stepItems(st, solids);
    if (st.phase === 'fight') interact(st);
    return st;
  }

  function stepDefender(st, di, solids) {
    const d = st.def, P = TUNE.def;
    d.anim++;
    if (d.inv > 0) d.inv--;
    if (d.squash > 0) d.squash--;
    if (d.dashCd > 0) d.dashCd--;
    if (d.shellCd > 0) d.shellCd--;
    if (d.summonCd > 0) d.summonCd--;
    if (d.dead) return;
    const dir = (di.right ? 1 : 0) - (di.left ? 1 : 0);
    const stunned = d.squash > 0;

    if (d.dash > 0) {
      d.dash--;
      d.vx = d.face * P.dashSpeed;
      if (d.dash === 0) { d.dashCd = P.dashCd; d.vx = d.face * P.max; }
    } else {
      walk(d, stunned ? 0 : dir, P.max, P.acc, P.accAir, P.fric);
      if (di.atkP && d.dashCd <= 0 && !stunned) {
        if (dir) d.face = dir;
        d.dash = P.dashFrames; ev(st, 'dash', d.x, d.y);
      }
    }
    // 跳：土狼时间 + 预输入
    d.coyote = d.onGround ? 6 : Math.max(0, d.coyote - 1);
    d.jumpBuf = di.jumpP ? 7 : Math.max(0, d.jumpBuf - 1);
    if (d.jumpBuf > 0 && d.coyote > 0 && !stunned) {
      d.vy = -P.jump * (DEFENDERS[d.kind].jumpMul || 1); d.coyote = 0; d.jumpBuf = 0; d.onGround = false; ev(st, 'jump', d.x, d.y, { who: 'def' });
    } else if (di.jumpP && !d.onGround && DEFENDERS[d.kind].flap && !d.flapped && !stunned) {
      // 熔岩龙王：空中再扇一下翅膀（二连跳），落地前只能扇一次，不能一直飞
      d.vy = -P.jump * 0.95; d.flapped = true; d.flapT = 16; d.jumpBuf = 0;
      ev(st, 'jump', d.x, d.y, { who: 'def' }); puff(st, d.x + d.w / 2, d.y + d.h, 'puff', 16);
    }
    if (d.onGround) d.flapped = false;
    if (d.flapT > 0) d.flapT--;
    applyGravity(d, di.jump);
    const r = moveBody(d, solids);
    if (r.headHit) bumpBlock(st, r.headHit, 'def');
    if (r.hitX && d.dash > 0) { d.dash = 0; d.dashCd = P.dashCd; d.vx = 0; ev(st, 'thud', d.x, d.y); puff(st, d.x + d.w / 2 + d.face * 8, d.y + 8); }

    // 甩壳
    if (di.skillP && d.shellCd <= 0 && !stunned && st.phase !== 'heroDown') {
      let sd = d.face;
      if (di.aimX && Math.abs(di.aimX) > 0.3) sd = Math.sign(di.aimX);
      d.face = sd;
      const sx = sd > 0 ? d.x + d.w : d.x - 12;
      const DK = DEFENDERS[d.kind];
      if (d.kind === 'shroom') { // 菇菇长老：一次往前上方撒出三颗孢子，近距离抛物线，落地/撞墙就散，不会被踢回来
        for (const [vx, vy] of [[1.5, -3.4], [2.1, -2.3], [2.6, -1.1]])
          st.shells.push({ x: sd > 0 ? d.x + d.w - 2 : d.x - 5, y: d.y + 2, w: 7, h: 7, vx: sd * vx, vy, state: 'moving', spore: true, bounces: 0, life: 0, onGround: false, owner: 'def' });
        ev(st, 'throw', d.x, d.y);
      } else if (DK.fire) { // 龙：从嘴里吐出一团直飞的火球
        st.shells.push({ x: sd > 0 ? d.x + d.w - 2 : d.x - 10, y: d.y + 4, w: 12, h: 8, vx: sd * 3.4, vy: 0, state: 'moving', fire: true, bounces: 0, life: 0, onGround: false, owner: 'def' });
        ev(st, 'breath', d.x, d.y);
      } else {
        st.shells.push({ x: sx, y: d.y + d.h - 10, w: 12, h: 10, vx: sd * TUNE.shell.speed, vy: 0, state: 'moving', bounces: 0, life: 0, onGround: false, owner: 'def' });
        ev(st, 'throw', d.x, d.y);
      }
      d.shellCd = DK.shellCd || P.shellCd;
    }
    // 召唤
    if (di.summonP && d.summonCd <= 0 && !stunned && st.minions.length < (DEFENDERS[d.kind].drakes ? 1 : P.maxMinions) && st.phase !== 'heroDown') {
      const md = d.face;
      if (DEFENDERS[d.kind].drakes) { // 熔岩龙王：一次往前扔出两只小火龙（一近一远），各自能喷一次火
        for (const [vx, vy] of [[1.2, -3.2], [2.0, -2.6]])
          st.minions.push({ x: d.x + d.w / 2 - 6 + md * 10, y: d.y + d.h - 12, w: 12, h: 10, vx: md * vx, vy, onGround: false, dead: 0, anim: 0,
            drake: true, breath: 1, charge: 0, sitT: 0, face: md, landed: false });
      } else
      st.minions.push({ x: d.x + d.w / 2 - 5 + md * 10, y: d.y + d.h - 10, w: 10, h: 9, vx: md * TUNE.minion.speed, vy: -2.4, onGround: false, dead: 0, anim: 0 });
      d.summonCd = P.summonCd; ev(st, 'summon', d.x, d.y); puff(st, d.x + d.w / 2 + md * 10, d.y + d.h - 6, 'spark');
    }
  }

  function stepHero(st, hi, solids) {
    const h = st.hero, P = TUNE.hero;
    h.anim++;
    if (h.inv > 0) h.inv--;
    if (h.fireCd > 0) h.fireCd--;
    if (h.kickGrace > 0) h.kickGrace--;
    if (h.grow > 0) h.grow--;
    if (h.star > 0) { h.star--; if (h.star === 0) ev(st, 'starEnd', h.x, h.y); }
    h.prevBottom = h.y + h.h;
    const dir = (hi.right ? 1 : 0) - (hi.left ? 1 : 0);
    walk(h, dir, hi.run ? P.run : P.max, P.acc, P.accAir, P.fric);
    if (hi.jumpP && h.onGround) { h.vy = -P.jump; h.onGround = false; ev(st, 'jump', h.x, h.y, { who: 'hero' }); }
    else if (hi.jumpP && h.prop && !h.spun) { h.vy = -TUNE.spin; h.spun = true; ev(st, 'spin', h.x, h.y); }
    h.holdJump = !!hi.jump;
    applyGravity(h, hi.jump);
    if (h.prop && hi.jump && h.vy > TUNE.propFall) h.vy = TUNE.propFall; // 按住跳：螺旋桨慢慢飘
    const r = moveBody(h, solids);
    if (h.onGround) h.spun = false;
    if (r.headHit) bumpBlock(st, r.headHit, 'hero');
    if (hi.fireP && h.tier === 2 && h.fireCd <= 0 && st.fireballs.length < TUNE.fire.max) {
      st.fireballs.push({ x: h.face > 0 ? h.x + h.w : h.x - 6, y: h.y + 6, w: 6, h: 6, vx: h.face * TUNE.fire.speed, vy: 1, life: 0, onGround: false });
      h.fireCd = TUNE.fire.cd; ev(st, 'fire', h.x, h.y);
    }
  }

  function pickItem(st) {
    const h = st.hero, pool = Object.assign({}, st.level.items || { grow: 1 });
    if (h.tier >= 2) delete pool.grow;
    if (h.prop) delete pool.prop;
    if (st.heroLives >= TUNE.maxLives || st.lifeGiven >= 1) delete pool.life; // 加命果每关最多一个
    const keys = Object.keys(pool); if (!keys.length) return 'grow';
    let r = st.rng() * keys.reduce((a, k) => a + pool[k], 0);
    for (const k of keys) { r -= pool[k]; if (r < 0) { if (k === 'life') st.lifeGiven = (st.lifeGiven || 0) + 1; return k; } }
    return keys[0];
  }

  function bumpBlock(st, s, who) {
    s.bump = 8;
    if (s.kind === 'q' && s.active) {
      s.active = false; s.timer = TUNE.qRespawn;
      st.items.push({ x: s.x + 2, y: s.y - 2, w: 12, h: 12, vx: 0, vy: 0, rise: 14, onGround: false, by: who, life: 0, type: pickItem(st) });
      ev(st, 'qhit', s.x, s.y, { who });
    } else ev(st, 'bonk', s.x, s.y);
  }

  function stepShells(st, solids) {
    for (const s of st.shells) {
      s.life++;
      if (s.fire) { // 火球：直线飞，撞墙或飞太久就灭
        s.vy = 0; const r = moveBody(s, solids);
        if (r.hitX || s.life > 150) { s.gone = true; puff(st, s.x + 6, s.y + 4, 'spark', 14); }
        continue;
      }
      if (s.spore) { // 孢子：轻飘飘的抛物线，碰到地面/墙/飞满一秒就散开
        s.vy = Math.min(3, s.vy + 0.16); const r = moveBody(s, solids);
        if (r.hitX || s.onGround || r.headHit || s.life > 60) { s.gone = true; puff(st, s.x + 3, s.y + 3, 'puff', 14); }
        continue;
      }
      if (s.state === 'still') { s.vx = 0; if (s.life > TUNE.shell.stillLife) s.gone = true; }
      s.vy = Math.min(TUNE.maxFall, s.vy + TUNE.gravFast);
      const r = moveBody(s, solids);
      if (r.hitX && s.state !== 'still') {
        s.bounces++; s.vx = -Math.sign(s.vx || 1) * (s.state === 'kicked' ? TUNE.shell.kick : TUNE.shell.speed);
        ev(st, 'bonk', s.x, s.y);
        if (s.bounces > (s.state === 'kicked' ? 2 : TUNE.shell.bounces)) { s.gone = true; puff(st, s.x + 6, s.y + 5); }
      }
    }
    st.shells = st.shells.filter(s => !s.gone);
  }

  function stepMinions(st, solids) {
    for (const m of st.minions) {
      m.anim++;
      if (m.dead) { m.dead++; continue; }
      m.vy = Math.min(TUNE.maxFall, m.vy + TUNE.gravFast);
      if (m.drake) { stepDrake(st, m, solids); continue; }
      const r = moveBody(m, solids);
      if (r.hitX) m.vx = -m.vx || TUNE.minion.speed;
      if (Math.abs(m.vx) < TUNE.minion.speed) m.vx = Math.sign(m.vx || 1) * TUNE.minion.speed;
    }
    st.minions = st.minions.filter(m => !m.gone && (!m.dead || m.dead < 40));
  }

  // 小火龙：落地后朝勇者慢慢爬；勇者进了射程就停下蓄力（闪一下）、喷一团直线小火，喷完趴在原地，过一阵散掉
  function stepDrake(st, m, solids) {
    const h = st.hero, hx = h.x + h.w / 2, mx = m.x + m.w / 2;
    if (m.breath > 0 && m.charge > 0) { // 蓄力中：不动
      m.vx = 0; moveBody(m, solids);
      if (++m.charge >= 24) {
        st.shells.push({ x: m.face > 0 ? m.x + m.w - 2 : m.x - 10, y: m.y + 1, w: 12, h: 8, vx: m.face * 2.7, vy: 0, state: 'moving', fire: true, small: true, bounces: 0, life: 60, onGround: false, owner: 'def' });
        m.breath = 0; m.charge = 0; ev(st, 'breath', m.x, m.y);
      }
      return;
    }
    if (m.breath <= 0) { // 喷过了：趴着，约 5 秒后散掉
      m.vx = 0; moveBody(m, solids);
      if (++m.sitT > 300) { m.gone = true; puff(st, mx, m.y + m.h / 2, 'puff'); }
      return;
    }
    if (m.onGround) {
      if (!m.landed) { m.landed = true; }
      m.face = hx < mx ? -1 : 1;
      m.vx = m.face * TUNE.minion.speed;
      if (!h.dead && st.phase === 'fight' && Math.abs(hx - mx) < 96 && Math.abs((h.y + h.h) - (m.y + m.h)) < 28) { m.charge = 1; m.vx = 0; }
    }
    const r = moveBody(m, solids);
    if (r.hitX) m.vx = -m.vx;
  }

  function stepFireballs(st, solids) {
    for (const f of st.fireballs) {
      f.life++;
      f.vy = Math.min(4, f.vy + 0.4);
      const r = moveBody(f, solids);
      if (f.onGround) f.vy = -TUNE.fire.bounceV;
      if (r.hitX || f.life > TUNE.fire.life) { f.gone = true; puff(st, f.x + 3, f.y + 3, 'spark', 14); }
    }
    st.fireballs = st.fireballs.filter(f => !f.gone);
  }

  function stepItems(st, solids) {
    for (const it of st.items) {
      it.life++;
      if (it.rise > 0) { it.y -= 1; it.rise--; if (it.rise === 0) it.vx = 0.9 * (st.rng() < 0.5 ? -1 : 1); continue; }
      it.vy = Math.min(TUNE.maxFall, it.vy + TUNE.gravFast);
      const r = moveBody(it, solids);
      if (r.hitX) it.vx = -it.vx;
      if (it.type === 'star' && it.onGround) { it.vy = -3.6; it.vx = Math.sign(it.vx || 1) * 1.3; }
      if (it.life > 900) it.gone = true;
    }
    st.items = st.items.filter(i => !i.gone);
  }

  // ---------- 交互判定 ----------
  function isStomp(h, target) { return h.vy > 0 && h.prevBottom <= target.y + 6; }

  function heroBounce(h) { h.vy = -(h.holdJump ? TUNE.hero.bounceHold : TUNE.hero.bounce); h.onGround = false; }

  function hurtHero(st, src) {
    const h = st.hero;
    if (h.inv > 0 || h.emerging > 0 || h.star > 0) return;
    st.stats.heroHits++;
    if (h.prop) { h.prop = false; h.inv = TUNE.heroInv; ev(st, 'shrink', h.x, h.y, { src, lost: 'prop' }); return; }
    if (h.tier > 0) {
      setForm(h, h.tier - 1); h.inv = TUNE.heroInv; h.grow = 30;
      ev(st, 'shrink', h.x, h.y, { src });
    } else {
      h.dead = true; h.deadT = 0; h.vy = -5; h.vx = 0;
      st.heroLives--; st.phase = 'heroDown'; st.phaseT = 0;
      st.stats.rounds.push({ frames: st.roundT, defHp: st.def.hp, src });
      ev(st, 'heroDie', h.x, h.y, { src, livesLeft: st.heroLives });
    }
  }

  function hurtDef(st, src) {
    const d = st.def;
    if (d.inv > 0 || d.dead) return false;
    d.hp--; d.inv = TUNE.def.inv; d.squash = 18; d.dash = 0;
    ev(st, 'defHurt', d.x, d.y, { src, hp: d.hp });
    if (d.hp <= 0) {
      d.dead = true; d.vy = -4.5; d.vx = 0;
      st.phase = 'defeat'; st.phaseT = 0;
      st.stats.rounds.push({ frames: st.roundT, defHp: 0, src: 'defeat' });
      ev(st, 'defeat', d.x, d.y);
    }
    return true;
  }

  function interact(st) {
    const h = st.hero, d = st.def;
    // 勇者 × 守关者
    if (!h.dead && !d.dead && overlap(h, d) && h.star > 0) {
      if (d.inv <= 0) { hurtDef(st, 'star'); d.inv = 220; d.vx = Math.sign(d.x - h.x || 1) * 2.5; d.vy = -3; puff(st, d.x + d.w / 2, d.y + 6, 'star'); }
    } else if (!h.dead && !d.dead && overlap(h, d)) {
      if (isStomp(h, d)) {
        // 站到守关者头上；但别把勇者抬进天花板/方块里（守关者跳到天花板下面时会发生）
        const ny = d.y - h.h, probe = { x: h.x, y: ny, w: h.w, h: h.h };
        if (!st.solids.some(s => overlap(probe, s))) h.y = ny;
        heroBounce(h);
        if (d.dash > 0) { ev(st, 'clank', d.x, d.y); }
        else if (d.inv > 0) { ev(st, 'bounce', d.x, d.y); }
        else { st.stats.stomps++; hurtDef(st, 'stomp'); ev(st, 'stomp', d.x, d.y); puff(st, d.x + d.w / 2, d.y, 'star'); }
      } else if (d.dash > 0 || d.inv <= 0) {
        hurtHero(st, d.dash > 0 ? 'dash' : 'touch');
      }
    }
    if (st.phase !== 'fight') return;
    // 勇者 × 甲虫兵
    for (const m of st.minions) {
      if (m.dead || !overlap(h, m)) continue;
      if (h.star > 0) { m.dead = 1; m.flip = true; ev(st, 'squish', m.x, m.y); continue; }
      if (isStomp(h, m)) { m.dead = 1; heroBounce(h); ev(st, 'squish', m.x, m.y); }
      else hurtHero(st, 'minion');
      if (st.phase !== 'fight') return;
    }
    // 勇者 × 壳
    for (const s of st.shells) {
      if (s.gone || !overlap(h, s)) continue;
      if (h.star > 0) { s.gone = true; puff(st, s.x + 6, s.y + 5, 'star'); ev(st, 'squish', s.x, s.y); continue; }
      if (s.spore) { // 孢子：踩到就踩散，碰到就掉血；不会停下、也不会被踢回来
        s.gone = true; puff(st, s.x + 3, s.y + 3, 'puff', 14);
        if (isStomp(h, s)) heroBounce(h); else hurtHero(st, 'spore');
        if (st.phase !== 'fight') return; continue;
      }
      if (s.fire) { hurtHero(st, 'shell'); s.gone = true; puff(st, s.x + 6, s.y + 4, 'spark', 14); if (st.phase !== 'fight') return; continue; } // 火球踩不得
      if (isStomp(h, s) && s.state !== 'still') {
        s.state = 'still'; s.vx = 0; s.life = 0; heroBounce(h); h.kickGrace = 12; ev(st, 'stomp', s.x, s.y, { what: 'shell' });
      } else if (s.state === 'still') {
        if (h.kickGrace > 0) continue;
        const dir = (h.x + h.w / 2) < (s.x + s.w / 2) ? 1 : -1;
        s.state = 'kicked'; s.vx = dir * TUNE.shell.kick; s.bounces = 0; s.x += dir * 4; h.kickGrace = 16;
        ev(st, 'kick', s.x, s.y);
      } else if (s.state === 'moving') {
        hurtHero(st, 'shell');
      }
      if (st.phase !== 'fight') return;
    }
    // 壳 × 守关者 / 甲虫兵
    for (const s of st.shells) {
      if (s.gone) continue;
      if (s.state === 'kicked') {
        if (overlap(s, d)) {
          if (d.dash > 0) { s.state = 'moving'; s.vx = -s.vx; s.bounces = 0; ev(st, 'clank', s.x, s.y); }
          else if (hurtDef(st, 'kickedShell')) { s.gone = true; puff(st, s.x + 6, s.y + 5, 'star'); }
          if (st.phase !== 'fight') return;
        }
        for (const m of st.minions) if (!m.dead && overlap(s, m)) { m.dead = 1; m.flip = true; ev(st, 'squish', m.x, m.y); }
      } else if (s.state === 'still' && overlap(s, d) && s.life > 20) {
        s.gone = true; d.shellCd = 0; ev(st, 'pickup', s.x, s.y);
      }
    }
    // 火球
    for (const f of st.fireballs) {
      if (f.gone) continue;
      if (overlap(f, d)) {
        if (d.dash > 0) { f.gone = true; ev(st, 'clank', f.x, f.y); }
        else if (d.inv <= 0) { f.gone = true; hurtDef(st, 'fire'); }
        if (st.phase !== 'fight') return;
      }
      for (const m of st.minions) if (!m.dead && !f.gone && overlap(f, m)) { m.dead = 1; m.flip = true; f.gone = true; ev(st, 'squish', m.x, m.y); }
    }
    // 道具
    for (const it of st.items) {
      if (it.rise > 0) continue;
      if (overlap(it, h)) {
        it.gone = true;
        const k = it.type || 'grow';
        if (k === 'grow' && h.tier < 2) { setForm(h, h.tier + 1); h.grow = 40; }
        if (k === 'star') h.star = TUNE.starFrames;
        if (k === 'prop') h.prop = true;
        if (k === 'life') st.heroLives = Math.min(TUNE.maxLives, st.heroLives + 1);
        ev(st, 'powerup', h.x, h.y, { tier: h.tier, kind: k });
      } else if (overlap(it, d)) {
        it.gone = true;
        d.hp = Math.min(d.maxHp, d.hp + 1);
        ev(st, 'eat', d.x, d.y, { hp: d.hp });
      }
    }
  }

  function stepEnd(st, solids) {
    const d = st.def, h = st.hero;
    if (st.phase === 'defeat') {
      d.vy = Math.min(6, d.vy + 0.3); d.y += d.vy;
      // 勇者走向城门
      if (st.phaseT > 50 && !h.dead) {
        h.anim++; h.vx = 1.2; h.face = 1;
        applyGravity(h, false); moveBody(h, solids.filter(s => s.kind !== 'gate'));
      }
    } else {
      // 胜利：守关者原地欢呼
      d.anim++;
      if (d.onGround && st.phaseT % 40 === 0) d.vy = -3.5;
      applyGravity(d, false); moveBody(d, solids);
    }
    stepMinions(st, solids);
  }

  // 游戏名只在这里改
  root.SH_TITLE = { main: 'STOP', sub: 'Marios', full: 'STOP · Marios', cn: '抵御像马里奥一样的英雄们' };

  root.SH = { W, H, T, TUNE, LEVELS, DEFENDERS, HERO_FORMS, createGame, step, moveBody, applyGravity, overlap, makeRng };
})(typeof window !== 'undefined' ? window : globalThis);
