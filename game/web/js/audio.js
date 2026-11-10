/* STOP · The Stompers · 8-bit 音效与原创配乐（WebAudio 现场合成，无音频文件） */
(function (root) {
  'use strict';
  let ctx = null, master = null, musicGain = null, sfxGain = null, musicOn = (typeof localStorage === 'undefined' || localStorage.getItem('sh_music') !== '0'), timer = null, song = null, songStep = 0, nextTime = 0;

  const MUTED = typeof location !== 'undefined' && /[?&]mute=1/.test(location.search); // 电脑预览页默认静音
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = MUTED ? 0 : 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = musicOn ? 0.22 : 0; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
  }

  function tone(type, f0, f1, dur, vol, when, dest) {
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, hp) {
    if (!ctx) return;
    const n = ctx.sampleRate * dur, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp || 800;
    s.buffer = buf; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(sfxGain); s.start();
  }

  const SFX = {
    jump: () => tone('square', 330, 720, 0.13, 0.16),
    heroJump: () => tone('square', 440, 900, 0.1, 0.07),
    stomp: () => { tone('square', 300, 90, 0.16, 0.25); noise(0.08, 0.2, 400); },
    squish: () => tone('square', 500, 120, 0.1, 0.16),
    dash: () => { tone('sawtooth', 160, 520, 0.18, 0.12); noise(0.15, 0.08, 2000); },
    thud: () => { tone('triangle', 140, 50, 0.15, 0.4); noise(0.1, 0.15, 200); },
    throw: () => tone('square', 700, 260, 0.14, 0.15),
    summon: () => { [520, 660, 780].forEach((f, i) => tone('square', f, f, 0.07, 0.12, ctx && ctx.currentTime + i * 0.05)); },
    bonk: () => tone('triangle', 220, 160, 0.06, 0.25),
    qhit: () => { tone('square', 990, 990, 0.05, 0.12); tone('square', 1320, 1320, 0.12, 0.12, ctx && ctx.currentTime + 0.05); },
    clank: () => { tone('square', 1500, 900, 0.08, 0.14); tone('square', 1100, 700, 0.1, 0.1, ctx && ctx.currentTime + 0.03); },
    kick: () => tone('square', 200, 600, 0.08, 0.2),
    hurtHero: () => { tone('square', 700, 200, 0.25, 0.16); },
    heroDie: () => { [660, 520, 440, 330, 262].forEach((f, i) => tone('square', f, f * 0.97, 0.12, 0.14, ctx && ctx.currentTime + i * 0.1)); },
    defHurt: () => { tone('sawtooth', 400, 80, 0.3, 0.2); noise(0.12, 0.25, 300); },
    powerup: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.07, 0.1, ctx && ctx.currentTime + i * 0.06)); },
    eat: () => { [523, 659, 523, 784].forEach((f, i) => tone('triangle', f, f, 0.08, 0.3, ctx && ctx.currentTime + i * 0.07)); },
    fire: () => tone('square', 900, 300, 0.09, 0.08),
    select: () => tone('square', 880, 880, 0.05, 0.12),
    confirm: () => { tone('square', 660, 660, 0.06, 0.13); tone('square', 990, 990, 0.1, 0.13, ctx && ctx.currentTime + 0.06); },
    deny: () => tone('square', 180, 140, 0.15, 0.15),
    type: () => tone('square', 1200 + Math.random() * 200, 1200, 0.02, 0.04),
    slam: () => { tone('triangle', 110, 40, 0.5, 0.6); noise(0.3, 0.3, 120); },
    pause: () => tone('square', 1000, 500, 0.12, 0.12),
    beam: () => { tone('sawtooth', 1800, 120, 0.7, 0.14); tone('sine', 220, 55, 0.9, 0.5); noise(0.6, 0.25, 300); },
    crumble: () => { noise(1.4, 0.35, 90); tone('triangle', 80, 30, 1.2, 0.5); },
    chime: () => { [1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, f, 0.35, 0.09, ctx && ctx.currentTime + i * 0.07)); },
    rise: () => { tone('sine', 220, 880, 1.0, 0.18); tone('triangle', 330, 1320, 1.0, 0.1); },
    heart: () => { [784, 988].forEach((f, i) => tone('sine', f, f, 0.3, 0.12, ctx && ctx.currentTime + i * 0.12)); },
    bounce: () => tone('square', 900, 1400, 0.08, 0.12),
    victory: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, 0.14, 0.13, ctx && ctx.currentTime + i * 0.12)); },
    defeat: () => { [392, 370, 349, 330, 311, 294].forEach((f, i) => tone('triangle', f, f, 0.22, 0.35, ctx && ctx.currentTime + i * 0.2)); },
  };

  // —— 原创配乐：每个字符是一个 1/8 拍，'.' 休止 ——
  const N = { C3: 131, D3: 147, E3: 165, F3: 175, G3: 196, A3: 220, B3: 247, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880 };
  const SONGS = {
    // 草原：轻快、有点"反派得意"的小调转大调
    grass: { bpm: 150,
      lead: 'A4 . C5 . E5 . D5 C5 | A4 . G4 . E4 . . . | F4 . A4 . C5 . B4 A4 | G4 . . . E4 . G4 . | A4 . C5 . E5 . G5 E5 | D5 . C5 . A4 . . . | F4 G4 A4 . E4 . D4 . | E4 . . . . . . .',
      bass: 'A3 . E3 . A3 . E3 . | F3 . C3 . F3 . C3 . | D3 . A3 . D3 . A3 . | E3 . B3 . E3 . G3 . | A3 . E3 . A3 . E3 . | F3 . C3 . F3 . C3 . | D3 . A3 . E3 . B3 . | A3 . E3 . A3 . . .' },
    // 标题：慢一点的进行曲
    title: { bpm: 112,
      lead: 'E4 . . G4 A4 . . . | C5 . B4 . A4 . G4 . | A4 . . . . . . . | . . . . . . . . | E4 . . G4 A4 . . . | D5 . C5 . B4 . G4 . | A4 . . . . . . . | . . . . . . . .',
      bass: 'A3 . A3 . A3 . A3 . | F3 . F3 . F3 . F3 . | G3 . G3 . G3 . G3 . | E3 . E3 . E3 . E3 . | A3 . A3 . A3 . A3 . | F3 . F3 . F3 . F3 . | G3 . G3 . E3 . E3 . | A3 . . . . . . .' },
  };
  function parse(s) { return s.replace(/\|/g, ' ').trim().split(/\s+/).map(t => t === '.' ? 0 : N[t] || 0); }

  function schedule() {
    if (!ctx || !song) return;
    const spb = 60 / song.bpm / 2;
    while (nextTime < ctx.currentTime + 0.2) {
      const i = songStep % song.L.length;
      if (song.L[i]) tone('square', song.L[i], song.L[i], spb * 0.9, 0.18, nextTime, musicGain);
      if (song.B[i]) tone('triangle', song.B[i], song.B[i], spb * 0.95, 0.5, nextTime, musicGain);
      if (i % 4 === 0) { /* 底鼓 */ tone('sine', 90, 40, 0.08, 0.35, nextTime, musicGain); }
      nextTime += spb; songStep++;
    }
  }
  const BATTLE_BPM = { grass: 150, cave: 162, wall: 176 };
  function play(name) {
    if (BATTLE_BPM[name]) return playBattle(name, BATTLE_BPM[name]);
    init(); if (!ctx) return;
    const s = SONGS[name];
    if (!s) { stop(); return; }
    if (song && song.name === name) return;
    stop();
    song = { name, bpm: s.bpm, L: parse(s.lead), B: parse(s.bass) };
    songStep = 0; nextTime = ctx.currentTime + 0.05;
    if (!timer) timer = setInterval(schedule, 60);
  }
  // ———— 结局：原创慢三拍圆舞曲；也可放入你自己的音频文件替换 ————
  function nf(n) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n); if (!m) return 0;
    const st = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (st + (+m[3] + 1) * 12 - 69) / 12);
  }
  function voice(type, f, t, dur, vol, att) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.05);
  }
  const CH = { Am: ['A2', 'E3', 'C4'], C: ['C3', 'G3', 'E4'], G: ['G2', 'D3', 'B3'], Dm: ['D3', 'A3', 'F4'], F: ['F2', 'C3', 'A3'], E: ['E2', 'B2', 'G#3'] };
  const WALTZ = {
    // 结尾曲：A 小调，每小节三拍，'-' 表示延长
    ending: { bpm: 70, loops: 99,
      mel: 'A4 - C5 | E5 - - | D5 C5 B4 | C5 - - | A4 - C5 | E5 - G5 | F5 E5 D5 | E5 - - | F5 - E5 | D5 - C5 | B4 - A4 | G4 - - | A4 - B4 | C5 - E5 | D5 - B4 | A4 - -',
      chords: 'Am Am G C Am C Dm Am F Dm E C F Am E Am' },
    // 勇者压境：低沉、稀疏
    dread: { bpm: 50, loops: 99,
      mel: '. . . | E4 - - | . . . | F4 - E4 | . . . | E4 - - | . . . | D#4 - -',
      chords: 'Am Am Dm Am Am Am F E' },
  };
  let wz = null, wzTimer = null;
  function wzParse(w) {
    const tk = w.mel.replace(/\|/g, ' ').trim().split(/\s+/), notes = [];
    tk.forEach((x, i) => { if (x !== '-' && x !== '.') { let len = 1; while (tk[i + len] === '-') len++; notes[i] = { f: nf(x), len }; } });
    return { notes, beats: tk.length, chords: w.chords.split(/\s+/) };
  }
  function wzSchedule() {
    if (!ctx || !wz) return;
    const spb = 60 / wz.bpm;
    while (wz.next < ctx.currentTime + 0.25) {
      const i = wz.step % wz.p.beats, pass = Math.floor(wz.step / wz.p.beats), pos = i % 3;
      const ch = CH[wz.p.chords[Math.floor(i / 3)]] || CH.Am, t = wz.next;
      if (pos === 0) voice('triangle', nf(ch[0]), t, spb * 2.8, 0.55, 0.02);
      else voice('sine', nf(ch[pos]), t, spb * 0.9, wz.name === 'dread' ? 0.12 : 0.16, 0.03);
      const n = wz.p.notes[i];
      if (n) {
        voice('square', n.f, t, spb * n.len * 0.95, 0.06, 0.04);
        voice('triangle', n.f, t, spb * n.len, 0.22, 0.02);
        if (pass % 2 === 1 && wz.name === 'ending') voice('sine', n.f * 2, t, spb * n.len * 1.2, 0.07, 0.01); // 第二遍加八音盒
      }
      wz.next += spb; wz.step++;
    }
  }
  function playWaltz(name) {
    init(); if (!ctx) return;
    if (wz && wz.name === name) return;
    stop();
    const w = WALTZ[name];
    wz = { name, bpm: w.bpm, p: wzParse(w), step: 0, next: ctx.currentTime + 0.1 };
    if (!wzTimer) wzTimer = setInterval(wzSchedule, 60);
  }

  // 外部结尾曲：把你自己的音频放到 web/audio/ending.mp3（或 .m4a / .ogg），有就优先播放
  let ext = null;
  const EXT = ['audio/ending.mp3', 'audio/ending.m4a', 'audio/ending.ogg'];
  function playEnding() {
    init(); stop();
    let i = 0;
    const tryNext = () => {
      if (i >= EXT.length) { playWaltz('ending'); return; }
      const a = new Audio(EXT[i++]); let failed = false;
      const fail = () => { if (failed || ext === a) return; failed = true; tryNext(); };
      a.volume = musicOn && !MUTED ? 0.9 : 0;
      a.addEventListener('error', fail, { once: true });
      const pr = a.play(); if (pr && pr.then) pr.then(() => { if (!failed) ext = a; }).catch(fail);
    };
    tryNext();
  }
  function fadeOut(sec) {
    if (ext) { const a = ext, v0 = a.volume, n = Math.max(1, Math.round(sec * 20)); let k = 0; const iv = setInterval(() => { a.volume = Math.max(0, v0 * (1 - ++k / n)); if (k >= n) { clearInterval(iv); a.pause(); } }, 50); ext = null; return; }
    if ((wz || song || bt) && ctx) { const cw = wz, cs = song, cb = bt; musicGain.gain.setTargetAtTime(0, ctx.currentTime, sec / 3);
      setTimeout(() => { if (wz === cw && song === cs && bt === cb) { wz = null; song = null; bt = null; resetGain(); } }, sec * 1000); }
  }

  function resetGain() { if (!ctx) return; musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setValueAtTime(musicOn ? 0.22 : 0, ctx.currentTime); }
  // ———— 对战主题（原创）：E 小调，十六分音符驱动；三关越来越快 ————
  const BATTLE = {
    lead: [
      'E5 . E5 . G5 . E5 . B5 - - . A5 . G5 F#5', 'E5 . E5 . G5 . A5 . B5 - - - . . . .',
      'C6 . B5 . A5 . G5 . E5 - . G5 . A5 . .', 'D6 . C6 . B5 . A5 . F#5 - - - A5 - B5 -',
      'E5 . E5 . G5 . E5 . B5 - - . A5 . G5 F#5', 'E5 . E5 . G5 . B5 . E6 - - . D6 . B5 .',
      'C6 - B5 - A5 - G5 - A5 . B5 . C6 . D6 .', 'D#6 - - - B5 - - - F#5 - - - D#5 - - -',
      'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .', 'A5 - - . G5 . A5 . C6 - - . B5 . A5 .',
      'G5 . F#5 . E5 . B4 . E5 . G5 . B5 . E6 .', 'D6 - - - B5 - - - G5 - - - E5 - - -',
      'E5 . G5 . C6 . E6 . D6 . C6 . B5 . G5 .', 'F#5 . A5 . D6 . F#6 . E6 . D6 . A5 . F#5 .',
      'B5 . A5 . G5 . F#5 . D#5 . F#5 . A5 . B5 .', 'B5 - - - - - - - D#6 . C6 . B5 . A5 .',
    ],
    chords: 'Em Em C D Em Em C B Am Am Em Em C D B B'.split(' '),
    drums: ['k.h.s.hkk.h.s.hh', 'k.h.s.hkk.h.s.hh', 'k.h.s.hkk.h.s.hh', 'k.h.s.hkk.h.s.hh',
      'k.h.s.hkk.h.s.hh', 'k.h.s.hkk.h.s.hh', 'k.h.s.hkk.h.s.hh', 's.s.s.sss.sssk.k.',
      'k.hks.hkk.hks.hh', 'k.hks.hkk.hks.hh', 'k.hks.hkk.hks.hh', 'k.hks.hkk.hks.hh',
      'k.hks.hkk.hks.hh', 'k.hks.hkk.hks.hh', 'k.hks.hkk.hks.hh', 'sssssssssssk.k.k'],
  };
  const BROOT = { Em: ['E2', 'E3'], C: ['C2', 'C3'], D: ['D2', 'D3'], B: ['B1', 'B2'], Am: ['A1', 'A2'] };
  const BARP = { Em: ['E4', 'G4', 'B4', 'E5'], C: ['C4', 'E4', 'G4', 'C5'], D: ['D4', 'F#4', 'A4', 'D5'], B: ['B3', 'D#4', 'F#4', 'B4'], Am: ['A3', 'C4', 'E4', 'A4'] };
  const BASSPAT = 'RROROROR' + 'RROROROO';
  let bt = null, btTimer = null, noiseBuf = null;
  function hit(type, t) {
    if (!noiseBuf) { const n = ctx.sampleRate * 0.25; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    if (type === 'k') { voice('sine', 150, t, 0.12, 0.9, 0.002); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.16); return; }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = type === 'h' ? 7000 : 1400;
    const dur = type === 'h' ? 0.04 : 0.13, vol = type === 'h' ? 0.18 : 0.5;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(musicGain); src.start(t); src.stop(t + dur + 0.02);
    if (type === 's') voice('triangle', 190, t, 0.08, 0.35, 0.001);
  }
  function btParse() {
    const notes = [];
    BATTLE.lead.forEach((bar, b) => { const tk = bar.split(/\s+/); tk.forEach((x, i) => { if (x !== '.' && x !== '-') { let len = 1; while (tk[i + len] === '-') len++; notes[b * 16 + i] = { f: nf(x), len }; } }); });
    return notes;
  }
  function btSchedule() {
    if (!ctx || !bt) return;
    const sp = 60 / bt.bpm / 4;
    while (bt.next < ctx.currentTime + 0.2) {
      const i = bt.step % 256, bar = i >> 4, pos = i & 15, ch = BATTLE.chords[bar], t = bt.next;
      const r = BROOT[ch]; voice('triangle', nf(BASSPAT[pos] === 'O' ? r[1] : r[0]), t, sp * 0.9, 0.6, 0.003);
      const d = BATTLE.drums[bar][pos]; if (d !== '.') hit(d, t);
      const n = bt.notes[i]; if (n) { voice('square', n.f, t, sp * n.len * 0.92, 0.11, 0.004); voice('square', n.f * 1.005, t, sp * n.len * 0.92, 0.04, 0.004); }
      const a = BARP[ch]; voice('sawtooth', nf(a[pos % 4]) * (bar >= 8 ? 2 : 1), t, sp * 0.7, 0.025, 0.002);
      bt.next += sp; bt.step++;
    }
  }
  function playBattle(name, bpm) {
    init(); if (!ctx) return;
    if (bt && bt.name === name) return;
    stop();
    bt = { name, bpm, notes: btParse(), step: 0, next: ctx.currentTime + 0.08 };
    if (!btTimer) btTimer = setInterval(btSchedule, 50);
  }

  function stop() { song = null; wz = null; bt = null; if (ext) { ext.pause(); ext = null; } resetGain(); }
  function sfx(name) { if (!ctx) return; const f = SFX[name]; if (f) try { f(); } catch (e) { } }
  function toggleMusic() { musicOn = !musicOn; try { localStorage.setItem('sh_music', musicOn ? '1' : '0'); } catch (e) { } if (musicGain) musicGain.gain.value = musicOn ? 0.22 : 0; if (ext) ext.volume = musicOn && !MUTED ? 0.9 : 0; return musicOn; }

  root.AUDIO = { init, sfx, play, stop, toggleMusic, playWaltz, playEnding, fadeOut, get musicOn() { return musicOn; },
    get ext() { return ext ? { playing: !ext.paused && !ext.ended, ended: ext.ended } : null; } };
})(typeof window !== 'undefined' ? window : globalThis);
