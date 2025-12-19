import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';
import fetch from 'node-fetch';

const db = getFirestore();

// 네이버 SENS API 헬퍼 클래스 (트러블슈팅 반영)
class NaverSensAPI {
  constructor(config) {
    this.serviceId = config.serviceId;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.from = config.from;
  }

  makeSignature(method, url, timestamp) {
    const space = ' ';
    const newLine = '\n';
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(method);
    hmac.update(space);
    hmac.update(url);
    hmac.update(newLine);
    hmac.update(timestamp);
    hmac.update(newLine);
    hmac.update(this.accessKey);
    return hmac.digest('base64');
  }

  // 전화번호 정규화 함수 추가 (트러블슈팅 필수!)
  normalizePhoneNumber(phone) {
    if (!phone) throw new Error('전화번호가 없습니다');
    
    let normalized = phone.replace(/[-\s()]/g, '');
    
    // 국가코드 제거
    if (normalized.startsWith('+82')) {
      normalized = '0' + normalized.substring(3);
    } else if (normalized.startsWith('82')) {
      normalized = '0' + normalized.substring(2);
    }
    
    // 유효성 검사
    if (!/^01[0-9]{8,9}$/.test(normalized)) {
      throw new Error(`잘못된 전화번호 형식: ${phone}`);
    }
    
    return normalized;
  }

  async sendSMS(to, content) {
    const timestamp = Date.now().toString();
    const url = `/sms/v2/services/${this.serviceId}/messages`;
    const signature = this.makeSignature('POST', url, timestamp);

    try {
      // 전화번호 정규화 (필수!)
      const normalizedFrom = this.normalizePhoneNumber(this.from);
      const normalizedTo = this.normalizePhoneNumber(to);
      
      // SMS/LMS 타입 자동 결정
      const messageType = content.length > 45 ? 'LMS' : 'SMS';
      
      const response = await fetch(
        `https://sens.apigw.ntruss.com${url}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ncp-apigw-timestamp': timestamp,
            'x-ncp-iam-access-key': this.accessKey,
            'x-ncp-apigw-signature-v2': signature
          },
          body: JSON.stringify({
            type: messageType,
            contentType: 'COMM',  // 필수 필드! (트러블슈팅)
            countryCode: '82',    // 필수 필드! (트러블슈팅)
            from: normalizedFrom,
            content: content,
            messages: [{ 
              to: normalizedTo,
              content: content    // 개별 메시지 내용도 포함
            }]
          })
        }
      );
      
      const result = await response.json();
      
      // 202 상태코드도 성공으로 처리 (트러블슈팅)
      const isSuccess = response.status === 202 || response.ok;
      
      if (!isSuccess) {
        console.error('SMS 발송 실패:', {
          status: response.status,
          result: result,
          to: normalizedTo
        });
      }
      
      return { 
        success: isSuccess, 
        data: result,
        requestId: result.requestId
      };
    } catch (error) {
      console.error('SMS 발송 실패:', error);
      return { success: false, error: error.message };
    }
  }
}

// 텔레그램 봇 API 헬퍼 클래스
class TelegramBot {
  constructor(config) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
  }

  async sendMessage(text) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }
      );
      
      const result = await response.json();
      return { success: result.ok, data: result };
    } catch (error) {
      console.error('텔레그램 메시지 발송 실패:', error);
      return { success: false, error: error.message };
    }
  }
}

// 네이버 SENS 테스트
export const testNaverSens = onCall({
  region: 'asia-northeast3',
  cors: true
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  const { data } = request;
  const sens = new NaverSensAPI(data);
  const result = await sens.sendSMS(data.from, '초호펜션 알림 테스트 메시지입니다.');
  
  return {
    success: result.success,
    message: result.success ? '테스트 메시지가 발송되었습니다.' : '발송 실패: ' + (result.error || '알 수 없는 오류')
  };
});

// 텔레그램 테스트
export const testTelegram = onCall({
  region: 'asia-northeast3',
  cors: true
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  const { data } = request;
  const telegram = new TelegramBot(data);
  const result = await telegram.sendMessage('🔔 초호펜션 텔레그램 알림 테스트입니다.');
  
  return {
    success: result.success,
    message: result.success ? '테스트 메시지가 발송되었습니다.' : '발송 실패: ' + (result.error || '알 수 없는 오류')
  };
});

// 예약 알림 발송 (개선된 버전)
export const sendReservationNotification = onCall({
  region: 'asia-northeast3',
  cors: true
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  const { reservation, type = 'confirmation' } = request.data;
  const { roomName, customerName, customerPhone, checkIn, checkOut, totalPrice } = reservation;

  // 어느 사업장인지 확인
  const isChohoShelter = ['호수뷰객실', '1박2일워크샵', '야유회'].includes(roomName);
  const settingsPath = isChohoShelter ? 'notifications_shelter' : 'notifications_choho';
  const propertyName = isChohoShelter ? '초호쉼터' : '초호펜션';

  // 설정 가져오기
  const settingsDoc = await db.doc(`settings/${settingsPath}`).get();
  if (!settingsDoc.exists) {
    return { success: false, message: '알림 설정이 없습니다.' };
  }

  const settings = settingsDoc.data();
  const results = [];

  // 텔레그램 알림
  if (settings.telegram?.enabled !== false && settings.telegram?.botToken && settings.telegram?.chatId) {
    const telegram = new TelegramBot(settings.telegram);
    const message = `
🎉 <b>새 예약이 확정되었습니다!</b>

🏠 ${propertyName}
📅 날짜: ${checkIn} ~ ${checkOut}
🛏️ 객실: ${roomName}
👤 예약자: ${customerName}
📞 연락처: ${customerPhone}
💰 금액: ${totalPrice?.toLocaleString()}원
    `;
    const tgResult = await telegram.sendMessage(message);
    results.push({ type: 'telegram', ...tgResult });

    // 텔레그램 발송 로그 저장
    await db.collection('notification_logs').add({
      type: 'telegram_reservation',
      property: propertyName,
      recipient: settings.telegram.chatId,
      content: message,
      status: tgResult.success ? 'success' : 'failed',
      error: tgResult.error,
      reservationId: reservation.id,
      sentAt: new Date()
    });
  }

  // SMS 알림 (객실별 설정 확인)
  if (settings.smsRooms && settings.smsRooms[roomName] && settings.sens?.serviceId) {
    try {
      // V2 설정에서 템플릿 가져오기
      const v2SettingsPath = isChohoShelter ? 'notifications_v2_shelter' : 'notifications_v2_choho';
      const v2SettingsDoc = await db.doc(`settings/${v2SettingsPath}`).get();
      
      let smsMessage = '';
      
      if (v2SettingsDoc.exists) {
        const v2Data = v2SettingsDoc.data();
        const roomSettings = v2Data.roomSettings?.[roomName];
        
        if (roomSettings?.templates?.[type]?.content) {
          // 객실별 커스텀 템플릿 사용
          smsMessage = roomSettings.templates[type].content;
          console.log(`✅ 커스텀 템플릿 사용: ${roomName} - ${type}`);
        }
      }
      
      // 커스텀 템플릿이 없으면 기본 템플릿 사용
      if (!smsMessage) {
        smsMessage = `[${propertyName}]
예약이 확정되었습니다.
${checkIn} ~ ${checkOut}
${roomName} / ${customerName}님`;
        console.log(`📝 기본 템플릿 사용: ${roomName} - ${type}`);
      }
      
      // 변수 치환
      smsMessage = smsMessage
        .replace(/{고객명}/g, customerName)
        .replace(/{객실명}/g, roomName)
        .replace(/{체크인}/g, checkIn)
        .replace(/{체크아웃}/g, checkOut)
        .replace(/{금액}/g, totalPrice?.toLocaleString())
        .replace(/{전화번호}/g, settings.sens.from);
      
      const sens = new NaverSensAPI(settings.sens);
      const smsResult = await sens.sendSMS(customerPhone, smsMessage);
      results.push({ type: 'sms', ...smsResult });

      // SMS 발송 로그 저장
      await db.collection('notification_logs').add({
        type: 'sms_reservation',
        property: propertyName,
        roomName: roomName,
        recipient: customerPhone,
        content: smsMessage,
        status: smsResult.success ? 'success' : 'failed',
        error: smsResult.error,
        requestId: smsResult.requestId,
        reservationId: reservation.id,
        sentAt: new Date()
      });
      
      // 예약 문서에 SMS 상태 업데이트
      if (reservation.id) {
        const updateData = {};
        updateData[`smsStatus.${type}Sent`] = smsResult.success;
        updateData[`smsStatus.${type}SentAt`] = new Date();
        updateData[`smsStatus.${type}RequestId`] = smsResult.requestId || null;
        updateData[`smsStatus.${type}Error`] = smsResult.error || null;
        
        await db.collection('reservations').doc(reservation.id).update(updateData);
      }
      
    } catch (error) {
      console.error('SMS 발송 중 오류:', error);
      results.push({ type: 'sms', success: false, error: error.message });
    }
  }

  return {
    success: results.length > 0 && results.every(r => r.success),
    results: results,
    requestId: results.find(r => r.type === 'sms')?.requestId
  };
});

// 취소 알림 발송 (개선된 버전)
export const sendCancellationNotification = onCall({
  region: 'asia-northeast3',
  cors: true
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  const { reservation, cancellationReason, refundAmount } = request.data;
  const { roomName, customerName, customerPhone, checkIn, checkOut } = reservation;

  // 어느 사업장인지 확인
  const isChohoShelter = ['호수뷰객실', '1박2일워크샵', '야유회'].includes(roomName);
  const settingsPath = isChohoShelter ? 'notifications_shelter' : 'notifications_choho';
  const propertyName = isChohoShelter ? '초호쉼터' : '초호펜션';

  // 설정 가져오기
  const settingsDoc = await db.doc(`settings/${settingsPath}`).get();
  if (!settingsDoc.exists) {
    return { success: false, message: '알림 설정이 없습니다.' };
  }

  const settings = settingsDoc.data();
  const results = [];

  // 텔레그램 알림
  if (settings.telegram?.useCancellation !== false && settings.telegram?.botToken && settings.telegram?.chatId) {
    const telegram = new TelegramBot(settings.telegram);
    const message = `
❌ <b>예약이 취소되었습니다</b>

🏠 ${propertyName}
📅 날짜: ${checkIn} ~ ${checkOut}
🛏️ 객실: ${roomName}
👤 예약자: ${customerName}
📞 연락처: ${customerPhone}
💔 취소 사유: ${cancellationReason || '고객 변심'}
💵 환불금액: ${refundAmount?.toLocaleString()}원
    `;
    const tgResult = await telegram.sendMessage(message);
    results.push({ type: 'telegram', ...tgResult });

    // 텔레그램 발송 로그 저장
    await db.collection('notification_logs').add({
      type: 'telegram_cancellation',
      property: propertyName,
      recipient: settings.telegram.chatId,
      content: message,
      status: tgResult.success ? 'success' : 'failed',
      error: tgResult.error,
      reservationId: reservation.id,
      sentAt: new Date()
    });
  }

  // SMS 알림 (객실별 설정 확인)
  if (settings.smsRooms && settings.smsRooms[roomName] && settings.sens?.serviceId && settings.autoSend?.cancellationEnabled) {
    try {
      // V2 설정에서 템플릿 가져오기
      const v2SettingsPath = isChohoShelter ? 'notifications_v2_shelter' : 'notifications_v2_choho';
      const v2SettingsDoc = await db.doc(`settings/${v2SettingsPath}`).get();
      
      let smsMessage = '';
      
      if (v2SettingsDoc.exists) {
        const v2Data = v2SettingsDoc.data();
        const roomSettings = v2Data.roomSettings?.[roomName];
        
        if (roomSettings?.templates?.cancellation?.content) {
          // 객실별 커스텀 템플릿 사용
          smsMessage = roomSettings.templates.cancellation.content;
          console.log(`✅ 커스텀 템플릿 사용: ${roomName} - cancellation`);
        }
      }
      
      // 커스텀 템플릿이 없으면 기본 템플릿 사용
      if (!smsMessage) {
        smsMessage = `[${propertyName}]
예약이 취소되었습니다.
${checkIn} ~ ${checkOut}
${roomName}
환불금액: ${refundAmount?.toLocaleString()}원`;
        console.log(`📝 기본 템플릿 사용: ${roomName} - cancellation`);
      }
      
      // 변수 치환
      smsMessage = smsMessage
        .replace(/{고객명}/g, customerName)
        .replace(/{객실명}/g, roomName)
        .replace(/{체크인}/g, checkIn)
        .replace(/{체크아웃}/g, checkOut)
        .replace(/{금액}/g, refundAmount?.toLocaleString())
        .replace(/{전화번호}/g, settings.sens.from);
      
      const sens = new NaverSensAPI(settings.sens);
      const smsResult = await sens.sendSMS(customerPhone, smsMessage);
      results.push({ type: 'sms', ...smsResult });

      // SMS 발송 로그 저장
      await db.collection('notification_logs').add({
        type: 'sms_cancellation',
        property: propertyName,
        roomName: roomName,
        recipient: customerPhone,
        content: smsMessage,
        status: smsResult.success ? 'success' : 'failed',
        error: smsResult.error,
        requestId: smsResult.requestId,
        reservationId: reservation.id,
        sentAt: new Date()
      });
      
      // 예약 문서에 SMS 상태 업데이트
      if (reservation.id) {
        await db.collection('reservations').doc(reservation.id).update({
          'smsStatus.cancellationSent': smsResult.success,
          'smsStatus.cancellationSentAt': new Date(),
          'smsStatus.cancellationRequestId': smsResult.requestId || null,
          'smsStatus.cancellationError': smsResult.error || null
        });
      }
      
    } catch (error) {
      console.error('SMS 발송 중 오류:', error);
      results.push({ type: 'sms', success: false, error: error.message });
    }
  }

  return {
    success: results.length > 0 && results.every(r => r.success),
    results: results
  };
});

// 일일 현황 자동 발송 (초호펜션과 초호쉼터 분리)
export const sendDailyTelegramSummaryV2 = onSchedule({
  schedule: '0 9 * * *', // 매일 오전 9시
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3'
}, async (event) => {
  console.log('Starting daily Telegram summary V2 at', new Date().toISOString());
  
  try {
    // 오늘 날짜 (한국 시간)
    const today = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(today.getTime() + kstOffset);
    const dateStr = kstDate.toISOString().split('T')[0];
    
    // 날짜 포맷팅
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const month = monthNames[kstDate.getMonth()];
    const day = kstDate.getDate();
    const dayOfWeek = dayNames[kstDate.getDay()];
    const displayDate = `${month} ${day}일 (${dayOfWeek})`;
    
    // 예약 정보 가져오기
    const reservationsSnapshot = await db.collection('reservations')
      .where('status', '!=', '예약취소')
      .get();
    
    const reservations = reservationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 초호펜션과 초호쉼터 분리
    const pensionRooms = ['Forest', 'Forest mini', 'Forest mini 패밀리', 'Forest 패밀리'];
    const shelterRooms = ['호수뷰객실', '1박2일워크샵', '야유회'];
    
    const pensionReservations = reservations.filter(r => pensionRooms.includes(r.roomName));
    const shelterReservations = reservations.filter(r => shelterRooms.includes(r.roomName));
    
    // 초호펜션 알림 발송
    const pensionSettings = await db.doc('settings/notifications_choho').get();
    if (pensionSettings.exists && 
        pensionSettings.data().telegram?.autoSendDaily !== false &&
        pensionSettings.data().telegram?.botToken &&
        pensionSettings.data().telegram?.chatId) {
      
      const telegram = new TelegramBot(pensionSettings.data().telegram);
      const message = buildDailySummaryMessage('초호펜션', pensionReservations, dateStr, displayDate);
      
      const result = await telegram.sendMessage(message);
      
      // 로그 저장
      await db.collection('notification_logs').add({
        type: 'telegram_daily_summary',
        property: '초호펜션',
        recipient: pensionSettings.data().telegram.chatId,
        content: message,
        status: result.success ? 'success' : 'failed',
        error: result.error,
        sentAt: new Date(),
        isAutoSend: true
      });
    }
    
    // 초호쉼터 알림 발송
    const shelterSettings = await db.doc('settings/notifications_shelter').get();
    if (shelterSettings.exists && 
        shelterSettings.data().telegram?.autoSendDaily !== false &&
        shelterSettings.data().telegram?.botToken &&
        shelterSettings.data().telegram?.chatId) {
      
      const telegram = new TelegramBot(shelterSettings.data().telegram);
      const message = buildDailySummaryMessage('초호쉼터', shelterReservations, dateStr, displayDate);
      
      const result = await telegram.sendMessage(message);
      
      // 로그 저장
      await db.collection('notification_logs').add({
        type: 'telegram_daily_summary',
        property: '초호쉼터',
        recipient: shelterSettings.data().telegram.chatId,
        content: message,
        status: result.success ? 'success' : 'failed',
        error: result.error,
        sentAt: new Date(),
        isAutoSend: true
      });
    }
    
  } catch (error) {
    console.error('Error in daily Telegram summary V2:', error);
    
    // 에러 로그 저장
    await db.collection('error_logs').add({
      function: 'sendDailyTelegramSummaryV2',
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
  }
});

// 일일 현황 메시지 생성 헬퍼 함수
function buildDailySummaryMessage(propertyName, reservations, dateStr, displayDate) {
  // 입실예정, 퇴실예정, 현재투숙 필터링
  const checkInReservations = reservations.filter(r => r.checkIn === dateStr);
  const checkOutReservations = reservations.filter(r => r.checkOut === dateStr);
  const currentStayReservations = reservations.filter(r => {
    return r.checkIn <= dateStr && dateStr < r.checkOut;
  });
  
  // 메시지 생성
  let message = `📆 <b>${propertyName} 일일 현황</b>\n`;
  message += `${displayDate}\n\n`;
  
  message += `<b>📥 입실예정: ${checkInReservations.length}건</b>\n`;
  if (checkInReservations.length > 0) {
    checkInReservations.forEach(r => {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      message += `  • ${r.roomName} - ${r.customerName} (${nights}박)\n`;
    });
  } else {
    message += `  • 없음\n`;
  }
  
  message += `\n<b>📤 퇴실예정: ${checkOutReservations.length}건</b>\n`;
  if (checkOutReservations.length > 0) {
    checkOutReservations.forEach(r => {
      message += `  • ${r.roomName} - ${r.customerName}\n`;
    });
  } else {
    message += `  • 없음\n`;
  }
  
  message += `\n<b>🏠 현재투숙: ${currentStayReservations.length}건</b>\n`;
  if (currentStayReservations.length > 0) {
    currentStayReservations.forEach(r => {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      const stayNights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const currentNight = Math.ceil((new Date(dateStr) - checkIn) / (1000 * 60 * 60 * 24)) + 1;
      message += `  • ${r.roomName} - ${r.customerName} (${currentNight}/${stayNights}박째)\n`;
    });
  } else {
    message += `  • 없음\n`;
  }
  
  // 오늘 매출 계산
  const todayRevenue = checkInReservations
    .filter(r => r.status === '예약확정')
    .reduce((sum, r) => sum + (r.totalPrice || 0), 0);
  
  if (todayRevenue > 0) {
    message += `\n<b>💰 오늘 예상 매출: ${todayRevenue.toLocaleString()}원</b>\n`;
  }
  
  message += `\n#${propertyName} #일일현황 #${dateStr}`;
  
  return message;
}
