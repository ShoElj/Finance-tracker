package com.shoelj.expenseoverview;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BankAlertsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
