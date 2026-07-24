#!/usr/bin/env node
/* ============================================================================
   전국공중화장실표준데이터 CSV → 앱이 바로 쓰는 격자 타일 데이터 생성

   행안부 표준데이터엔 2025.02 정책변경으로 위도/경도가 없다. 예전엔 앱 실행 중에
   주소를 하나씩 지오코딩했는데 비용 때문에 40건 캡이 걸려 사실상 못 쓰는 레이어였다.
   이 스크립트가 빌드 시점에 전부 좌표로 바꿔 격자로 쪼개 두면, 앱은 주변 타일만
   받아 즉시 전국 5만여 건을 보여줄 수 있다(키·프록시 불필요).

   사용법:
     KAKAO_REST_KEY=<카카오 REST API 키> node tools/build-toilets.js <CSV경로>

   - 중간에 끊겨도 다시 실행하면 .toilet-geocache.json 부터 이어서 진행한다.
   - 데이터 갱신: data.go.kr에서 CSV만 새로 받아 같은 명령 재실행.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const CSV = process.argv[2];
const KEY = process.env.KAKAO_REST_KEY;
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "toilets");
const CACHE = path.join(ROOT, ".toilet-geocache.json");   // gitignore 대상
const STEP = 0.05;            // 타일 한 변(약 5.5km × 4.4km)
const CONCURRENCY = 8;        // 카카오 초당 제한 고려

if (!CSV || !fs.existsSync(CSV)) {
  console.error("사용법: KAKAO_REST_KEY=<키> node tools/build-toilets.js <공중화장실정보.csv>");
  process.exit(1);
}

/* ---------- 1. CSV 파싱 (CP949 + 따옴표 안 쉼표) ---------- */
function parseCSV(s) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const text = new TextDecoder("euc-kr").decode(fs.readFileSync(CSV)).replace(/^﻿/, "");
const rows = parseCSV(text);
const idx = {};
rows[0].forEach((h, i) => { idx[h.trim()] = i; });

const G = (r, k) => (idx[k] != null ? (r[idx[k]] || "").trim() : "");
const N = (r, k) => { const v = parseInt(G(r, k), 10); return Number.isFinite(v) ? v : 0; };
const YN = (r, k) => G(r, k).toUpperCase() === "Y";

const toilets = [];
const seen = new Set();
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length < 5) continue;
  const road = G(r, "소재지도로명주소"), jibun = G(r, "소재지지번주소");
  const addr = road || jibun;
  if (!addr) continue;
  const name = G(r, "화장실명") || "공중화장실";
  const key = name + "|" + addr;
  if (seen.has(key)) continue;                      // 같은 이름+주소 중복 제거
  seen.add(key);

  const male = N(r, "남성용-대변기수") + N(r, "남성용-소변기수");
  const female = N(r, "여성용-대변기수");
  const acc = N(r, "남성용-장애인용대변기수") + N(r, "남성용-장애인용소변기수") + N(r, "여성용-장애인용대변기수");
  const kid = N(r, "남성용-어린이용대변기수") + N(r, "남성용-어린이용소변기수") + N(r, "여성용-어린이용대변기수");

  // 시설 비트플래그 — 남1 여2 장애인4 어린이8 기저귀대16 비상벨32 CCTV64
  const flags = (male > 0 ? 1 : 0) | (female > 0 ? 2 : 0) | (acc > 0 ? 4 : 0) | (kid > 0 ? 8 : 0)
    | (YN(r, "기저귀교환대유무") ? 16 : 0) | (YN(r, "비상벨설치여부") ? 32 : 0) | (YN(r, "화장실입구CCTV설치유무") ? 64 : 0);

  toilets.push({
    n: name, a: addr,
    a2: (road && jibun && road !== jibun) ? jibun : "",   // 도로명 실패 시 지번 폴백
    open: G(r, "구분명") === "개방화장실" ? 1 : 0,
    o: G(r, "개방시간상세") || G(r, "개방시간"),
    tel: G(r, "전화번호"), flags, org: G(r, "관리기관명")
  });
}
console.log(`CSV ${rows.length - 1}행 → 중복 제거 후 ${toilets.length}건`);

/* ---------- 2. 지오코딩 (카카오 로컬 REST) ---------- */
let cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache));

async function kakao(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch(url, { headers: { Authorization: "KakaoAK " + KEY } });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1000 * (a + 1))); continue; }
      if (res.status === 401 || res.status === 403) {
        console.error(`\n인증 실패(${res.status}) — KAKAO_REST_KEY를 확인하세요. (JS 키 아님)`);
        process.exit(1);
      }
      if (!res.ok) { await new Promise(r => setTimeout(r, 300 * (a + 1))); continue; }
      return await res.json();
    } catch { await new Promise(r => setTimeout(r, 300 * (a + 1))); }
  }
  return null;
}

async function geocodeOne(addr) {
  let d = (await kakao("https://dapi.kakao.com/v2/local/search/address.json?query=" + encodeURIComponent(addr)))?.documents?.[0];
  if (!d) d = (await kakao("https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=" + encodeURIComponent(addr)))?.documents?.[0];
  if (!d) return null;
  const lat = Number(d.y), lng = Number(d.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;   // 국내 밖 오매칭 차단
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

async function pass(addrs, label) {
  const todo = [...new Set(addrs)].filter(a => a && !(a in cache));
  if (!todo.length) { console.log(`[${label}] 캐시로 전부 해결`); return; }
  console.log(`[${label}] ${todo.length}건 변환 중...`);
  let cursor = 0, done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < todo.length) {
      const addr = todo[cursor++];
      cache[addr] = await geocodeOne(addr);           // 실패(null)도 캐시
      if (++done % 500 === 0) { saveCache(); process.stdout.write(`\r  ${done}/${todo.length}`); }
    }
  }));
  saveCache();
  console.log(`\r  ${done}/${todo.length} 완료`);
}

/* ---------- 3. 격자 타일로 출력 ---------- */
(async () => {
  const needGeo = toilets.some(t => !(t.a in cache));
  if (needGeo && !KEY) {
    console.error("KAKAO_REST_KEY 환경변수가 필요합니다 (developers.kakao.com > 내 애플리케이션 > REST API 키).");
    process.exit(1);
  }
  if (KEY) {
    await pass(toilets.map(t => t.a), "1차 대표주소");
    await pass(toilets.filter(t => t.a2 && !cache[t.a]).map(t => t.a2), "2차 지번 폴백");
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const tiles = new Map();
  let placed = 0, failed = 0;
  for (const t of toilets) {
    const c = cache[t.a] || (t.a2 ? cache[t.a2] : null);
    if (!c) { failed++; continue; }
    // 저장 포맷: [이름, 위도, 경도, 주소, 개방여부, 개방시간, 전화, 시설비트, 관리기관]
    const k = `${Math.floor(c.lat / STEP)}_${Math.floor(c.lng / STEP)}`;
    if (!tiles.has(k)) tiles.set(k, []);
    tiles.get(k).push([t.n, c.lat, c.lng, t.a, t.open, t.o, t.tel, t.flags, t.org]);
    placed++;
  }

  let bytes = 0;
  for (const [k, list] of tiles) {
    const s = JSON.stringify(list);
    fs.writeFileSync(path.join(OUT, k + ".json"), s);
    bytes += s.length;
  }
  fs.writeFileSync(path.join(OUT, "index.json"),
    JSON.stringify({ step: STEP, count: placed, tiles: [...tiles.keys()].sort() }));

  console.log("──────────────────────────────");
  console.log(`좌표 확보 : ${placed}건 (${(placed / toilets.length * 100).toFixed(1)}%)`);
  console.log(`변환 실패 : ${failed}건 (주소 불명확 — 제외됨)`);
  console.log(`타일      : ${tiles.size}개, 총 ${(bytes / 1024 / 1024).toFixed(2)}MB`);
  console.log(`출력      : data/toilets/`);
})();
