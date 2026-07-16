// 레거시 스토어용 스냅샷 — useFirebaseStore 의 onSnapshot 리스너를 대체한다.
//
// Firestore 는 변경을 브라우저로 밀어줬지만(push) D1 엔 그런 게 없다.
// 그렇다고 폴링으로 "번역"하면 안 된다 — 실측 결과 매번 전부 읽으면
// 1초 폴링이 68.7M rows/일(무료한도 1374%)로 터진다.
//
// 실제로는 **변경을 만드는 사람이 관리자 본인**이라 물어볼 이유가 거의 없다:
//   · 로드할 때 1번 + 쓰기 후 재조회 (대부분의 경우 이걸로 끝)
//   · 다른 관리자의 변경 감지는 /api/version heartbeat (30초, 1행) 로 싸게 처리
import { NextResponse } from "next/server";
import { loadSnapshot } from "../../../lib/legacy-shape.js";
import { requireAuth } from "../../../lib/auth-jwt.js";
import { currentVersion } from "../../../lib/version.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!(await requireAuth(request)))
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  try {
    // version 을 스냅샷과 함께 준다 — 클라이언트가 이후 heartbeat 와 비교할 기준점
    const [data, version] = await Promise.all([
      loadSnapshot(),
      currentVersion(),
    ]);
    return NextResponse.json({ version, data });
  } catch (e) {
    return NextResponse.json(
      { error: "스냅샷 조회 실패", detail: e.message },
      { status: 500 },
    );
  }
}
