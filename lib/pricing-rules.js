// 시즌 요금 규칙 (서버 전용) — RoomManagement 의 Firestore 직접 쓰기 대체.
//
// 규칙 구조가 가변이라 이관 때 **원본 문서를 data JSON 에 통째로 보존**했다
// (load-core.mjs: `INSERT INTO pricing_rules (id, room_name, data, ...)`).
// 읽기(legacy-shape.toBlob)는 data 를 펼쳐 `{...원본, id}` 로 되돌린다 →
// 쓰기도 같은 규약을 지켜야 한다: **규칙 객체를 통째로 data 에**, 조회용으로 room_name 만 발췌.
import { query, queryOne, execute } from "./d1.js";

/** 조회용 발췌 — 레거시 로더와 같은 규칙(`p.roomName || p.room`) */
const roomNameOf = (rule) => rule?.roomName ?? rule?.room ?? null;

/** 메타(_로 시작)는 원본 Firestore 필드라 새로 쓸 때는 넣지 않는다 */
const stripMeta = (o) =>
  Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith("_")));

export async function getPricingRuleById(id) {
  return queryOne(`SELECT id, room_name, data FROM pricing_rules WHERE id = ?`, [id]);
}

export async function listPricingRules() {
  const { results } = await query(`SELECT id, room_name, data FROM pricing_rules`);
  return results;
}

/** 생성 — 레거시 `addDoc(pricing_rules, {...ruleData, created, updated, isActive:true})` */
export async function createPricingRule(rule) {
  const now = new Date().toISOString();
  const data = { ...stripMeta(rule), isActive: rule?.isActive ?? true };
  const id = rule?.id || crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  delete data.id; // id 는 컬럼으로 나간다 (toBlob 이 다시 붙여준다)
  await execute(
    `INSERT INTO pricing_rules (id, room_name, data, created_at, updated_at) VALUES (?,?,?,?,?)`,
    [id, roomNameOf(rule), JSON.stringify(data), now, now],
  );
  return getPricingRuleById(id);
}

/**
 * 수정 — 레거시 `updateDoc(pricing_rules/{id}, {...})` 는 **부분 갱신**이라
 * 기존 data 에 머지해야 한다. 통째로 갈아끼우면 안 보낸 필드가 사라진다.
 */
export async function updatePricingRule(id, patch) {
  const before = await getPricingRuleById(id);
  if (!before) return null;
  let prev = {};
  try {
    prev = JSON.parse(before.data) || {};
  } catch {}
  const merged = { ...stripMeta(prev), ...stripMeta(patch) };
  delete merged.id;
  await execute(
    `UPDATE pricing_rules SET room_name = ?, data = ?, updated_at = ? WHERE id = ?`,
    [roomNameOf(merged) ?? before.room_name, JSON.stringify(merged), new Date().toISOString(), id],
  );
  return getPricingRuleById(id);
}

export async function deletePricingRule(id) {
  const before = await getPricingRuleById(id);
  if (!before) return { deleted: false };
  await execute(`DELETE FROM pricing_rules WHERE id = ?`, [id]);
  return { deleted: true, rule: before };
}
