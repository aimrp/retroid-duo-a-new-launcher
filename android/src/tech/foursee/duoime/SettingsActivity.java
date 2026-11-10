package tech.foursee.duoime;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import java.io.File;
import java.io.FileInputStream;
import org.json.JSONObject;

/** 设置页：一步步把输入法用起来（启用、切换、悬浮窗、麦克风），填语音 Key，管理学习记录。 */
public class SettingsActivity extends Activity {
  static final String[] MODELS = {"Qwen/Qwen3-ASR-1.7B", "FunAudioLLM/SenseVoiceSmall", "XingChenAGI/XingChenASR-V3.2"};
  private LinearLayout box;
  private SharedPreferences sp;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    sp = getSharedPreferences(DuoIme.PREFS, MODE_PRIVATE);
    String k = getIntent().getStringExtra("api_key");   // 开发用：adb shell am start ... --es api_key sk-...
    if (k != null) sp.edit().putString("api_key", k.trim()).apply();
    // 语音整理模型：--es refine_model Qwen/Qwen3.5-9B；传空字符串 "" 关闭整理
    String rm = getIntent().getStringExtra("refine_model");
    if (rm != null) sp.edit().putString("refine_model", rm.trim()).apply();
    ScrollView sv = new ScrollView(this);
    box = new LinearLayout(this);
    box.setOrientation(LinearLayout.VERTICAL);
    int p = dp(20);
    box.setPadding(p, p, p, p);
    sv.addView(box);
    setContentView(sv);
  }

  @Override protected void onResume() { super.onResume(); build(); }

  int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }

  void build() {
    box.removeAllViews();
    title("Agent Deck", 24);
    note("应用在上屏，键盘在下屏。拼音词库：雾凇拼音（rime-ice，GPL-3.0）。语音：硅基流动云端识别。");

    title("1. 准备", 18);
    step(enabled(), "启用输入法", "在系统设置里打开“Agent Deck”",
        () -> startActivity(new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)));
    step(isDefault(), "设为当前输入法", "选择“Agent Deck”",
        () -> getSystemService(InputMethodManager.class).showInputMethodPicker());
    step(Settings.canDrawOverlays(this), "允许悬浮窗", "键盘要以悬浮窗显示在下屏",
        () -> startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()))));
    step(checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED, "允许麦克风", "语音输入要用",
        () -> requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 1));
    step(DuoAccess.inst != null, "开启辅助功能", "下屏桌面要靠它识别上屏在用什么应用、并支持触摸板",
        () -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
    button("在下屏打开桌面", () -> {
      for (android.view.Display d : getSystemService(android.hardware.display.DisplayManager.class).getDisplays())
        if (d.getDisplayId() != android.view.Display.DEFAULT_DISPLAY)
          startActivity(new Intent(this, LauncherActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
              android.app.ActivityOptions.makeBasic().setLaunchDisplayId(d.getDisplayId()).toBundle());
    });

    title("2. 语音输入（硅基流动）", 18);
    EditText key = new EditText(this);
    key.setHint("API Key（sk-…）");
    key.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
    key.setText(DuoIme.pref(this, "api_key", ""));
    box.addView(key);
    Spinner model = new Spinner(this);
    model.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, MODELS));
    String cur = DuoIme.pref(this, "asr_model", MODELS[0]);
    for (int i = 0; i < MODELS.length; i++) if (MODELS[i].equals(cur)) model.setSelection(i);
    box.addView(model);
    button("保存", () -> {
      sp.edit().putString("api_key", key.getText().toString().trim()).putString("asr_model", (String) model.getSelectedItem()).apply();
      Toast.makeText(this, "已保存，下次弹出键盘时生效", Toast.LENGTH_SHORT).show();
    });

    title("3. 我的词库", 18);
    note("你选过的词会排到前面；分几次选出的句子会记成新词；在候选上长按可以删掉某个词的学习记录。");
    note("已学习 " + learnedCount() + " 个词");
    button("清除全部学习记录", () -> new android.app.AlertDialog.Builder(this).setMessage("清除全部学习记录？")
        .setPositiveButton("清除", (d, w) -> {
          new File(getFilesDir(), "user.json").delete();
          sp.edit().putLong("clear_at", System.currentTimeMillis()).apply();
          build();
        }).setNegativeButton("取消", null).show());
  }

  boolean enabled() {
    for (InputMethodInfo i : getSystemService(InputMethodManager.class).getEnabledInputMethodList())
      if (i.getPackageName().equals(getPackageName())) return true;
    return false;
  }

  boolean isDefault() {
    String cur = Settings.Secure.getString(getContentResolver(), Settings.Secure.DEFAULT_INPUT_METHOD);
    return cur != null && cur.startsWith(getPackageName() + "/");
  }

  int learnedCount() {
    File f = new File(getFilesDir(), "user.json");
    if (!f.exists()) return 0;
    try (FileInputStream in = new FileInputStream(f)) {
      byte[] buf = new byte[(int) f.length()]; int off = 0, n;
      while (off < buf.length && (n = in.read(buf, off, buf.length - off)) > 0) off += n;
      JSONObject e = new JSONObject(new String(buf, "UTF-8")).getJSONObject("e");
      int c = 0;
      for (java.util.Iterator<String> it = e.keys(); it.hasNext(); ) c += e.getJSONObject(it.next()).length();
      return c;
    } catch (Exception ex) { return 0; }
  }

  void title(String t, int size) {
    TextView v = new TextView(this);
    v.setText(t); v.setTextSize(size); v.setPadding(0, dp(16), 0, dp(6));
    v.getPaint().setFakeBoldText(true);
    box.addView(v);
  }

  void note(String t) {
    TextView v = new TextView(this);
    v.setText(t); v.setTextSize(14); v.setAlpha(.75f); v.setPadding(0, 0, 0, dp(6));
    box.addView(v);
  }

  void step(boolean ok, String name, String hint, Runnable act) {
    LinearLayout row = new LinearLayout(this);
    row.setGravity(Gravity.CENTER_VERTICAL);
    row.setPadding(0, dp(4), 0, dp(4));
    TextView t = new TextView(this);
    t.setText((ok ? "✅  " : "⬜  ") + name + "\n" + hint);
    t.setTextSize(15);
    row.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
    if (!ok) {
      Button btn = new Button(this);
      btn.setText("去设置");
      btn.setOnClickListener(v -> act.run());
      row.addView(btn);
    }
    box.addView(row);
  }

  void button(String t, Runnable act) {
    Button btn = new Button(this);
    btn.setText(t);
    btn.setOnClickListener(v -> act.run());
    box.addView(btn);
  }
}
