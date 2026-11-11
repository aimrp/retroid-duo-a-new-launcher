package tech.foursee.duoime;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.SystemClock;
import android.util.Base64;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * "播放器皮"的数据层：上下屏共用。
 * 播放交给后台的音乐 App（QQ 音乐等），这里只通过它的媒体会话（MediaController）读歌名/进度、发控制指令；
 * 歌词按 歌名+歌手+时长 去 lrclib.net（开放的 LRC 歌词库）查，查到的存到本地，下次不再联网。
 * 需要通知监听授权（DuoNotify）才能拿到别的 App 的媒体会话。
 */
final class MediaHub {
  static final String TAG = "DuoMedia";
  static final Set<String> MUSIC = LauncherActivity.MUSIC;
  static final Set<String> MEDIA = LauncherActivity.MEDIA;
  private static final ExecutorService NET = Executors.newSingleThreadExecutor();
  private static final Map<String, String> LRC = Collections.synchronizedMap(new HashMap<>());   // key -> LRC 文本，"" = 查过没有
  private static String artKey = "", artData = "";
  private static boolean keysLogged;
  private static volatile String latest = "";

  private MediaHub() { }

  static List<MediaController> sessions(Context c) {
    try {
      return c.getSystemService(MediaSessionManager.class).getActiveSessions(new ComponentName(c, DuoNotify.class));
    } catch (SecurityException e) { Log.e(TAG, "需要通知监听授权才能读取播放器"); }
    catch (Exception e) { Log.e(TAG, "sessions", e); }
    return Collections.emptyList();
  }

  /**
   * 要显示/控制的播放器：
   *  - 上屏是播放器：就是它（它没会话返回 null，不去碰后台别的播放器）
   *  - 上屏是桌面/播放页/别的应用：正在播放的那个音乐播放器；都没在播，就是最近用过的那个
   */
  static MediaController pick(Context c) {
    String top = DuoAccess.topPkg == null ? "" : DuoAccess.topPkg;
    List<MediaController> list = sessions(c);
    // 规则：控制“正在响的那个”。
    //  1. 上屏播放器自己在播 → 它
    //  2. 别的播放器在响（比如汽水音乐在后台放歌、刚打开 B 站还没开始放视频）→ 先控制在响的那个，
    //     等上屏的视频真正开播（系统音频焦点会让音乐自己暂停）再切过去
    //  3. 谁都没在响：上屏是播放器就是它（没会话返回 null）；否则是最近用过的音乐播放器
    MediaController topM = null;
    for (MediaController m : list) if (top.equals(m.getPackageName())) { topM = m; break; }
    if (topM != null && isPlaying(topM)) return topM;
    for (MediaController m : list) if (MEDIA.contains(m.getPackageName()) && isPlaying(m)) return m;
    if (MEDIA.contains(top)) return topM;
    MediaController recent = null;
    for (MediaController m : list) {
      if (!MUSIC.contains(m.getPackageName())) continue;
      if (isPlaying(m)) return m;
      if (recent == null) recent = m;          // 列表按最近活跃排序
    }
    return recent;
  }

  static MediaController of(Context c, String pkg) {
    for (MediaController m : sessions(c)) if (pkg.equals(m.getPackageName())) return m;
    return null;
  }

  static boolean isPlaying(MediaController m) {
    PlaybackState st = m == null ? null : m.getPlaybackState();
    return st != null && st.getState() == PlaybackState.STATE_PLAYING;
  }

  static long position(PlaybackState st) {
    if (st == null) return 0;
    long p = st.getPosition();
    if (st.getState() == PlaybackState.STATE_PLAYING && st.getLastPositionUpdateTime() > 0)
      p += (long) ((SystemClock.elapsedRealtime() - st.getLastPositionUpdateTime()) * st.getPlaybackSpeed());
    return Math.max(0, p);
  }

  static String label(Context c, String pkg) {
    try { PackageManager pm = c.getPackageManager(); return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString(); }
    catch (Exception e) { return pkg; }
  }

  /**
   * QQ 音乐开了"蓝牙/车载歌词"后，媒体信息会变成：标题 = 当前这句歌词，歌手 = "歌名-歌手"。
   * 这里还原成 歌名 / 歌手 / 当前歌词行。判断是不是这种模式（按播放器记住）：
   *   - 看到 歌手 以 "标题-" 开头（还没唱、标题就是歌名的时候），或
   *   - 同一首歌（歌手字段、时长不变、进度没归零）标题却变了。
   * 歌手字段里没有 "-" 时取消。避免把 "Jay-Z" 这类本来就带横杠的歌手名误拆。
   */
  static final Set<String> LYRIC_MODE = Collections.synchronizedSet(new HashSet<>());
  private static final Map<String, String[]> LAST_RAW = Collections.synchronizedMap(new HashMap<>());

  /** {歌名, 歌手, 当前歌词行（没有为 ""）} */
  static String[] norm(String pkg, MediaMetadata md, long pos) {
    String t = str(md, MediaMetadata.METADATA_KEY_TITLE), a = str(md, MediaMetadata.METADATA_KEY_ARTIST);
    if (a.isEmpty()) a = str(md, MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
    long dur = md == null ? 0 : md.getLong(MediaMetadata.METADATA_KEY_DURATION);
    int dash = a.indexOf('-');
    if (dash <= 0) { LYRIC_MODE.remove(pkg); LAST_RAW.put(pkg, new String[]{t, a, "" + dur}); return new String[]{t, a, ""}; }
    String song = a.substring(0, dash).trim(), singer = a.substring(dash + 1).trim();
    String[] last = LAST_RAW.put(pkg, new String[]{t, a, "" + dur});
    if (t.equals(song)) LYRIC_MODE.add(pkg);
    else if (last != null && last[1].equals(a) && last[2].equals("" + dur) && !last[0].equals(t) && pos > 3000) LYRIC_MODE.add(pkg);
    if (!LYRIC_MODE.contains(pkg)) return new String[]{t, a, ""};
    return new String[]{song, singer, t.equals(song) ? "" : t};
  }

  /** 当前歌曲快照：{pkg,label,has,playing,title,artist,album,duration,position,key,line,lyricMode,actions}。position 已按播放速度外推到"现在"。 */
  static JSONObject snapshot(Context c, MediaController m) {
    JSONObject o = new JSONObject();
    try {
      if (m == null) return o.put("has", false);
      String pkg = m.getPackageName();
      MediaMetadata md = m.getMetadata();
      PlaybackState st = m.getPlaybackState();
      long pos = position(st);
      String[] n = norm(pkg, md, pos);
      String album = str(md, MediaMetadata.METADATA_KEY_ALBUM);
      long dur = md == null ? 0 : md.getLong(MediaMetadata.METADATA_KEY_DURATION);
      if (md != null && !keysLogged) { keysLogged = true; Log.w(TAG, pkg + " metadata keys: " + md.keySet()); }
      return o.put("has", true).put("pkg", pkg).put("label", label(c, pkg)).put("playing", isPlaying(m))
          .put("title", n[0]).put("artist", n[1]).put("album", album).put("duration", dur).put("position", pos)
          .put("key", key(n[0], n[1])).put("line", n[2]).put("lyricMode", LYRIC_MODE.contains(pkg))
          .put("actions", st == null ? 0 : st.getActions());
    } catch (Exception e) { Log.e(TAG, "snapshot", e); return o; }
  }

  static String str(MediaMetadata md, String k) {
    if (md == null) return "";
    CharSequence s = md.getText(k);
    return s == null ? "" : s.toString().trim();
  }

  static String key(String title, String artist) { return title + "\u0001" + artist; }

  private static Bitmap bitmapOf(MediaMetadata md) {
    Bitmap bm = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
    if (bm == null) bm = md.getBitmap(MediaMetadata.METADATA_KEY_ART);
    if (bm == null) bm = md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
    return bm;
  }

  /** 当前封面的标识（图本身的身份，不是歌名）：播放器先换歌名、后换封面时，这个值会在封面真正换掉时才变。 */
  static String artId(MediaController m) {
    if (m == null) return "";
    MediaMetadata md = m.getMetadata();
    Bitmap bm = md == null ? null : bitmapOf(md);
    return bm == null ? "none" : String.valueOf(System.identityHashCode(bm)) + ":" + bm.getGenerationId();
  }

  /** 封面 data URL（JPEG，最长边 480），按封面图缓存，同一张图只编码一次。 */
  static synchronized String art(MediaController m) {
    if (m == null) return "";
    MediaMetadata md = m.getMetadata();
    if (md == null) return "";
    Bitmap bm = bitmapOf(md);
    String k = artId(m);
    if (k.equals(artKey)) return artData;
    String data = "";
    if (bm != null) {
      try {
        float s = Math.min(1f, 480f / Math.max(bm.getWidth(), bm.getHeight()));
        Bitmap sc = s < 1f ? Bitmap.createScaledBitmap(bm, Math.round(bm.getWidth() * s), Math.round(bm.getHeight() * s), true) : bm;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        sc.compress(Bitmap.CompressFormat.JPEG, 86, out);
        data = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
      } catch (Exception e) { Log.e(TAG, "art", e); }
    }
    artKey = k; artData = data;
    return data;
  }

  /** 发控制指令：play pause playpause next prev ff rew，或 seek:毫秒。返回是否有播放器接收。 */
  static boolean control(MediaController m, String cmd) {
    if (m == null) return false;
    MediaController.TransportControls t = m.getTransportControls();
    switch (cmd) {
      case "play": t.play(); return true;
      case "pause": t.pause(); return true;
      case "playpause": if (isPlaying(m)) t.pause(); else t.play(); return true;
      case "next": t.skipToNext(); return true;
      case "prev": t.skipToPrevious(); return true;
      case "ff": t.fastForward(); return true;
      case "rew": t.rewind(); return true;
    }
    if (cmd.startsWith("seek:")) { try { t.seekTo(Long.parseLong(cmd.substring(5))); return true; } catch (Exception e) { return false; } }
    return false;
  }

  // ---------------------------------------------------------------- 歌词

  /** 异步取歌词，回调在后台线程：LRC 文本（带时间轴），查不到给 ""。 */
  static void lyrics(Context c, String title, String artist, String album, long durMs, Consumer<String> done) {
    String k = key(title, artist);
    String hit = LRC.get(k);
    if (hit != null) { done.accept(hit); return; }
    File dir = new File(c.getFilesDir(), "lyrics");
    File f = new File(dir, Integer.toHexString(k.hashCode()) + "_" + durMs / 1000 + ".lrc");
    latest = k;
    NET.execute(() -> {
      String r = LRC.get(k);
      if (r == null && !k.equals(latest)) return;          // 已经换歌了，排队中的旧请求不再联网
      if (r == null) {
        try { if (f.exists()) r = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8); } catch (Exception ignored) { }
        if (r == null) {
          r = fetch(title, artist, album, durMs);
          if (!r.isEmpty()) { try { dir.mkdirs(); try (FileOutputStream o = new FileOutputStream(f)) { o.write(r.getBytes(StandardCharsets.UTF_8)); } } catch (Exception ignored) { } }
        }
        LRC.put(k, r);
      }
      done.accept(r);
    });
  }

  /** 歌名里去掉 "Disc 1 - "、括号里的版本说明和中文译名，只留主名，提高命中率。 */
  static String cleanTitle(String t) {
    String s = t.replaceFirst("^(?i)disc\\s*\\d+\\s*-\\s*", "");
    s = s.replaceAll("[（(\\[【][^)）\\]】]*[)）\\]】]", " ").replaceAll("\\s+", " ").trim();
    return s.isEmpty() ? t : s;
  }

  static String firstArtist(String a) {
    String[] p = a.split("\\s*[/、,&;]\\s*");
    return p.length > 0 ? p[0].trim() : a;
  }

  static String fetch(String title, String artist, String album, long durMs) {
    if (title.isEmpty()) return "";
    int dur = (int) Math.round(durMs / 1000.0);
    String t2 = cleanTitle(title), a1 = firstArtist(artist);
    try {
      // 1) 精确匹配（库里有完全对得上的那一版）
      if (dur > 0) {
        String r = synced(get("https://lrclib.net/api/get?track_name=" + enc(title) + "&artist_name=" + enc(artist)
            + "&album_name=" + enc(album) + "&duration=" + dur));
        if (!r.isEmpty()) return r;
      }
      // 2) 搜索：先 歌名+歌手，再 主名+第一个歌手，再只用主名；挑时长最接近的带时间轴版本
      String[][] tries = { {title, artist}, {t2, a1}, {t2, ""} };
      Set<String> done = new HashSet<>();
      String plain = "";
      for (String[] q : tries) {
        if (!done.add(q[0] + "|" + q[1])) continue;
        String url = "https://lrclib.net/api/search?track_name=" + enc(q[0]) + (q[1].isEmpty() ? "" : "&artist_name=" + enc(q[1]));
        String json = get(url);
        String best = bestOf(json, dur, q[1].isEmpty() ? a1 : null);
        if (!best.isEmpty()) return best;
      }
      // 3) 没有带时间轴的版本：退而用纯文本歌词（前面加标记，页面上只展示不跟拍）
      if (!plain.isEmpty()) return "[plain]\n" + plain;
    } catch (Exception e) { Log.w(TAG, "lyrics " + title + ": " + e); }
    return "";
  }

  /** 只按主名搜时（requireArtist 非空）要求歌手名对得上，免得拿到同名别人的歌。 */
  static String bestOf(String json, int dur, String requireArtist) throws Exception {
    if (json.isEmpty() || !json.startsWith("[")) return "";
    JSONArray a = new JSONArray(json);
    String best = ""; double bestD = 1e9;
    for (int i = 0; i < a.length(); i++) {
      JSONObject x = a.getJSONObject(i);
      String lrc = x.optString("syncedLyrics", "");
      if (lrc.isEmpty() || "null".equals(lrc)) continue;
      if (requireArtist != null && !x.optString("artistName").toLowerCase().contains(requireArtist.toLowerCase())) continue;
      double d = dur > 0 ? Math.abs(x.optDouble("duration", 0) - dur) : 0;
      if (dur > 0 && d > 8) continue;                    // 时长差太多多半不是这一版
      if (d < bestD) { bestD = d; best = lrc; }
    }
    return best;
  }

  static String plainOf(String json, int dur, String requireArtist) throws Exception {
    if (json.isEmpty() || !json.startsWith("[")) return "";
    JSONArray a = new JSONArray(json);
    for (int i = 0; i < a.length(); i++) {
      JSONObject x = a.getJSONObject(i);
      String t = x.optString("plainLyrics", "");
      if (t.isEmpty() || "null".equals(t)) continue;
      if (requireArtist != null && !x.optString("artistName").toLowerCase().contains(requireArtist.toLowerCase())) continue;
      if (dur > 0 && Math.abs(x.optDouble("duration", 0) - dur) > 8) continue;
      return t;
    }
    return "";
  }

  static String synced(String json) throws Exception {
    if (json.isEmpty() || !json.startsWith("{")) return "";
    String s = new JSONObject(json).optString("syncedLyrics", "");
    return "null".equals(s) ? "" : s;
  }

  static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8"); }

  static String get(String url) {
    HttpURLConnection h = null;
    try {
      h = (HttpURLConnection) new URL(url).openConnection();
      h.setConnectTimeout(6000); h.setReadTimeout(8000);
      h.setRequestProperty("User-Agent", "AgentDeck/1.4 (duo-ime)");
      if (h.getResponseCode() != 200) return "";
      try (InputStream in = h.getInputStream()) {
        ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        return o.toString("UTF-8");
      }
    } catch (Exception e) { Log.w(TAG, "GET " + e); return ""; }
    finally { if (h != null) h.disconnect(); }
  }
}
