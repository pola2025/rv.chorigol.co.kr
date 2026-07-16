// Phase 2 — migrate notification_logs (819) + sms_logs (267) → notification_log.
import fs from "fs";

const DUMP = "F:/backup/choho-firestore-dump-20260716/";
const ENV = Object.fromEntries(
  fs.readFileSync("F:/rv-chorigol.co.kr/.env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const ACC = ENV.CLOUDFLARE_ACCOUNT_ID;
const DB = "d9bf20dc-68cf-4077-b238-f1efc7e0ab3b";
const CFH = { "X-Auth-Email": ENV.CLOUDFLARE_EMAIL, "X-Auth-Key": ENV.CLOUDFLARE_GLOBAL_API_KEY, "Content-Type": "application/json" };
const load = (f) => JSON.parse(fs.readFileSync(`${DUMP}/${f}.json`, "utf8"));

const q = (v) => {
  if (v === null || v === undefined || v === "") return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
};
async function exec(sql) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`,
    { method: "POST", headers: CFH, body: JSON.stringify({ sql }) });
  const jr = await r.json();
  if (!jr.success) { console.log("실패:", JSON.stringify(jr.errors).slice(0, 300)); throw new Error("fail"); }
}
async function batch(rows, toSql) {
  const stmts = rows.map(toSql).filter(Boolean);
  const CHUNK = 50;
  for (let i = 0; i < stmts.length; i += CHUNK) await exec(stmts.slice(i, i + CHUNK).join("\n"));
  return stmts.length;
}

// Valid reservation ids (for FK — set NULL if orphan)
const resIds = new Set(load("reservations").map((r) => r._id));
const clean = (id) => (id && resIds.has(id) ? id : null);
const preview = (t) => (t ? String(t).replace(/\s+/g, " ").slice(0, 120) : null);

// notification_logs — channel by presence of chatId
const notif = load("notification_logs");
const n1 = await batch(notif, (l) => {
  const channel = l.chatId ? "telegram" : "sms";
  return `INSERT INTO notification_log (reservation_id,channel,kind,status,request_id,message_preview,error,sent_at) VALUES (${q(clean(l.reservationId))},${q(channel)},${q(l.type || "unknown")},${q(l.status || "success")},${q(l.requestId)},${q(preview(l.content || l.messagePreview))},NULL,${q(l.sentAt || l.timestamp || l.createdAt || l._createTime)});`;
});
console.log(`  notification_logs → ${n1}건`);

// sms_logs — all sms
const sms = load("sms_logs");
const n2 = await batch(sms, (l) =>
  `INSERT INTO notification_log (reservation_id,channel,kind,status,request_id,message_preview,error,sent_at) VALUES (${q(clean(l.reservationId))},'sms',${q(l.type || "sms")},${q(l.status || "success")},${q(l.requestId)},${q(preview(l.message))},${q(l.error)},${q(l.timestamp || l._createTime)});`
);
console.log(`  sms_logs → ${n2}건`);

const tot = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`,
  { method: "POST", headers: CFH, body: JSON.stringify({ sql: "SELECT COUNT(*) c, COUNT(DISTINCT channel) ch FROM notification_log" }) }).then((r) => r.json());
console.log(`\n  D1 notification_log 총 ${tot.result[0].results[0].c}건 (원본 ${notif.length + sms.length}) ${tot.result[0].results[0].c === notif.length + sms.length ? "✅" : "❌"}`);
