#!/bin/bash
# App Store 제출용 빌드(.ipa) 생성. 사전조건: Xcode → Settings → Accounts 에 Apple ID 로그인.
#   사용: ./archive.sh <TEAM_ID>        (TEAM_ID = developer.apple.com → Membership 의 10자리)
#   결과: build/export/App.ipa → Xcode Organizer 또는 Transporter 앱으로 App Store Connect 업로드
# 매 업로드마다 빌드번호(CURRENT_PROJECT_VERSION)가 달라야 함 → BUILD_NUMBER 환경변수로 지정(기본: 날짜시각)
set -euo pipefail
cd "$(dirname "$0")"
TEAM_ID="${1:?TEAM_ID 필요 (예: ./archive.sh ABCDE12345)}"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"
(cd .. && npx cap sync ios)
rm -rf build
xcodebuild -workspace App/App.xcworkspace -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/App.xcarchive \
  DEVELOPMENT_TEAM="$TEAM_ID" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  -allowProvisioningUpdates archive
cp ExportOptions.plist build/ExportOptions.plist
/usr/libexec/PlistBuddy -c "Add :teamID string $TEAM_ID" build/ExportOptions.plist
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/export \
  -exportOptionsPlist build/ExportOptions.plist -allowProvisioningUpdates
echo "완료: $(pwd)/build/export/App.ipa (빌드번호 $BUILD_NUMBER)"
