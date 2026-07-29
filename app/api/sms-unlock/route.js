// /sms 열람 코드 검증 — 일반 폼 POST → 303 리다이렉트.
//
// Server Action 으로 만들었더니 쿠키는 저장되는데 클라이언트 라우터 캐시가 잠금 화면을
// 그대로 다시 그렸다 (실측: 제출 직후 카드 0개, 새로고침해야 열림. revalidatePath 로도 안 됨).
// 평범한 폼 POST + 전체 페이지 이동이면 그 캐시가 개입할 자리가 없다.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { recordLoginAttempt, isRateLimited, clientIp } from "../../../lib/auth.js";
import { VIEW_COOKIE, viewToken } from "../../sms/token.js";

const eq = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

const back = (request, e) =>
  NextResponse.redirect(new URL(e ? `/sms?e=${e}` : "/sms", request.url), 303);

export async function POST(request) {
  const expected = process.env.SMS_VIEW_CODE;
  // 조건부 인증 금지 — 코드가 없으면 열지 않는다 (security.md 3번)
  if (!expected) return back(request, "cfg");

  let code = "";
  try {
    code = String((await request.formData()).get("code") || "").trim();
  } catch {
    return back(request, "bad");
  }

  const key = `sms:${clientIp(request)}`;
  const { limited } = await isRateLimited(key);
  if (limited) return back(request, "rate");

  if (!eq(code, expected)) {
    await recordLoginAttempt(key, false);
    return back(request, "bad");
  }

  await recordLoginAttempt(key, true);
  const res = back(request);
  res.cookies.set(VIEW_COOKIE, viewToken(), {
    httpOnly: true,
    // 프로토콜 기준 — Vercel 은 항상 https 다. NODE_ENV 로 판정하면
    // `next start` 로컬 검증(http)에서 쿠키가 저장되지 않아 확인이 막힌다.
    secure: (request.headers.get("x-forwarded-proto") || "http") === "https",
    sameSite: "strict",
    path: "/sms",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
