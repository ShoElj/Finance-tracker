package com.shoelj.expenseoverview;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Telephony;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.regex.Pattern;

/**
 * Captures transaction notifications from banking apps (OPay, GTWorld, FirstMobile, Providus...).
 * Only apps whose package or name looks like a bank or wallet are considered, so chats are never read.
 */
public class BankNotificationListener extends NotificationListenerService {

    private static final Pattern FINANCE_APP = Pattern.compile(
        "opay|gtbank|gtworld|firstbank|firstmobile|\\bfbn|providus|kuda|moniepoint|palmpay|access|zenith|\\buba\\b|fcmb|sterling|wema|alat|fidelity|unionbank|stanbic|ecobank|paga|carbon|fairmoney|bank",
        Pattern.CASE_INSENSITIVE
    );

    @Override
    public void onNotificationPosted(StatusBarNotification notification) {
        String packageName = notification.getPackageName();
        if (packageName == null || packageName.equals(getPackageName())) return;
        // Bank SMS are already captured by SmsReceiver; skip the SMS app's copy of them.
        if (packageName.equals(Telephony.Sms.getDefaultSmsPackage(this))) return;

        Notification content = notification.getNotification();
        if ((content.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

        String appName = appLabel(packageName);
        if (!FINANCE_APP.matcher(packageName + " " + appName).find()) return;

        Bundle extras = content.extras;
        String title = text(extras, Notification.EXTRA_TITLE);
        String body = text(extras, Notification.EXTRA_BIG_TEXT);
        if (body.isEmpty()) body = text(extras, Notification.EXTRA_TEXT);
        if (!AlertStore.looksLikeTransaction(title + "\n" + body)) return;

        AlertStore.add(this, AlertStore.build("notification", "", appName, packageName, title, body, notification.getPostTime()));
    }

    private String appLabel(String packageName) {
        try {
            PackageManager manager = getPackageManager();
            ApplicationInfo info = manager.getApplicationInfo(packageName, 0);
            return manager.getApplicationLabel(info).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return "";
        }
    }

    private static String text(Bundle extras, String key) {
        CharSequence value = extras == null ? null : extras.getCharSequence(key);
        return value == null ? "" : value.toString();
    }
}
