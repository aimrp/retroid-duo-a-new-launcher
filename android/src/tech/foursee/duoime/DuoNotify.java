package tech.foursee.duoime;

import android.service.notification.NotificationListenerService;

/**
 * 空的通知监听服务：不读任何通知，只是为了拿到"媒体会话"列表的权限，
 * 这样下屏的播放键能直接发给上屏正在用的那个播放器（而不是系统记住的上一个播放器）。
 * 授权：adb shell cmd notification allow_listener tech.foursee.duoime/tech.foursee.duoime.DuoNotify
 */
public class DuoNotify extends NotificationListenerService { }
