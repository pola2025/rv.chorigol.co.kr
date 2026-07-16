-- 알림설정 미이관 갭 복구 (2026-07-17)
--
-- 왜 빠졌나: 최초 로더(load-core.mjs)가 notifications_v2_* 문서를 sms_config/room_templates 로
--   정규화하면서 **화면이 편집하는 필드 4개를 흘렸다**. 신규 재작성본(app/notifications)이
--   그 4개를 안 쓰는 화면이라 갭이 드러나지 않았다.
--
-- 왜 지금 필요한가: 사용자 확정(2026-07-16) — 최종 화면은 Next 가 **레거시 컴포넌트를 렌더**한다.
--   레거시 NotificationSettingsV2 + RoomNotificationCardSafe 는 이 4개를 편집한다.
--   컬럼이 없으면 저장이 유실돼 **새로고침 시 값이 되돌아간다** = 동작 변경.
--
-- 실질 독자 현황 (2026-07-17 실측):
--   · auto_send_daily        → src/services/notificationScheduler.js (브라우저, **살아있음**)
--   · cancellation_enabled   → 독자 0 (functions/src/notifications.js 는 index.js 가 export 안 함 = 미배포)
--   · checkin_hours_before   → 독자 0 (functions/src/notificationScheduler.js 는 첫 줄 return null = 비활성)
--   · checkout_hours_before  → 독자 0 (동일)
--   독자가 없어도 **화면이 편집하므로 저장은 해야 한다**. 컷오버 후 크론이 이 값을 읽게 된다.
--
-- 플래그 복제 규칙 (기존 설계결정 3 과 동일):
--   이 3개는 의미상 **객실 단위**인데 room_templates 는 kind 행마다 복제된다(4행/객실).
--   쓰기는 반드시 4행을 함께 갱신할 것 — 행별로 어긋나면 발송부가 읽는 행만 우연히 맞는 상태가 된다.

ALTER TABLE sms_config ADD COLUMN auto_send_daily INTEGER NOT NULL DEFAULT 1;

ALTER TABLE room_templates ADD COLUMN cancellation_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE room_templates ADD COLUMN checkin_hours_before INTEGER NOT NULL DEFAULT 3;
ALTER TABLE room_templates ADD COLUMN checkout_hours_before INTEGER NOT NULL DEFAULT 1;
