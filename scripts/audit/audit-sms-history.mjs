// 감사 — SmsHistoryTable 신호등이 레거시와 한 칸도 안 틀리는가.
//
// 레거시(SmsHistoryTable.jsx:111-120)는 **reservation.smsStatus 만** 읽는다.
// 신규는 D1 notification_log 를 읽는다. 두 출력이 같아야 "기존 모습 그대로"다.
//
// 전건 대조: 예약 540 × kind 3 = 1620칸.
//
// 주의 — 이 감사가 잡아내는 진짜 위험:
//   레거시가 안 보던 로그(기존 checkIn 166건)까지 신규가 읽으면 **회색이던 칸이 초록**이 된다.
//   그건 이관이 아니라 화면 변경이다. 그 칸이 몇 개인지, 실제 표시창(최근30일+미래)에
//   들어오는지를 여기서 센다.
//
// 실행: node scripts/audit/audit-sms-history.mjs
import fs from "fs";

const DUMP = "F:/backup/choho-firestore-dump-20260716";
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

async function sql(statement) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/d1/database/${ENV.D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        "X-Auth-Email": ENV.CLOUDFLARE_EMAIL,
        "X-Auth-Key": ENV.CLOUDFLARE_GLOBAL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: statement }),
    },
  );
  const jr = await r.json();
  if (!jr.success) throw new Error(JSON.stringify(jr.errors).slice(0, 300));
  return jr.result[0].results;
}

const KINDS = ["confirmation", "checkIn", "checkOut"];
const legacyLight = (s = {}, kind) => {
  if (s[`${kind}Sent`] === true) return "success";
  if (s[`${kind}Error`]) return "failed";
  return "pending";
};

const reservations = JSON.parse(
  fs.readFileSync(`${DUMP}/reservations.json`, "utf8"),
);

// D1 쪽 신호등 — 신규 화면이 쓸 규칙과 **같아야** 한다.
// success 가 하나라도 있으면 초록, 없고 failed 가 있으면 빨강, 없으면 회색.
const d1rows = await sql(
  `SELECT reservation_id, kind,
          MAX(CASE WHEN status='success' THEN 1 ELSE 0 END) has_success,
          MAX(CASE WHEN status='failed'  THEN 1 ELSE 0 END) has_failed
     FROM notification_log
    WHERE reservation_id IS NOT NULL
      AND channel='sms'
      AND kind IN ('confirmation','checkIn','checkOut')
    GROUP BY reservation_id, kind`,
);
const d1map = new Map(
  d1rows.map((r) => [
    `${r.reservation_id}|${r.kind}`,
    r.has_success ? "success" : r.has_failed ? "failed" : "pending",
  ]),
);
const d1Light = (id, kind) => d1map.get(`${id}|${kind}`) ?? "pending";

let same = 0;
const diffs = [];
for (const r of reservations) {
  for (const kind of KINDS) {
    const a = legacyLight(r.smsStatus, kind);
    const b = d1Light(r._id, kind);
    if (a === b) same++;
    else diffs.push({ id: r._id, room: r.roomName, checkIn: r.checkIn, kind, 레거시: a, D1: b });
  }
}

const total = reservations.length * KINDS.length;
console.log(`=== 신호등 전건 대조: ${same}/${total} ===`);

if (diffs.length) {
  console.log(`\n불일치 ${diffs.length}칸:`);
  const byKind = diffs.reduce(
    (a, d) => ((a[`${d.kind}: ${d.레거시}→${d.D1}`] = (a[`${d.kind}: ${d.레거시}→${d.D1}`] || 0) + 1), a),
    {},
  );
  console.table(byKind);

  // 실제 표시창에 들어오는가 — 레거시 필터 그대로(최근30일+미래, 취소제외, limit 100)
  const ROOM_GROUPS = {
    choho: ["Forest", "Forest mini", "Forest mini 패밀리", "Forest 패밀리"],
    shelter: ["호수뷰객실", "1박2일워크샵", "야유회", "단체예약"],
  };
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const cutoff = d.toISOString().slice(0, 10);
  const visible = new Set();
  for (const biz of Object.keys(ROOM_GROUPS)) {
    reservations
      .filter((r) => r.checkIn >= cutoff)
      .sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)))
      .slice(0, 100)
      .filter((r) => ROOM_GROUPS[biz].includes(r.roomName))
      .filter((r) => r.status !== "예약취소")
      .forEach((r) => visible.add(r._id));
  }
  const visibleDiffs = diffs.filter((x) => visible.has(x.id));
  console.log(`\n표시창(최근30일+미래) 안의 불일치: ${visibleDiffs.length}칸`);
  if (visibleDiffs.length) console.table(visibleDiffs.slice(0, 20));
  else console.log("→ 전부 표시창 밖. 사장님 화면에서는 레거시와 동일하게 보인다.");
} else {
  console.log("✅ 완전 일치");
}
