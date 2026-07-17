// Phase 2 verification: compare Firestore dump vs D1 (counts, sums, integrity).
import fs from "fs";

const DUMP = "F:/backup/choho-firestore-dump-20260716";
const ENV = Object.fromEntries(
  fs.readFileSync("F:/rv-chorigol.co.kr/.env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const ACC = ENV.CLOUDFLARE_ACCOUNT_ID;
const DB = "d9bf20dc-68cf-4077-b238-f1efc7e0ab3b";
const CFH = { "X-Auth-Email": ENV.CLOUDFLARE_EMAIL, "X-Auth-Key": ENV.CLOUDFLARE_GLOBAL_API_KEY, "Content-Type": "application/json" };
const load = (f) => JSON.parse(fs.readFileSync(`${DUMP}/${f}.json`, "utf8"));

async function d1(sql) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`,
    { method: "POST", headers: CFH, body: JSON.stringify({ sql }) });
  const jr = await r.json();
  if (!jr.success) throw new Error(JSON.stringify(jr.errors));
  return jr.result[0].results;
}

const ok = (a, b) => (a === b ? "✅" : "❌ 불일치!");
let fail = 0;
function row(label, src, d1v) { if (src !== d1v) fail++; console.log(`  ${label.padEnd(28)} 원본 ${String(src).padStart(12)} | D1 ${String(d1v).padStart(12)}  ${ok(src, d1v)}`); }

console.log("=== 건수 대조 ===");
const rsv = load("reservations");
row("reservations", rsv.length, (await d1("SELECT COUNT(*) c FROM reservations"))[0].c);
row("customers", load("customers").length, (await d1("SELECT COUNT(*) c FROM customers"))[0].c);
row("rooms", load("rooms").length, (await d1("SELECT COUNT(*) c FROM rooms"))[0].c);
row("options", load("options").length, (await d1("SELECT COUNT(*) c FROM options"))[0].c);
row("pricing_rules", load("pricing_rules").length, (await d1("SELECT COUNT(*) c FROM pricing_rules"))[0].c);
row("inventory_overrides", load("inventory_overrides").length, (await d1("SELECT COUNT(*) c FROM inventory_overrides"))[0].c);

// reservation_options expected
// ⚠️ 원본 options 는 **객체배열과 문자열배열이 섞여** 있다(`[{name,price}]` / `["숯불바베큐"]`).
//    옛 기대식은 `o && o.name` 으로 걸러 문자열 5건을 못 셌다 — 로더가 데이터를 유실한 것과
//    **같은 버그**라 366 을 "정답"으로 굳혀 유실을 가려줬다. 복구 후 D1 은 371(=덤프 전량).
//    지금은 로더(lib/reservations.js replaceOptions)와 같은 규칙으로 센다.
const optName = (o) => (typeof o === "object" && o !== null ? o.name : o);
const expOpts = rsv.reduce((n, r) => n + (r.options || []).filter((o) => optName(o)).length, 0);
row("reservation_options", expOpts, (await d1("SELECT COUNT(*) c FROM reservation_options"))[0].c);

console.log("\n=== 금액 합계 대조 (정합성 핵심) ===");
const srcTotal = rsv.reduce((s, r) => s + (r.totalPrice || 0), 0);
row("SUM(total_price)", srcTotal, (await d1("SELECT COALESCE(SUM(total_price),0) s FROM reservations"))[0].s);
const srcBase = rsv.reduce((s, r) => s + (r.basePrice || 0), 0);
row("SUM(base_price)", srcBase, (await d1("SELECT COALESCE(SUM(base_price),0) s FROM reservations"))[0].s);

console.log("\n=== 상태별 분포 대조 ===");
const byStatus = {};
rsv.forEach((r) => (byStatus[r.status] = (byStatus[r.status] || 0) + 1));
const d1Status = await d1("SELECT status, COUNT(*) c FROM reservations GROUP BY status");
const d1Map = Object.fromEntries(d1Status.map((r) => [r.status, r.c]));
for (const st of Object.keys(byStatus)) row(`  ${st}`, byStatus[st], d1Map[st] || 0);

console.log("\n=== 무결성 검사 ===");
const orphan = (await d1("SELECT COUNT(*) c FROM reservation_options WHERE reservation_id NOT IN (SELECT id FROM reservations)"))[0].c;
row("고아 옵션 (0이어야)", 0, orphan);
const nullPhone = (await d1("SELECT COUNT(*) c FROM reservations WHERE phone IS NULL OR phone=''"))[0].c;
console.log(`  전화번호 없는 예약        ${nullPhone}건 ${nullPhone > 0 ? "(원본에도 없었는지 확인)" : "✅"}`);
const badDate = (await d1("SELECT COUNT(*) c FROM reservations WHERE check_in NOT LIKE '____-__-__'"))[0].c;
row("체크인 날짜 형식 이상", 0, badDate);

console.log("\n=== business 분류 대조 ===");
const bizD1 = await d1("SELECT business, COUNT(*) c FROM rooms GROUP BY business");
bizD1.forEach((r) => console.log(`  rooms.${r.business.padEnd(8)} ${r.c}건`));

console.log("\n=== 김태연 샘플 (개별 정합성) ===");
const kim = (await d1("SELECT customer_name,phone,room_name,check_in,check_out,guests,total_price,status FROM reservations WHERE id='Z7A5wFjlVgX5VtZdQ2XQ'"))[0];
console.log("  " + JSON.stringify(kim));

console.log("\n" + "=".repeat(50));
console.log(fail === 0 ? "🎉 전 항목 일치 — 이관 정합성 확인됨" : `⚠️ ${fail}개 항목 불일치 — 확인 필요`);
