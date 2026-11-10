package tech.foursee.duoime;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.app.ActivityOptions;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.*;
import android.hardware.display.DisplayManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.util.Log;
import android.util.SparseArray;
import android.view.Display;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import java.util.List;

/**
 * 辅助功能服务（需要用户在系统里开启）：
 * 1. 看上屏（display 0）现在是谁在前台 -> 下屏切模式
 * 2. 下屏桌面被系统桌面顶掉时，把它拉回来
 * 3. 触摸板：在上屏画光标，用手势代替手指点击/滑动
 * 4. 全局动作（返回/主页/最近/截图）和把文字粘贴进上屏的输入框
 */
public class DuoAccess extends AccessibilityService {
  static final String TAG = "DuoAccess";
  static volatile DuoAccess inst;
  static volatile String topPkg = "";

  private final Handler h = new Handler(Looper.getMainLooper());
  private WindowManager wm;
  private CursorView cursor;
  private float cx = 960, cy = 540;
  private int topW = 1920, topH = 1080;
  private long lastEnsure;
  private long lastScan;

  @Override protected void onServiceConnected() {
    super.onServiceConnected();
    inst = this;
    DisplayMetrics m = new DisplayMetrics();
    Display d0 = getSystemService(DisplayManager.class).getDisplay(Display.DEFAULT_DISPLAY);
    d0.getRealMetrics(m);
    topW = Math.max(m.widthPixels, m.heightPixels); topH = Math.min(m.widthPixels, m.heightPixels);
    cx = topW / 2f; cy = topH / 2f;
    wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    h.postDelayed(scan, 500);
    Log.e(TAG, "connected top=" + topW + "x" + topH);
  }

  @Override public boolean onUnbind(Intent i) { inst = null; removeCursor(); return super.onUnbind(i); }
  @Override public void onInterrupt() { }

  @Override public void onAccessibilityEvent(AccessibilityEvent e) {
    // 辅助功能事件很密（系统通知的间隔就是 100ms），全量扫描又很贵：合并成最多 2.5 次/秒。
    long now = SystemClock.uptimeMillis();
    if (now - lastScan < 400) return;
    lastScan = now;
    h.removeCallbacks(scan);
    h.postDelayed(scan, 400);
  }

  private final Runnable scan = () -> {
    try { doScan(); } catch (Exception e) { Log.e(TAG, "scan", e); }
  };

  private int bottomId() {
    for (Display d : getSystemService(DisplayManager.class).getDisplays()) if (d.getDisplayId() != Display.DEFAULT_DISPLAY) return d.getDisplayId();
    return -1;
  }

  /** 这个显示器上最靠前的应用窗口的包名，没有就是空串。 */
  private String frontPkg(List<AccessibilityWindowInfo> ws) {
    String pkg = ""; int best = -1;
    if (ws == null) return pkg;
    for (AccessibilityWindowInfo w : ws) {
      if (w.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
      AccessibilityNodeInfo r = w.getRoot();
      if (r == null || r.getPackageName() == null) continue;
      if (w.getLayer() > best) { best = w.getLayer(); pkg = r.getPackageName().toString(); }
    }
    return pkg;
  }

  private void doScan() {
    SparseArray<List<AccessibilityWindowInfo>> all = getWindowsOnAllDisplays();
    String top = frontPkg(all.get(Display.DEFAULT_DISPLAY));
    if (!top.equals(topPkg)) {
      topPkg = top;
      Log.e(TAG, "top app: " + top);
      LauncherActivity l = LauncherActivity.cur;
      if (l != null) l.push();
    }
    int b = bottomId();
    if (b >= 0) {
      String bp = frontPkg(all.get(b));
      // 下屏被系统自带的副屏桌面占了：换回我们的
      boolean covered = bp.equals("com.android.launcher3");
      if (covered || (bp.isEmpty() && LauncherActivity.cur == null)) ensureBottom(b, covered);
    }
  }

  void ensureBottom(int display, boolean covered) {
    long now = System.currentTimeMillis();
    if (now - lastEnsure < 2500) return;
    // 我们的面板已经在这块屏上而且活着：别再 startActivity，免得不停重建 WebView。
    // 但如果被原生副屏桌面盖住了（比如在别的应用里对着下屏按了 Home），它虽然还活着却看不见，必须拉回前台；
    // LauncherActivity 是 singleTask，再 start 一次只是把已有的任务提到前面，不会重建 WebView。
    if (!covered && LauncherActivity.cur != null && LauncherActivity.onDisplay == display) return;
    lastEnsure = now;
    try {
      Intent i = new Intent(this, LauncherActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(i, ActivityOptions.makeBasic().setLaunchDisplayId(display).toBundle());
      Log.e(TAG, "bottom launcher restored on " + display);
    } catch (Exception e) { Log.e(TAG, "ensureBottom", e); }
  }

  // ---------------------------------------------------------------- touchpad
  private static final class CursorView extends View {
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG), edge = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path arrow = new Path();
    CursorView(Context c) {
      super(c);
      fill.setColor(0xFFFFFFFF);
      edge.setColor(0x8C000000); edge.setStyle(Paint.Style.STROKE); edge.setStrokeWidth(1.8f);
      // 标准鼠标箭头：尖在 (0,0)
      arrow.moveTo(0, 0);
      arrow.lineTo(0, 22);
      arrow.lineTo(6, 18);
      arrow.lineTo(10, 30);
      arrow.lineTo(15, 27);
      arrow.lineTo(10, 17);
      arrow.lineTo(18, 17);
      arrow.close();
    }
    @Override protected void onDraw(Canvas c) {
      c.drawPath(arrow, fill); c.drawPath(arrow, edge);
    }
  }

  private void showCursor() {
    if (wm == null) return;
    if (cursor == null) {
      cursor = new CursorView(this);
      WindowManager.LayoutParams lp = new WindowManager.LayoutParams(32, 40, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
          WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
              | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
      lp.gravity = Gravity.TOP | Gravity.START;
      lp.x = (int) cx; lp.y = (int) cy;
      try { wm.addView(cursor, lp); } catch (Exception e) { Log.e(TAG, "cursor", e); cursor = null; }
    }
    hideCursorSoon(4000);
  }

  private final Runnable hideCursor = this::removeCursor;
  private void hideCursorSoon(long ms) { h.removeCallbacks(hideCursor); h.postDelayed(hideCursor, ms); }
  void removeCursor() {
    if (cursor != null && wm != null) { try { wm.removeView(cursor); } catch (Exception ignored) { } }
    cursor = null;
  }

  void padMove(float dx, float dy) {
    cx = Math.max(0, Math.min(topW - 1, cx + dx)); cy = Math.max(0, Math.min(topH - 1, cy + dy));
    showCursor();
    if (cursor != null) {
      WindowManager.LayoutParams lp = (WindowManager.LayoutParams) cursor.getLayoutParams();
      lp.x = (int) cx; lp.y = (int) cy;
      try { wm.updateViewLayout(cursor, lp); } catch (Exception ignored) { }
    }
  }

  private void gesture(Path p, long dur) {
    GestureDescription.Builder b = new GestureDescription.Builder();
    b.setDisplayId(Display.DEFAULT_DISPLAY);
    b.addStroke(new GestureDescription.StrokeDescription(p, 0, dur));
    dispatchGesture(b.build(), null, null);
  }

  void padTap(long dur) { Path p = new Path(); p.moveTo(cx, cy); showCursor(); gesture(p, dur); }

  void padScroll(float dx, float dy) {
    float sx = Math.max(-700, Math.min(700, dx));
    float sy = Math.max(-700, Math.min(700, dy));
    Path p = new Path(); p.moveTo(cx, cy);
    p.lineTo(Math.max(2, Math.min(topW - 2, cx + sx)), Math.max(2, Math.min(topH - 2, cy + sy)));
    showCursor(); gesture(p, 260);
  }

  // ---------------------------------------------------------------- actions
  boolean global(String name) {
    switch (name) {
      case "back": return backTop();
      case "home": return homeTop();
      case "recents": withTop(() -> performGlobalAction(GLOBAL_ACTION_RECENTS)); return true;
      case "shot": withTop(() -> performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)); return true;
      case "notif": withTop(() -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)); return true;
    }
    return false;
  }

  /**
   * 把上屏正在用的应用叫到前台（顺便把输入焦点挪回上屏），然后再执行全局动作。
   *
   * 为什么不能直接发按键：系统注入的按键只送给「当前有焦点的窗口」。用户点的是下屏，
   * 焦点就落在下屏面板上，这时注入返回/最近/截图，键只会被下屏面板吃掉，上屏什么也不会发生。
   * 把上屏的应用用 REORDER_TO_FRONT 叫到前台，焦点会跟着回到上屏（display 0）。
   */
  private void withTop(Runnable action) {
    bringTopToFront();
    waitTopFocus(action, 0);
  }

  /** 等焦点真的离开下屏面板（下屏面板不再持有焦点）再执行，最长等 1.2 秒。 */
  private void waitTopFocus(Runnable action, int tries) {
    if (!LauncherActivity.focused) {
      // 焦点刚离开下屏，输入分发器把「当前焦点的屏」换成上屏还要一小会儿；
      // 马上发键的话这个键还是会被送到下屏（下屏面板自己收到，等于白按）。等 0.25 秒再发。
      h.postDelayed(action, 250);
      return;
    }
    if (tries == 6) {          // 还没挪走：让下屏面板短暂把焦点让出去
      LauncherActivity l = LauncherActivity.cur;
      if (l != null) l.lendFocusToTop();
    }
    if (tries >= 12) { action.run(); return; }
    h.postDelayed(() -> waitTopFocus(action, tries + 1), 100);
  }

  /** 上屏正在用的那个应用（我们的播放页也算），把它叫到上屏前台。 */
  private void bringTopToFront() {
    String top = topPkg;
    if (top == null || top.isEmpty()) return;
    Intent i = null;
    boolean home = false;
    try {
      if (top.equals(getPackageName())) {
        PlayerActivity p = PlayerActivity.inst;
        i = (p != null && PlayerActivity.visible) ? new Intent(this, PlayerActivity.class)
            : getPackageManager().getLaunchIntentForPackage(top);
      } else if (top.startsWith("com.android.launcher3")) {
        // 上屏是系统桌面的「最近」：它的 Activity 没导出，起不来；它的启动 Intent 又是原生桌面，
        // 会盖掉我们的桌面。改叫我们自己的桌面顶上：反正从「最近」退出去最后也是回桌面，
        // 而且系统会因此把输入焦点交回上屏，发出去的返回键才不会又落到下屏。
        // 注意桌面是 HOME：REORDER_TO_FRONT 对 HOME 无效（系统不重排 HOME 任务），只能直接发 HOME。
        i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        home = true;
      } else {
        i = getPackageManager().getLaunchIntentForPackage(top);
      }
    } catch (Exception e) { Log.e(TAG, "bringTopToFront", e); }
    if (i == null) return;
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | (home ? Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED : Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
    try { startActivity(i, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle()); }
    catch (Exception e) { Log.e(TAG, "bringTopToFront", e); }
  }

  /**
   * 「主页」：直接把我们自己的桌面拉到上屏。
   * 不用系统的全局 HOME：全局动作是往当前有焦点的窗口发按键，焦点一旦落到下屏面板上，
   * 按键就发给下屏了，上屏什么也不会发生。
   */
  boolean homeTop() {
    try {
      Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
      startActivity(i, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle());
      return true;
    } catch (Exception e) { Log.e(TAG, "homeTop", e); return false; }
  }

  /**
   * 「返回」：目标是上屏那个应用。
   * 用户按的是下屏的按钮，此刻焦点在下屏面板上，系统发的返回键只会发给下屏。
   * 所以先把上屏的应用用 REORDER_TO_FRONT 叫到前台（焦点就回到上屏了，当前页面不受影响），
   * 等焦点真的回到上屏再发系统返回，返回键就落到上屏的应用上了。
   */
  boolean backTop() {
    PlayerActivity p = PlayerActivity.inst;
    if (p != null && PlayerActivity.visible) {      // 上屏是我们自己的播放页：关掉它
      h.post(() -> p.finish());
      return true;
    }
    // 焦点已经不在我们面板上了（上屏自己有个焦点窗口）：直接发返回，键就落在那个窗口上。
    if (!LauncherActivity.focused) {
      performGlobalAction(GLOBAL_ACTION_BACK);
      return true;
    }
    // 把上屏的应用叫到前台：系统注入的按键只发给「当前有焦点的窗口」，
    // 而用户刚点的是下屏，焦点还在我们面板上。不先在上屏起一个活动，键就永远发不到上屏。
    bringTopToFront();
    waitTopFocus(() -> performGlobalAction(GLOBAL_ACTION_BACK), 0);
    return true;
  }

  /** 把文字粘贴进上屏当前获得输入焦点的输入框；没有输入框就只留在剪贴板里，返回 false。 */
  boolean paste(String text) {
    ClipboardManager cm = getSystemService(ClipboardManager.class);
    cm.setPrimaryClip(ClipData.newPlainText("voice", text));
    List<AccessibilityWindowInfo> ws = getWindowsOnAllDisplays().get(Display.DEFAULT_DISPLAY);
    if (ws == null) return false;
    for (AccessibilityWindowInfo w : ws) {
      AccessibilityNodeInfo r = w.getRoot();
      if (r == null) continue;
      AccessibilityNodeInfo f = r.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
      if (f != null && f.isEditable()) return f.performAction(AccessibilityNodeInfo.ACTION_PASTE);
    }
    return false;
  }
}
