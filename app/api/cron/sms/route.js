// 입실·퇴실 안내 문자 크론 — 발송 로직은 `lib/sms-schedule.js` 에 있다.
// 여기는 **인증 · 킬스위치 · 위임**만 한다 (감사가 같은 로직을 검증할 수 있게 로직을 뺐다).
//
// 🔴 이게 **컷오버의 마지막 블로커**다. 지금 실고객에게 입실·퇴실 문자를 보내는 건 CF 이고,
//    CF 는 Firestore 를 읽는다 → Firestore 를 끄는 순간 문자가 조용히 멈춘다.
//
// ⚠️ **이중발송 주의** — CF 가 살아 있는 동안 이 크론을 켜면 고객이 문자를 두 번 받는다
//    (CF 는 Firestore, 크론은 D1 → 서로의 발송 이력을 몰라 중복가드가 안 통한다).
//    그래서 `CRON_SMS_ENABLED=true` 가 아니면 아무것도 안 한다. 컷오버 순서:
//      ① CF 스케줄러를 먼저 죽인다: `firebase functions:delete autoSendSMSScheduler --project choho-pension`
//      ② 그 다음 Vercel 에 CRON_SMS_ENABLED=true 주입
//    순서를 바꾸면 이중발송이거나 미발송이다.
//
// 스케줄(vercel.json): 퇴실 01:00 UTC = **10시 KST** / 입실 04:00 UTC = **13시 KST**
//   Vercel Cron 은 UTC 다. KST 는 서머타임이 없어 이 매핑이 항상 성립한다.
import { NextResponse } from "next/server";
import { runSmsSchedule, KIND_FIELD } from "../../../../lib/sms-schedule.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // lib/sms.js 가 node:crypto(HMAC)를 쓴다

export async function GET(request) {
  // 인증: /api/health 와 같은 CRON_SECRET Bearer (미들웨어를 통과하므로 자체 방어 필수)
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const kind = sp.get("type");
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
