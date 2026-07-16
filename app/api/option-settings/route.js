// 기본 옵션 오버라이드 API — 레거시 `settings/option_settings` 문서 대체.
//
// 레거시 읽기 경로는 두 개였는데 하나가 죽어 있었다:
//   · useOptionSettings.js  → Firestore getDoc **직접** (동작함) → 예약모달의 레이트체크아웃 노출
//   · OptionsSettings.jsx   → `fetch('/api/getDoc?path=...')` → **그 엔드포인트가 없어서 항상 404**
//     → `.catch(()=>null)` 로 삼켜져 설정 화면은 저장값을 한 번도 못 불러왔다(하드코딩 기본값만 표시)
// 여기서 하나로 합친다.
import { NextResponse } from "next/server";
import { getOptionSettings, setOptionSetting } from "../../../lib/option-settings.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

const deny = () => NextResponse.json({ error: "인증 필요" }, { status: 401 });

/** GET — 레거시 `settingsDoc.data()` 와 같은 맵 */
export async function GET(request) {
  if (!(await requireAuth(request))) return deny();
  try {
    return NextResponse.json({ settings: await getOptionSettings() });
  } catch (e) {
    return NextResponse.json(
      { error: "옵션 설정 조회 실패", detail: e.message },
      { status: 500 },
    );
  }
}

/** PATCH — { id, data } 기본 옵션 하나 저장 */
export async function PATCH(request) {
  if (!(await requireAuth(request))) return deny();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const { id, data } = body ?? {};
  if (!id || typeof id !== "string")
    return NextResponse.json({ error: "id 필요" }, { status: 400 });
  if (!data || typeof data !== "object" || Array.isArray(data))
    return NextResponse.json({ error: "data 는 객체여야 합니다" }, { status: 400 });

  try {
    await setOptionSetting(id, data);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: "옵션 설정 저장 실패", detail: e.message },
      { status: 500 },
    );
  }
}
