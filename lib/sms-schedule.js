// 입실·퇴실 안내 발송 로직 — 배포된 CF `autoSendSMSScheduler` 이식 (functions/src/smsScheduler.js).
//
// **라우트가 아니라 여기 있는 이유**: 감사(scripts/audit/audit-cron-sms.mjs)가 발송부와
// **같은 코드**를 검증해야 한다. 로직이 라우트 안에 있으면 감사는 복사본을 검증하게 되고,
// 그 복사본은 반드시 어긋난다 (template-vars.js 를 분리한 것과 같은 이유).
//
// dryRun: true → **문자를 안 보내고 로그도 안 남긴다.** 무엇이 나갈지만 계산해 돌려준다.
//
// ── CF 와 맞춘 것 (실측 대조) ──
//  · 발송 시각: **고정 10시/13시 KST**. `checkin_hours_before` 는 CF 가 **안 읽는다**
//    (D1 에 컬럼이 있고 화면에도 보이지만 실제 발송자는 쓴 적이 없다 — 죽은 설정이다).
//    hours_before 로 구현하면 Forest 패밀리(=2)만 시각이 달라져 **동작이 바뀐다**.
//  · 13시 → 입실(check_in = 오늘) / 10시 → 퇴실(check_out = 오늘), status='예약확정' 만
//  · 전화번호 없으면 스킵
//  · 객실 플래그: enabled=0 이면 스킵, checkin_enabled/checkout_enabled=0 이면 스킵
//  · **주소 자동추가**: 치환 후 메시지에 주소도 '주소' 글자도 없으면 끝에 붙인다.
//    실측 — 퇴실 템플릿 7개 전부 이게 걸린다(지금 고객이 받는 퇴실 문자 끝엔 주소가 붙어 있다).
//    입실 템플릿 7개는 {주소}를 명시해서 안 걸린다.
//  · subject 없음 — CF 가 sendSMS(to, content) 로만 부른다. 넣으면 LMS 제목이 새로 생긴다
//
// ── CF 와 **일부러 다르게** 한 것 ──
//  · `source='막기'` 스킵. CF 는 status 만 보고 막기에도 발송을 시도한다(더미번호라 실패할 뿐).
//    신규 스택은 notifyReservation 이 막기를 스킵하는 규약이고, 안 그러면 막기 테스트가
//    실문자를 쏜다. 실측: 막기 16건 전부 더미번호(000-0000-000X), 미래 막기 0건 → 과거영향 0
//  · 중복가드를 smsStatus 대신 **notification_log** 로 한다 (D1 엔 smsStatus 가 없다.
//    과거분은 backfill-sms-status.mjs 로 채워져 있어 이력이 이어진다)
//  · 템플릿이 없으면 **스킵**. CF 는 하드코딩 기본템플릿으로 폴백한다.
//    실측상 발송 대상 객실 5개(Forest×4·호수뷰객실)는 템플릿이 다 있다.
import { query, execute } from "./d1.js";
import { businessOf } from "./rooms.js";
import { getTemplate } from "./notifications.js";
import { renderTemplate } from "./template-vars.js";
import { sendSms } from "./sms.js";
import { reportSmsResult } from "./infra-alert.js";

export const PENSION_ADDRESS = "경기도 파주시 법원읍 초리골길 134";
export const KIND_FIELD = { checkIn: "check_in", checkOut: "check_out" };

/** KST 오늘 (YYYY-MM-DD) — /api/health 와 같은 방식 */
export function todayKst() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** CF replaceTemplateVariables 의 꼬리 로직 — 주소가 없으면 붙인다 */
export function appendAddressIfMissing(text) {
  if (text.includes(PENSION_ADDRESS) || text.includes("주소")) return text;
  return `${text}\n\n주소: ${PENSION_ADDRESS}`;
}

async function log(
  reservation_id,
  kind,
  status,
  request_id,
  error,
  preview = null,
) {
  await execute(
    `INSERT INTO notification_log
       (reservation_id, channel, kind, status, request_id, message_preview, error, sent_at)
     VALUES (?, 'sms', ?, ?, ?, ?, ?, ?)`,
    [
      reservation_id,
      kind,
      status,
      request_id ?? null,
      preview,
      error ?? null,
      new Date().toISOString(),
    ],
  ).catch(() => {});
}

/**
 * 입실·퇴실 안내 발송.
 * @param {'checkIn'|'checkOut'} kind
 * @param {string} date  YYYY-MM-DD (KST)
 * @param {boolean} dryRun  true 면 발송·로그 없이 계획만 돌려준다
 */
export async function runSmsSchedule({
  kind,
  date = todayKst(),
  dryRun = false,
}) {
  if (!KIND_FIELD[kind]) throw new Error("kind 는 checkIn | checkOut");

  const out = {
    kind,
    date,
    dryRun,
    targets: 0,
    sent: 0,
    failed: 0,
    skipped: [],
    plan: [],
  };

  const { results: rows } = await query(
    `SELECT id, customer_name, phone, room_name, check_in, check_out, guests, total_price
       FROM reservations
      WHERE ${KIND_FIELD[kind]} = ? AND status = '예약확정' AND (source IS NULL OR source != '막기')`,
    [date],
  );
  out.targets = rows.length;

  for (const r of rows) {
    const who = `${r.customer_name}(${r.room_name})`;

    if (!r.phone) {
      out.skipped.push(`${who}: 전화번호 없음`);
      continue;
    }

    // 중복가드 — 레거시 smsStatus.{kind}Sent 자리. 성공 이력이 있으면 다시 안 보낸다
    const { results: dup } = await query(
      `SELECT 1 FROM notification_log
        WHERE reservation_id = ? AND kind = ? AND channel = 'sms' AND status = 'success' LIMIT 1`,
      [r.id, kind],
    );
    if (dup.length) {
      out.skipped.push(`${who}: 이미 발송됨`);
      continue;
    }

    const business = await businessOf(r.room_name);
    const tpl = await getTemplate(business, r.room_name, kind);
    if (!tpl) {
      out.skipped.push(`${who}: 템플릿 없음`);
      continue;
    }
    const flag =
      kind === "checkIn" ? tpl.checkin_enabled : tpl.checkout_enabled;
    if (tpl.enabled === 0 || flag === 0) {
      out.skipped.push(`${who}: 자동발송 꺼짐`);
      continue;
    }

    const { text, missing } = renderTemplate(tpl.content, r);
    if (missing.length) {
      // 미치환 변수는 발송하지 않는다 (2026-03 사고 재발 방지 — 확정 경로와 같은 규칙)
      out.failed++;
      out.plan.push({
        to: r.phone,
        who,
        business,
        error: `미치환 변수: ${missing.join(" ")}`,
      });
      if (dryRun) continue;
      await log(
        r.id,
        kind,
        "failed",
        null,
        `미치환 변수: ${missing.join(" ")}`,
      );
      await reportSmsResult({
        business,
        to: r.phone,
        kind,
        ok: false,
        error: `미치환 변수로 발송 차단: ${missing.join(" ")}`,
      }).catch(() => {});
      continue;
    }

    const content = appendAddressIfMissing(text);
    out.plan.push({
      to: r.phone,
      who,
      business,
      addressAppended: content !== text,
      chars: content.length,
      type:
        content.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").length >
        45
          ? "LMS"
          : "SMS",
      content,
    });

    if (dryRun) continue; // 🔒 여기서 멈춘다 — 발송도 로그도 없다

    const res = await sendSms(business, r.phone, content); // subject 없음 = CF 동일
    await log(
      r.id,
      kind,
      res.ok ? "success" : "failed",
      res.requestId,
      res.ok ? null : JSON.stringify(res.error).slice(0, 200),
      content.slice(0, 120),
    );
    await reportSmsResult({
      business,
      to: r.phone,
      kind,
      ok: res.ok,
      requestId: res.requestId,
      error: res.ok ? null : JSON.stringify(res.error),
    }).catch(() => {});
    res.ok ? out.sent++ : out.failed++;
  }

  return out;
}
