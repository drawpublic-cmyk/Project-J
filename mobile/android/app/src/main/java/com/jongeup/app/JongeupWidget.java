package com.jongeup.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/** 홈 화면 위젯: 버튼마다 jongeup://go/<종류> 로 앱을 열면 웹이 가장 가까운 곳 길안내를 시작함 */
public class JongeupWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_jongeup);
        views.setOnClickPendingIntent(R.id.btn_toilet, open(context, "toilet", 1));
        views.setOnClickPendingIntent(R.id.btn_print, open(context, "print", 2));
        views.setOnClickPendingIntent(R.id.btn_store, open(context, "store", 3));
        for (int id : widgetIds) manager.updateAppWidget(id, views);
    }

    private static PendingIntent open(Context context, String kind, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("jongeup://go/" + kind), context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
