// src/constants/refundPolicy.js

// 환불 정책 - 체크인 날짜 기준 며칠 전까지의 환불율
export const REFUND_POLICY = [
  { daysBeforeCheckIn: 0, refundRate: 0 },    // 당일: 0% 환불
  { daysBeforeCheckIn: 1, refundRate: 0 },    // 1일전: 0% 환불  
  { daysBeforeCheckIn: 2, refundRate: 20 },   // 2일전: 20% 환불
  { daysBeforeCheckIn: 3, refundRate: 50 },   // 3일전: 50% 환불
  { daysBeforeCheckIn: 4, refundRate: 50 },   // 4일전: 50% 환불
  { daysBeforeCheckIn: 5, refundRate: 70 },   // 5일전: 70% 환불
  { daysBeforeCheckIn: 6, refundRate: 70 },   // 6일전: 70% 환불
  { daysBeforeCheckIn: 7, refundRate: 90 },   // 7일전: 90% 환불
  { daysBeforeCheckIn: 8, refundRate: 90 },   // 8일전: 90% 환불
  { daysBeforeCheckIn: 9, refundRate: 90 },   // 9일전: 90% 환불
];

// 체크인까지 남은 일수에 따른 환불율 계산
export function getRefundRate(checkInDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkIn = new Date(checkInDate);
  checkIn.setHours(0, 0, 0, 0);
  
  // 체크인까지 남은 일수 계산
  const diffTime = checkIn - today;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // 이미 체크인 날짜가 지났거나 당일인 경우
  if (diffDays <= 0) {
    return 0;
  }
  
  // 환불 정책에서 해당하는 환불율 찾기
  const policy = REFUND_POLICY.find(p => p.daysBeforeCheckIn === diffDays);
  
  // 정책에 정의된 날짜면 해당 환불율 반환
  if (policy) {
    return policy.refundRate;
  }
  
  // 9일 이상 남은 경우 90% 환불
  if (diffDays > 9) {
    return 90;
  }
  
  // 그 외의 경우 (보통 발생하지 않음)
  return 0;
}

// 환불 금액 계산
export function calculateRefundAmount(totalPrice, checkInDate) {
  const refundRate = getRefundRate(checkInDate);
  return Math.floor(totalPrice * refundRate / 100);
}

// 취소 수수료 계산
export function calculateCancellationFee(totalPrice, checkInDate) {
  const refundAmount = calculateRefundAmount(totalPrice, checkInDate);
  return totalPrice - refundAmount;
}

// 환불 정책 텍스트 생성
export function getRefundPolicyText(checkInDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkIn = new Date(checkInDate);
  checkIn.setHours(0, 0, 0, 0);
  
  const diffTime = checkIn - today;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const refundRate = getRefundRate(checkInDate);
  
  if (diffDays <= 0) {
    return '당일 취소로 환불이 불가능합니다.';
  }
  
  return `체크인 ${diffDays}일 전 취소로 ${refundRate}% 환불 가능합니다.`;
}
