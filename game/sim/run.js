// 无画面对战模拟：勇者 AI vs 守关者机器人，统计胜率与节奏，用来调平衡。
// 用法：node stophero/sim/run.js [局数=400] [机器人水平0..1=0.6] [难度 easy|normal|hard]
const path = require('path');
require(path.join(__dirname, '../web/js/engine.js'));
require(path.join(__dirname, '../web/js/ai.js'));
const { SH, SH_AI } = globalThis;

const N = +process.argv[2] || 400;
const LV = process.argv[3] != null ? +process.argv[3] : 0.6;
const DIFF = process.argv[4] || 'normal';
const LEVEL = +(process.argv[5] || 0);
const MAXF = 60 * 60 * 6;

let defWins = 0, frames = 0, timeouts = 0;
const deathSrc = {}, defHurtSrc = {}, endHp = [], roundsLen = [];
let powerups = 0, eats = 0, stomps = 0, livesUsed = 0;
for (let g = 0; g < N; g++) {
  const st = SH.createGame({ seed: 1000 + g * 7919, level: LEVEL, difficulty: DIFF });
  let f = 0;
  while (st.phase !== 'victory' && st.phase !== 'defeat' && f < MAXF) {
    SH.step(st, { def: SH_AI.defender(st, LV) });
    for (const e of st.events) {
      if (e.type === 'heroDie') deathSrc[e.src] = (deathSrc[e.src] || 0) + 1;
      if (e.type === 'shrink') deathSrc['shrink:' + e.src] = (deathSrc['shrink:' + e.src] || 0) + 1;
      if (e.type === 'defHurt') defHurtSrc[e.src] = (defHurtSrc[e.src] || 0) + 1;
      if (e.type === 'powerup') powerups++;
      if (e.type === 'eat') eats++;
      if (e.type === 'stomp' && !e.what) stomps++;
    }
    f++;
  }
  if (f >= MAXF) timeouts++;
  if (st.phase === 'victory') { defWins++; endHp.push(st.def.hp); }
  livesUsed += 3 - st.heroLives;
  frames += f;
  for (const r of st.stats.rounds) roundsLen.push(r.frames);
}
const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0;
console.log(`关卡 ${SH.LEVELS[LEVEL].name}  局数 ${N}  机器人水平 ${LV}  难度 ${DIFF}`);
console.log(`守关者胜率 ${(defWins / N * 100).toFixed(1)}%   超时 ${timeouts}`);
console.log(`平均每局 ${(frames / N / 60).toFixed(1)} 秒，每条命平均 ${(avg(roundsLen) / 60).toFixed(1)} 秒`);
console.log(`守住时剩余心数 ${avg(endHp).toFixed(2)}；平均勇者用掉命 ${(livesUsed / N).toFixed(2)}`);
console.log(`勇者受伤来源`, deathSrc);
console.log(`守关者受伤来源`, defHurtSrc);
console.log(`每局 勇者吃强化 ${(powerups / N).toFixed(2)}  守关者抢吃 ${(eats / N).toFixed(2)}  踩头 ${(stomps / N).toFixed(2)}`);
