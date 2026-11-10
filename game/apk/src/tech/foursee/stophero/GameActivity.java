package tech.foursee.stophero;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.*;
import android.webkit.*;

/**
 * 上下屏共用的 WebView 外壳。
 * 下屏优先做成上屏 Activity 投到副屏的 Presentation 窗口（见 TopActivity）：
 * 掌机系统会把「在副屏上开了 Activity 的应用」整个按副屏音量（默认约 1%）压低声音，用 Presentation 就不算。
 * Presentation 开不了时才退回到副屏上的 BottomActivity。
 * - 两块屏收到的手柄按键/摇杆都转给上屏页面（游戏逻辑在上屏）。
 * - GameBridge.post：上屏 → 下屏发状态，下屏 → 上屏发触摸点选。
 */
public abstract class GameActivity extends Activity {
  abstract String page();
  static final Handler H = new Handler(Looper.getMainLooper());
  static WebView topWeb, botWeb;
  static TopActivity top;
  static BottomActivity bottomAct;
  protected WebView web;

  static final class Bridge {
    final boolean isTop; final Activity owner;
    Bridge(boolean isTop, Activity owner) { this.isTop = isTop; this.owner = owner; }
    /** 页面里的“退出游戏” */
    @JavascriptInterface public void exit() { H.post(GameActivity::exitGame); }
    /** 自动演示：adb shell am start -n tech.foursee.stophero/.TopActivity --es demo 45（或 cutscenes / ending） */
    @JavascriptInterface public String demoSeed() { return owner.getIntent().getStringExtra("demo"); }
    @JavascriptInterface public void post(String json) {
      H.post(() -> {
        WebView other = isTop ? botWeb : topWeb;
        if (other != null) other.evaluateJavascript("window.__linkRecv&&window.__linkRecv(" + org.json.JSONObject.quote(json) + ")", null);
      });
    }
  }

  static WebView makeWeb(Context c, String page, boolean isTop, Activity owner) {
    WebView.setWebContentsDebuggingEnabled(true); // 便于 adb 连上来查问题（chrome://inspect）
    WebView w = new WebView(c);
    w.setBackgroundColor(Color.BLACK);
    WebSettings s = w.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setAllowFileAccess(true);
    w.addJavascriptInterface(new Bridge(isTop, owner), "GameBridge");
    w.setFocusable(false);
    w.loadUrl("file:///android_asset/web/" + page);
    return w;
  }

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    Window w = getWindow();
    w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    w.getDecorView().setBackgroundColor(Color.BLACK);
    web = makeWeb(this, page(), this instanceof TopActivity, this);
    setContentView(web);
    hideBars(getWindow());
  }

  static void hideBars(Window win) {
    WindowInsetsController c = win.getInsetsController();
    if (c != null) {
      c.hide(WindowInsets.Type.systemBars());
      c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
  }
  @Override protected void onResume() { super.onResume(); hideBars(getWindow()); }
  @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) hideBars(getWindow()); }

  static boolean isPad(int k) {
    return KeyEvent.isGamepadButton(k) || k == KeyEvent.KEYCODE_DPAD_UP || k == KeyEvent.KEYCODE_DPAD_DOWN
        || k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT || k == KeyEvent.KEYCODE_DPAD_CENTER
        || k == KeyEvent.KEYCODE_BACK;
  }
  /** 手柄按键：无论哪块屏收到都交给上屏页面。返回 true = 已处理 */
  static boolean forwardKey(KeyEvent e) {
    int k = e.getKeyCode();
    if (!isPad(k)) return false;
    if (e.getRepeatCount() == 0 && topWeb != null) {
      String name = KeyEvent.keyCodeToString(k).replace("KEYCODE_", "");
      boolean down = e.getAction() == KeyEvent.ACTION_DOWN;
      topWeb.evaluateJavascript("window.__padKey&&window.__padKey('" + name + "'," + down + ")", null);
    }
    return true;
  }
  static boolean forwardMotion(MotionEvent e) {
    if ((e.getSource() & InputDevice.SOURCE_JOYSTICK) != InputDevice.SOURCE_JOYSTICK || e.getAction() != MotionEvent.ACTION_MOVE || topWeb == null) return false;
    topWeb.evaluateJavascript(String.format(java.util.Locale.US,
        "window.__padAxis&&window.__padAxis({x:%.3f,y:%.3f,z:%.3f,rz:%.3f,hx:%.3f,hy:%.3f})",
        e.getAxisValue(MotionEvent.AXIS_X), e.getAxisValue(MotionEvent.AXIS_Y),
        e.getAxisValue(MotionEvent.AXIS_Z), e.getAxisValue(MotionEvent.AXIS_RZ),
        e.getAxisValue(MotionEvent.AXIS_HAT_X), e.getAxisValue(MotionEvent.AXIS_HAT_Y)), null);
    return true;
  }
  @Override public boolean dispatchKeyEvent(KeyEvent e) { return forwardKey(e) || super.dispatchKeyEvent(e); }
  @Override public boolean dispatchGenericMotionEvent(MotionEvent e) { return forwardMotion(e) || super.dispatchGenericMotionEvent(e); }

  /** 退出游戏：关掉上下两屏，回到掌机的系统桌面（它会把自己的下屏也放回去）。 */
  static boolean exiting;
  static void exitGame() {
    if (exiting) return;
    exiting = true;
    TopActivity t = top; BottomActivity b = bottomAct;
    Activity ctx = t != null ? t : b;
    if (ctx != null) {
      try {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(home, android.app.ActivityOptions.makeBasic().setLaunchDisplayId(0).toBundle());
      } catch (Exception e) { android.util.Log.e("StopGame", "home failed", e); }
    }
    if (t != null) t.closeBottom();
    if (b != null) b.finishAndRemoveTask();
    if (t != null) t.finishAndRemoveTask();
    H.postDelayed(() -> exiting = false, 1500);
  }

  /** 按了 Home（哪块屏有焦点都一样）：整个游戏一起退出，不留半边在屏上。 */
  @Override protected void onUserLeaveHint() { super.onUserLeaveHint(); if (!isFinishing()) exitGame(); }

  @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }
}
