package tech.foursee.stophero;

import android.os.Bundle;

/** 下屏（备用方案）：副屏开不了 Presentation 时，才用这个 Activity 放指挥台。 */
public class BottomActivity extends GameActivity {
  String page() { return "bottom.html"; }
  @Override protected void onCreate(Bundle b) {
    bottomAct = this; super.onCreate(b); botWeb = web;
  }
  @Override protected void onDestroy() {
    if (bottomAct == this) { bottomAct = null; if (botWeb == web) botWeb = null; }
    super.onDestroy();
  }
}
