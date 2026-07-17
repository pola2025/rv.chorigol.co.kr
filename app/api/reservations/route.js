// 예약 쓰기 API — Firestore 직접 쓰기 + 트리거를 대체.
// 브라우저가 DB에 직접 붙지 않고 이 경로로만 쓴다 (보안). D1 저장 후 알림까지 서버에서 처리.
import { NextResponse } from "next/server";
import {
  cancelReservation,
  deleteReservation,
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
      const { before: prev, after } = await cancelReservation(id, patch);
      if (!after)
        return NextResponse.json({ error: "예약 없음" }, { status: 404 });
      // 이미 취소된 예약을 다시 취소하면 알림을 보내지 않는다.
      // 레거시 트리거도 **상태 전환**에만 반응했다(`statusChanged && after.status === '예약취소'`)
      // — 이 조건이 없으면 취소 재시도·중복 클릭이 고객에게 취소 텔레그램을 두 번 보낸다.
      const notify =
        prev.status === "예약취소"
          ? { skipped: "already_cancelled" }
          : await notifyReservation("cancelled", after).catch((e) => ({
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

/**
 * DELETE — 관리자 '막기' 예약만 완전 삭제 (?id=).
 *
 * 레거시 cancelReservation 은 source='막기' 일 때만 deleteDoc 하고, 일반 예약은 취소 상태로 남긴다
 * (매출·환불 이력이 사라지면 안 되므로). 그 규칙을 **서버에서 강제**한다 —
 * 클라이언트 버그나 잘못된 호출이 실예약을 지우는 경로를 아예 없앤다
 * (2026-07-16 D1 실데이터 삭제 사고 이후 방침: 삭제는 좁고 명시적으로).
 */
export async function DELETE(request) {
  if (!(await requireAuth(request))) return deny();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  try {
    const r = await getById(id);
    if (!r) return NextResponse.json({ error: "예약 없음" }, { status: 404 });
    if (r.source !== "막기")
      return NextResponse.json(
        { error: "막기 예약만 삭제할 수 있습니다. 일반 예약은 취소해 주세요." },
        { status: 400 },
      );

    await deleteReservation(id); // 옵션은 CASCADE
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: "예약 삭제 실패", detail: e.message },
      { status: 500 },
    );
  }
}
