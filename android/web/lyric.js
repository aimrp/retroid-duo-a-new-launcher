// 歌词：解析 LRC、按播放进度找当前行。上屏播放页和下屏液晶屏共用。
// 进度在 JS 里按"上次快照 + 经过时间"外推，不用每帧问 Java。
(function () {
  /** "[01:02.34][01:30.00]歌词" -> [{t:62340, text:"歌词"}, ...]，按时间排序，去掉空行和制作信息。 */
  function parse(lrc) {
    const out = [];
    let offset = 0;
    for (const raw of String(lrc || "").split(/\r?\n/)) {
      const m = raw.match(/^\s*\[offset:\s*([+-]?\d+)\]/i);
      if (m) { offset = +m[1]; continue; }
      const times = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
      if (!times.length) continue;
      const text = raw.replace(/\[[^\]]*\]/g, "").trim();
      for (const t of times) {
        const frac = t[3] ? +(t[3] + "00").slice(0, 3) : 0;
        out.push({ t: (+t[1]) * 60000 + (+t[2]) * 1000 + frac, text });
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out.map((l) => ({ t: Math.max(0, l.t - offset), text: l.text }));
  }

  /** 当前行下标（没开始 = -1）。 */
  function index(lines, ms) {
    let lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].t <= ms) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }

  /** 播放进度外推器：feed(快照) 后 now() 给出当前毫秒。 */
  function clock() {
    let pos = 0, at = 0, playing = false, dur = 0;
    return {
      feed(s) { pos = s.position || 0; at = Date.now(); playing = !!s.playing; dur = s.duration || 0; },
      set(ms) { pos = ms; at = Date.now(); },
      now() { const p = pos + (playing ? Date.now() - at : 0); return dur ? Math.min(p, dur) : p; },
      get playing() { return playing; }, set playing(v) { pos = this.now(); at = Date.now(); playing = v; },
    };
  }

  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  window.Lyric = { parse, index, clock, mmss };
})();
