// 재고 수동 조정 API — 레거시 useReservationStore.updateInventoryOverride 대체.
// 브라우저가 D1에 직접 붙지 않고 이 경로로만 쓴다 (보안).
import { NextResponse } from "next/server";
import { setOverride, deleteOverride } from "../../../lib/inventory.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

// 미들웨어와 이중 방어 — 재고를 바꾸면 예약 수용 여부가 바뀐다 (security.md 2번)
const deny = () => NextResponse.json({ error: "인증 필요" }, { status: 401 });

const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * PATCH — { date, room_name, available }
 * available: 숫자면 저장(정원), null 이면 삭제(기본 재고로 복원) — 레거시와 동일한 계약.
 */
export async function PATCH(request) {
  if (!(await requireAuth(request))) return deny();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const { date, room_name, available } = body ?? {};
  if (!isDate(date))
    return NextResponse.json(
      { error: "date 형식 오류 (YYYY-MM-DD)" },
      { status: 400 },
    );
  if (!room_name || typeof room_name !== "string")
    return NextResponse.json({ error: "room_name 필요" }, { status: 400 });

  // null = 삭제. undefined 를 삭제로 받으면 필드 누락 실수가 조용히 override 를 지운다
  const remove = available === null;
  if (!remove && (!Number.isInteger(available) || available < 0))
    return NextResponse.json(
      { error: "available 은 0 이상 정수 또는 null(삭제)" },
      { status: 400 },
    );

  try {
    if (remove) await deleteOverride(date, room_name);
    else await setOverride(date, room_name, available);
    return NextResponse.json({ ok: true, date, room_name, available });
  } catch (e) {
    return NextResponse.json(
      { error: "재고 수정 실패", detail: e.message },
      { status: 500 },
    );
  }
}
