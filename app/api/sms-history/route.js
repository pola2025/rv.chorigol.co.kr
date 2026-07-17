// 문자 발송 이력 조회 — SmsHistoryTable 이 Firestore 대신 여기를 읽는다.
// 업체·취소 필터는 **클라이언트가 한다** (레거시 연산 순서 그대로 — lib/sms-history.js 주석 참조).
import { NextResponse } from "next/server";
import { listSmsHistory } from "../../../lib/sms-history.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!(await requireAuth(request)))
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  try {
    return NextResponse.json({ reservations: await listSmsHistory() });
  } catch (e) {
    return NextResponse.json(
      { error: "발송 이력 조회 실패", detail: e.message },
      { status: 500 },
    );
  }
}
