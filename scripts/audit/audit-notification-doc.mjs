// 알림설정 역매퍼·정매퍼 감사 — D1 ↔ 레거시 문서 모양 왕복 대조 (2026-07-17)
//
// 이식의 전제: 레거시 화면은 settings/notifications_v2_{business} **문서 모양**을 기대한다.
// 역매퍼 출력이 원본 Firestore 덤프와 **전필드 일치**해야 화면이 안 깨진다.
// (legacy-shape.js 가 18/18 대조로 검증됐던 것과 같은 방식)
//
// ⚠️ 쓰기 테스트는 D1 실데이터를 건드린다 → 원본 전체를 캡처하고 finally 에서 행 단위 복구.
//    (교훈 2026-07-16: COUNT(*) 검증은 "생성"만 잡고 "수정"을 못 잡는다)
import fs from "node:fs";
const { query } = await import("file:///F:/rv-chorigol.co.kr/lib/d1.js");
const { getNotificationSettingsDoc, saveNotificationSettingsDoc } = await import(
  "file:///F:/rv-chorigol.co.kr/lib/notifications.js"
);

const DUMP = "F:/backup/choho-firestore-dump-20260716/settings.json";
const raw = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const docs = Array.isArray(raw) ? raw : Object.values(raw);
const getDump = (id) => docs.find((d) => (d._id || d.id) === id);

let pass = 0,
  fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${detail}`);
  }
};

// ── 1. 역매퍼: D1 → 문서 모양이 덤프와 일치하는가 ──
console.log("[1] 역매퍼 — 덤프 전필드 대조");
for (const business of ["choho", "shelter"]) {
  const src = getDump(`notifications_v2_${business}`);
  const got = await getNotificationSettingsDoc(business);

  // globalSettings.telegram — 시크릿(botToken) 제외
  const st = src.globalSettings.telegram;
  const gt = got.globalSettings.telegram;
  ok(`${business} telegram.chatId`, gt.chatId === st.chatId, `${gt.chatId} != ${st.chatId}`);
  ok(`${business} telegram.useReservation`, gt.useReservation === (st.useReservation !== false));
  ok(`${business} telegram.useCancellation`, gt.useCancellation === (st.useCancellation !== false));
  ok(`${business} telegram.autoSendDaily`, gt.autoSendDaily === (st.autoSendDaily !== false));
  // 발신번호는 D1 에 하이픈 없이 저장된다 (쓰기에서 정규화) → 덤프값도 같은 규칙으로 비교
  const srcFrom = String(src.globalSettings.sens.from ?? "").replace(/-/g, "");
  ok(
    `${business} sens.from`,
    got.globalSettings.sens.from === srcFrom,
    `${got.globalSettings.sens.from} != ${srcFrom}`,
  );

  // 시크릿이 새어나오지 않는가 (이식의 목적)
  ok(`${business} 시크릿 미유출 (botToken)`, gt.botToken === "");
  ok(`${business} 시크릿 미유출 (accessKey/secretKey/serviceId)`,
    got.globalSettings.sens.accessKey === "" &&
    got.globalSettings.sens.secretKey === "" &&
    got.globalSettings.sens.serviceId === "");

  // roomSettings 전건
  const srcRooms = Object.keys(src.roomSettings || {}).sort();
  const gotRooms = Object.keys(got.roomSettings || {}).sort();
  ok(`${business} 객실 목록 일치 (${srcRooms.length}개)`,
    JSON.stringify(srcRooms) === JSON.stringify(gotRooms),
    `${JSON.stringify(gotRooms)} != ${JSON.stringify(srcRooms)}`);

  for (const room of srcRooms) {
    const s = src.roomSettings[room];
    const g = got.roomSettings[room];
    if (!g) continue;
    ok(`${business}/${room} enabled`, g.enabled === !!s.enabled);
    for (const k of ["checkInEnabled", "checkOutEnabled", "confirmationEnabled", "cancellationEnabled"]) {
      ok(`${business}/${room} autoSend.${k}`, g.autoSend[k] === !!s.autoSend?.[k],
        `${g.autoSend[k]} != ${!!s.autoSend?.[k]}`);
    }
    for (const k of ["checkInHoursBefore", "checkOutHoursBefore"]) {
      ok(`${business}/${room} autoSend.${k}`, g.autoSend[k] === s.autoSend?.[k],
        `${g.autoSend[k]} != ${s.autoSend?.[k]}`);
    }
    for (const kind of Object.keys(s.templates || {})) {
      const st2 = s.templates[kind];
      const gt2 = g.templates?.[kind];
      ok(`${business}/${room}/${kind} content`, gt2?.content === st2.content);
      ok(`${business}/${room}/${kind} title`, gt2?.title === (st2.title ?? ""));
    }
  }
}

// ── 2. 왕복: 읽은 걸 그대로 저장하면 값이 안 변해야 한다 ──
console.log("\n[2] 왕복 무변경 — read → save → read 가 동일한가");
const before = await query(
  `SELECT business, room_name, kind, content, title, enabled, confirmation_enabled,
          checkin_enabled, checkout_enabled, cancellation_enabled,
          checkin_hours_before, checkout_hours_before
   FROM room_templates ORDER BY business, room_name, kind`,
);
const cfgBefore = await query(`SELECT * FROM sms_config ORDER BY business`);
fs.writeFileSync(
  "scripts/audit/.notification-doc-before.json",
  JSON.stringify({ rows: before.results, cfg: cfgBefore.results }, null, 2),
);

try {
  for (const business of ["choho", "shelter"]) {
    const doc = await getNotificationSettingsDoc(business);
    await saveNotificationSettingsDoc(business, doc);
  }
  const after = await query(
    `SELECT business, room_name, kind, content, title, enabled, confirmation_enabled,
            checkin_enabled, checkout_enabled, cancellation_enabled,
            checkin_hours_before, checkout_hours_before
     FROM room_templates ORDER BY business, room_name, kind`,
  );
  ok("room_templates 왕복 무변경",
    JSON.stringify(before.results) === JSON.stringify(after.results));

  const cfgAfter = await query(`SELECT * FROM sms_config ORDER BY business`);
  // updated_at 은 바뀌는 게 정상 → 제외하고 대조
  const strip = (r) => r.map(({ updated_at, ...x }) => x);
  ok("sms_config 왕복 무변경 (updated_at 제외)",
    JSON.stringify(strip(cfgBefore.results)) === JSON.stringify(strip(cfgAfter.results)));

  // 시크릿 컬럼이 왕복으로 지워지지 않았는가 (원래 NULL 이지만 덮어쓰면 안 된다)
  const secretsSame = JSON.stringify(cfgBefore.results.map(r => [r.sens_service_id, r.sens_access_key, r.sens_secret_key, r.telegram_bot_token]))
    === JSON.stringify(cfgAfter.results.map(r => [r.sens_service_id, r.sens_access_key, r.sens_secret_key, r.telegram_bot_token]));
  ok("시크릿 컬럼 무변경 (쓰기가 건드리지 않는다)", secretsSame);
} finally {
  // ── 복구: 캡처한 원본으로 행 단위 되돌리기 ──
  console.log("\n[복구] 원본으로 되돌리는 중...");
  for (const r of before.results) {
    await query(
      `UPDATE room_templates SET content=?, title=?, enabled=?, confirmation_enabled=?,
         checkin_enabled=?, checkout_enabled=?, cancellation_enabled=?,
         checkin_hours_before=?, checkout_hours_before=?
       WHERE business=? AND room_name=? AND kind=?`,
      [r.content, r.title, r.enabled, r.confirmation_enabled, r.checkin_enabled,
       r.checkout_enabled, r.cancellation_enabled, r.checkin_hours_before,
       r.checkout_hours_before, r.business, r.room_name, r.kind],
    );
  }
  for (const c of cfgBefore.results) {
    await query(
      `UPDATE sms_config SET sms_from=?, telegram_chat_id=?, use_reservation=?,
         use_cancellation=?, auto_send_daily=?, updated_at=? WHERE business=?`,
      [c.sms_from, c.telegram_chat_id, c.use_reservation, c.use_cancellation,
       c.auto_send_daily, c.updated_at, c.business],
    );
  }
  const restored = await query(
    `SELECT business, room_name, kind, content, title, enabled, confirmation_enabled,
            checkin_enabled, checkout_enabled, cancellation_enabled,
            checkin_hours_before, checkout_hours_before
     FROM room_templates ORDER BY business, room_name, kind`,
  );
  const rOk = JSON.stringify(before.results) === JSON.stringify(restored.results);
  console.log(rOk ? "  ✅ 복구 검증 통과 (행 단위 전건 일치)" : "  ❌ 복구 실패!");
  if (!rOk) process.exitCode = 1;
}

console.log(`\n=== ${pass}/${pass + fail} 통과 ===`);
if (fail) process.exitCode = 1;
