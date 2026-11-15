package tech.foursee.duoime;

import android.os.Handler;
import android.os.Looper;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;

/** 上下屏共用桌面输入；摇杆死区、长按连发和归中复位。 */
final class HomeInput {
  private final Handler main = new Handler(Looper.getMainLooper());
  private String held;
  private int heldDevice = -1;
  private final Runnable repeat = new Runnable() {
    @Override public void run() {
      if (held == null || !HomeActivity.canNavigate() || InputDevice.getDevice(heldDevice) == null) { reset(); return; }
      HomeActivity.navigate(held);
      main.postDelayed(this, 150);
    }
  };
  void reset() { held = null; main.removeCallbacks(repeat); }
  boolean key(KeyEvent e) {
    String cmd;
    switch (e.getKeyCode()) {
      case KeyEvent.KEYCODE_DPAD_LEFT: cmd = "left"; break;
      case KeyEvent.KEYCODE_DPAD_RIGHT: cmd = "right"; break;
      case KeyEvent.KEYCODE_DPAD_UP: cmd = "up"; break;
      case KeyEvent.KEYCODE_DPAD_DOWN: cmd = "down"; break;
      case KeyEvent.KEYCODE_BUTTON_A:
      case KeyEvent.KEYCODE_DPAD_CENTER:
      case KeyEvent.KEYCODE_ENTER: cmd = "open"; break;
      default: return false;
    }
    if (e.getAction() == KeyEvent.ACTION_DOWN && (!cmd.equals("open") || e.getRepeatCount() == 0)) HomeActivity.navigate(cmd);
    return true;
  }
  boolean motion(MotionEvent e) {
    if (!e.isFromSource(InputDevice.SOURCE_JOYSTICK) || e.getAction() != MotionEvent.ACTION_MOVE) return false;
    // 只使用左摇杆 X/Y；十字键有些驱动以 HAT 轴上报。
    float x = axis(e, MotionEvent.AXIS_X), y = axis(e, MotionEvent.AXIS_Y);
    float hx = axis(e, MotionEvent.AXIS_HAT_X), hy = axis(e, MotionEvent.AXIS_HAT_Y);
    if (Math.abs(hx) > Math.abs(x)) x = hx;
    if (Math.abs(hy) > Math.abs(y)) y = hy;
    float max = Math.max(Math.abs(x), Math.abs(y));
    // 起动 0.55，释放 0.35，避免摇杆漂移和阈值抖动。
    String dir = max < (held == null ? .55f : .35f) ? null
        : Math.abs(x) >= Math.abs(y) ? (x < 0 ? "left" : "right") : (y < 0 ? "up" : "down");
    if (dir == null) reset();
    else if (!dir.equals(held)) {
      reset(); held = dir; heldDevice = e.getDeviceId(); HomeActivity.navigate(dir); main.postDelayed(repeat, 380);
    }
    return true;
  }
  private float axis(MotionEvent e, int axis) {
    float value = e.getAxisValue(axis);
    InputDevice device = e.getDevice();
    InputDevice.MotionRange range = device == null ? null : device.getMotionRange(axis, e.getSource());
    return Math.abs(value) <= (range == null ? 0 : range.getFlat()) ? 0 : value;
  }
}
