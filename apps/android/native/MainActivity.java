package ru.starcrm.eclipsechat;

import android.app.DownloadManager;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.URLUtil;

import com.getcapacitor.BridgeActivity;

/**
 * Кастомный MainActivity (копируется поверх сгенерированного `cap add`
 * в CI — см. android-release.yml). Добавляет к remote-load обёртке:
 *   1) тёмный статус-бар в тон приложению (светлые иконки);
 *   2) DownloadListener — скачивание файлов из WebView (вложения, .apk)
 *      через системный DownloadManager. Без него в Capacitor-WebView
 *      загрузки молча не работают.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1) Статус-бар: тёмный фон + светлые иконки (тон приложения).
        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#05070a"));
        View decor = window.getDecorView();
        decor.setSystemUiVisibility(
            decor.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        );

        // 2) Скачивание файлов из WebView через системный DownloadManager.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setDownloadListener(
                (url, userAgent, contentDisposition, mimetype, contentLength) -> {
                    try {
                        DownloadManager.Request request =
                            new DownloadManager.Request(Uri.parse(url));
                        request.setMimeType(mimetype);
                        String cookies = CookieManager.getInstance().getCookie(url);
                        if (cookies != null) {
                            request.addRequestHeader("cookie", cookies);
                        }
                        if (userAgent != null) {
                            request.addRequestHeader("User-Agent", userAgent);
                        }
                        String fileName =
                            URLUtil.guessFileName(url, contentDisposition, mimetype);
                        request.setTitle(fileName);
                        request.setDescription("Загрузка…");
                        request.allowScanningByMediaScanner();
                        request.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        request.setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS, fileName);
                        DownloadManager dm = (DownloadManager)
                            getSystemService(Context.DOWNLOAD_SERVICE);
                        if (dm != null) {
                            dm.enqueue(request);
                        }
                    } catch (Exception ignored) {
                        // best-effort: не валим приложение из-за загрузки
                    }
                }
            );
        }
    }
}
