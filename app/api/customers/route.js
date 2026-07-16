// 고객 정보 API — 레거시 useReservationStore.updateCustomerInfo / 취소 카운트 대체.
// 예약 쓰기 후 스토어가 fire-and-forget 으로 부른다 (레거시와 같은 흐름).
import { NextResponse } from "next/server";
import { recordVisit, recordCancel } from "../../../lib/customers.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

const deny = () => NextResponse.json({ error: "인증 필요" }, { status: 401 });

/**
 * PATCH — { op: "visit" | "cancel", ... }
 *   visit : { reservation_id, phone, name, room_name, total_price } → 방문 누적 + 등급 재계산
 *   cancel: { phone }                                              → 취소 횟수 +1
 */
export async function PATCH(request) {
  if (!(await requireAuth(request))) return deny();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const { op, phone } = body ?? {};
  if (!phone)
    return NextResponse.json({ error: "phone 필요" }, { status: 400 });

  try {
    if (op === "visit") {
      if (!body.reservation_id)
        return NextResponse.json(
          { error: "reservation_id 필요" },
          { status: 400 },
        );
      const r = await recordVisit(body.reservation_id, {
        phone,
        name: body.name,
        roomName: body.room_name,
        totalPrice: body.total_price,
      });
      return NextResponse.json(r);
    }

    if (op === "cancel") return NextResponse.json(await recordCancel(phone));

    return NextResponse.json(
      { error: "op 은 visit | cancel" },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "고객 정보 갱신 실패", detail: e.message },
      { status: 500 },
    );
  }
}
