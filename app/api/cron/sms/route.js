// 입실·퇴실 안내 문자 크론 — 발송 로직은 `lib/sms-schedule.js` 에 있다.
// 여기는 **인증 · 킬스위치 · 위임**만 한다 (감사가 같은 로직을 검증할 수 있게 로직을 뺐다).
//
// ✅ 2026-07-17 컷오버 완료 — **이 크론이 입실·퇴실 문자의 유일한 발송자다.**
//    CF `autoSendSMSScheduler` 는 삭제됐다(목록 0개 확인). 되살리면 이중발송이다.
//
// 스케줄(vercel.json): 퇴실 01:00 UTC = **10시 KST** / 입실 04:00 UTC = **13시 KST**
//   Vercel Cron 은 UTC 다. KST 는 서머타임이 없어 이 매핑이 항상 성립한다.
//
// 인증: `CRON_SECRET` 이 있으면 **Vercel 이 자동으로** `Authorization: Bearer <값>` 을 붙여 호출한다
//   (Vercel 공식 규약). 미들웨어가 이 경로를 통과시키므로 자체 검증이 유일한 방어선이다.
//
// 중복 호출 주의: Vercel 크론 전달은 **best effort** 라 같은 스케줄이 두 번 올 수 있다(공식 문서).
//   그래서 발송 판단은 `notification_log` 기준으로 **멱등**해야 한다 — lib/sms-schedule.js 가 그렇게 한다.
import { NextResponse } from "next/server";
import { runSmsSchedule, KIND_FIELD } from "../../../../lib/sms-schedule.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // lib/sms.js 가 node:crypto(HMAC)를 쓴다

/**
 * 스케줄 → 종류 안전망.
 *
 * 크론 경로는 `?type=checkIn` 처럼 쿼리로 종류를 넘긴다. 만약 Vercel 이 호출 때 쿼리를
 * 떨어뜨리면 `type` 이 없어 400 이 되고 **문자가 조용히 안 나간다**(아무도 모른다).
 * Vercel 은 **모든 크론 요청에 `x-vercel-cron-schedule` 헤더**로 어떤 스케줄이 호출했는지
 * 알려주므로(공식), 쿼리가 없을 때 이걸로 복구한다.
 *
 * ⚠️ vercel.json 의 schedule 을 바꾸면 여기도 같이 바꿔야 한다.
 */
const SCHEDULE_KIND = {
  "0 1 * * *": "checkOut",
  "0 4 * * *": "checkIn",
};

export async function GET(request) {
  // 인증: /api/health 와 같은 CRON_SECRET Bearer (미들웨어를 통과하므로 자체 방어 필수)
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  // 쿼리가 정상 경로. 없으면 크론 스케줄 헤더로 복구한다 (위 SCHEDULE_KIND 주석 참조)
  const kind =
    sp.get("type") ??
    SCHEDULE_KIND[request.headers.get("x-vercel-cron-schedule")];
  if (!KIND_FIELD[kind])
    return NextResponse.json(
      { error: "type 은 checkIn | checkOut" },
      { status: 400 },
    );

  // 🔴 킬스위치 — CF 가 살아 있는 동안 켜면 이중발송이다 (상단 주석의 컷오버 순서 참조)
  if (process.env.CRON_SMS_ENABLED !== "true")
    return NextResponse.json({ skipped: "CRON_SMS_ENABLED 아님", kind });

  try {
    // dryRun=1 → 발송 없이 계획만 (배포 후 무해하게 확인하는 용도)
    const res = await runSmsSchedule({
      kind,
      dryRun: sp.get("dryRun") === "1",
    });
    // 문자 본문은 응답에 싣지 않는다 (고객 실명·전화번호가 들어 있다)
    return NextResponse.json({ ...res, plan: res.plan.map((p) => p.who) });
  } catch (e) {
    return NextResponse.json(
      { error: "크론 실패", detail: e.message?.slice(0, 200) },
      { status: 500 },
    );
  }
}
