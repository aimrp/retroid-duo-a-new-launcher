package tech.foursee.stophero;

import android.app.ActivityOptions;
import android.app.Presentation;
import android.content.Intent;
import android.graphics.Color;
import android.hardware.display.DisplayManager;
import android.os.Bundle;
import android.util.Log;
import android.view.Display;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.webkit.WebView;

/** 上屏：游戏本体。启动时把下屏指挥台投到另一块屏（优先 Presentation，见 GameActivity 说明）。 */
public class TopActivity extends GameActivity {
  String page() { return "top.html"; }
  Presentation pres;

  /** 副屏上的指挥台窗口 */
  final class BottomPresentation extends Presentation {
    WebView w;
    BottomPresentation(Display d) { super(TopActivity.this, d); }
    @Override protected void onCreate(Bundle b) {
      super.onCreate(b);
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      getWindow().getDecorView().setBackgroundColor(Color.BLACK);
      w = makeWeb(getContext(), "bottom.html", false, TopActivity.this);
      botWeb = w;
      setContentView(w);
      hideBars(getWindow());
    }
    @Override public boolean dispatchKeyEvent(KeyEvent e) { return forwardKey(e) || super.dispatchKeyEvent(e); }
    @Override public boolean dispatchGenericMotionEvent(MotionEvent e) { return forwardMotion(e) || super.dispatchGenericMotionEvent(e); }
  }

  @Override protected void onCreate(Bundle b) {
    top = this;
    super.onCreate(b);
    topWeb = web;
    ensureBottom();
  }
  @Override protected void onResume() { super.onResume(); top = this; ensureBottom(); }
  @Override protected void onDestroy() {
    closeBottom();
    if (bottomAct != null) bottomAct.finish();
    if (top == this) { top = null; topWeb = null; }
    super.onDestroy();
  }
  void closeBottom() {
    if (pres != null) {
      try { pres.dismiss(); } catch (Exception e) { }
      if (botWeb != null && pres instanceof BottomPresentation && ((BottomPresentation) pres).w == botWeb) { botWeb.destroy(); botWeb = null; }
      pres = null;
    }
  }

  void ensureBottom() {
    if (pres != null && pres.isShowing()) return;
    if (bottomAct != null) return;
    DisplayManager dm = getSystemService(DisplayManager.class);
    int self = getDisplay().getDisplayId();
    for (Display d : dm.getDisplays()) {
      if (d.getDisplayId() == self) continue;
      try {
        pres = new BottomPresentation(d);
        pres.show();
        return;
      } catch (Exception e) {
        Log.e("StopGame", "presentation failed, falling back to activity", e);
        pres = null;
      }
      ActivityOptions o = ActivityOptions.makeBasic().setLaunchDisplayId(d.getDisplayId());
      Intent i = new Intent(this, BottomActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
      try { startActivity(i, o.toBundle()); } catch (Exception e) { Log.e("StopGame", "bottom launch failed", e); }
      return;
    }
  }
}
