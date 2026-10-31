# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---- 존급: R8 난독화 시 웹(JS)에서 이름으로 호출되는 플러그인 코드는 이름 유지 ----
# Capacitor 코어 규칙(consumer rules)이 @CapacitorPlugin 클래스/메서드는 지켜주지만,
# 플러그인 내부에서 리플렉션·JSON 매핑으로 쓰는 모델 클래스까지 안전하게 보존.
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.community.admob.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class nl.raphael.settings.** { *; }
-keep class io.ionic.libs.** { *; }
# WebView JS 브리지
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
