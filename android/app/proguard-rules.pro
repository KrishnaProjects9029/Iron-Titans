# Iron Titans Proguard release rules
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.irontitans.mecharena.** { *; }
