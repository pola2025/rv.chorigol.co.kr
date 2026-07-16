// 헬스체크 API — 인프라봇으로 예약체크 확인 리포트.
// Vercel Cron이 주기 호출. 시크릿 헤더로 보호 (공개 노출 금지).
import { NextResponse } from "next/server";
import { query } from "../../../lib/d1.js";
import { reportReservationCheck } from "../../../lib/infra-alert.js";

export const dynamic = "force-dynamic";

// KST 오늘 날짜 (YYYY-MM-DD)
function todayKst() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function GET(request) {
  // 인증: CRON_SECRET 헤더 필수 (Vercel Cron은 Authorization: Bearer 로 호출)
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = todayKst();
  const report = { date, dbOk: false, checkIns: 0, checkOuts: 0, smsSuccess: 0, smsFailed: 0, failedDetail: [] };

  try {
    const { results } = await query(
      `SELECT
         (SELECT COUNT(*) FROM reservations WHERE check_in = ? AND status = '예약확정')  AS check_ins,
         (SELECT COUNT(*) FROM reservations WHERE check_out = ? AND status = '예약확정') AS check_outs`,
      [date, date],
    );
    report.dbOk = true;
    report.checkIns = results[0]?.check_ins ?? 0;
    report.checkOuts = results[0]?.check_outs ?? 0;

    // 최근 24시간 문자 발송 집계
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const sms = await query(
      `SELECT status, COUNT(*) c FROM notification_log
       WHERE channel = 'sms' AND sent_at > ? GROUP BY status`,
      [since],
    );
    for (const row of sms.results) {
      if (row.status === "success") report.smsSuccess = row.c;
      else report.smsFailed += row.c;
    }

    if (report.smsFailed > 0) {
      const fails = await query(
        `SELECT kind, error FROM notification_log
         WHERE channel = 'sms' AND status != 'success' AND sent_at > ? LIMIT 5`,
        [since],
      );
      report.failedDetail = fails.results.map((f) => `${f.kind}: ${String(f.error || "").slice(0, 80)}`);
    }
  } catch (e) {
    report.dbOk = false;
    report.failedDetail = [`D1 오류: ${e.message.slice(0, 120)}`];
  }

  const sent = await reportReservationCheck(report).catch((e) => ({ ok: false, error: e.message }));
  return NextResponse.json({ report, alerted: sent.ok === true });
}
