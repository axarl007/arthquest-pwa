package com.arthquest.pwa

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Home-screen widget (ticket #32): a single "+" tap target that launches MainActivity via the
 * quick-add deep link (see AndroidManifest.xml's intent-filter and
 * src/native/useQuickAddDeepLink.js) so the app opens straight to the Log Transaction sheet
 * instead of the app's normal Home tab. No RemoteViews can host the WebView/React UI directly —
 * this widget only ever launches the real app, it never writes a transaction itself.
 */
class AddTransactionWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            val launchIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("${context.getString(R.string.custom_url_scheme)}://add-transaction"),
            ).apply {
                setPackage(context.packageName)
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val views = RemoteViews(context.packageName, R.layout.widget_add_transaction)
            views.setOnClickPendingIntent(R.id.widget_add_transaction_root, pendingIntent)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
