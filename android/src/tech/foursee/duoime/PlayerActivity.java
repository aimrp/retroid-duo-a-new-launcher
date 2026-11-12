package tech.foursee.duoime;

import android.app.Activity;
import android.app.ActivityOptions;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.session.MediaController;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Display;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.*;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import org.json.JSONObject;

/**
 * 上屏"正在播放"页：替代音乐 App 自己的界面（QQ 音乐的界面在这台机器上很卡、也不适配横屏）。
 * 音乐 App 留在后台负责播放（实测后台只占约 10% CPU，前台要吃满一个大核），这里通过媒体会话显示歌名、封面、
 * 进度和滚动歌词，并发控制指令。选歌单仍要回到音乐 App 自己的界面（QQ 音乐没有开放曲库浏览接口）。
 */
public class PlayerActivity extends Activity {
  static final String TAG = "DuoPlayer";
  static final String ORIGIN = "https://duo-ime.local/";
  static volatile boolean visible;
  static volatile PlayerActivity inst;

  private final Handler main = new Handler(Looper.getMainLooper());
  private WebView web;
  private String pkg;            // 指定的播放器；null = 自动（正在播放 / 最近用过的那个）

  /** 在上屏打开播放页；pkg 为 null 时自动挑播放器。 */
  static void open(Context c, String pkg) {
    Intent i = new Intent(c, PlayerActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    if (pkg != null) i.putExtra("pkg", pkg);
    try { c.startActivity(i, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle()); }
    catch (Exception e) { Log.e(TAG, "open", e); }
  }

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    pkg = getIntent().getStringExtra("pkg");
    Window w = getWindow();
    // 常亮由下屏 LauncherActivity 按“是否正在播放”统一控制（暂停后按系统熄屏时间熄屏）
    w.getDecorView().setBackgroundColor(Color.parseColor("#5d708e"));
    WebView.setWebContentsDebuggingEnabled(true);
    web = new WebView(this);
    web.setBackgroundColor(Color.parseColor("#5d708e"));
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    web.setWebViewClient(new WebViewClient() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
        String url = req.getUrl().toString();
        if (!url.startsWith(ORIGIN)) return null;
        String path = req.getUrl().getPath();
        if (path == null || path.equals("/")) path = "/player.html";
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
    host = new Host();
    web.addJavascriptInterface(host, "DuoPlayer");
    setContentView(web);
    hideBars();
    web.loadUrl(ORIGIN + "player.html");
  }

  @Override protected void onNewIntent(Intent i) {
    super.onNewIntent(i);
    setIntent(i);
    pkg = i.getStringExtra("pkg");
  }

  void hideBars() {
    WindowInsetsController c = getWindow().getInsetsController();
    if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
  }

  // 用 onStart/onStop（看得见/看不见）而不是 onResume/onPause：双屏机上下屏一启动活动，上屏就会收到 onPause，
  // 但页面其实还在显示，回来时也不一定再收到 onResume。
  @Override protected void onStart() {
    super.onStart(); visible = true; inst = this; pokeBottom();
    // 页面看不见的时候连 WebView 自己的绘制和计时器一起停：不然它在下屏控制台背后空转，白吃 CPU。
    if (web != null) { web.onResume(); web.evaluateJavascript("window.pl && pl.resume()", null); }
  }
  @Override protected void onResume() { super.onResume(); hideBars(); }
  @Override protected void onStop() {
    visible = false; if (inst == this) inst = null; pokeBottom();
    if (web != null) { web.evaluateJavascript("window.pl && pl.pause()", null); web.onPause(); }   // 看不见就停掉轮询，不耗电
    super.onStop();
  }
  @Override protected void onDestroy() {
    try { if (host != null) host.duck(false); } catch (Exception ignored) { } if (web != null) { web.destroy(); web = null; } super.onDestroy(); }

  /** 让下屏跟着切换（播放页在前台 = 下屏显示转盘遥控）。 */
  void pokeBottom() {
    main.postDelayed(() -> { LauncherActivity l = LauncherActivity.cur; if (l != null) l.push(); }, 150);
  }

  MediaController ctl() {
    if (pkg != null) { MediaController m = MediaHub.of(this, pkg); if (m != null) return m; }
    return MediaHub.pick(this);
  }

  /** 下屏转盘 MENU：播放页 → 回到音乐 App 选歌。没有播放页时返回 false。 */
  static boolean backToApp() {
    PlayerActivity p = inst;
    if (p == null || !visible) return false;
    p.main.post(p::openMusicApp);
    return true;
  }

  void openMusicApp() {
    MediaController m = ctl();
    String p = m != null ? m.getPackageName() : (pkg != null ? pkg : "com.luna.music");
    Intent i = getPackageManager().getLaunchIntentForPackage(p);
    if (i == null) return;
    DuoAccess.stayPkg = p;   // 用户主动回去选歌：别马上又被自动切回播放皮
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
    try { startActivity(i, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle()); }
    catch (Exception e) { Log.e(TAG, "openApp", e); }
  }

  // ---------------------------------------------------------------- JS bridge
  /** 下屏转盘点了上一首/下一首：交给页面走同一套“抬臂→换唱片→落下再播放”。 */
  static boolean step(String k) {
    PlayerActivity p = inst;
    if (p == null || !visible || p.web == null) return false;
    p.main.post(() -> p.web.evaluateJavascript("window.pl && pl.step('" + k + "')", null));
    return true;
  }
  private Host host;
  final class Host {
    @JavascriptInterface public String now() { return MediaHub.snapshot(PlayerActivity.this, ctl()).toString(); }
    @JavascriptInterface public String artId() { return MediaHub.artId(ctl()); }
    @JavascriptInterface public String art() { return MediaHub.art(ctl()); }
    @JavascriptInterface public boolean control(String cmd) { return MediaHub.control(ctl(), cmd); }

    /** 电量 {"level":76,"charging":true}：播放页也藏了系统状态栏，菜单栏里自己画一个。 */
    @JavascriptInterface public String battery() {
      try {
        Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int lv = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), sc = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
        int st = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean chg = st == BatteryManager.BATTERY_STATUS_CHARGING || st == BatteryManager.BATTERY_STATUS_FULL;
        return new JSONObject().put("level", lv < 0 ? -1 : Math.round(lv * 100f / sc)).put("charging", chg).toString();
      } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public void lyrics(String id, String title, String artist, String album, double durMs) {
      MediaHub.lyrics(PlayerActivity.this, title, artist, album, (long) durMs, lrc -> main.post(() -> {
        if (web != null) web.evaluateJavascript("window.pl && pl.lyrics(" + JSONObject.quote(id) + "," + JSONObject.quote(lrc) + ")", null);
      }));
    }

    /** 回到音乐 App 自己的界面去选歌单（选好后点下屏转盘的 MENU，或桌面上的图标回到这里）。 */
    @JavascriptInterface public void openApp() { main.post(PlayerActivity.this::openMusicApp); }

    private int savedVol = -1;
    /** 切歌期间把媒体音量压到 0（on=true），唱臂落下后恢复（on=false）。重复调用安全。 */
    @JavascriptInterface public void duck(boolean on) {
      AudioManager am = getSystemService(AudioManager.class);
      if (on) { if (savedVol < 0) { savedVol = am.getStreamVolume(AudioManager.STREAM_MUSIC); am.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0); } }
      else if (savedVol >= 0) { am.setStreamVolume(AudioManager.STREAM_MUSIC, savedVol, 0); savedVol = -1; }
    }

    @JavascriptInterface public void close() { main.post(PlayerActivity.this::finish); }
  }
}
