// settings/option_settings → D1 option_settings (미이관 갭 복구, 2026-07-17)
//
// 왜 빠졌나: 최초 로더(load-core.mjs)가 settings 컬렉션 중 notifications_v2_* 두 문서만
// sms_config/room_templates 로 이관했고 option_settings 는 대상에 없었다.
//
// 왜 중요한가: late_checkout.roomStocks 가 **옵션 노출 여부**를 정한다.
//   NewReservationModal:845 — `isAvailableForRoom(객실명)` 이 참일 때만 체크박스가 뜬다.
//   → 이관 안 하면 예약화면에서 레이트 체크아웃이 통째로 사라진다.
//
// ⚠️ options 테이블과 합치지 않는다 — id(late_checkout)가 겹치고 독자가 다르다. 스키마 주석 참조.
import fs from "node:fs";
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");

const DUMP = "F:/backup/choho-firestore-dump-20260716/settings.json";
const raw = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const docs = Array.isArray(raw) ? raw : Object.values(raw);
const src = docs.find((d) => (d._id || d.id) === "option_settings");
if (!src) throw new Error("덤프에 settings/option_settings 없음");

// 문서는 { late_checkout: {...}, extra_person: {...} } 맵. 메타(_로 시작)는 제외
const entries = Object.entries(src).filter(([k]) => !k.startsWith("_"));
console.log(`덤프 키 ${entries.length}개: ${entries.map(([k]) => k).join(", ")}\n`);

const now = new Date().toISOString();
for (const [id, value] of entries) {
  await query(
    `INSERT INTO option_settings (id, data, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET data = ?2, updated_at = ?3`,
    [id, JSON.stringify(value), now],
  );
  console.log(`  ${id} ← ${JSON.stringify(value).slice(0, 90)}…`);
}

// ── 검증: D1 값이 덤프와 전건 일치하는가 ──
console.log("\n=== 검증 ===");
let pass = 0,
  fail = 0;
const ck = (n, c, x = "") => {
  console.log((c ? "  OK   " : "  FAIL ") + n + (x ? ` — ${x}` : ""));
  c ? pass++ : fail++;
};

const rows = (await query(`SELECT id, data FROM option_settings ORDER BY id`)).results;
ck(`행 ${entries.length}개`, rows.length === entries.length, `${rows.length}개`);
for (const [id, value] of entries) {
  const row = rows.find((r) => r.id === id);
  ck(`${id} 전필드 일치`, JSON.stringify(JSON.parse(row.data)) === JSON.stringify(value));
}

// 이 갭의 핵심 — 레이트체크아웃 재고
const lc = JSON.parse(rows.find((r) => r.id === "late_checkout").data);
ck(
  "late_checkout.roomStocks 복구 (옵션 노출을 정하는 값)",
  JSON.stringify(lc.roomStocks) === JSON.stringify(src.late_checkout.roomStocks),
  JSON.stringify(lc.roomStocks),
);
const ep = JSON.parse(rows.find((r) => r.id === "extra_person").data);
ck("extra_person 복구 (options 컬렉션엔 없던 항목)", ep.price === 15000, `${ep.price}원 / ${ep.priceType}`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
