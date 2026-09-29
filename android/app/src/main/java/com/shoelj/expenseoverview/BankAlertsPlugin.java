package com.shoelj.expenseoverview;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.provider.Telephony;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONException;

/** Bridge between the web app and the SMS / notification capture. */
@CapacitorPlugin(
    name = "BankAlerts",
    permissions = { @Permission(alias = "sms", strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }) }
)
public class BankAlertsPlugin extends Plugin {

    private static final int MAX_INBOX_MESSAGES = 1000;
    private static volatile BankAlertsPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /** Lets the web app know new alerts are waiting while it is open. */
    static void onNewAlert() {
        BankAlertsPlugin plugin = instance;
        if (plugin != null) plugin.notifyListeners("alert", new JSObject());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void requestSms(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            call.resolve(status());
        } else {
            requestPermissionForAlias("sms", call, "smsPermissionResult");
        }
    }

    @PermissionCallback
    private void smsPermissionResult(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Context context = getContext();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            intent.putExtra(
                Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                new ComponentName(context, BankNotificationListener.class).flattenToString()
            );
        } else {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        startSettings(intent, new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        call.resolve();
    }

    /** App info screen, where Android's "Allow restricted settings" option lives for sideloaded apps. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        startSettings(intent, new Intent(Settings.ACTION_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void takePending(PluginCall call) {
        call.resolve(alerts(AlertStore.take(getContext())));
    }

    /** Reads bank alerts already in the SMS inbox from the last `days` days. */
    @PluginMethod
    public void readInbox(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS permission not granted");
            return;
        }

        long since = System.currentTimeMillis() - call.getInt("days", 30) * 24L * 60 * 60 * 1000;
        String[] projection = { Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE };
        JSONArray found = new JSONArray();

        try (
            Cursor cursor = getContext()
                .getContentResolver()
                .query(Telephony.Sms.Inbox.CONTENT_URI, projection, Telephony.Sms.DATE + " > ?", new String[] { String.valueOf(since) }, Telephony.Sms.DATE + " DESC")
        ) {
            if (cursor != null) {
                int scanned = 0;
                while (cursor.moveToNext() && scanned++ < MAX_INBOX_MESSAGES) {
                    String sender = cursor.getString(0);
                    String body = cursor.getString(1);
                    if (SmsReceiver.isFromBank(sender, body)) {
                        found.put(AlertStore.build("sms", sender, "", "", "", body, cursor.getLong(2)));
                    }
                }
            }
        } catch (Exception e) {
            call.reject("Could not read SMS inbox", e);
            return;
        }

        call.resolve(alerts(found));
    }

    private JSObject status() {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("sms", getPermissionState("sms") == PermissionState.GRANTED);
        result.put("notifications", NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName()));
        return result;
    }

    private void startSettings(Intent intent, Intent fallback) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
        }
    }

    private static JSObject alerts(JSONArray list) {
        JSObject result = new JSObject();
        try {
            result.put("alerts", new JSArray(list.toString()));
        } catch (JSONException e) {
            result.put("alerts", new JSArray());
        }
        return result;
    }
}
