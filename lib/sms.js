// NCP SENS 문자 발송 — 서버 전용. 시크릿은 환경변수에서만 읽는다.
import crypto from "crypto";

const SERVICE_ID = process.env.SENS_SERVICE_ID;
const ACCESS_KEY = process.env.SENS_ACCESS_KEY;
const SECRET_KEY = process.env.SENS_SECRET_KEY;
const FROM = {
  choho: process.env.SENS_FROM_CHOHO || "01079320029",
  shelter: process.env.SENS_FROM_SHELTER || "01058710038",
};

const EMOJI =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu;

const normalizePhone = (p) =>
  String(p || "").replace(/[-\s()]/g, "").replace(/^\+82/, "0").replace(/^82/, "0");

function sign(method, url, ts) {
  const h = crypto.createHmac("sha256", SECRET_KEY);
  h.update(`${method} ${url}\n${ts}\n${ACCESS_KEY}`);
  return h.digest("base64");
}

/**
 * SMS/LMS 발송.
 * @param {'choho'|'shelter'} business
 * @param {string} to        수신번호
 * @param {string} content   메시지 (이모지 자동 제거)
 * @param {string} [subject] LMS 제목
 * @returns {Promise<{ok:boolean, requestId?:string, status?:number, error?:any}>}
 */
export async function sendSms(business, to, content, subject) {
  if (!SERVICE_ID || !ACCESS_KEY || !SECRET_KEY) {
    return { ok: false, error: "SENS 환경변수 미설정" };
  }
  const clean = String(content).replace(EMOJI, "");
  const type = clean.length > 45 ? "LMS" : "SMS";
  const url = `/sms/v2/services/${SERVICE_ID}/messages`;
  const ts = Date.now().toString();

  const res = await fetch(`https://sens.apigw.ntruss.com${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-ncp-apigw-timestamp": ts,
      "x-ncp-iam-access-key": ACCESS_KEY,
      "x-ncp-apigw-signature-v2": sign("POST", url, ts),
    },
    body: JSON.stringify({
      type,
      contentType: "COMM",
      countryCode: "82",
      from: normalizePhone(FROM[business] || FROM.choho),
      ...(type === "LMS" && subject ? { subject } : {}),
      content: clean,
      messages: [{ to: normalizePhone(to), content: clean }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.status === 202 || !!body.requestId;
  return ok
    ? { ok: true, requestId: body.requestId, status: res.status }
    : { ok: false, status: res.status, error: body };
}
