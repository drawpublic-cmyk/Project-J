/**
 * 존급 — Vercel 서버리스 프록시 (키 서버 주입 + CORS 우회)
 *
 * 클라이언트는 키 대신 sentinel 토큰(__JONGEUP_KEY__)을 넣어 호출:
 *   /api/proxy?url=<원본 API URL 전체(키 자리 = __JONGEUP_KEY__)>
 * 이 함수가 host 를 보고 환경변수의 실제 키로 치환해 대신 호출합니다.
 * (경로형 서울 API·쿼리형 TAGO API 모두 sentinel 치환 한 방으로 처리)
 *
 * Vercel → Settings → Environment Variables 에 등록:
 *   DATA_GO_KR_KEY   = 공공데이터포털/서울버스(ws.bus.go.kr) 디코딩 서비스키
 *   SEOUL_SUBWAY_KEY = 서울 열린데이터광장 인증키(지하철 실시간·역목록)
 */
const SENTINEL = "__JONGEUP_KEY__";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  const i = req.url.indexOf("url=");
  if (i < 0) return res.status(400).send("url 파라미터가 필요합니다");
  const target = req.url.slice(i + 4);           // url= 이후 원본 URL 전체(인코딩 그대로)

  let host;
  try { host = new URL(target).hostname; }
  catch { return res.status(400).send("잘못된 URL"); }

  // host 로 어떤 키인지 결정 (seoul.go.kr → 지하철키, 그 외 → TAGO/버스키)
  const key = host.includes("seoul.go.kr")
    ? (process.env.SEOUL_SUBWAY_KEY || "")
    : (process.env.DATA_GO_KR_KEY || "");
  if (!key) return res.status(500).send("서버에 API 키가 설정되지 않았습니다(" + host + ")");

  const finalUrl = target.split(SENTINEL).join(key);   // 키 자리 치환

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
