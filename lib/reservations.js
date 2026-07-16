// 예약 데이터 접근 — D1 기반. Firestore useReservationStore 대체.
import { query, queryOne, execute } from "./d1.js";

// Firestore 스타일 20자 문서 ID 생성 (기존 데이터와 형식 일관)
const ID_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function newId() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => ID_CHARS[b % 62]).join("");
}

/**
 * 클라이언트(서버 라우트)에서 미리 ID를 만들 때 — 재고 가드가 INSERT 전에 id를 알아야 한다.
 * HTTP 재시도 중복 방지의 멱등키 역할도 한다 (같은 id 재전송 → PK 충돌 → 성공 처리).
 */
export { newId as newReservationId };

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

// ─── 쓰기 (Firestore addDoc/updateDoc 대체) ───

const WRITE_FIELDS = [
  "customer_name",
  "phone",
  "room_name",
  "check_in",
  "check_out",
  "guests",
  "status",
  "source",
  "depositor_name",
  "memo",
  "base_price",
  "room_price",
  "option_price",
  "onsite_price",
  "extra_guest_price",
  "total_price",
];

/** 옵션 교체 — 재고 가드로 INSERT 한 뒤 옵션만 따로 붙일 때도 쓴다 */
export async function replaceReservationOptions(reservationId, options = []) {
  return replaceOptions(reservationId, options);
}

async function replaceOptions(reservationId, options = []) {
  await execute(`DELETE FROM reservation_options WHERE reservation_id = ?`, [
    reservationId,
  ]);
  for (const o of options) {
    const name = typeof o === "object" ? o.name : o;
    if (!name) continue;
    const price = typeof o === "object" ? o.price || 0 : 0;
    const isOnsite = /바베큐|bbq/i.test(name) ? 1 : 0;
    await execute(
      `INSERT INTO reservation_options (reservation_id, name, price, is_onsite) VALUES (?, ?, ?, ?)`,
      [reservationId, name, price, isOnsite],
    );
  }
}

/** 예약 생성. 반환: 저장된 예약(옵션 포함) */
export async function createReservation(data) {
  const id = data.id || newId();
  const now = new Date().toISOString();
  const cols = ["id", ...WRITE_FIELDS, "created_at", "updated_at"];
  const vals = [
    id,
    data.customer_name,
    data.phone,
    data.room_name,
    data.check_in,
    data.check_out,
    data.guests ?? 2,
    data.status || "입금대기",
    data.source ?? null,
    data.depositor_name ?? null,
    data.memo ?? null,
    data.base_price ?? 0,
    data.room_price ?? 0,
    data.option_price ?? 0,
    data.onsite_price ?? 0,
    data.extra_guest_price ?? 0,
    data.total_price ?? 0,
    now,
    now,
  ];
  await execute(
    `INSERT INTO reservations (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    vals,
  );
  if (data.options?.length) await replaceOptions(id, data.options);
  return getById(id);
}

/** 예약 수정. 반환: { before, after } (알림 이벤트 판정용) */
export async function updateReservation(id, patch) {
  const before = await getById(id);
  if (!before) return { before: null, after: null };

  const sets = [];
  const vals = [];
  for (const f of WRITE_FIELDS) {
    if (f in patch) {
      sets.push(`${f} = ?`);
      vals.push(patch[f]);
    }
  }
  if (sets.length) {
    sets.push("updated_at = ?");
    vals.push(new Date().toISOString());
    vals.push(id);
    await execute(
      `UPDATE reservations SET ${sets.join(", ")} WHERE id = ?`,
      vals,
    );
  }
  if (patch.options) await replaceOptions(id, patch.options);
  const after = await getById(id);
  return { before, after };
}

/** 예약 취소. 상태 + 환불정보 기록 */
export async function cancelReservation(
  id,
  { cancel_reason, refund_amount, refund_rate, cancellation_fee } = {},
) {
  const before = await getById(id);
  if (!before) return { before: null, after: null };
  await execute(
    `UPDATE reservations SET status = '예약취소', cancel_reason = ?, refund_amount = ?, refund_rate = ?,
       cancellation_fee = ?, canceled_at = ?, updated_at = ? WHERE id = ?`,
    [
      cancel_reason ?? null,
      refund_amount ?? null,
      refund_rate ?? null,
      cancellation_fee ?? null,
      new Date().toISOString(),
      new Date().toISOString(),
      id,
    ],
  );
  return { before, after: await getById(id) };
}

/** 예약 삭제 (옵션 CASCADE) */
export async function deleteReservation(id) {
  return execute(`DELETE FROM reservations WHERE id = ?`, [id]);
}
