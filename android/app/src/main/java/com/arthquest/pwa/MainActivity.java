package com.arthquest.pwa;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // NearbySync (ticket #18) is a local, non-npm plugin, so it isn't auto-discovered the way an
    // installed Capacitor plugin package would be — it must be registered explicitly, and before
    // super.onCreate() so it's present when the bridge is built.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Recreated from saved state (e.g. after process death): the launch intent, if it was a
        // statement share (ticket #40), was already delivered by the previous instance — mark it
        // so StatementSharePlugin.load() doesn't open the same import review again.
        if (savedInstanceState != null) {
            getIntent().putExtra(StatementSharePluginKt.EXTRA_STATEMENT_SHARE_CONSUMED, true);
        }
        registerPlugin(NearbySyncPlugin.class);
        // Statement files shared in from Android's share sheet (ticket #40) — local too.
        registerPlugin(StatementSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
