/*
 * Pinyin engine. The keyboard UI only uses this:
 *
 *   engine.query(raw)          raw = the letters typed so far (may contain ' separators)
 *     -> { preedit: "ni hao", candidates: [{ text, consume, key, user? , raw? }] }
 *        consume = how many raw chars choosing this candidate uses up; key = the pinyin letters it covers
 *   engine.learn(key, word)    the user chose this word for this pinyin (adjusts frequency / creates a new word)
 *   engine.forget(key, word)   drop the learned record (long-press a candidate)
 *   engine.clearUser()         wipe all learned records
 *   engine.userStats()         { words: n }
 *
 * Base dictionary: keyboard/dict.js (generated from rime-ice by tools/gen_dict.py).
 * User dictionary: given by store = { load() -> obj|null, save(obj) }. The simulator uses localStorage,
 * the APK saves it to a file in the app's private directory.
 */
(function (root) {
  const SAVE_DELAY = 1500;

  function PinyinEngine(dict, store) {
    this.dict = dict.words;
    this.keys = Object.keys(dict.words).sort();
    this.syl = new Set(dict.syllables);
    this.pre = new Set();
    for (const s of dict.syllables) for (let i = 1; i <= s.length; i++) this.pre.add(s.slice(0, i));
    this.cache = new Map();
    this.store = store || null;
    let u = null;
    try { u = this.store && this.store.load(); } catch (e) { u = null; }
    this.user = u && u.v === 1 && u.e ? u : { v: 1, e: {} };   // e: { key: { word: [count, lastUsedMs] } }
  }
  const P = PinyinEngine.prototype;

  P.words = function (key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const v = this.dict[key];
    const list = v ? v.split(" ").map((x) => { const i = x.lastIndexOf(":"); return { w: x.slice(0, i), f: parseInt(x.slice(i + 1), 36) }; }) : [];
    this.cache.set(key, list);
    return list;
  };

  // learned words for a key (or all keys starting with a prefix), most used and most recent first
  P.userWords = function (key, len, prefix) {
    const out = [];
    const take = (k) => { for (const [w, [c, t]] of Object.entries(this.user.e[k])) if (w.length === len) out.push({ w, c, t, k }); };
    if (prefix) { for (const k in this.user.e) if (k.startsWith(key)) take(k); }
    else if (this.user.e[key]) take(key);
    return out.sort((a, b) => b.c - a.c || b.t - a.t);
  };

  // Split into syllables: fewest syllables wins; the last one may be incomplete ("zh").
  P.segment = function (raw) {
    const segs = [];
    let offset = 0;
    for (const part of raw.split("'")) {
      const n = part.length, best = new Array(n + 1).fill(null);
      best[0] = [];
      for (let i = 0; i < n; i++) {
        if (!best[i]) continue;
        for (let j = i + 1; j <= Math.min(n, i + 6); j++) {
          const t = part.slice(i, j);
          const ok = this.syl.has(t), partial = !ok && j === n && this.pre.has(t);
          if (!ok && !partial) continue;
          const cand = best[i].concat([{ t, partial }]);
          const cur = best[j];
          if (!cur || cand.length < cur.length || (cand.length === cur.length && !partial && cur[cur.length - 1].partial)) best[j] = cand;
        }
      }
      let got = best[n];
      if (!got) {   // can't be split: keep the longest valid prefix, the rest is raw letters
        let i = n; while (i > 0 && !best[i]) i--;
        got = best[i].concat(i < n ? [{ t: part.slice(i), partial: true, bad: true }] : []);
      }
      for (const s of got) { s.start = offset; offset += s.t.length; s.end = offset; segs.push(s); }
      offset += 1;   // the ' separator
    }
    return segs.filter((s) => s.t);
  };

  P.prefixWords = function (prefix, len) {
    let lo = 0, hi = this.keys.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.keys[m] < prefix) lo = m + 1; else hi = m; }
    const out = [];
    for (let i = lo; i < this.keys.length && this.keys[i].startsWith(prefix) && out.length < 600; i++)
      for (const x of this.words(this.keys[i])) if (x.w.length === len) out.push(x);
    return out.sort((a, b) => b.f - a.f);
  };

  // best single word for exactly k syllables starting at segment i: learned words first
  P._bestWord = function (segs, i, k) {
    const key = segs.slice(i, i + k).map((s) => s.t).join("");
    const u = this.userWords(key, k)[0];
    if (u) return u.w;
    const w = this.words(key).find((x) => x.w.length === k);
    return w ? w.w : null;
  };

  P.query = function (raw) {
    raw = raw.toLowerCase();
    const segs = this.segment(raw), n = segs.length, cands = [], seen = new Set();
    const keyOf = (k) => segs.slice(0, k).map((s) => s.t).join("");
    const push = (text, k, user) => {
      if (seen.has(text)) return false;
      seen.add(text); cands.push({ text, consume: segs[k - 1].end, key: keyOf(k), user: !!user }); return true;
    };
    const full = n && !segs.some((s) => s.partial);
    // 1) learned words that cover the whole input (including phrases built earlier)
    if (full) for (const u of this.userWords(keyOf(n), n)) push(u.w, n, true);
    // 2) whole sentence: greedy longest word from left to right
    if (full && n >= 3) {
      let i = 0, text = "", parts = 0;
      while (i < n) {
        let hit = null;
        for (let k = Math.min(n - i, 6); k >= 1 && !hit; k--) { const w = this._bestWord(segs, i, k); if (w) hit = { w, k }; }
        if (!hit) { text = ""; break; }
        text += hit.w; i += hit.k; parts++;
      }
      if (text && parts > 1) push(text, n);
    }
    // 3) words from longest to shortest coverage; learned ones first inside each group
    for (let k = n; k >= 1; k--) {
      if (segs[k - 1].bad) continue;
      const key = keyOf(k), partial = k === n && segs[n - 1].partial;
      for (const u of this.userWords(key, k, partial)) push(u.w, k, true);
      const list = partial ? this.prefixWords(key, k) : this.words(key).filter((x) => x.w.length === k);
      let taken = 0;
      for (const x of list) if (push(x.w, k) && ++taken >= (k === n ? 60 : 30)) break;
    }
    cands.push({ text: raw.replace(/'/g, ""), consume: raw.length, raw: true });   // last option: the letters themselves
    return { preedit: segs.map((s) => s.t).join(" "), candidates: cands };
  };

  // ---------- learning ----------
  P.learn = function (key, word) {
    if (!key || !word || !/^[a-z]+$/.test(key) || word.length > 12) return;
    const e = (this.user.e[key] = this.user.e[key] || {});
    const cur = e[word] || [0, 0];
    e[word] = [cur[0] + 1, Date.now()];
    this._saveSoon();
  };
  P.forget = function (key, word) {
    const e = this.user.e[key];
    if (!e || !e[word]) return false;
    delete e[word];
    if (!Object.keys(e).length) delete this.user.e[key];
    this._saveSoon();
    return true;
  };
  P.clearUser = function () { this.user = { v: 1, e: {} }; this._saveSoon(0); };
  P.userStats = function () { let n = 0; for (const k in this.user.e) n += Object.keys(this.user.e[k]).length; return { words: n }; };
  P.exportUser = function () { return JSON.stringify(this.user); };
  P._saveSoon = function (delay) {
    if (!this.store) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => { try { this.store.save(this.user); } catch (e) { } }, delay == null ? SAVE_DELAY : delay);
  };

  root.PinyinEngine = PinyinEngine;
  if (typeof module !== "undefined") module.exports = PinyinEngine;
})(typeof window !== "undefined" ? window : globalThis);
