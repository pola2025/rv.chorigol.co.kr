// API 재고 가드 감사 — 화면이 실제로 타는 경로(POST/PATCH)에서 오버부킹이 막히는가.
//
// ⚠️ 막기(source='막기')는 **설계상 재고검사를 건너뛴다**(레거시 동일) → 가드 테스트에 못 쓴다.
//    그래서 非막기로 하되 알림이 실제로 나가지 않도록:
//      · sms_config.use_reservation/use_cancellation 을 잠시 0 → 테스트 → 원복
//      · status 는 '입금대기'만 (확정 시에만 문자가 나간다)
//      · 객실변경은 use_reservation 과 무관하게 텔레그램이 나가므로 **날짜 이동만** 테스트
//    정리는 생성 시 받은 정확한 ID로만.
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");
const { hashPassword } = await import("file:///F:/rv-chorigol.co.kr/lib/auth.js");
const B = "http://localhost:3900";

let pass = 0, fail = 0;
const ck = (n, c, x = "") => { console.log((c ? "  OK   " : "  FAIL ") + n + (x ? ` — ${x}` : "")); c ? pass++ : fail++; };
const made = [];
const keep = (j) => { if (j?.reservation?.id) made.push(j.reservation.id); return j; };

const baseCount = (await query(`SELECT COUNT(*) c FROM reservations`)).results[0].c;

// ── 알림 차단 (원본 캡처 후) ──
const cfg0 = (await query(`SELECT * FROM sms_config WHERE business='choho'`)).results[0];
await query(`UPDATE sms_config SET use_reservation=0, use_cancellation=0 WHERE business='choho'`);
console.log(`알림 차단: use_reservation ${cfg0.use_reservation}→0, use_cancellation ${cfg0.use_cancellation}→0`);

const restore = async () => {
  await query(`UPDATE sms_config SET use_reservation=?, use_cancellation=?, updated_at=? WHERE business='choho'`,
    [cfg0.use_reservation, cfg0.use_cancellation, cfg0.updated_at]);
};

try {
  // 로그인
  const EM = "zz-api@example.invalid", PW = "zz-" + Math.random().toString(36).slice(2) + "A1!";
  await query(`DELETE FROM admins WHERE email=?`, [EM]);
  await query(`INSERT INTO admins (email,password_hash,is_active,created_at) VALUES (?,?,1,?)`,
    [EM, hashPassword(PW), new Date().toISOString()]);
  const lg = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EM, password: PW }) });
  const cookie = (lg.headers.get("set-cookie") || "").split(";")[0];

  const post = (b) => fetch(`${B}/api/reservations`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(b) });
  const patch = (b) => fetch(`${B}/api/reservations`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(b) });

  const D1 = "2027-03-05", D2 = "2027-03-06";
  // source='etc' → 가드가 실제로 걸린다. status='입금대기' → 문자 없음.
  const mk = (o) => ({ customer_name: "zzAPI감사", phone: "01098979834", room_name: "Forest",
    check_in: D1, check_out: D2, guests: 2, status: "입금대기", source: "etc", total_price: 100000, ...o });

  console.log(`베이스라인 ${baseCount}건 · Forest 재고 2\n`);

  console.log("[1] POST — 재고 초과 거절");
  for (let i = 0; i < 2; i++) {
    const r = await post(mk()); keep(await r.json());
    ck(`${i + 1}번째 생성 (재고 2)`, r.status === 201, String(r.status));
  }
  let r = await post(mk()); let j = keep(await r.json());
  ck("3번째 → 409 (오버부킹 차단)", r.status === 409, `${r.status} ${j.error || ""}`);
  ck("막힌 날짜를 짚어줌 (레거시 문구)", (j.error || "").includes(D1), j.error);
  ck("알림 안 나감 (차단 확인)", !j.notify || Object.keys(j.notify || {}).length === 0 || j.notify?.telegram === undefined);

  r = await post(mk({ room_name: "없는객실" })); j = keep(await r.json());
  ck("없는 객실 → 400", r.status === 400 && j.error === "객실 정보를 찾을 수 없습니다.", `${r.status} ${j.error}`);

  console.log("\n[2] POST — 동시 8건 (API 경로)");
  const D3 = "2027-03-10", D4 = "2027-03-11";
  const burst = await Promise.all(Array.from({ length: 8 }, () => post(mk({ check_in: D3, check_out: D4 }))));
  for (const x of burst) keep(await x.json());
  const ok = burst.filter((x) => x.status === 201).length;
  ck("정확히 2건만 201 (재고 2)", ok === 2, `${ok}건 성공`);
  ck("나머지 6건 409", burst.filter((x) => x.status === 409).length === 6);
  const actual = (await query(
    `SELECT COUNT(*) c FROM reservations WHERE room_name='Forest' AND status!='예약취소' AND check_in<=? AND ?<check_out`,
    [D3, D3])).results[0].c;
  ck("실제 점유 2 (오버부킹 0)", actual === 2, `${actual}건`);

  console.log("\n[3] PATCH — 이동 / 취소→되돌리기");
  const mv = keep(await (await post(mk({ check_in: "2027-03-20", check_out: "2027-03-21" }))).json());
  ck("이동용 생성", !!mv.reservation);

  r = await patch({ id: mv.reservation.id, memo: "메모만" });
  ck("점유 안 바꾸는 수정 → 200 (자기제외 동작)", r.status === 200, String(r.status));

  r = await patch({ id: mv.reservation.id, check_in: D3, check_out: D4 });
  j = await r.json();
  ck("만실 날짜로 이동 → 409", r.status === 409, `${r.status} ${j.error || ""}`);

  r = await patch({ id: mv.reservation.id, cancel: true });
  ck("취소 → 200 (재고 푸는 방향)", r.status === 200, String(r.status));

  r = await patch({ id: mv.reservation.id, status: "입금대기", check_in: D3, check_out: D4 });
  j = await r.json();
  ck("취소→되돌리며 만실날로 → 409 (점유 부활 차단)", r.status === 409, `${r.status} ${j.error || ""}`);

  r = await patch({ id: mv.reservation.id, status: "입금대기", check_in: "2027-03-25", check_out: "2027-03-26" });
  ck("빈 날짜로 되돌리기 → 200", r.status === 200, String(r.status));

  await query(`DELETE FROM admins WHERE email=?`, [EM]);
} finally {
  // ── 정리 (정확한 ID로만) ──
  console.log("\n[4] 정리");
  for (const id of made) await query(`DELETE FROM reservations WHERE id = ?`, [id]);
  const stray = (await query(`SELECT id FROM reservations WHERE customer_name = 'zzAPI감사'`)).results;
  for (const s of stray) await query(`DELETE FROM reservations WHERE id = ?`, [s.id]);
  await restore();

  const after = (await query(`SELECT COUNT(*) c FROM reservations`)).results[0].c;
  ck(`예약 ${baseCount}건 복구`, after === baseCount, `현재 ${after}`);
  ck("금액합계 98,105,000원", (await query(`SELECT COALESCE(SUM(total_price),0) s FROM reservations`)).results[0].s === 98105000);
  const cfg1 = (await query(`SELECT * FROM sms_config WHERE business='choho'`)).results[0];
  ck("sms_config 원복", cfg1.use_reservation === cfg0.use_reservation && cfg1.use_cancellation === cfg0.use_cancellation,
    `use_reservation=${cfg1.use_reservation} use_cancellation=${cfg1.use_cancellation}`);
  ck("테스트 계정 삭제", (await query(`SELECT COUNT(*) c FROM admins`)).results[0].c === 0);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
