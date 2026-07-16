// Read-only: dump all Firestore collections to local JSON for migration.
//
// 사용: set -a && source .env.local && set +a && node scripts/migration/dump-all.mjs <출력폴더>
//   예) node scripts/migration/dump-all.mjs F:/backup/choho-firestore-dump-20260801
//
// ⚠️ 출력폴더를 **인자로 반드시 지정**한다. 기본값으로 기존 덤프를 덮어쓰게 두면
//    Firebase 폐기 후 복구 불가능한 원본이 날아간다 (기존: F:\backup\choho-firestore-dump-20260716).
//
// 인증: configstore 의 refresh_token(진짜 자격증명) + firebase-tools CLI 의 **공개** OAuth 클라이언트.
//    client_id/secret 은 firebase-tools 오픈소스에 박힌 공개 상수라 비밀은 아니지만,
//    "인증값 단일 소스 = .env" 원칙에 따라 `.env.local`(gitignore 적용됨)에 둔다.
import fs from "fs";

const OUT = process.argv[2];
if (!OUT) {
  console.error(
    "출력폴더를 지정하세요 — 기존 덤프 덮어쓰기 방지.\n" +
      "  node scripts/migration/dump-all.mjs F:/backup/choho-firestore-dump-YYYYMMDD",
  );
  process.exit(1);
}
if (fs.existsSync(OUT) && fs.readdirSync(OUT).length) {
  console.error(`이미 파일이 있는 폴더입니다: ${OUT}\n덮어쓰지 않는다. 새 폴더를 지정하세요.`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const { FIREBASE_CLI_CLIENT_ID, FIREBASE_CLI_CLIENT_SECRET } = process.env;
if (!FIREBASE_CLI_CLIENT_ID || !FIREBASE_CLI_CLIENT_SECRET) {
  console.error(
    "FIREBASE_CLI_CLIENT_ID / FIREBASE_CLI_CLIENT_SECRET 없음.\n" +
      "  set -a && source .env.local && set +a  로 먼저 로드하세요.",
  );
  process.exit(1);
}

const cfg = JSON.parse(
  fs.readFileSync("C:/Users/flame/.config/configstore/firebase-tools.json", "utf8"),
);
const AT = (
  await (
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: FIREBASE_CLI_CLIENT_ID,
        client_secret: FIREBASE_CLI_CLIENT_SECRET,
        refresh_token: cfg.tokens.refresh_token,
        grant_type: "refresh_token",
      }),
    })
  ).json()
).access_token;

const BASE =
  "https://firestore.googleapis.com/v1/projects/choho-pension/databases/(default)/documents";
const H = { Authorization: `Bearer ${AT}`, "Content-Type": "application/json" };

// Firestore Value → plain JS
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
    default: return v[k];
  }
}

async function dumpCollection(col) {
  let docs = [];
  let pageToken = "";
  do {
    const url = `${BASE}/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const j = await (await fetch(url, { headers: H })).json();
    if (j.error) { console.log(`  ${col}: ERR ${j.error.message}`); return; }
    for (const d of j.documents || []) {
      const obj = { _id: d.name.split("/").pop(), _createTime: d.createTime, _updateTime: d.updateTime };
      for (const [kk, vv] of Object.entries(d.fields || {})) obj[kk] = decode(vv);
      docs.push(obj);
    }
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  fs.writeFileSync(`${OUT}/${col}.json`, JSON.stringify(docs, null, 2));
  console.log(`  ${col.padEnd(22)} ${String(docs.length).padStart(4)}건 → ${col}.json`);
}

const COLS = [
  "reservations", "customers", "rooms", "options", "pricing_rules",
  "inventory_overrides", "settings", "message_templates", "login_attempts",
  "notification_logs", "sms_logs", "marketing_stats_v2",
];

console.log("=== Firestore 덤프 시작 ===");
for (const c of COLS) await dumpCollection(c);
console.log("=== 완료 ===");
