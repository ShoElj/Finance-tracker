package com.shoelj.expenseoverview;

import android.content.Context;
import android.content.SharedPreferences;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Holds bank alerts captured while the app is closed until the web app collects them.
 * Everything stays on the device in the app's private storage.
 */
final class AlertStore {

    private static final String PREFS = "bank_alerts";
    private static final String KEY_PENDING = "pending";
    private static final int MAX_PENDING = 300;

    private static final Pattern MONEY = Pattern.compile("(NGN|₦|\\bN(?=\\s?\\d))\\s?\\d", Pattern.CASE_INSENSITIVE);
    private static final Pattern TRANSACTION = Pattern.compile(
        "debit|\\bDR\\b|withdraw|transfer|\\bsent\\b|\\bpaid\\b|payment|purchase|charged|credit|\\bCR\\b|received",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern OTP = Pattern.compile("\\botp\\b|one[- ]time|password", Pattern.CASE_INSENSITIVE);

    private AlertStore() {}

    /** Cheap first pass so only messages that look like money movements are kept; the web app parses them properly. */
    static boolean looksLikeTransaction(String text) {
        if (text == null) return false;
        return MONEY.matcher(text).find() && TRANSACTION.matcher(text).find() && !OTP.matcher(text).find();
    }

    static JSONObject build(String source, String sender, String app, String packageName, String title, String body, long timestamp) {
        JSONObject alert = new JSONObject();
        try {
            alert.put("id", source + ":" + hash(sender + "|" + packageName + "|" + title + "|" + body));
            alert.put("source", source);
            alert.put("sender", sender == null ? "" : sender);
            alert.put("app", app == null ? "" : app);
            alert.put("packageName", packageName == null ? "" : packageName);
            alert.put("title", title == null ? "" : title);
            alert.put("body", body == null ? "" : body);
            alert.put("timestamp", timestamp);
        } catch (JSONException ignored) {}
        return alert;
    }

    static synchronized void add(Context context, JSONObject alert) {
        JSONArray pending = read(context);
        String id = alert.optString("id");
        for (int i = 0; i < pending.length(); i++) {
            if (id.equals(pending.optJSONObject(i).optString("id"))) return;
        }
        pending.put(alert);

        JSONArray trimmed = new JSONArray();
        for (int i = Math.max(0, pending.length() - MAX_PENDING); i < pending.length(); i++) trimmed.put(pending.opt(i));
        write(context, trimmed);
        BankAlertsPlugin.onNewAlert();
    }

    static synchronized JSONArray take(Context context) {
        JSONArray pending = read(context);
        write(context, new JSONArray());
        return pending;
    }

    private static JSONArray read(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_PENDING, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void write(Context context, JSONArray pending) {
        prefs(context).edit().putString(KEY_PENDING, pending.toString()).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-1").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 10; i++) hex.append(String.format("%02x", digest[i]));
            return hex.toString();
        } catch (Exception e) {
            return Integer.toHexString(value.hashCode());
        }
    }
}
