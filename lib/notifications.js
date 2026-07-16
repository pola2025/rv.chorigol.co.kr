// 알림 설정·템플릿 조회/쓰기 — D1 기반.
// 템플릿 변수 치환은 template-vars.js 하나로 통일한다.
// (Firestore 시절 reservationTriggers/smsScheduler/sensService 3곳에 분산돼
//  영문/한글 규칙이 어긋나 4개월간 문자가 깨진 사고의 재발 방지)
import { query, queryOne, execute } from "./d1.js";

// 발송·미리보기가 같은 구현을 쓰도록 재수출 (기존 import 경로 유지)
export {
  renderTemplate,
  TEMPLATE_VARS,
  findUnknownVars,
} from "./template-vars.js";

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

/** 업체별 발신 설정 전체 (알림설정 화면용) */
export async function listSmsConfigs() {
  const { results } = await query(
    `SELECT business, sms_from, telegram_chat_id, use_reservation, use_cancellation, updated_at
     FROM sms_config ORDER BY business`,
  );
  return results;
}

/** 템플릿 전체 (객실·종류별) */
export async function listTemplates() {
  const { results } = await query(
    `SELECT id, business, room_name, kind, content, enabled,
            confirmation_enabled, checkin_enabled, checkout_enabled
     FROM room_templates ORDER BY business, room_name, kind`,
  );
  return results;
}

/** 템플릿 본문 수정 (플래그는 setRoomFlags에서 별도 관리) */
export async function updateTemplateContent(id, content) {
  return execute(`UPDATE room_templates SET content = ? WHERE id = ?`, [
    content,
    id,
  ]);
}

/**
 * 객실 발송 플래그 수정 — 해당 객실의 4개 kind 행 전체에 적용.
 * 플래그는 의미상 객실 단위인데 이관 때 kind 행마다 복제됐다(28행 전부 일치 확인).
 * kind 행별로 따로 쓰면 값이 어긋나, 발송부가 읽는 행(confirmation)만
 * 우연히 맞는 상태가 된다. 4행을 함께 갱신해 불변식을 유지한다.
 */
export async function setRoomFlags(business, roomName, f) {
  return execute(
    `UPDATE room_templates
     SET enabled = ?, confirmation_enabled = ?, checkin_enabled = ?, checkout_enabled = ?
     WHERE business = ? AND room_name = ?`,
    [
      f.enabled ? 1 : 0,
      f.confirmation_enabled ? 1 : 0,
      f.checkin_enabled ? 1 : 0,
      f.checkout_enabled ? 1 : 0,
      business,
      roomName,
    ],
  );
}

/** 업체 발신 설정 수정 — 시크릿 컬럼은 건드리지 않는다 (env가 단일 소스) */
export async function updateSmsConfig(business, patch) {
  return execute(
    `UPDATE sms_config
     SET sms_from = ?, telegram_chat_id = ?, use_reservation = ?, use_cancellation = ?, updated_at = ?
     WHERE business = ?`,
    [
      patch.sms_from,
      patch.telegram_chat_id,
      patch.use_reservation ? 1 : 0,
      patch.use_cancellation ? 1 : 0,
      new Date().toISOString(),
      business,
    ],
  );
}
