// 객실 쓰기 API — RoomManagement 의 Firestore 직접 쓰기 대체.
//
// 이 화면은 **읽기는 D1(useFirebaseStore), 쓰기는 옛 Firestore** 로 갈라져 있었다.
// 저장해도 화면에 안 나타나는 상태였다(split-brain). 여기로 쓰기를 모은다.
import { NextResponse } from "next/server";
import {
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomById,
} from "../../../lib/rooms.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

const deny = () => NextResponse.json({ error: "인증 필요" }, { status: 401 });

/** POST — 객실 생성. body 는 snake_case (클라는 lib/legacy-write-shape.toRoomWriteBody 로 변환) */
export async function POST(request) {
  if (!(await requireAuth(request))) return deny();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }
  if (!body?.name?.trim())
    return NextResponse.json({ error: "객실명을 입력해주세요." }, { status: 400 });

  try {
    return NextResponse.json({ room: await createRoom(body) }, { status: 201 });
  } catch (e) {
    // "이미 존재하는 객실명입니다." 는 레거시와 같은 문구 → 400 으로 그대로 전달
    const dup = e.message.includes("이미 존재");
    return NextResponse.json(
      dup ? { error: e.message } : { error: "객실 추가 중 오류가 발생했습니다.", detail: e.message },
      { status: dup ? 400 : 500 },
    );
  }
}

/**
 * PATCH — 객실 수정. `{ id, ...필드 }`
 * **객실명 변경은 거부한다** (400). 이름이 7곳의 사실상 FK 다 — lib/rooms.js 주석 참조.
 */
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
    const room = await updateRoom(id, patch);
    if (!room) return NextResponse.json({ error: "객실 없음" }, { status: 404 });
    return NextResponse.json({ room });
  } catch (e) {
    const rename = e.message.includes("객실명은 변경할 수 없습니다");
    return NextResponse.json(
      rename ? { error: e.message } : { error: "저장 중 오류가 발생했습니다.", detail: e.message },
      { status: rename ? 400 : 500 },
    );
  }
}

/**
 * DELETE — 객실 삭제 (?id=). **활성 예약이 있으면 거부.**
 * 레거시도 막으려 했지만 없는 필드(`r.room`)로 걸러서 가드가 한 번도 안 걸렸다.
 */
export async function DELETE(request) {
  if (!(await requireAuth(request))) return deny();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  try {
    const r = await deleteRoom(id);
    if (r.reason === "not_found")
      return NextResponse.json({ error: "객실 없음" }, { status: 404 });
    if (r.reason === "has_reservations")
      return NextResponse.json(
        {
          error:
            `"${r.room.name}" 객실에 ${r.count}개의 활성 예약이 있어 삭제할 수 없습니다. ` +
            `먼저 해당 예약들을 취소하거나 다른 객실로 변경해주세요.`,
          count: r.count,
        },
        { status: 409 },
      );
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: "객실 삭제 중 오류가 발생했습니다.", detail: e.message },
      { status: 500 },
    );
  }
}

/** GET — 단건 조회 (?id=) */
export async function GET(request) {
  if (!(await requireAuth(request))) return deny();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const room = await getRoomById(id);
  if (!room) return NextResponse.json({ error: "객실 없음" }, { status: 404 });
  return NextResponse.json({ room });
}
