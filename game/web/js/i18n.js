/* 中英双语：画面上的文字都按中文写，显示前经 I18N.tr(文字, 语言) 换成英文。
 * 语言在开场选择，存在 localStorage（sh_lang）。上屏把当前语言随状态发给下屏。
 * 新加文字：在 EN 里加一条；带数字等变量的句子加到 PAT 里。 */
(function (root) {
  'use strict';
  const EN = {
    // —— 关卡 / 角色 ——
    '草原': 'Grassland', '地下水道': 'Underground', '黄昏城墙': 'Dusk Wall',
    '第一道防线': 'First Line', '第二道防线': 'Second Line', '最后一道防线': 'Last Line',
    '壳壳队长': 'Captain Shell', '菇菇长老': 'Elder Spore', '熔岩龙王': 'Magma King',
    '第一道防线，交给我。': 'Leave the first line to me.',
    '这条水道，谁也别想钻过去。': 'Nobody sneaks through these tunnels.',
    '公主就在我身后。想过去？先过我。': 'The princess is behind me. Get through me first.',
    '冲撞': 'Dash', '甩壳': 'Shell Toss', '甲虫兵': 'Beetle',
    '翻滚': 'Roll', '掷孢子': 'Spore Toss', '小蘑菇': 'Mini Shroom',
    '冲锋': 'Charge', '吐火球': 'Fire Breath', '小火苗': 'Little Flame', '小火龙': 'Mini Drake',
    '小勇者': 'Small Hero', '大勇者': 'Big Hero', '火焰勇者': 'Fire Hero',
    '投掷': 'Throw', '召唤': 'Summon', '跳跃': 'Jump', '小兵': 'Minion',
    // —— 开场 / 标题 ——
    '大王掳走了公主，命我们三个守住城门。': 'The Demon King took the princess. We three were told to guard the gate.',
    '谁说我们天生就是配角？': "Who says we're born to be supporting characters?",
    '这一次，我们三个，也要当一回主角。': 'This time, the three of us get to be the main characters too.',
    '进击的 NPC · 现在开始': 'NPCs Strike Back · Starting now',
    '按 START 开始': 'Press START',
    'B 退出游戏': 'B  Quit game',
    '按 START 跳过': 'Press START to skip',
    '▶ 开始守关': '▶ Start defending',
    '退出游戏 · 回到桌面': 'Quit to home screen',
    '操作': 'Controls',
    '左摇杆 / 十字键：移动': 'Left stick / D-pad: move',
    '右摇杆左右甩：朝那边投掷': 'Flick right stick: throw that way',
    'START：暂停    SELECT：音乐开关': 'START: pause    SELECT: music on/off',
    '规则：勇者只能踩你的头才算打中你；他从侧面碰到你就会受伤。': 'Rule: the hero only hurts you by stomping your head. Touch him from the side and he gets hurt.',
    // —— 关卡开场 ——
    '勇者有 3 条命，问号块里有变大果和加命果。': 'The hero has 3 lives. ? blocks hold grow fruit and 1-ups.',
    '注意：这一关的勇者学会了螺旋桨帽——会二段跳，还能慢慢飘。': 'Careful: heroes here wear propeller caps — double jump and slow glide.',
    '最后一道防线：勇者带上了无敌星，碰到他就要掉血，快跑！': 'Last line: heroes carry the star. Touch him and you get hurt — run!',
    // —— 对战 ——
    '守住了！': 'Held!', '防线失守……勇者闯过去了': 'Line lost… the hero broke through',
    '勇者的命全用完了！': 'The hero is out of lives!',
    '暂停': 'Paused', '继续': 'Resume', '重新开始': 'Restart', 'A/B 键对调': 'Swap A/B', 'X/Y 键对调': 'Swap X/Y',
    '音乐': 'Music', '回到标题': 'Back to title', '退出游戏': 'Quit game',
    '已对调': 'swapped', '默认': 'default', '开': 'on', '关': 'off',
    '打掉螺旋桨！': 'Propeller gone!', '打掉强化！': 'Power-up gone!', '撞倒了！': 'Knocked down!',
    '无敌星！10 秒': 'Star! 10 s', '螺旋桨帽！': 'Propeller cap!', '+1 条命！': '+1 life!', '无敌结束': 'Star over',
    '抢吃！+1 ♥': 'Snatched! +1 ♥', '叮！': 'Clang!', '回收': 'Got it back',
    // —— 守住一关 / 失守 ——
    '第一道防线，守住了！': 'The first line held!',
    '勇者见正面打不过，抡起铲子往下挖，从地底下绕到你身后，溜进了地下水道。': 'Beaten head-on, the hero dug straight down, came up behind you, and slipped into the underground.',
    '第二道防线，也守住了！': 'The second line held too!',
    '勇者顶到一顶螺旋桨帽，从左边缺口飞上天花板，踩着你头顶走了过去。下一关是城墙，他再也绕不掉了。': 'The hero found a propeller cap, flew up through the gap and walked across the ceiling over your head. Next is the wall — no more detours left.',
    '按 A 继续': 'Press A to continue', 'A 继续': 'A  Continue',
    '第一道防线失守……': 'The first line fell…', '第二道防线也失守了……': 'The second line fell too…',
    '勇者踩着你走了过去，大摇大摆推开城门，进了地下水道。': 'The hero stepped right over you, pushed the gate open and strolled into the underground.',
    '勇者一路闯过水道，直奔城墙。只剩最后一道防线了！': 'The hero tore through the tunnels and headed for the wall. Only the last line is left!',
    '不管前面守没守住，最后一道防线都得硬碰硬。': 'Whatever happened before, the last line is a straight fight.',
    '最后一道防线失守……': 'The last line fell…',
    '有一道防线早就破了……': 'One of the lines had already fallen…',
    '勇者撞开了城墙，一路杀进城堡，把公主带走了。': 'The hero smashed through the wall, stormed the castle and carried the princess off.',
    '勇者早就从地道绕进了城堡深处；等你守住城墙时，公主已经被他带走了。': 'The hero had already slipped into the castle through the tunnels; by the time you held the wall, the princess was gone.',
    '守住最后一道防线，公主就不会被救走。': 'Hold the last line and the princess stays put.',
    'A 从第一关重新开始     B 回到标题': 'A  Restart from line 1     B  Back to title',
    'A 从第一关重开': 'A  Restart from line 1',
    'A 从第一关重新开始': 'A  Restart from line 1', 'A 重守这一道防线': 'A  Defend this line again',
    '前面的防线你都守住了，勇者还被挡在这里——再守一次！': 'You held every line before this one. The hero is still stuck here — hold it again!',
    '防线失守 · 再守一次': 'Line fallen · try again',
    '前面守住的不作废，重守这一道就行。': 'Lines you held still count. Just hold this one again.',
    '防线失守 · 公主被带走了': 'Line fallen · the princess was carried off',
    '公主还在，守住剩下的防线。': 'The princess is still safe. Hold the remaining lines.',
    '最后一道防线，守住了！': 'The last line held!',
    '我们没能守住每一次，可最后这一道，我们守住了。': "We didn't hold every line. But we held the last one.",
    '勇者冲过了这条线，一路杀进城堡，把公主救走了。': 'The hero broke through, stormed the castle, and rescued the princess.',
    '提示：他从上方落下时按 B 缩壳——冲撞中被踩不掉血。': 'Tip: when he drops on you, press B — you can\'t be stomped mid-dash.',
    'A 重守这一道防线     B 回到标题': 'A  Defend this line again     B  Back to title',
    'A 重守这一关': 'A  Try again', 'B 回到标题': 'B  Back to title', '防线失守': 'Line lost',
    '防线失守 · 公主被救走了': 'Line lost · princess rescued',
    // —— 结局 ——
    '三道防线，全部守住了！': 'All three lines held!',
    '……可勇者，总会再回来。': '…But heroes always come back.',
    '他带来了一整队伙伴，': 'He brought a whole squad of companions,',
    '带来了上天赐予的神力，': 'power from the heavens,',
    '还有——主角光环。': 'and the one thing we never had: plot armor.',
    '我们守住了每一次。': 'We held the line. Every single time.',
    '可这个故事，从来不是为我们写的。': 'But this story was never written for us.',
    '他们荡平了我们三个，又冲进去，把掳走公主的大王也打败了。': 'They flattened us, stormed in, and beat the King who took the princess.',
    '但就在刚才那一会儿——': 'And yet, for a little while —',
    '有一双手握着手柄，替我们跳，替我们挡，替我们拼命。': 'someone held the controller, and jumped, and fought, for us.',
    '那一会儿，我们是主角。': 'For that little while, we were the main character.',
    '主演': 'Starring', '特别出演': 'Special appearance', '以及': 'And',
    '壳壳队长 …… 你': 'Captain Shell …… you', '菇菇长老 …… 你': 'Elder Spore …… you', '熔岩龙王 …… 你': 'Magma King …… you',
    '小兵们 …… 你召唤的': 'The minions …… summoned by you', '问号块 …… 本色出演': '? Blocks …… as themselves', '城门 …… 已拆除': 'The Gate …… demolished',
    '勇者 …… 永远的主角': 'The Hero …… forever the lead', '伙伴大军 …… 十几个勇者': 'The Squad …… a dozen heroes',
    '公主 …… 永远的女一号': 'The Princess …… forever the leading lady', '大王 …… 掳走公主的那位': 'The King …… who took the princess', '握着手柄的你': 'You, holding the controller',
    '谢谢你，让一个 NPC 当了一回主角。': 'Thank you for letting an NPC be the main character, just once.',
    '▶ A 重新开始': '▶ A  Play again', 'A 重新开始': 'A  Play again', 'START 跳到片尾': 'START: skip to credits',
    '守关日志': "Defender's Log", '三位守关者': 'The three defenders', '击退勇者': 'Heroes repelled', '守住防线': 'Lines held',
    '总用时': 'Total time', '城门': 'Gate', '已失守': 'Lost', '守住了': 'Held', '剧情需要': 'Plot demands',
    // —— 下屏 ——
    '守关者 · 你': 'Defender · you', '勇者': 'Hero', '螺旋桨': 'Propeller', '倒下了': 'Down', '剩余命': 'Lives',
    '按任意键…': 'press any key…',
    '勇者落下来时按 B 冲撞：冲撞中被踩不掉血。': 'When the hero drops on you, press B: you can\'t be stomped mid-dash.',
    '勇者顶开问号块会掉出勇气果，抢先吃掉能回 1 颗心！': 'Hit ? blocks drop fruit — grab it first to heal 1 heart!',
    '你扔出去的东西被勇者踩停后会被踢回来，闪红的会打到你。': 'If he stomps your throw, he can kick it back — red ones hurt you.',
    '你冲撞时撞到闪红的投掷物，会把它弹回去。': 'Dash into a red throw to bounce it back.',
    '小兵能逼勇者跳起来——趁他落地前去堵他。': 'Minions force the hero to jump — catch him before he lands.',
    '火焰勇者会远程扔火球，冲撞能把火球弹掉。': 'Fire heroes throw fireballs. Dash to knock them away.',
    '勇者顶出绿色果子会多一条命——抢先吃掉它！': 'Green fruit gives the hero a life — eat it first!',
    '戴螺旋桨帽的勇者能在空中再起飞一次，别站在他正下方。': 'Propeller heroes can lift off again mid-air. Don\'t stand under them.',
    '勇者吃了无敌星，10 秒内碰到就掉血——赶紧跑，等它闪烁结束。': 'A starred hero hurts on touch for 10 s — run until the flashing stops.',
    // —— 设置 / 菜单 ——
    '设置': 'Settings', '语言': 'Language', '返回标题': 'Back', '过场预览 · 三关全胜': 'Cutscene preview · win all 3',
    '开始守关': 'Start defending',
    '设置 · 语言 / 音乐': 'Settings · Language / Music',
    '上下选择 · A 确认': 'Up/Down · A select',
    '上下选择 · 左右调整 · B 返回': 'Up/Down · L/R · B back',
  };
  const t1 = s => (EN[s] != null ? EN[s] : s);
  // 带变量的句子：[正则, 换成英文的函数]
  const PAT = [
    [/^第 (\d+) \/ (\d+) 关$/, (m) => `Line ${m[1]} / ${m[2]}`],
    [/^守关者：(.+)　「(.+)」$/, (m) => `${t1(m[1])}: "${t1(m[2])}"`],
    [/^第 (\d+) 位勇者：(.+)！$/, (m) => `Hero #${m[1]}: ${t1(m[2])}!`],
    [/^勇者倒下了！还剩 (\d+) 条命…$/, (m) => `Hero down! ${m[1]} ${m[1] === '1' ? 'life' : 'lives'} left…`],
    [/^(▶ |   )(.+)$/, (m) => m[1] + tr(m[2], 'en')],
    [/^(.+)：(已对调|默认|开|关)$/, (m) => `${t1(m[1])}: ${t1(m[2])}`],
    [/^(.+)（已对调）$/, (m) => `${t1(m[1])} (swapped)`],
    [/^音乐：(开|关)$/, (m) => `Music: ${t1(m[1])}`],
    [/^最近按键：(.*)$/, (m) => `Last key: ${m[1]}`],
    [/^按键检测：(.*)$/, (m) => `Key check: ${t1(m[1])}`],
    [/^(.+)击倒！$/, (m) => `${t1(m[1])} KO!`],
    [/^(.+)立功！$/, (m) => `${t1(m[1])} scores!`],
    [/^下一位守关者：(.*)$/, (m) => `Next defender: ${t1(m[1])}`],
    [/^下一位：(.*)$/, (m) => `Next: ${t1(m[1])}`],
    [/^(.+)失守……$/, (m) => `${t1(m[1])} lost…`],
    [/^第 (\d+) 位$/, (m) => `Hero #${m[1]}`],
    [/^★ 无敌 (\d+)s$/, (m) => `★ Star ${m[1]}s`],
    [/^用时 (\d+) 秒 · 剩余 (\d+) ♥$/, (m) => `Time ${m[1]} s · ${m[2]} ♥ left`],
    [/^用时 (\d+) 秒$/, (m) => `Time ${m[1]} s`],
    [/^剩余 (\d+) 颗心$/, (m) => `${m[1]} hearts left`],
    [/^被踩 (\d+) 次$/, (m) => `Stomped ${m[1]}×`],
    [/^打中勇者 (\d+) 次$/, (m) => `Hit the hero ${m[1]}×`],
    [/^第 (\d+) 道防线 · 失守了$/, (m) => `Line ${m[1]} fell`],
    [/^坚持了 (\d+) 秒 · 勇者闯过去了$/, (m) => `Held ${m[1]} s · the hero got through`],
    [/^这一局坚持了 (\d+) 秒 · 三道防线守住了 (\d+) 道$/, (m) => `The run lasted ${m[1]} s · you held ${m[2]} of 3 lines`],
    [/^这一局 (\d+) 秒$/, (m) => `Run ${m[1]} s`],
    [/^三道防线守住了 (\d+) 道$/, (m) => `Held ${m[1]} of 3 lines`],
    [/^第 (\d+) 道防线 · 守住了！$/, (m) => `Line ${m[1]} held!`],
    [/^(\d+) 秒$/, (m) => `${m[1]} s`],
    [/^💡 (.+)$/, (m) => '💡 ' + tr(m[1], 'en')],
    [/^(\S+) (\d+\/\d+)$/, (m) => `${t1(m[1])} ${m[2]}`],
    [/^(\d\/3)  (.+)$/, (m) => `${m[1]}  ${tr(m[2], 'en')}`],
    [/^(.+)！$/, (m) => EN[m[1]] != null ? EN[m[1]] + '!' : null],
    [/^(.+?) · (.+)$/, (m) => { const a = tr(m[1], 'en'), b = tr(m[2], 'en'); return a === m[1] && b === m[2] ? null : `${a} · ${b}`; }],
  ];
  const CJK = /[㐀-鿿！-～]/;
  const missing = new Set();
  function tr(s, lang) {
    if (lang !== 'en' || s == null || s === '') return s;
    s = String(s);
    if (EN[s] != null) return EN[s];
    if (!CJK.test(s)) return s;
    for (const [re, f] of PAT) { const m = re.exec(s); if (m) { const r = f(m); if (r != null) return r; } }
    if (!missing.has(s)) { missing.add(s); if (root.console) console.warn('[i18n] 未翻译：', s); }
    return s;
  }
  function get() { try { return localStorage.getItem('sh_lang') || ''; } catch (e) { return ''; } }
  function set(l) { try { localStorage.setItem('sh_lang', l); } catch (e) { } }
  root.I18N = { tr, get, set, missing };
})(typeof window !== 'undefined' ? window : globalThis);
