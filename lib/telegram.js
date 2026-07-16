// 텔레그램 알림 발송 — 서버 전용. 봇토큰은 환경변수에서만 읽는다.
// 업체별 채널 라우팅: choho(Forest 객실) / shelter(호수뷰객실).

const BOT = {
  choho: process.env.TELEGRAM_BOT_TOKEN_CHOHO,
  shelter: process.env.TELEGRAM_BOT_TOKEN_SHELTER,
};
const CHAT = {
  choho: process.env.TELEGRAM_CHAT_ID_CHOHO || "-1002484830636",
  shelter: process.env.TELEGRAM_CHAT_ID_SHELTER || "-1002863320782",
};

/**
 * 텔레그램 메시지 발송 (HTML).
 * @param {'choho'|'shelter'} business  채널 라우팅 기준
 * @returns {Promise<{ok:boolean, messageId?:number, error?:string}>}
 */
export async function sendTelegram(business, text) {
  const token = BOT[business] || BOT.choho;
  const chatId = CHAT[business] || CHAT.choho;
  if (!token) return { ok: false, error: "텔레그램 봇토큰 미설정" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return body.ok
    ? { ok: true, messageId: body.result?.message_id }
    : { ok: false, error: body.description || "텔레그램 발송 실패" };
}
