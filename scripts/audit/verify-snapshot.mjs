// loadSnapshot() 실모듈 검증 — 원본 덤프와 전건 대조 + 레거시 정렬 재현 확인.
import fs from "node:fs";
const { loadSnapshot } = await import("file:///F:/rv-chorigol.co.kr/lib/legacy-shape.js");
const D = "F:/backup/choho-firestore-dump-20260716/";
const load = (f) => { const r = JSON.parse(fs.readFileSync(D + f + ".json", "utf8")); return Array.isArray(r) ? r : Object.values(r); };

const IGNORE = new Set(["smsStatus","notificationStatus","customerPhone","guestCount",
  "created","updated","selectedOptions","dailyPrices","confirmedAt","id"]);
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_") && !IGNORE.has(k)));
const norm = (v) => (v === undefined || v === "" ? null : v);
const eq = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

let pass = 0, fail = 0;
const ck = (n, c, x = "") => { console.log((c ? "  OK   " : "  FAIL ") + n + (x ? ` — ${x}` : "")); c ? pass++ : fail++; };

console.log("loadSnapshot() 호출...");
const t0 = Date.now();
const snap = await loadSnapshot();
console.log(`  ${Date.now() - t0}ms\n`);

// ── 스토어 상태 키가 그대로인가 ──
console.log("[스토어 모양]");
const KEYS = ["rooms","reservations","overrides","blockedDates","pricingRules","options","customers"];
ck("7개 컬렉션 키 일치", JSON.stringify(Object.keys(snap).sort()) === JSON.stringify([...KEYS].sort()), Object.keys(snap).join(","));
ck("blockedDates = [] (Firestore에도 없던 컬렉션)", Array.isArray(snap.blockedDates) && snap.blockedDates.length === 0);
ck("overrides 는 배열이 아니라 맵", !Array.isArray(snap.overrides) && typeof snap.overrides === "object");

// ── 건수 ──
console.log("\n[건수]");
ck(`rooms ${snap.rooms.length} = 7`, snap.rooms.length === 7);
ck(`reservations ${snap.reservations.length} = 540`, snap.reservations.length === 540);
ck(`options ${snap.options.length} = 4`, snap.options.length === 4);
ck(`pricingRules ${snap.pricingRules.length} = 4`, snap.pricingRules.length === 4);
ck(`customers ${snap.customers.length} = 402`, snap.customers.length === 402);
ck(`overrides ${Object.keys(snap.overrides).length} = 26`, Object.keys(snap.overrides).length === 26);

// ── 레거시 정렬 재현 ──
console.log("\n[정렬 — 레거시 orderBy 재현]");
const roomOrders = snap.rooms.map((r) => r.order);
ck("rooms: order 오름차순", roomOrders.every((v, i) => i === 0 || roomOrders[i-1] <= v), JSON.stringify(roomOrders));
const cis = snap.reservations.map((r) => r.checkIn);
ck("reservations: checkIn 내림차순", cis.every((v, i) => i === 0 || cis[i-1] >= v), `${cis[0]} … ${cis[cis.length-1]}`);
const lvd = snap.customers.map((c) => c.lastVisitDate).filter(Boolean);
ck("customers: lastVisitDate 내림차순", lvd.every((v, i) => i === 0 || lvd[i-1] >= v), `${lvd[0]} … ${lvd[lvd.length-1]}`);

// ── 필드 전건 대조 ──
const cmp = (label, got, src, keyFn = (x) => x._id) => {
  const byId = Object.fromEntries(got.map((g) => [g.id, g]));
  const fails = {};
  const samples = [];
  for (const s of src) {
    const g = byId[keyFn(s)];
    if (!g) { fails.__missing = (fails.__missing || 0) + 1; continue; }
    for (const [k, v] of Object.entries(strip(s))) {
      if (k === "options") {
        const nm = (o) => (typeof o === "object" && o ? o.name : o);
        const pr = (o) => (typeof o === "object" && o ? o.price || 0 : 0);
        const a = (v || []).filter(Boolean).map((o) => `${nm(o)}:${pr(o)}`).sort().join(",");
        const b = (g.options || []).map((o) => `${nm(o)}:${pr(o)}`).sort().join(",");
        if (a !== b) { fails.options = (fails.options||0)+1; if (samples.length<3) samples.push(`${s._id}.options [${a}]≠[${b}]`); }
        continue;
      }
      if (!eq(g[k], v)) {
        fails[k] = (fails[k]||0)+1;
        if (samples.length<3) samples.push(`${s._id}.${k}: 원본=${JSON.stringify(v)} 복원=${JSON.stringify(g[k])}`);
      }
    }
  }
  ck(`${label} 전필드 일치`, Object.keys(fails).length === 0, Object.keys(fails).length ? JSON.stringify(fails) : "");
  for (const s of samples) console.log("    ·", s);
};

console.log("\n[필드 대조 — 실모듈 출력 vs 원본 덤프]");
cmp("rooms", snap.rooms, load("rooms"));
cmp("reservations", snap.reservations, load("reservations"));
cmp("options", snap.options, load("options"));
cmp("pricingRules", snap.pricingRules, load("pricing_rules"));
cmp("customers", snap.customers, load("customers"));   // ← 처음 검증

// overrides 맵
const srcOv = Object.fromEntries(load("inventory_overrides").map((o) => [o._id, o.available]));
ck("overrides 맵 일치 (doc.id 키)", JSON.stringify(snap.overrides) === JSON.stringify(srcOv));

// ── 실제 사용 샘플 ──
console.log("\n[샘플 — 컴포넌트가 보게 될 모양]");
console.log("  rooms[0]:", JSON.stringify(snap.rooms[0]).slice(0, 130));
console.log("  reservations[0]:", JSON.stringify(snap.reservations[0]).slice(0, 130));
console.log("  customers[0]:", JSON.stringify(snap.customers[0]).slice(0, 130));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
