// 예약 알림 오케스트레이션 — 트리거(onReservationCreated/Updated) 대체.
// 쓰기 API가 D1 저장 직후 이 함수를 호출한다.
import { execute } from "./d1.js";
import { businessOf } from "./rooms.js";
import { getSmsConfig, getTemplate, renderTemplate } from "./notifications.js";
import { sendSms } from "./sms.js";
import { sendTelegram } from "./telegram.js";
import { reportSmsResult } from "./infra-alert.js";
import {
  formatNew,
  formatConfirmation,
  formatCancellation,
  formatRoomChange,
} from "./messages.js";

async function log({
  reservation_id,
  channel,
  kind,
  status,
  request_id,
  preview,
  error,
}) {
  await execute(
    `INSERT INTO notification_log (reservation_id, channel, kind, status, request_id, message_preview, error, sent_at)
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
  ).catch(() => {});
}

/** 확정 문자 발송 (SMS) — 템플릿 활성화 시에만 */
async function sendConfirmationSms(business, reservation) {
  const tpl = await getTemplate(
    business,
    reservation.room_name,
    "confirmation",
  );
  if (!tpl || tpl.enabled === 0 || tpl.confirmation_enabled !== 1) {
    return { skipped: "템플릿 비활성" };
  }
  const { text, missing } = renderTemplate(tpl.content, reservation);
  if (missing.length) {
    // 발송 전 안전장치 — 미치환 변수 있으면 중단 (2026-03 사고 재발 방지)
    await log({
      reservation_id: reservation.id,
      channel: "sms",
      kind: "confirmation",
      status: "failed",
      error: `미치환 변수: ${missing.join(" ")}`,
    });
    // 인프라봇: 템플릿 파손은 즉시 알아야 할 사고
    await reportSmsResult({
      business,
      to: reservation.phone,
      kind: "confirmation",
      ok: false,
      error: `미치환 변수로 발송 차단: ${missing.join(" ")}`,
    }).catch(() => {});
    return { error: `미치환 변수: ${missing.join(" ")}` };
  }
  const res = await sendSms(business, reservation.phone, text, "예약확정 안내");
  await log({
    reservation_id: reservation.id,
    channel: "sms",
    kind: "confirmation",
    status: res.ok ? "success" : "failed",
    request_id: res.requestId,
    preview: text.slice(0, 120),
    error: res.ok ? null : JSON.stringify(res.error).slice(0, 200),
  });
  // 인프라봇: 문자발송 성공/실패 헬스체크 리포트 (예약 알림봇과 분리)
  await reportSmsResult({
    business,
    to: reservation.phone,
    kind: "confirmation",
    ok: res.ok,
    requestId: res.requestId,
    error: res.ok ? null : JSON.stringify(res.error),
  }).catch(() => {});

  if (res.ok) {
    await execute(`UPDATE reservations SET updated_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      reservation.id,
    ]).catch(() => {});
  }
  return res;
}

async function tg(business, text, kind, reservation_id) {
  const res = await sendTelegram(business, text);
  await log({
    reservation_id,
    channel: "telegram",
    kind,
    status: res.ok ? "success" : "failed",
    preview: text.slice(0, 120),
    error: res.ok ? null : res.error,
  });
  return res;
}

/**
 * 예약 이벤트 알림. 트리거 로직 이식.
 * @param {'new'|'confirmed'|'cancelled'|'roomChange'} event
 * @param {object} reservation  D1 예약 (options 포함)
 * @param {object} [ctx]        { prevRoom, newRoom }
 */
export async function notifyReservation(event, reservation, ctx = {}) {
  if (reservation.source === "막기") return { skipped: "막기 예약" };
  const business = await businessOf(reservation.room_name);
  const cfg = await getSmsConfig(business);
  const results = {};

  if (event === "confirmed") {
    if (cfg?.use_reservation !== 0)
      results.telegram = await tg(
        business,
        formatConfirmation(reservation),
        "confirmation",
        reservation.id,
      );
    results.sms = await sendConfirmationSms(business, reservation);
  } else if (event === "new") {
    if (cfg?.use_reservation !== 0)
      results.telegram = await tg(
        business,
        formatNew(reservation),
        "new",
        reservation.id,
      );
  } else if (event === "cancelled") {
    // 취소는 텔레그램만 (고객 문자 미발송 — 확정된 정책)
    if (cfg?.use_cancellation !== 0)
      results.telegram = await tg(
        business,
        formatCancellation(reservation),
        "cancellation",
        reservation.id,
      );
  } else if (event === "roomChange") {
    results.telegram = await tg(
      business,
      formatRoomChange(reservation, ctx.prevRoom, ctx.newRoom),
      "roomChange",
      reservation.id,
    );
  }
  return results;
}
