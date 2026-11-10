/* 上下屏通信：APK 里走 Java 桥（GameBridge），浏览器里走 BroadcastChannel */
(function (root) {
  'use strict';
  const fns = [];
  let bc = null;
  if (!root.GameBridge && root.BroadcastChannel) {
    bc = new BroadcastChannel('stophero');
    bc.onmessage = e => fns.forEach(f => f(e.data));
  }
  root.__linkRecv = function (o) { if (typeof o === 'string') o = JSON.parse(o); fns.forEach(f => f(o)); };
  root.LINK = {
    send(msg) {
      if (root.GameBridge) root.GameBridge.post(JSON.stringify(msg));
      else if (bc) bc.postMessage(msg);
    },
    on(f) { fns.push(f); },
    native: !!root.GameBridge,
  };
})(window);
