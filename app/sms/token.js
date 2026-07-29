// /sms 열람 쿠키 서명 — 쿠키에 "1" 같은 값을 넣으면 누구나 위조할 수 있다.
// JWT_SECRET 으로 HMAC 을 걸어 서버만 만들 수 있는 값으로 둔다.
import { createHmac, timingSafeEqual } from "node:crypto";

export const VIEW_COOKIE = "sms_view";

export function viewToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET 미설정");
  return createHmac("sha256", secret).update("sms-view-v1").digest("hex");
}

export function isUnlocked(value) {
  if (!value || !process.env.JWT_SECRET) return false;
  const a = Buffer.from(String(value));
  const b = Buffer.from(viewToken());
  return a.length === b.length && timingSafeEqual(a, b);
}
