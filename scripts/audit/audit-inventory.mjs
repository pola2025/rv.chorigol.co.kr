// 재고 가드 감사 — 동등성 + 동시성 오버부킹 실증.
// 테스트 예약은 생성 시 받은 ID를 들고 있다가 그 ID로만 삭제한다 (LIKE 패턴 금지).
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");
const inv = await import("file:///F:/rv-chorigol.co.kr/lib/inventory.js");

let pass = 0, fail = 0;
const ck = (n, c, x = "") => { console.log((c ? "  OK   " : "  FAIL ") + n + (x ? ` — ${x}` : "")); c ? pass++ : fail++; };
const created = []; // 정리용 ID
const newId = () => "zzAUDIT" + Math.random().toString(36).slice(2, 15).padEnd(13, "0");

const baseCount = (await query(`SELECT COUNT(*) c FROM reservations`)).results[0].c;
console.log(`베이스라인 예약: ${baseCount}건\n`);

// ─────────────────────────────────────────────
// 1. 동등성 — 레거시(A) 이식 vs 신규(B) SQL
// ─────────────────────────────────────────────
console.log("[1] 동등성 감사 (레거시 규칙 이식 vs 가드 SQL)");
const rooms = (await query(`SELECT name, stock FROM rooms`)).results;          // 레거시는 is_active 필터 없음
const resv = (await query(`SELECT room_name, check_in, check_out, status FROM reservations`)).results;
const ovs = (await query(`SELECT room_name, date, stock FROM inventory_overrides WHERE date IS NOT NULL`)).results;
const ovMap = Object.fromEntries(ovs.map((o) => [`${o.date}_${o.room_name}`, o.stock]));

// 레거시 getAvailableStock 축자 이식 (A: override는 절대값, 차감 안 함)
const legacyA = (date, roomName) => {
  const room = rooms.find((r) => r.name === roomName);
  if (!room) return 0;                                   // 레거시: override보다 먼저
  const ov = ovMap[`${date}_${roomName}`];
  if (ov !== undefined) return ov;                       // 절대값 그대로
  const booked = resv.filter((r) => r.status !== "예약취소" && r.room_name === roomName
    && date >= r.check_in && date < r.check_out).length;
  return Math.max(0, (room.stock || 0) - booked);
};
// 확정 규칙 (B: override = 정원 → 차감)
const expectB = (date, roomName) => {
  const room = rooms.find((r) => r.name === roomName);
  if (!room) return 0;
  const cap = ovMap[`${date}_${roomName}`] ?? (room.stock || 0);
  const booked = resv.filter((r) => r.status !== "예약취소" && r.room_name === roomName
    && date >= r.check_in && date < r.check_out).length;
  return Math.max(0, cap - booked);
};

const dates = [];
for (let i = 0; i < 420; i++) { const d = new Date("2025-08-01"); d.setDate(d.getDate() + i);
  dates.push(d.toISOString().slice(0, 10)); }

let n = 0, mismatchB = 0, diffAB = [];
for (const room of rooms) {
  for (const d of dates) {
    const sql = await inv.availableStock(room.name, d);
    const b = expectB(d, room.name);
    const a = legacyA(d, room.name);
    n++;
    if (sql !== b) { mismatchB++; if (mismatchB <= 5) console.log(`    ✗ SQL≠B ${room.name} ${d}: sql=${sql} b=${b}`); }
    if (a !== b) diffAB.push({ room: room.name, d, a, b });
  }
}
ck(`가드 SQL == 확정규칙(B)  [${n}건 대조]`, mismatchB === 0, `불일치 ${mismatchB}`);
ck("레거시(A)와 달라지는 건 2건뿐 (알려진 버그)", diffAB.length === 2, `${diffAB.length}건`);
for (const x of diffAB) console.log(`    · ${x.d} ${x.room}: 레거시=${x.a}(받음) → 신규=${x.b}(막음)`);

ck("없는 객실 → 0", (await inv.availableStock("존재하지않는방", "2026-12-01")) === 0);

// ─────────────────────────────────────────────
// 2. 가드 동작
// ─────────────────────────────────────────────
console.log("\n[2] 가드 동작");
const D1 = "2026-12-01", D2 = "2026-12-02";
const mk = (over) => ({ id: newId(), customer_name: "zz감사", phone: "01098979834",
  room_name: "Forest", check_in: D1, check_out: D2, guests: 2, status: "예약확정",
  source: "etc", total_price: 100000, ...over });

const free0 = await inv.availableStock("Forest", D1);
ck(`Forest ${D1} 초기 여유 = 방재고 2`, free0 === 2, String(free0));

let r = await inv.insertGuarded(mk({ room_name: "없는방" }));
ck("없는 객실 → 거절 (fable SEV-1)", r.created === false);

const a1 = mk(); r = await inv.insertGuarded(a1);
if (r.created) created.push(a1.id);
ck("여유 있음 → 생성", r.created === true);

const a2 = mk(); r = await inv.insertGuarded(a2);
if (r.created) created.push(a2.id);
ck("2번째도 생성 (재고 2)", r.created === true);
ck("이제 만실", (await inv.availableStock("Forest", D1)) === 0);

const a3 = mk(); r = await inv.insertGuarded(a3);
if (r.created) created.push(a3.id);
ck("3번째 → 거절 (오버부킹 차단)", r.created === false);

const blk = mk({ source: "막기" }); r = await inv.insertGuarded(blk);
if (r.created) created.push(blk.id);
ck("막기는 만실이어도 통과 (레거시 동일)", r.created === true);

const dg = await inv.diagnose("Forest", D1, D2);
ck("진단: 막힌 날짜 특정", dg.reason === "no_stock" && dg.date === D1, JSON.stringify(dg));
const dg2 = await inv.diagnose("없는방", D1, D2);
ck("진단: 없는 객실 구분", dg2.reason === "room_not_found", JSON.stringify(dg2));

// ─────────────────────────────────────────────
// 3. 동시성 — 진짜 핵심
// ─────────────────────────────────────────────
console.log("\n[3] 동시성 오버부킹 실증 (레거시가 못 막던 것)");
const D3 = "2026-12-20", D4 = "2026-12-21";
ck(`Forest ${D3} 여유 2 확인`, (await inv.availableStock("Forest", D3)) === 2);

const burst = Array.from({ length: 8 }, () => mk({ check_in: D3, check_out: D4 }));
const results = await Promise.all(burst.map((b) => inv.insertGuarded(b).then((x) => ({ id: b.id, ...x }))));
for (const x of results) if (x.created) created.push(x.id);
const okCount = results.filter((x) => x.created).length;
ck(`동시 8건 → 정확히 2건만 성공 (재고 2)`, okCount === 2, `${okCount}건 성공`);

const actual = (await query(
  `SELECT COUNT(*) c FROM reservations WHERE room_name='Forest' AND status!='예약취소'
    AND check_in <= ? AND ? < check_out`, [D3, D3])).results[0].c;
ck(`D1 실제 점유 = 2 (오버부킹 0)`, actual === 2, `${actual}건`);
ck(`남은 재고 0`, (await inv.availableStock("Forest", D3)) === 0);

// ─────────────────────────────────────────────
// 4. UPDATE 가드
// ─────────────────────────────────────────────
console.log("\n[4] UPDATE 가드 (fable SEV-2)");
const u = mk({ check_in: "2026-12-25", check_out: "2026-12-26" });
r = await inv.insertGuarded(u); if (r.created) created.push(u.id);
ck("이동용 예약 생성", r.created === true);

let up = await inv.updateGuarded(u.id, { room_name: "Forest", check_in: "2026-12-25", check_out: "2026-12-26" });
ck("자기 날짜 그대로 수정 → 통과 (자기제외 동작)", up.updated === true);

up = await inv.updateGuarded(u.id, { room_name: "Forest", check_in: D3, check_out: D4 });
ck("만실 날짜로 이동 → 거절", up.updated === false);

up = await inv.updateGuarded(u.id, { room_name: "Forest", check_in: "2026-12-27", check_out: "2026-12-28" });
ck("빈 날짜로 이동 → 통과", up.updated === true);

// ─────────────────────────────────────────────
// 5. 정리
// ─────────────────────────────────────────────
console.log("\n[5] 정리 (정확한 ID로만 삭제)");
for (const id of created) await query(`DELETE FROM reservations WHERE id = ?`, [id]);
const after = (await query(`SELECT COUNT(*) c FROM reservations`)).results[0].c;
ck(`예약 ${baseCount}건 복구`, after === baseCount, `현재 ${after}건`);
const leftover = (await query(`SELECT COUNT(*) c FROM reservations WHERE id LIKE 'zzAUDIT%'`)).results[0].c;
ck("테스트 잔여 0", leftover === 0);
const sum = (await query(`SELECT COALESCE(SUM(total_price),0) s FROM reservations`)).results[0].s;
ck("금액합계 98,105,000원 유지", sum === 98105000, sum.toLocaleString());

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
