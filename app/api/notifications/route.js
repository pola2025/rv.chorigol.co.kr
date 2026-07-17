// 알림 설정 쓰기 API — 템플릿 본문 / 객실 발송플래그 / 업체 발신설정.
// 시크릿(SENS 키·봇토큰)은 이 경로로 절대 쓰지 않는다 — 서버 env가 단일 소스.
import { NextResponse } from "next/server";
import {
  updateTemplateContent,
  setRoomFlags,
  updateSmsConfig,
  findUnknownVars,
  getNotificationSettingsDoc,
  saveNotificationSettingsDoc,
  TEMPLATE_KINDS,
} from "../../../lib/notifications.js";
import { requireAuth } from "../../../lib/auth-jwt.js";

export const dynamic = "force-dynamic";

const BUSINESSES = ["choho", "shelter"];

const bad = (msg, status = 400) =>
  NextResponse.json({ error: msg }, { status });

// 템플릿 본문 저장 — 미지원 변수는 발송 시점이 아니라 여기서 막는다.
async function saveTemplate({ id, content }) {
  if (!id) return bad("id 필요");
  if (typeof content !== "string" || !content.trim())
    return bad("템플릿 내용이 비어 있습니다");

  const unknown = findUnknownVars(content);
  if (unknown.length)
    return bad(
      `지원하지 않는 변수: ${unknown.join(" ")} — 이대로 저장하면 치환되지 않은 채 발송됩니다`,
    );

  const changes = await updateTemplateContent(id, content);
  if (!changes) return bad("템플릿 없음", 404);
  return NextResponse.json({ ok: true, changes });
}

// 객실 발송 플래그 — 해당 객실의 4개 kind 행에 함께 적용 (lib에서 처리)
async function saveRoomFlags({ business, room_name, flags }) {
  if (!BUSINESSES.includes(business)) return bad("업체 값 오류");
  if (!room_name) return bad("room_name 필요");
  if (!flags) return bad("flags 필요");

  const changes = await setRoomFlags(business, room_name, flags);
  if (!changes) return bad("객실 템플릿 없음", 404);
  return NextResponse.json({ ok: true, changes });
}

// 업체 발신 설정 (발신번호·채널ID·발송 사용여부)
async function saveSmsConfig(body) {
  const { business, telegram_chat_id, use_reservation, use_cancellation } =
    body;
  if (!BUSINESSES.includes(business)) return bad("업체 값 오류");

  const sms_from = String(body.sms_from ?? "").replace(/-/g, "");
  if (!/^0\d{8,10}$/.test(sms_from))
    return bad("발신번호 형식 오류 (숫자만, 예: 01079320029)");
  if (!/^-?\d+$/.test(String(telegram_chat_id ?? "")))
    return bad("텔레그램 채널ID 형식 오류 (예: -1002484830636)");

  const changes = await updateSmsConfig(business, {
    sms_from,
    telegram_chat_id: String(telegram_chat_id),
    use_reservation,
    use_cancellation,
  });
  if (!changes) return bad("업체 설정 없음", 404);
  return NextResponse.json({ ok: true, changes });
}

// 레거시 화면(NotificationSettingsV2)이 문서를 통째로 저장하는 경로.
// 저장 3경로(전역/객실1개/전체)가 전부 setDoc 이라 여기 하나로 받는다.
async function saveSettingsDoc(body) {
  const { business, globalSettings, roomSettings } = body;
  if (!BUSINESSES.includes(business)) return bad("업체 값 오류");
  if (!globalSettings || !roomSettings)
    return bad("globalSettings·roomSettings 필요");

  const smsFrom = String(globalSettings.sens?.from ?? "").replace(/-/g, "");
  if (!/^0\d{8,10}$/.test(smsFrom))
    return bad("발신번호 형식 오류 (숫자만, 예: 01079320029)");
  if (!/^-?\d+$/.test(String(globalSettings.telegram?.chatId ?? "")))
    return bad("텔레그램 채널ID 형식 오류 (예: -1002484830636)");

  // 미지원 변수는 **발송 시점이 아니라 저장 시점에** 막는다.
  // 3월 사고(영문 변수로 4개월간 미치환 발송)는 발송 시점 검사만 있어서 안 잡혔다.
  for (const [roomName, rs] of Object.entries(roomSettings)) {
    for (const kind of TEMPLATE_KINDS) {
      const t = rs?.templates?.[kind];
      if (!t) continue;
      const content = typeof t === "object" ? (t.content ?? "") : String(t);
      if (!content.trim()) continue;
      const unknown = findUnknownVars(content);
      if (unknown.length)
        return bad(
          `[${roomName} / ${kind}] 지원하지 않는 변수: ${unknown.join(" ")} — 이대로 저장하면 치환되지 않은 채 발송됩니다`,
        );
    }
  }

  const rows = await saveNotificationSettingsDoc(business, {
    globalSettings,
    roomSettings,
  });
  return NextResponse.json({ ok: true, rows });
}

// 레거시 문서 모양 조회 (시크릿 제외)
export async function GET(request) {
  if (!(await requireAuth(request))) return bad("인증 필요", 401);
  const business = new URL(request.url).searchParams.get("business");
  if (!BUSINESSES.includes(business)) return bad("업체 값 오류");
  try {
    return NextResponse.json(await getNotificationSettingsDoc(business));
  } catch (e) {
    return NextResponse.json(
      { error: "조회 실패", detail: e.message },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  if (!(await requireAuth(request))) return bad("인증 필요", 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return bad("잘못된 요청 본문");
  }

  try {
    if (body.action === "template") return await saveTemplate(body);
    if (body.action === "roomFlags") return await saveRoomFlags(body);
    if (body.action === "smsConfig") return await saveSmsConfig(body);
    if (body.action === "settingsDoc") return await saveSettingsDoc(body);
    return bad("action 필요 (template | roomFlags | smsConfig | settingsDoc)");
  } catch (e) {
    return NextResponse.json(
      { error: "저장 실패", detail: e.message },
      { status: 500 },
    );
  }
}
