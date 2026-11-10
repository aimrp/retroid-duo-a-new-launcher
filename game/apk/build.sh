#!/bin/bash
# Build STOP game APK without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner
set -e
cd "$(dirname "$0")"
T=../../tools/toolchain; BT=$T/sdk/build-tools/35.0.0; JAR=$T/sdk/platforms/android-35/android.jar
export JAVA_HOME="$(cygpath -w "$(cd $T/jdk/jdk-17* && pwd)")"; J="$(cygpath -u "$JAVA_HOME")/bin"
PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  for c in python3 python /c/Python312/python.exe; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -I -c "import json" >/dev/null 2>&1; then PY="$c"; break; fi
  done
fi
[ -n "$PY" ] || { echo "找不到 Python 3（可用环境变量 PYTHON 指定）"; exit 1; }
rm -rf build && mkdir -p build/classes build/dex build/assets/web
# 掌机页面打包进 APK（与电脑端同一份源码）
cp ../web/top.html ../web/bottom.html build/assets/web/ && cp -r ../web/js build/assets/web/ && (ls ../web/audio/ending.* >/dev/null 2>&1 && mkdir -p build/assets/web/audio && cp ../web/audio/ending.* build/assets/web/audio/ || true)
$BT/aapt2.exe compile --dir res -o build/res.zip
$BT/aapt2.exe link -o build/base.apk -I $JAR --manifest AndroidManifest.xml -A build/assets build/res.zip
"$J/javac" -encoding UTF-8 -source 17 -target 17 -classpath $JAR -d build/classes $(find src -name '*.java')
(cd build/classes && "$J/jar" cf ../classes.jar .)
cmd //c "$(cygpath -w $BT/d8.bat) --min-api 29 --lib $(cygpath -w $JAR) --output build\\dex build\\classes.jar"
"$PY" -I -c "import shutil,zipfile;shutil.copy('build/base.apk','build/unsigned.apk');zipfile.ZipFile('build/unsigned.apk','a').write('build/dex/classes.dex','classes.dex')"
$BT/zipalign.exe -f 4 build/unsigned.apk build/aligned.apk
[ -f debug.keystore ] || "$J/keytool" -genkeypair -keystore debug.keystore -storepass android -keypass android -alias debug -keyalg RSA -validity 10000 -dname "CN=StopGame" >/dev/null 2>&1
cmd //c "$(cygpath -w $BT/apksigner.bat) sign --ks debug.keystore --ks-pass pass:android --out build\\stophero.apk build\\aligned.apk"
ls -la build/stophero.apk
