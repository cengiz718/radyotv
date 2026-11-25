package com.radyokutu.tv;

import android.app.Activity;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Radyo Kutu: sunucudaki web uygulamasını tam ekran bir WebView içinde açar.
 * Mi Box (Android TV) kumandası (D-Pad) web uygulamasına doğrudan iletilir.
 */
public class MainActivity extends Activity {

    // Build sırasında SERVER_URL ortam değişkeniyle değiştirilir.
    private static final String SERVER_URL = "__SERVER_URL__";

    private static final int FEATURE_NO_TITLE = 1;
    private static final int FLAG_FULLSCREEN = 0x400;
    private static final int FLAG_KEEP_SCREEN_ON = 0x80;

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(FEATURE_NO_TITLE);

        Window window = getWindow();
        window.setFlags(FLAG_FULLSCREEN | FLAG_KEEP_SCREEN_ON, FLAG_FULLSCREEN | FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);

        // D-Pad ile odaklanabilmek için
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        // Bağlantılar uygulama içinde açılsın
        webView.setWebViewClient(new WebViewClient());

        setContentView(webView);
        webView.loadUrl(SERVER_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
