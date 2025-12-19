import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import fetch from 'node-fetch';

const db = getFirestore();

// 객실 정렬 함수
const sortByRoom = (a, b) => {
  const roomOrder = ['Forest', 'Forest mini', 'Forest 패밀리', 'Forest mini 패밀리', '호수뷰객실'];
  const aIndex = roomOrder.indexOf(a.roomName);
  const bIndex = roomOrder.indexOf(b.roomName);
  
  if (aIndex !== -1 && bIndex !== -1) {
    return aIndex - bIndex;
  } else if (aIndex !== -1) {
    return -1;
  } else if (bIndex !== -1) {
    return 1;
  }
  
  return a.roomName.localeCompare(b.roomName);
};

// 매일 오전 9시 텔레그램 일일 현황 자동 발송 (기존 버전 - 통합)
export const sendDailyTelegramSummary = onSchedule({
  schedule: '0 9 * * *', // 매일 오전 9시
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3'
}, async (event) => {
  console.log('Starting daily Telegram summary at', new Date().toISOString());
  
  try {
    // 텔레그램 설정 가져오기
    const settingsDoc = await db.collection('settings').doc('notifications').get();
    
    if (!settingsDoc.exists) {
      console.log('No notification settings found');
      return;
    }
    
    const settings = settingsDoc.data();
    
    if (!settings.telegram?.botToken || !settings.telegram?.chatId) {
      console.log('Telegram not configured');
      return;
    }
    
    // 자동 발송이 활성화되어 있는지 확인
    if (settings.telegram?.autoSendDaily === false) {
      console.log('Daily auto-send is disabled');
      return;
    }
    
    const { botToken, chatId } = settings.telegram;
    
    // 오늘 날짜 (한국 시간)
    const today = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(today.getTime() + kstOffset);
    const dateStr = kstDate.toISOString().split('T')[0];
    
    // 예약 정보 가져오기
    const reservationsSnapshot = await db.collection('reservations')
      .where('status', '!=', '예약취소')
      .get();
    
    const reservations = reservationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 객실 정보 가져오기
    const roomsSnapshot = await db.collection('rooms').get();
    const rooms = roomsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 입실예정, 퇴실예정, 현재투숙 필터링
    const checkInReservations = reservations.filter(r => r.checkIn === dateStr);
    const checkOutReservations = reservations.filter(r => r.checkOut === dateStr);
    const currentStayReservations = reservations.filter(r => {
      return r.checkIn <= dateStr && dateStr < r.checkOut;
    });
    
    // 날짜 포맷팅
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const month = monthNames[kstDate.getMonth()];
    const day = kstDate.getDate();
    const dayOfWeek = dayNames[kstDate.getDay()];
    const displayDate = `${month} ${day}일 (${dayOfWeek})`;
    
    // 메시지 생성
    let message = `📆 <b>일일 현황 자동 리포트</b>\n`;
    message += `${displayDate}\n\n`;
    
    message += `<b>📥 입실예정: ${checkInReservations.length}건</b>\n`;
    if (checkInReservations.length > 0) {
      checkInReservations
        .sort(sortByRoom) // 객실별 정렬 적용
        .forEach(r => {
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
      checkOutReservations
        .sort(sortByRoom) // 객실별 정렬 적용
        .forEach(r => {
          message += `  • ${r.roomName} - ${r.customerName}\n`;
        });
    } else {
      message += `  • 없음\n`;
    }
    
    message += `\n<b>🏠 현재투숙: ${currentStayReservations.length}/${rooms.length}</b>\n`;
    if (currentStayReservations.length > 0) {
      currentStayReservations
        .sort(sortByRoom) // 객실별 정렬 적용
        .forEach(r => {
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
    
    message += `\n#일일현황 #자동발송 #${dateStr}`;
    
    // 텔레그램 전송
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('Daily Telegram summary sent successfully');
      
      // 발송 로그 저장
      await db.collection('notification_logs').add({
        type: 'telegram_daily_summary',
        recipient: chatId,
        content: message,
        status: 'success',
        messageId: result.result.message_id,
        sentAt: new Date(),
        isAutoSend: true
      });
    } else {
      console.error('Failed to send Telegram message:', result);
      
      // 실패 로그 저장
      await db.collection('notification_logs').add({
        type: 'telegram_daily_summary',
        recipient: chatId,
        content: message,
        status: 'failed',
        error: result.description || 'Unknown error',
        sentAt: new Date(),
        isAutoSend: true
      });
    }
  } catch (error) {
    console.error('Error in daily Telegram summary:', error);
    
    // 에러 로그 저장
    await db.collection('error_logs').add({
      function: 'sendDailyTelegramSummary',
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
  }
});
