// 连着跑多条 JS（每条之间等一小段时间），用来在真机上模拟剧情流程
// 用法：node stophero/tools/cdpseq.js top 'expr1' 'expr2' ...
// 每个 expr 前可加 "sleep:1200|" 前缀，表示先等 1200 毫秒再执行
const [, , which = 'top', ...exprs] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function evalJS(expr) {
  const list = await (await fetch('http://127.0.0.1:9333/json')).json();
  const tg = list.find(t => t.url.includes(which + '.html'));
  if (!tg) { console.log('没找到页面', list.map(t => t.url)); process.exit(1); }
  const ws = new WebSocket(tg.webSocketDebuggerUrl);
  return new Promise((res) => {
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id === 1) {
        const r = m.result;
        if (r.exceptionDetails) res('EXCEPTION: ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
        else res(r.result ? r.result.value : JSON.stringify(r.result));
        ws.close();
      }
    };
    ws.onerror = e => { res('WS ERROR'); ws.close(); };
  });
}

(async () => {
  for (const raw of exprs) {
    let e = raw, wait = 0;
    const m = /^sleep:(\d+)\|(.*)$/s.exec(raw);
    if (m) { wait = +m[1]; e = m[2]; }
    if (wait) await sleep(wait);
    const out = await evalJS(e);
    console.log('» ' + e.slice(0, 70).replace(/\n/g, ' ') + '\n  ← ' + out);
  }
  await sleep(150);
  process.exit(0);
})();
