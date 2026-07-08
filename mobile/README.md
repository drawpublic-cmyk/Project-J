# 존급 모바일 (Capacitor)

Vercel 배포본(`https://project-j-phi.vercel.app`)을 **네이티브 WebView**로 감싸 안드로이드 앱으로 실행/출시합니다.
브라우저 주소창 없이 전체화면으로 뜨고, 카카오 도메인·`/api/proxy`가 그대로 동작합니다.
Vercel에 배포하면 앱도 자동으로 최신이 됩니다(원격 URL 로드 방식).

## 준비물
- Node.js 18+
- Android Studio (+ Android SDK)
- JDK 17

## 최초 셋업
```bash
cd mobile
npm install
npx cap add android      # android/ 네이티브 프로젝트 생성 (gitignore됨)
npx cap sync
npx cap open android     # Android Studio 열림 → 상단 ▶ Run 으로 에뮬레이터/실기기 실행
```

## 코드/설정 바꾼 뒤
```bash
npx cap sync             # capacitor.config.json 등 변경 반영
```
> 웹 콘텐츠 자체는 Vercel에서 로드하므로, 화면 수정은 index.html 배포만 하면 앱에 바로 반영됩니다.

## AdMob 붙일 때 (나중에)
```bash
npm i @capacitor-community/admob
npx cap sync
```
- `android/app/src/main/AndroidManifest.xml` 에 AdMob App ID `<meta-data>` 추가
- 앱 시작 시 `AdMob.initialize()` 후 배너/전면 광고 호출
- Play 콘솔 등록 + 개인정보처리방침 URL 필수

## 참고
- `appId`(com.jongeup.app)는 Play 출시 시 고유해야 하니 실제 도메인 기반으로 바꾸세요.
- 앱 아이콘/스플래시는 `store-icon.html` 로 만든 이미지를 Android Studio 리소스로 넣으면 됩니다.
