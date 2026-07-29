// 2026-07-29 인원 규정 개편 문구 모음.
//
// · MARK_*  : D1 저장 문자 안에서 이번에 바뀐 구간 — 화면에서 노랗게 표시하는 데만 쓴다.
//             저장값과 글자 단위로 같아야 잡히므로 임의로 손대지 말 것.
// · NAVER_* : 네이버 스마트플레이스에 사람이 직접 붙여넣는 문구. 시스템 반영 대상이 아니라
//             여기 적어두고 복사 버튼으로 넘긴다. 문구가 바뀌면 이 파일을 고쳐 배포해야 한다.

// ── 예약확정 문자에 들어간 인원 규정 (D1 저장값의 일부) ──────────────────
export const MARK_CONFIRM_FAMILY = `객실정보 Forest 패밀리
기준인원
정원 4명 + 유아1명
- 36개월 이상 어린이/청소년은
모두 정원에 해당, 어른5명 이용 불가)

포레스트 패밀리
- 36개월 미만 아동 인원에는 포함

어른5명 이용불가
정원4명 + 유아1명 까지만 가능
- 유아기준 36개월 미만`;

export const MARK_CONFIRM_MINI = `객실정보 Forest 미니패밀리
기준인원
정원 2명 + 유아1명
- 어른2명, 유아1명 한가족만 가능, 어른3명 이용불가
- 유아기준 36개월 미만
- 36개월 미만 아동 인원에는 포함
- 36개월 이상 어린이/청소년은
모두 정원에 해당, 어른3명 이용 불가`;

export const MARK_TAIL = `- 최대인원 초과시 입실이 불가능 할 수 있습니다.
- 기준 및 최대인원 준수 바랍니다.`;

// ── 입실안내 문자에 들어간 구간 (예약확정보다 먼저 넣은 판) ───────────────
export const MARK_CHECKIN_FAMILY = `포레스트 패밀리
- 36개월 미만 아동 인원에는 포함(요금은 미부과)

어른5명 이용불가
어른4명 + 36개월 미만 1명 까지만 가능`;

export const MARK_CHECKIN_MINI = `포레스트 미니패밀리

- 36개월 미만 아동 인원에는 포함(요금은 미부과)

어른3명 이용불가
어른2명 까지 사용 가능

어른2명 + 36개월 미만 1명 까지만 가능`;

// ── 네이버 스마트플레이스 붙여넣기용 ─────────────────────────────────────
export const NAVER_ROOMS = [
  { room: "Forest 패밀리", text: MARK_CONFIRM_FAMILY },
  { room: "Forest 미니패밀리", text: MARK_CONFIRM_MINI },
];

export const NAVER_OPTIONS = [
  {
    room: "Forest 패밀리",
    text: `옵션설정 Forest 패밀리
반드시 체크해주셔야 합니다.
기준인원
정원 4명 + 유아1명
- 유아기준 36개월 미만
- 36개월 미만 아동 인원에는 포함
- 36개월 이상 어린이/청소년은
모두 정원에 해당, 어른5명 이용 불가)

- 유아도 인원으로 포함
2인 이용 시 2 체크
3인 이용 시 3 체크
4인 이용 시 4 체크
5인 이용 시 5 체크`,
  },
  {
    room: "Forest mini 패밀리",
    text: `옵션설정 Forest mini 패밀리
반드시 체크해주셔야 합니다.
기준인원
정원 2명 + 유아1명
- 어른2명, 유아1명 한가족만 가능, 어른3명 이용불가
- 유아기준 36개월 미만
- 36개월 미만 아동 인원에는 포함

- 36개월 이상 어린이/청소년은
모두 정원에 해당

- 유아도 인원에 포함
2인 이용 시 2 체크
3인 이용 시 3 체크

어른3명은 이용이 불가능합니다.`,
  },
];

/** 객실·종류별로 화면에서 강조할 구간들 */
export function marksFor(roomName, kind) {
  if (kind === "confirmation") {
    if (roomName === "Forest 패밀리") return [MARK_CONFIRM_FAMILY, MARK_TAIL];
    if (roomName === "Forest mini 패밀리")
      return [MARK_CONFIRM_MINI, MARK_TAIL];
  }
  if (kind === "checkIn") {
    if (roomName === "Forest 패밀리") return [MARK_CHECKIN_FAMILY];
    if (roomName === "Forest mini 패밀리") return [MARK_CHECKIN_MINI];
  }
  return [];
}

/** 본문을 강조 구간 기준으로 쪼갠다 — 겹치지 않는 순서대로 한 번씩만 잡는다 */
export function segments(content, marks) {
  let parts = [{ text: content, mark: false }];
  for (const m of marks) {
    if (!m) continue;
    const next = [];
    let taken = false;
    for (const p of parts) {
      const i = taken || p.mark ? -1 : p.text.indexOf(m);
      if (i === -1) {
        next.push(p);
        continue;
      }
      taken = true;
      if (i > 0) next.push({ text: p.text.slice(0, i), mark: false });
      next.push({ text: m, mark: true });
      const rest = p.text.slice(i + m.length);
      if (rest) next.push({ text: rest, mark: false });
    }
    parts = next;
  }
  return parts;
}
