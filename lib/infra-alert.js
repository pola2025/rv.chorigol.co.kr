// 인프라봇 — 헬스체크/운영 모니터링 전용. 예약 알림봇과 분리.
// 용도: 문자발송 성공/실패, 예약 체크 확인 등. 첫줄 네임태그 [rv-chorigol/라우트] 필수.

const INFRA_BOT = process.env.TELEGRAM_INFRA_BOT_TOKEN;
const INFRA_CHAT = process.env.TELEGRAM_INFRA_CHAT_ID;

/**
 * 인프라 알림 발송.
 * @param {string} route  라우트 태그 (예: "sms", "cron", "reservation-check")
 * @param {string} text   본문
 */
export async function infraAlert(route, text) {
  if (!INFRA_BOT || !INFRA_CHAT) return { ok: false, error: "인프라봇 미설정" };
  const body = `[rv-chorigol/${route}] ${text}`;
  const res = await fetch(`https://api.telegram.org/bot${INFRA_BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ chat_id: INFRA_CHAT, text: body, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  const j = await res.json().catch(() => ({}));
  return j.ok ? { ok: true, messageId: j.result?.message_id } : { ok: false, error: j.description };
}

/** 문자 발송 결과 헬스체크 리포트 */
export async function reportSmsResult({ business, to, kind, ok, requestId, error }) {
  const masked = String(to || "").replace(/\d(?=\d{4})/g, "*");
  const status = ok ? "✅ 성공" : "❌ 실패";
  let msg = `문자발송 ${status}\n업체: ${business} / 종류: ${kind}\n수신: ${masked}`;
  if (requestId) msg += `\nreqId: ${requestId}`;
  if (error) msg += `\n오류: ${String(error).slice(0, 200)}`;
  return infraAlert("sms", msg);
}

/**
 * 예약체크 확인 리포트 — 오늘 입·퇴실 및 발송 현황 요약.
 * @param {object} r { date, checkIns, checkOuts, smsSuccess, smsFailed, dbOk }
 */
export async function reportReservationCheck(r) {
  const healthy = r.dbOk && r.smsFailed === 0;
  let msg = `예약체크 ${healthy ? "✅ 정상" : "⚠️ 확인필요"} (${r.date})\n`;
  msg += `────────────\n`;
  msg += `DB(D1): ${r.dbOk ? "정상" : "❌ 연결실패"}\n`;
  msg += `오늘 입실: ${r.checkIns}건 / 퇴실: ${r.checkOuts}건\n`;
  msg += `문자발송 24h: 성공 ${r.smsSuccess} / 실패 ${r.smsFailed}`;
  if (r.failedDetail?.length) {
    msg += `\n\n실패 내역:\n` + r.failedDetail.map((f) => `• ${f}`).join("\n");
  }
  return infraAlert("reservation-check", msg);
}
