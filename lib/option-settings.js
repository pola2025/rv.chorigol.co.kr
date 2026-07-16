// 기본 옵션 오버라이드 (서버 전용) — Firestore `settings/option_settings` 대체.
//
// 레거시는 문서 하나를 통째로 읽어 `{ late_checkout: {...}, extra_person: {...} }` 맵으로 쓴다
// (useOptionSettings.js). D1 엔 키당 1행으로 두고 여기서 다시 맵으로 조립한다 — 읽는 쪽 모양은 동일.
//
// ⚠️ `options` 테이블과 합치지 않는다. id(late_checkout)가 겹치고 **독자가 다르다**:
//    · options/late_checkout         → 예약모달 옵션 목록(이름·가격·설명). useOptions 가 읽는다
//    · option_settings/late_checkout → roomStocks. useLateCheckoutSettings 가 읽어 **옵션 노출 여부**를
//      정한다 (NewReservationModal:845 — 재고>0 인 객실에만 체크박스가 뜬다)
//    둘 다 진실이고 용도가 다르다. 합치면 한쪽이 죽는다.
import { query, execute } from "./d1.js";

const parseJson = (v) => {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

/**
 * 레거시 `settingsDoc.data()` 와 같은 모양의 맵을 돌려준다.
 * @returns {Promise<Record<string, object>>} { late_checkout: {...}, extra_person: {...} }
 */
export async function getOptionSettings() {
  const { results } = await query(`SELECT id, data FROM option_settings`);
  const out = {};
  for (const r of results) {
    const v = parseJson(r.data);
    if (v) out[r.id] = v;
  }
  return out;
}

/**
 * 기본 옵션 하나를 저장 — 레거시 `setDoc(ref, {...settings, [id]: data}, {merge:true})` 대체.
 * 레거시는 문서 전체를 merge 로 썼지만 실질은 **키 하나 교체**라 키 단위 upsert 로 옮겼다
 * (다른 키를 건드리지 않는다는 점에서 merge 와 동등하고, 동시 저장에 더 안전하다).
 */
export async function setOptionSetting(id, data) {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO option_settings (id, data, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET data = ?2, updated_at = ?3`,
    [id, JSON.stringify(data), now],
  );
}
