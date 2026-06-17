/**
 * 존급 — 공공데이터포털 CORS 우회 프록시 (의존성 0, Node 18+)
 *
 * 공공데이터포털/서울 버스 API 는 브라우저에서 직접 호출하면 CORS 로 막힙니다.
 * 이 작은 프록시를 띄우면 index.html 의 CONFIG.PROXY 로 우회할 수 있습니다.
 *
 * 실행:   node proxy.js
 * 그다음: index.html 의 CONFIG.PROXY = "http://localhost:8787/"
 *
 * 사용 방식: http://localhost:8787/<원본 전체 URL>
 *   예) http://localhost:8787/http://ws.bus.go.kr/api/rest/...?arsId=...
 */
const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = 8787;

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // 프록시 뒤에 붙은 원본 URL 추출 (맨 앞 '/' 제거)
  const target = req.url.replace(/^\//, "");
  if (!/^https?:\/\//.test(target)) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("사용법: http://localhost:8787/<원본 API URL 전체>");
  }

  let upstream;
  try { upstream = new URL(target); }
  catch { res.writeHead(400); return res.end("잘못된 URL"); }

  const client = upstream.protocol === "https:" ? https : http;
  client.get(upstream, up => {
    res.writeHead(up.statusCode || 200, {
      "Content-Type": up.headers["content-type"] || "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
    up.pipe(res);
  }).on("error", err => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("프록시 오류: " + err.message);
  });
}).listen(PORT, () => {
  console.log(`존급 프록시 실행 중 → http://localhost:${PORT}/`);
  console.log(`index.html 의 CONFIG.PROXY 에 "http://localhost:${PORT}/" 를 넣으세요.`);
});
