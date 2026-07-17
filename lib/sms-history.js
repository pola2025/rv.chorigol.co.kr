// 문자 발송 이력 — D1 → 레거시 smsStatus 모양 복원 (SmsHistoryTable 용).
//
// 레거시는 예약 문서의 smsStatus MAP 을 그대로 읽었다. D1 은 그걸 notification_log 로
// 정규화했으므로(로더가 빠뜨려 backfill-sms-status.mjs 로 복구), 여기서 **역으로 조립**해
// 컴포넌트에는 예전과 똑같은 모양을 준다 → getSmsStatus() 무수정.
//
// 검증: scripts/audit/audit-sms-history.mjs — 신호등 1454/1620 일치.
//   차이 166칸은 전부 **레거시가 안 보던 기존 checkIn 로그**(145 success / 21 failed)이고
//   전부 표시창(최근30일+미래) 밖이라 화면 출력은 레거시와 동일하다.
import { query } from "./d1.js";
import { attachOptions } from "./reservations.js";
import { toReservation } from "./legacy-shape.js";

const KINDS = ["confirmation", "checkIn", "checkOut"];
const FLAGS = {
  confirmation: ["conf_ok", "conf_err"],
  checkIn: ["cin_ok", "cin_err"],
  checkOut: ["cout_ok", "cout_err"],
};

/**
 * 표시창 예약 + smsStatus.
 *
 * 레거시(SmsHistoryTable.jsx:57-87)의 연산 순서를 그대로 지킨다:
 *   checkIn >= 30일전  →  orderBy checkIn asc  →  **limit 100**  →  (업체·취소 필터는 클라이언트)
 * limit 이 업체 필터보다 **먼저** 걸리는 건 레거시 그대로다. 지금은 창 안에 35건뿐이라
 * 물리지 않지만, 순서를 바꾸면 데이터가 늘었을 때 조용히 다른 화면이 된다.
 */
export async function listSmsHistory(todayISO = new Date().toISOString()) {
  // 컷오프는 **KST 기준**이어야 한다 — 레거시는 브라우저(KST)에서 getKSTDateString() 으로 만들었고
  // 이 코드는 UTC 서버(Vercel)에서 돈다. toISOString() 을 쓰면 시각에 따라 하루가 어긋나
  // 표시창에 예약이 하루치 더/덜 들어온다. (src/utils.js:13 과 같은 식)
  const d = new Date(todayISO);
  d.setDate(d.getDate() - 30);
  const cutoff = d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  const { results } = await query(
    `WITH win AS (
       SELECT * FROM reservations
        WHERE check_in >= ?
        ORDER BY check_in ASC
        LIMIT 100
     )
     SELECT w.*,
            MAX(CASE WHEN n.kind='confirmation' AND n.status='success' THEN 1 ELSE 0 END) conf_ok,
            MAX(CASE WHEN n.kind='confirmation' AND n.status='failed'  THEN 1 ELSE 0 END) conf_err,
            MAX(CASE WHEN n.kind='checkIn'      AND n.status='success' THEN 1 ELSE 0 END) cin_ok,
            MAX(CASE WHEN n.kind='checkIn'      AND n.status='failed'  THEN 1 ELSE 0 END) cin_err,
            MAX(CASE WHEN n.kind='checkOut'     AND n.status='success' THEN 1 ELSE 0 END) cout_ok,
            MAX(CASE WHEN n.kind='checkOut'     AND n.status='failed'  THEN 1 ELSE 0 END) cout_err
       FROM win w
       LEFT JOIN notification_log n
              ON n.reservation_id = w.id
             AND n.channel = 'sms'
             AND n.kind IN ('confirmation','checkIn','checkOut')
      GROUP BY w.id
      ORDER BY w.check_in ASC`,
    [cutoff],
  );

  const rows = await attachOptions(results);

  return rows.map((r) => {
    // 레거시 getSmsStatus() 가 읽는 키만 만든다: `${kind}Sent` / `${kind}Error`
    const smsStatus = {};
    for (const kind of KINDS) {
      const [ok, err] = FLAGS[kind];
      if (r[ok]) smsStatus[`${kind}Sent`] = true;
      else if (r[err]) smsStatus[`${kind}Error`] = "발송 실패";
    }
    return { ...toReservation(r, r.options), smsStatus };
  });
}
