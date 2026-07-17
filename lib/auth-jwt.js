// admin_token JWT 발급·검증 — Edge 런타임 안전 (미들웨어에서 import).
// 비밀번호 해싱(node:crypto)은 여기 두지 않는다. Edge에 node:crypto가 없어 미들웨어가 깨진다.
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "admin_token";
export const SESSION_DAYS = 30; // 사용자 지정 (2026-07-16)
const MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

// 시크릿 미설정 시 조건부로 인증을 건너뛰지 않는다 — 반드시 던진다 (security.md 3번)
function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET 미설정");
  return new TextEncoder().encode(s);
}

/** 로그인 성공 시 토큰 발급 */
export async function signToken(email) {
  return new SignJWT({ sub: email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

/** 토큰 검증. 실패(만료·위조·alg혼동)면 null — 예외를 밖으로 흘리지 않는다 */
export async function verifyToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"], // alg 혼동 공격 차단 (none/RS256 위조 방지)
    });
    return payload;
  } catch {
    return null;
  }
}

/**
 * 쿠키 옵션 — web-architecture.md 규칙.
 * Domain 생략(호스트 한정) / HttpOnly / SameSite=Strict / 운영에서만 Secure.
 * 부모도메인(.chorigol.co.kr) 쿠키는 절대 금지 — 메인 XSS 1번에 admin 세션이 털린다.
 */
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // 로컬 http에선 Secure 쿠키가 안 붙음
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE,
  };
}

/**
 * API 라우트 자체 인증 (미들웨어와 이중 방어 — security.md 2번).
 * 미들웨어 matcher가 바뀌거나 우회돼도 쓰기 경로는 여기서 막힌다.
 * @returns {Promise<object|null>} payload | null(미인증)
 */
export async function requireAuth(request) {
  return verifyToken(request.cookies?.get(COOKIE_NAME)?.value);
}
