// 관리자 로그인 — 이메일+비밀번호 → admin_token 쿠키.
// scrypt(node:crypto)를 쓰므로 Node 런타임 고정 (Edge에선 동작하지 않음).
import { NextResponse } from "next/server";
import {
  getAdmin,
  verifyPassword,
  recordLoginAttempt,
  isRateLimited,
  clientIp,
  maskEmail,
} from "../../../../lib/auth.js";
import {
  signToken,
  COOKIE_NAME,
  cookieOptions,
} from "../../../../lib/auth-jwt.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 열거 공격 방지 — 계정 없음/비번 틀림을 구분해 알려주지 않는다 (security.md 8번)
const INVALID = "이메일 또는 비밀번호가 올바르지 않습니다";

export async function POST(request) {
  if (!process.env.JWT_SECRET)
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });

  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "Content-Type 오류" }, { status: 415 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const ip = clientIp(request);
  const { email, password } = body || {};
  if (!email || !password)
    return NextResponse.json({ error: INVALID }, { status: 401 });

  // IP 기준 실패 횟수 제한
  const rl = await isRateLimited(ip);
  if (rl.limited)
    return NextResponse.json(
      {
        error: `로그인 시도가 많습니다. ${rl.windowMin}분 후 다시 시도하세요.`,
      },
      { status: 429 },
    );

  const admin = await getAdmin(email);
  // 계정이 없어도 비교를 수행해 응답시간 차이로 계정 존재를 노출하지 않는다
  const ok = admin
    ? verifyPassword(String(password), admin.password_hash)
    : false;

  if (!ok) {
    await recordLoginAttempt(ip, false);
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  await recordLoginAttempt(ip, true);
  const token = await signToken(admin.email);

  const res = NextResponse.json({ ok: true, email: maskEmail(admin.email) });
  res.cookies.set(COOKIE_NAME, token, cookieOptions());
  return res;
}
