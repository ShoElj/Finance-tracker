package com.shoelj.expenseoverview;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/** Captures incoming bank SMS alerts, including while the app is closed. */
public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;

        // Long alerts arrive in several parts from the same sender.
        String sender = parts[0].getDisplayOriginatingAddress();
        StringBuilder body = new StringBuilder();
        for (SmsMessage part : parts) body.append(part.getDisplayMessageBody());

        String text = body.toString();
        if (isFromBank(sender, text)) {
            AlertStore.add(context, AlertStore.build("sms", sender, "", "", "", text, parts[0].getTimestampMillis()));
        }
    }

    /** Banks send from named senders (e.g. "GTBank"); messages from phone numbers are only kept if they look like account alerts. */
    static boolean isFromBank(String sender, String body) {
        if (!AlertStore.looksLikeTransaction(body)) return false;
        boolean namedSender = sender != null && sender.matches(".*[A-Za-z].*");
        return namedSender || body.matches("(?is).*(acct|a/c|bal).*");
    }
}
