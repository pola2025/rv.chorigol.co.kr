// 객실·옵션 계층 — D1 기반 (조회 + 쓰기).
import { query, queryOne, execute } from "./d1.js";

const ROOM_COLS = `id, name, business, base_price, weekday_price, weekend_price,
  extra_guest_fee, base_guests, max_guests, base_stock, stock, description,
  sort_order, is_active`;

/** 활성 객실 목록 (정렬순) */
export async function listRooms({ activeOnly = true } = {}) {
  const where = activeOnly ? "WHERE is_active = 1" : "";
  const { results } = await query(
    `SELECT ${ROOM_COLS} FROM rooms ${where} ORDER BY sort_order`,
  );
  return results;
}

/** 객실명으로 조회 */
export async function getRoomByName(name) {
  return queryOne(`SELECT ${ROOM_COLS} FROM rooms WHERE name = ?`, [name]);
}

/** 객실명 → 업체(choho/shelter) 판별 (하드코딩 배열 대체) */
export async function businessOf(roomName) {
  const room = await queryOne(`SELECT business FROM rooms WHERE name = ?`, [
    roomName,
  ]);
  // 미등록 객실 폴백: Forest 계열이면 choho
  if (room) return room.business;
  return roomName && roomName.includes("Forest") ? "choho" : "shelter";
}

/**
 * 옵션 마스터 목록.
 * applicableRooms 는 **적용 모드 문자열**이다 ("all" | "selected" | "individual" | "shared").
 * 실제 객실 목록은 selectedRooms 에 따로 들어 있다 — 둘은 다른 필드다.
 * (이관 로더가 `selectedRooms || applicableRooms` 로 한 컬럼에 뭉개서 모드가 유실됐던 것을
 *  2026-07-16 에 selected_rooms 컬럼 추가로 분리 복원했다)
 */
export async function listOptions({ activeOnly = true } = {}) {
  const where = activeOnly ? "WHERE is_active = 1" : "";
  const { results } = await query(
    `SELECT id, name, type, price, description, applicable_rooms, selected_rooms, sort_order, is_active
     FROM options ${where} ORDER BY sort_order`,
  );
  const parse = (v) => {
    if (!v) return null;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  };
  return results.map((o) => ({
    ...o,
    applicableRooms: parse(o.applicable_rooms), // 모드
    selectedRooms: parse(o.selected_rooms), // 목록
  }));
}

// ─────────────────────────────────────────────
// 쓰기 (RoomManagement / OptionsSettings 의 Firestore 직접 쓰기 대체)
//
// ⚠️ **객실명(rooms.name)은 바꿀 수 없다** (사용자 결정 2026-07-17).
//    이름이 7곳에 사실상 FK 로 박혀 있다 — 실측(Forest 기준):
//      reservations.room_name 133 · customers.preferred_rooms(JSON) 90 ·
//      inventory_overrides(room_name + id 접두사) 7 · room_templates 4 ·
//      pricing_rules.data(JSON) 1 · option_settings.data(JSON 키) 2
//    레거시의 rename 연쇄는 두 군데 다 깨져 있었다:
//      · `where('room','==',old)` — 예약 필드는 `roomName` 이라 **항상 0건** → 예약이 고아가 된다
//      · `docId.includes('_'+old)` — **부분일치**라 "Forest" 를 바꾸면 "Forest mini" 까지 파괴된다
//    → 고쳐서 되살리는 대신 막는다. 지금도 제대로 동작하지 않으므로 기능 손실이 없다.
// ─────────────────────────────────────────────

const ROOM_WRITE_FIELDS = [
  "name", "business", "base_price", "weekday_price", "weekend_price",
  "extra_guest_fee", "base_guests", "max_guests", "base_stock", "stock",
  "description", "sort_order", "is_active",
];

/** 로더(load-core biz)·런타임 폴백(businessOf)과 **같은 규칙**을 쓴다 — 세 곳이 갈리면 안 된다 */
export const businessForName = (name) =>
  name && name.includes("Forest") ? "choho" : "shelter";

/** 취소되지 않은 예약 수 — 객실 삭제 가드용 */
export async function activeReservationCount(roomName) {
  const r = await queryOne(
    `SELECT COUNT(*) c FROM reservations WHERE room_name = ? AND COALESCE(status,'') != '예약취소'`,
    [roomName],
  );
  return r?.c ?? 0;
}

/**
 * 객실 생성. 레거시 `addDoc(rooms, {...formData, 재고: 기본재고})` 대체.
 * business 는 폼에 없는 필드라 이름에서 유도한다(명시 전달 시 그 값 우선).
 */
export async function createRoom(data) {
  const name = String(data.name ?? "").trim();
  if (!name) throw new Error("객실명이 필요합니다.");
  if (await getRoomByName(name)) throw new Error("이미 존재하는 객실명입니다.");

  const now = new Date().toISOString();
  // 레거시: 생성 시 재고 = 기본재고
  const stock = data.stock ?? data.base_stock ?? 0;
  const row = {
    ...data,
    name,
    stock,
    business: data.business || businessForName(name),
    is_active: data.is_active ?? 1,
    sort_order: data.sort_order ?? 0,
  };
  const cols = ROOM_WRITE_FIELDS.filter((f) => row[f] !== undefined);
  // Firestore 스타일 문서 ID (기존 데이터와 형식 일관 — rooms 는 'forest' 같은 슬러그도 섞여 있다)
  const id = data.id || crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  await execute(
    `INSERT INTO rooms (id, ${cols.join(",")}, created_at, updated_at)
     VALUES (?, ${cols.map(() => "?").join(",")}, ?, ?)`,
    [id, ...cols.map((f) => row[f]), now, now],
  );
  return getRoomById(id);
}

export async function getRoomById(id) {
  return queryOne(`SELECT ${ROOM_COLS} FROM rooms WHERE id = ?`, [id]);
}

/**
 * 객실 수정. **name 은 무시하지 않고 거부한다** — 조용히 버리면 화면엔 바뀐 것처럼 보인다.
 * 레거시: 기본재고를 바꾸면 재고도 같이 바뀐다(saveInlineEdit / handleSave 동일).
 */
export async function updateRoom(id, patch) {
  const before = await getRoomById(id);
  if (!before) return null;

  if (patch.name !== undefined && patch.name !== before.name)
    throw new Error("객실명은 변경할 수 없습니다. 새 객실을 만들어 주세요.");

  const row = { ...patch };
  delete row.name;
  // 레거시: 기본재고 변경 시 재고도 같이 갱신 (saveInlineEdit:333, handleSave:195)
  if (row.base_stock !== undefined && row.stock === undefined)
    row.stock = row.base_stock;

  const cols = ROOM_WRITE_FIELDS.filter((f) => f !== "name" && row[f] !== undefined);
  if (!cols.length) return before;
  await execute(
    `UPDATE rooms SET ${cols.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    [...cols.map((f) => row[f]), new Date().toISOString(), id],
  );
  return getRoomById(id);
}

/**
 * 객실 삭제. **활성 예약이 있으면 거부** — 레거시도 막으려 했지만 `r.room`(없는 필드)으로
 * 걸러서 가드가 한 번도 동작하지 않았다(예약 133건짜리 객실도 그냥 지워졌다). 여기서 제대로 막는다.
 */
export async function deleteRoom(id) {
  const room = await getRoomById(id);
  if (!room) return { deleted: false, reason: "not_found" };
  const active = await activeReservationCount(room.name);
  if (active > 0) return { deleted: false, reason: "has_reservations", count: active, room };
  await execute(`DELETE FROM rooms WHERE id = ?`, [id]);
  return { deleted: true, room };
}

// ─── 옵션 쓰기 ───

const OPTION_WRITE_FIELDS = [
  "name", "type", "price", "description", "applicable_rooms", "selected_rooms",
  "room_prices", "room_stocks", "shared_rooms", "sort_order", "is_active",
];
// JSON 으로 저장되는 컬럼 — 객체/배열로 넘어오면 문자열화한다
const OPTION_JSON = new Set(["applicable_rooms", "selected_rooms", "room_prices", "room_stocks", "shared_rooms"]);
const enc = (f, v) => (OPTION_JSON.has(f) && typeof v === "object" && v !== null ? JSON.stringify(v) : v);

export async function getOptionById(id) {
  return queryOne(`SELECT * FROM options WHERE id = ?`, [id]);
}

/** 옵션 생성 — 레거시 `addDoc(options, {...})` */
export async function createOption(data) {
  if (!data.name) throw new Error("옵션명이 필요합니다.");
  const now = new Date().toISOString();
  const row = { is_active: 1, sort_order: 0, price: 0, ...data };
  const cols = OPTION_WRITE_FIELDS.filter((f) => row[f] !== undefined);
  const id = data.id || crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  await execute(
    `INSERT INTO options (id, ${cols.join(",")}, created_at, updated_at)
     VALUES (?, ${cols.map(() => "?").join(",")}, ?, ?)`,
    [id, ...cols.map((f) => enc(f, row[f])), now, now],
  );
  return getOptionById(id);
}

/** 옵션 수정 — 레거시 `updateDoc(options/{id}, {...})` */
export async function updateOption(id, patch) {
  const before = await getOptionById(id);
  if (!before) return null;
  const cols = OPTION_WRITE_FIELDS.filter((f) => patch[f] !== undefined);
  if (!cols.length) return before;
  await execute(
    `UPDATE options SET ${cols.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    [...cols.map((f) => enc(f, patch[f])), new Date().toISOString(), id],
  );
  return getOptionById(id);
}

/** 옵션 삭제 — 레거시 `deleteDoc(options/{id})` */
export async function deleteOption(id) {
  const before = await getOptionById(id);
  if (!before) return { deleted: false };
  await execute(`DELETE FROM options WHERE id = ?`, [id]);
  return { deleted: true, option: before };
}
