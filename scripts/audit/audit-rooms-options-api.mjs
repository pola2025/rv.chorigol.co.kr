// rooms / options / pricing_rules 쓰기 API 감사.
//
// 핵심 질문 2개 — 레거시에서 **한 번도 동작하지 않던 가드**가 이제 실제로 걸리는가:
//   1) 객실명 변경 차단 (레거시: 예약이 안 따라가 고아가 됨)
//   2) 활성 예약 있는 객실 삭제 거부 (레거시: `r.room` 없는 필드로 걸러 가드가 무력)
//
// 안전: 실데이터를 건드리지 않도록 **zz- 접두 테스트 객실/옵션**만 만들고 정확한 ID 로만 지운다.
//       실객실(Forest 등)은 **읽기만** 한다.
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");
const { hashPassword } = await import("file:///F:/rv-chorigol.co.kr/lib/auth.js");
const { toRoomWriteBody, toOptionWriteBody } = await import(
  "file:///F:/rv-chorigol.co.kr/lib/legacy-write-shape.js"
);
const B = "http://localhost:3900";

let pass = 0,
  fail = 0;
const ck = (n, c, x = "") => {
  console.log((c ? "  OK   " : "  FAIL ") + n + (x ? ` — ${x}` : ""));
  c ? pass++ : fail++;
};
const made = { rooms: [], options: [], rules: [] };

const baseRooms = (await query(`SELECT COUNT(*) c FROM rooms`)).results[0].c;
const baseOpts = (await query(`SELECT COUNT(*) c FROM options`)).results[0].c;
const baseRules = (await query(`SELECT COUNT(*) c FROM pricing_rules`)).results[0].c;
console.log(`기준: rooms ${baseRooms} · options ${baseOpts} · pricing_rules ${baseRules}\n`);

const EM = "zz-rooms@example.invalid",
  PW = "zz-" + Math.random().toString(36).slice(2) + "A1!";
let cookie = "";

try {
  await query(`DELETE FROM admins WHERE email=?`, [EM]);
  await query(`INSERT INTO admins (email,password_hash,is_active,created_at) VALUES (?,?,1,?)`, [
    EM,
    hashPassword(PW),
    new Date().toISOString(),
  ]);
  const lr = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EM, password: PW }),
  });
  cookie = (lr.headers.get("set-cookie") || "").split(";")[0];
  ck("로그인", lr.ok && !!cookie);

  const api = async (path, { method = "GET", body, auth = true } = {}) => {
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

  // ── 인증 ──
  console.log("\n[인증 — 4개 엔드포인트]");
  for (const p of ["/api/rooms", "/api/options", "/api/pricing-rules"])
    ck(`POST ${p} 무인증 401`, (await api(p, { method: "POST", body: {}, auth: false })).status === 401);
  ck("DELETE /api/rooms 무인증 401", (await api("/api/rooms?id=x", { method: "DELETE", auth: false })).status === 401);

  // ── 객실 생성 (한글 폼 → 매퍼 → API) ──
  console.log("\n[객실 생성 — 레거시 한글 폼 그대로]");
  const form = {
    객실명: "zz-테스트객실", 기본요금: 100000, 주중요금: 90000, 주말요금: 120000,
    기준인원: 2, 최대인원: 4, 추가인원요금: 15000, 기본재고: 3, 설명: "감사용", order: 99,
  };
  const c1 = await api("/api/rooms", { method: "POST", body: toRoomWriteBody(form) });
  ck("201 생성", c1.status === 201, JSON.stringify(c1.json).slice(0, 80));
  const rid = c1.json?.room?.id;
  if (rid) made.rooms.push(rid);
  ck("한글 필드 매핑 (객실명 → name)", c1.json?.room?.name === "zz-테스트객실");
  ck("재고 = 기본재고 (레거시 동일)", c1.json?.room?.stock === 3 && c1.json?.room?.base_stock === 3);
  ck("business 자동 판정 (Forest 없음 → shelter)", c1.json?.room?.business === "shelter", c1.json?.room?.business);
  ck("중복 객실명 400 + 레거시 문구", await api("/api/rooms", { method: "POST", body: toRoomWriteBody(form) }).then((r) => r.status === 400 && r.json.error.includes("이미 존재하는 객실명입니다")));
  ck("객실명 없으면 400", (await api("/api/rooms", { method: "POST", body: {} })).status === 400);

  // ── 🔑 객실명 변경 차단 ──
  console.log("\n[🔑 객실명 변경 차단 — 레거시는 예약이 안 따라가 고아가 됐다]");
  const rn = await api("/api/rooms", { method: "PATCH", body: { id: rid, ...toRoomWriteBody({ 객실명: "zz-다른이름" }) } });
  ck("rename 요청 400 (조용히 무시하지 않는다)", rn.status === 400, JSON.stringify(rn.json).slice(0, 70));
  ck("이름 그대로", (await api(`/api/rooms?id=${rid}`)).json.room.name === "zz-테스트객실");
  ck("같은 이름 재전송은 통과 (변경 아님)", (await api("/api/rooms", { method: "PATCH", body: { id: rid, ...toRoomWriteBody({ 객실명: "zz-테스트객실", 기본요금: 111 }) } })).status === 200);

  // ── 객실 수정 ──
  console.log("\n[객실 수정]");
  const u1 = await api("/api/rooms", { method: "PATCH", body: { id: rid, ...toRoomWriteBody({ 기본요금: 150000 }) } });
  ck("요금 수정", u1.json?.room?.base_price === 150000);
  const u2 = await api("/api/rooms", { method: "PATCH", body: { id: rid, ...toRoomWriteBody({ 기본재고: 7 }) } });
  ck("기본재고 바꾸면 재고도 같이 (레거시 saveInlineEdit:333)", u2.json?.room?.base_stock === 7 && u2.json?.room?.stock === 7, `stock=${u2.json?.room?.stock}`);
  const u3 = await api("/api/rooms", { method: "PATCH", body: { id: rid, ...toRoomWriteBody({ isActive: false }) } });
  ck("isActive 토글", u3.json?.room?.is_active === 0);
  ck("없는 객실 404", (await api("/api/rooms", { method: "PATCH", body: { id: "zz-none" } })).status === 404);

  // ── 🔑 활성 예약 있는 객실 삭제 거부 ──
  console.log("\n[🔑 활성 예약 있는 객실 삭제 거부 — 레거시 가드는 한 번도 안 걸렸다]");
  const forest = (await query(`SELECT id, name FROM rooms WHERE name='Forest'`)).results[0];
  const cnt = (await query(`SELECT COUNT(*) c FROM reservations WHERE room_name='Forest' AND COALESCE(status,'')!='예약취소'`)).results[0].c;
  const d1 = await api(`/api/rooms?id=${forest.id}`, { method: "DELETE" });
  ck(`실객실 Forest(활성예약 ${cnt}건) 삭제 거부 409`, d1.status === 409, JSON.stringify(d1.json).slice(0, 80));
  ck("거부 후 Forest 그대로 존재", (await query(`SELECT 1 FROM rooms WHERE id=?`, [forest.id])).results.length === 1);
  ck("예약 없는 테스트 객실은 삭제됨", (await api(`/api/rooms?id=${rid}`, { method: "DELETE" })).status === 200);
  ck("실제로 사라짐", (await query(`SELECT 1 FROM rooms WHERE id=?`, [rid])).results.length === 0);
  made.rooms = made.rooms.filter((x) => x !== rid);

  // ── 옵션 ──
  console.log("\n[옵션]");
  const o1 = await api("/api/options", {
    method: "POST",
    body: toOptionWriteBody({ name: "zz-테스트옵션", type: "service", price: 5000, applicableRooms: "selected", selectedRooms: ["Forest"], roomStocks: { Forest: 2 }, isDefault: true }),
  });
  ck("201 생성", o1.status === 201, JSON.stringify(o1.json).slice(0, 70));
  const oid = o1.json?.option?.id;
  if (oid) made.options.push(oid);
  ck("JSON 컬럼 직렬화 (selected_rooms)", JSON.parse(o1.json.option.selected_rooms)[0] === "Forest");
  ck("roomStocks → room_stocks JSON", JSON.parse(o1.json.option.room_stocks).Forest === 2);
  ck("isDefault 는 버려진다 (option_settings 로 가야 함)", !("is_default" in o1.json.option));
  const o2 = await api("/api/options", { method: "PATCH", body: { id: oid, ...toOptionWriteBody({ price: 7000 }) } });
  ck("수정", o2.json?.option?.price === 7000);
  ck("삭제", (await api(`/api/options?id=${oid}`, { method: "DELETE" })).status === 200);
  made.options = made.options.filter((x) => x !== oid);

  // ── 요금 규칙 ──
  console.log("\n[시즌 요금 규칙 — data JSON 통째 보존 규약]");
  const p1 = await api("/api/pricing-rules", {
    method: "POST",
    body: { name: "zz-테스트시즌", roomName: "all", startDate: "2027-01-01", endDate: "2027-01-05", weekdayPrices: { Forest: 1000 } },
  });
  ck("201 생성", p1.status === 201, JSON.stringify(p1.json).slice(0, 70));
  const pid = p1.json?.rule?.id;
  if (pid) made.rules.push(pid);
  ck("room_name 발췌 (조회용)", p1.json?.rule?.room_name === "all");
  ck("data 에 원본 통째 보존", JSON.parse(p1.json.rule.data).weekdayPrices.Forest === 1000);
  ck("isActive 기본 true (레거시 동일)", JSON.parse(p1.json.rule.data).isActive === true);
  const p2 = await api("/api/pricing-rules", { method: "PATCH", body: { id: pid, name: "zz-수정됨" } });
  const pd = JSON.parse(p2.json.rule.data);
  ck("부분 수정이 머지된다 (안 보낸 필드 유지)", pd.name === "zz-수정됨" && pd.weekdayPrices?.Forest === 1000, JSON.stringify(pd).slice(0, 70));
  ck("삭제", (await api(`/api/pricing-rules?id=${pid}`, { method: "DELETE" })).status === 200);
  made.rules = made.rules.filter((x) => x !== pid);

  // ── 역매퍼 왕복: 쓴 게 화면 모양으로 되돌아오는가 ──
  console.log("\n[왕복 — 쓰기 → 역매퍼 → 화면 모양]");
  const { toRoom } = await import("file:///F:/rv-chorigol.co.kr/lib/legacy-shape.js");
  const back = toRoom((await query(`SELECT * FROM rooms WHERE name='Forest'`)).results[0]);
  ck("toRoom 이 한글 필드로 되돌린다", back.객실명 === "Forest" && typeof back.기본요금 === "number", `${back.객실명} / ${back.기본요금}원 / 재고 ${back.재고}`);
} finally {
  console.log("\n[원상복구 — 정확한 ID 로만]");
  for (const id of made.rooms) await query(`DELETE FROM rooms WHERE id=?`, [id]);
  for (const id of made.options) await query(`DELETE FROM options WHERE id=?`, [id]);
  for (const id of made.rules) await query(`DELETE FROM pricing_rules WHERE id=?`, [id]);
  await query(`DELETE FROM admins WHERE email=?`, [EM]);
  const r = (await query(`SELECT COUNT(*) c FROM rooms`)).results[0].c;
  const o = (await query(`SELECT COUNT(*) c FROM options`)).results[0].c;
  const p = (await query(`SELECT COUNT(*) c FROM pricing_rules`)).results[0].c;
  ck(`rooms ${baseRooms}건 복구`, r === baseRooms, `${r}건`);
  ck(`options ${baseOpts}건 복구`, o === baseOpts, `${o}건`);
  ck(`pricing_rules ${baseRules}건 복구`, p === baseRules, `${p}건`);
  const zz = (await query(`SELECT COUNT(*) c FROM rooms WHERE name LIKE 'zz-%'`)).results[0].c;
  ck("테스트 잔여물 0", zz === 0);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
