package tech.foursee.duoime;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.inputmethodservice.InputMethodService;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.InputType;
import android.text.TextUtils;
import android.util.Log;
import android.view.*;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.*;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Agent Deck：应用在上屏（display 0），键盘在下屏（display 2）。
 * - 上屏：输入法窗口只留一条窄栏，显示拼音和前几个候选
 * - 下屏：TYPE_APPLICATION_OVERLAY + FLAG_NOT_FOCUSABLE 的 WebView，点它不会抢走上屏输入框的焦点
 * - 键盘界面、拼音引擎、语音都在 WebView 里（assets/web，和电脑模拟器同一份代码），通过 DuoHost 回调这里
 */
public class DuoIme extends InputMethodService {
  static final String TAG = "DuoIme";
  static final String ORIGIN = "https://duo-ime.local/";   // 虚拟 https 地址：安全上下文才能用麦克风
  static final String PREFS = "duoime";

  private final Handler main = new Handler(Looper.getMainLooper());
  private WebView web;
  private WindowManager overlayWm;
  private boolean overlayShown, pageReady;
  private String pendingStart;
  private TextView strip;
  private long seenClearAt;

  // ---------------------------------------------------------------- lifecycle
  @Override public void onCreate() {
    super.onCreate();
    WebView.setWebContentsDebuggingEnabled(true);
    seenClearAt = prefs().getLong("clear_at", 0);
    createKeyboard();
  }

  @Override public void onDestroy() {
    hideOverlay();
    if (web != null) web.destroy();
    super.onDestroy();
  }

  SharedPreferences prefs() { return getSharedPreferences(PREFS, MODE_PRIVATE); }

  private Display bottomDisplay() {
    for (Display d : getSystemService(DisplayManager.class).getDisplays())
      if (d.getDisplayId() != Display.DEFAULT_DISPLAY) return d;
    return null;
  }

  /** WebView 要用下屏的窗口上下文来建，密度和尺寸才是下屏的（1280×960 @2x → CSS 640×480）。 */
  private void createKeyboard() {
    Display d = bottomDisplay();
    if (d == null) { Log.e(TAG, "no secondary display"); return; }
    Context ctx = createDisplayContext(d).createWindowContext(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, null);
    overlayWm = ctx.getSystemService(WindowManager.class);
    web = new WebView(ctx);
    web.setBackgroundColor(Color.parseColor("#d3d0c9"));
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setTextZoom(100);
    web.setWebViewClient(new WebViewClient() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
        String url = req.getUrl().toString();
        if (!url.startsWith(ORIGIN)) return null;
        String path = req.getUrl().getPath();
        if (path == null || path.equals("/")) path = "/ime.html";
        try {
          InputStream in = getAssets().open("web" + path);
          WebResourceResponse r = new WebResourceResponse(mime(path), "utf-8", in);
          return r;
        } catch (IOException e) {
          return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
        }
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onPermissionRequest(PermissionRequest req) {
        boolean wantsMic = false;
        for (String r : req.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
        if (wantsMic && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
          req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
          req.deny();
          main.post(() -> Toast.makeText(DuoIme.this, "请在“Agent Deck 设置”里允许麦克风", Toast.LENGTH_LONG).show());
        }
      }
      @Override public boolean onConsoleMessage(ConsoleMessage m) {
        if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.e(TAG, "js: " + m.message() + " @" + m.lineNumber());
        return true;
      }
    });
    web.addJavascriptInterface(new Host(), "DuoHost");
    web.loadUrl(ORIGIN + "ime.html");
    Log.e(TAG, "keyboard webview created on display " + d.getDisplayId());
  }

  // ---------------------------------------------------------------- 打包时写进去的默认配置
  private static JSONObject builtIn;
  /**
   * build.sh 打包时把 config.local.json 里的值写进 APK 的 assets/config.json（没配就是空对象）。
   * 设置页里改过的值存在 SharedPreferences，优先于这里。
   */
  static synchronized JSONObject builtIn(Context c) {
    if (builtIn == null) {
      try (InputStream in = c.getAssets().open("config.json")) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096]; int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        builtIn = new JSONObject(out.toString("UTF-8"));
      } catch (Exception e) { builtIn = new JSONObject(); }
    }
    return builtIn;
  }

  /** 读一项配置：设置页存过的 > 打包时写进去的 > def。 */
  static String pref(Context c, String key, String def) {
    SharedPreferences sp = c.getSharedPreferences(PREFS, MODE_PRIVATE);
    if (sp.contains(key)) return sp.getString(key, def);
    JSONObject b = builtIn(c);
    return b.has(key) ? b.optString(key, def) : def;
  }

  /** 语音用的那组配置，键盘页和下屏面板共用。 */
  static JSONObject voiceConfig(Context c) throws Exception {
    return new JSONObject().put("key", pref(c, "api_key", "")).put("asrModel", pref(c, "asr_model", "Qwen/Qwen3-ASR-1.7B"))
        .put("refineModel", pref(c, "refine_model", "Qwen/Qwen3.5-9B"));
  }

  static String mime(String p) {
    if (p.endsWith(".html")) return "text/html";
    if (p.endsWith(".js")) return "application/javascript";
    if (p.endsWith(".css")) return "text/css";
    if (p.endsWith(".png")) return "image/png";
    if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
    if (p.endsWith(".svg")) return "image/svg+xml";
    return "application/octet-stream";
  }

  // ---------------------------------------------------------------- top-screen strip
  @Override public View onCreateInputView() {
    LinearLayout bar = new LinearLayout(this);
    bar.setBackgroundColor(Color.parseColor("#e6e4df"));
    strip = new TextView(this);
    strip.setTextSize(15);
    strip.setTextColor(Color.parseColor("#1f1e1b"));
    strip.setSingleLine(true);
    strip.setEllipsize(TextUtils.TruncateAt.END);
    int p = (int) (8 * getResources().getDisplayMetrics().density);
    strip.setPadding(p * 2, p, p * 2, p);
    bar.addView(strip, new LinearLayout.LayoutParams(-1, -2));
    showStrip("", null);
    return bar;
  }

  /** 横屏时系统默认会进全屏编辑模式，这里关掉：上屏只要一条窄栏。 */
  @Override public boolean onEvaluateFullscreenMode() { return false; }

  void showStrip(String pre, JSONArray cands) {
    if (strip == null) return;
    if (pre == null || pre.isEmpty()) { strip.setText("⌨  键盘在下屏 · Agent Deck"); strip.setTextColor(Color.parseColor("#625e57")); return; }
    StringBuilder sb = new StringBuilder(pre).append("    ");
    if (cands != null) for (int i = 0; i < cands.length(); i++) sb.append(i + 1).append('.').append(cands.optString(i)).append("   ");
    strip.setText(sb.toString());
    strip.setTextColor(Color.parseColor("#1f1e1b"));
  }

  // ---------------------------------------------------------------- show / hide keyboard on the bottom screen
  @Override public void onStartInputView(EditorInfo info, boolean restarting) {
    super.onStartInputView(info, restarting);
    if (web == null) createKeyboard();
    if (!canOverlay()) {
      showStrip("", null);
      if (strip != null) strip.setText("⚠ 请在“Agent Deck 设置”里允许悬浮窗，键盘才能显示在下屏");
      return;
    }
    showOverlay();
    try {
      JSONObject o = config();
      o.put("enter", enterLabel(info));
      long clearAt = prefs().getLong("clear_at", 0);
      if (clearAt != seenClearAt) { o.put("clearUser", true); seenClearAt = clearAt; }
      String js = "window.duo && duo.start(" + o + ")";
      if (pageReady) web.evaluateJavascript(js, null); else pendingStart = js;
    } catch (Exception e) { Log.e(TAG, "start", e); }
  }

  @Override public void onFinishInputView(boolean finishing) {
    if (web != null && pageReady) web.evaluateJavascript("window.duo && duo.reset()", null);
    hideOverlay();
    showStrip("", null);
    super.onFinishInputView(finishing);
  }

  boolean canOverlay() { return Settings.canDrawOverlays(this); }

  private void showOverlay() {
    if (overlayShown || web == null || overlayWm == null) return;
    WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
        PixelFormat.OPAQUE);
    lp.gravity = Gravity.TOP | Gravity.START;
    lp.setTitle("DuoImeKeyboard");
    try {
      overlayWm.addView(web, lp);
      overlayShown = true;
      web.onResume();
    } catch (Exception e) { Log.e(TAG, "overlay failed", e); }
  }

  private void hideOverlay() {
    if (!overlayShown) return;
    try { overlayWm.removeView(web); } catch (Exception ignored) { }
    overlayShown = false;
  }

  // ---------------------------------------------------------------- config / editor
  JSONObject config() throws Exception {
    return voiceConfig(this);
  }

  static String enterLabel(EditorInfo info) {
    if (info == null) return "换行";
    boolean multi = (info.inputType & InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0;
    if ((info.imeOptions & EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0 || multi) return "换行";
    switch (info.imeOptions & EditorInfo.IME_MASK_ACTION) {
      case EditorInfo.IME_ACTION_SEARCH: return "搜索";
      case EditorInfo.IME_ACTION_SEND: return "发送";
      case EditorInfo.IME_ACTION_GO: return "前往";
      case EditorInfo.IME_ACTION_NEXT: return "下一项";
      case EditorInfo.IME_ACTION_DONE: return "完成";
      default: return "确定";
    }
  }

  File userFile() { return new File(getFilesDir(), "user.json"); }

  // ---------------------------------------------------------------- JS bridge (called on a WebView thread)
  final class Host {
    @JavascriptInterface public void ready() {
      main.post(() -> {
        pageReady = true;
        Log.e(TAG, "keyboard page ready");
        if (pendingStart != null) { web.evaluateJavascript(pendingStart, null); pendingStart = null; }
      });
    }

    @JavascriptInterface public void commit(String text) {
      main.post(() -> { InputConnection ic = getCurrentInputConnection(); if (ic != null) ic.commitText(text, 1); });
    }

    @JavascriptInterface public void backspace() {
      main.post(() -> {
        InputConnection ic = getCurrentInputConnection(); if (ic == null) return;
        // 远程桌面（ToDesk）这类 TYPE_NULL 输入框只认按键事件；验证码这种一格一个输入框的，当前格为空时
        // “删光标前一个字”删不到东西，应用要收到退格键才会跳回上一格。这两种都发真正的 DEL 键。
        EditorInfo info = getCurrentInputEditorInfo();
        boolean raw = info == null || (info.inputType & InputType.TYPE_MASK_CLASS) == InputType.TYPE_NULL;
        CharSequence sel = raw ? null : ic.getSelectedText(0);
        CharSequence before = raw ? null : ic.getTextBeforeCursor(1, 0);
        if (sel != null && sel.length() > 0) ic.commitText("", 1);
        else if (raw || before == null || before.length() == 0) sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL);
        else ic.deleteSurroundingTextInCodePoints(1, 0);
      });
    }

    @JavascriptInterface public void enter() {
      main.post(() -> {
        InputConnection ic = getCurrentInputConnection(); EditorInfo info = getCurrentInputEditorInfo();
        if (ic == null) return;
        String label = enterLabel(info);
        int action = info == null ? EditorInfo.IME_ACTION_UNSPECIFIED : info.imeOptions & EditorInfo.IME_MASK_ACTION;
        if (label.equals("换行")) ic.commitText("\n", 1);
        else if (action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) ic.performEditorAction(action);
        else sendDownUpKeyEvents(KeyEvent.KEYCODE_ENTER);
      });
    }

    @JavascriptInterface public void composing(String pre, String candsJson) {
      main.post(() -> { try { showStrip(pre, new JSONArray(candsJson)); } catch (Exception e) { showStrip(pre, null); } });
    }

    @JavascriptInterface public String getConfig() {
      try { return config().toString(); } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public String loadUser() {
      File f = userFile();
      if (!f.exists()) return "";
      try (FileInputStream in = new FileInputStream(f)) {
        ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        return o.toString("UTF-8");
      } catch (IOException e) { Log.e(TAG, "load user", e); return ""; }
    }

    /** 先写临时文件再改名，写到一半断电也不会把学习记录弄坏。 */
    @JavascriptInterface public void saveUser(String json) {
      File tmp = new File(getFilesDir(), "user.json.tmp");
      try (FileOutputStream out = new FileOutputStream(tmp)) {
        out.write(json.getBytes(StandardCharsets.UTF_8));
        out.getFD().sync();
      } catch (IOException e) { Log.e(TAG, "save user", e); return; }
      if (!tmp.renameTo(userFile())) Log.e(TAG, "rename user.json failed");
    }
  }
}
