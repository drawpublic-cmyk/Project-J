#!/usr/bin/env node
/* ============================================================================
   인천교통공사 1호선(인천1호선, 검단호수공원~송도달빛축제공원) 시각표 CSV
   → 앱이 바로 쓰는 정적 JSON(data/incheon1.json) 생성

   인천1호선은 서울과 달리 실시간 열차위치 API가 없다(공사가 공개 안 함).
   그래서 정확도가 검증된 '공식 시각표' 자체를 정적으로 내장해 다음 두 가지만 제공한다:
     1) 노선 전체 역 순서(하행 기준. 상행은 이 배열을 뒤집으면 됨) — 100% 실데이터.
     2) 역별 다음 열차 예정시각 — 단, '휴일 하행' 전 구간 시각표(1호선 휴일하선 열차운행시각표)만
        전체가 있어서 이 조합에서만 계산 가능. 그 외(평일/상행)는 첫차·막차만 있어 그대로 안내.
   부정확한 추정(보간)은 하지 않는다 — 없는 데이터는 "미제공"으로 명시.

   사용법:
     node tools/build-incheon1.js <휴일하선_전체시각표.csv> <평일_첫막차.csv> <휴일_첫막차.csv>
   데이터 갱신: 인천교통공사가 새 시각표를 올리면 data.go.kr에서 CSV만 다시 받아 재실행.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const [holidayDownCsv, weekdayFirstLastCsv, holidayFirstLastCsv] = process.argv.slice(2);
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "incheon1.json");

if (!holidayDownCsv || !weekdayFirstLastCsv || !holidayFirstLastCsv) {
  console.error("사용법: node tools/build-incheon1.js <휴일하선_전체시각표.csv> <평일_첫막차.csv> <휴일_첫막차.csv>");
  process.exit(1);
}
for (const f of [holidayDownCsv, weekdayFirstLastCsv, holidayFirstLastCsv]) {
  if (!fs.existsSync(f)) { console.error("파일 없음:", f); process.exit(1); }
}

// CSV(따옴표 안 쉼표/개행 처리) — 화장실/버스정류장 빌드 스크립트와 동일
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
const readRows = f => parseCSV(new TextDecoder("euc-kr").decode(fs.readFileSync(f)).replace(/^﻿/, ""));
const hms2hm = t => (t || "").trim().replace(/^(\d{1,2}:\d{2}):\d{2}$/, "$1");   // "05:32:00" → "05:32"

/* ---------- 1) 휴일 하행 전체 시각표 → 역 순서 + 역별 전체 열차시각 ---------- */
const dRows = readRows(holidayDownCsv);
const dHeader = dRows[0];
const META_COLS = 3;   // 시발역,종착역,열차번호
const stations = dHeader.slice(META_COLS).map(s => s.trim()).filter(Boolean);

const holidayDownTrains = [];
for (let i = 1; i < dRows.length; i++) {
  const r = dRows[i];
  if (!r || r.length < META_COLS + 1) continue;
  const tno = (r[2] || "").trim();
  if (!tno) continue;
  const times = stations.map((_, si) => hms2hm(r[META_COLS + si] || ""));
  if (times.some(Boolean)) holidayDownTrains.push({ tno, times });
}

/* ---------- 2) 첫차/막차(평일·휴일) → 역명 기준 ---------- */
function parseFirstLast(csvPath) {
  const rows = readRows(csvPath);
  const header = rows[0].map(h => h.trim());
  const idx = { name: header.indexOf("역명"), upF: header.indexOf("첫차(상선)"), downF: header.indexOf("첫차(하선)"), upL: header.indexOf("막차(상선)"), downL: header.indexOf("막차(하선)") };
  for (const k in idx) if (idx[k] < 0) { console.error("첫막차 CSV 컬럼 없음:", k, csvPath); process.exit(1); }
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[idx.name]) continue;
    const name = r[idx.name].trim();
    out[name] = { upFirst: hms2hm(r[idx.upF]), downFirst: hms2hm(r[idx.downF]), upLast: hms2hm(r[idx.upL]), downLast: hms2hm(r[idx.downL]) };
  }
  return out;
}
const firstLast = { weekday: parseFirstLast(weekdayFirstLastCsv), holiday: parseFirstLast(holidayFirstLastCsv) };

const missing = stations.filter(s => !firstLast.weekday[s] || !firstLast.holiday[s]);
if (missing.length) console.warn("첫/막차 데이터 없는 역:", missing.join(", "));

const data = { updated: "2025-04-12", stations, firstLast, holidayDownTrains };
fs.writeFileSync(OUT, JSON.stringify(data));

console.log(`역 수            : ${stations.length}`);
console.log(`휴일 하행 열차수  : ${holidayDownTrains.length}`);
console.log(`첫/막차 누락 역   : ${missing.length || "없음"}`);
console.log(`출력             : ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)}KB)`);
