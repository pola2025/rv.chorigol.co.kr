-- room_templates.title 미이관 갭 복구 (2026-07-17) — 0002 의 후속
--
-- 0002 를 만들고 역매퍼를 쓰려고 덤프의 템플릿 모양을 측정하다 **다섯 번째 갭**을 찾았다.
-- 레거시 템플릿은 `{ content, title }` 인데 최초 로더가 content 만 옮겼다.
--
--   RoomNotificationCardSafe:351 → title 편집 input (value={currentTemplate.title})
--   RoomNotificationCardSafe:398 → 미리보기에 표시
--   발송부(smsScheduler · reservationTriggers · lib/*) → **읽지 않는다** (SMS 엔 제목 개념이 없다)
--
-- 즉 화면 전용 필드다. 그래도 컬럼이 없으면 저장이 유실돼 새로고침 시 값이 사라진다.
-- 덤프에 실값 28개가 있다 (예: "초호펜션 Forest 예약확정").
--
-- ⚠️ 0002 의 3개 컬럼과 성격이 다르다:
--     · cancellation_enabled / checkin_hours_before / checkout_hours_before → **객실 단위** (4행 동일값)
--     · content / title                                                     → **kind 단위** (행마다 다름)
--    title 을 4행에 함께 쓰면 "예약확정" 제목이 퇴실안내에도 박힌다.

ALTER TABLE room_templates ADD COLUMN title TEXT;
