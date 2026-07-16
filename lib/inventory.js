// 재고 가드 — 오버부킹 방지 (서버 전용).
//
// D1엔 대화형 트랜잭션이 없다. 대신 **한 문장은 원자적**이라는 SQLite 성질을 쓴다:
// 재고 검사를 INSERT/UPDATE의 WHERE에 넣어, 통과할 때만 쓰이게 한다.
// D1은 쓰기를 단일 primary로 직렬화하므로 문장 안에서 상태가 낡을 수 없다.
//
// ⚠️ 레거시(Firestore)는 사실 오버부킹을 못 막았다: 예약 목록을 runTransaction **밖**에서
//    getDocs로 읽고 안에서 그 낡은 배열로 셌다(transaction.get은 override 문서 하나뿐).
//    즉 동시 예약이 같은 스냅샷을 보고 둘 다 통과하는 TOCTOU였다. 여기서 제대로 막는다.
//
// 재고 규칙 (레거시 getAvailableStock 이식 + override 의미만 교정):
//   1) rooms에 객실 없으면 → 0            (override보다 먼저 — 레거시 순서)
//   2) 정원 = override.stock ?? rooms.stock ?? 0
//   3) 남은재고 = max(0, 정원 - 점유예약수)   ← override도 차감한다 (레거시와 다른 유일한 점)
//   4) 점유: check_in <= d < check_out (퇴실일 제외) · 취소 제외 · 막기도 점유로 셈
//   5) source='막기' → 검사 자체를 스킵
//
// override 의미 교정(사용자 결정 2026-07-16): 레거시는 override를 "남은 재고 절대값"으로
// 읽어 예약수를 차감하지 않았다 → 만실인데 계속 받는 버그(2025-08-15 호수뷰객실 ov=6·예약=6).
// 저장된 값 4건이 전부 rooms.stock과 같아 "정원" 해석으로 바꿔도 데이터 변환은 불필요했다.
//
// 📌 **override 의 단일 소스는 `stock` 컬럼이다** (아래 setOverride 주석 참조).
//    가드도 스토어 매퍼(lib/legacy-shape.js)도 `stock` 을 읽는다. 새 쓰기 경로를 만들 때
//    `data` JSON 만 갱신하면 화면과 재고검사가 조용히 어긋난다.
import { query } from "./d1.js";

const NIGHTS_LIMIT = 60; // CTE 폭주 방지 (쓰기 락을 잡은 채 수백만 행 생성되는 사고 차단)

// 숙박일 전개 — ?2=check_in, ?3=check_out. 0박/역전이면 빈 집합(레거시 while문과 동일).
const DATES_CTE = `
  WITH RECURSIVE dates(d) AS (
    SELECT ?2 WHERE ?2 < ?3
    UNION ALL SELECT date(d,'+1 day') FROM dates WHERE date(d,'+1 day') < ?3
  )`;

/**
 * 날짜 d의 남은 재고 식. ?1=room_name.
 * @param {string} excludeIdParam - UPDATE 시 자기 자신을 점유에서 제외할 파라미터(예: '?4'). 없으면 null.
 */
function availableExpr(excludeIdParam) {
  const selfExclude = excludeIdParam ? `AND x.id != ${excludeIdParam}` : "";
  return `
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE name = ?1) THEN 0
      ELSE MAX(0,
        COALESCE(
          (SELECT io.stock FROM inventory_overrides io WHERE io.room_name = ?1 AND io.date = dates.d),
          COALESCE((SELECT r.stock FROM rooms r WHERE r.name = ?1), 0)
        )
        - (SELECT COUNT(*) FROM reservations x
            WHERE x.room_name = ?1
              AND COALESCE(x.status,'') != '예약취소'
              AND x.check_in <= dates.d AND dates.d < x.check_out
              ${selfExclude})
      )
    END`;
}

/** 재고가 바닥난 날이 하나라도 있으면 참 → 이 조건이 거짓일 때만 쓰기가 일어난다 */
const blockedExists = (excludeIdParam) =>
  `EXISTS (SELECT 1 FROM dates WHERE (${availableExpr(excludeIdParam)}) <= 0)`;

function guardNights(check_in, check_out) {
  if (!check_in || !check_out) return null; // 레거시도 통과시킴(빈 루프) — 스키마 CHECK로 별도 방어
  const nights = (new Date(check_out) - new Date(check_in)) / 86400000;
  if (nights > NIGHTS_LIMIT)
    throw new Error(`숙박일이 ${NIGHTS_LIMIT}박을 넘습니다`);
  return nights;
}

/**
 * 원자적 예약 생성. 재고가 없으면 아무것도 쓰이지 않는다.
 * @returns {Promise<{created: boolean}>} created=false면 재고 부족(또는 없는 객실)
 */
export async function insertGuarded(r) {
  guardNights(r.check_in, r.check_out);
  const now = new Date().toISOString();
  const sql = `${DATES_CTE}
    INSERT INTO reservations
      (id, customer_name, phone, room_name, check_in, check_out, guests, status, source,
       depositor_name, memo, base_price, room_price, option_price, onsite_price,
       extra_guest_price, total_price, created_at, updated_at)
    SELECT ?4, ?5, ?6, ?1, ?2, ?3, ?7, COALESCE(?8,'입금대기'), ?9,
           ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18
    WHERE COALESCE(?9,'') = '막기' OR NOT ${blockedExists(null)}`;

  const { meta } = await query(sql, [
    r.room_name,
    r.check_in,
    r.check_out,
    r.id,
    r.customer_name,
    r.phone,
    r.guests ?? 2,
    r.status ?? null,
    r.source ?? null,
    r.depositor_name ?? null,
    r.memo ?? null,
    r.base_price ?? 0,
    r.room_price ?? 0,
    r.option_price ?? 0,
    r.onsite_price ?? 0,
    r.extra_guest_price ?? 0,
    r.total_price ?? 0,
    now,
  ]);
  return { created: (meta.changes ?? 0) > 0 };
}

/**
 * 원자적 예약 수정 — 날짜·객실·상태를 바꿀 때 재고를 다시 검사한다.
 * INSERT만 막으면 취소→확정 되돌리기·날짜 수정으로 점유가 되살아나 구멍이 남는다.
 * 자기 자신(?4=id)은 점유 계산에서 제외해야 한다 — 안 그러면 재고 1짜리 방은 자기가 자기를 막는다.
 */
export async function updateGuarded(id, r) {
  guardNights(r.check_in, r.check_out);
  const now = new Date().toISOString();
  // COALESCE(?N, 컬럼) — 넘기지 않은 필드는 기존 값을 유지한다(부분 수정 지원)
  const sql = `${DATES_CTE}
    UPDATE reservations
       SET room_name = ?1, check_in = ?2, check_out = ?3,
           customer_name = COALESCE(?5, customer_name),
           phone = COALESCE(?6, phone),
           guests = COALESCE(?7, guests),
           status = COALESCE(?8, status),
           source = COALESCE(?9, source),
           total_price = COALESCE(?10, total_price),
           depositor_name = COALESCE(?12, depositor_name),
           memo = COALESCE(?13, memo),
           base_price = COALESCE(?14, base_price),
           room_price = COALESCE(?15, room_price),
           option_price = COALESCE(?16, option_price),
           onsite_price = COALESCE(?17, onsite_price),
           extra_guest_price = COALESCE(?18, extra_guest_price),
           updated_at = ?11
     WHERE id = ?4
       AND (COALESCE(?9, (SELECT source FROM reservations WHERE id = ?4), '') = '막기'
            OR NOT ${blockedExists("?4")})`;

  const { meta } = await query(sql, [
    r.room_name,
    r.check_in,
    r.check_out,
    id,
    r.customer_name ?? null,
    r.phone ?? null,
    r.guests ?? null,
    r.status ?? null,
    r.source ?? null,
    r.total_price ?? null,
    now,
    r.depositor_name ?? null,
    r.memo ?? null,
    r.base_price ?? null,
    r.room_price ?? null,
    r.option_price ?? null,
    r.onsite_price ?? null,
    r.extra_guest_price ?? null,
  ]);
  return { updated: (meta.changes ?? 0) > 0 };
}

/**
 * 거절 원인 진단 — changes=0 은 "재고없음"과 "없는 객실"을 구분 못 한다.
 * 거절 경로에서만 도는 추가 조회라 원자성과 무관하다(에러 문구 정확도만 좌우).
 * @returns {Promise<{reason:'room_not_found'|'no_stock'|'unknown', date?:string}>}
 */
export async function diagnose(
  room_name,
  check_in,
  check_out,
  excludeId = null,
) {
  const room = await query(`SELECT 1 FROM rooms WHERE name = ?`, [room_name]);
  if (!room.results.length) return { reason: "room_not_found" };

  // 레거시는 날짜 루프를 시간순으로 돌며 첫 실패 날짜를 알린다 → ORDER BY d LIMIT 1
  const sql = `${DATES_CTE}
    SELECT d, (${availableExpr(excludeId ? "?4" : null)}) AS avail
      FROM dates WHERE avail <= 0 ORDER BY d LIMIT 1`;
  const params = [room_name, check_in, check_out];
  if (excludeId) params.push(excludeId);
  const { results } = await query(sql, params);

  if (!results.length) return { reason: "unknown" }; // 진단 사이에 취소가 들어온 경우 등
  return { reason: "no_stock", date: results[0].d };
}

/** 단일 날짜 남은 재고 (화면 표시용) — 가드와 같은 식을 쓴다(두 벌이 되면 어긋난다) */
export async function availableStock(room_name, date) {
  const sql = `
    WITH RECURSIVE dates(d) AS (SELECT ?2)
    SELECT (${availableExpr(null)}) AS avail FROM dates`;
  const { results } = await query(sql, [room_name, date]);
  return results[0]?.avail ?? 0;
}

// ─────────────────────────────────────────────
// 재고 수동 조정 (override 쓰기) — 레거시 updateInventoryOverride 이식
// ─────────────────────────────────────────────

/** 레거시 문서 ID 규칙. **ID가 진실**이다 — 레거시는 override를 doc(id)로만 조회한다 */
export const overrideId = (date, room_name) => `${date}_${room_name}`;

/**
 * override 저장 (upsert) — 레거시 `setDoc({available,dateStr,roomName,updatedAt},{merge:true})`.
 *
 * ⚠️ **`stock` 컬럼과 `data.available` 을 반드시 함께 쓴다.**
 * 재고 가드는 `stock` 을, 스토어 매퍼는 `stock ?? data.available` 을 읽는다.
 * 한쪽만 갱신하면 화면과 재고검사가 어긋난다 — 화면엔 여유가 보이는데 예약이 거절되거나 그 반대.
 * `date`·`room_name` 컬럼도 채워야 한다: 가드가 `WHERE room_name=? AND date=?` 로 찾기 때문에
 * 비면 이관 버그 때처럼 **막아둔 날이 통째로 무시**된다.
 *
 * data 는 json_patch 로 **머지**한다(레거시 merge:true 와 동일) — createdAt 같은 기존 필드 보존.
 */
export async function setOverride(date, room_name, available) {
  const now = new Date().toISOString();
  // 레거시가 문서에 남기는 4개 필드와 동일하게 (신규 생성 시의 모양도 레거시와 같다)
  const patch = JSON.stringify({
    available,
    dateStr: date,
    roomName: room_name,
    updatedAt: now,
  });
  const sql = `
    INSERT INTO inventory_overrides (id, room_name, date, stock, data, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
    ON CONFLICT(id) DO UPDATE SET
      room_name  = excluded.room_name,
      date       = excluded.date,
      stock      = excluded.stock,
      data       = json_patch(COALESCE(inventory_overrides.data, '{}'), ?5),
      updated_at = ?6`;
  await query(sql, [
    overrideId(date, room_name),
    room_name,
    date,
    available,
    patch,
    now,
  ]);
}

/** override 삭제 = 기본 재고로 복원. 레거시는 문서가 없어도 성공으로 처리한다 */
export async function deleteOverride(date, room_name) {
  await query(`DELETE FROM inventory_overrides WHERE id = ?`, [
    overrideId(date, room_name),
  ]);
}
