// 라이브 Firestore 의 smsStatus → D1 notification_log (특정 날짜분).
//
// 왜 필요한가: `backfill-sms-status.mjs` 는 **7/16 덤프 파일**을 읽는다. 그 덤프 이후에 CF 가
// 보낸 문자는 Firestore 에만 기록되고 D1 엔 없다 → **신호기가 회색으로 보인다**(발송했는데도).
// 실제로 2026-07-17 13:00 입실안내 8건이 그 상태였다 (컷오버 당일, CF 의 마지막 발송).
//
// ⚠️ **Firebase 를 폐기(Phase 8)하면 이 기록은 영영 사라진다.** 폐기 전에 확보해야 한다.
//
// 사용:
//   set -a && source .env.local && set +a
//   node scripts/migration/backfill-live-smsstatus.mjs 2026-07-17          (드라이런)
//   node scripts/migration/backfill-live-smsstatus.mjs 2026-07-17 --apply  (실제 쓰기)
//
// 안전장치 (backfill-sms-status.mjs 와 동일):
//   · INSERT 전용 (UPDATE/DELETE 없음)
//   · 멱등 — 이미 (reservation_id, kind) 행이 있으면 건너뛴다
//   · 기본 드라이런. 실제 쓰기는 --apply
//   · 쓰기 전 MAX(id) 를 롤백 파일에 남긴다 → DELETE FROM notification_log WHERE id > N
import fs from "fs";

const DATE = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE || "")) {
  console.error("날짜를 지정하세요: node scripts/migration/backfill-live-smsstatus.mjs 2026-07-17 [--apply]");
  process.exit(1);
}
const ROLLBACK = `F:/rv-chorigol.co.kr/scripts/migration/.backfill-live-${DATE}.rollback.json`;

// .env.local 직접 파싱 — 낡은 사용자 환경변수 D1_DATABASE_ID 를 이기기 위해 (다른 마이그 스크립트와 동일)
const ENV = Object.fromEntries(
  fs
    .readFileSync("F:/rv-chorigol.co.kr/.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const ACC = ENV.CLOUDFLARE_ACCOUNT_ID;
const DB = ENV.D1_DATABASE_ID;
// 스코프 토큰 우선 (컷오버 때 발급). 없으면 Global Key 폴백 — lib/d1.js 와 같은 규칙
const CFH = ENV.CLOUDFLARE_D1_TOKEN
  ? { Authorization: `Bearer ${ENV.CLOUDFLARE_D1_TOKEN}`, "Content-Type": "application/json" }
  : { "X-Auth-Email": ENV.CLOUDFLARE_EMAIL, "X-Auth-Key": ENV.CLOUDFLARE_GLOBAL_API_KEY, "Content-Type": "application/json" };

async function sql(statement) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`, {
    method: "POST",
    headers: CFH,
    body: JSON.stringify({ sql: statement }),
  });
  const jr = await r.json();
  if (!jr.success) {
    console.log("D1 실패:", JSON.stringify(jr.errors).slice(0, 300));
    throw new Error("D1 쿼리 실패");
  }
  return jr.result[0].results;
}
const q = (v) => {
  if (v === null || v === undefined || v === "") return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
};

// ── Firestore 인증 (dump-all.mjs 와 동일한 경로) ──────────────────
const cfg = JSON.parse(fs.readFileSync("C:/Users/flame/.config/configstore/firebase-tools.json", "utf8"));
const AT = (
  await (
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: ENV.FIREBASE_CLI_CLIENT_ID,
        client_secret: ENV.FIREBASE_CLI_CLIENT_SECRET,
        refresh_token: cfg.tokens.refresh_token,
        grant_type: "refresh_token",
      }),
    })
  ).json()
).access_token;
if (!AT) {
  console.error("❌ Firestore 액세스 토큰 발급 실패");
  process.exit(1);
}
const FS_BASE = "https://firestore.googleapis.com/v1/projects/choho-pension/databases/(default)/documents";

function decode(v) {
  if (v == null) return null;
  const k = Object.keys(v)[0];
  switch (k) {
    case "nullValue": return null;
    case "booleanValue": return v.booleanValue;
    case "integerValue": return Number(v.integerValue);
    case "doubleValue": return v.doubleValue;
    case "timestampValue": return v.timestampValue;
    case "stringValue": return v.stringValue;
    case "arrayValue": return (v.arrayValue.values || []).map(decode);
    case "mapValue": {
      const o = {};
      for (const [kk, vv] of Object.entries(v.mapValue.fields || {})) o[kk] = decode(vv);
      return o;
    }
    default: return null;
  }
}

// 레거시 getSmsStatus() 그대로 (SmsHistoryTable.jsx:111-120) — 벗어나면 신호등이 달라진다
const legacyLight = (s = {}, kind) => {
  if (s[`${kind}Sent`] === true) return "success";
  if (s[`${kind}Error`]) return "failed";
  return "pending";
};
const KINDS = ["confirmation", "checkIn", "checkOut"];

// ── 대상 예약: 그 날짜에 입실 또는 퇴실하는 확정 예약 (D1 기준) ────────
const targets = await sql(
  `SELECT id, customer_name, room_name, check_in, check_out FROM reservations
   WHERE (check_in = '${DATE}' OR check_out = '${DATE}') AND status = '예약확정'`,
);
console.log(`대상 예약(${DATE} 입실/퇴실, 확정): ${targets.length}건`);
if (!targets.length) {
  console.log("대상 없음. 종료.");
  process.exit(0);
}

// ── 라이브 Firestore 에서 각 예약 문서를 읽어 smsStatus 확보 ──────────
const docs = [];
for (const t of targets) {
  const r = await fetch(`${FS_BASE}/reservations/${t.id}`, { headers: { Authorization: `Bearer ${AT}` } });
  if (!r.ok) {
    console.log(`  ⚠️ Firestore 에 없음: ${t.id} (${t.customer_name}) — 신규 예약이면 정상`);
    continue;
  }
  const j = await r.json();
  const f = {};
  for (const [k, v] of Object.entries(j.fields || {})) f[k] = decode(v);
  docs.push({ ...t, smsStatus: f.smsStatus || {}, updatedAt: f.updatedAt, _updateTime: j.updateTime });
}
console.log(`Firestore 에서 읽은 문서: ${docs.length}건`);

// ── 이미 D1 에 있는 (예약, kind) ─────────────────────────────────
const existing = new Set(
  (
    await sql(
      `SELECT DISTINCT reservation_id, kind FROM notification_log
       WHERE reservation_id IS NOT NULL AND kind IN ('confirmation','checkIn','checkOut')`,
    )
  ).map((r) => `${r.reservation_id}|${r.kind}`),
);

const rows = [];
let skipped = 0;
for (const d of docs) {
  for (const kind of KINDS) {
    const light = legacyLight(d.smsStatus, kind);
    if (light === "pending") continue; // 미발송은 행 없음 = 회색 (레거시와 같다)
    if (existing.has(`${d.id}|${kind}`)) {
      skipped++;
      continue;
    }
    const s = d.smsStatus;
    const sentAt =
      light === "failed"
        ? (s[`${kind}ErrorAt`] ?? s[`${kind}SentAt`] ?? d.updatedAt ?? d._updateTime)
        : (s[`${kind}SentAt`] ?? d.updatedAt ?? d._updateTime);
    rows.push({
      reservation_id: d.id,
      kind,
      status: light,
      request_id: s[`${kind}RequestId`] ?? null,
      error: light === "failed" ? String(s[`${kind}Error`]).slice(0, 200) : null,
      sent_at: sentAt,
      who: `${d.customer_name}(${d.room_name})`,
    });
  }
}

const byKind = rows.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {});
const byStatus = rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
console.log(`\n삽입 대상: ${rows.length}행`, byKind, byStatus);
console.log(`이미 있어서 건너뜀: ${skipped}행`);
rows.forEach((r) => console.log(`  · ${r.kind.padEnd(12)} ${r.status.padEnd(7)} ${r.sent_at} ${r.who}`));

if (rows.some((r) => !r.sent_at)) {
  console.log("\n❌ sent_at 이 빈 행이 있다 — NOT NULL 위반. 중단.");
  process.exit(1);
}
if (!rows.length) {
  console.log("\n넣을 게 없다 (이미 다 있거나 발송 이력 없음). 종료.");
  process.exit(0);
}
if (!APPLY) {
  console.log("\n드라이런이다. 실제로 넣으려면 --apply");
  process.exit(0);
}

const before = (await sql("SELECT COUNT(*) c, MAX(id) m FROM notification_log"))[0];
fs.writeFileSync(
  ROLLBACK,
  JSON.stringify(
    { at: new Date().toISOString(), date: DATE, before_count: before.c, before_max_id: before.m, inserting: rows.length, rollback_sql: `DELETE FROM notification_log WHERE id > ${before.m}`, rows },
    null,
    2,
  ),
);
console.log(`\n롤백 파일: ${ROLLBACK}`);
console.log(`쓰기 전 ${before.c}행 (max_id ${before.m})`);

const stmts = rows.map(
  (r) =>
    `INSERT INTO notification_log (reservation_id,channel,kind,status,request_id,message_preview,error,sent_at) VALUES (${q(r.reservation_id)},'sms',${q(r.kind)},${q(r.status)},${q(r.request_id)},NULL,${q(r.error)},${q(r.sent_at)});`,
);
for (let i = 0; i < stmts.length; i += 50) await sql(stmts.slice(i, i + 50).join("\n"));

const after = (await sql("SELECT COUNT(*) c, MAX(id) m FROM notification_log"))[0];
const grew = after.c - before.c;
console.log(`쓰기 후 ${after.c}행 (max_id ${after.m}) — ${grew}행 증가`);
console.log(grew === rows.length ? "✅ 삽입 건수 일치" : `❌ 예상 ${rows.length} ≠ 실제 ${grew} — 롤백 검토`);
process.exit(grew === rows.length ? 0 : 1);
