// 환불 정책 — 순수 함수 (D1 의존 없음. 서버·클라이언트 공용).
// 레거시 src/constants/refundPolicy.js 이식 — 요율·계산식 그대로 유지.
// (src/ 는 컷오버 후 삭제 예정이라 신규 스택이 참조하지 않도록 옮겼다)

// 체크인 날짜 기준 며칠 전까지의 환불율
export const REFUND_POLICY = [
  { daysBeforeCheckIn: 0, refundRate: 0 }, // 당일: 0% 환불
  { daysBeforeCheckIn: 1, refundRate: 0 }, // 1일전: 0% 환불
  { daysBeforeCheckIn: 2, refundRate: 20 }, // 2일전: 20% 환불
  { daysBeforeCheckIn: 3, refundRate: 50 }, // 3일전: 50% 환불
  { daysBeforeCheckIn: 4, refundRate: 50 }, // 4일전: 50% 환불
  { daysBeforeCheckIn: 5, refundRate: 70 }, // 5일전: 70% 환불
  { daysBeforeCheckIn: 6, refundRate: 70 }, // 6일전: 70% 환불
  { daysBeforeCheckIn: 7, refundRate: 90 }, // 7일전: 90% 환불
  { daysBeforeCheckIn: 8, refundRate: 90 }, // 8일전: 90% 환불
  { daysBeforeCheckIn: 9, refundRate: 90 }, // 9일전: 90% 환불
];

/** 체크인까지 남은 일수 (오늘 기준, 지났으면 0 이하) */
export function daysUntilCheckIn(checkInDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = new Date(checkInDate);
  checkIn.setHours(0, 0, 0, 0);
  return Math.floor((checkIn - today) / (1000 * 60 * 60 * 24));
}

/** 체크인까지 남은 일수에 따른 환불율 */
export function getRefundRate(checkInDate) {
  const diffDays = daysUntilCheckIn(checkInDate);

  // 이미 체크인 날짜가 지났거나 당일인 경우
  if (diffDays <= 0) return 0;

  const policy = REFUND_POLICY.find((p) => p.daysBeforeCheckIn === diffDays);
  if (policy) return policy.refundRate;

  // 9일 이상 남은 경우 90% 환불
  if (diffDays > 9) return 90;

  return 0;
}

/** 환불 금액 */
export function calculateRefundAmount(totalPrice, checkInDate) {
  const refundRate = getRefundRate(checkInDate);
  return Math.floor(((totalPrice || 0) * refundRate) / 100);
}

/** 취소 수수료 */
export function calculateCancellationFee(totalPrice, checkInDate) {
  return (totalPrice || 0) - calculateRefundAmount(totalPrice, checkInDate);
}

/** 환불 정책 안내 문구 */
export function getRefundPolicyText(checkInDate) {
  const diffDays = daysUntilCheckIn(checkInDate);
  if (diffDays <= 0) return "당일 취소로 환불이 불가능합니다.";
  return `체크인 ${diffDays}일 전 취소로 ${getRefundRate(checkInDate)}% 환불 가능합니다.`;
}
