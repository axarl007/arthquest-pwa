package com.arthquest.pwa;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // NearbySync (ticket #18) is a local, non-npm plugin, so it isn't auto-discovered the way an
    // installed Capacitor plugin package would be — it must be registered explicitly, and before
    // super.onCreate() so it's present when the bridge is built.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NearbySyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
