// heartbeat — "바뀐 거 있나?"만 싸게 묻는다 (전체 스냅샷 재조회 없이).
// 클라이언트가 30초마다 호출해 version 이 달라졌을 때만 /api/snapshot 을 다시 받는다.
import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/auth-jwt.js";
import { currentVersion } from "../../../lib/version.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!(await requireAuth(request)))
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  try {
    return NextResponse.json({ version: await currentVersion() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
