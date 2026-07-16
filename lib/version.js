// 데이터 변경 감지용 버전 — heartbeat 가 "바뀐 거 있나?"만 싸게 묻는다.
//
// 전체를 다시 읽지 않고 이 한 줄만 본다. reservations(updated_at)에 인덱스가 있어
// MAX() 가 O(1) 이다 (인덱스 없으면 540행 스캔 → 30초 폴링에 하루 130만행).
//   실측: idx_res_updated 추가로 rows_read 540 → 1
//   30초 heartbeat · 관리자 2명 · 10시간 = 2,400 rows/일 (무료한도 0.05%)
//
// ⚠️ 삭제는 MAX(updated_at) 으로 안 잡힌다 → COUNT 를 함께 본다.
//    (COUNT 는 인덱스로 커버되어 저렴)
import { query } from "./d1.js";

/** @returns {Promise<string>} 데이터가 바뀌면 달라지는 값 */
export async function currentVersion() {
  const { results } = await query(
    `SELECT (SELECT COUNT(*) FROM reservations) AS c,
            (SELECT MAX(updated_at) FROM reservations) AS t`,
  );
  const r = results[0] || {};
  return `${r.c ?? 0}:${r.t ?? ""}`;
}
