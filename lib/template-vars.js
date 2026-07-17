// 템플릿 변수 정의·치환 — 순수 함수 (D1 의존 없음).
// 발송(서버)과 알림설정 미리보기(클라이언트)가 반드시 같은 구현을 쓰도록 분리했다.
// 미리보기가 발송과 다른 코드로 렌더되면 미리보기의 의미가 없다.
//
// 지원 변수는 buildVarMap() 하나에서만 나온다 (TEMPLATE_VARS가 이 맵에서 파생).
// Firestore 시절 영문 변수({customerName})로 치환을 시도해 4개월간 확정문자가
// 깨진 사고(2026-03)의 재발 방지 — 목록이 두 벌 존재하면 다시 어긋난다.

const PENSION_PHONE = "010-7932-0029";
const PENSION_ADDRESS = "경기도 파주시 법원읍 초리골길 134";

/** 예약 → 변수 치환 맵. 인자 없이 호출하면 지원 변수 목록 산출용으로 쓰인다. */
function buildVarMap(reservation = {}) {
  // 현장결제(바베큐 등) 합계
  let onsiteText = "";
  const opts = reservation.options || [];
  const onsiteTotal = opts.reduce((sum, o) => {
    const name = typeof o === "object" ? o.name || "" : o;
    const price = typeof o === "object" ? o.price || 0 : 0;
    return /바베큐|bbq/i.test(name) ? sum + price : sum;
  }, 0);
  if (onsiteTotal > 0) onsiteText = `현장결제: ${onsiteTotal.toLocaleString()}원`;

  return {
    "{고객명}": reservation.customer_name ?? reservation.customerName ?? "",
    "{객실명}": reservation.room_name ?? reservation.roomName ?? "",
    "{체크인}": reservation.check_in ?? reservation.checkIn ?? "",
    "{체크아웃}": reservation.check_out ?? reservation.checkOut ?? "",
    "{인원}": reservation.guests ?? "",
    "{금액}": (reservation.total_price ?? reservation.totalPrice ?? 0).toLocaleString(),
    "{현장결제}": onsiteText,
    "{전화번호}": PENSION_PHONE,
    "{주소}": PENSION_ADDRESS,
  };
}

/** 지원 변수 목록 — 치환 맵에서 파생하므로 어긋날 수 없다. */
export const TEMPLATE_VARS = Object.keys(buildVarMap());

/**
 * 템플릿 변수 치환 — 한글 변수만 사용 (저장된 템플릿 규칙과 일치).
 * @returns {{ text: string, missing: string[] }}  missing: 미치환 변수 목록
 */
export function renderTemplate(template, reservation) {
  if (!template) return { text: "", missing: [] };

  let text = template;
  for (const [k, v] of Object.entries(buildVarMap(reservation)))
    text = text.split(k).join(String(v));

  // 발송 전 안전장치: 미치환 변수 검출
  const missing = text.match(/\{[^}]+\}/g) || [];
  return { text, missing };
}

/**
 * 템플릿에 쓰인 미지원 변수 검출 — 저장 시점 차단용.
 * 발송 시점이 아니라 편집 시점에 막아야 오발송이 원천 차단된다.
 */
export function findUnknownVars(content) {
  const used = content?.match(/\{[^}]+\}/g) || [];
  return [...new Set(used.filter((v) => !TEMPLATE_VARS.includes(v)))];
}
