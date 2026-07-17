// 재고 override 쓰기 감사 — 핵심 질문: **쓰고 나서 가드와 화면이 같은 값을 보는가?**
//
// 드리프트 위험: 가드(lib/inventory.js)는 `stock` 컬럼을, 스토어 매퍼(lib/legacy-shape.js)는
// 예전엔 `data.available` 을 읽었다. 한쪽만 갱신하는 쓰기가 들어오면 화면과 재고검사가 갈린다.
// 여기서 쓰기 → 양쪽 리더 대조로 그 갈라짐이 불가능함을 증명한다.
//
// 안전: 실데이터를 건드리지 않도록 **미래 날짜(2027-12-31)** 전용 행만 만들고 정확한 ID로 지운다.
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");
const { setOverride, deleteOverride, availableStock, overrideId } = await import(
  "file:///F:/rv-chorigol.co.kr/lib/inventory.js"
);
const { loadSnapshot } = await import("file:///F:/rv-chorigol.co.kr/lib/legacy-shape.js");

let pass = 0,
  fail = 0;
const ck = (n, c, x = "") => {
  console.log((c ? "  OK   " : "  FAIL ") + n + (x ? ` — ${x}` : ""));
  c ? pass++ : fail++;
};

const D = "2027-12-31"; // 실데이터 없는 미래 날짜
const R = "Forest";
const ID = overrideId(D, R);

const rowOf = async (id) =>
  (await query(`SELECT id, room_name, date, stock, data FROM inventory_overrides WHERE id=?`, [id]))
    .results[0] || null;
const avail = (o) => {
  try {
    return JSON.parse(o.data)?.available;
  } catch {
    return "(parse-fail)";
  }
};

const before = (await query(`SELECT COUNT(*) c FROM inventory_overrides`)).results[0].c;
console.log(`기준: inventory_overrides ${before}행 / 테스트 ID ${ID}\n`);

try {
  await deleteOverride(D, R); // 이전 실패 잔여물 정리

  const baseStock = (await query(`SELECT stock FROM rooms WHERE name=?`, [R])).results[0].stock;
  const base = await availableStock(R, D);
  console.log(`[사전] rooms.stock=${baseStock} · override 없을 때 가드 재고=${base}\n`);

  // ── 1. 생성: 4개 컬럼이 전부 채워지는가 (이관 버그 재발 방지) ──
  console.log("[생성]");
  await setOverride(D, R, 5);
  let row = await rowOf(ID);
  ck("행 생성됨", !!row);
  ck("stock 컬럼 = 5", row.stock === 5, `stock=${row.stock}`);
  ck("date 컬럼 채워짐 (가드가 WHERE date= 로 찾는다)", row.date === D, `date=${row.date}`);
  ck("room_name 컬럼 채워짐", row.room_name === R, `room_name=${row.room_name}`);
  ck("data.available = 5", avail(row) === 5, `available=${avail(row)}`);
  ck("data.dateStr/roomName = 레거시 필드 유지", JSON.parse(row.data).dateStr === D && JSON.parse(row.data).roomName === R);

  // ── 2. 두 리더가 같은 값을 보는가 (이 감사의 핵심) ──
  console.log("\n[두 리더 대조 — 드리프트 0]");
  ck("stock == data.available", row.stock === avail(row), `${row.stock} vs ${avail(row)}`);
  const g5 = await availableStock(R, D);
  ck("가드가 override 반영 (재고=5)", g5 === 5, `가드=${g5}`);
  let snap = await loadSnapshot();
  ck("매퍼 overrides 맵이 같은 값 (5)", snap.overrides[ID] === 5, `맵=${snap.overrides[ID]}`);
  ck("가드 == 매퍼", g5 === snap.overrides[ID], `${g5} vs ${snap.overrides[ID]}`);

  // ── 3. 갱신(upsert): 한쪽만 갱신되지 않는가 ──
  console.log("\n[갱신 — upsert]");
  await setOverride(D, R, 0); // 0 = 막기
  row = await rowOf(ID);
  ck("행이 하나로 유지 (중복 생성 안 됨)", (await query(`SELECT COUNT(*) c FROM inventory_overrides WHERE id=?`, [ID])).results[0].c === 1);
  ck("stock 갱신 = 0", row.stock === 0, `stock=${row.stock}`);
  ck("data.available 동시 갱신 = 0", avail(row) === 0, `available=${avail(row)}`);
  ck("stock == data.available (갱신 후에도)", row.stock === avail(row));
  const g0 = await availableStock(R, D);
  snap = await loadSnapshot();
  ck("가드 재고 0 (override=0 → 막힘)", g0 === 0, `가드=${g0}`);
  ck("매퍼도 0 — 화면과 가드 일치", snap.overrides[ID] === 0, `맵=${snap.overrides[ID]}`);

  // ── 4. json_patch 머지: 기존 필드 보존 (레거시 setDoc merge:true) ──
  console.log("\n[머지 — 레거시 setDoc merge:true 동등]");
  await query(`UPDATE inventory_overrides SET data=json_set(data,'$.createdAt','2025-01-01T00:00:00Z') WHERE id=?`, [ID]);
  await setOverride(D, R, 3);
  row = await rowOf(ID);
  ck("기존 createdAt 보존 (덮어쓰기 아님)", JSON.parse(row.data).createdAt === "2025-01-01T00:00:00Z", JSON.parse(row.data).createdAt);
  ck("available 은 갱신 = 3", avail(row) === 3);
  ck("stock == data.available", row.stock === avail(row));

  // ── 5. 삭제: 기본 재고로 복원 ──
  console.log("\n[삭제 — 기본 재고 복원]");
  await deleteOverride(D, R);
  ck("행 삭제됨", (await rowOf(ID)) === null);
  const gAfter = await availableStock(R, D);
  ck("가드가 rooms.stock 으로 복귀", gAfter === base, `가드=${gAfter} (기준 ${base})`);
  snap = await loadSnapshot();
  ck("매퍼 맵에서도 사라짐", snap.overrides[ID] === undefined);
  await deleteOverride(D, R); // 없는 행 삭제 = 성공 (레거시 동일)
  ck("없는 행 삭제해도 에러 없음 (레거시 동일)", true);
} finally {
  await query(`DELETE FROM inventory_overrides WHERE id=?`, [ID]); // 정확한 ID로만
  const after = (await query(`SELECT COUNT(*) c FROM inventory_overrides`)).results[0].c;
  console.log("\n[원상복구]");
  ck(`inventory_overrides ${before}행 유지`, after === before, `현재 ${after}행`);

  // 실데이터 드리프트 재확인 — 키형식 23행은 stock == data.available 이어야 한다
  const all = (await query(`SELECT id, stock, data FROM inventory_overrides`)).results;
  const keyed = all.filter((o) => /^\d{4}-\d{2}-\d{2}_/.test(o.id));
  const drift = keyed.filter((o) => o.stock !== avail(o));
  ck(`실데이터 키형식 ${keyed.length}행 드리프트 0`, drift.length === 0, drift.map((d) => d.id).join(","));
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
