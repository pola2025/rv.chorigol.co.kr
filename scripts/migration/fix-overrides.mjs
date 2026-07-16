// inventory_overrides 이관 버그 수정 — date/stock 컬럼이 전건 NULL이라 재고 override가 무시됨.
//
// 레거시는 doc(db,'inventory_overrides', `${dateStr}_${roomName}`) 로 **문서 ID**를 직접 읽는다.
// → ID가 진실. json.roomName은 낡았을 수 있음(객실명 변경 흔적: 단체예약→단체-워크샵).
// → 랜덤 id 3건은 레거시가 절대 못 읽는 죽은 데이터 → 복구 대상 제외(NULL 유지).
//
// 원본 JSON(data 컬럼)은 손대지 않는다 → 되돌리기 가능.
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");

const KEY_RE = /^(\d{4}-\d{2}-\d{2})_(.+)$/;
const rows = (await query(`SELECT id, room_name, date, stock, data FROM inventory_overrides ORDER BY id`)).results;

// ── 사전 감사 ──
console.log("=== 적용 전 ===");
console.log("  총", rows.length, "건 | date NULL:", rows.filter(r=>r.date===null).length, "| stock NULL:", rows.filter(r=>r.stock===null).length);

const plan = [];
const skip = [];
for (const r of rows) {
  const m = KEY_RE.exec(r.id);
  if (!m) { skip.push(r.id); continue; }              // 랜덤 id = 레거시 미조회 → 제외
  const [, date, room] = m;
  let avail;
  try { avail = JSON.parse(r.data).available; } catch { avail = undefined; }
  if (typeof avail !== "number") { skip.push(r.id + " (available 없음)"); continue; }
  plan.push({ id: r.id, date, room, avail });
}
console.log("  복구 대상:", plan.length, "| 제외(죽은 데이터):", skip.length);
for (const s of skip) console.log("    - 제외:", s);

// ── 적용 ──
console.log("\n=== 적용 ===");
let n = 0;
for (const p of plan) {
  await query(`UPDATE inventory_overrides SET date = ?, room_name = ?, stock = ? WHERE id = ?`,
    [p.date, p.room, p.avail, p.id]);
  n++;
}
console.log("  갱신:", n, "건");

// ── 사후 감사 ──
console.log("\n=== 적용 후 검증 ===");
let pass = 0, fail = 0;
const ck = (name, cond, x="") => { console.log((cond?"  OK   ":"  FAIL ")+name+(x?" — "+x:"")); cond?pass++:fail++; };

const after = (await query(`SELECT id, room_name, date, stock, data FROM inventory_overrides ORDER BY id`)).results;
ck("행수 불변 (26)", after.length === 26, String(after.length));

// 유효 키는 전부 채워졌나
const valid = after.filter(r => KEY_RE.test(r.id));
ck("유효 키 23건 date 채워짐", valid.every(r => r.date !== null), `${valid.filter(r=>r.date===null).length}건 NULL`);
ck("유효 키 23건 stock 채워짐", valid.every(r => r.stock !== null));

// 죽은 데이터는 여전히 NULL (레거시와 동일하게 무시돼야)
const dead = after.filter(r => !KEY_RE.test(r.id));
ck("죽은 데이터 3건은 NULL 유지 (레거시 동일 무시)", dead.length===3 && dead.every(r => r.date === null), `${dead.length}건`);

// id ↔ 컬럼 일치
ck("date/room_name 이 id와 일치", valid.every(r => r.id === `${r.date}_${r.room_name}`));

// stock 이 json.available 과 일치
ck("stock = json.available", valid.every(r => { try { return JSON.parse(r.data).available === r.stock; } catch { return false; } }));

// 원본 JSON 무손상
ck("원본 data JSON 무손상", after.every(r => { try { JSON.parse(r.data); return true; } catch { return false; } }));

// 레거시가 막아둔 날이 이제 D1에서 조회되나
const blocked = (await query(`SELECT date, room_name FROM inventory_overrides WHERE stock = 0 ORDER BY date, room_name`)).results;
ck("available=0(막은 날) 조회됨: 19건", blocked.length === 19, `${blocked.length}건`);

// 2025-08-05 Forest — 죽은 데이터(3,1,3) 말고 진짜(2)만 잡히나
const f = (await query(`SELECT stock FROM inventory_overrides WHERE room_name='Forest' AND date='2025-08-05'`)).results;
ck("2025-08-05 Forest → 유효값 2 하나만", f.length===1 && f[0].stock===2, JSON.stringify(f.map(x=>x.stock)));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
console.log("되돌리려면: UPDATE inventory_overrides SET date=NULL, room_name=<원래>, stock=NULL  (data JSON은 원본 그대로)");
process.exit(fail ? 1 : 0);
