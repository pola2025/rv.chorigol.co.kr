// 갭 복구 — reservations.smsStatus MAP → notification_log (로더가 빠뜨린 여섯 번째 갭).
//
// 스키마(0001_initial_schema.sql:66)는 "예약 문서의 smsStatus / notificationStatus MAP 흡수"라고
// 선언해 놓고, load-logs.mjs 는 notification_logs(819) + sms_logs(267) 두 컬렉션만 넣었다.
// smsStatus 는 **아무도 안 옮겼다** → SmsHistoryTable 의 신호등 3종 중
// confirmation·checkOut 은 D1 에 소스 자체가 없다(실측: 두 kind 행 0건).
//
// 측정 결과(덤프 원본):
//   · smsStatus 보유 예약 255건 → 파생 행 635 (confirmation 218 / checkOut 214 / checkIn 203)
//   · 기존 checkIn 로그 166건과 겹치는 예약은 **1건뿐** → 중복 위험 사실상 없음
//   · sms_logs 는 kind='sms' 라 confirmation/checkIn/checkOut 과 절대 충돌하지 않음
//
// 안전장치:
//   · INSERT 전용 (UPDATE/DELETE 없음)
//   · 멱등 — 이미 (reservation_id, kind) 행이 있으면 건너뛴다. 재실행해도 안 늘어난다
//   · 기본은 드라이런. 실제 쓰기는 --apply
//   · 쓰기 전 MAX(id) 를 롤백 파일에 남긴다 → DELETE FROM notification_log WHERE id > N
//
// 실행: node scripts/migration/backfill-sms-status.mjs [--apply]
import fs from "fs";

const DUMP = "F:/backup/choho-firestore-dump-20260716";
const ROLLBACK = "F:/rv-chorigol.co.kr/scripts/migration/.backfill-sms-status.rollback.json";
const APPLY = process.argv.includes("--apply");

// .env.local 을 직접 읽는다 — Windows 사용자 환경변수에 **낡은 D1_DATABASE_ID 가 박혀 있어서**
// (a10f8ed6…, 다른 계정의 DB) node --env-file 이나 process.env 를 믿으면 엉뚱한 DB 를 친다.
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
const CFH = {
  "X-Auth-Email": ENV.CLOUDFLARE_EMAIL,
  "X-Auth-Key": ENV.CLOUDFLARE_GLOBAL_API_KEY,
  "Content-Type": "application/json",
};

async function sql(statement) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`,
    { method: "POST", headers: CFH, body: JSON.stringify({ sql: statement }) },
  );
  const jr = await r.json();
  if (!jr.success) {
    console.log("실패:", JSON.stringify(jr.errors).slice(0, 300));
    throw new Error("D1 쿼리 실패");
  }
  return jr.result[0].results;
}

const q = (v) => {
  if (v === null || v === undefined || v === "") return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const KINDS = ["confirmation", "checkIn", "checkOut"];

// 레거시 getSmsStatus() 그대로 (SmsHistoryTable.jsx:111-120) — 여기서 벗어나면 신호등이 달라진다
const legacyLight = (s = {}, kind) => {
  if (s[`${kind}Sent`] === true) return "success";
  if (s[`${kind}Error`]) return "failed";
  return "pending";
};

const reservations = JSON.parse(
  fs.readFileSync(`${DUMP}/reservations.json`, "utf8"),
);
const withSms = reservations.filter(
  (r) => r.smsStatus && Object.keys(r.smsStatus).length,
);

// 이미 있는 (reservation_id, kind) — 재실행 안전 + 기존 checkIn 로그 166건 보존
const existing = new Set(
  (
    await sql(
      `SELECT DISTINCT reservation_id, kind FROM notification_log
       WHERE reservation_id IS NOT NULL AND kind IN ('confirmation','checkIn','checkOut')`,
    )
  ).map((r) => `${r.reservation_id}|${r.kind}`),
);
console.log(`기존 (예약,kind) 행: ${existing.size}건 — 이건 건드리지 않는다`);

const rows = [];
let skipped = 0;
for (const r of withSms) {
  for (const kind of KINDS) {
    const light = legacyLight(r.smsStatus, kind);
    if (light === "pending") continue; // 미발송은 행 없음 = 회색 (레거시와 같다)
    if (existing.has(`${r._id}|${kind}`)) {
      skipped++;
      continue;
    }
    const s = r.smsStatus;
    // sent_at 은 NOT NULL. checkIn/checkOut 실패 30건은 ErrorAt 이 없어(실측) updatedAt 으로 근사한다.
    // 신호등은 status 만 보므로 이 근사가 화면을 바꾸지 않는다 (정렬·통계용 필드).
    const sentAt =
      light === "failed"
        ? (s[`${kind}ErrorAt`] ?? s[`${kind}SentAt`] ?? r.updatedAt ?? r._updateTime)
        : (s[`${kind}SentAt`] ?? r.updatedAt ?? r._updateTime);
    rows.push({
      reservation_id: r._id,
      channel: "sms",
      kind,
      status: light,
      request_id: s[`${kind}RequestId`] ?? null,
      error: light === "failed" ? String(s[`${kind}Error`]).slice(0, 200) : null,
      sent_at: sentAt,
    });
  }
}

const byKind = rows.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {});
const byStatus = rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
console.log(`\n삽입 대상: ${rows.length}행`, byKind, byStatus);
console.log(`이미 있어서 건너뜀: ${skipped}행`);
if (rows.some((r) => !r.sent_at)) {
  console.log("❌ sent_at 이 빈 행이 있다 — NOT NULL 위반. 중단.");
  process.exit(1);
}

if (!APPLY) {
  console.log("\n드라이런이다. 실제로 넣으려면 --apply");
  process.exit(0);
}

const before = (await sql("SELECT COUNT(*) c, MAX(id) m FROM notification_log"))[0];
fs.writeFileSync(
  ROLLBACK,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      before_count: before.c,
      before_max_id: before.m,
      inserting: rows.length,
      rollback_sql: `DELETE FROM notification_log WHERE id > ${before.m}`,
      rows,
    },
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
console.log(
  grew === rows.length
    ? "✅ 삽입 건수 일치"
    : `❌ 예상 ${rows.length} ≠ 실제 ${grew} — 롤백 검토`,
);
