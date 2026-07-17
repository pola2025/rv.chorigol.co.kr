// 관리자 인증 (서버 전용 · Node 런타임) — 비밀번호 해시·검증, 계정 조회, 로그인 시도 기록.
// JWT는 auth-jwt.js (Edge 안전). 여기는 node:crypto를 쓰므로 미들웨어에서 import 금지.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { query, queryOne, execute } from "./d1.js";

// scrypt 파라미터 (N=2^15). 외부 의존성 없이 메모리-하드 해싱
const KEYLEN = 64;
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** 비밀번호 → 저장용 해시 문자열 (scrypt$N$r$p$salt$hash) */
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password.normalize("NFKC"), salt, KEYLEN, SCRYPT).toString("hex");
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

/** 비밀번호 검증 — timing-safe 비교 (security.md 7번) */
export function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password.normalize("NFKC"), salt, expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** 활성 관리자 조회 (이메일은 소문자 정규화) */
export async function getAdmin(email) {
  return queryOne(
    `SELECT id, email, password_hash, is_active FROM admins WHERE email = ? AND is_active = 1`,
    [String(email || "").trim().toLowerCase()],
  );
}

export async function recordLoginAttempt(ip, success) {
  await execute(
    `INSERT INTO login_attempts (ip, success, attempted_at) VALUES (?, ?, ?)`,
    [ip || "unknown", success ? 1 : 0, new Date().toISOString()],
  ).catch(() => {});
}

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

/** 최근 15분 내 같은 IP의 실패 횟수 (5회 이상이면 차단) */
export async function isRateLimited(ip) {
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString();
  const { results } = await query(
    `SELECT COUNT(*) c FROM login_attempts WHERE ip = ? AND success = 0 AND attempted_at > ?`,
    [ip || "unknown", since],
  );
  const fails = results[0]?.c ?? 0;
  return { limited: fails >= MAX_FAILS, fails, windowMin: WINDOW_MIN };
}

/** 요청 IP 추출 (Vercel: x-forwarded-for 첫 값) */
export function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/** 로그 노출용 이메일 마스킹 (평문 이메일을 로그·알림에 남기지 않는다) */
export function maskEmail(email) {
  const s = String(email || "");
  const at = s.indexOf("@");
  if (at < 1) return createHash("sha256").update(s).digest("hex").slice(0, 8);
  return `${s[0]}***${s.slice(at)}`;
}
