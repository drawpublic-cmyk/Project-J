# 존급 (JONGEUP)

> 급할수록, 존급 — 내 주변 **화장실 · 편의점 · 프린터 · 지하철 · 버스정류장**을 한 지도에서 바로 찾는 앱.

PDF 와이어프레임(13화면)을 기반으로 한 **클릭 가능한 프론트엔드 프로토타입**입니다. 카카오맵 / 공공데이터포털 키를 넣으면 실데이터로, 없으면 mock 데이터로 동작합니다.

## 화면
스플래시 · 온보딩(위치권한) · 메인 지도 · 카테고리 필터 · 리스트 · 상세 · 길찾기 · 검색 · 버스 도착/혼잡도 · 즐겨찾기 · SOS(긴급 모드)

## 실행
정적 HTML 한 장이라 빌드가 필요 없습니다.

```bash
python3 -m http.server 4173
# http://127.0.0.1:4173/
```

특정 화면 바로 보기: URL 끝에 해시 추가 — `#map` `#list` `#fav` `#detail` `#route` `#search` `#bus` `#sos`

## API 연동
`index.html` 하단 `CONFIG` 값만 채우면 실데이터로 전환됩니다(비우면 mock).

```js
const CONFIG = {
  KAKAO_JS_KEY: "",   // 카카오 JavaScript 키 (지도 + 주변 장소 검색)
  DATA_GO_KR_KEY: "", // 공공데이터포털 디코딩 서비스키 (화장실/버스)
  PROXY: "",          // 공공데이터 CORS 우회 프록시 base (proxy.js 실행 시 http://localhost:8787/)
  DEFAULT_CENTER: { lat: 37.5547, lng: 126.9707 },
  RADIUS: 500
};
```

- **카카오맵**: developers.kakao.com에서 앱 생성 → JavaScript 키 → 플랫폼(Web)에 도메인(`http://127.0.0.1:4173`) 등록 필수. 편의점=카테고리 `CS2`, 지하철=`SW8`, 화장실/프린터/버스=키워드 검색.
- **공공데이터포털**: data.go.kr에서 데이터셋별로 **개별 활용신청**(전국공중화장실표준데이터 / 서울 버스도착정보). 브라우저 CORS 때문에 `proxy.js`(`node proxy.js`)를 함께 띄워 우회.

자세한 내용은 [`API_AND_REQUIREMENTS.md`](API_AND_REQUIREMENTS.md) 참고.

## 디자인 토큰 (Design Spec v1)
| 토큰 | HEX | 용도 |
|---|---|---|
| `--brand-green` | `#06530B` | 주요 액션 · SOS · 길안내 · 교통수단(버스·지하철) 핀 · 선택 칩 |
| `--lavender` | `#BBBFEC` | 카테고리 핀(화·편·프) · 스플래시/버스 헤더 · 정보 박스 |
| `--cream` | `#FDFCF7` | 카드 · 검색바 · 시트 배경 |
| `--map-bg` | `#F4F2EA` | 지도 영역 배경 |
| `--charcoal` | `#1A1A1A` | 본문 텍스트 · 로고 |
| `--pink-accent` | `#E5407A` | 보조 액센트(전화 · 검색 결과 핀) |

> 핀 색 규칙: 화장실·편의점·프린터 = 라벤더(단일), 교통수단(버스·지하철) = 초록. SOS = 초록(빨강 아님).

## 구성
```
index.html               프로토타입 (UI + 인터랙션 + API 연동 코드)
proxy.js                 공공데이터포털 CORS 우회 프록시 (의존성 0, Node 18+)
API_AND_REQUIREMENTS.md  API 후보 · 셋업 · 서버/DB 필요 지점 정리
```

## 상태
- 프론트엔드 프로토타입 단계 (mock 데이터 기본)
- 아이콘은 인라인 SVG 라인 세트, 매장 사진은 회색 placeholder
- 즐겨찾기는 `localStorage`에 저장
