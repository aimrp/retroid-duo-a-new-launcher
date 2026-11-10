/*
 * DuoKeyboard: bottom-screen keyboard UI (640x480). The same code runs in the simulator and in the production WebView.
 *
 *   new DuoKeyboard(rootEl, { engine, host })
 *   engine.query(raw) -> { preedit, candidates:[{text, consume, raw?}] }   see engine.js
 *   host.commit(text)          send text to the app on the top screen
 *   host.backspace()           delete one char in the top-screen app
 *   host.enter()               enter / search / send
 *   host.composing(preedit, candidates)   optional: mirror the composition on the top-screen strip
 */
(function (root) {
  const ZH_PUNCT = { ",": "，", ".": "。", "?": "？", "!": "！", ";": "；", ":": "：", "(": "（", ")": "）", "\\": "、",
    "<": "《", ">": "》", "[": "【", "]": "】", "^": "……", "_": "——", "$": "￥", "~": "～" };
  const SYM = {
    zh: ["，", "。", "？", "！", "、", "；", "：", "……", "“", "”", "‘", "’", "（", "）", "《", "》", "【", "】", "——", "·", "～", "￥", "％", "＋", "－", "×", "÷", "＝", "＠", "＃", "＆", "＊"],
    en: [",", ".", "?", "!", "'", "\"", ";", ":", "(", ")", "[", "]", "{", "}", "<", ">", "@", "#", "$", "%", "&", "*", "+", "-", "=", "/", "\\", "_", "~", "`", "^", "|"],
  };
  const ROWS = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3.5"/></svg>';

  function DuoKeyboard(el, opts) {
    this.el = el; this.engine = opts.engine; this.host = opts.host; this.voice = opts.voice || null;
    this.vstate = null;   // null | "listen" | "asr"
    this.mode = "zh"; this.shift = 0; this.panel = "keys"; this.symTab = "zh";
    this.raw = ""; this.chosen = ""; this.q = null; this.enterLabel = "换行"; this.sess = [];
    this.quote = { "\"": false, "'": false };
    el.classList.add("dk");
    el.innerHTML = '<div class="dk-cbar"></div><div class="dk-body"></div><div class="dk-energy"></div><div class="dk-toast"></div>';
    this.cbar = el.children[0]; this.body = el.children[1]; this.energy = el.children[2]; this.toastEl = el.children[3];
    this.countKey = "dk-count-" + new Date().toISOString().slice(0, 10);
    try { this.count = +localStorage.getItem(this.countKey) || 0; } catch (e) { this.count = 0; }
    this._bindPointer();
    this.render();
  }
  const P = DuoKeyboard.prototype;

  // ---------- input logic ----------
  P.commit = function (t) {
    if (!t) return;
    this.host.commit(t);
    this.count += [...t].filter((c) => /\S/.test(c)).length;
    try { localStorage.setItem(this.countKey, this.count); } catch (e) { }
    this._flare = true;
  };
  P.neo = function () { return this.el.dataset.theme === "neo"; };
  P.toast = function (m) {
    const t = this.toastEl; t.textContent = m; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1800);
  };
  // 选中的候选往上飞，像是被"送"到上屏
  P.fly = function (i) {
    if (!this.neo()) return;
    const src = this.cbar.querySelector(`[data-k="cand:${i}"]`) || this.body.querySelector(`[data-k="cand:${i}"]`);
    if (!src) return;
    const r = src.getBoundingClientRect(), base = this.el.getBoundingClientRect(), z = (r.width / src.offsetWidth) || 1;
    const f = document.createElement("div");
    f.className = "dk-fly"; f.textContent = src.textContent;
    f.style.left = (r.left - base.left) / z + 12 + "px"; f.style.top = (r.top - base.top) / z + 4 + "px";
    this.el.appendChild(f); setTimeout(() => f.remove(), 600);
  };
  // ---------- voice ----------
  P.voiceStart = async function (mode) {
    if (!this.voice || this.vstate) return;
    if (this.raw) { this.flushRaw(); this.refresh(); }
    this.vmode = mode; this.vstate = "listen"; this.panel = "voice"; this.render();
    try { await this.voice.start(); }
    catch (e) { this.vstate = null; this.panel = "keys"; this.render(); return this.toast("麦克风打不开：" + (e.message || e.name)); }
    if (this.vstate !== "listen") { this.voice.cancel(); return; }   // cancelled while the mic was opening
    this.vt0 = Date.now();
    const loop = () => {
      if (this.vstate !== "listen" || this.panel !== "voice") return;
      const lv = this.voice.level();
      const orb = this.body.querySelector(".dk-vorb"); if (orb) orb.style.transform = `scale(${0.92 + lv * 0.6})`;
      // symmetric spectrum: height = volume × that band's share; centre bars carry the low (voice) bands
      const bars = this.body.querySelectorAll(".dk-vbars i"), half = bars.length / 2;
      const spec = this.voice.spectrum ? this.voice.spectrum(half) : new Array(half).fill(1);
      bars.forEach((b, i) => {
        const band = i < half ? half - 1 - i : i - half;
        b.style.transform = `scaleY(${0.06 + lv * (0.25 + 0.75 * spec[band]) * 0.94})`;
      });
      const t = this.body.querySelector(".dk-vtime"); if (t) { const s = Math.floor((Date.now() - this.vt0) / 1000); t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
      this._vraf = requestAnimationFrame(loop);
    };
    loop();
  };
  P.voiceCancel = function () {
    cancelAnimationFrame(this._vraf);
    if (this.voice) this.voice.cancel();
    this.vstate = null; this.panel = "keys"; this.render();
  };
  P.voiceStop = async function () {
    if (this.vstate !== "listen") return;
    cancelAnimationFrame(this._vraf);
    this.vstate = "asr"; this.render();
    let text = "";
    try {
      text = await this.voice.stop((stage) => { if (this.vstate) { this.vstate = stage; this.render(); } });
    } catch (e) { this.toast(e.message || "识别失败"); }
    if (!this.vstate) return;   // cancelled meanwhile
    this.vstate = null; this.panel = "keys";
    if (text) { this.commit(text); this.flyText(text); } else this.toast("没听清，再说一次");
    this.render();
  };
  P.flyText = function (text) {
    if (!this.neo()) return;
    const f = document.createElement("div");
    f.className = "dk-fly"; f.textContent = text.length > 16 ? text.slice(0, 16) + "…" : text;
    f.style.left = "50%"; f.style.top = "200px"; f.style.marginLeft = -Math.min(text.length, 17) * 12 + "px";
    this.el.appendChild(f); setTimeout(() => f.remove(), 600);
  };

  P.pulse = function () { const e = this.energy; e.classList.remove("go"); void e.offsetWidth; e.classList.add("go"); };
  P.refresh = function () {
    this.q = this.raw ? this.engine.query(this.raw) : null;
    if (!this.raw && this.panel === "cands") this.panel = "keys";
    this.host.composing && this.host.composing(this.q ? this.chosen + (this.chosen ? " " : "") + this.q.preedit : "", this.q ? this.q.candidates : []);
    this.render();
  };
  // picked in several steps (我们 + 一起): remember the whole thing as one word
  P.learnPhrase = function () {
    const s = this.sess; this.sess = [];
    if (s.length >= 2 && this.engine.learn) {
      const text = s.map((c) => c.text).join("");
      if (text.length <= 12) this.engine.learn(s.map((c) => c.key).join(""), text);
    }
  };
  P.flushRaw = function () { this.sess = []; this.commit(this.chosen + this.raw.replace(/'/g, "")); this.chosen = ""; this.raw = ""; };
  P.choose = function (i) {
    const c = this.q && this.q.candidates[i]; if (!c) return;
    this.fly(i);
    if (!c.raw && this.engine.learn) { this.engine.learn(c.key, c.text); this.sess.push(c); }
    this.chosen += c.text;
    this.raw = this.raw.slice(c.consume).replace(/^'+/, "");
    if (!this.raw) { this.learnPhrase(); this.commit(this.chosen); this.chosen = ""; }
    this.panel = "keys";
    this.refresh();
  };
  P.letter = function (ch) {
    const upper = this.shift > 0;
    if (this.mode === "en" || (upper && !this.raw)) {
      this.commit(upper ? ch.toUpperCase() : ch);
    } else {
      this.raw += ch;
    }
    if (this.shift === 1) this.shift = 0;
    this.refresh();
  };
  P.punct = function (p) {
    if (this.raw) this.choose(0);
    if (this.mode === "zh") {
      if (p === "\"") { this.quote[p] = !this.quote[p]; p = this.quote[p] ? "“" : "”"; }
      else if (p === "'") { this.quote[p] = !this.quote[p]; p = this.quote[p] ? "‘" : "’"; }
      else p = ZH_PUNCT[p] || p;
    }
    this.commit(p);
    this.render();
  };
  P.press = function (k) {
    this.pulse();
    if (k.length === 1 && /[a-z]/.test(k)) return this.letter(k);
    if (k.length === 1 && /[0-9]/.test(k)) { if (this.raw) this.choose(0); this.commit(k); return this.render(); }
    switch (k) {
      case "bksp":
        if (this.raw) { this.raw = this.raw.slice(0, -1); if (!this.raw) { this.sess = []; if (this.chosen) { this.commit(this.chosen); this.chosen = ""; } } this.refresh(); }
        else this.host.backspace();
        return;
      case "space": if (this.mode === "zh" && this.raw) return this.choose(0); this.commit(" "); return;
      case "enter": if (this.raw) { this.flushRaw(); return this.refresh(); } this.host.enter(); return;
      case "shift": this.shift = this.shift === 0 ? 1 : this.shift === 1 && Date.now() - this._shiftAt < 350 ? 2 : 0; this._shiftAt = Date.now(); return this.render();
      case "lang": if (this.raw) this.flushRaw(); this.mode = this.mode === "zh" ? "en" : "zh"; this.shift = 0; this.symTab = this.mode; return this.refresh();
      case "sym": this.panel = "sym"; return this.render();
      case "abc": this.panel = "keys"; return this.render();
      case "more": this.panel = this.panel === "cands" ? "keys" : "cands"; return this.render();
      case "tab-zh": this.symTab = "zh"; return this.render();
      case "tab-en": this.symTab = "en"; return this.render();
      case "voice": return this.voiceStart("tap");
      case "v-done": return this.voiceStop();
      case "v-cancel": return this.voiceCancel();
      case "sep": if (this.raw && !this.raw.endsWith("'")) { this.raw += "'"; this.refresh(); } return;
    }
    if (k.startsWith("cand:")) return this.choose(+k.slice(5));
    if (k.startsWith("sym:")) { if (this.raw) this.choose(0); this.commit(k.slice(4)); return this.render(); }
    if (k.startsWith("p:")) return this.punct(k.slice(2));
  };

  /** Physical keyboard (simulator / external keyboard). Returns true if handled. */
  P.handleKeyEvent = function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return false;
    const k = e.key;
    if (k === "Shift") { this._shiftAlone = true; return true; }   // switch language when Shift is released alone, see handleKeyUp
    this._shiftAlone = false;
    if (/^[a-zA-Z]$/.test(k)) { if (e.shiftKey && this.shift === 0) this.shift = 1; this.press(k.toLowerCase()); return true; }
    if (/^[1-9]$/.test(k) && this.raw) { this.choose(+k - 1); return true; }
    if (/^[0-9]$/.test(k)) { this.press(k); return true; }
    if (k === "Backspace") { this.press("bksp"); return true; }
    if (k === " ") { this.press("space"); return true; }
    if (k === "Enter") { this.press("enter"); return true; }
    if (k === "'" && this.raw) { this.press("sep"); return true; }
    if (k === "-" && this.raw) return true;
    if (k.length === 1 && /[^\w\s]/.test(k)) { this.punct(k); return true; }
    return false;
  };

  P.handleKeyUp = function (e) {
    if (e.key === "Shift" && this._shiftAlone) { this._shiftAlone = false; this.press("lang"); return true; }
    return false;
  };

  /** The app on the top screen lost focus: drop any half-typed input and stop recording. */
  P.reset = function () {
    if (this.vstate) this.voiceCancel();
    this.raw = ""; this.chosen = ""; this.sess = []; this.shift = 0; this.panel = "keys";
    this.refresh();
  };

  P.setTheme = function (t) { this.el.dataset.theme = t; };
  P.setSize = function (s) { this.el.dataset.size = s; };
  P.setEnterLabel = function (l) { this.enterLabel = l; this.render(); };

  // ---------- render ----------
  const key = (k, label, cls, flex, sub) =>
    `<div class="dk-key ${cls || ""}" data-k="${k}" style="flex:${flex || 1}">${label}${sub ? `<small>${sub}</small>` : ""}</div>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  P.render = function () {
    const zh = this.mode === "zh", q = this.q;
    // candidate bar
    if (q) {
      this.cbar.innerHTML = `<div class="dk-pre">${esc(this.chosen)}${esc(q.preedit)}</div><div class="dk-cands">` +
        q.candidates.slice(0, 12).map((c, i) => `<div class="dk-cand ${c.raw ? "raw" : ""}" data-k="cand:${i}">${esc(c.text)}</div>`).join("") +
        `</div>${this.voice ? (this.vstate ? `<div class="dk-vmini off">${MIC}</div>` : `<div class="dk-vmini" data-k="voice">${MIC}</div>`) : ""}<div class="dk-more" data-k="more">${this.panel === "cands" ? "▲" : "▼"}</div>`;
    } else {
      const st = (zh ? "拼音" : "English") + (this.shift ? ` · ${this.shift === 2 ? "大写锁定" : "大写"}` : "");
      this.cbar.innerHTML = `<div class="dk-idle"><div class="dk-orb ${this._flare ? "flare" : ""}"></div>` +
        `<div class="dk-st"><b>${zh ? "中文" : "English"}</b><span>${st}</span></div>` +
        `<div class="dk-count">今日 <b>${this.count.toLocaleString()}</b> 字</div><div class="dk-gap"></div>` +
        (this.voice ? (this.vstate
          // 语音进行中：顶上的按钮置灰、不可点，结束只能用下面的“完成”/“取消”
          ? `<div class="dk-vbtn off">${MIC}<span>${this.vstate === "listen" ? "正在听" : "识别中"}</span><small>点下方“完成”</small></div>`
          : `<div class="dk-vbtn" data-k="voice">${MIC}<span>语音输入</span><small>或按住空格</small></div>`) : "") + `</div>`;
    }
    this._flare = false;
    // body
    let h = "";
    if (this.panel === "voice") {
      const st = this.vstate, listen = st === "listen";
      h = `<div class="dk-voice ${listen ? "listen" : "busy"}"><div class="dk-vstage"><i class="dk-vring"></i><i class="dk-vring r2"></i><div class="dk-vorb"></div></div>` +
        `<div class="dk-vbars">${"<i></i>".repeat(32)}</div>` +
        `<div class="dk-vstate">${listen ? "正在听…" : this.vstate === "refine" ? "整理中…" : "识别中…"} <span class="dk-vtime"></span></div>` +
        `<div class="dk-vhint">${listen ? (this.vmode === "hold" ? "松开空格发送 · 滑出取消" : "说完点“完成”，文字会送到上屏") : this.vstate === "refine" ? "改错字、网址和标点" : "云端识别 · 硅基流动"}</div>` +
        `<div class="dk-vbar">${key("v-cancel", "取消", "fn", 1)}${listen ? key("v-done", "完成 ✓", "enter", 1.6) : ""}</div></div>`;
    } else if (this.panel === "cands" && q) {
      h = `<div class="dk-grid"><div class="dk-gwrap">` + q.candidates.map((c, i) => `<div class="dk-gcand" data-k="cand:${i}">${esc(c.text)}</div>`).join("") +
        `</div><div class="dk-gbar">${key("more", "返回键盘", "fn", 2)}${key("bksp", "⌫", "fn", 1)}</div></div>`;
    } else if (this.panel === "sym") {
      h = `<div class="dk-sym"><div class="dk-tabs">${key("tab-zh", "中文", this.symTab === "zh" ? "fn sel" : "fn")}${key("tab-en", "英文", this.symTab === "en" ? "fn sel" : "fn")}${key("bksp", "⌫", "fn")}${key("abc", "返回", "fn")}</div>` +
        `<div class="dk-sgrid">${SYM[this.symTab].map((s) => key("sym:" + esc(s), esc(s), "")).join("")}</div></div>`;
    } else {
      const up = this.shift > 0;
      const L = (r) => [...r].map((c) => key(c, up ? c.toUpperCase() : c)).join("");
      h = `<div class="dk-row">${[...ROWS[0]].map((c) => key(c, c, "num")).join("")}</div>` +
        `<div class="dk-row">${L(ROWS[1])}</div>` +
        `<div class="dk-row"><div class="dk-sp"></div>${L(ROWS[2])}<div class="dk-sp"></div></div>` +
        `<div class="dk-row">${key("shift", "⇧", "fn " + (this.shift === 2 ? "lock" : this.shift ? "on" : ""), 1.5)}${L(ROWS[3])}${key("bksp", "⌫", "fn", 1.5)}</div>` +
        `<div class="dk-row">${key("sym", "符号", "fn", 1.3)}${key("p:,", zh ? "，" : ",", "fn punct", 1)}${key("lang", zh ? "中" : "En", "fn lang", 1.1, zh ? "切英文" : "切中文")}` +
        `${key("space", zh ? "空格" : "space", "", 3.6)}${key("p:.", zh ? "。" : ".", "fn punct", 1)}${key("enter", esc(this.enterLabel), "enter", 1.8)}</div>`;
    }
    this.body.innerHTML = h;
  };

  // ---------- touch: act on release; holding ⌫ repeats ----------
  P._bindPointer = function () {
    let down = null, timer = null;
    const clear = () => { if (down) down.classList.remove("down"); down = null; clearTimeout(timer); clearInterval(timer); timer = null; };
    this.el.addEventListener("pointerdown", (e) => {
      const t = e.target.closest("[data-k]"); if (!t) return;
      e.preventDefault(); clear(); down = t; t.classList.add("down");
      if (this.neo() && t.classList.contains("dk-key")) {   // 涟漪，从手指落点散开
        const r = t.getBoundingClientRect(), z = (r.width / t.offsetWidth) || 1, rp = document.createElement("span");
        rp.className = "dk-ripple"; rp.style.left = (e.clientX - r.left) / z + "px"; rp.style.top = (e.clientY - r.top) / z + "px";
        t.appendChild(rp); setTimeout(() => rp.remove(), 420);
      }
      if (t.dataset.k.startsWith("cand:")) {   // long-press a candidate: forget what was learned about it
        timer = setTimeout(() => {
          if (down !== t) return;
          t._rep = true;
          const c = this.q && this.q.candidates[+t.dataset.k.slice(5)];
          if (!c || c.raw) return;
          if (this.engine.forget && this.engine.forget(c.key, c.text)) { this.toast(`已忘掉「${c.text}」`); this.refresh(); }
          else this.toast(`「${c.text}」是词库自带的词`);
        }, 600);
      }
      if (t.dataset.k === "space" && this.voice && !this.raw) {
        timer = setTimeout(() => { if (down === t) { t._rep = true; t._hold = true; this.voiceStart("hold"); } }, 380);
      }
      if (t.dataset.k === "bksp") {
        timer = setTimeout(() => { timer = setInterval(() => this.press("bksp"), 60); down && (down._rep = true); }, 400);
      }
    });
    this.el.addEventListener("pointerup", (e) => {
      const t = down, rep = t && t._rep; if (t) t._rep = false;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      if (t && t._hold) { t._hold = false; clear(); return over && this.el.contains(over) ? this.voiceStop() : this.voiceCancel(); }
      clear();
      if (t && !rep && over && over.closest("[data-k]") === t) this.press(t.dataset.k);
    });
    const abort = () => { const held = down && down._hold; if (down) down._hold = false; clear(); if (held) this.voiceCancel(); };   // finger slid off while holding space: cancel
    this.el.addEventListener("pointercancel", abort);
    this.el.addEventListener("pointerleave", abort);
  };

  root.DuoKeyboard = DuoKeyboard;
})(window);
