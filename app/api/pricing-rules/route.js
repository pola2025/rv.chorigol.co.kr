// 시즌 요금 규칙 쓰기 API — RoomManagement 의 Firestore 직접 쓰기 대체.
//
// 규칙 구조가 가변이라 원본을 data JSON 에 통째로 보존한다(이관 규약). lib/pricing-rules.js 참조.
import { NextResponse } from "next/server";
import {
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  getPricingRuleById,
} from "../../../lib/pricing-rules.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

const deny = () => NextResponse.json({ error: "인증 필요" }, { status: 401 });

/** POST — 규칙 생성. body = 규칙 객체 통째 */
export async function POST(request) {
  if (!(await requireAuth(request))) return deny();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "규칙 객체가 필요합니다" }, { status: 400 });

  try {
    return NextResponse.json({ rule: await createPricingRule(body) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "추가 중 오류가 발생했습니다.", detail: e.message }, { status: 500 });
  }
}

/** PATCH — 규칙 수정 `{ id, ...필드 }` (기존 data 에 **머지**) */
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
    const rule = await updatePricingRule(id, patch);
    if (!rule) return NextResponse.json({ error: "규칙 없음" }, { status: 404 });
    return NextResponse.json({ rule });
  } catch (e) {
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다.", detail: e.message }, { status: 500 });
  }
}

/** DELETE — 규칙 삭제 (?id=) */
export async function DELETE(request) {
  if (!(await requireAuth(request))) return deny();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  try {
    const r = await deletePricingRule(id);
    if (!r.deleted) return NextResponse.json({ error: "규칙 없음" }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다.", detail: e.message }, { status: 500 });
  }
}

/** GET — 단건 조회 (?id=) */
export async function GET(request) {
  if (!(await requireAuth(request))) return deny();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const rule = await getPricingRuleById(id);
  if (!rule) return NextResponse.json({ error: "규칙 없음" }, { status: 404 });
  return NextResponse.json({ rule });
}
