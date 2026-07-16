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

// ─────────────────────────────────────────────────────────────────────────────
// 레거시 문서 모양 매퍼 — settings/notifications_v2_{business}
//
// 사용자 확정(2026-07-16): 최종 화면은 Next 가 **레거시 컴포넌트를 렌더**한다.
// NotificationSettingsV2 는 Firestore 문서 모양을 통째로 읽고 쓴다:
//   { globalSettings: { sens{}, telegram{} }, roomSettings: { [객실]: { enabled, autoSend{}, templates{} } } }
// D1 은 sms_config + room_templates 로 정규화돼 있으므로 여기서 되돌린다.
//
// ⚠️ 시크릿(SENS 키·봇토큰)은 **절대 내려보내지 않는다.** 그게 이식의 목적이다
//    (sensService 가 accessKey/secretKey 를 브라우저로 내리던 보안 구멍 — 보안 0순위).
//    화면은 secretsManaged 플래그를 보고 "서버에서 관리" 표시를 띄운다.
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_KINDS = [
  "confirmation",
  "checkIn",
  "checkOut",
  "cancellation",
];

/** D1 → 레거시 notifications_v2_{business} 문서 모양 (시크릿 제외) */
export async function getNotificationSettingsDoc(business) {
  const cfg = await queryOne(
    `SELECT sms_from, telegram_chat_id, use_reservation, use_cancellation, auto_send_daily
     FROM sms_config WHERE business = ?`,
    [business],
  );
  const { results: rows } = await query(
    `SELECT room_name, kind, content, title, enabled, confirmation_enabled,
            checkin_enabled, checkout_enabled, cancellation_enabled,
            checkin_hours_before, checkout_hours_before
     FROM room_templates WHERE business = ? ORDER BY room_name, kind`,
    [business],
  );

  const roomSettings = {};
  for (const r of rows) {
    // 객실 단위 필드는 4개 kind 행에 복제돼 있다 — 첫 행 기준으로 만든다(불변식은 쓰기가 지킨다)
    const rs = (roomSettings[r.room_name] ||= {
      enabled: !!r.enabled,
      autoSend: {
        checkInEnabled: !!r.checkin_enabled,
        checkInHoursBefore: r.checkin_hours_before,
        checkOutEnabled: !!r.checkout_enabled,
        checkOutHoursBefore: r.checkout_hours_before,
        confirmationEnabled: !!r.confirmation_enabled,
        cancellationEnabled: !!r.cancellation_enabled,
      },
      templates: {},
    });
    // 템플릿은 kind 단위 — 행마다 다르다
    rs.templates[r.kind] = { content: r.content, title: r.title ?? "" };
  }

  return {
    globalSettings: {
      // 시크릿 3개는 빈 값으로 내려간다. 화면이 값을 보여주지도, 저장하지도 않는다.
      sens: {
        serviceId: "",
        accessKey: "",
        secretKey: "",
        from: cfg?.sms_from ?? "",
      },
      telegram: {
        botToken: "",
        chatId: cfg?.telegram_chat_id ?? "",
        useReservation: !!cfg?.use_reservation,
        useCancellation: !!cfg?.use_cancellation,
        autoSendDaily: !!cfg?.auto_send_daily,
      },
    },
    roomSettings,
    secretsManaged: true,
  };
}

/**
 * 레거시 문서 모양 → D1 쓰기. 화면의 저장 3경로(전역/객실1개/전체)가 전부
 * 문서를 통째로 setDoc 하므로 여기서도 통째로 받는다.
 *
 * 시크릿은 무시한다 (env 단일 소스). 객실 단위 플래그는 4행 함께, 템플릿은 행별.
 */
export async function saveNotificationSettingsDoc(business, doc) {
  const g = doc?.globalSettings ?? {};
  const now = new Date().toISOString();

  // 1) 업체 발신 설정 — 시크릿 컬럼은 SET 에 없다
  const smsFrom = String(g.sens?.from ?? "").replace(/-/g, "");
  await execute(
    `UPDATE sms_config
       SET sms_from = ?, telegram_chat_id = ?, use_reservation = ?,
           use_cancellation = ?, auto_send_daily = ?, updated_at = ?
     WHERE business = ?`,
    [
      smsFrom,
      String(g.telegram?.chatId ?? ""),
      g.telegram?.useReservation ? 1 : 0,
      g.telegram?.useCancellation ? 1 : 0,
      g.telegram?.autoSendDaily ? 1 : 0,
      now,
      business,
    ],
  );

  // 2) 객실별 — 레거시 setDoc 은 없는 객실도 그냥 만들어줬다(예: 단체예약).
  //    화면이 ROOM_GROUPS 하드코딩으로 카드를 그려서 D1 에 행이 없는 객실이 있다 → upsert.
  let rows = 0;
  for (const [roomName, rs] of Object.entries(doc?.roomSettings ?? {})) {
    const a = rs?.autoSend ?? {};
    const flags = [
      rs?.enabled ? 1 : 0,
      a.confirmationEnabled ? 1 : 0,
      a.checkInEnabled ? 1 : 0,
      a.checkOutEnabled ? 1 : 0,
      a.cancellationEnabled ? 1 : 0,
      Number.isFinite(a.checkInHoursBefore) ? a.checkInHoursBefore : 3,
      Number.isFinite(a.checkOutHoursBefore) ? a.checkOutHoursBefore : 1,
    ];

    for (const kind of TEMPLATE_KINDS) {
      const t = rs?.templates?.[kind];
      if (!t) continue;
      const content = typeof t === "object" ? (t.content ?? "") : String(t);
      const title = typeof t === "object" ? (t.title ?? "") : "";

      await execute(
        `INSERT INTO room_templates
           (business, room_name, kind, content, title, enabled, confirmation_enabled,
            checkin_enabled, checkout_enabled, cancellation_enabled,
            checkin_hours_before, checkout_hours_before)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(business, room_name, kind) DO UPDATE SET
           content = ?4, title = ?5, enabled = ?6, confirmation_enabled = ?7,
           checkin_enabled = ?8, checkout_enabled = ?9, cancellation_enabled = ?10,
           checkin_hours_before = ?11, checkout_hours_before = ?12`,
        [business, roomName, kind, content, title, ...flags],
      );
      rows++;
    }
  }
  return rows;
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
