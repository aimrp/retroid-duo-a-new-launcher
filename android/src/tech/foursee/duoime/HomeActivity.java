package tech.foursee.duoime;

import android.app.Activity;
import android.app.ActivityOptions;
import android.content.Context;
import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.Display;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.*;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 上屏桌面（CATEGORY_HOME）：科技感大图标桌面，替代口袋掌游 / 系统桌面。
 * 只负责上屏（display 0）的应用图标与启动；下屏的辅助内容仍由 LauncherActivity（SECONDARY_HOME）承载。
 */
public class HomeActivity extends Activity {
  static final String TAG = "DuoHome";
  static final String ORIGIN = "https://duo-ime.local/";
  /** 不在桌面上展示的应用（用户要求隐藏）：日历、自带音乐、录音机、时钟。 */
  static final Set<String> HIDDEN = new HashSet<>(Arrays.asList(
      "com.android.calendar", "com.android.music", "com.android.soundrecorder", "com.android.deskclock"));

  private final Handler main = new Handler(Looper.getMainLooper());
  private WebView web;
  private boolean ready;
  private PackageManager pm;
  private BroadcastReceiver pkgReceiver;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    pm = getPackageManager();
    Window w = getWindow();
    // 不再强制常亮：熄屏走系统设置；有东西在播放时由下屏 LauncherActivity 统一保持常亮
    w.getDecorView().setBackgroundColor(Color.parseColor("#6f7d93"));
    WebView.setWebContentsDebuggingEnabled(true);
    web = new WebView(this);
    web.setBackgroundColor(Color.parseColor("#6f7d93"));
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    web.setWebViewClient(new WebViewClient() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
        String url = req.getUrl().toString();
        if (!url.startsWith(ORIGIN)) return null;
        String path = req.getUrl().getPath();
        if (path == null || path.equals("/")) path = "/home.html";
        try {
          InputStream in = getAssets().open("web" + path);
          return new WebResourceResponse(DuoIme.mime(path), "utf-8", in);
        } catch (IOException e) {
          return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
        }
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onConsoleMessage(ConsoleMessage m) {
        if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.e(TAG, "js: " + m.message() + " @" + m.lineNumber());
        return true;
      }
    });
    web.addJavascriptInterface(new Host(), "DuoHome");
    setContentView(web);
    hideBars();
    // 应用安装 / 卸载 / 更新后，自动刷新桌面图标列表
    pkgReceiver = new BroadcastReceiver() {
      @Override public void onReceive(Context c, Intent i) {
        main.postDelayed(() -> { if (web != null) web.evaluateJavascript("typeof render==='function' && render()", null); }, 800);
      }
    };
    IntentFilter f = new IntentFilter();
    f.addAction(Intent.ACTION_PACKAGE_ADDED);
    f.addAction(Intent.ACTION_PACKAGE_REMOVED);
    f.addAction(Intent.ACTION_PACKAGE_CHANGED);
    f.addDataScheme("package");
    registerReceiver(pkgReceiver, f);
    web.loadUrl(ORIGIN + "home.html");
  }

  void hideBars() {
    WindowInsetsController c = getWindow().getInsetsController();
    if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
  }

  @Override protected void onResume() { super.onResume(); hideBars(); }
  @Override public void onBackPressed() { }   // 桌面不回退到别的
  @Override protected void onDestroy() {
    if (pkgReceiver != null) { try { unregisterReceiver(pkgReceiver); } catch (Exception ignored) { } pkgReceiver = null; }
    // 旧的 WebView 必须销毁：留着会一直占着渲染进程，CPU 一路飙上去。
    if (web != null) { try { web.destroy(); } catch (Exception ignored) { } web = null; }
    super.onDestroy();
  }

  // ---------------------------------------------------------------- JS bridge
  final class Host {
    @JavascriptInterface public void ready() { main.post(() -> ready = true); }
    /** 菜单栏问候语里的称呼（打包时 config.local.json 的 user_name），没配就是空串。 */
    @JavascriptInterface public String userName() { return DuoIme.pref(HomeActivity.this, "user_name", ""); }

    /** 左上角这台设备的名字（打包时 config.local.json 的 device_name），没配就是空串，前端回退到默认的 Agent Deck。 */
    @JavascriptInterface public String deviceName() { return DuoIme.pref(HomeActivity.this, "device_name", ""); }

    /** 电量 {"level":76,"charging":true}；桌面藏了系统状态栏，电量放在自己的菜单栏里。 */
    @JavascriptInterface public String battery() {
      try {
        Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int lv = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), sc = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
        int st = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean chg = st == BatteryManager.BATTERY_STATUS_CHARGING || st == BatteryManager.BATTERY_STATUS_FULL;
        return new JSONObject().put("level", lv < 0 ? -1 : Math.round(lv * 100f / sc)).put("charging", chg).toString();
      } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public String apps() {
      try {
        Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> rs = pm.queryIntentActivities(i, 0);
        List<JSONObject> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (ResolveInfo r : rs) {
          String p = r.activityInfo.packageName;
          // 隐藏系统桌面 / 口袋掌游 / 自身 / 用户不要的系统应用，以及重复的包
          if (HIDDEN.contains(p)) continue;
          if (p.equals(getPackageName()) || p.equals("com.android.launcher3") || p.equals("com.retroidpocket.gamelauncher") || !seen.add(p)) continue;
          out.add(new JSONObject().put("pkg", p).put("label", r.loadLabel(pm).toString()));
        }
        Collections.sort(out, (a, b) -> a.optString("label").compareToIgnoreCase(b.optString("label")));
        return new JSONArray(out).toString();
      } catch (Exception e) { return "[]"; }
    }

    @JavascriptInterface public String icon(String pkg) {
      try {
        Drawable d = pm.getApplicationIcon(pkg);
        Bitmap bm = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bm); d.setBounds(0, 0, 192, 192); d.draw(c);
        ByteArrayOutputStream o = new ByteArrayOutputStream(); bm.compress(Bitmap.CompressFormat.PNG, 100, o);
        return "data:image/png;base64," + Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
      } catch (Exception e) { return ""; }
    }

    @JavascriptInterface public void launch(String pkg) {
      main.post(() -> {
        // 音乐 App 已在后台播放器里（有媒体会话）：打开我们自己的播放页，不去打开它那个卡顿的界面
        if (MediaHub.MUSIC.contains(pkg) && MediaHub.of(HomeActivity.this, pkg) != null) { PlayerActivity.open(HomeActivity.this, pkg); return; }
        Intent i = pm.getLaunchIntentForPackage(pkg);
        if (i == null) return;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        try { startActivity(i, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle()); }
        catch (Exception e) { Log.e(TAG, "launch", e); }
      });
    }

    @JavascriptInterface public void settings() {
      main.post(() -> {
        Intent i = new Intent(HomeActivity.this, SettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(i, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle()); }
        catch (Exception e) { Log.e(TAG, "settings", e); }
      });
    }
  }
}
