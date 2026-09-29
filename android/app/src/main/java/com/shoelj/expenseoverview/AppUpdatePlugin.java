package com.shoelj.expenseoverview;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Downloads a newer APK of this app and hands it to Android's installer.
 * Android only accepts it as an update if it is signed with the same key, so a tampered file cannot replace the app.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String ALLOWED_PREFIX = "https://github.com/ShoElj/Finance-tracker/releases/download/";

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            Context context = getContext();
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
            JSObject result = new JSObject();
            result.put("versionCode", code);
            result.put("versionName", info.versionName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read app version", e);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith(ALLOWED_PREFIX)) {
            call.reject("Unexpected update address");
            return;
        }

        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(settings);
            call.reject("Allow installing updates for this app, then try again", "INSTALL_PERMISSION");
            return;
        }

        File folder = new File(context.getCacheDir(), "updates");
        File apk = new File(folder, "expense-overview.apk");
        try {
            if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("Could not create update folder");
            download(url, apk);
        } catch (Exception e) {
            call.reject("Download failed. Check your connection and try again.", "DOWNLOAD_FAILED", e);
            return;
        }

        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(install);
        call.resolve();
    }

    private void download(String address, File target) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
            throw new IllegalStateException("HTTP " + connection.getResponseCode());
        }

        long total = connection.getContentLengthLong();
        long received = 0;
        int lastPercent = -1;
        byte[] buffer = new byte[64 * 1024];
        try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(target)) {
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                received += read;
                int percent = total > 0 ? (int) (received * 100 / total) : -1;
                if (percent != lastPercent && percent % 5 == 0) {
                    lastPercent = percent;
                    JSObject progress = new JSObject();
                    progress.put("percent", percent);
                    notifyListeners("progress", progress);
                }
            }
        } finally {
            connection.disconnect();
        }
    }
}
