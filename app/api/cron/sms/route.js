// 입실·퇴실 안내 문자 크론 — 배포된 CF `autoSendSMSScheduler` 이식 (functions/src/smsScheduler.js).
//
// 🔴 이게 **컷오버의 마지막 블로커**다. 지금 실고객에게 입실·퇴실 문자를 보내는 건 CF 이고,
//    CF 는 Firestore 를 읽는다 → Firestore 를 끄는 순간 문자가 조용히 멈춘다.
//
// ⚠️ **이중발송 주의** — CF 가 살아 있는 동안 이 크론을 켜면 고객이 문자를 두 번 받는다.
//    그래서 `CRON_SMS_ENABLED=true` 가 아니면 아무것도 안 한다. 컷오버 순서:
//      1) CF autoSendSMSScheduler 를 먼저 죽인다 (firebase functions:delete autoSendSMSScheduler)
//      2) 그 다음 Vercel 에 CRON_SMS_ENABLED=true 주입
//    순서를 바꾸면 이중발송이거나 미발송이다.
//
// ── CF 와 맞춘 것 (실측으로 대조) ──
//  · 발송 시각: **고정 10시/13시 KST**. `checkin_hours_before` 는 CF 가 **안 읽는다**
//    (D1 에 그 컬럼이 있고 화면에도 보이지만 실제 발송자는 쓴 적이 없다 — 죽은 설정이다).
//    hours_before 로 구현하면 Forest 패밀리(=2)만 시각이 달라져 **동작이 바뀐다**.
//  · 13시 → 입실(check_in = 오늘) / 10시 → 퇴실(check_out = 오늘)
//  · status='예약확정' 만
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
//    이름이 어긋난 건 `단체예약`(예약 1건) 뿐인데 그건 source='막기' 라 어차피 스킵된다
import { NextResponse } from "next/server";
import { query, execute } from "../../../../lib/d1.js";
import { businessOf } from "../../../../lib/rooms.js";
import { getTemplate } from "../../../../lib/notifications.js";
import { renderTemplate } from "../../../../lib/template-vars.js";
import { sendSms } from "../../../../lib/sms.js";
import { reportSmsResult } from "../../../../lib/infra-alert.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // lib/sms.js 가 node:crypto(HMAC)를 쓴다

const PENSION_ADDRESS = "경기도 파주시 법원읍 초리골길 134";
const KINDS = { checkIn: "check_in", checkOut: "check_out" };

/** KST 오늘 (YYYY-MM-DD) — /api/health 와 같은 방식 */
function todayKst() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** CF replaceTemplateVariables 의 꼬리 로직 — 주소가 없으면 붙인다 */
function appendAddressIfMissing(text) {
  if (text.includes(PENSION_ADDRESS) || text.includes("주소")) return text;
  return `${text}\n\n주소: ${PENSION_ADDRESS}`;
}

export async function GET(request) {
  // 인증: /api/health 와 같은 CRON_SECRET Bearer (미들웨어를 통과하므로 자체 방어 필수)
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const kind = new URL(request.url).searchParams.get("type");
  if (!KINDS[kind])
    return NextResponse.json(
      { error: "type 은 checkIn | checkOut" },
      { status: 400 },
    );

  // 🔴 킬스위치 — CF 가 살아 있는 동안 켜면 이중발송이다 (상단 주석의 컷오버 순서 참조)
  if (process.env.CRON_SMS_ENABLED !== "true")
    return NextResponse.json({ skipped: "CRON_SMS_ENABLED 아님", kind });

  const date = todayKst();
  const out = { kind, date, targets: 0, sent: 0, failed: 0, skipped: [] };

  try {
    const { results: rows } = await query(
      `SELECT id, customer_name, phone, room_name, check_in, check_out, guests, total_price
         FROM reservations
        WHERE ${KINDS[kind]} = ? AND status = '예약확정' AND (source IS NULL OR source != '막기')`,
      [date],
    );
    out.targets = rows.length;

    for (const r of rows) {
      if (!r.phone) {
        out.skipped.push(`${r.customer_name}: 전화번호 없음`);
        continue;
      }

      // 중복가드 — 레거시 smsStatus.{kind}Sent 자리. 성공 이력이 있으면 다시 안 보낸다
      const { results: dup } = await query(
        `SELECT 1 FROM notification_log
          WHERE reservation_id = ? AND kind = ? AND channel = 'sms' AND status = 'success' LIMIT 1`,
        [r.id, kind],
      );
      if (dup.length) {
        out.skipped.push(`${r.customer_name}: 이미 발송됨`);
        continue;
      }

      const business = await businessOf(r.room_name);
      const tpl = await getTemplate(business, r.room_name, kind);
      if (!tpl) {
        out.skipped.push(`${r.customer_name}(${r.room_name}): 템플릿 없음`);
        continue;
      }
      const flag =
        kind === "checkIn" ? tpl.checkin_enabled : tpl.checkout_enabled;
      if (tpl.enabled === 0 || flag === 0) {
        out.skipped.push(`${r.customer_name}(${r.room_name}): 자동발송 꺼짐`);
        continue;
      }

      const { text, missing } = renderTemplate(tpl.content, r);
      if (missing.length) {
        // 미치환 변수는 발송하지 않는다 (2026-03 사고 재발 방지 — 확정 경로와 같은 규칙)
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
        out.failed++;
        continue;
      }

      const content = appendAddressIfMissing(text);
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

    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json(
      { error: "크론 실패", detail: e.message?.slice(0, 200), ...out },
      { status: 500 },
    );
  }
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
