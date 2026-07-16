// Firestore 트리거: 예약 문서 생성/수정 시 서버에서 알림 자동 발송
// 브라우저(프론트엔드)와 완전히 독립적으로 동작
import * as functions from "firebase-functions";
import admin from "firebase-admin";
import fetch from "node-fetch";

const db = admin.firestore();

// 호수뷰객실 전용 채널
const LAKE_VIEW_CHAT_ID = "-1002863320782";

// ─── 헬퍼 ───

// 텔레그램 메시지 직접 발송 (서버사이드)
async function sendTelegramMessage(text, targetChatId = null) {
  const [settingsDoc, secureDoc] = await Promise.all([
    db.collection("settings").doc("notifications_v2_choho").get(),
    db.collection("settings").doc("secure_credentials").get(),
  ]);

  if (!secureDoc.exists) throw new Error("보안 설정 없음");

  const secureData = secureDoc.data();
  const settings = settingsDoc.exists ? settingsDoc.data() : {};
  const botToken = secureData?.choho?.telegram?.botToken;
  const defaultChatId = settings?.globalSettings?.telegram?.chatId;
  const chatId = targetChatId || defaultChatId;

  if (!botToken || !chatId) throw new Error("봇 토큰 또는 채팅 ID 없음");

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );

  const result = await res.json();
  if (!result.ok) throw new Error(result.description || "텔레그램 발송 실패");

  // 로그 저장
  await db
    .collection("notification_logs")
    .add({
      type: "telegram_trigger",
      chatId,
      messagePreview: text.substring(0, 100),
      status: "success",
      messageId: result.result.message_id,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return result;
}

// 알림 설정 로드
async function getNotificationSettings(roomName) {
  const isChoho =
    roomName && roomName.includes("Forest") && !roomName.includes("호수뷰");
  const docName = isChoho
    ? "notifications_v2_choho"
    : "notifications_v2_shelter";

  const settingsDoc = await db.collection("settings").doc(docName).get();
  if (!settingsDoc.exists) return null;

  const settings = settingsDoc.data();
  const roomSettings = settings.roomSettings?.[roomName] || null;

  return {
    global: settings.globalSettings || {},
    room: roomSettings,
    type: isChoho ? "choho" : "shelter",
  };
}

// 예약출처 한글 변환
function getSourceName(source) {
  const map = {
    naver_place: "네이버 플레이스",
    naver_booking: "네이버 펜션예약",
    naver_map: "네이버 지도",
    transfer: "이체예약",
    group: "단체예약",
    etc: "기타",
    막기: "관리자 막기",
    "네이버 플레이스": "네이버 플레이스",
    "네이버 펜션예약": "네이버 펜션예약",
    "네이버 지도": "네이버 지도",
    이체예약: "이체예약",
    단체예약: "단체예약",
    기타: "기타",
  };
  return map[source] || source || "기타";
}

// 박수 계산
function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) || 1;
}

// 객실 기준인원
function getBaseGuests(roomName) {
  if (!roomName) return 2;
  const name = roomName.toLowerCase();
  if (
    (name.includes("forest") && name.includes("패밀리")) ||
    name.includes("호수뷰")
  )
    return 4;
  if (name.includes("forest_mini") && name.includes("패밀리")) return 2;
  return 2;
}

// 객실 추가요금
function getExtraGuestFee(roomName) {
  const rooms = {
    Forest: 20000,
    "Forest mini": 0,
    "Forest 패밀리": 0,
    "Forest mini 패밀리": 0,
    호수뷰객실: 20000,
  };
  return rooms[roomName] ?? 20000;
}

// 호수뷰객실이면 추가 채널로도 발송
async function sendWithLakeView(message, roomName) {
  await sendTelegramMessage(message);
  if (roomName && roomName.includes("호수뷰")) {
    await sendTelegramMessage(message, LAKE_VIEW_CHAT_ID).catch((e) =>
      console.error("호수뷰 추가 채널 발송 실패:", e.message),
    );
  }
}

// ─── 메시지 포맷 ───

function formatNewReservationMessage(data) {
  const sourceName = getSourceName(data.source);

  // 옵션 파싱
  let includedOptions = [];
  let onsiteOptions = [];
  if (data.options?.length > 0) {
    data.options.forEach((opt) => {
      const name = typeof opt === "object" ? opt.name : opt;
      const price = typeof opt === "object" ? opt.price || 0 : 0;
      if (!name) return;

      if (name === "숯불바베큐" || name === "charcoal_bbq") {
        onsiteOptions.push({ name: "숯불바베큐", price: price || 30000 });
      } else if (name === "캠핑버너&그릴" || name === "camping_burner") {
        includedOptions.push({ name: "캠핑버너&그릴", price: price || 20000 });
      } else if (name === "레이트 체크아웃" || name === "late_checkout") {
        includedOptions.push({ name: "레이트 체크아웃", price: 0 });
      } else {
        includedOptions.push({ name, price });
      }
    });
  }

  let msg = `🆕 새 예약\n\n`;
  msg += `고객명: ${data.customerName}\n`;
  msg += `연락처: ${data.phone || ""}\n`;
  msg += `객실: ${data.roomName}\n`;
  msg += `일정: ${data.checkIn} ~ ${data.checkOut}\n`;
  msg += `인원: ${data.guests || 2}명\n`;
  msg += `금액: ${(data.totalPrice || 0).toLocaleString()}원\n`;
  msg += `예약출처: ${sourceName}\n`;
  msg += `상태: ${data.status || "입금대기"}`;

  if (includedOptions.length > 0) {
    msg += `\n\n📦 옵션:\n`;
    includedOptions.forEach((opt) => {
      msg +=
        opt.price > 0
          ? `• ${opt.name}: ${opt.price.toLocaleString()}원\n`
          : `• ${opt.name}\n`;
    });
  }

  if (onsiteOptions.length > 0) {
    const onsiteTotal = onsiteOptions.reduce((sum, o) => sum + o.price, 0);
    msg += `\n💳 현장결제:\n`;
    onsiteOptions.forEach((opt) => {
      msg += `• ${opt.name}: ${opt.price.toLocaleString()}원\n`;
    });
    msg += `현장결제 합계: ${onsiteTotal.toLocaleString()}원`;
  }

  if (data.memo?.trim()) {
    msg += `\n\n📝 특이사항:\n${data.memo}`;
  }

  return msg;
}

function formatConfirmationMessage(data) {
  const nights = calculateNights(data.checkIn, data.checkOut);
  const baseGuests = getBaseGuests(data.roomName);
  const extraGuests = Math.max(0, (data.guests || baseGuests) - baseGuests);
  const extraGuestFee = getExtraGuestFee(data.roomName);
  const extraGuestPrice =
    data.extraGuestPrice ?? extraGuests * extraGuestFee * nights;

  let includedOptions = [];
  let onsiteOptions = [];
  let includedOptionPrice = 0;

  if (data.options?.length > 0) {
    data.options.forEach((opt) => {
      const name = typeof opt === "object" ? opt.name : opt;
      const price = typeof opt === "object" ? opt.price || 0 : 0;
      if (!name) return;

      if (name === "숯불바베큐" || name === "charcoal_bbq") {
        onsiteOptions.push({ name: "숯불바베큐", price: price || 30000 });
      } else if (name === "캠핑버너&그릴" || name === "camping_burner") {
        includedOptions.push({ name: "캠핑버너&그릴", price: price || 20000 });
        includedOptionPrice += price || 20000;
      } else if (name === "레이트 체크아웃" || name === "late_checkout") {
        includedOptions.push({ name: "레이트 체크아웃", price: 0 });
      }
    });
  }

  const basePrice =
    data.basePrice ||
    data.totalPrice - extraGuestPrice - includedOptionPrice ||
    data.totalPrice;

  let msg = `🎉 <b>새 예약이 확정되었습니다!</b>\n\n`;
  msg += `📅 날짜: ${data.checkIn} ~ ${data.checkOut} (${nights}박)\n`;
  msg += `🏠 객실: ${data.roomName}\n`;
  msg += `👤 예약자: ${data.customerName}\n`;
  msg += `📞 연락처: ${data.phone}\n`;
  msg += `👥 인원: ${data.guests}명`;
  if (extraGuests > 0 && extraGuestPrice > 0)
    msg += ` (기준 ${baseGuests}명 + 추가 ${extraGuests}명)`;
  msg += "\n";

  msg += `\n💰 <b>결제 정보</b>\n────────────────\n`;
  msg += `객실 요금: ${basePrice.toLocaleString()}원\n`;
  if (extraGuests > 0 && extraGuestPrice > 0) {
    msg += `인원 추가: ${extraGuestPrice.toLocaleString()}원 (${extraGuests}명 × ${nights}박)\n`;
  }

  if (includedOptions.length > 0) {
    msg += `\n📦 <b>포함 옵션</b>\n`;
    includedOptions.forEach((opt) => {
      msg +=
        opt.price > 0
          ? `• ${opt.name}: ${opt.price.toLocaleString()}원\n`
          : `• ${opt.name}\n`;
    });
  }

  msg += `────────────────\n`;
  msg += `<b>총 결제금액: ${(data.totalPrice || 0).toLocaleString()}원</b>\n`;

  if (onsiteOptions.length > 0) {
    const onsiteTotal = onsiteOptions.reduce((sum, o) => sum + o.price, 0);
    msg += `\n💳 <b>현장 결제</b>\n────────────────\n`;
    onsiteOptions.forEach((opt) => {
      msg += `• ${opt.name}: ${opt.price.toLocaleString()}원\n`;
    });
    msg += `────────────────\n<b>현장 결제금액: ${onsiteTotal.toLocaleString()}원</b>\n`;
  }

  msg += `\n📍 출처: ${getSourceName(data.source)}`;
  if (data.memo?.trim())
    msg += `\n\n📝 <b>메모</b>\n────────────────\n${data.memo}`;
  msg += `\n\n#예약확정 #${data.roomName.replace(/\s/g, "")}`;

  return msg;
}

function formatCancellationMessage(data) {
  const nights = calculateNights(data.checkIn, data.checkOut);
  const baseGuests = getBaseGuests(data.roomName);
  const extraGuests = Math.max(0, (data.guests || baseGuests) - baseGuests);
  const extraGuestFee = getExtraGuestFee(data.roomName);
  const extraGuestPrice =
    data.extraGuestPrice ?? extraGuests * extraGuestFee * nights;

  let msg = `❌ <b>예약이 취소되었습니다</b>\n\n`;
  msg += `📅 날짜: ${data.checkIn} ~ ${data.checkOut} (${nights}박)\n`;
  msg += `🏠 객실: ${data.roomName}\n`;
  msg += `👤 예약자: ${data.customerName}\n`;
  msg += `📞 연락처: ${data.phone}\n`;
  msg += `👥 인원: ${data.guests}명`;
  if (extraGuests > 0 && extraGuestPrice > 0)
    msg += ` (기준 ${baseGuests}명 + 추가 ${extraGuests}명)`;
  msg += "\n";

  if (data.options?.length > 0) {
    msg += `\n📦 취소된 옵션:\n`;
    data.options.forEach((opt) => {
      const name = typeof opt === "object" ? opt.name : opt;
      if (name) msg += `• ${name}\n`;
    });
  }

  msg += `\n💰 <b>취소 정보</b>\n────────────────\n`;
  msg += `취소 금액: ${(data.totalPrice || 0).toLocaleString()}원\n`;
  msg += `취소 사유: ${data.cancelReason || "고객 요청"}\n`;

  if (data.refundAmount !== undefined) {
    msg += `\n💵 <b>환불 정보</b>\n────────────────\n`;
    msg += `환불 금액: ${(data.refundAmount || 0).toLocaleString()}원`;
    if (data.refundRate) msg += ` (${data.refundRate}%)`;
    msg += "\n";
    if (data.cancellationFee > 0) {
      msg += `취소 수수료: ${data.cancellationFee.toLocaleString()}원\n`;
    }
  }

  if (data.memo?.trim())
    msg += `\n📝 <b>예약 메모</b>\n────────────────\n${data.memo}\n`;
  msg += `\n#예약취소 #${data.roomName.replace(/\s/g, "")}`;

  return msg;
}

function formatRoomChangeMessage(data, prevRoom, newRoom) {
  const nights = calculateNights(data.checkIn, data.checkOut);

  let msg = `🔄 <b>객실이 변경되었습니다</b>\n\n`;
  msg += `📅 날짜: ${data.checkIn} ~ ${data.checkOut} (${nights}박)\n`;
  msg += `👤 예약자: ${data.customerName}\n`;
  msg += `📞 연락처: ${data.phone}\n\n`;
  msg += `🏠 <b>객실 변경</b>\n────────────────\n`;
  msg += `변경 전: ${prevRoom}\n`;
  msg += `변경 후: ${newRoom}\n`;
  msg += `────────────────\n`;
  msg += `\n#객실변경 #${newRoom.replace(/\s/g, "")}`;

  return msg;
}

// 템플릿 변수 치환
// 저장된 템플릿은 한글 변수만 사용한다 ({고객명}, {체크인} 등).
// sensService.generateMessage / smsScheduler 와 동일한 규칙을 유지할 것.
function applyTemplateVars(template, reservation) {
  // 현장결제(바베큐 등) 합계 — 금액이 있는 경우만 표기
  let onsiteText = "";
  if (reservation.options?.length > 0) {
    const onsiteTotal = reservation.options.reduce((sum, opt) => {
      const name = typeof opt === "object" ? opt.name || "" : opt;
      const price = typeof opt === "object" ? opt.price || 0 : 0;
      return /바베큐|bbq/i.test(name) ? sum + price : sum;
    }, 0);
    if (onsiteTotal > 0)
      onsiteText = `현장결제: ${onsiteTotal.toLocaleString()}원`;
  }

  const replacements = {
    "{고객명}": reservation.customerName || "",
    "{객실명}": reservation.roomName || "",
    "{체크인}": reservation.checkIn || "",
    "{체크아웃}": reservation.checkOut || "",
    "{인원}": reservation.guests || "",
    "{금액}": (reservation.totalPrice || 0).toLocaleString(), // 숫자만 (원은 템플릿에)
    "{현장결제}": onsiteText,
    "{전화번호}": "010-7932-0029",
    "{주소}": "경기도 파주시 법원읍 초리골길 134",
  };

  let message = template;
  for (const [key, value] of Object.entries(replacements)) {
    message = message.split(key).join(value);
  }
  return message;
}

// ─── SMS 발송 (SENS API 직접 호출) ───

async function sendConfirmationSMS(reservation, settings) {
  // SMS 발송 조건 체크
  const roomEnabled = settings.room?.enabled !== false;
  const confirmationEnabled =
    settings.room?.autoSend?.confirmationEnabled === true;
  if (!roomEnabled || !confirmationEnabled) {
    console.log("[SMS] 발송 스킵 - 설정 비활성화");
    return null;
  }

  // SENS 설정 로드
  const sensSettings = settings.global?.sens;
  if (
    !sensSettings?.serviceId ||
    !sensSettings?.accessKey ||
    !sensSettings?.secretKey
  ) {
    console.log("[SMS] SENS 설정 없음");
    return null;
  }

  const phone = reservation.phone;
  if (!phone) {
    console.log("[SMS] 전화번호 없음");
    return null;
  }

  // 템플릿에서 메시지 생성
  const template = settings.room?.templates?.confirmation;
  let message;
  if (template) {
    message = applyTemplateVars(template.content || template, reservation);
  } else {
    message =
      `[초호펜션] ${reservation.customerName}님, 예약이 확정되었습니다.\n` +
      `객실: ${reservation.roomName}\n` +
      `일정: ${reservation.checkIn} ~ ${reservation.checkOut}\n` +
      `문의: 010-7932-0029`;
  }

  // Cloud Function sendSENSSMS 호출하는 대신 직접 SENS API 호출
  try {
    const CryptoJS = (await import("crypto-js")).default;
    const timestamp = Date.now().toString();
    const method = "POST";
    const url = `/sms/v2/services/${sensSettings.serviceId}/messages`;
    const baseUrl = "https://sens.apigw.ntruss.com";

    const hmac = CryptoJS.algo.HMAC.create(
      CryptoJS.algo.SHA256,
      sensSettings.secretKey,
    );
    hmac.update(
      method + " " + url + "\n" + timestamp + "\n" + sensSettings.accessKey,
    );
    const signature = hmac.finalize().toString(CryptoJS.enc.Base64);

    // 전화번호 정규화
    const normalizedPhone = phone
      .replace(/[-\s()]/g, "")
      .replace(/^\+82/, "0")
      .replace(/^82/, "0");
    const normalizedFrom = (sensSettings.from || "01079320029").replace(
      /[-\s()]/g,
      "",
    );

    // 이모지 제거
    const cleanMessage = message.replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu,
      "",
    );

    const messageType = cleanMessage.length > 45 ? "LMS" : "SMS";

    const apiRes = await fetch(baseUrl + url, {
      method,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-ncp-apigw-timestamp": timestamp,
        "x-ncp-iam-access-key": sensSettings.accessKey,
        "x-ncp-apigw-signature-v2": signature,
      },
      body: JSON.stringify({
        type: messageType,
        contentType: "COMM",
        countryCode: "82",
        from: normalizedFrom,
        content: cleanMessage,
        messages: [{ to: normalizedPhone, content: cleanMessage }],
      }),
    });

    const result = await apiRes.json().catch(() => ({}));
    console.log("[SMS] 발송 결과:", apiRes.status, result);

    if (apiRes.status === 202 || result.requestId) {
      // smsStatus 업데이트
      if (reservation.id) {
        await db
          .collection("reservations")
          .doc(reservation.id)
          .update({
            "smsStatus.confirmationSent": true,
            "smsStatus.confirmationSentAt": new Date().toISOString(),
          })
          .catch(() => {});
      }
      return { success: true, requestId: result.requestId };
    }

    return { success: false, error: result };
  } catch (error) {
    console.error("[SMS] 발송 오류:", error);
    return { success: false, error: error.message };
  }
}

// ─── Firestore 트리거 ───

// 예약 생성 트리거
export const onReservationCreated = functions
  .region("asia-northeast3")
  .firestore.document("reservations/{reservationId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const reservationId = context.params.reservationId;

    console.log(
      `[트리거] 새 예약 생성: ${reservationId}`,
      data.roomName,
      data.source,
    );

    // 막기 예약은 알림 불필요
    if (data.source === "막기") return;

    const settings = await getNotificationSettings(data.roomName);
    if (!settings?.global?.telegram?.useReservation) {
      console.log("[트리거] 텔레그램 알림 비활성화");
      return;
    }

    try {
      // 예약확정 상태로 바로 생성된 경우
      if (data.status === "예약확정") {
        const msg = formatConfirmationMessage({ ...data, id: reservationId });
        await sendWithLakeView(msg, data.roomName);
        console.log("[트리거] 예약확정 알림 발송 완료");

        // SMS 발송 (확정 시)
        if (settings) {
          await sendConfirmationSMS({ ...data, id: reservationId }, settings);
        }
      } else {
        // 입금대기 등 일반 새 예약
        const msg = formatNewReservationMessage(data);
        await sendWithLakeView(msg, data.roomName);
        console.log("[트리거] 새 예약 알림 발송 완료");
      }

      // 발송 완료 표시
      await snap.ref
        .update({
          "notificationStatus.telegramSent": true,
          "notificationStatus.telegramSentAt":
            admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    } catch (error) {
      console.error("[트리거] 알림 발송 실패:", error);
      await snap.ref
        .update({
          "notificationStatus.telegramError": error.message,
          "notificationStatus.telegramErrorAt":
            admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    }
  });

// 예약 수정 트리거
export const onReservationUpdated = functions
  .region("asia-northeast3")
  .firestore.document("reservations/{reservationId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const reservationId = context.params.reservationId;

    // 막기 예약은 알림 불필요
    if (after.source === "막기") return;

    // notificationStatus만 변경된 경우 무한 루프 방지
    const beforeWithoutNotif = { ...before };
    delete beforeWithoutNotif.notificationStatus;
    const afterWithoutNotif = { ...after };
    delete afterWithoutNotif.notificationStatus;
    delete beforeWithoutNotif.updatedAt;
    delete afterWithoutNotif.updatedAt;
    delete beforeWithoutNotif.smsStatus;
    delete afterWithoutNotif.smsStatus;
    if (
      JSON.stringify(beforeWithoutNotif) === JSON.stringify(afterWithoutNotif)
    )
      return;

    const settings = await getNotificationSettings(after.roomName);

    // 상태 변경 감지
    const statusChanged = before.status !== after.status;
    const roomChanged = before.roomName !== after.roomName;

    try {
      // 예약확정으로 변경
      if (statusChanged && after.status === "예약확정") {
        if (!settings?.global?.telegram?.useReservation) return;

        console.log(`[트리거] 예약 확정: ${reservationId}`);
        const msg = formatConfirmationMessage({ ...after, id: reservationId });
        await sendWithLakeView(msg, after.roomName);

        // SMS 발송
        if (settings) {
          await sendConfirmationSMS({ ...after, id: reservationId }, settings);
        }

        await change.after.ref
          .update({
            "notificationStatus.confirmTelegramSent": true,
            "notificationStatus.confirmTelegramSentAt":
              admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      }

      // 예약취소로 변경
      if (statusChanged && after.status === "예약취소") {
        const shouldSend =
          settings?.global?.telegram?.useCancellation !== false &&
          (settings?.global?.telegram?.useCancellation === true ||
            settings?.global?.telegram?.useReservation === true);

        if (!shouldSend) return;

        console.log(`[트리거] 예약 취소: ${reservationId}`);
        const msg = formatCancellationMessage(after);
        await sendWithLakeView(msg, after.roomName);

        await change.after.ref
          .update({
            "notificationStatus.cancelTelegramSent": true,
            "notificationStatus.cancelTelegramSentAt":
              admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      }

      // 객실 변경
      if (roomChanged && before.roomName && after.roomName) {
        if (!settings?.global?.telegram?.useReservation) return;

        console.log(
          `[트리거] 객실 변경: ${before.roomName} → ${after.roomName}`,
        );
        const msg = formatRoomChangeMessage(
          after,
          before.roomName,
          after.roomName,
        );

        // 양쪽 객실 관련 채널로 발송
        await sendTelegramMessage(msg);
        if (
          before.roomName.includes("호수뷰") ||
          after.roomName.includes("호수뷰")
        ) {
          await sendTelegramMessage(msg, LAKE_VIEW_CHAT_ID).catch(() => {});
        }
      }
    } catch (error) {
      console.error("[트리거] 알림 발송 실패:", error);
      await change.after.ref
        .update({
          "notificationStatus.triggerError": error.message,
          "notificationStatus.triggerErrorAt":
            admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    }
  });
