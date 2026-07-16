// 기본 옵션 오버라이드 이관 감사 — 핵심 질문: **레이트 체크아웃이 다시 뜨는가?**
//
// 이 갭의 실제 증상: `late_checkout.roomStocks` 가 없으면 NewReservationModal:845 의
// `isAvailableForRoom(객실명)` 이 항상 false → **예약화면에서 옵션이 통째로 사라진다.**
// 그래서 API 응답만 보지 않고, 훅이 하는 계산을 그대로 재현해 객실별 노출을 대조한다.
//
// 안전: option_settings 는 이번에 만든 테이블이라 실예약과 무관. 쓰기 테스트는 원본 캡처 후 복구.
import fs from "node:fs";
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");
const { hashPassword } = await import("file:///F:/rv-chorigol.co.kr/lib/auth.js");
const B = "http://localhost:3900";

let pass = 0,
  fail = 0;
const ck = (n, c, x = "") => {
  console.log((c ? "  OK   " : "  FAIL ") + n + (x ? ` — ${x}` : ""));
  c ? pass++ : fail++;
};

// 원본 캡처 (쓰기 테스트 복구용)
const before = (await query(`SELECT id, data, updated_at FROM option_settings ORDER BY id`)).results;
console.log(`기준: option_settings ${before.length}행\n`);

const EM = "zz-optset@example.invalid",
  PW = "zz-" + Math.random().toString(36).slice(2) + "A1!";
let cookie = "";

try {
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

  // ── 1. 인증 ──
  console.log("\n[인증]");
  ck("GET 무인증 401", (await api("/api/option-settings", { auth: false })).status === 401);
  ck("PATCH 무인증 401", (await api("/api/option-settings", { method: "PATCH", body: {}, auth: false })).status === 401);

  // ── 2. GET — 레거시 settingsDoc.data() 와 같은 모양인가 ──
  console.log("\n[GET — 레거시 문서 모양]");
  const g = await api("/api/option-settings");
  ck("200", g.status === 200);
  const s = g.json.settings;
  ck("키 2개 (late_checkout, extra_person)", Object.keys(s).sort().join(",") === "extra_person,late_checkout", Object.keys(s).join(","));

  // 덤프 원본과 전건 대조
  const raw = JSON.parse(fs.readFileSync("F:/backup/choho-firestore-dump-20260716/settings.json", "utf8"));
  const src = (Array.isArray(raw) ? raw : Object.values(raw)).find((d) => (d._id || d.id) === "option_settings");
  for (const k of ["late_checkout", "extra_person"])
    ck(`${k} 원본 덤프와 전필드 일치`, JSON.stringify(s[k]) === JSON.stringify(src[k]));

  // ── 3. 핵심 — 훅 계산 재현: 레이트체크아웃이 어느 객실에 뜨는가 ──
  console.log("\n[레이트 체크아웃 노출 — useLateCheckoutSettings 재현]");
  // useOptionSettings.js 원문 그대로의 계산
  const lc = s?.late_checkout || { roomStocks: {} };
  const isAvailableForRoom = (r) => (lc.roomStocks?.[r] || 0) > 0;
  const availableRooms = Object.entries(lc.roomStocks || {})
    .filter(([, stock]) => stock > 0)
    .map(([room, stock]) => ({ room, stock }));

  ck("availableRooms 2개", availableRooms.length === 2, JSON.stringify(availableRooms));
  const rooms = (await query(`SELECT name FROM rooms ORDER BY sort_order`)).results.map((r) => r.name);
  console.log("  객실별 체크박스 노출 (NewReservationModal:845):");
  for (const r of rooms) console.log(`    ${isAvailableForRoom(r) ? "☑ 뜸  " : "☐ 안뜸"} ${r}`);
  ck("Forest 에 뜬다 (재고 1)", isAvailableForRoom("Forest"));
  ck("Forest mini 에 뜬다 (재고 2)", isAvailableForRoom("Forest mini"));
  ck("호수뷰객실엔 안 뜬다 (설정 없음)", !isAvailableForRoom("호수뷰객실"));
  ck("갭 상태(roomStocks 없음)였다면 전 객실 안 뜸 — 회귀 기준", rooms.every((r) => !((({}).roomStocks?.[r]) || 0) > 0));

  // ── 4. PATCH — 저장 ──
  console.log("\n[PATCH — 저장]");
  ck("id 누락 400", (await api("/api/option-settings", { method: "PATCH", body: { data: {} } })).status === 400);
  ck("data 가 배열이면 400", (await api("/api/option-settings", { method: "PATCH", body: { id: "x", data: [] } })).status === 400);

  const modified = { ...src.late_checkout, roomStocks: { ...src.late_checkout.roomStocks, Forest: 9 } };
  const p = await api("/api/option-settings", { method: "PATCH", body: { id: "late_checkout", data: modified } });
  ck("저장 200", p.status === 200);
  const g2 = await api("/api/option-settings");
  ck("저장값이 즉시 읽힌다 (Forest 9)", g2.json.settings.late_checkout.roomStocks.Forest === 9);
  ck("다른 키(extra_person)는 안 건드림", JSON.stringify(g2.json.settings.extra_person) === JSON.stringify(src.extra_person));
  ck("같은 키의 다른 필드 유지 (selectedRooms)", JSON.stringify(g2.json.settings.late_checkout.selectedRooms) === JSON.stringify(src.late_checkout.selectedRooms));

  const p2 = await api("/api/option-settings", { method: "PATCH", body: { id: "zz_new_key", data: { a: 1 } } });
  ck("새 키 생성됨 (upsert)", p2.status === 200 && (await api("/api/option-settings")).json.settings.zz_new_key?.a === 1);
  await query(`DELETE FROM option_settings WHERE id=?`, ["zz_new_key"]);
} finally {
  console.log("\n[원상복구]");
  await query(`DELETE FROM admins WHERE email=?`, [EM]);
  await query(`DELETE FROM option_settings WHERE id NOT IN (?, ?)`, ["late_checkout", "extra_person"]);
  for (const r of before)
    await query(
      `INSERT INTO option_settings (id, data, updated_at) VALUES (?1,?2,?3)
         ON CONFLICT(id) DO UPDATE SET data=?2, updated_at=?3`,
      [r.id, r.data, r.updated_at],
    );
  const after = (await query(`SELECT id, data FROM option_settings ORDER BY id`)).results;
  ck(`option_settings ${before.length}행 복구`, after.length === before.length, `${after.length}행`);
  ck(
    "값 전건 복구 (roomStocks 포함)",
    JSON.stringify(after.map((r) => [r.id, r.data])) === JSON.stringify(before.map((r) => [r.id, r.data])),
    JSON.parse(after.find((r) => r.id === "late_checkout").data).roomStocks &&
      JSON.stringify(JSON.parse(after.find((r) => r.id === "late_checkout").data).roomStocks),
  );
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
