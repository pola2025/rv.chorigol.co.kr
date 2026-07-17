// 텔레그램 발송 API — CF `sendTelegram`/`testTelegramConnection` 대체.
//
// 🔴 왜 옮겼나 (2026-07-17 Phase 6): CF 쪽 두 함수는 **인증이 한 줄도 없었다.**
//    `onRequest` + `Access-Control-Allow-Origin: *` → URL 만 알면 **누구나 사장님 채널로
//    메시지를 쏠 수 있었다.** 핸드오프의 "공개 함수 인증 부재"가 사실이었다.
//    여기로 옮기면 미들웨어가 막고, 라우트가 한 번 더 막는다.
//
// 봇토큰은 서버(lib/telegram.js)가 쥔다 — 클라이언트는 예전에도 토큰을 몰랐고 지금도 모른다.
// 채널 라우팅: choho(Forest 객실) / shelter(호수뷰객실 = 레거시 LAKE_VIEW_CHAT_ID 와 같은 채널).
import { NextResponse } from "next/server";
import { sendTelegram } from "../../../lib/telegram.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const deny = () => NextResponse.json({ error: "인증 필요" }, { status: 401 });
const BUSINESS = ["choho", "shelter"];

/**
 * POST — 텔레그램 발송.
 *   { action: "send", text, business?, alsoShelter? }  → 메시지 발송
 *   { action: "test", business? }                      → 연결 테스트
 *
 * ⚠️ 미들웨어가 이미 막지만 자체 검증을 또 한다 (security.md 2번 — 미들웨어만 믿지 않는다).
 */
export async function POST(request) {
  if (!(await requireAuth(request))) return deny();

  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "Content-Type 오류" }, { status: 415 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const { action = "send", text, alsoShelter = false } = body || {};
  // 레거시가 임의 chatId 를 받던 걸 **의도적으로 안 받는다** — 채널은 서버가 정한다
  const business = BUSINESS.includes(body?.business) ? body.business : "choho";

  if (action === "test") {
    const res = await sendTelegram(
      business,
      "🔔 연결 테스트 — 초호펜션 예약관리",
    );
    return NextResponse.json({
      success: res.ok,
      error: res.ok ? undefined : res.error,
    });
  }

  if (action !== "send")
    return NextResponse.json(
      { error: "action 은 send | test" },
      { status: 400 },
    );

  if (typeof text !== "string" || !text.trim())
    return NextResponse.json({ error: "메시지가 없습니다." }, { status: 400 });
  if (text.length > 4096)
    // 텔레그램 상한
    return NextResponse.json(
      { error: "메시지가 너무 깁니다(4096자 초과)." },
      { status: 400 },
    );

  const res = await sendTelegram(business, text);

  // 호수뷰 관련이면 전용 채널로도 보낸다 (레거시 sendMessage(…, LAKE_VIEW_CHAT_ID) 와 동일한 동작)
  if (alsoShelter && business !== "shelter") {
    await sendTelegram("shelter", text).catch(() => {});
  }

  return res.ok
    ? NextResponse.json({ success: true, messageId: res.messageId })
    : NextResponse.json({ success: false, error: res.error }, { status: 502 });
}
