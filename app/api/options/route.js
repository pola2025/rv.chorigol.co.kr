// 옵션 마스터 쓰기 API — OptionsSettings 의 Firestore 직접 쓰기 대체.
//
// 기본 옵션(isDefault)은 여기가 아니라 `/api/option-settings` 로 간다 — 레거시도 그랬다
// (isDefault 면 settings 문서에, 아니면 options 컬렉션에 저장). 두 저장소는 id 가 겹쳐서
// 합칠 수 없다(late_checkout). lib/option-settings.js 주석 참조.
import { NextResponse } from "next/server";
import {
  createOption,
  updateOption,
  deleteOption,
  getOptionById,
} from "../../../lib/rooms.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

const deny = () => NextResponse.json({ error: "인증 필요" }, { status: 401 });

/** POST — 옵션 생성 */
export async function POST(request) {
  if (!(await requireAuth(request))) return deny();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  if (!body?.name) return NextResponse.json({ error: "옵션명이 필요합니다." }, { status: 400 });

  try {
    return NextResponse.json({ option: await createOption(body) }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "옵션 추가 실패", detail: e.message },
      { status: 500 },
    );
  }
}

/** PATCH — 옵션 수정 `{ id, ...필드 }` */
export async function PATCH(request) {
  if (!(await requireAuth(request))) return deny();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  const { id, ...patch } = body ?? {};
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  try {
    const option = await updateOption(id, patch);
    if (!option) return NextResponse.json({ error: "옵션 없음" }, { status: 404 });
    return NextResponse.json({ option });
  } catch (e) {
    return NextResponse.json(
      { error: "옵션 수정 실패", detail: e.message },
      { status: 500 },
    );
  }
}

/** DELETE — 옵션 삭제 (?id=) */
export async function DELETE(request) {
  if (!(await requireAuth(request))) return deny();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  try {
    const r = await deleteOption(id);
    if (!r.deleted) return NextResponse.json({ error: "옵션 없음" }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: "옵션 삭제 실패", detail: e.message },
      { status: 500 },
    );
  }
}

/** GET — 단건 조회 (?id=) */
export async function GET(request) {
  if (!(await requireAuth(request))) return deny();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const option = await getOptionById(id);
  if (!option) return NextResponse.json({ error: "옵션 없음" }, { status: 404 });
  return NextResponse.json({ option });
}
