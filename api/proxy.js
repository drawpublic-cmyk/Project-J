/**
 * 존급 — Vercel 서버리스 프록시 (키 서버 주입 + CORS 우회)
 *
 * 클라이언트는 키 대신 sentinel 토큰(__JONGEUP_KEY__)을 넣어 호출:
 *   /api/proxy?url=<원본 API URL(encodeURIComponent) — 키 자리 = __JONGEUP_KEY__>
 * 이 함수가 host 를 보고 환경변수의 실제 키로 치환해 대신 호출합니다.
 *
 * Vercel → Settings → Environment Variables:
 *   DATA_GO_KR_KEY   = 공공데이터/서울버스(ws.bus.go.kr) 디코딩 서비스키
 *   SEOUL_SUBWAY_KEY = 서울 열린데이터광장 인증키(지하철)
 */
const SENTINEL = "__JONGEUP_KEY__";
// index.html이 px()로 부르는 공공 API 호스트 전부. 새 API를 프록시로 부르게 되면 여기에 추가.
const ALLOWED_HOSTS = new Set([
  "apis.data.go.kr",        // TAGO 버스(정류소·도착·노선·위치), 부산교통공사 시간표
  "ws.bus.go.kr",           // 서울 버스
  "swopenapi.seoul.go.kr",  // 서울 지하철 실시간
  "openapi.seoul.go.kr",    // 서울 지하철 역 마스터
]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  // 1) target 추출: req.query.url 우선, 없으면 raw req.url 에서 url= 이후
  let target = (req.query && req.query.url) || "";
  if (!target) {
    const i = req.url.indexOf("url=");
    if (i >= 0) target = req.url.slice(i + 4);
  }
  // 인코딩됐으면 디코드 (여러 번 인코딩 대비 최대 2회)
  for (let k = 0; k < 2 && /%[0-9A-Fa-f]{2}/.test(target); k++) {
    try { target = decodeURIComponent(target); } catch { break; }
  }

  let host;
  try { host = new URL(target).hostname; }
  catch { return res.status(400).json({ error: "잘못된 URL", rawUrl: req.url, target }); }

  // 허용된 공공 API 호스트만 중계 — 아무 주소나 받으면 공격자가 자기 서버 주소에 키 자리(__JONGEUP_KEY__)를
  // 넣어 호출하는 것만으로 우리 서비스키가 그쪽으로 전송됨(키 유출 + 오픈 프록시 악용).
  if (!ALLOWED_HOSTS.has(host)) return res.status(403).json({ error: "허용되지 않은 호스트", host });

  const key = host.endsWith("seoul.go.kr")
    ? (process.env.SEOUL_SUBWAY_KEY || "")
    : (process.env.DATA_GO_KR_KEY || "");
  if (!key) return res.status(500).send("서버에 API 키 미설정(" + host + ")");

  const finalUrl = target.split(SENTINEL).join(key);
  try {
    const r = await fetch(finalUrl, { headers: { "User-Agent": "jongeup-proxy" } });
    const body = await r.text();
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).send("프록시 오류: " + e.message);
  }
}
