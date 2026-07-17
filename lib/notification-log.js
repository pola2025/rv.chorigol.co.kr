// 발송 기록 단일 통로 — notification_log INSERT 는 여기서만 한다.
//
// 왜 모았나: sms-schedule.js 와 reservation-notify.js 가 **같은 INSERT 를 각자 구현**하고
// 있었고, 둘 다 끝에 `.catch(() => {})` 가 붙어 **기록 실패를 조용히 삼켰다**.
// 문자는 나갔는데 신호기는 회색 → 아무도 모른다. 두 군데를 따로 고치면 또 갈라진다.
//
// 🔴 이 침묵이 실제로 사고를 냈다 (2026-07-17): 컷오버 당일 CF 가 보낸 입실안내 8건이
//    신호기에서 회색이었다. 사장님이 눈치채서 잡았지, 아니면 그냥 넘어갔다.
//    (그건 CF→Firestore 기록이라 원인은 달랐지만, **증상과 교훈은 같다** — 기록 없는 발송은
//     "안 보낸 것"과 구별이 안 된다.)
//
// 설계 (사용자 승인, 2026-07-17):
//   · **발송을 절대 깨뜨리지 않는다** — 기록이 실패해도 예외를 던지지 않는다.
//     D1 이 잠깐 흔들렸다고 고객이 문자를 못 받으면 본말전도다.
//   · **하지만 침묵하지 않는다** — 1회 재시도 후에도 실패하면 인프라봇에 알린다.
//     예약ID·kind 를 실어 보내므로 `scripts/migration/backfill-live-smsstatus.mjs` 로 수동 복구할 수 있다.
//   · D1 일시 오류는 실재한다 (2026-07-17 토큰 전파 지연 실측) → 재시도가 대부분 흡수한다.
import { execute } from "./d1.js";
import { infraAlert } from "./infra-alert.js";

const RETRY_DELAY_MS = 500;

/**
 * 발송 기록 1건. **절대 throw 하지 않는다** (발송 흐름을 깨지 않기 위해).
 *
 * @param {object}  p
 * @param {string?} p.reservation_id
 * @param {string}  p.kind     confirmation | checkIn | checkOut | telegram …
 * @param {string}  p.status   success | failed
 * @param {string}  [p.channel="sms"]
 * @param {string?} [p.request_id]
 * @param {string?} [p.preview]  본문 앞부분 (고객 실명·번호가 들어가므로 응답엔 싣지 않는다)
 * @param {string?} [p.error]
 * @returns {Promise<{ok: boolean}>} 기록 성공 여부 (호출부가 무시해도 된다)
 */
export async function logNotification({
  reservation_id,
  kind,
  status,
  channel = "sms",
  request_id = null,
  preview = null,
  error = null,
}) {
  const write = () =>
    execute(
      `INSERT INTO notification_log
         (reservation_id, channel, kind, status, request_id, message_preview, error, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reservation_id ?? null,
        channel,
        kind,
        status,
        request_id ?? null,
        preview ?? null,
        error ?? null,
        new Date().toISOString(),
      ],
    );

  try {
    await write();
    return { ok: true };
  } catch (e1) {
    try {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      await write();
      return { ok: true };
    } catch (e2) {
      // 여기까지 왔으면 **문자는 나갔는데 기록이 없다** → 신호기가 회색으로 보인다.
      // 조용히 삼키지 않는다. 알림에 예약ID·kind 를 실어 수동 백필이 가능하게 한다.
      await infraAlert(
        "notification-log",
        `⚠️ 발송기록 실패 — 문자는 나갔는데 D1 에 안 남았습니다.\n` +
          `예약: ${reservation_id ?? "(없음)"} / 종류: ${kind} / 결과: ${status}\n` +
          `→ 신호기에 회색으로 보일 것입니다.\n` +
          `오류: ${String(e2?.message || e2).slice(0, 200)}`,
      ).catch(() => {}); // 알림까지 실패해도 발송 흐름은 깨지 않는다
      return { ok: false };
    }
  }
}
