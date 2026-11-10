/* 守住一关后，勇者绕开守关者的过场（上下屏共用的时间轴与路线）。
 * 第一关：从水管出来 → 在你左边往下挖竖井 → 掉进下屏，在结算面板之间按重力走一圈 → 搭梯子爬上去 → 从你身后挖出来溜进城门。
 * 第二关：从水管出来 → 顶到螺旋桨帽 → 从左边缺口飞到天花板上面 → 在天花板顶上走过去，钻进右边城墙的通道。
 * 所有位置都按「脚底坐标」算，重力与关卡里一致（0.3 像素/帧²）。 */
(function (root) {
  'use strict';
  const G = 0.3;

  // —— 分段路线：每段给出时长和 at(u) → { x, y(脚底), face, pose } ——
  function wait(x, y, dur, face, pose) { return { dur, at: () => ({ x, y, face, pose: pose || 'stand' }) }; }
  function walk(x0, x1, y, speed) {
    const dur = Math.max(1, Math.round(Math.abs(x1 - x0) / speed)), face = x1 >= x0 ? 1 : -1;
    return { dur, at: u => ({ x: x0 + (x1 - x0) * u / dur, y, face, pose: 'run' }) };
  }
  function fall(x0, y0, y1, vx) { // 自由落体（可带水平速度，比如走着从边缘踏空）
    const dur = Math.round(Math.sqrt(2 * (y1 - y0) / G));
    return { dur, land: true, at: u => ({ x: x0 + vx * u, y: Math.min(y1, y0 + 0.5 * G * u * u), face: vx < 0 ? -1 : 1, pose: 'jump' }) };
  }
  function jump(x0, y0, x1, y1, peak) { // 抛物线：起跳点 → 落点，peak = 比两端更高处的顶点高度
    const top = Math.min(y0, y1) - peak, vy = -Math.sqrt(2 * G * (y0 - top));
    const dur = Math.round(-vy / G + Math.sqrt(2 * (y1 - top) / G));
    return { dur, land: true, at: u => ({ x: x0 + (x1 - x0) * u / dur, y: Math.min(y1, y0 + vy * u + 0.5 * G * u * u), face: x1 >= x0 ? 1 : -1, pose: 'jump' }) };
  }
  function climb(x, y0, y1, speed) {
    const dur = Math.round(Math.abs(y1 - y0) / speed);
    return { dur, at: u => ({ x, y: y0 + (y1 - y0) * u / dur, face: 1, pose: 'climb' }) };
  }
  function route(segs, extra) {
    let t = 0; const lands = [];
    for (const s of segs) { s.t0 = t; t += s.dur; if (s.land) lands.push({ t, x: s.at(s.dur).x, y: s.at(s.dur).y }); }
    return Object.assign({ segs, dur: t, lands, at(tt) {
      if (tt < 0 || tt >= t) return null;
      for (const s of segs) if (tt < s.t0 + s.dur) { const p = s.at(tt - s.t0); p.seg = s; p.u = tt - s.t0; return p; }
      return null;
    } }, extra);
  }

  // —— 土块飞溅（无状态：给定时刻算出每粒土的位置） ——
  // 在 [0, len) 内每隔 every 帧往外扬一粒土，带重力，落到 floor 以下就消失。dir: 1 往右扬 / -1 往左 / 0 两边 / 'down' 往下撒
  function spray(u, x, y, opt) {
    const out = [], every = opt.every || 3, len = opt.len, floor = opt.floor;
    for (let i = 0; i * every < Math.min(u + 1, len); i++) {
      const age = u - i * every; if (age < 0) continue;
      const r1 = ((i * 73 + 17) % 97) / 97, r2 = ((i * 151 + 41) % 89) / 89;
      let vx, vy;
      if (opt.dir === 'down') { vx = (r1 - 0.5) * 1.2; vy = 0.3 + r2 * 0.8; }
      else { const side = opt.dir || (i % 2 ? 1 : -1); vx = side * (0.5 + r1 * 1.3); vy = -(1.6 + r2 * 1.8); }
      const px = x + vx * age, py = y + vy * age + 0.5 * G * age * age;
      if (py > floor || age > 90) continue;
      out.push([Math.round(px), Math.round(py), i % 3 === 0 ? 1 : 2, i % 2 ? '#c8643a' : '#8a5a2b']);
    }
    return out;
  }

  // ==================== 第一关：挖地道（跨屏） ====================
  // 上屏（320×180，地面 y=156，水管顶 y=124）
  const T1 = { pipeX: 26, pipeTop: 124, ground: 156, digX: 58, exitX: 294 };
  T1.emerge = 30; // 从水管里冒出来
  T1.hop = jump(T1.pipeX, T1.pipeTop, T1.digX, T1.ground, 12);
  T1.hopT = T1.emerge + 10;
  T1.digT = T1.hopT + T1.hop.dur + 10; // 开挖
  T1.digLen = 70;                     // 竖井挖穿地面（24 像素）用的时间
  T1.goneT = T1.digT + T1.digLen + 18; // 整个人沉到上屏底边以下 → 进入下屏

  // 下屏（256×192）。可落脚的东西：成绩卡顶面 y=44（x 20..236）、「A 继续」按钮顶面 y=164（x 68..188）、屏幕底 y=192
  const B1 = { inX: 44, card: 44, btn: 164, floor: 192, ladderX: 244 };
  const r1 = route([
    fall(B1.inX, 0, B1.card, 0),                       // 从顶上的洞掉下来，落在成绩卡上
    wait(B1.inX, B1.card, 16, -1),                     // 拍拍土，看看四周
    walk(B1.inX, 19, B1.card, 1.2),                    // 往左走到卡片边缘
    fall(19, B1.card, B1.floor, -0.35),                // 踏空，掉到底
    wait(8.5, B1.floor, 10, 1),
    walk(8.5, 52, B1.floor, 1.6),                      // 沿着底边往右走
    jump(52, B1.floor, 80, B1.btn, 14),                // 跳上「A 继续」按钮
    walk(80, 180, B1.btn, 1.6),                        // 在按钮上走过去
    jump(180, B1.btn, 204, B1.floor, 6),               // 跳下来
    walk(204, 234, B1.floor, 1.6),
    Object.assign(wait(234, B1.floor, 44, 1), { ladder: 1 }), // 掏出梯子，靠着卡片右边竖起来
    walk(234, B1.ladderX, B1.floor, 1.2),
    climb(B1.ladderX, B1.floor, 18, 1.9),              // 爬梯子
    Object.assign(wait(B1.ladderX, 18, 30, 1, 'climb'), { digUp: 1 }), // 在顶上往上挖
    climb(B1.ladderX, 18, -2, 1.2),                    // 钻回上屏
  ]);
  const LADDER_UP = 40; // 梯子从底边伸到顶用的帧数
  r1.ladderAt = function (tt) { // 梯子顶端 y（null = 还没掏出来）
    const s = r1.segs.find(x => x.ladder); if (tt < s.t0) return null;
    return Math.max(0, B1.floor - (tt - s.t0) / LADDER_UP * B1.floor);
  };
  T1.inT = T1.goneT;                 // 上屏时刻 inT = 下屏路线第 0 帧
  T1.outT = T1.inT + r1.dur;         // 下屏的人从顶边钻出去 = 上屏底边开始冒头
  // 回到上屏：从城门前的竖井里爬出来（脚底 198 → 156），跳到你身后，回头看你一眼，再跳过洞口钻进城门
  T1.climbFrom = T1.outT - 17;       // 与下屏最后一段爬梯同步（下屏 y=b ↔ 上屏 y=180+b）
  T1.exitT = T1.climbFrom + Math.round((198 - T1.ground) / 1.2);
  T1.exit = route([jump(T1.exitX, T1.ground, 281, T1.ground, 8), wait(281, T1.ground, 36, -1), jump(281, T1.ground, 318, T1.ground, 12)]);
  T1.doneT = T1.exitT + T1.exit.dur + 10;
  T1.digUpSeg = r1.segs.find(s => s.digUp);

  // ==================== 第二关：螺旋桨飞上天花板 ====================
  // 上屏：地面 y=168，水管顶 y=136；天花板 x 48..292、y 16..24，上面是 16 像素高的缝；右边城墙在 y 0..16 有个通道口
  const T2 = { pipeX: 26, pipeTop: 136, ground: 168, ceilTop: 16, ceilX: 48, ceilEnd: 292, itemY: 66 };
  T2.emerge = 30;
  T2.jumpT = T2.emerge + 16;                         // 原地起跳，头顶到螺旋桨帽
  T2.jumpV = -5.9;                                   // 和关卡里勇者的起跳速度一样
  T2.grabU = 0; { let y = T2.pipeTop, v = T2.jumpV; while (y - 16 > T2.itemY + 12) { y += v; v += G; T2.grabU++; } } // 头碰到帽子那一帧
  T2.grabT = T2.jumpT + T2.grabU;
  T2.flyT = T2.grabT + 6;                            // 螺旋桨转起来
  T2.flyLen = 70;                                    // 匀减速升到缝里
  T2.slideLen = 34;                                  // 往右飘到天花板上
  T2.walkT = T2.flyT + T2.flyLen + T2.slideLen;
  T2.walkLen = Math.round((T2.ceilEnd + 8 - 62) / 1.5);
  T2.doneT = T2.walkT + T2.walkLen + 16;

  root.SH_BYPASS = { G, spray, T1, B1, r1, LADDER_UP, T2 };
})(typeof window !== 'undefined' ? window : globalThis);
