#!/usr/bin/env bash
# 不用 Gradle 打 Agent Deck 的 APK：aapt2 -> javac -> d8 -> zipalign -> apksigner
#
#   bash android/build.sh          产物：android/build/agent-deck.apk
#
# 需要：JDK 17、Android SDK（platforms;android-35 + build-tools 35.x）、Python 3。
# 工具链按顺序找（找到第一个就用）：
#   JDK ：环境变量 JAVA_HOME → config.local.json 的 java_home → $DUO_TOOLS/jdk/jdk-17*
#   SDK ：环境变量 ANDROID_HOME / ANDROID_SDK_ROOT → config.local.json 的 android_sdk → $DUO_TOOLS/sdk
#   （DUO_TOOLS 默认 tools/toolchain，可以是一个目录联接/软链。）
# 个人配置（称呼、语音 API Key 等）在仓库根目录的 config.local.json（不入库），
# 说明见 docs/BUILD_CONFIG.md。没有这个文件也能打包，只是没有默认 Key 和称呼。
# 注意：Windows 上 aapt2 读不了含中文的路径，仓库请放在纯英文路径下。
set -e
cd "$(dirname "$0")"
ROOT=..
CFG=$ROOT/config.local.json
OUT=build/agent-deck.apk

case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WIN=1 ;; *) WIN= ;; esac

# ---- Python（拼 APK、读配置都用它）
PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  for c in python3 python /c/Python312/python.exe; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -I -c "import json" >/dev/null 2>&1; then PY="$c"; break; fi
  done
fi
[ -n "$PY" ] || { echo "找不到 Python 3（可用环境变量 PYTHON 指定）"; exit 1; }

cfg() {   # cfg <key>：读 config.local.json 里的一项，没有就是空
  [ -f "$CFG" ] || return 0
  "$PY" -I -c "import json,sys;d=json.load(open(sys.argv[1],encoding='utf-8'));v=d.get(sys.argv[2]);print(v if isinstance(v,str) else '')" "$CFG" "$1"
}
unixpath() { if [ -n "$WIN" ] && [ -n "$1" ]; then cygpath -u "$1"; else printf '%s' "$1"; fi; }

# ---- 工具链
T="${DUO_TOOLS:-../tools/toolchain}"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$(cfg android_sdk)}}"
[ -n "$SDK" ] || SDK="$T/sdk"
SDK="$(unixpath "$SDK")"
JH="${JAVA_HOME:-$(cfg java_home)}"
if [ -z "$JH" ]; then JH="$(cd "$T"/jdk/jdk-17* 2>/dev/null && pwd)"; fi
[ -n "$JH" ] || { echo "找不到 JDK 17：设 JAVA_HOME，或在 config.local.json 里填 java_home"; exit 1; }
J="$(unixpath "$JH")/bin"
if [ -n "$WIN" ]; then export JAVA_HOME="$(cygpath -w "$(unixpath "$JH")")"; else export JAVA_HOME="$JH"; fi

JAR="$SDK/platforms/android-35/android.jar"
[ -f "$JAR" ] || { echo "找不到 $JAR：请在 SDK 里装 platforms;android-35"; exit 1; }
BT="${BUILD_TOOLS:-$(ls -d "$SDK"/build-tools/35* 2>/dev/null | sort | tail -1)}"
[ -n "$BT" ] && [ -d "$BT" ] || { echo "找不到 build-tools 35.x：请在 SDK 里装 build-tools;35.0.0"; exit 1; }
if [ -n "$WIN" ]; then
  AAPT2="$BT/aapt2.exe"; ZIPALIGN="$BT/zipalign.exe"
  d8()        { cmd //c "$(cygpath -w "$BT/d8.bat")" "$@"; }
  apksigner() { cmd //c "$(cygpath -w "$BT/apksigner.bat")" "$@"; }
  wp() { cygpath -w "$1"; }
else
  AAPT2="$BT/aapt2"; ZIPALIGN="$BT/zipalign"
  d8()        { "$BT/d8" "$@"; }
  apksigner() { "$BT/apksigner" "$@"; }
  wp() { printf '%s' "$1"; }
fi

# ---- 资源：键盘界面和模拟器共用 keyboard/ 下的文件
rm -rf build && mkdir -p build/classes build/dex build/assets/web
cp ../keyboard/keyboard.js ../keyboard/keyboard.css ../keyboard/engine.js ../keyboard/voice-siliconflow.js ../keyboard/dict.js \
   web/ime.html web/launcher.html web/home.html web/player.html web/lyric.js web/icons.js web/mochi.png build/assets/web/

# ---- 把 config.local.json 里给 App 用的几项写进 assets/config.json（只挑白名单里的、非空的）
"$PY" -I - "$CFG" build/assets/config.json <<'PYEOF'
import json, os, sys
src, dst = sys.argv[1], sys.argv[2]
APP_KEYS = ("user_name", "device_name", "api_key", "asr_model", "refine_model")
d = json.load(open(src, encoding="utf-8")) if os.path.exists(src) else {}
out = {k: d[k].strip() for k in APP_KEYS if isinstance(d.get(k), str) and d[k].strip()}
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False)
if not os.path.exists(src):
    print("提示：没有 config.local.json，按空配置打包（语音输入要到设置页里填 Key）")
elif out.get("api_key"):
    print("提示：API Key 已打进 APK —— 这个 APK 只给自己装，不要发给别人或传到网上")
PYEOF

# ---- 编译、打包、签名
"$AAPT2" compile --dir res -o build/res.zip
"$AAPT2" link -o build/base.apk -I "$JAR" --manifest AndroidManifest.xml -A build/assets build/res.zip
"$J/javac" -encoding UTF-8 -source 17 -target 17 -nowarn -classpath "$JAR" -d build/classes $(find src -name '*.java')
(cd build/classes && "$J/jar" cf ../classes.jar .)
d8 --min-api 29 --lib "$(wp "$JAR")" --output "$(wp build/dex)" "$(wp build/classes.jar)"
"$PY" -I -c "import shutil,zipfile;shutil.copy('build/base.apk','build/unsigned.apk');zipfile.ZipFile('build/unsigned.apk','a').write('build/dex/classes.dex','classes.dex')"
"$ZIPALIGN" -f 4 build/unsigned.apk build/aligned.apk

# 签名：config.local.json 里配了 keystore 就用它，否则用本地生成的调试证书（android/debug.keystore，不入库）
KS="$(cfg keystore)"; KSPASS="$(cfg keystore_pass)"; KSALIAS="$(cfg keystore_alias)"
if [ -z "$KS" ]; then
  KS=debug.keystore; KSPASS=android; KSALIAS=debug
  [ -f debug.keystore ] || "$J/keytool" -genkeypair -keystore debug.keystore -storepass android -keypass android -alias debug \
    -keyalg RSA -validity 10000 -dname "CN=AgentDeck" >/dev/null 2>&1
fi
apksigner sign --ks "$(wp "$(unixpath "$KS")")" --ks-pass "pass:$KSPASS" ${KSALIAS:+--ks-key-alias "$KSALIAS"} --out "$(wp "$OUT")" "$(wp build/aligned.apk)"
ls -la "$OUT"
