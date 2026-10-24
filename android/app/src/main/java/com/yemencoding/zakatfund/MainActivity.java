package com.yemencoding.zakatfund;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * صندوق تحصيل الزكاة — النشاط الرئيسي
 * WebView + WebViewAssetLoader (origin آمن) + جسور: بلوتوث ESC/POS، نسخ احتياطي، طباعة
 * تطوير وبرمجة مازن عبدالوهاب — إدارة محاسبة صدام نجم الدين — yemen coding
 */
public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/index.html";
    private static final int REQ_BT = 51, REQ_FILE_OPEN = 52;

    private WebView webView;
    private final Handler ui = new Handler(Looper.getMainLooper());

    /* ====== جسر البلوتوث (ESC/POS) ====== */
    private BluetoothSocket btSocket;
    private OutputStream btOut;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override public void run() { request.grant(request.getResources()); }
                });
            }
        });

        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        webView.loadUrl(START_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    /* =============== الجسر الموحد =============== */
    private class Bridge {

        /* ---- منصة ---- */
        @JavascriptInterface
        public String platform() { return "android"; }
        @JavascriptInterface
        public String appVersion() { return "1.0.0"; }

        /* ---- الطباعة A4 عبر مدير الطباعة (تشمل «حفظ كـ PDF») ---- */
        @JavascriptInterface
        public void printPage() {
            ui.post(new Runnable() {
                @Override public void run() {
                    try {
                        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                        PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("zakat-report");
                        PrintAttributes attrs = new PrintAttributes.Builder()
                                .setMediaSize(new PrintAttributes.MediaSize("ISO_A4", "android", 21000, 29700))
                                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                .build();
                        pm.print("صندوق تحصيل الزكاة", adapter, attrs);
                    } catch (Exception ignored) {}
                }
            });
        }

        /* ---- صلاحيات البلوتوث (Android 12+: BLUETOOTH_CONNECT) ---- */
        @JavascriptInterface
        public boolean ensureBluetoothPermission() {
            if (Build.VERSION.SDK_INT >= 31) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT)
                        == PackageManager.PERMISSION_GRANTED) return true;
                ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{Manifest.permission.BLUETOOTH_CONNECT}, REQ_BT);
                return false;
            }
            /* Android 9–11: الموقع الدقيق شرط لاكتشاف البلوتوث في بعض الأجهزة */
            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, REQ_BT);
                return false;
            }
            return true;
        }

        /* ---- الطابعات المقترنة ---- */
        @JavascriptInterface
        public String listBondedPrinters() {
            JSONArray arr = new JSONArray();
            try {
                BluetoothManager bm = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
                BluetoothAdapter ad = bm == null ? null : bm.getAdapter();
                if (ad != null && Build.VERSION.SDK_INT >= 31
                        && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT)
                        != PackageManager.PERMISSION_GRANTED) {
                    return "[]";
                }
                if (ad != null) {
                    Set<BluetoothDevice> devs = ad.getBondedDevices();
                    if (devs != null) {
                        for (BluetoothDevice d : devs) {
                            JSONObject o = new JSONObject();
                            o.put("name", d.getName() == null ? "جهاز بلوتوث" : d.getName());
                            o.put("address", d.getAddress());
                            arr.put(o);
                        }
                    }
                }
            } catch (Exception ignored) {}
            return arr.toString();
        }

        @JavascriptInterface
        public boolean connectPrinter(final String address) {
            closeSocket();
            return connectSpp(address);
        }

        @JavascriptInterface
        public void disconnectPrinter() { closeSocket(); }

        /* ---- إرسال بايتات ESC/POS (base64) ---- */
        @JavascriptInterface
        public boolean printBytes(String b64) {
            try {
                if (btOut == null) return false;
                byte[] data = Base64.decode(b64, Base64.NO_WRAP);
                synchronized (this) {
                    btOut.write(data);
                    btOut.flush();
                }
                return true;
            } catch (Exception e) {
                closeSocket();
                return false;
            }
        }

        /* ---- حفظ النسخة الاحتياطية (MediaStore 29+ / مسار عام 28) ---- */
        @JavascriptInterface
        public boolean saveBackup(String fileName, String content) {
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    cv.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                    cv.put(MediaStore.Downloads.IS_PENDING, 1);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) return false;
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        os.write(content.getBytes("UTF-8"));
                    }
                    cv.clear();
                    cv.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(uri, cv, null, null);
                    return true;
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, fileName);
                    try (FileOutputStream fo = new FileOutputStream(f)) {
                        fo.write(content.getBytes("UTF-8"));
                    }
                    return true;
                }
            } catch (Exception e) {
                return false;
            }
        }

        /* ---- اختيار ملف نسخة احتياطية (SAF) ---- */
        @JavascriptInterface
        public boolean pickBackupFile() {
            try {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                startActivityForResult(i, REQ_FILE_OPEN);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    /* ====== نتيجة اختيار الملف → JS ====== */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_OPEN && resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
            try {
                InputStream is = getContentResolver().openInputStream(data.getData());
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
                is.close();
                String b64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                final String js = "window.__onFilePicked && window.__onFilePicked('" + b64 + "','backup.json')";
                ui.post(new Runnable() {
                    @Override public void run() { webView.evaluateJavascript(js, null); }
                });
            } catch (Exception e) {
                ui.post(new Runnable() {
                    @Override public void run() {
                        webView.evaluateJavascript("window.__onFilePicked && window.__onFilePicked(null,null)", null);
                    }
                });
            }
        } else if (requestCode == REQ_FILE_OPEN) {
            ui.post(new Runnable() {
                @Override public void run() {
                    webView.evaluateJavascript("window.__onFilePicked && window.__onFilePicked(null,null)", null);
                }
            });
        }
    }

    /* ====== اتصال الطابعة SPP ====== */
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private boolean connectSpp(String address) {
        try {
            BluetoothManager bm = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
            BluetoothAdapter ad = bm == null ? null : bm.getAdapter();
            if (ad == null || address == null) return false;
            final BluetoothDevice dev = ad.getRemoteDevice(address);
            final BluetoothSocket[] sockBox = new BluetoothSocket[1];
            Thread t = new Thread(new Runnable() {
                @Override public void run() {
                    try {
                        BluetoothSocket s = dev.createRfcommSocketToServiceRecord(SPP_UUID);
                        s.connect();
                        sockBox[0] = s;
                    } catch (Exception e) {
                        /* مسار احتياطي: قناة RFCOMM القياسية 1 */
                        try {
                            BluetoothSocket s = (BluetoothSocket) dev.getClass()
                                    .getMethod("createRfcommSocket", int.class).invoke(dev, 1);
                            s.connect();
                            sockBox[0] = s;
                        } catch (Exception ignored) {}
                    }
                }
            });
            t.start();
            t.join(8000);
            if (sockBox[0] != null && sockBox[0].isConnected()) {
                btSocket = sockBox[0];
                btOut = btSocket.getOutputStream();
                return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private void closeSocket() {
        try { if (btOut != null) btOut.close(); } catch (Exception ignored) {}
        try { if (btSocket != null) btSocket.close(); } catch (Exception ignored) {}
        btOut = null; btSocket = null;
    }

    @Override
    protected void onDestroy() {
        closeSocket();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
