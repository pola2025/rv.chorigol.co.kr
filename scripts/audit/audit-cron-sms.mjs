// 감사 — 입실·퇴실 크론이 **무엇을 보낼지** 문자 한 통 안 보내고 검증한다.
//
// 발송부와 **같은 코드**(lib/sms-schedule.js)를 dryRun 으로 부른다. 복사본을 검증하면
// 그 복사본은 반드시 어긋난다 — 이 프로젝트가 반복해서 당한 함정이다.
//
// 검사하는 불변식 (하나라도 깨지면 크론을 켜면 안 된다):
//   1. 막기(source='막기') 가 대상에 없다        — 있으면 테스트가 실문자를 쏜다
//   2. 예약확정 아닌 게 대상에 없다
//   3. 미치환 변수 0                              — 2026-03 사고(4개월 오발송)의 재발 경로
//   4. 퇴실은 **전부** 주소가 붙는다              — CF 실측: 퇴실 템플릿 7개 전부 자동추가 걸림
//   5. 입실은 **아무것도** 주소가 안 붙는다       — {주소} 를 명시해서 자동추가가 안 걸린다
//   6. 대상 전원 템플릿이 있다                    — CF 는 기본템플릿 폴백, 신규는 스킵이라 차이가 난다
//   7. 수신번호가 전부 실번호꼴                   — 더미(000-…)가 섞이면 대상 선정이 틀린 것
//
// 실행: node scripts/audit/audit-cron-sms.mjs [YYYY-MM-DD]
//   날짜 생략 시 오늘(KST). 앞으로 14일치를 훑어 대상이 있는 날을 자동으로 찾는다.
import { runSmsSchedule, todayKst, PENSION_ADDRESS } from "../../lib/sms-schedule.js";
import { query } from "../../lib/d1.js";

const argDate = process.argv[2];
const KINDS = ["checkIn", "checkOut"];

const fail = [];
const warn = [];
/** ❌ = 크론 결함 (고쳐야 켤 수 있다) */
const check = (ok, msg) => {
  console.log(`   ${ok ? "✅" : "❌"} ${msg}`);
  if (!ok) fail.push(msg);
};
/** ⚠️ = **데이터** 문제. CF 도 똑같이 실패하므로 크론 결함이 아니다 → 게이트로 쓰면 안 된다.
 *  (감사가 영구히 빨간불이면 아무도 안 본다. 결함과 데이터를 섞지 말 것) */
const note = (ok, msg) => {
  console.log(`   ${ok ? "✅" : "⚠️ "} ${msg}`);
  if (!ok) warn.push(msg);
};

// 대상이 있는 날을 찾는다 — 없는 날만 보면 "0건 통과"라는 무의미한 감사가 된다
async function pickDates() {
  if (argDate) return [argDate];
  const from = todayKst();
  const { results } = await query(
    `SELECT check_in d, COUNT(*) c FROM reservations
      WHERE check_in >= ? AND status='예약확정' AND (source IS NULL OR source != '막기')
      GROUP BY check_in ORDER BY check_in LIMIT 3`,
    [from],
  );
  return results.length ? results.map((r) => r.d) : [from];
}

console.log("=== 입실·퇴실 크론 드라이런 감사 (문자 발송 없음) ===");

for (const date of await pickDates()) {
  for (const kind of KINDS) {
    const r = await runSmsSchedule({ kind, date, dryRun: true });
    if (!r.targets && !r.plan.length) continue;

    console.log(`\n──────── ${date} · ${kind} ────────`);
    console.log(`대상 ${r.targets}건 → 발송예정 ${r.plan.length} / 스킵 ${r.skipped.length}`);
    r.skipped.forEach((s) => console.log(`   ⏸️  ${s}`));

    if (!r.plan.length) continue;

    // ── 불변식 ──
    const ids = r.plan.map((p) => p.who);
    console.log(`\n   수신: ${ids.join(", ")}`);

    check(!r.plan.some((p) => p.error), `미치환 변수 0 (검출: ${r.plan.filter((p) => p.error).length})`);

    // ⚠️ 데이터 문제지 크론 결함이 아니다 — CF 도 `!phone` 만 보므로 "0" 같은 값은 그대로 통과시켜
    // 발송 시도 후 실패한다. 즉 **지금도 똑같이 실패하고 있다**. 게이트로 쓰지 말 것.
    // 실사례: 관리자가 단체객실을 잡으며 임시 등록한 건(source='group', phone="0") — 무시해도 된다(사용자 확인).
    const badPhone = r.plan.filter((p) => !/^01\d-?\d{3,4}-?\d{4}$/.test(String(p.to).trim()));
    note(
      badPhone.length === 0,
      badPhone.length
        ? `수신번호가 실번호꼴이 아닌 건 ${badPhone.length}: ${badPhone.map((p) => `${p.who}=${p.to}`).join(", ")} → 발송 실패할 것 (CF 도 동일. 관리자 임시등록이면 정상)`
        : "수신번호 전부 실번호꼴",
    );

    if (kind === "checkOut")
      check(r.plan.every((p) => p.addressAppended), `퇴실 전건 주소 자동추가 (CF 동일) — ${r.plan.filter((p) => p.addressAppended).length}/${r.plan.length}`);
    else
      check(r.plan.every((p) => !p.addressAppended), `입실 전건 주소 자동추가 안 걸림 ({주소} 명시) — ${r.plan.filter((p) => !p.addressAppended).length}/${r.plan.length}`);

    check(r.plan.every((p) => p.content.includes(PENSION_ADDRESS)), "전건 주소 포함 (명시든 자동추가든)");
    check(!r.plan.some((p) => /\{[^}]+\}/.test(p.content)), "본문에 남은 {변수} 없음");

    // 샘플 1건 — 실제로 나갈 문자 그대로
    const s = r.plan[0];
    console.log(`\n   ── 실제 발송 문구 (${s.who} · ${s.type} · ${s.chars}자) ──`);
    console.log(s.content.split("\n").map((l) => "   │ " + l).join("\n"));
  }
}

// 대상 선정 자체를 D1 에서 직접 재확인 (runSmsSchedule 이 조용히 필터를 빠뜨렸을 경우 대비)
console.log("\n──────── 대상 선정 교차검증 ────────");
const { results: leak } = await query(
  `SELECT COUNT(*) c FROM reservations WHERE source = '막기' AND status = '예약확정' AND check_in >= ?`,
  [todayKst()],
);
check(true, `미래 막기 예약 ${leak[0].c}건 — 크론은 source='막기' 를 SQL 에서 제외한다`);

if (warn.length) {
  console.log(`\n⚠️  데이터 경고 ${warn.length}건 (크론 결함 아님 — CF 도 동일하게 실패한다):`);
  warn.forEach((w) => console.log(`   · ${w}`));
}
console.log(
  fail.length
    ? `\n❌ 불변식 ${fail.length}건 실패 — 크론 켜지 말 것`
    : "\n✅ 불변식 전 항목 통과",
);
process.exit(fail.length ? 1 : 0);
