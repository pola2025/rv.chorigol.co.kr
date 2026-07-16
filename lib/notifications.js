// 알림 설정·템플릿 조회 + 치환 — D1 기반.
// 템플릿 변수 치환은 이 파일의 renderTemplate() 하나로 통일한다.
// (Firestore 시절 reservationTriggers/smsScheduler/sensService 3곳에 분산돼
//  영문/한글 규칙이 어긋나 4개월간 문자가 깨진 사고의 재발 방지)
import { queryOne } from "./d1.js";

/** 업체별 발신 설정 (시크릿 제외 — 시크릿은 서버 env에서만) */
export async function getSmsConfig(business) {
  return queryOne(
    `SELECT business, sms_from, telegram_chat_id, use_reservation, use_cancellation
     FROM sms_config WHERE business = ?`,
    [business],
  );
}

/** 객실·종류별 템플릿 + 발송 활성화 플래그 */
export async function getTemplate(business, roomName, kind) {
  return queryOne(
    `SELECT content, enabled, confirmation_enabled, checkin_enabled, checkout_enabled
     FROM room_templates WHERE business = ? AND room_name = ? AND kind = ?`,
    [business, roomName, kind],
  );
}

const PENSION_PHONE = "010-7932-0029";
const PENSION_ADDRESS = "경기도 파주시 법원읍 초리골길 134";

/**
 * 템플릿 변수 치환 — 한글 변수만 사용 (저장된 템플릿 규칙과 일치).
 * {고객명} {객실명} {체크인} {체크아웃} {인원} {금액} {현장결제} {전화번호} {주소}
 * @returns {{ text: string, missing: string[] }}  missing: 미치환 변수 목록
 */
export function renderTemplate(template, reservation) {
  if (!template) return { text: "", missing: [] };

  // 현장결제(바베큐 등) 합계
  let onsiteText = "";
  const opts = reservation.options || [];
  const onsiteTotal = opts.reduce((sum, o) => {
    const name = typeof o === "object" ? o.name || "" : o;
    const price = typeof o === "object" ? o.price || 0 : 0;
    return /바베큐|bbq/i.test(name) ? sum + price : sum;
  }, 0);
  if (onsiteTotal > 0)
    onsiteText = `현장결제: ${onsiteTotal.toLocaleString()}원`;

  const map = {
    "{고객명}": reservation.customer_name ?? reservation.customerName ?? "",
    "{객실명}": reservation.room_name ?? reservation.roomName ?? "",
    "{체크인}": reservation.check_in ?? reservation.checkIn ?? "",
    "{체크아웃}": reservation.check_out ?? reservation.checkOut ?? "",
    "{인원}": reservation.guests ?? "",
    "{금액}": (
      reservation.total_price ??
      reservation.totalPrice ??
      0
    ).toLocaleString(),
    "{현장결제}": onsiteText,
    "{전화번호}": PENSION_PHONE,
    "{주소}": PENSION_ADDRESS,
  };

  let text = template;
  for (const [k, v] of Object.entries(map))
    text = text.split(k).join(String(v));

  // 발송 전 안전장치: 미치환 변수 검출
  const missing = text.match(/\{[^}]+\}/g) || [];
  return { text, missing };
}
