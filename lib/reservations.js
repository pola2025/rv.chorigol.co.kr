// 예약 데이터 접근 — D1 기반. Firestore useReservationStore 대체.
import { query, queryOne, execute } from "./d1.js";

const SELECT = `
  SELECT id, customer_name, phone, room_name, check_in, check_out, guests,
         status, source, depositor_name, memo,
         base_price, room_price, option_price, onsite_price, extra_guest_price, total_price,
         cancel_reason, cancellation_fee, refund_amount, refund_rate, canceled_at,
         created_at, updated_at
  FROM reservations`;

/** 옵션 배열을 예약에 합쳐 반환. D1 변수 한도(100)를 넘지 않게 IN 절을 청크 처리 */
async function attachOptions(reservations) {
  if (!reservations.length) return reservations;
  const ids = reservations.map((r) => r.id);
  const byRes = {};
  const CHUNK = 90;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const placeholders = slice.map(() => "?").join(",");
    const { results } = await query(
      `SELECT reservation_id, name, price, is_onsite FROM reservation_options WHERE reservation_id IN (${placeholders})`,
      slice,
    );
    for (const o of results)
      (byRes[o.reservation_id] ||= []).push({
        name: o.name,
        price: o.price,
        isOnsite: !!o.is_onsite,
      });
  }
  return reservations.map((r) => ({ ...r, options: byRes[r.id] || [] }));
}

/** 기간 내 체크인 예약 (스케줄러/캘린더용) */
export async function listByCheckIn(date, { status = "예약확정" } = {}) {
  const { results } = await query(
    `${SELECT} WHERE check_in = ? AND status = ? ORDER BY room_name`,
    [date, status],
  );
  return attachOptions(results);
}

/** 캘린더 범위 조회 (체크인이 [from, to] 사이) */
export async function listByRange(from, to) {
  const { results } = await query(
    `${SELECT} WHERE check_in BETWEEN ? AND ? ORDER BY check_in, room_name`,
    [from, to],
  );
  return attachOptions(results);
}

/** 상태별 목록 */
export async function listByStatus(status, limit = 200) {
  const { results } = await query(
    `${SELECT} WHERE status = ? ORDER BY check_in DESC LIMIT ?`,
    [status, limit],
  );
  return attachOptions(results);
}

/** 단건 조회 */
export async function getById(id) {
  const r = await queryOne(`${SELECT} WHERE id = ?`, [id]);
  if (!r) return null;
  return (await attachOptions([r]))[0];
}

/** 상태 카운트 요약 (대시보드) */
export async function statusSummary() {
  const { results } = await query(
    `SELECT status, COUNT(*) c, COALESCE(SUM(total_price),0) total FROM reservations GROUP BY status`,
  );
  return results;
}
