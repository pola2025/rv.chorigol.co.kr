import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import fetch from 'node-fetch';

const db = getFirestore();

// 텔레그램 채팅 ID (객실별)
const TELEGRAM_CHAT_IDS = {
  choho: '-1002484830636',    // Forest 객실들 (초호펜션)
  shelter: '-1002863320782'   // 호수뷰객실 (초호쉼터)
};

// 업체 구분 함수
const getBusinessType = (roomName) => {
  const shelterRooms = ['호수뷰객실', '1박2일워크샵', '야유회'];
  return shelterRooms.includes(roomName) ? 'shelter' : 'choho';
};

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

// 텔레그램 메시지 발송 함수
async function sendTelegramMessage(botToken, chatId, message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
  return response.json();
}

// 매일 오전 9시 텔레그램 일일 현황 자동 발송 (객실별 분리)
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

    if (!settings.telegram?.botToken) {
      console.log('Telegram bot token not configured');
      return;
    }

    const { botToken } = settings.telegram;
    
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
    
    // 날짜 포맷팅
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const month = monthNames[kstDate.getMonth()];
    const day = kstDate.getDate();
    const dayOfWeek = dayNames[kstDate.getDay()];
    const displayDate = `${month} ${day}일 (${dayOfWeek})`;

    // 업체별로 예약 분리
    const businessTypes = ['choho', 'shelter'];

    for (const businessType of businessTypes) {
      const chatId = TELEGRAM_CHAT_IDS[businessType];
      const businessName = businessType === 'choho' ? '초호펜션' : '초호쉼터';

      // 해당 업체의 예약만 필터링
      const businessReservations = reservations.filter(r => getBusinessType(r.roomName) === businessType);
      const businessRooms = rooms.filter(r => getBusinessType(r.name) === businessType);

      // 입실예정, 퇴실예정, 현재투숙 필터링
      const checkInReservations = businessReservations.filter(r => r.checkIn === dateStr);
      const checkOutReservations = businessReservations.filter(r => r.checkOut === dateStr);
      const currentStayReservations = businessReservations.filter(r => {
        return r.checkIn <= dateStr && dateStr < r.checkOut;
      });

      // 해당 업체에 오늘 관련 예약이 없으면 스킵
      if (checkInReservations.length === 0 && checkOutReservations.length === 0 && currentStayReservations.length === 0) {
        console.log(`${businessName}: 오늘 관련 예약 없음 - 스킵`);
        continue;
      }

      // 메시지 생성 - 입실 안내 형식
      let message = `📥 <b>${businessName} 입실 안내</b>\n`;
      message += `━━━━━━━━━━━━━━━━━━\n`;
      message += `📅 ${displayDate}\n\n`;

      if (checkInReservations.length > 0) {
        checkInReservations
          .sort(sortByRoom)
          .forEach(r => {
            const checkIn = new Date(r.checkIn);
            const checkOut = new Date(r.checkOut);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            const checkInStr = r.checkIn.replace(/-/g, '/').slice(5);
            const checkOutStr = r.checkOut.replace(/-/g, '/').slice(5);
            const options = r.options || r.addons || '없음';
            const memo = r.memo || r.notes || r.request || '-';
            const price = r.totalPrice ? r.totalPrice.toLocaleString() + '원' : '-';

            message += `┌─────────────────────────────────┐\n`;
            message += `│ 🏠 ${r.roomName}\n`;
            message += `├─────────────────────────────────┤\n`;
            message += `│ 예약자: ${r.customerName}\n`;
            message += `│ 연락처: ${r.phone || '-'}\n`;
            message += `│ 인원: ${r.guests || r.guestCount || 2}명\n`;
            message += `│ 일정: ${checkInStr} ~ ${checkOutStr} (${nights}박)\n`;
            message += `│ 금액: ${price}\n`;
            message += `│ 옵션: ${options}\n`;
            message += `│ 메모: ${memo}\n`;
            message += `└─────────────────────────────────┘\n\n`;
          });

        // 오늘 매출 계산
        const todayRevenue = checkInReservations
          .filter(r => r.status === '예약확정')
          .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

        message += `📊 총 ${checkInReservations.length}건`;
        if (todayRevenue > 0) {
          message += ` | 예상매출 ${todayRevenue.toLocaleString()}원`;
        }
      } else {
        message += `오늘 입실 예정 없음`;
      }

      // 텔레그램 전송
      const result = await sendTelegramMessage(botToken, chatId, message);

      if (result.ok) {
        console.log(`${businessName} 일일 현황 발송 성공`);

        await db.collection('notification_logs').add({
          type: 'telegram_daily_summary',
          businessType,
          recipient: chatId,
          content: message,
          status: 'success',
          messageId: result.result.message_id,
          sentAt: new Date(),
          isAutoSend: true
        });
      } else {
        console.error(`${businessName} 일일 현황 발송 실패:`, result);

        await db.collection('notification_logs').add({
          type: 'telegram_daily_summary',
          businessType,
          recipient: chatId,
          content: message,
          status: 'failed',
          error: result.description || 'Unknown error',
          sentAt: new Date(),
          isAutoSend: true
        });
      }
    }

  } catch (error) {
    console.error('Error in daily Telegram summary:', error);

    await db.collection('error_logs').add({
      function: 'sendDailyTelegramSummary',
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
  }
});
