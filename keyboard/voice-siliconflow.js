/*
 * Voice input interface. The keyboard UI only uses this:
 *   voice.start()          start recording (Promise; rejects if the microphone is unavailable)
 *   voice.level()          current volume 0..1, drives the animation
 *   voice.stop(onStage)    stop and recognize -> Promise<text>; onStage("asr") reports progress
 *   voice.cancel()         discard
 *
 * SiliconFlowVoice: browser recording -> 16 kHz mono WAV -> SiliconFlow /audio/transcriptions
 *   -> a small chat model tidies the text (typos, spoken URLs/emails -> written form, punctuation, filler words).
 *   The tidy step is best-effort: on error or after REFINE_TIMEOUT ms the raw transcript is used.
 * In production the APK's native layer records and implements the same interface (or reuses this file in the WebView).
 */
(function (root) {
  const API = "https://api.siliconflow.cn/v1";
  const REFINE_TIMEOUT = 3500;
  const REFINE_PROMPT = `你是输入法的语音转写校对器。用户说了一段话，语音识别给出了文字，你把它改成用户真正想打出来的样子。

规则：
1. 改正同音错别字、识别错的词。
2. 口语念出来的网址、邮箱、代码、英文要还原成书写形式：
   “三w点百度点com” → www.baidu.com；“at” → @；“点” 在网址/邮箱里 → .；“斜杠” → /；逐个念的字母连起来，如 “a i m r p” → aimrp；英文专有名词用正确大小写，如 ai → AI、github → GitHub（网址里保持小写）。
3. 邮箱、网址、用户名、账号里不可能有汉字：紧挨着 @、网址或数字账号的汉字，一律换成不带声调的小写拼音，连写不加空格，并和后面的部分连在一起。
   “李雷2024@gmail.com” → lilei2024@gmail.com；“韩梅梅 2024 at qq点com” → hanmeimei2024@qq.com。
4. 用户在话里给的书写指令要执行，指令词本身不要打出来：“拼音”“汉语拼音”“用拼音” → 把它前面（或后面）说的那几个汉字写成拼音；“大写”“全大写”“小写”同理。
   “王小明汉语拼音2024@gmail.com” → wangxiaoming2024@gmail.com；“用户名是张小明拼音” → 用户名是 zhangxiaoming。
5. 普通句子里的人名、地名保持中文，不要改成拼音，比如“明天下午王小明来开会”不变。
6. 补上合适的中文标点；去掉“嗯、那个、就是说”这类无意义的口头填充和重复。
7. 不要改动原意，不要补充内容，不要回答问题，不要解释。
8. 只输出改好的文字本身，不加引号、不加前缀。`;

  function SiliconFlowVoice(cfg) {
    this.cfg = Object.assign({ key: "", asrModel: "Qwen/Qwen3-ASR-1.7B", refineModel: "Qwen/Qwen3.5-9B" }, cfg || {});
    this.rec = null; this.stream = null; this.chunks = []; this.analyser = null; this.buf = null; this.ctx = null;
  }
  const P = SiliconFlowVoice.prototype;

  P.configure = function (cfg) { Object.assign(this.cfg, cfg); };

  P.start = async function () {
    if (!this.cfg.key) throw new Error("没有设置硅基流动 API Key");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.6;
    this.buf = new Uint8Array(this.analyser.fftSize);
    src.connect(this.analyser);
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.startedAt = Date.now();
    this.sm = null; this.floor = null;
  };

  /*
   * Volume 0..1 for the animation, in dB above the room's noise floor on a FIXED scale, so soft and loud speech
   * look different. Only the noise floor adapts (microphones differ ~10x in gain).
   *   whisper -> ~0.15, normal speech -> ~0.5, loud -> 1
   * Floor = running minimum with slow creep; frames below -85 dB are the mic still warming up (the handheld
   * delivers ~1.2 s of near-digital silence after opening) and are ignored.
   */
  P.level = function () {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.fbuf || (this.fbuf = new Float32Array(this.analyser.fftSize)));
    let sum = 0;
    for (const x of this.fbuf) sum += x * x;
    const db = 20 * Math.log10(Math.sqrt(sum / this.fbuf.length) + 1e-7);
    if (db < -85) return (this.sm = 0);   // mic warm-up silence: ignore
    // floor: drops at once, creeps up ~1 dB/s (so long speech does not lift it much)
    this.floor = this.floor == null ? db : db < this.floor ? db : Math.min(this.floor + 0.02, db);
    const raw = Math.max(0, Math.min(1, (db - this.floor - 6) / 26));
    this.sm = this.sm == null ? raw : this.sm + (raw - this.sm) * (raw > this.sm ? 0.55 : 0.12);
    return this.sm;
  };

  /** n bands 0..1 across the voice range (~100 Hz–4 kHz), relative shape only; multiply by level() for height. */
  P.spectrum = function (n) {
    if (!this.analyser) return new Array(n).fill(0);
    const bins = this.analyser.frequencyBinCount;
    const f = this.freq || (this.freq = new Uint8Array(bins));
    this.analyser.getByteFrequencyData(f);
    const hz = this.ctx.sampleRate / 2 / bins, lo = Math.floor(100 / hz), hi = Math.min(bins, Math.ceil(4000 / hz));
    const out = [];
    let mx = 1;
    for (let i = 0; i < n; i++) {   // log-spaced bands, more resolution in the low (voice) range
      const a = Math.floor(lo * Math.pow(hi / lo, i / n)), b = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (i + 1) / n)));
      let v = 0; for (let j = a; j < b; j++) v = Math.max(v, f[j]);
      out.push(v); mx = Math.max(mx, v);
    }
    return out.map((v) => v / mx);
  };

  P._release = function () {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close();
    this.stream = this.ctx = this.analyser = null;
  };

  P.cancel = function () {
    if (this.rec && this.rec.state !== "inactive") { this.rec.onstop = null; this.rec.stop(); }
    this.rec = null; this._release();
  };

  P.stop = async function (onStage) {
    const rec = this.rec; if (!rec) return "";
    const done = new Promise((r) => (rec.onstop = r));
    rec.stop(); await done; this.rec = null;
    const secs = (Date.now() - this.startedAt) / 1000;
    this._release();
    if (secs < 0.4) return "";
    const wav = await toWav16k(new Blob(this.chunks, { type: rec.mimeType }));
    onStage && onStage("asr");
    const raw = await this.transcribe(wav);
    if (!raw || !this.cfg.refineModel) return raw;
    onStage && onStage("refine");
    return fixAccounts(await this.refine(raw));
  };

  /*
   * 邮箱/@ 账号里不会有汉字：把紧挨在前面的中文名字换成拼音（苏航2024@gmail.com -> suhang2024@gmail.com）。
   * 用代码做而不靠模型：小模型只会照抄提示词里的例子。拼音来自输入法自带的词库（window.PINYIN_DICT），
   * 每个字取最常用的读音；往前最多取 4 个字，遇到“是/的/给/邮箱”这类字就停，前面的话保持中文。
   */
  const STOP = new Set("是为的给到发向和与跟及在用号址箱码名邮帐账件写成叫我你他她它：:，,。、 ");
  let charPy = null;
  function pinyinOf(ch) {
    if (!charPy) {
      charPy = {};
      const w = (root.PINYIN_DICT && root.PINYIN_DICT.words) || {};
      const best = {};
      for (const key in w) {
        if (key.indexOf(" ") >= 0) continue;   // 只看单音节
        for (const item of w[key].split(" ")) {
          const i = item.lastIndexOf(":"), word = item.slice(0, i);
          if ([...word].length !== 1) continue;
          const f = parseInt(item.slice(i + 1), 36) || 0;
          if (!(word in best) || f > best[word]) { best[word] = f; charPy[word] = key; }
        }
      }
    }
    return charPy[ch];
  }
  // 多音字姓氏：名字第一个字按姓氏读
  const SURNAME = { "曾": "zeng", "单": "shan", "解": "xie", "仇": "qiu", "区": "ou", "查": "zha", "朴": "piao", "盖": "ge",
    "乐": "yue", "覃": "qin", "尉": "yu", "缪": "miao", "翟": "zhai", "召": "shao", "繁": "po", "种": "chong", "员": "yun", "长": "chang", "重": "chong", "折": "she" };
  function fixAccounts(text) {
    text = text.replace(/(?:用)?(?:汉语)?拼音[，,]?\s*(?=[A-Za-z0-9._+-]*@)/g, "");   // 口头指令“汉语拼音”本身不打出来
    return text.replace(/([一-鿿]+)\s*([A-Za-z0-9._+-]*@[A-Za-z0-9._-]+)/g, (m, han, rest) => {
      const cs = [...han]; let k = cs.length;
      while (k > 0 && cs.length - k < 4 && !STOP.has(cs[k - 1])) k--;
      const name = cs.slice(k), py = name.map((c, i) => (i === 0 && name.length > 1 && SURNAME[c]) || pinyinOf(c));
      if (!name.length || py.some((x) => !x)) return m;
      const head = cs.slice(0, k).join("");
      return head + (head ? " " : "") + py.join("") + rest;
    });
  }
  SiliconFlowVoice.fixAccounts = fixAccounts;

  /** Tidy the transcript with a small model; never fails — returns the raw text on any problem. */
  P.refine = async function (raw) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), REFINE_TIMEOUT);
    try {
      const body = { model: this.cfg.refineModel, temperature: 0, max_tokens: Math.min(1024, raw.length * 3 + 64), enable_thinking: false,
        messages: [{ role: "system", content: REFINE_PROMPT }, { role: "user", content: raw }] };
      const r = await fetch(API + "/chat/completions", { method: "POST", signal: ctl.signal,
        headers: { Authorization: "Bearer " + this.cfg.key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) return raw;
      const d = await r.json();
      let out = ((d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "").trim();
      out = out.replace(/^["“'「]+|["”'」]+$/g, "").trim();
      // guard against the model answering/rambling instead of correcting
      if (!out || out.length > raw.length * 2 + 20) return raw;
      return out;
    } catch (e) { return raw; }
    finally { clearTimeout(timer); }
  };

  P.transcribe = async function (wavBlob) {
    const fd = new FormData();
    fd.append("model", this.cfg.asrModel);
    fd.append("file", wavBlob, "voice.wav");
    const r = await fetch(API + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + this.cfg.key }, body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("识别失败：" + (d.message || r.status));
    return (d.text || "").trim();
  };

  // Recording (webm/opus) -> 16 kHz mono 16-bit WAV, which every ASR model accepts and is small
  async function toWav16k(blob) {
    const ab = await blob.arrayBuffer();
    const tmp = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await tmp.decodeAudioData(ab); tmp.close();
    const rate = 16000, len = Math.ceil(decoded.duration * rate);
    const off = new OfflineAudioContext(1, len, rate);
    const s = off.createBufferSource(); s.buffer = decoded; s.connect(off.destination); s.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    // Automatic gain is off (so the animation follows real loudness); normalise the recording here instead,
    // up to 20x, so quiet microphones still reach the recogniser at a healthy level.
    let peak = 0; for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
    const gain = peak > 0 ? Math.min(20, 0.9 / peak) : 1;
    if (gain > 1) for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const w = (o, str) => [...str].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); out.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, rate, true);
    out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    return new Blob([out], { type: "audio/wav" });
  }

  root.SiliconFlowVoice = SiliconFlowVoice;
})(window);
