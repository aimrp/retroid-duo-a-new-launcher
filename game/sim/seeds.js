// 找一局适合录演示视频的种子：守关者机器人赢、勇者变过火焰形态、过程有来有回。
// 用法：node stophero/sim/seeds.js [试多少个=400] [机器人水平=0.7]
const path = require('path');
require(path.join(__dirname, '../web/js/engine.js'));
require(path.join(__dirname, '../web/js/ai.js'));
const { SH, SH_AI } = globalThis;
const N = +process.argv[2] || 400, LV = +(process.argv[3] || 0.7);
const out = [];
for (let seed = 1; seed <= N; seed++) {
  const st = SH.createGame({ seed, level: 0, difficulty: 'normal' });
  let f = 0, maxTier = 0, kinds = new Set(), shrinks = 0;
  while (st.phase !== 'victory' && st.phase !== 'defeat' && f < 60 * 120) {
    SH.step(st, { def: SH_AI.defender(st, LV) });
    maxTier = Math.max(maxTier, st.hero.tier);
    for (const e of st.events) { if (e.type === 'heroDie') kinds.add(e.src); if (e.type === 'shrink') shrinks++; }
    f++;
  }
  if (st.phase === 'victory') out.push({ seed, secs: +(f / 60).toFixed(1), hp: st.def.hp, maxTier, kills: [...kinds].join(','), shrinks });
}
const good = out.filter(o => o.maxTier === 2 && o.hp >= 2 && o.hp <= 3 && o.secs >= 35 && o.secs <= 60 && o.kills.split(',').length >= 2);
console.log('wins', out.length, '/', N, ' good', good.length);
console.log(good.slice(0, 12));
