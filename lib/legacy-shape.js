// D1 → Firestore 원형 역매퍼 (서버 전용).
//
// 레거시 화면을 "모양 그대로" 이식하기 위한 핵심 계층.
// 컴포넌트들은 useFirebaseStore 가 주는 **Firestore 문서 모양**을 그대로 기대한다:
//   rooms        → 한글 필드 (객실명, 재고, 기본요금 …)
//   reservations → camelCase (roomName, checkIn, customerName …)
//   overrides    → { `${date}_${roomName}`: available } 맵 (doc.id 키)
// D1 은 snake_case 영문으로 정규화돼 있으므로 여기서 되돌린다.
//
// ⚠️ 이 매퍼는 원본 Firestore 덤프와 **전건 대조로 검증**됐다(scratchpad/probe-shape.mjs).
//    필드를 고칠 때는 반드시 그 대조를 다시 돌릴 것 — 한 필드만 어긋나도 화면이 조용히 깨진다.
import { query } from "./d1.js";

const parseJson = (v) => {
  if (v === null || v === undefined) return null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

/** rooms: D1 → 한글 필드. 레거시 정렬 orderBy('order','asc') */
export function toRoom(r) {
  return {
    id: r.id,
    객실명: r.name,
    기본요금: r.base_price,
    주중요금: r.weekday_price,
    주말요금: r.weekend_price,
    추가인원요금: r.extra_guest_fee,
    기준인원: r.base_guests,
    최대인원: r.max_guests,
    기본재고: r.base_stock,
    재고: r.stock,
    설명: r.description,
    order: r.sort_order,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** reservations: D1 → camelCase. options 는 reservation_options 에서 합친다 */
export function toReservation(r, options = []) {
  return {
    id: r.id,
    customerName: r.customer_name,
    phone: r.phone,
    roomName: r.room_name,
    checkIn: r.check_in,
    checkOut: r.check_out,
    guests: r.guests,
    status: r.status,
    source: r.source,
    depositorName: r.depositor_name,
    memo: r.memo,
    basePrice: r.base_price,
    roomPrice: r.room_price,
    optionPrice: r.option_price,
    onsitePrice: r.onsite_price,
    extraGuestPrice: r.extra_guest_price,
    totalPrice: r.total_price,
    cancelReason: r.cancel_reason,
    cancellationFee: r.cancellation_fee,
    refundAmount: r.refund_amount,
    refundRate: r.refund_rate,
    canceledAt: r.canceled_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    options,
  };
}

/** options: applicableRooms 는 **모드 문자열**, selectedRooms 가 목록 (다른 필드다) */
export function toOption(o) {
  return {
    id: o.id,
    name: o.name,
    type: o.type,
    price: o.price,
    description: o.description,
    applicableRooms: parseJson(o.applicable_rooms),
    selectedRooms: parseJson(o.selected_rooms),
    roomPrices: parseJson(o.room_prices),
    roomStocks: parseJson(o.room_stocks),
    sharedRooms: parseJson(o.shared_rooms),
    order: o.sort_order,
    isActive: !!o.is_active,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

/** customers: D1 → camelCase */
export function toCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    customerGrade: c.customer_grade,
    visitCount: c.visit_count,
    noShowCount: c.no_show_count,
    cancelCount: c.cancel_count,
    totalSpent: c.total_spent,
    // SQLite 엔 불리언이 없어 0/1 로 저장된다 — 원본(false)대로 되돌린다
    marketingConsent: c.marketing_consent === null ? null : !!c.marketing_consent,
    notes: c.notes,
    tags: parseJson(c.tags),
    preferredRooms: parseJson(c.preferred_rooms),
    specialRequests: parseJson(c.special_requests),
    // 예약ID 배열 — 읽는 화면은 없지만 useReservationStore 가 append 한다
    reservations: parseJson(c.reservations),
    firstVisitDate: c.first_visit_date,
    lastVisitDate: c.last_visit_date,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

/** pricing_rules / marketing_stats: 원본 문서가 data JSON 에 통째로 보존돼 있다 */
export function toBlob(row) {
  const d = parseJson(row.data) || {};
  const clean = Object.fromEntries(
    Object.entries(d).filter(([k]) => !k.startsWith("_")),
  );
  return { ...clean, id: row.id };
}

/**
 * useFirebaseStore 가 구독하던 7개 컬렉션을 한 번에 — 정렬까지 레거시와 동일하게.
 * blocked_dates 는 Firestore 에도 없는 컬렉션이라 레거시에서도 항상 빈 배열이었다.
 */
export async function loadSnapshot() {
  const [
    rooms,
    reservations,
    resOptions,
    overrides,
    pricingRules,
    options,
    customers,
  ] = await Promise.all([
    query(`SELECT * FROM rooms ORDER BY sort_order ASC`),
    query(`SELECT * FROM reservations ORDER BY check_in DESC`),
    query(`SELECT reservation_id, name, price FROM reservation_options`),
    query(`SELECT id, data FROM inventory_overrides`),
    query(`SELECT id, data FROM pricing_rules`),
    query(`SELECT * FROM options`),
    query(`SELECT * FROM customers ORDER BY last_visit_date DESC`),
  ]);

  const optBy = {};
  for (const o of resOptions.results)
    (optBy[o.reservation_id] ||= []).push({ name: o.name, price: o.price });

  return {
    rooms: rooms.results.map(toRoom),
    reservations: reservations.results.map((r) =>
      toReservation(r, optBy[r.id] || []),
    ),
    // 레거시: overrides[doc.id] = doc.data().available — 랜덤 id 문서도 그대로 담긴다
    // (getAvailableStock 은 `${date}_${room}` 로만 찾으므로 랜덤 id 는 조회되지 않는다)
    overrides: Object.fromEntries(
      overrides.results.map((o) => [o.id, parseJson(o.data)?.available]),
    ),
    blockedDates: [],
    pricingRules: pricingRules.results.map(toBlob),
    options: options.results.map(toOption),
    customers: customers.results.map(toCustomer),
  };
}
