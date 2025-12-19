// functions/src/notificationScheduler.js
import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

// Admin SDK 초기화
try {
  admin.initializeApp();
} catch (error) {
  // 이미 초기화된 경우 무시
  console.log('Admin already initialized');
}

const db = admin.firestore();

// 자동 알림 발송 스케줄러 (10분마다 실행)
// ⚠️ 비활성화됨 - smsScheduler.js 사용
export const notificationScheduler = functions.pubsub
  .schedule('every 10 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    // ⚠️ 비활성화 - smsScheduler.js로 대체됨 (2025-12-19)
    console.log('⏸️ notificationScheduler 비활성화됨. smsScheduler 사용 중.');
    return null;

    console.log('Notification scheduler started at:', new Date().toISOString());

    try {
      // 현재 시간 (한국 시간)
      const now = new Date();
      const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
      
      // 오늘 날짜
      const today = koreaTime.toISOString().split('T')[0];
      
      // 알림 설정 가져오기
      const chohoSettings = await db.collection('settings').doc('notifications_v2_choho').get();
      const shelterSettings = await db.collection('settings').doc('notifications_v2_shelter').get();
      
      const settings = {};
      if (chohoSettings.exists) {
        settings['notifications_v2_choho'] = chohoSettings.data();
      }
      if (shelterSettings.exists) {
        settings['notifications_v2_shelter'] = shelterSettings.data();
      }
      
      // 오늘의 예약 가져오기
      const reservationsSnapshot = await db.collection('reservations')
        .where('checkIn', '==', today)
        .where('status', '==', '예약확정')
        .get();
      
      const checkInReservations = [];
      reservationsSnapshot.forEach(doc => {
        checkInReservations.push({ id: doc.id, ...doc.data() });
      });
      
      // 내일 퇴실 예약 가져오기
      const tomorrow = new Date(koreaTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const checkOutSnapshot = await db.collection('reservations')
        .where('checkOut', '==', tomorrowStr)
        .where('status', '==', '예약확정')
        .get();
      
      const checkOutReservations = [];
      checkOutSnapshot.forEach(doc => {
        checkOutReservations.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`Found ${checkInReservations.length} check-in and ${checkOutReservations.length} check-out reservations`);
      
      // 입실 안내 발송
      for (const reservation of checkInReservations) {
        await processCheckInNotification(reservation, settings, koreaTime);
      }
      
      // 퇴실 안내 발송
      for (const reservation of checkOutReservations) {
        await processCheckOutNotification(reservation, settings, koreaTime);
      }
      
      console.log('Notification scheduler completed');
      return null;
      
    } catch (error) {
      console.error('Notification scheduler error:', error);
      return null;
    }
  });

// 입실 안내 처리
async function processCheckInNotification(reservation, settings, currentTime) {
  try {
    const roomName = reservation.roomName || reservation.room;
    if (!roomName) return;
    
    // 객실 설정 확인
    const isChoho = roomName.includes('Forest');
    const settingKey = isChoho ? 'notifications_v2_choho' : 'notifications_v2_shelter';
    const setting = settings[settingKey];
    
    if (!setting) return;
    
    const roomSetting = setting.roomSettings?.[roomName];
    if (!roomSetting?.enabled || !roomSetting?.autoSend?.checkInEnabled) {
      return;
    }
    
    // 발송 시간 계산 (입실 N시간 전)
    const checkInTime = new Date(reservation.checkIn + 'T15:00:00+09:00'); // 오후 3시 입실
    const sendTime = new Date(checkInTime.getTime() - (roomSetting.autoSend.checkInHoursBefore * 60 * 60 * 1000));
    
    // 현재 시간이 발송 시간 범위 내인지 확인 (±5분)
    const timeDiff = Math.abs(currentTime.getTime() - sendTime.getTime());
    if (timeDiff > 5 * 60 * 1000) { // 5분 이상 차이나면 스킵
      return;
    }
    
    // 이미 발송했는지 확인
    const logSnapshot = await db.collection('notification_logs')
      .where('reservationId', '==', reservation.id)
      .where('type', '==', 'checkIn')
      .limit(1)
      .get();
    
    if (!logSnapshot.empty) {
      console.log(`Check-in notification already sent for reservation ${reservation.id}`);
      return;
    }
    
    // SMS 발송
    if (setting.globalSettings?.sens) {
      await sendSMS(
        reservation,
        roomSetting.templates?.checkIn || getDefaultTemplate('checkIn', roomName),
        setting.globalSettings.sens,
        'checkIn'
      );
    }
    
  } catch (error) {
    console.error('Check-in notification error:', error);
  }
}

// 퇴실 안내 처리
async function processCheckOutNotification(reservation, settings, currentTime) {
  try {
    const roomName = reservation.roomName || reservation.room;
    if (!roomName) return;
    
    // 객실 설정 확인
    const isChoho = roomName.includes('Forest');
    const settingKey = isChoho ? 'notifications_v2_choho' : 'notifications_v2_shelter';
    const setting = settings[settingKey];
    
    if (!setting) return;
    
    const roomSetting = setting.roomSettings?.[roomName];
    if (!roomSetting?.enabled || !roomSetting?.autoSend?.checkOutEnabled) {
      return;
    }
    
    // 발송 시간 계산 (퇴실 N시간 전)
    const checkOutTime = new Date(reservation.checkOut + 'T11:00:00+09:00'); // 오전 11시 퇴실
    const sendTime = new Date(checkOutTime.getTime() - (roomSetting.autoSend.checkOutHoursBefore * 60 * 60 * 1000));
    
    // 현재 시간이 발송 시간 범위 내인지 확인 (±5분)
    const timeDiff = Math.abs(currentTime.getTime() - sendTime.getTime());
    if (timeDiff > 5 * 60 * 1000) { // 5분 이상 차이나면 스킵
      return;
    }
    
    // 이미 발송했는지 확인
    const logSnapshot = await db.collection('notification_logs')
      .where('reservationId', '==', reservation.id)
      .where('type', '==', 'checkOut')
      .limit(1)
      .get();
    
    if (!logSnapshot.empty) {
      console.log(`Check-out notification already sent for reservation ${reservation.id}`);
      return;
    }
    
    // SMS 발송
    if (setting.globalSettings?.sens) {
      await sendSMS(
        reservation,
        roomSetting.templates?.checkOut || getDefaultTemplate('checkOut', roomName),
        setting.globalSettings.sens,
        'checkOut'
      );
    }
    
  } catch (error) {
    console.error('Check-out notification error:', error);
  }
}

// SMS 발송 (Functions 경유)
async function sendSMS(reservation, template, sensConfig, type) {
  try {
    const message = generateMessage(template.content || template, reservation);
    
    const response = await fetch('https://us-central1-choho-pension.cloudfunctions.net/sendSENSSMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId: sensConfig.serviceId,
        accessKey: sensConfig.accessKey,
        secretKey: sensConfig.secretKey,
        from: sensConfig.from,
        to: reservation.phone,
        content: message
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 로그 저장
      await db.collection('notification_logs').add({
        type: type,
        reservationId: reservation.id,
        recipient: reservation.phone,
        content: message,
        status: 'success',
        requestId: result.requestId,
        sentAt: new Date()
      });
      
      console.log(`${type} SMS sent successfully to ${reservation.phone}`);
    } else {
      throw new Error(result.error || 'SMS 발송 실패');
    }
    
  } catch (error) {
    console.error('SMS send error:', error);
    
    // 실패 로그 저장
    await db.collection('notification_logs').add({
      type: type,
      reservationId: reservation.id,
      recipient: reservation.phone,
      status: 'failed',
      error: error.message,
      sentAt: new Date()
    });
  }
}

// 메시지 변수 치환
function generateMessage(template, reservation) {
  let message = template;
  
  const replacements = {
    '{고객명}': reservation.customerName || '',
    '{객실명}': reservation.roomName || reservation.room || '',
    '{체크인}': formatDate(reservation.checkIn),
    '{체크아웃}': formatDate(reservation.checkOut),
    '{인원}': reservation.guests || '',
    '{금액}': (reservation.totalPrice || 0).toLocaleString(),
    '{전화번호}': '010-7932-0029',
    '{주소}': (reservation.roomName || '').includes('Forest') ? 
      '경기 파주시 법원읍 초리골길 138-17' : 
      '경기 파주시 법원읍 초리골길 138-20',
    '{입실시간}': '오후 3시',
    '{퇴실시간}': '오전 11시'
  };
  
  Object.entries(replacements).forEach(([key, value]) => {
    message = message.replace(new RegExp(key, 'g'), value);
  });
  
  return message;
}

// 날짜 포맷
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
  } catch {
    return dateString;
  }
}

// 기본 템플릿
function getDefaultTemplate(type, roomName) {
  const pensionName = roomName && roomName.includes('Forest') ? '초호펜션' : '초호쉼터';
  
  const templates = {
    checkIn: `[${pensionName}]
안녕하세요 {고객명}님!
오늘 오후 3시 입실 예정이십니다.

📍 주소: {주소}
🚗 주차: 객실 앞 전용주차장
🔑 체크인: 초리골164 카페

문의: {전화번호}`,
    
    checkOut: `[${pensionName}]
{고객명}님, 즐거운 시간 보내셨나요?

🕐 퇴실시간: 오전 11시
🧹 퇴실준비: 사용하신 그릇은 싱크대에
🗑️ 쓰레기: 분리수거 부탁드립니다

감사합니다. 또 뵙겠습니다 🙏`
  };
  
  return templates[type] || '';
}