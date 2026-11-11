/* STOP · The Stompers · 像素美术（全部原创，字符画 → 离屏画布） */
(function (root) {
  'use strict';
  const PAL = {
    k: '#1a1426', K: '#3a2f4f',
    // 勇者
    h: '#d8352f', H: '#ff7a6b', V: '#8a1f1c', X: '#3fae8f', U: '#c4302b', J: '#7e1c1a', r: '#e0344c', R: '#9c1f33', s: '#f4c48e', S: '#c98e5c',
    b: '#3f6fd9', B: '#26479c', y: '#f5c84a', w: '#6e4126', W: '#3f2414',
    // 乌龟队长
    g: '#2fb38c', G: '#1b6e59', l: '#f4e2ad', o: '#f39a48', O: '#c56a28', e: '#ffffff',
    // 甲虫兵
    p: '#7a4fc9', P: '#4a2c86', m: '#c7a6ff',
    // 道具与方块
    q: '#f7b733', Q: '#b9761d', u: '#fff3b0', c: '#c8643a', C: '#7e3b22', d: '#e8a56c',
    t: '#4fbf5a', T: '#2b7f39', v: '#9be36a', n: '#6fd0ff', N: '#3b8fd0',
    f: '#ff7a1f', F: '#ffd43b', z: '#8c8c9c', Z: '#55556a', x: '#ffe066',
    // 菇菇长老 / 熔岩龙王
    a: '#3aa7c9', A: '#22708c', i: '#f7e27a', j: '#e8e8f0', I: '#b9b9c8',
    D: '#d83b2b', E: '#8f1f22', M: '#7b3fa0', L: '#ffb347',
  };

  const S = {};
  // —— 小勇者 12×16（朝右）：原创工匠——鸭舌帽 + 短袖 + 工装背带裤（帽 h/H/V，衬衫 X，背带裤 U/J，扣子 z） ——
  const heroHead = ['............', '...kkkkk....', '..khHHhhk...', '..khhhhhhk..', '..kkkkkVVVVk', '..kWsssssk..', '..kWssksSk..', '...kssssk...'];
  S.heroS_stand = heroHead.concat(['..kXUXXUXk..', '.ksXUzzUXsk.', '.ksUUUUUUsk.', '..kUUUUUUk..', '..kJJkkJJk..', '..kJk..kJk..', '.kwwk..kwwk.', '.kkkk..kkkk.']);
  S.heroS_run = heroHead.concat(['..kXUXXUXks.', '.ksXUzzUXk..', '..kUUUUUUk..', '..kUUUUUUk..', '..kJJJJJJk..', '.kJJk..kJJk.', 'kwwk....kwwk', 'kkk......kkk']);
  S.heroS_jump = heroHead.concat(['..kXUXXUXks.', '.ksXUzzUXsk.', '..kUUUUUUk..', '..kUUUUUUk..', '..kJJJJJJk..', '..kJJkkwwk..', '..kwwk.kkk..', '..kkk.......']);
  S.heroS_dead = ['............', '...kkkkkk...', '..khHHhhhk..', '..khhhhhhk..', '..kVVVVVVk..', '..kssssssk..', '..kskssksk..', '...ksSSsk...', '.sskXUUXkss.', '..kXzUUzXk..', '..kUUUUUUk..', '..kUUUUUUk..', '..kJJkkJJk..', '..kJk..kJk..', '.kwwk..kwwk.', '.kkkk..kkkk.'];
  // 爬梯子（背影；水平翻转就是另一帧）
  S.heroS_climb = ['............', '...kkkkkk...', '..khhhhhhk..', '..khHhhhhk..', '..kVVVVVVk..', '.skWWWWWWk..', '.skWWWWWWk..', '..kkkkkkkks.', '..kXUXXUXks.', '..kXUXXUXk..', '..kUUUUUUk..', '..kJJJJJJk..', '..kJJkkJJk..', '..kJk..kJk..', '.kwwk..kwwk.', '.kkkk..kkkk.'];
  // —— 大勇者 12×24 ——
  const bigHead = ['............', '...kkkkk....', '..khHHhhk...', '..khhhhhhk..', '..kkkkkVVVVk', '..kWsssssk..', '..kWssksSk..', '..kWsssssk..', '...ksssSk...', '....kkkk....'];
  S.heroB_stand = bigHead.concat(['..kXUXXUXk..', '.kXXUXXUXXk.', '.ksXUUUUXsk.', '.ksUUzzUUsk.', '.ksUUUUUUsk.', '.kskUUUUksk.', '..kUUUUUUk..', '..kJJJJJJk..', '..kJJkkJJk..', '..kJJkkJJk..', '..kJk..kJk..', '.kwwk..kwwk.', '.kwwk..kwwk.', '.kkkk..kkkk.']);
  S.heroB_run = bigHead.concat(['..kXUXXUXks.', '.kXXUXXUXXks', '.ksXUUUUXk..', '.ksUUzzUUk..', '..kUUUUUUk..', '..kUUUUUUk..', '..kUUUUUUk..', '..kJJJJJJk..', '.kJJJkkJJJk.', '.kJJk..kJJk.', 'kJJk....kJJk', 'kwwk....kwwk', 'kwwk.....kkk', 'kkk.........']);
  S.heroB_jump = bigHead.concat(['..kXUXXUXkss', '.kXXUXXUXXk.', '.ksXUUUUXk..', '.ksUUzzUUk..', '..kUUUUUUk..', '..kUUUUUUk..', '..kUUUUUUk..', '..kJJJJJJk..', '..kJJJkJJk..', '..kJJk.kwwk.', '..kJJk.kwwk.', '..kwwk.kkk..', '..kwwk......', '..kkk.......']);
  // —— 壳壳队长 16×18（朝右，头上系红头巾） ——
  S.turtle_walk1 = [
    '..........kkkk..',
    '.........krrrrk.',
    '......rr.kooooek',
    '.......rrkooookk',
    '...kkkkk.koooook',
    '..kgGggGkkOooook',
    '.kgggGgggkkOok..',
    '.kgGgggGglkok...',
    'kggGgGggglkk....',
    'kgGgggGgglk.....',
    'kggGgGggglok....',
    '.kgggGgglkook...',
    '.kllllllllkok...',
    '..kkkkkkkkk.....',
    '...koOk.koOk....',
    '...kook.kook....',
    '..kooOk.kooOk...',
    '..kkkk..kkkk....',
  ];
  S.turtle_walk2 = S.turtle_walk1.slice(0, 13).concat([
    '..kkkkkkkkk.....',
    '..koOk...koOk...',
    '.kook.....kook..',
    'kooOk.....kooOk.',
    'kkkk......kkkk..',
  ]);
  S.turtle_jump = S.turtle_walk1.slice(0, 13).concat([
    '..kkkkkkkkk.....',
    '..koOkkoOk......',
    '..koOkkoOk......',
    '..kkk..kkk......',
    '................',
  ]);
  S.turtle_hurt = [
    '................', '................', '..........kkkk..', '.........krrrrk.', '......rr.kokokek',
    '.......rrkookook', '...kkkkk.koooook', '..kgGggGkkOooook', '.kgggGgggkkOok..', 'kgGgggGgglkok...',
    'kggGgGggglkk....', 'kgGgggGgglk.....', '.kgggGgglkok....', '.kllllllllkok...', '..kkkkkkkkk.....',
    '.koOkkoOk.......', 'kooOkkooOk......', 'kkkk.kkkk.......',
  ];
  // 缩壳旋转 16×14
  S.spin1 = [
    '................', '................', '.....kkkkkk.....', '...kkgGggGgkk...', '..kgGgggGgggGk..',
    '.kggGgGgggGgggk.', '.kgGgggGgGgggGk.', 'kggGgGgggGgGgggk', 'kgGgggGgGgggGggk', 'kggGgGgggGgGgggk',
    '.kllllllllllllk.', '..kkkkkkkkkkkk..', '................', '................',
  ];
  S.spin2 = [
    '................', '................', '.....kkkkkk.....', '...kkGggGggkk...', '..kGgggGgggGgk..',
    '.kgGgGgggGgggGk.', '.kGgggGgGgggGgk.', 'kgGgGgggGgGgggGk', 'kGgggGgGgggGgggk', 'kgGgGgggGgGgggGk',
    '.kllllllllllllk.', '..kkkkkkkkkkkk..', '................', '................',
  ];
  // 甩出去的壳 12×10
  S.shell1 = [
    '...kkkkkk...', '.kkgGggGgkk.', 'kgGgggGgggGk', 'kggGgGgggGgk', 'kgGgggGgGggk',
    'kggGgGgggGgk', '.kllllllllk.', '..kkkkkkkk..', '............', '............',
  ];
  S.shell2 = [
    '...kkkkkk...', '.kkGggGggkk.', 'kGgggGgggGgk', 'kgGgGgggGgGk', 'kGgggGgGgggk',
    'kgGgGgggGgGk', '.kllllllllk.', '..kkkkkkkk..', '............', '............',
  ];
  // 甲虫兵 10×10
  S.beetle1 = [
    '..k....k..', '...k..k...', '..kkkkkk..', '.kpmppppk.', 'kpmpppPppk',
    'kppPpPpPpk', 'kekpppkekk', 'kkkkkkkkk.', '.kPk..kPk.', '.kk....kk.',
  ];
  S.beetle2 = [
    '..k....k..', '...k..k...', '..kkkkkk..', '.kpmppppk.', 'kpmpppPppk',
    'kppPpPpPpk', 'kekpppkekk', 'kkkkkkkkk.', '..kPkkPk..', '..kk..kk..',
  ];
  S.beetle_flat = ['..........', '..........', '..........', '..........', '..........',
    '..........', '.kkkkkkkk.', 'kpmpPpPppk', 'kekkkkkekk', 'kkkkkkkkkk'];
  // 火球 6×6
  S.fire1 = ['.kFFk.', 'kFxxFk', 'FxfxxF', 'FxxfxF', 'kFxxFk', '.kFFk.'];
  S.fire2 = ['.kffk.', 'kfFFfk', 'fFxxFf', 'fFxxFf', 'kfFFfk', '.kffk.'];
  // 勇气果（强化道具）12×12
  S.item = [
    '.....TT.....', '....TvT.....', '...kkTkk....', '..kqqqqqqk..', '.kquuqqqqqk.', '.kquqqqqqQk.',
    '.kqqqqqqqQk.', '.kqqqqqqQQk.', '.kQqqqqqQQk.', '..kQQQQQQk..', '...kkkkkk...', '............',
  ];
  // 方块 16×16
  S.qblock = [
    'kkkkkkkkkkkkkkkk', 'kuqqqqqqqqqqqqQk', 'kqkqqqqqqqqqqkQk', 'kqqqqqqkkqqqqqQk', 'kqqqqqkuukqqqqQk',
    'kqqqqqkuqkqqqqQk', 'kqqqqqqqkqqqqqQk', 'kqqqqqqkqqqqqqQk', 'kqqqqqqkqqqqqqQk', 'kqqqqqqqqqqqqqQk',
    'kqqqqqqkqqqqqqQk', 'kqqqqqqkqqqqqqQk', 'kqkqqqqqqqqqqkQk', 'kqqqqqqqqqqqqqQk', 'kQQQQQQQQQQQQQQk', 'kkkkkkkkkkkkkkkk',
  ];
  S.qused = [
    'kkkkkkkkkkkkkkkk', 'kdCCCCCCCCCCCCCk', 'kCkCCCCCCCCCCkCk', 'kCCCCCCCCCCCCCCk', 'kCCCCCCCCCCCCCCk',
    'kCCCCCCCCCCCCCCk', 'kCCCCCCCCCCCCCCk', 'kCCCCCCCCCCCCCCk', 'kCCCCCCCCCCCCCCk', 'kCCCCCCCCCCCCCCk',
    'kCCCCCCCCCCCCCCk', 'kCCCCCCCCCCCCCCk', 'kCkCCCCCCCCCCkCk', 'kCCCCCCCCCCCCCCk', 'kCCCCCCCCCCCCCCk', 'kkkkkkkkkkkkkkkk',
  ];
  S.brick = [
    'kkkkkkkkkkkkkkkk', 'kddcccckdcccccck', 'kcccccckccccccCk', 'kCCCCCCkCCCCCCCk', 'kkkkkkkkkkkkkkkk',
    'kcckdcccccckdcck', 'kcckccccccCkccck', 'kCCkCCCCCCCkCCCk', 'kkkkkkkkkkkkkkkk', 'kddcccckdcccccck',
    'kcccccckccccccCk', 'kCCCCCCkCCCCCCCk', 'kkkkkkkkkkkkkkkk', 'kcckdcccccckdcck', 'kCCkCCCCCCCkCCCk', 'kkkkkkkkkkkkkkkk',
  ];
  S.ground = [
    'kkkkkkkkkkkkkkkk', 'vvtvvvvtvvvvvtvv', 'ttttTttttttTtttt', 'TttTTtttTttTTttT', 'kTkkTkkkkTkkkTkk',
    'dccccdccccccdccc', 'ccCcccccdcccCccc', 'cccccCcccccccccC', 'cdcccccccCcccdcc', 'cccCcccdccccCccc',
    'ccccccccccccccc C'.replace(' ', ''), 'cCccdccccCcccccc', 'cccccccccccccdcc', 'ccdcccCccccccccc', 'cccccccccdcccCcc', 'CcccCcccccccccccc'.slice(0, 16),
  ];
  // 管道（原创：石青色、带铆钉）
  S.pipeTop = [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkk', 'knNnnnnnnnnnnnnnnnnnnnnnnNNk', 'knNnenNnnnnnnnnnnnnnnnenNNNk', 'knNnnnnnnnnnnnnnnnnnnnnnNNNk',
    'knNnnnnnnnnnnnnnnnnnnnnnNNNk', 'knNnenNnnnnnnnnnnnnnnnenNNNk', 'kNNNNNNNNNNNNNNNNNNNNNNNNNNk', 'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ];
  S.pipeBody = ['.knNnnnnnnnnnnnnnnnnnnnNNk..', '.knNnnnnnnnnnnnnnnnnnnnNNk..'];

  // 心 7×6
  S.heart = ['.kk.kk.', 'krrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
  S.heartE = ['.kk.kk.', 'kKKkKKk', 'kKKKKKk', '.kKKKk.', '..kKk..', '...k...'];

  // —— 角色选择用：菇菇长老 14×16、熔岩龙王 22×22 ——
  S.shroom = [
    '....kkkkkk....', '..kkaiaaaakk..', '.kaaaaaiaaaak.', 'kaiaaaaaaaiaak', 'kaaaaiaaaaaaak', 'kAaaaaaaaaaAAk',
    '.kkkkkkkkkkkk.', '...kssssssk...', '...kskssksk...', '...ksssssk....', '..kjjjjjjjk.wk', '..kjIjjjjIk.wk',
    '...kjjjjjk..wk', '...kjIjjk...wk', '..kwwk.kwwk.wk', '..kkkk.kkkk.kk',
  ];
  S.dragon = [
    '..k.....k.............', '.kLk...kLk............', '.kLDkkkDLk............', '..kDDDDDDk............', '.kDDeDDDeDk.....kk....',
    '.kDDkDDDkDk....kMMk...', '.kDDDDDDDDk...kMMMMk..', '..kDLLLLDk...kMMMMMk..', '..kDkLkLDk..kMMMMMMk..', '...kDDDDk..kMMMMMMk...',
    '..kDDDDDDkkkMMMMMk....', '.kDDLLLLDDDkkMMMk.....', 'kDDLLLLLLDDDkkkk......', 'kDDLLLLLLDDDDk........', 'kDDLLLLLLDDDDDk.......',
    '.kDDLLLLDDDDDDDk......', '..kDDDDDDkDDDDDDk.....', '..kDDkkDDk.kkDDDDk....', '..kEDk.kEDk...kkDDkk..', '.kEEk..kEEk.....kkDDk.',
    '.kkk...kkk........kkk.', '......................',
  ];
  // 城堡大门 16×52
  const gate = ['kkkkkkkkkkkkkkkk'];
  for (let i = 0; i < 4; i++) gate.push('kzzzZkzzzZkzzzZk', 'kZZZZkZZZZkZZZZk', 'kkkkkkkkkkkkkkkk');
  for (let i = 0; i < 39; i++) gate.push(i % 6 === 0 ? 'kzwwwwwwwwwwwwzk' : (i % 6 === 3 ? 'kzwWwwwwwwwwWwzk' : 'kzwwwwwwwwwwwwzk'));
  S.gate = gate;

  // 没系头巾的"路人"版本（开场动画用）
  const plain = rows => rows.map(r => r.split('').map((c, i) => c === 'r' || c === 'R' ? (i >= 9 ? 'o' : '.') : c).join(''));
  S.turtleP_walk1 = plain(S.turtle_walk1);
  S.turtleP_hurt = plain(S.turtle_hurt);

  function check() {
    for (const k in S) {
      const w = S[k][0].length;
      S[k].forEach((r, i) => { if (r.length !== w) console.warn('sprite', k, 'row', i, 'len', r.length, '!=', w); });
    }
  }

  const cache = {};
  function mk(name, palOverride, flip) {
    const key = name + (palOverride ? JSON.stringify(palOverride) : '') + (flip ? 'F' : '');
    if (cache[key]) return cache[key];
    const rows = S[name], h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ' || ch === undefined) continue;
      const col = (palOverride && palOverride[ch]) || PAL[ch];
      if (!col) continue;
      x.fillStyle = col; x.fillRect(flip ? w - 1 - i : i, j, 1, 1);
    }
    cache[key] = c;
    return c;
  }

  root.ART = { S, PAL, mk, check,
    firePal: { b: '#f6f1e6', B: '#d8462a', r: '#ffb02e', y: '#ffd43b', h: '#ff6a2a', H: '#ffb36b', V: '#a8341a', X: '#ffb02e', U: '#3a3a48', J: '#22222c' },
    starPal: { b: '#ffe066', B: '#f39a48', U: '#ffe066', J: '#f39a48', h: '#fff3b0', H: '#ffffff', V: '#f39a48' } };
})(typeof window !== 'undefined' ? window : globalThis);
