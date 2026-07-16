// Phase 2 — transform Firestore dump → D1 (core operational tables).
// Secrets (SENS/telegram keys) are intentionally NOT loaded yet (pending decision).
import fs from "fs";

const DUMP = "F:/backup/choho-firestore-dump-20260716/";
const ENV = Object.fromEntries(
  fs.readFileSync("F:/rv-chorigol.co.kr/.env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const ACC = ENV.CLOUDFLARE_ACCOUNT_ID;
const DB = "d9bf20dc-68cf-4077-b238-f1efc7e0ab3b";
const CFH = {
  "X-Auth-Email": ENV.CLOUDFLARE_EMAIL,
  "X-Auth-Key": ENV.CLOUDFLARE_GLOBAL_API_KEY,
  "Content-Type": "application/json",
};

const load = (f) => JSON.parse(fs.readFileSync(`${DUMP}/${f}.json`, "utf8"));
const biz = (name) => (name && name.includes("Forest") ? "choho" : "shelter");

// SQL literal escaping
const q = (v) => {
  if (v === null || v === undefined || v === "") return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const j = (v) => (v == null ? "NULL" : "'" + JSON.stringify(v).replace(/'/g, "''") + "'");

async function exec(sql) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`,
    { method: "POST", headers: CFH, body: JSON.stringify({ sql }) },
  );
  const jr = await r.json();
  if (!jr.success) {
    console.log("  SQL 실패:", JSON.stringify(jr.errors).slice(0, 300));
    throw new Error("d1 query failed");
  }
  return jr;
}

async function batchInsert(label, rows, toSql) {
  if (!rows.length) { console.log(`  ${label}: 0건`); return; }
  const stmts = rows.map(toSql).filter(Boolean);
  const CHUNK = 60;
  let done = 0;
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await exec(stmts.slice(i, i + CHUNK).join("\n"));
    done += Math.min(CHUNK, stmts.length - i);
  }
  console.log(`  ${label.padEnd(20)} ${String(done).padStart(4)}건 적재`);
}

// ── rooms ──
const rooms = load("rooms");
await batchInsert("rooms", rooms, (r) => {
  const name = r["객실명"];
  return `INSERT INTO rooms (id,name,business,base_price,weekday_price,weekend_price,extra_guest_fee,base_guests,max_guests,base_stock,stock,description,sort_order,is_active,created_at,updated_at) VALUES (${q(r._id)},${q(name)},${q(biz(name))},${q(r["기본요금"])},${q(r["주중요금"])},${q(r["주말요금"])},${q(r["추가인원요금"])},${q(r["기준인원"])},${q(r["최대인원"])},${q(r["기본재고"])},${q(r["재고"])},${q(r["설명"])},${q(r.order ?? 0)},${q(r.isActive !== false)},${q(r.createdAt || r.created)},${q(r.updatedAt || r.updated)});`;
});

// ── reservations + reservation_options ──
const reservations = load("reservations");
await batchInsert("reservations", reservations, (r) => {
  const phone = r.phone || r.customerPhone || "";
  const guests = r.guests ?? r.guestCount ?? 2;
  return `INSERT INTO reservations (id,customer_name,phone,room_name,check_in,check_out,guests,status,source,depositor_name,memo,base_price,room_price,option_price,onsite_price,extra_guest_price,total_price,cancel_reason,cancellation_fee,refund_amount,refund_rate,canceled_at,created_at,updated_at) VALUES (${q(r._id)},${q(r.customerName)},${q(phone)},${q(r.roomName)},${q(r.checkIn)},${q(r.checkOut)},${q(guests)},${q(r.status)},${q(r.source)},${q(r.depositorName)},${q(r.memo)},${q(r.basePrice ?? 0)},${q(r.roomPrice ?? 0)},${q(r.optionPrice ?? 0)},${q(r.onsitePrice ?? 0)},${q(r.extraGuestPrice ?? 0)},${q(r.totalPrice ?? 0)},${q(r.cancelReason)},${q(r.cancellationFee)},${q(r.refundAmount)},${q(r.refundRate)},${q(r.canceledAt)},${q(r.createdAt || r._createTime)},${q(r.updatedAt || r._updateTime)});`;
});

const resOpts = [];
for (const r of reservations) {
  for (const o of r.options || []) {
    if (!o || !o.name) continue;
    const onsite = /바베큐|bbq/i.test(o.name) ? 1 : 0;
    resOpts.push({ rid: r._id, name: o.name, price: o.price || 0, onsite });
  }
}
await batchInsert("reservation_options", resOpts, (o) =>
  `INSERT INTO reservation_options (reservation_id,name,price,is_onsite) VALUES (${q(o.rid)},${q(o.name)},${q(o.price)},${o.onsite});`
);

// ── customers ──
const customers = load("customers");
await batchInsert("customers", customers, (c) =>
  `INSERT INTO customers (id,name,phone,email,customer_grade,visit_count,no_show_count,cancel_count,total_spent,marketing_consent,notes,tags,preferred_rooms,special_requests,first_visit_date,last_visit_date,created_at,updated_at) VALUES (${q(c._id)},${q(c.name)},${q(c.phone)},${q(c.email)},${q(c.customerGrade)},${q(c.visitCount ?? 0)},${q(c.noShowCount ?? 0)},${q(c.cancelCount ?? 0)},${q(c.totalSpent ?? 0)},${q(c.marketingConsent)},${q(c.notes)},${j(c.tags)},${j(c.preferredRooms)},${j(c.specialRequests)},${q(c.firstVisitDate)},${q(c.lastVisitDate)},${q(c.createdAt || c._createTime)},${q(c.updatedAt || c._updateTime)});`
);

// ── options ──
const options = load("options");
await batchInsert("options", options, (o) =>
  `INSERT INTO options (id,name,type,price,description,applicable_rooms,room_prices,room_stocks,shared_rooms,sort_order,is_active,created_at,updated_at) VALUES (${q(o._id)},${q(o.name)},${q(o.type)},${q(o.price ?? 0)},${q(o.description)},${j(o.selectedRooms || o.applicableRooms)},${j(o.roomPrices)},${j(o.roomStocks)},${j(o.sharedRooms)},${q(o.order ?? 0)},${q(o.isActive !== false)},${q(o.createdAt || o.created)},${q(o.updatedAt)});`
);

// ── pricing_rules ──
const pricing = load("pricing_rules");
await batchInsert("pricing_rules", pricing, (p) =>
  `INSERT INTO pricing_rules (id,room_name,data,created_at,updated_at) VALUES (${q(p._id)},${q(p.roomName || p.room)},${j(p)},${q(p.createdAt || p._createTime)},${q(p.updatedAt || p._updateTime)});`
);

// ── inventory_overrides ──
const inv = load("inventory_overrides");
await batchInsert("inventory_overrides", inv, (o) =>
  `INSERT INTO inventory_overrides (id,room_name,date,stock,data,created_at,updated_at) VALUES (${q(o._id)},${q(o.roomName || o.room)},${q(o.date)},${q(o.stock)},${j(o)},${q(o.createdAt || o._createTime)},${q(o.updatedAt || o._updateTime)});`
);

// ── room_templates (settings.notifications_v2_*) ──
const settings = load("settings");
const tplRows = [];
for (const docName of ["notifications_v2_choho", "notifications_v2_shelter"]) {
  const doc = settings.find((s) => s._id === docName);
  if (!doc) continue;
  const b = docName.includes("choho") ? "choho" : "shelter";
  for (const [room, rs] of Object.entries(doc.roomSettings || {})) {
    const tpls = rs.templates || {};
    for (const [kind, t] of Object.entries(tpls)) {
      const content = typeof t === "object" ? t.content : t;
      if (!content) continue;
      tplRows.push({
        business: b, room, kind, content,
        enabled: rs.enabled !== false ? 1 : 0,
        conf: rs.autoSend?.confirmationEnabled ? 1 : 0,
        cin: rs.autoSend?.checkInEnabled !== false ? 1 : 0,
        cout: rs.autoSend?.checkOutEnabled !== false ? 1 : 0,
      });
    }
  }
}
await batchInsert("room_templates", tplRows, (t) =>
  `INSERT INTO room_templates (business,room_name,kind,content,enabled,confirmation_enabled,checkin_enabled,checkout_enabled) VALUES (${q(t.business)},${q(t.room)},${q(t.kind)},${q(t.content)},${t.enabled},${t.conf},${t.cin},${t.cout});`
);

// ── sms_config WITHOUT secrets (from/chatId/flags only) ──
const cfgRows = [];
for (const docName of ["notifications_v2_choho", "notifications_v2_shelter"]) {
  const doc = settings.find((s) => s._id === docName);
  if (!doc) continue;
  const b = docName.includes("choho") ? "choho" : "shelter";
  const g = doc.globalSettings || {};
  cfgRows.push({
    business: b,
    from: g.sens?.from || null,
    chatId: g.telegram?.chatId || null,
    useRes: g.telegram?.useReservation !== false ? 1 : 0,
    useCancel: g.telegram?.useCancellation !== false ? 1 : 0,
    updated: doc.updatedAt || doc._updateTime,
  });
}
await batchInsert("sms_config(무시크릿)", cfgRows, (c) =>
  `INSERT INTO sms_config (business,sms_from,telegram_chat_id,use_reservation,use_cancellation,updated_at) VALUES (${q(c.business)},${q(c.from)},${q(c.chatId)},${c.useRes},${c.useCancel},${q(c.updated)});`
);

// ── login_attempts ──
const logins = load("login_attempts");
await batchInsert("login_attempts", logins, (l) =>
  `INSERT INTO login_attempts (ip,success,attempted_at) VALUES (${q(l.ip || l.ipAddress || "unknown")},${q(l.success ? 1 : 0)},${q(l.timestamp || l.attemptedAt || l._createTime)});`
);

console.log("\n=== 핵심 데이터 적재 완료 ===");
