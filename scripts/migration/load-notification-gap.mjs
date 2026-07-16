// 알림설정 미이관 갭 복구 — 스키마 4컬럼 + 덤프 실값 백필 (2026-07-17)
//
// 배경은 d1/0002_notification_settings_gap.sql 주석 참조.
// 멱등이다 — 이미 있는 컬럼은 건너뛰고, 백필은 덤프값으로 덮어쓴다.
//
// 안전장치: 쓰기 전에 대상 행 원본을 캡처해 출력한다.
//   (교훈 2026-07-16: COUNT(*) 복구검증은 "생성"만 잡고 "수정"을 못 잡는다)
import fs from "node:fs";
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");

const DUMP = "F:/backup/choho-firestore-dump-20260716/settings.json";
const raw = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const docs = Array.isArray(raw) ? raw : Object.values(raw);
const getDoc = (id) => docs.find((d) => (d._id || d.id) === id);

const BUSINESSES = ["choho", "shelter"];

// ── 0. 원본 캡처 ──
const before = await query(
  `SELECT business, room_name, kind, enabled, confirmation_enabled,
          checkin_enabled, checkout_enabled FROM room_templates ORDER BY id`,
);
console.log(`원본 캡처: room_templates ${before.results.length}행`);
fs.writeFileSync(
  "scripts/migration/.notification-gap-before.json",
  JSON.stringify(before.results, null, 2),
);

// ── 1. 스키마 (멱등) ──
const cols = async (t) =>
  (await query(`PRAGMA table_info(${t})`)).results.map((r) => r.name);

const ADDS = [
  ["sms_config", "auto_send_daily", "INTEGER NOT NULL DEFAULT 1"],
  ["room_templates", "cancellation_enabled", "INTEGER NOT NULL DEFAULT 0"],
  ["room_templates", "checkin_hours_before", "INTEGER NOT NULL DEFAULT 3"],
  ["room_templates", "checkout_hours_before", "INTEGER NOT NULL DEFAULT 1"],
];

for (const [table, col, decl] of ADDS) {
  if ((await cols(table)).includes(col)) {
    console.log(`  = ${table}.${col} 이미 있음 — 건너뜀`);
    continue;
  }
  await query(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
  console.log(`  + ${table}.${col} 추가됨`);
}

// ── 2. 백필: sms_config.auto_send_daily ──
console.log("\n[백필] sms_config.auto_send_daily");
for (const business of BUSINESSES) {
  const doc = getDoc(`notifications_v2_${business}`);
  if (!doc) throw new Error(`덤프에 notifications_v2_${business} 없음`);
  // 레거시 기본값: 명시적으로 false 가 아니면 발송 (functions/src/notifications.js:504 와 동일 규칙)
  const v = doc.globalSettings?.telegram?.autoSendDaily !== false ? 1 : 0;
  await query(`UPDATE sms_config SET auto_send_daily = ? WHERE business = ?`, [
    v,
    business,
  ]);
  console.log(`  ${business}: autoSendDaily = ${v}`);
}

// ── 3. 백필: room_templates 3컬럼 (객실당 4행 함께) ──
console.log("\n[백필] room_templates — 객실 단위로 4행 함께 갱신");
let touched = 0;
for (const business of BUSINESSES) {
  const doc = getDoc(`notifications_v2_${business}`);
  for (const [roomName, rs] of Object.entries(doc.roomSettings || {})) {
    const a = rs?.autoSend || {};
    const cancel = a.cancellationEnabled === true ? 1 : 0;
    const inH = Number.isFinite(a.checkInHoursBefore) ? a.checkInHoursBefore : 3;
    const outH = Number.isFinite(a.checkOutHoursBefore)
      ? a.checkOutHoursBefore
      : 1;

    const r = await query(
      `UPDATE room_templates
         SET cancellation_enabled = ?, checkin_hours_before = ?, checkout_hours_before = ?
       WHERE business = ? AND room_name = ?`,
      [cancel, inH, outH, business, roomName],
    );
    const n = r.meta?.changes ?? 0;
    touched += n;
    console.log(
      `  [${business}/${roomName}] cancel=${cancel} in=${inH}h out=${outH}h → ${n}행`,
    );
    if (n !== 4)
      console.warn(
        `    ⚠️ 4행이 아니다 (${n}행) — kind 행 복제 불변식 확인 필요`,
      );
  }
}
console.log(`\n총 ${touched}행 갱신`);

// ── 4. 검증 ──
console.log("\n[검증] 기존 컬럼이 안 변했는가 (원본 대조)");
const after = await query(
  `SELECT business, room_name, kind, enabled, confirmation_enabled,
          checkin_enabled, checkout_enabled FROM room_templates ORDER BY id`,
);
const a = JSON.stringify(before.results);
const b = JSON.stringify(after.results);
console.log(a === b ? "  ✅ 기존 컬럼 무변경" : "  ❌ 기존 컬럼이 변했다!");
if (a !== b) process.exitCode = 1;

const chk = await query(
  `SELECT business, room_name, kind, cancellation_enabled AS c,
          checkin_hours_before AS i, checkout_hours_before AS o
   FROM room_templates ORDER BY business, room_name, kind`,
);
// 객실당 4행이 같은 값인지 (복제 불변식)
const byRoom = {};
for (const r of chk.results) {
  const k = `${r.business}/${r.room_name}`;
  (byRoom[k] ||= []).push(`${r.c}|${r.i}|${r.o}`);
}
let ok = true;
for (const [k, vals] of Object.entries(byRoom)) {
  const uniq = [...new Set(vals)];
  if (uniq.length !== 1 || vals.length !== 4) {
    console.log(`  ❌ ${k}: ${vals.length}행 / 값 ${uniq.length}종 ${JSON.stringify(uniq)}`);
    ok = false;
  }
}
console.log(
  ok
    ? `  ✅ 복제 불변식 유지 — ${Object.keys(byRoom).length}객실 전부 4행 동일값`
    : "  ❌ 복제 불변식 깨짐",
);
if (!ok) process.exitCode = 1;

const sc = await query(
  `SELECT business, auto_send_daily FROM sms_config ORDER BY business`,
);
console.log("  sms_config:", JSON.stringify(sc.results));
