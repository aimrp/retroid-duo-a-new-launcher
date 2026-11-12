package tech.foursee.duoime;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityOptions;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.media.AudioManager;
import android.media.session.MediaController;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.util.Log;
import android.view.*;
import android.webkit.*;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 下屏桌面：不再重复上屏的应用列表，而是按上屏正在用什么来变：
 *   bar 控制台（默认）  pad 触摸板（浏览器）  media 媒体遥控（音乐/视频）
 * 输入框获得焦点时键盘由输入法（DuoIme）盖在这上面。窗口设成不抢焦点，上屏应用的焦点和按键不受影响。
 */
public class LauncherActivity extends Activity {
  static final String TAG = "DuoLauncher";
  static volatile LauncherActivity cur;
  /** 这个面板当前挂在哪块屏上（下屏 = 2），给辅助功能服务判断要不要重新拉起来。 */
  static volatile int onDisplay = -1;
  /** 这个面板现在有没有拿着输入焦点。用户一点下屏，焦点就落到这里，系统注入的按键也会被这里吃掉。 */
  static volatile boolean focused;
  static final String ORIGIN = "https://duo-ime.local/";
  static final Set<String> MUSIC = new HashSet<>(Arrays.asList("com.netease.cloudmusic", "com.spotify.music", "com.tencent.qqmusic", "com.luna.music",
      "com.kugou.android", "com.tencent.karaoke"));
  static final Set<String> VIDEO = new HashSet<>(Arrays.asList("tv.danmaku.bili", "com.google.android.youtube", "com.netflix.mediaclient",
      "com.qiyi.video", "com.tencent.qqlive", "com.youku.phone", "com.mgtv.ui", "com.ss.android.ugc.aweme"));
  static final Set<String> MEDIA = new HashSet<>(MUSIC); static { MEDIA.addAll(VIDEO); }

  private final Handler main = new Handler(Looper.getMainLooper());
  private WebView web;
  private boolean ready;
  private PackageManager pm;
  private SharedPreferences sp;
  private long backAt;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    Display d = getDisplay();
    onDisplay = d == null ? -1 : d.getDisplayId();
    pm = getPackageManager();
    sp = getSharedPreferences(DuoIme.PREFS, MODE_PRIVATE);
    Window w = getWindow();
    // 下屏这个窗口必须能拿到焦点。
    // 之前这里加了 FLAG_NOT_FOCUSABLE，于是 display 2 上「有前台应用、却没有焦点窗口」：
    // 系统往这块屏派发触摸时找不到目标窗口，5 秒后直接判 ANR，桌面就弹出「Agent Deck 没有响应」。
    // FLAG_ALT_FOCUSABLE_IM：窗口能拿焦点、收按键，但不当输入法的目标，上屏输入框照旧用下屏键盘。
    w.addFlags(WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM);   // 常亮不再写死，见 keepAwake()
    w.getDecorView().setBackgroundColor(Color.parseColor("#d3d0c9"));
    WebView.setWebContentsDebuggingEnabled(true);
    web = new WebView(this);
    web.setBackgroundColor(Color.parseColor("#d3d0c9"));
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    web.setWebViewClient(new WebViewClient() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
        String url = req.getUrl().toString();
        if (!url.startsWith(ORIGIN)) return null;
        String path = req.getUrl().getPath();
        if (path == null || path.equals("/")) path = "/launcher.html";
        try {
          InputStream in = getAssets().open("web" + path);
          return new WebResourceResponse(DuoIme.mime(path), "utf-8", in);
        } catch (IOException e) {
          return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
        }
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onPermissionRequest(PermissionRequest req) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) req.grant(req.getResources());
        else { req.deny(); main.post(() -> Toast.makeText(LauncherActivity.this, "请在“Agent Deck 设置”里允许麦克风", Toast.LENGTH_LONG).show()); }
      }
      @Override public boolean onConsoleMessage(ConsoleMessage m) {
        if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.e(TAG, "js: " + m.message() + " @" + m.lineNumber());
        return true;
      }
    });
    web.addJavascriptInterface(new Host(), "DuoLauncher");
    setContentView(web);
    hideBars();
    web.loadUrl(ORIGIN + "launcher.html");
  }

  /**
   * 调音乐音量。
   * 这台机器上音量键有三条路：键事件发给有焦点的窗口；系统_server 还会多广播一次
   * dual_screen_action.volume.key.event（一次按键广播两次，按下+抬起）；键没被谁吃掉时系统自己也会调一格。
   * 所以我们只管「焦点在下屏控制台」这一条：这时候键被我们吃掉，系统不会再调，
   * 我们自己调一格，别的应用在前台时交给系统（那边只有系统会调，不会多调）。
   */
  static void volume(Context c, String type) {
    AudioManager am = c.getSystemService(AudioManager.class);
    int before = am.getStreamVolume(AudioManager.STREAM_MUSIC);
    switch (type) {
      case "KEYCODE_VOLUME_UP": am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI); break;
      case "KEYCODE_VOLUME_DOWN": am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI); break;
      case "KEYCODE_VOLUME_MUTE": am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_TOGGLE_MUTE, AudioManager.FLAG_SHOW_UI); break;
      default: return;
    }
    Log.e(TAG, "vol " + type + " " + before + " -> " + am.getStreamVolume(AudioManager.STREAM_MUSIC));
  }

  void hideBars() {
    WindowInsetsController c = getWindow().getInsetsController();
    if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
  }

  @Override protected void onResume() { super.onResume(); cur = this; hideBars(); push(); main.removeCallbacks(watch); main.postDelayed(watch, 1000); }

  // 播放状态变了（视频开播、音乐被系统暂停）上屏应用不会变，辅助功能也不会通知：每秒看一眼，变了才推给页面
  private String lastState = "";
  private final Runnable watch = new Runnable() {
    @Override public void run() {
      if (cur != LauncherActivity.this || isDestroyed()) return;
      try { String s = state().toString(); if (!s.equals(lastState)) push(); } catch (Exception ignored) { }
      keepAwake();
      main.postDelayed(this, 1000);
    }
  };
  /**
   * 自动熄屏：下屏面板一直在显示，它的窗口常亮会让整台机器都不熄屏。
   * 规则：有任何播放器（音乐 / 视频）正在播放 → 保持常亮；什么都没在播 → 清掉，交给系统设置的熄屏时间。
   * 用户主动按电源键锁屏不受影响。
   */
  private boolean awake;
  void keepAwake() {
    boolean playing = false;
    try { for (android.media.session.MediaController m : MediaHub.sessions(this)) if (MediaHub.isPlaying(m)) { playing = true; break; } } catch (Exception ignored) { }
    if (playing == awake) return;
    awake = playing;
    if (playing) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    Log.e(TAG, "keep screen on: " + playing);
  }

  // 焦点在不在下屏：辅助功能服务要把按键发给上屏时，靠这个判断。
  @Override public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    focused = hasFocus;
  }
  // 活动被重建时（换屏、重启任务）旧的 WebView 必须销毁：留着会一直占着渲染进程，CPU 一路飙上去。
  @Override protected void onDestroy() {
    if (cur == this) cur = null;
    focused = false;
    if (web != null) { try { web.destroy(); } catch (Exception ignored) { } web = null; }
    super.onDestroy();
  }
  @Override public void onBackPressed() { }

  /**
   * 下屏窗口能拿到焦点了，实体按键会先到这里：音量自己处理，返回/主页转给上屏。
   * （系统往有焦点的窗口发按键，焦点在下屏时上屏收不到，所以这里要显式转过去。）
   */
  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    if (e.getAction() == KeyEvent.ACTION_DOWN) {
      DuoAccess a = DuoAccess.inst;
      switch (e.getKeyCode()) {
        case KeyEvent.KEYCODE_VOLUME_UP:
          volume(this, "KEYCODE_VOLUME_UP");
          return true;
        case KeyEvent.KEYCODE_VOLUME_DOWN:
          volume(this, "KEYCODE_VOLUME_DOWN");
          return true;
        case KeyEvent.KEYCODE_VOLUME_MUTE:
          volume(this, "KEYCODE_VOLUME_MUTE");
          return true;
        case KeyEvent.KEYCODE_BACK:
          if (SystemClock.uptimeMillis() - backAt < 1200) return true;    // 自己刚转发出去的返回，别再转回来
          if (a != null && a.backTop()) { backAt = SystemClock.uptimeMillis(); return true; }
          break;
        case KeyEvent.KEYCODE_HOME:
          if (a != null && a.homeTop()) return true;
          break;
      }
    }
    return super.dispatchKeyEvent(e);
  }

  /**
   * 把输入焦点短暂地借给上屏：窗口先不能拿焦点，WMS 就会把焦点交给上屏那个窗口。
   * （平时下屏必须能拿焦点：display 2 上没有焦点窗口的话，系统 5 秒后就判我们 ANR，所以只能短暂借出。）
   */
  void lendFocusToTop() {
    Window w = getWindow();
    w.addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
    main.postDelayed(() -> w.clearFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE), 600);
  }

  // ---------------------------------------------------------------- mode
  Set<String> homes() {
    Set<String> s = new HashSet<>();
    Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
    for (ResolveInfo r : pm.queryIntentActivities(i, 0)) s.add(r.activityInfo.packageName);
    s.add("com.android.launcher3"); s.remove("com.android.settings");
    return s;
  }

  String label(String pkg) {
    try { return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString(); } catch (Exception e) { return pkg; }
  }

  JSONObject state() throws Exception {
    String pkg = DuoAccess.topPkg == null ? "" : DuoAccess.topPkg;
    if (PlayerActivity.visible)   // 上屏是我们自己的播放页：下屏就是它的遥控器
      return new JSONObject().put("pkg", "player").put("label", "正在播放").put("mode", "media")
          .put("mediaKind", "music").put("access", DuoAccess.inst != null);
    boolean home = pkg.isEmpty() || homes().contains(pkg) || pkg.equals(getPackageName());
    String key = home ? "home" : pkg;
    String mode = home ? "bar" : MEDIA.contains(pkg) ? "media" : "pad";
    String kind = MUSIC.contains(pkg) ? "music" : VIDEO.contains(pkg) ? "video" : "other";
    String lbl = home ? "桌面" : label(pkg);
    boolean bg = false;
    // 上屏是播放器，但真正在响的是后台另一个（例：放着歌打开 B 站、视频还没开播）：转盘先控制在响的那个
    if (MEDIA.contains(pkg)) {
      android.media.session.MediaController c = MediaHub.pick(this);
      String cp = c == null ? null : c.getPackageName();
      if (cp != null && !cp.equals(pkg)) {
        kind = MUSIC.contains(cp) ? "music" : "video";
        lbl = label(cp); bg = true;
      }
    }
    return new JSONObject().put("pkg", key).put("label", lbl).put("mode", mode).put("bg", bg)
        .put("mediaKind", kind).put("access", DuoAccess.inst != null);
  }

  void push() {
    if (!ready || web == null) return;
    try { String s = state().toString(); lastState = s; web.evaluateJavascript("window.dl && dl.state(" + s + ")", null); } catch (Exception e) { Log.e(TAG, "push", e); }
  }

  // ---------------------------------------------------------------- JS bridge
  final class Host {
    @JavascriptInterface public void ready() { main.post(() -> { ready = true; push(); }); }

    @JavascriptInterface public String getConfig() {
      try { return DuoIme.voiceConfig(LauncherActivity.this).toString(); }
      catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public String apps() {
      try {
        Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> rs = pm.queryIntentActivities(i, 0);
        Set<String> favs = favs();
        List<JSONObject> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (ResolveInfo r : rs) {
          String p = r.activityInfo.packageName;
          if (p.equals(getPackageName()) || p.equals("com.android.launcher3") || !seen.add(p)) continue;
          out.add(new JSONObject().put("pkg", p).put("label", r.loadLabel(pm).toString()).put("fav", favs.contains(p)));
        }
        Collections.sort(out, (a, b) -> a.optString("label").compareToIgnoreCase(b.optString("label")));
        return new JSONArray(out).toString();
      } catch (Exception e) { return "[]"; }
    }

    Set<String> favs() {
      String raw = sp.getString("favs", null);
      Set<String> s = new LinkedHashSet<>();
      if (raw != null) { try { JSONArray a = new JSONArray(raw); for (int i = 0; i < a.length(); i++) s.add(a.getString(i)); } catch (Exception ignored) { } return s; }
      // 第一次：先放几个用户自己装的应用
      for (ResolveInfo r : pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)) {
        ApplicationInfo ai = r.activityInfo.applicationInfo;
        if ((ai.flags & ApplicationInfo.FLAG_SYSTEM) == 0 && !ai.packageName.equals(getPackageName()) && s.size() < 6) s.add(ai.packageName);
      }
      if (s.size() < 6 && isInstalled("com.android.chrome")) s.add("com.android.chrome");
      return s;
    }

    boolean isInstalled(String p) { try { pm.getPackageInfo(p, 0); return true; } catch (Exception e) { return false; } }

    @JavascriptInterface public void toggleFav(String pkg) {
      Set<String> f = favs();
      if (!f.remove(pkg)) f.add(pkg);
      sp.edit().putString("favs", new JSONArray(f).toString()).apply();
    }

    @JavascriptInterface public String icon(String pkg) {
      try {
        Drawable d = pm.getApplicationIcon(pkg);
        Bitmap bm = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bm); d.setBounds(0, 0, 96, 96); d.draw(c);
        ByteArrayOutputStream o = new ByteArrayOutputStream(); bm.compress(Bitmap.CompressFormat.PNG, 100, o);
        return "data:image/png;base64," + Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
      } catch (Exception e) { return ""; }
    }

    @JavascriptInterface public void launch(String pkg) {
      main.post(() -> {
        Intent i = pm.getLaunchIntentForPackage(pkg);
        if (i == null) return;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(i, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle()); } catch (Exception e) { Log.e(TAG, "launch", e); }
      });
    }

    @JavascriptInterface public void padMove(float dx, float dy) { DuoAccess a = DuoAccess.inst; if (a != null) a.padMove(dx * 3.4f, dy * 3.4f); }
    @JavascriptInterface public void padTap(boolean long_) { DuoAccess a = DuoAccess.inst; if (a != null) a.padTap(long_ ? 700 : 50); }
    @JavascriptInterface public void padScroll(float dx, float dy) { DuoAccess a = DuoAccess.inst; if (a != null) a.padScroll(dx * 3.4f, dy * 3.4f); }

    @JavascriptInterface public boolean act(String name) {
      AudioManager am = getSystemService(AudioManager.class);
      switch (name) {
        case "volup": am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI); return true;
        case "voldown": am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI); return true;
        case "volupq": am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, 0); return true;    // 转盘调音量：不弹系统音量条
        case "voldownq": am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, 0); return true;
        case "mute": am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_TOGGLE_MUTE, AudioManager.FLAG_SHOW_UI); return true;
        case "playpause": media(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE); return true;
        case "next": if (PlayerActivity.step("next")) return true; media(KeyEvent.KEYCODE_MEDIA_NEXT); return true;   // 上屏是我们的播放页：让它走换唱片动画
        case "prev": if (PlayerActivity.step("prev")) return true; media(KeyEvent.KEYCODE_MEDIA_PREVIOUS); return true;
        // 转盘 MENU：上屏是播放皮 → 回音乐 App 选歌；上屏是音乐 App → 换成播放皮
        case "musicmenu":
          if (PlayerActivity.backToApp()) return true;
          { String p = DuoAccess.topPkg; if (p != null && MUSIC.contains(p)) { DuoAccess.stayPkg = null; PlayerActivity.open(LauncherActivity.this, p); return true; } }
          return false;
        // 视频（B 站等）没有上一首/下一首：转盘左右改成后退/快进 10 秒
        case "seekfwd": return seekBy(10000);
        case "seekback": return seekBy(-10000);
        case "ff": media(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD); return true;
        case "rew": media(KeyEvent.KEYCODE_MEDIA_REWIND); return true;
      }
      DuoAccess a = DuoAccess.inst;
      return a != null && a.global(name);
    }

    MediaController topController() { return MediaHub.pick(LauncherActivity.this); }

    /** 相对跳转（毫秒）。播放器有媒体会话就直接 seek；没有就退回发快进/快退键。 */
    boolean seekBy(long delta) {
      MediaController c = topController();
      android.media.session.PlaybackState st = c == null ? null : c.getPlaybackState();
      if (st != null && (st.getActions() & android.media.session.PlaybackState.ACTION_SEEK_TO) != 0) {
        long pos = Math.max(0, MediaHub.position(st) + delta);
        android.media.MediaMetadata md = c.getMetadata();
        long dur = md == null ? 0 : md.getLong(android.media.MediaMetadata.METADATA_KEY_DURATION);
        if (dur > 0) pos = Math.min(pos, dur - 1000);
        return MediaHub.control(c, "seek:" + pos);
      }
      media(delta > 0 ? KeyEvent.KEYCODE_MEDIA_FAST_FORWARD : KeyEvent.KEYCODE_MEDIA_REWIND);
      return true;
    }

    /** 液晶屏：当前歌曲 {has,label,playing,title,artist,duration,position,key}，没授权/没播放器时 has=false。 */
    @JavascriptInterface public String nowPlaying() {
      try {
        MediaController c = topController();
        JSONObject o = MediaHub.snapshot(LauncherActivity.this, c);
        if (c == null) {
          String pkg = DuoAccess.topPkg == null ? "" : DuoAccess.topPkg;
          o.put("label", MEDIA.contains(pkg) ? label(pkg) : "").put("playing", musicActive());
        }
        return o.toString();
      } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public boolean seek(double ms) { return MediaHub.control(topController(), "seek:" + (long) ms); }

    /** 异步取歌词：结果回调 dl.lyrics(id, lrc)。 */
    @JavascriptInterface public void lyrics(String id, String title, String artist, String album, double durMs) {
      MediaHub.lyrics(LauncherActivity.this, title, artist, album, (long) durMs, lrc -> main.post(() -> {
        if (web != null) web.evaluateJavascript("window.dl && dl.lyrics(" + JSONObject.quote(id) + "," + JSONObject.quote(lrc) + ")", null);
      }));
    }

    /** 在上屏打开我们自己的"正在播放"页。 */
    @JavascriptInterface public void openPlayer() { main.post(() -> PlayerActivity.open(LauncherActivity.this, null)); }

    /** 媒体键只发给上屏正在用的应用。系统默认会发给"最后播放过的"那个播放器（比如后台的汽水音乐）。 */
    void media(int code) {
      MediaController c = topController();
      if (c != null) {
        switch (code) {
          case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: MediaHub.control(c, "playpause"); return;
          case KeyEvent.KEYCODE_MEDIA_NEXT: MediaHub.control(c, "next"); return;
          case KeyEvent.KEYCODE_MEDIA_PREVIOUS: MediaHub.control(c, "prev"); return;
          case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD: MediaHub.control(c, "ff"); return;
          case KeyEvent.KEYCODE_MEDIA_REWIND: MediaHub.control(c, "rew"); return;
        }
      }
      String pkg = DuoAccess.topPkg;
      if (pkg != null && MEDIA.contains(pkg)) {
        // 上屏是播放器但它还没有媒体会话（刚打开、没播过）：把按键直接投给这个应用自己
        for (int action : new int[]{KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP})
          sendBroadcast(new Intent(Intent.ACTION_MEDIA_BUTTON).setPackage(pkg).putExtra(Intent.EXTRA_KEY_EVENT, new KeyEvent(action, code)));
        return;
      }
      AudioManager am = getSystemService(AudioManager.class);
      am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));
      am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));
    }

    /** 媒体音量 {"cur":7,"max":15}，给下屏转盘的音量条用。 */
    @JavascriptInterface public String volume() {
      AudioManager am = getSystemService(AudioManager.class);
      return "{\"cur\":" + am.getStreamVolume(AudioManager.STREAM_MUSIC) + ",\"max\":" + am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) + "}";
    }

    /** 上屏这个应用是否正在播放（不是"手机里有没有声音"），给下屏播放键和液晶屏显示状态。 */
    @JavascriptInterface public boolean musicActive() {
      MediaController c = topController();
      if (c != null) return MediaHub.isPlaying(c);
      String pkg = DuoAccess.topPkg;
      if (pkg != null && MEDIA.contains(pkg)) return false;   // 上屏播放器没会话 = 没在播；别把后台别的播放器算进来
      return getSystemService(AudioManager.class).isMusicActive();
    }

    /** 语音结果粘贴进上屏输入框；返回 false 表示上屏没有输入框（文字在剪贴板里）。 */
    @JavascriptInterface public boolean paste(String text) { DuoAccess a = DuoAccess.inst; return a != null && a.paste(text); }
  }
}
