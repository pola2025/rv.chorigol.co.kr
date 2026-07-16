// 예약 쓰기 API — Firestore 직접 쓰기 + 트리거를 대체.
// 브라우저가 DB에 직접 붙지 않고 이 경로로만 쓴다 (보안). D1 저장 후 알림까지 서버에서 처리.
import { NextResponse } from "next/server";
import {
  createReservation,
  updateReservation,
  cancelReservation,
  getById,
} from "../../../lib/reservations.js";
import { notifyReservation } from "../../../lib/reservation-notify.js";

export const dynamic = "force-dynamic";

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
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  try {
    const reservation = await createReservation(body);
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
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  const { id, cancel, ...patch } = body;
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  try {
    // 취소 처리
    if (cancel || patch.status === "예약취소") {
      const { after } = await cancelReservation(id, patch);
      if (!after)
        return NextResponse.json({ error: "예약 없음" }, { status: 404 });
      const notify = await notifyReservation("cancelled", after).catch((e) => ({
        error: e.message,
      }));
      return NextResponse.json({ reservation: after, notify });
    }

    const { before, after } = await updateReservation(id, patch);
    if (!after)
      return NextResponse.json({ error: "예약 없음" }, { status: 404 });

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
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const reservation = await getById(id);
  if (!reservation)
    return NextResponse.json({ error: "예약 없음" }, { status: 404 });
  return NextResponse.json({ reservation });
}
