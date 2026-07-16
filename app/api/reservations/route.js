// 예약 쓰기 API — Firestore 직접 쓰기 + 트리거를 대체.
// 브라우저가 DB에 직접 붙지 않고 이 경로로만 쓴다 (보안). D1 저장 후 알림까지 서버에서 처리.
import { NextResponse } from "next/server";
import {
  cancelReservation,
  getById,
  newReservationId,
  replaceReservationOptions,
} from "../../../lib/reservations.js";
import {
  insertGuarded,
  updateGuarded,
  diagnose,
} from "../../../lib/inventory.js";
import { notifyReservation } from "../../../lib/reservation-notify.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

/** 재고 거절을 레거시 문구로 — 레거시는 막힌 날짜를 짚어준다 */
async function stockError(room_name, check_in, check_out, excludeId) {
  const d = await diagnose(room_name, check_in, check_out, excludeId);
  if (d.reason === "room_not_found")
    return NextResponse.json(
      { error: "객실 정보를 찾을 수 없습니다." },
      { status: 400 },
    );
  if (d.reason === "no_stock")
    return NextResponse.json(
      {
        error: `${d.date}에 예약 가능한 객실이 없습니다. 다른 날짜를 선택해 주세요.`,
        date: d.date,
      },
      { status: 409 },
    );
  // 진단 사이에 취소가 들어온 경우 등 — 레거시도 같은 폴백 문구를 쓴다
  return NextResponse.json(
    {
      error:
        "죄송합니다. 방금 마지막 객실이 예약되었습니다. 다시 시도해 주세요.",
    },
    { status: 409 },
  );
}

// 미들웨어와 이중 방어 — 예약 쓰기는 문자·텔레그램까지 나가므로 여기서도 막는다
const deny = () => NextResponse.json({ error: "인증 필요" }, { status: 401 });

// 필수 필드 검증
function validate(d) {
  const missing = [
    "customer_name",
    "phone",
    "room_name",
    "check_in",
    "check_out",
  ].filter((f) => !d?.[f]);
  return missing.length ? `필수 항목 누락: ${missing.join(", ")}` : null;
}

// POST — 예약 생성. status가 예약확정이면 확정 알림+문자, 아니면 신규 알림.
export async function POST(request) {
  if (!(await requireAuth(request))) return deny();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  try {
    // 재고 가드를 통과할 때만 INSERT 된다 (단일 문장 원자성).
    // 무가드 createReservation 을 쓰면 동시 예약이 오버부킹된다 — 레거시가 그랬다.
    const id = body.id || newReservationId();
    const { created } = await insertGuarded({ ...body, id });
    if (!created)
      return stockError(body.room_name, body.check_in, body.check_out);

    // 옵션은 가드 대상이 아니라 INSERT 성공 후 붙인다
    if (body.options?.length) await replaceReservationOptions(id, body.options);

    const reservation = await getById(id);
    // 알림은 응답을 막지 않도록 실패해도 진행 (fire-and-forget이지만 결과는 기록)
    const event = reservation.status === "예약확정" ? "confirmed" : "new";
    const notify = await notifyReservation(event, reservation).catch((e) => ({
      error: e.message,
    }));
    return NextResponse.json({ reservation, notify }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "예약 생성 실패", detail: e.message },
      { status: 500 },
    );
  }
}

// PATCH — 예약 수정. 상태/객실 변경을 감지해 해당 알림 발송.
export async function PATCH(request) {
  if (!(await requireAuth(request))) return deny();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  const { id, cancel, ...patch } = body;
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  try {
    // 취소는 재고를 **푸는** 방향이라 가드가 필요 없다
    if (cancel || patch.status === "예약취소") {
      const { after } = await cancelReservation(id, patch);
      if (!after)
        return NextResponse.json({ error: "예약 없음" }, { status: 404 });
      const notify = await notifyReservation("cancelled", after).catch((e) => ({
        error: e.message,
      }));
      return NextResponse.json({ reservation: after, notify });
    }

    const before = await getById(id);
    if (!before)
      return NextResponse.json({ error: "예약 없음" }, { status: 404 });

    // 날짜·객실을 안 보냈으면 기존 값으로 채워 가드를 태운다.
    // 취소→확정 되돌리기·날짜 이동은 점유를 되살리므로 반드시 재검사해야 한다.
    const merged = {
      ...patch,
      room_name: patch.room_name ?? before.room_name,
      check_in: patch.check_in ?? before.check_in,
      check_out: patch.check_out ?? before.check_out,
    };
    const { updated } = await updateGuarded(id, merged);
    if (!updated)
      return stockError(
        merged.room_name,
        merged.check_in,
        merged.check_out,
        id,
      );

    if (patch.options) await replaceReservationOptions(id, patch.options);
    const after = await getById(id);

    const notify = {};
    // 예약확정으로 전환 → 확정 알림+문자
    if (before.status !== "예약확정" && after.status === "예약확정") {
      notify.confirmed = await notifyReservation("confirmed", after).catch(
        (e) => ({ error: e.message }),
      );
    }
    // 객실 변경 → 객실변경 알림
    if (before.room_name !== after.room_name) {
      notify.roomChange = await notifyReservation("roomChange", after, {
        prevRoom: before.room_name,
        newRoom: after.room_name,
      }).catch((e) => ({ error: e.message }));
    }
    return NextResponse.json({ reservation: after, notify });
  } catch (e) {
    return NextResponse.json(
      { error: "예약 수정 실패", detail: e.message },
      { status: 500 },
    );
  }
}

// GET — 단건 조회 (?id=)
export async function GET(request) {
  if (!(await requireAuth(request))) return deny();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const reservation = await getById(id);
  if (!reservation)
    return NextResponse.json({ error: "예약 없음" }, { status: 404 });
  return NextResponse.json({ reservation });
}
