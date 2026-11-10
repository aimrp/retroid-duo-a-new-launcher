# 打包配置说明（给 AI 编程助手看的）

> 用户想在自己电脑上打包 Agent Deck、装到掌机时，把这份文档交给你（Claude Code 等 agent）。
> 请**按顺序**执行下面的步骤。凡是标了「问用户」的地方必须问，不要自己编值；
> 其余能自己检查、自己装的就自己做，做完一步告诉用户一声。

## 0. 两条红线

1. **个人配置只写进 `config.local.json`**（已在 `.gitignore` 里）。不要把 Key、称呼、证书密码写进任何会入库的文件，不要提交 `config.local.json`、`simulator/secrets.local.js`、`*.keystore`。
2. **打出来的 APK 里含有用户的 API Key**，只给用户自己的设备装。不要上传、不要放进 release。要发布公开 APK，就用不含 `api_key` 的配置重新打一次。

开始前先确认仓库在**纯英文路径**下（Windows 上 aapt2 读不了含中文的路径）。不是的话请用户挪一下。

## 1. 检查工具链

打包需要：

| 工具 | 要求 | 怎么检查 |
| --- | --- | --- |
| Bash | Windows 用 Git Bash；macOS / Linux 自带 | `bash --version` |
| JDK | 17 | `$JAVA_HOME/bin/javac -version` |
| Android SDK | `platforms;android-35` 和 `build-tools;35.x` | 看 `$ANDROID_HOME/platforms/android-35/android.jar`、`$ANDROID_HOME/build-tools/35.*` 是否存在 |
| Python | 3.x | `python3 --version` 或 `python --version` |
| adb | platform-tools | `adb version` |

缺什么就装什么（装之前告诉用户要装什么、装到哪）。没有 Android Studio 也行：下载 command-line tools，用 `sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"` 装齐。

`build.sh` 找工具链的顺序：
- JDK：环境变量 `JAVA_HOME` → `config.local.json` 的 `java_home` → `tools/toolchain/jdk/jdk-17*`
- SDK：环境变量 `ANDROID_HOME` / `ANDROID_SDK_ROOT` → `config.local.json` 的 `android_sdk` → `tools/toolchain/sdk`

所以环境变量没设也没关系，把路径写进配置就行。

## 2. 生成 config.local.json

```bash
cp config.example.json config.local.json
```

然后逐项填写：

| 字段 | 是否必填 | 说明 | 怎么得到 |
| --- | --- | --- | --- |
| `user_name` | 必填 | 桌面菜单栏问候语里的称呼，如「小明，下午好。」 | **问用户**想被怎么称呼 |
| `device_name` | 必填 | 左上角显示这台设备的名字，如「小明的掌机」；不填就显示默认的「Agent Deck」 | **问用户**这台设备叫什么 |
| `api_key` | 可选 | [硅基流动](https://cloud.siliconflow.cn) 的 API Key，语音输入用。留空则语音输入不可用，键盘打字不受影响；装好后也可以在设置页里再填 | **问用户**有没有 Key、要不要开语音输入。用户把 Key 发给你后直接写进文件，**不要在回复里复述 Key** |
| `asr_model` | 可选 | 语音识别模型，默认 `Qwen/Qwen3-ASR-1.7B` | 一般不改 |
| `refine_model` | 可选 | 识别后整理文字的模型，默认 `Qwen/Qwen3.5-9B` | 一般不改 |
| `android_sdk` | 可选 | SDK 目录。已设 `ANDROID_HOME` 就留空 | 第 1 步查到的路径 |
| `java_home` | 可选 | JDK 17 目录。已设 `JAVA_HOME` 就留空 | 第 1 步查到的路径 |
| `keystore` | 可选 | 签名证书路径。留空则自动生成 `android/debug.keystore` 调试证书 | 用户有自己的证书再填 |
| `keystore_pass` | 填了 keystore 才要 | 证书密码 | **问用户** |
| `keystore_alias` | 填了 keystore 才要 | 证书里的别名 | **问用户** |

只有 `user_name`、`device_name`、`api_key`、`asr_model`、`refine_model` 会被打进 APK（写成 `assets/config.json`）；其余几项只给打包脚本用。

**签名提醒**：以后升级要用**同一个证书**签，否则 `adb install -r` 会因为签名不一致失败，只能先卸载（会丢掉用户词库）。用自动生成的调试证书的话，提醒用户备份好 `android/debug.keystore`。

（可选）用户想在电脑上用键盘模拟器试语音：

```bash
cp simulator/secrets.example.js simulator/secrets.local.js   # 然后把 Key 填进 siliconflowKey
```

## 3. 打包

```bash
bash android/build.sh
```

成功的标志是最后一行列出 `android/build/agent-deck.apk`。填了 Key 的话脚本会提示「API Key 已打进 APK」，属于正常。

常见失败：
- `找不到 JDK 17` / `找不到 .../android.jar` / `找不到 build-tools 35.x`：回到第 1 步。
- Windows 上 aapt2 报找不到文件：仓库路径里有中文。
- `找不到 Python 3`：设环境变量 `PYTHON` 指向 Python 3 可执行文件。

## 4. 准备掌机

请用户在掌机上：设置 → 关于 → 连点「版本号」开开发者选项 → 打开「USB 调试」→ 用数据线连电脑 → 掌机上点「允许」。然后 `adb devices` 能看到设备。

> 掌机重启后可能弹「USB 的用途」对话框，会挡住上屏，请用户点「取消」。

## 5. 装到掌机上并授权

```bash
adb install -r android/build/agent-deck.apk

# 输入法
adb shell ime enable tech.foursee.duoime/.DuoIme
adb shell ime set tech.foursee.duoime/.DuoIme
# 辅助功能（识别上屏在用什么应用、触摸板、控制台按键）
adb shell settings put secure enabled_accessibility_services tech.foursee.duoime/tech.foursee.duoime.DuoAccess
# 通知使用权（只为拿到播放器的媒体会话，转盘和播放页要用）
adb shell cmd notification allow_listener tech.foursee.duoime/tech.foursee.duoime.DuoNotify 0
# 设成默认桌面
adb shell cmd package set-home-activity tech.foursee.duoime/.HomeActivity
# 悬浮窗（键盘显示在下屏要用）、麦克风（语音输入要用）
adb shell appops set tech.foursee.duoime SYSTEM_ALERT_WINDOW allow
adb shell pm grant tech.foursee.duoime android.permission.RECORD_AUDIO
```

如果 `settings put secure enabled_accessibility_services` 覆盖掉了用户原来开着的其他辅助功能，先用 `adb shell settings get secure enabled_accessibility_services` 看原值，用冒号把它们拼在一起再写回去。

设置页（不在桌面上显示，用 adb 打开，可以查看各项授权、改 Key、管理词库）：

```bash
adb shell am start -n tech.foursee.duoime/.SettingsActivity
```

## 6. 确认装好了

等 10 秒左右，然后：

```bash
adb shell dumpsys activity activities | grep topResumed
```

应该看到上屏是 `tech.foursee.duoime/.HomeActivity`、下屏是 `tech.foursee.duoime/.LauncherActivity`。下屏还是系统自带的副屏桌面的话：

```bash
adb shell am start --display 2 -n tech.foursee.duoime/.LauncherActivity
```

请用户看一眼：上屏是老 Mac 风格的桌面，下屏是「控制台」和触摸板；点任意输入框，下屏出现键盘。

## 7. 以后升级

拉新代码后重复第 3 步和 `adb install -r`。重装后系统可能再弹「选择桌面」、下屏短暂被系统副屏桌面占住，重新执行第 5 步里 `ime set`、`allow_listener`、`set-home-activity` 三条，再按第 6 步确认。

## 8. 游戏「进击的NPC」——独立 APK

仓库里还有一个上下双屏的横版小游戏「进击的NPC」：上屏是游戏画面，下屏是指挥台。它**不是** Agent Deck 的一部分，而是一个单独的 APK（包名 `tech.foursee.stophero`），要**单独打包、单独装**。装好之后，Agent Deck 的桌面会自动把它列出来（小乌龟图标），点开就能玩，不需要额外配置。

源码在 `game/`：`game/web/` 是游戏页面（上屏 `top.html`、下屏 `bottom.html`，以及 `js/`、`audio/`），`game/apk/` 是 Android 壳（`AndroidManifest.xml`、`src/`、`res/`、`build.sh`）。

**依赖**：和 Agent Deck 用同一套工具链（JDK 17 + Android SDK `platforms;android-35` + `build-tools;35.x`，见第 1 节）。它**不需要** `config.local.json`，也**不需要** API Key。

**打包**：

```bash
bash game/apk/build.sh
```

成功标志：最后一行列出 `game/apk/build/stophero.apk`。

**安装**：

```bash
adb install -r game/apk/build/stophero.apk
```

装上后回 Agent Deck 桌面刷新一下（装卸应用会自动刷新）就能看到「进击的NPC」。签名用的是游戏自己的调试证书 `game/apk/debug.keystore`（不入库），和 Agent Deck 的证书互相独立、不冲突。
