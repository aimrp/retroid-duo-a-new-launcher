/* STOP · The Stompers · 输入：掌机原生按键（APK 转发）/ 浏览器手柄 / 键盘
 * 按钮按"位置"命名：A=右  B=下  X=上  Y=左（与掌机丝印一致） */
(function (root) {
  'use strict';
  const held = {}, prevHeld = {};
  const axes = { lx: 0, ly: 0, rx: 0, ry: 0, hx: 0, hy: 0 };
  const BTNS = ['up', 'down', 'left', 'right', 'A', 'B', 'X', 'Y', 'START', 'SELECT', 'L1', 'R1'];

  // 安卓 keycode → 位置。掌机固件可能对调 A/B、X/Y，可在暂停菜单里切换并记住。
  const swap = JSON.parse(localStorage.getItem('sh_swap') || '{"ab":false,"xy":false}');
  function androidMap(name) {
    const m = {
      DPAD_UP: 'up', DPAD_DOWN: 'down', DPAD_LEFT: 'left', DPAD_RIGHT: 'right',
      BUTTON_A: swap.ab ? 'B' : 'A', BUTTON_B: swap.ab ? 'A' : 'B',
      BUTTON_X: swap.xy ? 'Y' : 'X', BUTTON_Y: swap.xy ? 'X' : 'Y',
      BUTTON_START: 'START', BUTTON_SELECT: 'SELECT', BACK: 'START', BUTTON_MODE: 'START',
      BUTTON_L1: 'L1', BUTTON_R1: 'R1', DPAD_CENTER: 'A', ENTER: 'START',
    };
    return m[name];
  }
  const raw = { native: {}, kb: {}, pad: {} };
  let lastRaw = '';

  // 原生桥接（APK 调用）
  root.__padKey = function (name, down) {
    lastRaw = name + (down ? '↓' : '↑');
    const b = androidMap(name);
    if (b) raw.native[b] = !!down;
  };
  root.__padAxis = function (o) {
    root.__nativePad = true;
    axes.lx = o.x || 0; axes.ly = o.y || 0;
    axes.rx = (o.z != null ? o.z : o.rx) || 0; axes.ry = (o.rz != null ? o.rz : o.ry) || 0;
    axes.hx = o.hx || 0; axes.hy = o.hy || 0;
  };

  // 键盘（开发用）：方向键/WASD，L=A  K=B  I=X  J=Y（与手柄菱形位置一致），空格=A，回车=START
  const KB = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyL: 'A', Space: 'A', KeyK: 'B', KeyI: 'X', KeyJ: 'Y', Enter: 'START', Escape: 'START', ShiftLeft: 'SELECT', ShiftRight: 'SELECT', KeyQ: 'L1', KeyE: 'R1',
  };
  function onKey(e, down) {
    const b = KB[e.code];
    if (!b) return;
    raw.kb[b] = down; e.preventDefault();
  }
  root.addEventListener('keydown', e => onKey(e, true));
  root.addEventListener('keyup', e => onKey(e, false));
  // dev.html 会把键盘事件转发进来
  root.addEventListener('message', e => {
    const d = e.data; if (!d || d.sh !== 'key') return;
    const b = KB[d.code]; if (b) raw.kb[b] = d.down;
  });

  function pollGamepad() {
    raw.pad = {};
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of gps) {
      if (!g) continue;
      const B = i => g.buttons[i] && g.buttons[i].pressed;
      // 标准布局：0 下 1 右 2 左 3 上
      Object.assign(raw.pad, { B: B(0), A: B(1), Y: B(2), X: B(3), L1: B(4), R1: B(5), SELECT: B(8), START: B(9), up: B(12), down: B(13), left: B(14), right: B(15) });
      if (!root.__nativePad) { axes.lx = g.axes[0] || 0; axes.ly = g.axes[1] || 0; axes.rx = g.axes[2] || 0; axes.ry = g.axes[3] || 0; }
      break;
    }
  }

  const state = { held, pressed: {}, axes };
  function poll() {
    pollGamepad();
    const dz = 0.4;
    for (const b of BTNS) {
      prevHeld[b] = held[b];
      held[b] = !!(raw.native[b] || raw.kb[b] || raw.pad[b]);
    }
    // 摇杆与方向键并入方向
    if (axes.lx < -dz || axes.hx < -0.5) held.left = true;
    if (axes.lx > dz || axes.hx > 0.5) held.right = true;
    if (axes.ly < -dz || axes.hy < -0.5) held.up = true;
    if (axes.ly > dz || axes.hy > 0.5) held.down = true;
    for (const b of BTNS) state.pressed[b] = held[b] && !prevHeld[b];
    // 右摇杆甩动 → 方向事件
    const rf = Math.abs(axes.rx) > 0.7 ? Math.sign(axes.rx) : 0;
    state.rflick = (rf && rf !== state._rf) ? rf : 0;
    state._rf = rf;
    return state;
  }

  function setSwap(k, v) { swap[k] = v; localStorage.setItem('sh_swap', JSON.stringify(swap)); }
  root.INPUT = { poll, state, swap, setSwap, get lastRaw() { return lastRaw; } };
})(window);
