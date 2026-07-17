// 로그아웃 — admin_token 쿠키 삭제.
import { NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions } from "../../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // 발급 때와 같은 속성 + maxAge 0 이어야 브라우저가 실제로 지운다
  res.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  return res;
}
