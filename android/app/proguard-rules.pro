# صندوق تحصيل الزكاة — قواعد ProGuard (التصغير معطل حالياً)
-keep class com.yemencoding.zakatfund.MainActivity$Bridge { *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
