-- 초호펜션 예약관리시스템 — D1 초기 스키마
-- Firestore 12컬렉션 / 2,084건을 정규화하여 이관.
-- 원본 필드 구조는 2026-07-16 운영 환경 실측 기준.
-- 정규화 원칙:
--   · 한글 컬럼명(객실명, 기본요금...) → 영문
--   · 중복 필드 통합 (phone/customerPhone, guests/guestCount)
--   · 중첩 MAP(smsStatus, notificationStatus) → notification_log 테이블로 분리
--   · 업체 구분 하드코딩 배열 → rooms.business 컬럼으로 데이터화

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
-- 예약 (Firestore: reservations, 540건)
-- ─────────────────────────────────────────────
CREATE TABLE reservations (
  id                TEXT PRIMARY KEY,           -- Firestore 문서 ID 유지
  customer_name     TEXT NOT NULL,
  phone             TEXT NOT NULL,              -- customerPhone 흡수
  room_name         TEXT NOT NULL,
  check_in          TEXT NOT NULL,              -- YYYY-MM-DD
  check_out         TEXT NOT NULL,              -- YYYY-MM-DD
  guests            INTEGER NOT NULL DEFAULT 2, -- guestCount 흡수
  status            TEXT NOT NULL,              -- 입금대기 | 예약확정 | 예약취소
  source            TEXT,                       -- naver_booking | transfer | group | 막기 ...
  depositor_name    TEXT,
  memo              TEXT,

  base_price        INTEGER NOT NULL DEFAULT 0,
  room_price        INTEGER NOT NULL DEFAULT 0,
  option_price      INTEGER NOT NULL DEFAULT 0,
  onsite_price      INTEGER NOT NULL DEFAULT 0,
  extra_guest_price INTEGER NOT NULL DEFAULT 0,
  total_price       INTEGER NOT NULL DEFAULT 0,

  -- 취소 관련 (취소 예약만 채워짐)
  cancel_reason     TEXT,
  cancellation_fee  INTEGER,
  refund_amount     INTEGER,
  refund_rate       INTEGER,
  canceled_at       TEXT,

  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
-- 스케줄러가 매일 이 두 인덱스로 당일 체크인/체크아웃을 조회한다.
CREATE INDEX idx_res_checkin  ON reservations(check_in,  status);
CREATE INDEX idx_res_checkout ON reservations(check_out, status);
CREATE INDEX idx_res_phone    ON reservations(phone);
CREATE INDEX idx_res_status   ON reservations(status);

-- ─────────────────────────────────────────────
-- 예약 옵션 (reservations.options[] / selectedOptions[] 전개)
-- ─────────────────────────────────────────────
CREATE TABLE reservation_options (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id  TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           INTEGER NOT NULL DEFAULT 0,
  is_onsite       INTEGER NOT NULL DEFAULT 0    -- 숯불바베큐 등 현장결제 = 1
);
CREATE INDEX idx_resopt_res ON reservation_options(reservation_id);

-- ─────────────────────────────────────────────
-- 발송 이력
--   Firestore: notification_logs(819) + sms_logs(267)
--   + 예약 문서의 smsStatus / notificationStatus MAP 흡수
-- ─────────────────────────────────────────────
CREATE TABLE notification_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id  TEXT REFERENCES reservations(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,               -- sms | telegram
  kind            TEXT NOT NULL,               -- confirmation | checkIn | checkOut | cancellation | new
  status          TEXT NOT NULL,               -- success | failed
  request_id      TEXT,                        -- SENS requestId (도달 추적)
  message_preview TEXT,
  error           TEXT,
  sent_at         TEXT NOT NULL
);
CREATE INDEX idx_notif_res   ON notification_log(reservation_id);
CREATE INDEX idx_notif_sent  ON notification_log(sent_at);

-- ─────────────────────────────────────────────
-- 객실 (Firestore: rooms, 7건) — 한글 컬럼 → 영문
-- ─────────────────────────────────────────────
CREATE TABLE rooms (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,         -- 객실명
  business        TEXT NOT NULL,               -- choho | shelter  (하드코딩 배열 대체)
  base_price      INTEGER,                     -- 기본요금
  weekday_price   INTEGER,                     -- 주중요금
  weekend_price   INTEGER,                     -- 주말요금
  extra_guest_fee INTEGER,                     -- 추가인원요금
  base_guests     INTEGER,                     -- 기준인원
  max_guests      INTEGER,                     -- 최대인원
  base_stock      INTEGER,                     -- 기본재고
  stock           INTEGER,                     -- 재고
  description     TEXT,                        -- 설명
  sort_order      INTEGER DEFAULT 0,           -- order
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT,
  updated_at      TEXT
);

-- ─────────────────────────────────────────────
-- 고객 (Firestore: customers, 402건)
-- ─────────────────────────────────────────────
CREATE TABLE customers (
  id                TEXT PRIMARY KEY,
  name              TEXT,
  phone             TEXT,
  email             TEXT,
  customer_grade    TEXT,
  visit_count       INTEGER DEFAULT 0,
  no_show_count     INTEGER DEFAULT 0,
  cancel_count      INTEGER DEFAULT 0,
  total_spent       INTEGER DEFAULT 0,
  marketing_consent INTEGER DEFAULT 0,
  notes             TEXT,
  tags              TEXT,                       -- JSON 배열 (tags[])
  preferred_rooms   TEXT,                       -- JSON 배열
  special_requests  TEXT,                       -- JSON 배열
  first_visit_date  TEXT,
  last_visit_date   TEXT,
  created_at        TEXT,
  updated_at        TEXT
);
CREATE INDEX idx_cust_phone ON customers(phone);

-- ─────────────────────────────────────────────
-- 옵션 마스터 (Firestore: options, 4건)
--   roomPrices/roomStocks/sharedRooms MAP은 JSON으로 보존
-- ─────────────────────────────────────────────
CREATE TABLE options (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT,
  price            INTEGER DEFAULT 0,
  description      TEXT,
  applicable_rooms TEXT,                        -- JSON: selectedRooms[] / applicableRooms
  room_prices      TEXT,                        -- JSON: roomPrices{}
  room_stocks      TEXT,                        -- JSON: roomStocks{}
  shared_rooms     TEXT,                        -- JSON: sharedRooms{}
  sort_order       INTEGER DEFAULT 0,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT,
  updated_at       TEXT
);

-- ─────────────────────────────────────────────
-- 요금 규칙 (Firestore: pricing_rules, 4건)
-- ─────────────────────────────────────────────
CREATE TABLE pricing_rules (
  id          TEXT PRIMARY KEY,
  room_name   TEXT,
  data        TEXT,                             -- JSON (규칙 구조 가변 — 원형 보존)
  created_at  TEXT,
  updated_at  TEXT
);

-- ─────────────────────────────────────────────
-- 재고 오버라이드 (Firestore: inventory_overrides, 26건)
-- ─────────────────────────────────────────────
CREATE TABLE inventory_overrides (
  id          TEXT PRIMARY KEY,
  room_name   TEXT,
  date        TEXT,                             -- YYYY-MM-DD
  stock       INTEGER,
  data        TEXT,                             -- JSON (기타 필드 보존)
  created_at  TEXT,
  updated_at  TEXT
);
CREATE INDEX idx_inv_room_date ON inventory_overrides(room_name, date);

-- ─────────────────────────────────────────────
-- 발송 설정 (Firestore: settings/notifications_v2_choho, _shelter)
--   globalSettings.sens + globalSettings.telegram 를 업체별 1행으로
-- ─────────────────────────────────────────────
CREATE TABLE sms_config (
  business          TEXT PRIMARY KEY,           -- choho | shelter
  sens_service_id   TEXT,
  sens_access_key   TEXT,
  sens_secret_key   TEXT,
  sms_from          TEXT,
  telegram_bot_token TEXT,
  telegram_chat_id  TEXT,
  use_reservation   INTEGER NOT NULL DEFAULT 1,
  use_cancellation  INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT
);

-- ─────────────────────────────────────────────
-- 객실별 문자 템플릿 (settings.roomSettings[room].templates)
--   "설정 문서 통째 로드" 패턴 제거 → room/kind 단위 조회
-- ─────────────────────────────────────────────
CREATE TABLE room_templates (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  business             TEXT NOT NULL,           -- choho | shelter
  room_name            TEXT NOT NULL,
  kind                 TEXT NOT NULL,           -- confirmation | checkIn | checkOut | cancellation
  content              TEXT NOT NULL,
  enabled              INTEGER NOT NULL DEFAULT 1,
  confirmation_enabled INTEGER NOT NULL DEFAULT 0,
  checkin_enabled      INTEGER NOT NULL DEFAULT 1,
  checkout_enabled     INTEGER NOT NULL DEFAULT 1,
  UNIQUE(business, room_name, kind)
);
CREATE INDEX idx_tpl_room ON room_templates(business, room_name);

-- ─────────────────────────────────────────────
-- 관리자 (Firebase Auth 대체) — 이메일 하드코딩 제거
-- ─────────────────────────────────────────────
CREATE TABLE admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                           -- bcrypt/argon2 (컷오버 시 설정)
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT
);

-- ─────────────────────────────────────────────
-- 로그인 시도 추적 (Firestore: login_attempts) — IP 차단용
-- ─────────────────────────────────────────────
CREATE TABLE login_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ip          TEXT NOT NULL,
  success     INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT NOT NULL
);
CREATE INDEX idx_login_ip ON login_attempts(ip, attempted_at);
