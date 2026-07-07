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

  if (req.query && req.query.debug === "1") {
    return res.status(200).json({ rawUrl: req.url, query: req.query, target });
  }

  let host;
  try { host = new URL(target).hostname; }
  catch { return res.status(400).json({ error: "잘못된 URL", rawUrl: req.url, target }); }

  const key = host.includes("seoul.go.kr")
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
