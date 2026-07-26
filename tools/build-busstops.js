#!/usr/bin/env node
/* ============================================================================
   국토교통부 전국 버스정류장 위치정보 CSV → 앱이 바로 쓰는 격자 타일 데이터 생성

   화장실과 달리 이 CSV엔 위도·경도가 이미 들어있어 지오코딩이 필요 없다.
   예전엔 버스 정류소를 실시간 API 2개(TAGO 전국 + 서울 ws.bus.go.kr)로 위치검색했는데
   TAGO는 커버리지 구멍·서버 불안이 있어 응답 없는 지역은 핀이 아예 안 떴다.
   이 스크립트가 전국 22.7만 정류장을 격자 타일로 정적 내장하면, 앱은 주변 타일만 받아
   키·API 없이 전국 어디서든 정류소 핀을 즉시 표시한다(실시간 도착은 핀 누를 때만 API).

   저장 포맷(배열): [정류장명, 위도, 경도, 도시코드, 정류장번호(TAGO nodeid), arsId]
     - 도시코드 11(서울)은 TAGO 미수록 → arsId(모바일단축번호를 5자리로 0채움)로 서울 API 도착 조회.
     - 그 외 지역은 도시코드+정류장번호로 TAGO 도착 조회(arsId는 "").

   사용법: node tools/build-busstops.js <국토교통부_전국 버스정류장 위치정보.csv>
   데이터 갱신: data.go.kr에서 CSV만 새로 받아 같은 명령 재실행.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const CSV = process.argv[2];
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "busstops");
const STEP = 0.05;                 // 화장실과 동일한 격자 크기(약 5.5km × 4.4km)
const SEOUL_CITYCODE = 11;

if (!CSV || !fs.existsSync(CSV)) {
  console.error("사용법: node tools/build-busstops.js <국토교통부_전국 버스정류장 위치정보.csv>");
  process.exit(1);
}

// CSV(따옴표 안 쉼표/개행 처리)
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
const H = {};
rows[0].forEach((h, i) => { H[h.trim()] = i; });
for (const k of ["정류장명", "위도", "경도", "정류장번호", "도시코드", "모바일단축번호"]) {
  if (!(k in H)) { console.error("필수 컬럼 없음:", k); process.exit(1); }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const tiles = new Map();
const seen = new Set();
let placed = 0, badCoord = 0, dup = 0;

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length < 6) continue;
  const name = (r[H["정류장명"]] || "").trim();
  const lat = Number(r[H["위도"]]), lng = Number(r[H["경도"]]);
  const nodeid = (r[H["정류장번호"]] || "").trim();
  const city = parseInt(r[H["도시코드"]], 10);
  const mob = (r[H["모바일단축번호"]] || "").trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39.6 || lng < 124 || lng > 132) { badCoord++; continue; }
  if (nodeid && seen.has(nodeid)) { dup++; continue; }
  if (nodeid) seen.add(nodeid);

  // 서울은 arsId(모바일단축번호 5자리 0채움)로 도착 조회, 그 외는 도시코드+정류장번호(TAGO)
  const ars = (city === SEOUL_CITYCODE && /^\d+$/.test(mob) && mob.length >= 2) ? mob.padStart(5, "0") : "";
  const row = [name, +lat.toFixed(6), +lng.toFixed(6), city, nodeid, ars];

  const key = `${Math.floor(lat / STEP)}_${Math.floor(lng / STEP)}`;
  if (!tiles.has(key)) tiles.set(key, []);
  tiles.get(key).push(row);
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

console.log(`CSV ${rows.length - 1}행`);
console.log(`좌표 이상 제외 : ${badCoord}건`);
console.log(`중복(nodeid)  : ${dup}건`);
console.log(`정류장         : ${placed}건`);
console.log(`타일          : ${tiles.size}개, 총 ${(bytes / 1024 / 1024).toFixed(2)}MB`);
console.log(`출력          : data/busstops/`);
