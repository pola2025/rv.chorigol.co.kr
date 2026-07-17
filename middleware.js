// 관리자 인증 게이트 — 로그인 안 되어 있으면 전부 막는다.
// Edge 런타임이므로 auth-jwt.js(jose)만 import (lib/auth.js는 node:crypto라 여기서 못 씀).
//
// ⚠️ 미들웨어만 믿지 않는다 (security.md 2번). 쓰기 API는 각자 requireAuth()로 한 번 더 막는다.
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "./lib/auth-jwt.js";

// 인증 없이 접근 가능한 경로 — 최소로 유지할 것
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return NextResponse.next();

  // 헬스체크·크론은 자체 CRON_SECRET Bearer 인증을 쓴다 (쿠키 없이 Vercel Cron이 호출).
  // 미들웨어를 통과시키는 만큼 각 라우트가 반드시 자체 검증한다 (security.md 2번).
  if (pathname === "/api/health" || pathname.startsWith("/api/cron/"))
    return NextResponse.next();

  const payload = await verifyToken(request.cookies.get(COOKIE_NAME)?.value);
  if (payload) return NextResponse.next();

  // API는 리다이렉트 대신 401 (fetch가 로그인 HTML을 받는 사고 방지)
  if (pathname.startsWith("/api/"))
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  // 로그인 후 원래 가려던 곳으로 (오픈 리다이렉트 방지: 내부 경로만 전달)
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

// 정적 자산·이미지 최적화는 통과
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
