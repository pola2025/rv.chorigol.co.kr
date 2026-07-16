// 고객 정보 갱신 (서버 전용) — 레거시 useReservationStore.updateCustomerInfo 이식.
//
// 레거시는 예약 생성 직후 **브라우저에서** 고객 문서를 읽고-고쳐-썼다(fire-and-forget).
// 여기서는 같은 계산을 서버에서 한다 — 등급 기준이 클라이언트 번들에 있으면 조작 가능하고,
// 무엇보다 계산이 두 벌(레거시 addReservation 인라인 + updateCustomerInfo)로 복제돼 있었다.
//
// 동시성: 읽고-고쳐-쓰기라 동시 예약 2건이 같은 고객이면 visit_count 가 1만 오를 수 있다.
// 레거시와 동일한 성질이고, 방문통계는 파생 지표라 오버부킹처럼 원자성이 필요하지 않다
// (예약 자체는 lib/inventory.js 가 단일 문장으로 원자적으로 막는다).
import { queryOne, execute } from "./d1.js";

/** 010-1234-5678 → 01012345678. 고객 ID 규칙 (레거시 normalizePhone 과 동일) */
export const normalizePhone = (phone) =>
  String(phone ?? "").replace(/[^0-9]/g, "");

// 등급 기준 — src/models/Customer.js 의 CustomerGrades 이식. **여기가 단일 소스**
const GRADES = {
  VVIP: { minVisits: 5, minSpent: 3000000 },
  VIP: { minVisits: 3, minSpent: 1000000 },
};

/** 레거시 calculateCustomerGrade 와 동일 — 방문수·누적금액을 **둘 다** 만족해야 승급 */
export function calculateCustomerGrade(visitCount, totalSpent) {
  if (visitCount >= GRADES.VVIP.minVisits && totalSpent >= GRADES.VVIP.minSpent)
    return "VVIP";
  if (visitCount >= GRADES.VIP.minVisits && totalSpent >= GRADES.VIP.minSpent)
    return "VIP";
  return "NORMAL";
}

const parseArr = (v) => {
  if (!v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

/**
 * 예약 발생 → 고객 방문 기록. 없으면 생성, 있으면 누적.
 * 레거시 updateCustomerInfo 와 필드·기본값까지 동일하게 맞췄다.
 */
export async function recordVisit(
  reservationId,
  { phone, name, roomName, totalPrice },
) {
  const id = normalizePhone(phone);
  if (!id) return { ok: false, reason: "no_phone" };

  const now = new Date().toISOString();
  const c = await queryOne(`SELECT * FROM customers WHERE id = ?`, [id]);

  if (c) {
    const visitCount = (c.visit_count || 0) + 1;
    const totalSpent = (c.total_spent || 0) + (totalPrice || 0);
    const rooms = parseArr(c.preferred_rooms);
    const reservations = [...parseArr(c.reservations), reservationId];
    // 레거시: preferredRooms 에 없을 때만 추가 (중복 없이 누적)
    if (roomName && !rooms.includes(roomName)) rooms.push(roomName);

    await execute(
      `UPDATE customers
          SET name = ?, visit_count = ?, total_spent = ?, last_visit_date = ?,
              reservations = ?, customer_grade = ?, preferred_rooms = ?, updated_at = ?
        WHERE id = ?`,
      [
        name || c.name, // 레거시: reservationData.customerName || currentData.name
        visitCount,
        totalSpent,
        now,
        JSON.stringify(reservations),
        calculateCustomerGrade(visitCount, totalSpent),
        JSON.stringify(rooms),
        now,
        id,
      ],
    );
    return { ok: true, created: false, id, visitCount };
  }

  // 신규 고객 — 레거시 setDoc 의 기본값을 그대로 (marketingConsent=false → SQLite 0)
  await execute(
    `INSERT INTO customers
       (id, name, phone, email, first_visit_date, last_visit_date, visit_count, total_spent,
        reservations, cancel_count, no_show_count, preferred_rooms, special_requests,
        customer_grade, notes, tags, marketing_consent, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?, 1, ?, ?, 0, 0, ?, '[]', 'NORMAL', '', '[]', 0, ?, ?)`,
    [
      id,
      name ?? null,
      phone ?? null,
      now,
      now,
      totalPrice || 0,
      JSON.stringify([reservationId]),
      JSON.stringify(roomName ? [roomName] : []),
      now,
      now,
    ],
  );
  return { ok: true, created: true, id, visitCount: 1 };
}

/**
 * 예약 취소 → 취소 횟수 +1.
 * 레거시는 고객 문서가 없으면 아무것도 하지 않았다 (생성하지 않음) — 그대로 따른다.
 */
export async function recordCancel(phone) {
  const id = normalizePhone(phone);
  if (!id) return { ok: false, reason: "no_phone" };

  const c = await queryOne(`SELECT cancel_count FROM customers WHERE id = ?`, [
    id,
  ]);
  if (!c) return { ok: false, reason: "not_found" };

  await execute(
    `UPDATE customers SET cancel_count = ?, updated_at = ? WHERE id = ?`,
    [(c.cancel_count || 0) + 1, new Date().toISOString(), id],
  );
  return { ok: true, id, cancelCount: (c.cancel_count || 0) + 1 };
}
