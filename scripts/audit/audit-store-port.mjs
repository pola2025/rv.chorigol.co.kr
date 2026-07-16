// useReservationStore 이식 감사 — 스토어가 실제로 타는 API 경로를 서버 기동 상태로 검증.
//
// ⚠️ 안전장치 (테스트 규칙):
//   · 알림이 실채널로 나가지 않도록 sms_config.use_reservation/use_cancellation 을 0 으로 내렸다가 원복
//   · status 는 '입금대기' 만 사용 (예약확정 시에만 문자가 나간다)
//   · 정리는 **생성 시 받은 정확한 ID** 로만 (LIKE 패턴 삭제 금지 — 실데이터 삭제 사고 있었음)
//   · 미래 날짜(2027-12-30~31)만 사용 — 실예약과 겹치지 않게
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");
const { hashPassword } = await import("file:///F:/rv-chorigol.co.kr/lib/auth.js");
const { toWriteBody } = await import(
  "file:///F:/rv-chorigol.co.kr/lib/legacy-write-shape.js"
);
const B = "http://localhost:3900";

let pass = 0,
  fail = 0;
const ck = (n, c, x = "") => {
  console.log((c ? "  OK   " : "  FAIL ") + n + (x ? ` — ${x}` : ""));
  c ? pass++ : fail++;
};

const D_IN = "2027-12-30",
  D_OUT = "2027-12-31";
const ROOM = "Forest";
const PHONE = "010-9897-9834"; // 테스트 전용 번호 (사용자 지정)
const made = [];

const baseRes = (await query(`SELECT COUNT(*) c FROM reservations`)).results[0].c;
const baseCust = (await query(`SELECT COUNT(*) c FROM customers`)).results[0].c;
const baseOv = (await query(`SELECT COUNT(*) c FROM inventory_overrides`)).results[0].c;

// ⚠️ 테스트 번호(01098979834)에는 **실고객 데이터가 이미 있다**(이재호, 방문 37회).
//    행 수만 보고 "늘었으면 삭제" 하면 **기존 행을 수정한 경우**를 못 되돌린다 —
//    실제로 1회차 감사에서 이름이 "테스트예약"으로 덮여 덤프에서 복구했다.
//    → 원본 행 전체를 캡처해 finally 에서 되돌린다 (D1 쓰기 테스트의 원본캡처-복구 원칙).
const CUST_ID = "010-9897-9834".replace(/[^0-9]/g, "");
const cust0Row = (await query(`SELECT * FROM customers WHERE id=?`, [CUST_ID])).results[0] || null;

// ── 알림 차단 (원본 캡처 후) ──
const cfg0 = (await query(`SELECT * FROM sms_config WHERE business='choho'`)).results[0];
await query(`UPDATE sms_config SET use_reservation=0, use_cancellation=0 WHERE business='choho'`);
console.log(`알림 차단: use_reservation ${cfg0.use_reservation}→0 / use_cancellation ${cfg0.use_cancellation}→0`);
console.log(`기준: 예약 ${baseRes} · 고객 ${baseCust} · override ${baseOv}\n`);

const EM = "zz-store@example.invalid",
  PW = "zz-" + Math.random().toString(36).slice(2) + "A1!";
let cookie = "";

try {
  // ── 로그인 ──
  await query(`DELETE FROM admins WHERE email=?`, [EM]);
  await query(
    `INSERT INTO admins (email,password_hash,is_active,created_at) VALUES (?,?,1,?)`,
    [EM, hashPassword(PW), new Date().toISOString()],
  );
  const lr = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EM, password: PW }),
  });
  cookie = (lr.headers.get("set-cookie") || "").split(";")[0];
  ck("로그인 → 쿠키 발급", lr.ok && !!cookie);

  const api = async (path, { method = "PATCH", body, auth = true } = {}) => {
    const res = await fetch(B + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };

  // ── 1. toWriteBody: 매핑 대상이 실제 D1 컬럼인가 (순수 함수) ──
  console.log("\n[매퍼 — camelCase → 실제 D1 컬럼]");
  const cols = new Set(
    (await query(`PRAGMA table_info(reservations)`)).results.map((r) => r.name),
  );
  // 레거시 컴포넌트가 보내는 예약 원형 전체 (legacy-shape.toReservation 출력 = booking 객체)
  const full = {
    id: "x", customerName: "홍길동", phone: PHONE, roomName: ROOM,
    checkIn: D_IN, checkOut: D_OUT, guests: 2, status: "입금대기", source: "직접",
    depositorName: "홍길동", memo: "메모", basePrice: 1, roomPrice: 2, optionPrice: 3,
    onsitePrice: 4, extraGuestPrice: 5, totalPrice: 6, cancelReason: "사유",
    cancellationFee: 7, refundAmount: 8, refundRate: 9, canceledAt: "t",
    createdAt: "t", updatedAt: "t", options: [{ name: "숯불바베큐", price: 0 }],
  };
  const mapped = toWriteBody(full);
  const bad = Object.keys(mapped).filter((k) => k !== "options" && !cols.has(k));
  ck("매핑 결과가 전부 실제 컬럼 (options 제외)", bad.length === 0, bad.join(","));
  ck("id/createdAt/updatedAt/canceledAt 는 제외됨", !("id" in mapped) && !("created_at" in mapped) && !("updated_at" in mapped) && !("canceled_at" in mapped));
  ck("customerName → customer_name", mapped.customer_name === "홍길동");
  ck("부분 수정 — 보낸 키만 나온다", JSON.stringify(Object.keys(toWriteBody({ memo: "m" }))) === '["memo"]');
  ck("undefined 는 버린다 (Firestore 동일)", !("memo" in toWriteBody({ memo: undefined })));
  // BookingModal 이 실제로 보내는 6개 필드
  const edit = toWriteBody({ customerName: "김", phone: PHONE, memo: "m", totalPrice: 1, guests: 3, options: [] });
  ck("BookingModal editData 6필드 전부 매핑", Object.keys(edit).length === 6 && edit.total_price === 1 && edit.guests === 3);

  // ── 2. 인증 — 무인증이면 401 ──
  console.log("\n[인증 — 미들웨어 + requireAuth 이중]");
  ck("POST /api/reservations 무인증 401", (await api("/api/reservations", { method: "POST", body: {}, auth: false })).status === 401);
  ck("PATCH /api/inventory-override 무인증 401", (await api("/api/inventory-override", { body: {}, auth: false })).status === 401);
  ck("PATCH /api/customers 무인증 401", (await api("/api/customers", { body: {}, auth: false })).status === 401);
  ck("DELETE /api/reservations 무인증 401", (await api("/api/reservations?id=x", { method: "DELETE", auth: false })).status === 401);

  // ── 3. 예약 생성 (스토어 addReservation 경로) ──
  console.log("\n[예약 생성 — addReservation 경로]");
  const body = toWriteBody({
    customerName: "테스트예약", phone: PHONE, roomName: ROOM,
    checkIn: D_IN, checkOut: D_OUT, guests: 2, status: "입금대기",
    source: "직접", totalPrice: 180000, memo: "이식 감사",
    options: [{ name: "숯불바베큐", price: 30000 }],
  });
  const c1 = await api("/api/reservations", { method: "POST", body });
  ck("201 생성", c1.status === 201, `status=${c1.status} ${JSON.stringify(c1.json).slice(0, 90)}`);
  const id1 = c1.json?.reservation?.id;
  if (id1) made.push(id1);
  ck("한글 필드 정상 저장 (customer_name)", c1.json?.reservation?.customer_name === "테스트예약", c1.json?.reservation?.customer_name);
  ck("옵션 저장됨", c1.json?.reservation?.options?.[0]?.name === "숯불바베큐");
  ck("알림 차단됨 (use_reservation=0)", JSON.stringify(c1.json?.notify || {}).includes("skip") || !c1.json?.notify?.telegram?.ok, JSON.stringify(c1.json?.notify).slice(0, 70));

  // ── 4. 고객 정보 (스토어 fire-and-forget 경로) ──
  console.log("\n[고객 — updateCustomerInfo 경로]");
  const cid = PHONE.replace(/[^0-9]/g, "");
  const cust0 = (await query(`SELECT * FROM customers WHERE id=?`, [cid])).results[0];
  const v1 = await api("/api/customers", {
    body: { op: "visit", reservation_id: id1, phone: PHONE, name: "테스트예약", room_name: ROOM, total_price: 180000 },
  });
  ck("visit 200", v1.status === 200, JSON.stringify(v1.json).slice(0, 80));
  const cust1 = (await query(`SELECT * FROM customers WHERE id=?`, [cid])).results[0];
  ck("방문 횟수 +1", cust1.visit_count === (cust0?.visit_count || 0) + 1, `${cust0?.visit_count || 0} → ${cust1.visit_count}`);
  ck("누적 금액 +180000", cust1.total_spent === (cust0?.total_spent || 0) + 180000);
  ck("예약 ID 배열에 append", JSON.parse(cust1.reservations || "[]").includes(id1));
  ck("선호 객실에 추가", JSON.parse(cust1.preferred_rooms || "[]").includes(ROOM));
  ck("등급 재계산됨 (NORMAL/VIP/VVIP)", ["NORMAL", "VIP", "VVIP"].includes(cust1.customer_grade), cust1.customer_grade);
  const cc = await api("/api/customers", { body: { op: "cancel", phone: PHONE } });
  const cust2 = (await query(`SELECT cancel_count FROM customers WHERE id=?`, [cid])).results[0];
  ck("cancel → 취소 횟수 +1", cc.status === 200 && cust2.cancel_count === (cust1.cancel_count || 0) + 1);
  ck("op 오타는 400", (await api("/api/customers", { body: { op: "nope", phone: PHONE } })).status === 400);

  // ── 5. 재고 override (스토어 updateInventoryOverride 경로) ──
  console.log("\n[재고 override — updateInventoryOverride 경로]");
  const OVID = `${D_IN}_${ROOM}`;
  ck("date 형식 오류 400", (await api("/api/inventory-override", { body: { date: "12/30", room_name: ROOM, available: 1 } })).status === 400);
  ck("room_name 누락 400", (await api("/api/inventory-override", { body: { date: D_IN, available: 1 } })).status === 400);
  ck("음수 400", (await api("/api/inventory-override", { body: { date: D_IN, room_name: ROOM, available: -1 } })).status === 400);
  ck("available 누락(undefined) 400 — 실수로 지우지 않게", (await api("/api/inventory-override", { body: { date: D_IN, room_name: ROOM } })).status === 400);
  const o1 = await api("/api/inventory-override", { body: { date: D_IN, room_name: ROOM, available: 7 } });
  const ovRow = (await query(`SELECT * FROM inventory_overrides WHERE id=?`, [OVID])).results[0];
  ck("저장 200", o1.status === 200);
  ck("stock 컬럼 = 7", ovRow?.stock === 7);
  ck("data.available = 7 (두 리더 동기화)", JSON.parse(ovRow.data).available === 7);
  ck("date/room_name 컬럼 채워짐", ovRow.date === D_IN && ovRow.room_name === ROOM);
  const o2 = await api("/api/inventory-override", { body: { date: D_IN, room_name: ROOM, available: null } });
  ck("null → 삭제 (기본 재고 복원)", o2.status === 200 && (await query(`SELECT 1 FROM inventory_overrides WHERE id=?`, [OVID])).results.length === 0);

  // ── 6. 취소 (스토어 cancelReservation 경로) + 중복 취소 알림 방지 ──
  console.log("\n[취소 — cancelReservation 경로]");
  const x1 = await api("/api/reservations", {
    body: { id: id1, cancel: true, ...toWriteBody({ cancelReason: "감사테스트", refundAmount: 100, cancellationFee: 200, refundRate: 90 }) },
  });
  ck("취소 200", x1.status === 200);
  ck("상태 = 예약취소", x1.json?.reservation?.status === "예약취소");
  ck("환불 정보 기록 (refund_rate=90)", x1.json?.reservation?.refund_rate === 90);
  ck("취소 사유 한글 저장", x1.json?.reservation?.cancel_reason === "감사테스트");
  const x2 = await api("/api/reservations", { body: { id: id1, cancel: true } });
  ck("이미 취소된 예약 재취소 → 알림 스킵 (중복 발송 방지)", x2.json?.notify?.skipped === "already_cancelled", JSON.stringify(x2.json?.notify));

  // ── 7. DELETE — 막기만 삭제 가능 ──
  console.log("\n[삭제 — 막기 전용 가드]");
  const del1 = await api(`/api/reservations?id=${id1}`, { method: "DELETE" });
  ck("일반 예약 삭제 거부 400 (실예약 보호)", del1.status === 400, JSON.stringify(del1.json).slice(0, 70));
  ck("거부 후에도 예약은 그대로 존재", (await query(`SELECT 1 FROM reservations WHERE id=?`, [id1])).results.length === 1);

  const blk = await api("/api/reservations", {
    method: "POST",
    body: toWriteBody({
      customerName: "관리자 막기 1", phone: "000-0000-0000", roomName: ROOM,
      checkIn: D_IN, checkOut: D_OUT, status: "예약확정", source: "막기",
      totalPrice: 0, memo: "감사", depositorName: "", options: [], guests: 0,
    }),
  });
  const id2 = blk.json?.reservation?.id;
  if (id2) made.push(id2);
  ck("막기 예약 생성 201", blk.status === 201, `status=${blk.status}`);
  const del2 = await api(`/api/reservations?id=${id2}`, { method: "DELETE" });
  ck("막기 예약 삭제 200", del2.status === 200, JSON.stringify(del2.json).slice(0, 60));
  ck("실제로 삭제됨", (await query(`SELECT 1 FROM reservations WHERE id=?`, [id2])).results.length === 0);
  if (id2) made.splice(made.indexOf(id2), 1);
  ck("없는 예약 삭제 404", (await api(`/api/reservations?id=zzz-nonexistent`, { method: "DELETE" })).status === 404);
} finally {
  // ── 정리: 정확한 ID 로만 ──
  console.log("\n[원상복구]");
  for (const id of made) {
    await query(`DELETE FROM reservation_options WHERE reservation_id=?`, [id]);
    await query(`DELETE FROM reservations WHERE id=?`, [id]);
  }
  await query(`DELETE FROM inventory_overrides WHERE id=?`, [`${D_IN}_${ROOM}`]);
  await query(`DELETE FROM admins WHERE email=?`, [EM]);

  // 고객: 원래 있던 행이면 **캡처한 원본으로 되돌리고**, 없던 행이면 삭제.
  // (행 수만 비교하면 "수정"을 놓친다 — 1회차 감사에서 실고객 이름이 덮인 원인)
  if (cust0Row) {
    await query(
      `UPDATE customers SET name=?, visit_count=?, total_spent=?, cancel_count=?, no_show_count=?,
              customer_grade=?, last_visit_date=?, first_visit_date=?, preferred_rooms=?,
              reservations=?, updated_at=? WHERE id=?`,
      [
        cust0Row.name, cust0Row.visit_count, cust0Row.total_spent, cust0Row.cancel_count,
        cust0Row.no_show_count, cust0Row.customer_grade, cust0Row.last_visit_date,
        cust0Row.first_visit_date, cust0Row.preferred_rooms, cust0Row.reservations,
        cust0Row.updated_at, CUST_ID,
      ],
    );
    const back = (await query(`SELECT * FROM customers WHERE id=?`, [CUST_ID])).results[0];
    ck(
      "실고객 행 원본 복구 (이름·방문·금액·취소·예약배열)",
      back.name === cust0Row.name &&
        back.visit_count === cust0Row.visit_count &&
        back.total_spent === cust0Row.total_spent &&
        back.cancel_count === cust0Row.cancel_count &&
        back.reservations === cust0Row.reservations,
      `${back.name} / 방문 ${back.visit_count} / ${back.total_spent}원 / 취소 ${back.cancel_count}`,
    );
  } else {
    await query(`DELETE FROM customers WHERE id=?`, [CUST_ID]);
  }
  await query(
    `UPDATE sms_config SET use_reservation=?, use_cancellation=?, updated_at=? WHERE business='choho'`,
    [cfg0.use_reservation, cfg0.use_cancellation, cfg0.updated_at],
  );

  const r = (await query(`SELECT COUNT(*) c FROM reservations`)).results[0].c;
  const c = (await query(`SELECT COUNT(*) c FROM customers`)).results[0].c;
  const o = (await query(`SELECT COUNT(*) c FROM inventory_overrides`)).results[0].c;
  const cfg1 = (await query(`SELECT * FROM sms_config WHERE business='choho'`)).results[0];
  ck(`예약 ${baseRes}건 복구`, r === baseRes, `현재 ${r}`);
  ck(`고객 ${baseCust}건 복구`, c === baseCust, `현재 ${c}`);
  ck(`override ${baseOv}건 복구`, o === baseOv, `현재 ${o}`);
  ck("알림 설정 원복", cfg1.use_reservation === cfg0.use_reservation && cfg1.use_cancellation === cfg0.use_cancellation);
  ck("임시 관리자 계정 제거", (await query(`SELECT 1 FROM admins WHERE email=?`, [EM])).results.length === 0);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
