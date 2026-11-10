// 连到掌机上游戏 WebView 执行一段 JS（调试用）
// 先：adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>
// 用法：node stophero/tools/cdp.js top "表达式"      （top / bottom 选哪块屏）
const [, , which = 'top', expr = 'location.href'] = process.argv;
(async () => {
  const list = await (await fetch('http://127.0.0.1:9333/json')).json();
  const tg = list.find(t => t.url.includes(which + '.html'));
  if (!tg) { console.log('没找到页面', list.map(t => t.url)); process.exit(1); }
  const ws = new WebSocket(tg.webSocketDebuggerUrl);
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === 1) { console.log(JSON.stringify(m.result.result ? m.result.result.value : m.result, null, 1)); ws.close(); } };
})();
