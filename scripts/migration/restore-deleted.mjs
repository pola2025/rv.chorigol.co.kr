// 실수로 삭제한 예약 2건 복구 — 원본 덤프 + 최초 이관 로더(load-core.mjs)와 동일한 매핑 사용.
import fs from "node:fs";
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");

const DUMP =
  "F:/backup/choho-firestore-dump-20260716/reservations.json";
const IDS = ["BXDS80zPDSfoqDQYWMUR", "wAYSl9O91aQMP1Z6wD2V"];

const all = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const arr = Array.isArray(all) ? all : Object.values(all);

for (const id of IDS) {
  const r = arr.find((x) => x._id === id);
  if (!r) { console.log("덤프에 없음:", id); continue; }

  const exists = (await query(`SELECT COUNT(*) c FROM reservations WHERE id=?`, [id])).results[0].c;
  if (exists) { console.log("이미 존재, 건너뜀:", id); continue; }

  // load-core.mjs 와 동일한 매핑
  const phone = r.phone || r.customerPhone || "";
  const guests = r.guests ?? r.guestCount ?? 2;
  await query(
    `INSERT INTO reservations
     (id,customer_name,phone,room_name,check_in,check_out,guests,status,source,depositor_name,memo,
      base_price,room_price,option_price,onsite_price,extra_guest_price,total_price,
      cancel_reason,cancellation_fee,refund_amount,refund_rate,canceled_at,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      r._id, r.customerName ?? null, phone, r.roomName ?? null, r.checkIn ?? null, r.checkOut ?? null,
      guests, r.status ?? null, r.source ?? null, r.depositorName ?? null, r.memo ?? null,
      r.basePrice ?? 0, r.roomPrice ?? 0, r.optionPrice ?? 0, r.onsitePrice ?? 0,
      r.extraGuestPrice ?? 0, r.totalPrice ?? 0,
      r.cancelReason ?? null, r.cancellationFee ?? null, r.refundAmount ?? null, r.refundRate ?? null,
      r.canceledAt ?? null, r.createdAt || r._createTime || null, r.updatedAt || r._updateTime || null,
    ],
  );

  // 옵션 (CASCADE로 함께 지워졌음)
  let n = 0;
  for (const o of r.options || []) {
    if (!o || !o.name) continue;
    const onsite = /바베큐|bbq/i.test(o.name) ? 1 : 0;
    await query(
      `INSERT INTO reservation_options (reservation_id,name,price,is_onsite) VALUES (?,?,?,?)`,
      [r._id, o.name, o.price || 0, onsite],
    );
    n++;
  }
  console.log(`복구: ${id} (${r.customerName}/${r.status}/${r.totalPrice}원) + 옵션 ${n}건`);
}

// ── 검증 ──
console.log("\n=== 검증 ===");
const total = (await query(`SELECT COUNT(*) c FROM reservations`)).results[0].c;
console.log("reservations:", total, total === 540 ? "OK (540 복구)" : "FAIL");

const sum = (await query(`SELECT COALESCE(SUM(total_price),0) s FROM reservations`)).results[0].s;
console.log("금액 합계:", sum.toLocaleString() + "원", sum === 98105000 ? "OK (이관검증 수치와 일치)" : `FAIL (기대 98,105,000)`);

const opts = (await query(`SELECT COUNT(*) c FROM reservation_options`)).results[0].c;
console.log("reservation_options:", opts, opts === 366 ? "OK (366)" : `FAIL (기대 366)`);

for (const id of IDS) {
  const r = (await query(`SELECT id,customer_name,status,total_price,source,check_in FROM reservations WHERE id=?`, [id])).results[0];
  const o = (await query(`SELECT COUNT(*) c FROM reservation_options WHERE reservation_id=?`, [id])).results[0].c;
  console.log(" ", id, r ? `${r.customer_name}/${r.status}/${r.total_price}/${r.source}/${r.check_in} opts=${o}` : "없음 FAIL");
}
const leftover = (await query(`SELECT COUNT(*) c FROM reservations WHERE customer_name LIKE '테스트%' AND customer_name != '테스트'`)).results[0].c;
console.log("내가 만든 테스트 잔여:", leftover, leftover === 0 ? "OK" : "FAIL");
