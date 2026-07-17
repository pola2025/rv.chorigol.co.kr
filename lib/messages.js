// 텔레그램 알림 메시지 포맷터 — D1 필드(snake_case) 기준.
// reservationTriggers.js의 포맷 로직을 이식.

const SOURCE_NAMES = {
  naver_place: "네이버 플레이스",
  naver_booking: "네이버 펜션예약",
  naver_map: "네이버 지도",
  transfer: "이체예약",
  group: "단체예약",
  etc: "기타",
};
const sourceName = (s) => SOURCE_NAMES[s] || s || "기타";

function nights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.ceil(Math.abs(ms) / 86400000) || 1;
}

const won = (n) => (n || 0).toLocaleString();
const tag = (room) => (room || "").replace(/\s/g, "");

/** 옵션 배열을 포함/현장결제로 분리 */
function splitOptions(options = []) {
  const included = [];
  const onsite = [];
  for (const o of options) {
    const name = typeof o === "object" ? o.name : o;
    const price = typeof o === "object" ? o.price || 0 : 0;
    if (!name) continue;
    if (/바베큐|bbq/i.test(name)) onsite.push({ name, price: price || 30000 });
    else included.push({ name, price });
  }
  return { included, onsite };
}

/** 새 예약 (입금대기 등) */
export function formatNew(r) {
  const { included, onsite } = splitOptions(r.options);
  let msg = `🆕 새 예약\n\n`;
  msg += `고객명: ${r.customer_name}\n`;
  msg += `연락처: ${r.phone || ""}\n`;
  msg += `객실: ${r.room_name}\n`;
  msg += `일정: ${r.check_in} ~ ${r.check_out}\n`;
  msg += `인원: ${r.guests || 2}명\n`;
  msg += `금액: ${won(r.total_price)}원\n`;
  msg += `예약출처: ${sourceName(r.source)}\n`;
  msg += `상태: ${r.status || "입금대기"}`;
  if (included.length) {
    msg += `\n\n📦 옵션:\n`;
    included.forEach(
      (o) =>
        (msg +=
          o.price > 0 ? `• ${o.name}: ${won(o.price)}원\n` : `• ${o.name}\n`),
    );
  }
  if (onsite.length) {
    const t = onsite.reduce((s, o) => s + o.price, 0);
    msg += `\n💳 현장결제:\n`;
    onsite.forEach((o) => (msg += `• ${o.name}: ${won(o.price)}원\n`));
    msg += `현장결제 합계: ${won(t)}원`;
  }
  if (r.memo?.trim()) msg += `\n\n📝 특이사항:\n${r.memo}`;
  return msg;
}

/** 예약확정 */
export function formatConfirmation(r) {
  const n = nights(r.check_in, r.check_out);
  const { included, onsite } = splitOptions(r.options);
  let msg = `🎉 <b>새 예약이 확정되었습니다!</b>\n\n`;
  msg += `📅 날짜: ${r.check_in} ~ ${r.check_out} (${n}박)\n`;
  msg += `🏠 객실: ${r.room_name}\n`;
  msg += `👤 예약자: ${r.customer_name}\n`;
  msg += `📞 연락처: ${r.phone}\n`;
  msg += `👥 인원: ${r.guests}명\n`;
  msg += `\n💰 <b>결제 정보</b>\n────────────────\n`;
  msg += `객실 요금: ${won(r.base_price || r.room_price || r.total_price)}원\n`;
  if (r.extra_guest_price > 0)
    msg += `인원 추가: ${won(r.extra_guest_price)}원\n`;
  if (included.length) {
    msg += `\n📦 <b>포함 옵션</b>\n`;
    included.forEach(
      (o) =>
        (msg +=
          o.price > 0 ? `• ${o.name}: ${won(o.price)}원\n` : `• ${o.name}\n`),
    );
  }
  msg += `────────────────\n<b>총 결제금액: ${won(r.total_price)}원</b>\n`;
  if (onsite.length) {
    const t = onsite.reduce((s, o) => s + o.price, 0);
    msg += `\n💳 <b>현장 결제</b>\n────────────────\n`;
    onsite.forEach((o) => (msg += `• ${o.name}: ${won(o.price)}원\n`));
    msg += `────────────────\n<b>현장 결제금액: ${won(t)}원</b>\n`;
  }
  msg += `\n📍 출처: ${sourceName(r.source)}`;
  if (r.memo?.trim()) msg += `\n\n📝 <b>메모</b>\n────────────────\n${r.memo}`;
  msg += `\n\n#예약확정 #${tag(r.room_name)}`;
  return msg;
}

/** 예약취소 */
export function formatCancellation(r) {
  const n = nights(r.check_in, r.check_out);
  let msg = `❌ <b>예약이 취소되었습니다</b>\n\n`;
  msg += `📅 날짜: ${r.check_in} ~ ${r.check_out} (${n}박)\n`;
  msg += `🏠 객실: ${r.room_name}\n`;
  msg += `👤 예약자: ${r.customer_name}\n`;
  msg += `📞 연락처: ${r.phone}\n`;
  msg += `👥 인원: ${r.guests}명\n`;
  msg += `\n💰 <b>취소 정보</b>\n────────────────\n`;
  msg += `취소 금액: ${won(r.total_price)}원\n`;
  msg += `취소 사유: ${r.cancel_reason || "고객 요청"}\n`;
  if (r.refund_amount != null) {
    msg += `\n💵 <b>환불 정보</b>\n────────────────\n`;
    msg += `환불 금액: ${won(r.refund_amount)}원`;
    if (r.refund_rate) msg += ` (${r.refund_rate}%)`;
    msg += "\n";
    if (r.cancellation_fee > 0)
      msg += `취소 수수료: ${won(r.cancellation_fee)}원\n`;
  }
  if (r.memo?.trim())
    msg += `\n📝 <b>예약 메모</b>\n────────────────\n${r.memo}\n`;
  msg += `\n#예약취소 #${tag(r.room_name)}`;
  return msg;
}

/** 객실 변경 */
export function formatRoomChange(r, prevRoom, newRoom) {
  const n = nights(r.check_in, r.check_out);
  let msg = `🔄 <b>객실이 변경되었습니다</b>\n\n`;
  msg += `📅 날짜: ${r.check_in} ~ ${r.check_out} (${n}박)\n`;
  msg += `👤 예약자: ${r.customer_name}\n`;
  msg += `📞 연락처: ${r.phone}\n\n`;
  msg += `🏠 <b>객실 변경</b>\n────────────────\n`;
  msg += `변경 전: ${prevRoom}\n변경 후: ${newRoom}\n────────────────\n`;
  msg += `\n#객실변경 #${tag(newRoom)}`;
  return msg;
}
