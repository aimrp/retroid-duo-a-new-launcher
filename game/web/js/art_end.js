/* STOP · 结局用的像素美术：公主、小精灵、银甲骑士配色（全部原创） */
(function (root) {
  'use strict';
  const ART = root.ART, S = ART.S, PAL = ART.PAL;
  // 数字当作额外色号
  Object.assign(PAL, { 1: '#ff9cc4', 2: '#c9507e', 3: '#ffe3f0', 4: '#e8a33a', 5: '#fff7c2' });

  // 公主 12×22（朝右）
  S.princess = [
    '....y.y.y...',
    '....yyyyy...',
    '...k44444k..',
    '..k4ssss44k.',
    '..k4sksks4k.',
    '..k4ssss44k.',
    '..k44SS444k.',
    '...k4kk44k..',
    '...k1111k...',
    '..ks1331sk..',
    '..ks1221sk..',
    '...k1111k...',
    '...k1111k...',
    '..k111111k..',
    '..k113311k..',
    '.k11111111k.',
    '.k11211211k.',
    'k1111111111k',
    'k1121111211k',
    'k2222222222k',
    '.kkkkkkkkkk.',
    '...kk..kk...',
  ];
  S.princess2 = S.princess.slice(0, 20).concat(['.kkkkkkkkkk.', '..kk....kk..']);

  // 小精灵 8×8
  S.fairy = [
    '.n....n.',
    'nen..nen',
    'neenneen',
    '.ne55en.',
    '..5FF5..',
    '.ne55en.',
    'nen..nen',
    '.n....n.',
  ];
  S.fairy2 = [
    '........',
    '.n....n.',
    'neenneen',
    '.ne55en.',
    '..5FF5..',
    '.ne55en.',
    '.n....n.',
    '........',
  ];

  // —— 三位守关者的动作帧（由原图派生）——
  S.shroom_w2 = S.shroom.slice(0, 14).concat(['...kwwkkwwk.wk', '...kkkkkkkk.kk']);
  S.shroom_hurt = Array(4).fill('..............').concat(S.shroom.slice(0, 6), S.shroom.slice(10, 16));
  S.dragon_w2 = S.dragon.slice(0, 18).concat(['...kEDkkEDk...kkDDkk..', '...kEEkkEEk.....kkDDk.', '...kkk.kkk........kkk.', '......................']);
  S.dragon_hurt = Array(4).fill('......................').concat(S.dragon.slice(0, 9), S.dragon.slice(13, 22));
  ART.kicked = { g: '#ff4d6d', G: '#ffe066', l: '#ffffff' };
  // 小火龙 12×10（朝左，和龙王一样）
  S.drake = ['...k.k......', '..kDkDk.....', '.kDDDDDk....', 'kDeDDDDDk.kk', 'kDDDDDDDkkMk',
    '.kkLLDDDDDk.', '..kLLLDDDDk.', '..kDDDDDDk..', '..kEk.kEk...', '..kk..kk....'];
  ART.KINDS = {
    turtle: { walk1: 'turtle_walk1', walk2: 'turtle_walk2', jump: 'turtle_jump', hurt: 'turtle_hurt', plain: 'turtleP_walk1', plainHurt: 'turtleP_hurt',
      fx: null, minionPal: null },
    shroom: { walk1: 'shroom', walk2: 'shroom_w2', jump: 'shroom', hurt: 'shroom_hurt',
      fx: { g: '#3aa7c9', G: '#22708c', l: '#f7e27a' }, minionPal: { p: '#3aa7c9', P: '#22708c', m: '#a8e6ff' } },
    dragon: { walk1: 'dragon', walk2: 'dragon_w2', jump: 'dragon', hurt: 'dragon_hurt', faceLeft: true,
      fx: { g: '#d83b2b', G: '#8f1f22', l: '#ffb347' }, minionPal: { p: '#ff7a1f', P: '#c0391b', m: '#ffd43b' } },
  };

  // —— 勇者道具 ——
  S.starItem = [
    '.....kk.....',
    '....kxxk....',
    '....kxxk....',
    'kkkkkxxkkkkk',
    'kxxxxxxxxxxk',
    '.kxxkxxkxxk.',
    '..kxkxxkxk..',
    '..kxxxxxxk..',
    '.kxxxkkxxxk.',
    '.kxxk..kxxk.',
    'kxxk....kxxk',
    'kkk......kkk',
  ];
  S.propItem = [
    'kkkkk..kkkkk',
    'kvvvvkkvvvvk',
    '.kkkkkkkkkk.',
    '.....kk.....',
    '...kkkkkk...',
    '..kbbbbbbk..',
    '.kbbHbbbbbk.',
    '.kbHbbbbbbk.',
    'kbbbbbbbbbbk',
    'kBBBBBBBBBBk',
    '.kkkkkkkkkk.',
    '............',
  ];
  ART.starFlash = { x: '#ffffff' };
  ART.lifePal = { q: '#5fd36a', Q: '#2b8a3e', u: '#c8ffb0', T: '#8a5a2b', v: '#c08040' };
  ART.rainbow = [
    { b: '#ffe066', B: '#f39a48', h: '#fff3b0', r: '#ffffff' },
    { b: '#ff6b6b', B: '#c0392b', h: '#ffd0d0', r: '#ffe066' },
    { b: '#7dffb0', B: '#2b8a3e', h: '#e0fff0', r: '#ffffff' },
    { b: '#a8e6ff', B: '#3b8fd0', h: '#ffffff', r: '#ffe066' },
  ];

  // 龙吐的火球 12×8（朝右）
  S.dfire1 = ['......kkkk..', '...kkfFFFFk.', '.kfffFxxxFFk', 'kffFFxxxxxFk', 'kffFFxxxxxFk', '.kfffFxxxFFk', '...kkfFFFFk.', '......kkkk..'];
  S.dfire2 = ['.......kkk..', '..kkkfFFFFk.', 'kfffFFxxxFFk', '.kfFFxxxxxFk', 'kffFFxxxxxFk', '.kffFFxxxFFk', '..kkkfFFFFk.', '.......kkk..'];

  ART.knightPal = { h: '#d9dce8', H: '#ffffff', b: '#7a5ac9', B: '#4a3486', U: '#7a5ac9', J: '#4a3486', X: '#c9cce0', V: '#8888a0', r: '#c9cce0', R: '#8888a0', y: '#f5c84a', s: '#e9b98a' };
})(window);
