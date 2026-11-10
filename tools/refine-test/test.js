// 语音识别结果 -> 小模型整理：比较几个模型的效果和耗时
// Key：环境变量 SILICONFLOW_KEY，或仓库根目录 config.local.json 的 api_key
const KEY = process.env.SILICONFLOW_KEY || JSON.parse(require("fs").readFileSync(__dirname + "/../../config.local.json", "utf8")).api_key;
const PROMPT = require("fs").readFileSync(__dirname + "/../../keyboard/voice-siliconflow.js", "utf8").match(/REFINE_PROMPT = `([^`]+)`/)[1];
const CASES = process.env.CASES ? require(process.env.CASES) : [
  "王小明2024@gmail.com",
  "王小明 2024@gmail.com",
  "我的邮箱是王小明2024@gmail.com",
  "王小明汉语拼音2024@gmail.com",
  "王小明汉语拼音2024 at gmail点com",
  "用户名是张小明拼音",
  "打开三w点百度点com",
  "github点com斜杠a i m r p",
  // 反例：普通句子里的人名必须保持中文
  "明天下午王小明来开会",
  "把这个文件发给王小明然后抄送李四",
  "嗯那个就是说我想问一下这个这个功能怎么用",
];
const MODELS = process.argv.slice(2);
(async () => {
  for (const m of MODELS) {
    console.log("== " + m);
    let tot = 0;
    for (const c of CASES) {
      const t0 = Date.now();
      const body = { model: m, temperature: 0, max_tokens: 200, messages: [{ role: "system", content: PROMPT }, { role: "user", content: c }] };
      if (/Qwen3/.test(m)) body.enable_thinking = false;
      const r = await fetch("https://api.siliconflow.cn/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); const ms = Date.now() - t0; tot += ms;
      console.log(`  ${String(ms).padStart(5)}ms  ${c}  =>  ${d.choices ? d.choices[0].message.content.trim() : JSON.stringify(d).slice(0, 120)}`);
    }
    console.log("  平均 " + Math.round(tot / CASES.length) + "ms");
  }
})();
