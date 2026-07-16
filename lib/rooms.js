// 객실·옵션 조회 계층 — D1 기반.
import { query, queryOne } from "./d1.js";

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

/** 옵션 마스터 목록 */
export async function listOptions({ activeOnly = true } = {}) {
  const where = activeOnly ? "WHERE is_active = 1" : "";
  const { results } = await query(
    `SELECT id, name, type, price, description, applicable_rooms, sort_order, is_active
     FROM options ${where} ORDER BY sort_order`,
  );
  return results.map((o) => ({
    ...o,
    applicableRooms: o.applicable_rooms ? JSON.parse(o.applicable_rooms) : null,
  }));
}
