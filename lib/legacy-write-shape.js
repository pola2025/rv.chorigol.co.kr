// Firestore 원형 → D1 쓰기 API 필드. **순수 모듈 (D1 의존 0 — 클라이언트 번들 안전)**.
//
// legacy-shape.js 의 반대 방향이다:
//   읽기  D1 snake_case → Firestore 모양   (legacy-shape.js · 서버 전용 — d1.js 를 문다)
//   쓰기  Firestore 모양 → API snake_case  (여기 · 스토어가 브라우저에서 쓴다)
//
// 레거시 컴포넌트들은 Firestore 문서 모양(camelCase)으로 예약을 만든다. 스토어가 그걸 그대로
// API 에 넘기면 필드가 통째로 무시되므로(예: customerName → customer_name 컬럼 없음)
// 여기서 한 번만 번역한다. 컴포넌트 23개는 무수정으로 둔다는 이식 전략의 일부다.

/** camelCase(Firestore) → snake_case(D1 컬럼) */
const FIELD_MAP = {
  customerName: "customer_name",
  phone: "phone",
  roomName: "room_name",
  checkIn: "check_in",
  checkOut: "check_out",
  guests: "guests",
  status: "status",
  source: "source",
  depositorName: "depositor_name",
  memo: "memo",
  basePrice: "base_price",
  roomPrice: "room_price",
  optionPrice: "option_price",
  onsitePrice: "onsite_price",
  extraGuestPrice: "extra_guest_price",
  totalPrice: "total_price",
  // 취소 정보 (PATCH { cancel: true } 경로)
  cancelReason: "cancel_reason",
  refundAmount: "refund_amount",
  cancellationFee: "cancellation_fee",
  refundRate: "refund_rate",
  options: "options", // 배열 그대로 — API 가 reservation_options 로 분해한다
};

/**
 * 의도적으로 버리는 키 — **무해함이 확인된 것만** 여기 넣을 것.
 * (근거: 2026-07-16 이식 감사. 모르는 키를 조용히 버리면 화면이 조용히 깨진다)
 *   selectedOptions · dailyPrices — 컴포넌트가 options/요금에서 **역산·로컬계산**하는 파생값
 *   confirmedAt                   — 레거시에서도 **쓰기 전용**, 읽는 곳이 없다
 *   canceledAt · createdAt · updatedAt — 서버가 직접 찍는다 (클라 시계를 믿지 않는다)
 *   id                            — 경로/파라미터로 따로 넘긴다
 */
const DROP = new Set([
  "selectedOptions",
  "dailyPrices",
  "confirmedAt",
  "canceledAt",
  "createdAt",
  "updatedAt",
  "id",
]);

/**
 * 예약 데이터를 API 본문으로. **넘어온 키만** 변환한다(부분 수정 지원).
 * 모르는 키는 버리되 개발 중엔 경고한다 — 조용한 유실이 이관 버그의 주범이었다.
 */
export function toWriteBody(data = {}) {
  const out = {};
  const unknown = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue; // Firestore 도 undefined 는 저장하지 않는다
    const col = FIELD_MAP[k];
    if (col) out[col] = v;
    else if (!DROP.has(k)) unknown.push(k);
  }
  if (unknown.length && process.env.NODE_ENV !== "production")
    console.warn(
      `[legacy-write-shape] 매핑 없는 필드 무시: ${unknown.join(", ")} — ` +
        `FIELD_MAP 에 추가하거나 DROP 에 근거와 함께 명시할 것`,
    );
  return out;
}
