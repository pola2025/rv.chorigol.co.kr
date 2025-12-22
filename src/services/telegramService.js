// src/services/telegramService.js
// 보안 강화: Cloud Functions를 통해 텔레그램 발송 (토큰 서버사이드 관리)

class TelegramService {
  constructor() {
    // Cloud Functions 엔드포인트
    this.functionUrl = 'https://asia-northeast3-choho-pension.cloudfunctions.net/sendTelegram';
    this.testFunctionUrl = 'https://asia-northeast3-choho-pension.cloudfunctions.net/testTelegramConnection';
  }

  // 호수뷰객실 전용 추가 채널 ID
  static LAKE_VIEW_CHAT_ID = '-1002863320782';

  // Cloud Function을 통해 메시지 발송
  async sendMessage(text, parseMode = 'HTML', targetChatId = null) {
    console.log('📱 [DEBUG] Telegram sendMessage via Cloud Function');

    try {
      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          chatId: targetChatId,
          parseMode: parseMode
        })
      });

      const result = await response.json();
      console.log('📱 [DEBUG] Cloud Function 응답:', result);

      if (result.success) {
        console.log('📱 [DEBUG] 텔레그램 발송 성공, message_id:', result.messageId);
        return {
          success: true,
          messageId: result.messageId
        };
      } else {
        console.error('📱 [DEBUG] 텔레그램 발송 실패:', result.error);
        throw new Error(result.error || '발송 실패');
      }
    } catch (error) {
      console.error('📱 [DEBUG] Telegram sendMessage 오류:', error);
      throw error;
    }
  }

  // 예약 확정 알림
  async sendReservationNotification(reservation) {
    const nights = this.calculateNights(reservation.checkIn, reservation.checkOut);

    // 객실 기준 인원 정보
    const rooms = [
      { 객실명: 'Forest', 기준인원: 2, 추가요금: 20000 },
      { 객실명: 'Forest mini', 기준인원: 2, 추가요금: 20000 },
      { 객실명: '호수뷰객실', 기준인원: 4, 추가요금: 20000 },
      { 객실명: '스파객실', 기준인원: 2, 추가요금: 20000 }
    ];

    const room = rooms.find(r => r.객실명 === reservation.roomName);
    const baseGuests = room?.기준인원 || 2;
    const extraGuests = Math.max(0, (reservation.guests || baseGuests) - baseGuests);
    const extraGuestPrice = extraGuests * (room?.추가요금 || 20000) * nights;

    // 옵션 정보 파싱 및 분류
    let includedOptions = [];
    let onsiteOptions = [];
    let includedOptionPrice = 0;
    let onsiteOptionPrice = 0;

    if (reservation.options && reservation.options.length > 0) {
      reservation.options.forEach(option => {
        if (typeof option === 'object') {
          if (option.name === '캠핑버너&그릴') {
            includedOptions.push({ name: option.name, price: option.price || 20000 });
            includedOptionPrice += (option.price || 20000);
          } else if (option.name === '숯불바베큐') {
            onsiteOptions.push({ name: option.name, price: option.price || 30000 });
            onsiteOptionPrice += (option.price || 30000);
          } else if (option.name === '레이트 체크아웃') {
            includedOptions.push({ name: option.name, price: 0 });
          }
        } else if (typeof option === 'string') {
          if (option === 'camping_burner' || option === '캠핑버너&그릴') {
            includedOptions.push({ name: '캠핑버너&그릴', price: 20000 });
            includedOptionPrice += 20000;
          } else if (option === 'charcoal_bbq' || option === '숯불바베큐') {
            onsiteOptions.push({ name: '숯불바베큐', price: 30000 });
            onsiteOptionPrice += 30000;
          } else if (option === 'late_checkout' || option === '레이트 체크아웃') {
            includedOptions.push({ name: '레이트 체크아웃', price: 0 });
          }
        }
      });
    }

    const basePrice = reservation.basePrice ||
                     (reservation.totalPrice - extraGuestPrice - includedOptionPrice) ||
                     reservation.roomPrice ||
                     reservation.totalPrice;

    // 메시지 구성
    let message = `🎉 <b>새 예약이 확정되었습니다!</b>\n\n`;
    message += `📅 날짜: ${reservation.checkIn} ~ ${reservation.checkOut} (${nights}박)\n`;
    message += `🏠 객실: ${reservation.roomName}\n`;
    message += `👤 예약자: ${reservation.customerName}\n`;
    message += `📞 연락처: ${reservation.phone}\n`;
    message += `👥 인원: ${reservation.guests}명`;

    if (extraGuests > 0) {
      message += ` (기준 ${baseGuests}명 + 추가 ${extraGuests}명)`;
    }
    message += '\n';

    message += `\n💰 <b>결제 정보</b>\n`;
    message += `────────────────\n`;
    message += `객실 요금: ${basePrice.toLocaleString()}원\n`;

    if (extraGuests > 0) {
      message += `인원 추가: ${extraGuestPrice.toLocaleString()}원 (${extraGuests}명 × ${nights}박)\n`;
    }

    if (includedOptions.length > 0) {
      message += `\n📦 <b>포함 옵션</b>\n`;
      includedOptions.forEach(opt => {
        if (opt.price > 0) {
          message += `• ${opt.name}: ${opt.price.toLocaleString()}원\n`;
        } else {
          message += `• ${opt.name}\n`;
        }
      });
    }

    const totalPaidAmount = reservation.totalPrice || (basePrice + extraGuestPrice + includedOptionPrice);
    message += `────────────────\n`;
    message += `<b>총 결제금액: ${totalPaidAmount.toLocaleString()}원</b>\n`;

    if (onsiteOptions.length > 0) {
      message += `\n💳 <b>현장 결제</b>\n`;
      message += `────────────────\n`;
      onsiteOptions.forEach(opt => {
        message += `• ${opt.name}: ${opt.price.toLocaleString()}원\n`;
      });
      message += `────────────────\n`;
      message += `<b>현장 결제금액: ${onsiteOptionPrice.toLocaleString()}원</b>\n`;
    }

    message += `\n📍 출처: ${this.getSourceName(reservation.source)}`;

    if (reservation.memo && reservation.memo.trim()) {
      message += `\n\n📝 <b>메모</b>\n`;
      message += `────────────────\n`;
      message += `${reservation.memo}`;
    }

    message += `\n\n#예약확정 #${reservation.roomName.replace(/\s/g, '')}`;

    // 기본 채널로 발송
    const result = await this.sendMessage(message);

    // 호수뷰객실인 경우 추가 채널로도 발송
    if (reservation.roomName && reservation.roomName.includes('호수뷰')) {
      try {
        console.log('🏞️ [DEBUG] 호수뷰객실 예약 - 추가 채널로 발송');
        await this.sendMessage(message, 'HTML', TelegramService.LAKE_VIEW_CHAT_ID);
        console.log('🏞️ [DEBUG] 호수뷰객실 추가 채널 발송 완료');
      } catch (error) {
        console.error('🏞️ [ERROR] 호수뷰객실 추가 채널 발송 실패:', error);
      }
    }

    return result;
  }

  // 예약 취소 알림
  async sendCancellationNotification(reservation, cancellationData) {
    console.log('❌ [텔레그램] 취소 알림 시작');

    const nights = this.calculateNights(reservation.checkIn, reservation.checkOut);

    const rooms = [
      { 객실명: 'Forest', 기준인원: 2, 추가요금: 20000 },
      { 객실명: 'Forest mini', 기준인원: 2, 추가요금: 20000 },
      { 객실명: '호수뷰객실', 기준인원: 4, 추가요금: 20000 },
      { 객실명: '스파객실', 기준인원: 2, 추가요금: 20000 }
    ];

    const room = rooms.find(r => r.객실명 === reservation.roomName);
    const baseGuests = room?.기준인원 || 2;
    const extraGuests = Math.max(0, (reservation.guests || baseGuests) - baseGuests);

    let cancelledOptions = [];

    if (reservation.options && reservation.options.length > 0) {
      reservation.options.forEach(option => {
        if (typeof option === 'object') {
          cancelledOptions.push(option.name);
        } else if (typeof option === 'string') {
          if (option === 'camping_burner' || option === '캠핑버너&그릴') {
            cancelledOptions.push('캠핑버너&그릴');
          } else if (option === 'charcoal_bbq' || option === '숯불바베큐') {
            cancelledOptions.push('숯불바베큐');
          } else if (option === 'late_checkout' || option === '레이트 체크아웃') {
            cancelledOptions.push('레이트 체크아웃');
          }
        }
      });
    }

    let message = `❌ <b>예약이 취소되었습니다</b>\n\n`;
    message += `📅 날짜: ${reservation.checkIn} ~ ${reservation.checkOut} (${nights}박)\n`;
    message += `🏠 객실: ${reservation.roomName}\n`;
    message += `👤 예약자: ${reservation.customerName}\n`;
    message += `📞 연락처: ${reservation.phone}\n`;
    message += `👥 인원: ${reservation.guests}명`;

    if (extraGuests > 0) {
      message += ` (기준 ${baseGuests}명 + 추가 ${extraGuests}명)`;
    }
    message += '\n';

    if (cancelledOptions.length > 0) {
      message += `\n📦 취소된 옵션:\n`;
      cancelledOptions.forEach(opt => {
        message += `• ${opt}\n`;
      });
    }

    message += `\n💰 <b>취소 정보</b>\n`;
    message += `────────────────\n`;
    message += `취소 금액: ${reservation.totalPrice?.toLocaleString()}원\n`;
    message += `취소 사유: ${cancellationData?.reason || '고객 요청'}\n`;

    if (cancellationData?.refundAmount !== undefined) {
      message += `\n💵 <b>환불 정보</b>\n`;
      message += `────────────────\n`;
      message += `환불 금액: ${cancellationData.refundAmount.toLocaleString()}원`;
      if (cancellationData.refundRate) {
        message += ` (${cancellationData.refundRate}%)`;
      }
      message += '\n';

      if (cancellationData.cancellationFee && cancellationData.cancellationFee > 0) {
        message += `취소 수수료: ${cancellationData.cancellationFee.toLocaleString()}원\n`;
      }
    }

    if (reservation.memo && reservation.memo.trim()) {
      message += `\n📝 <b>예약 메모</b>\n`;
      message += `────────────────\n`;
      message += `${reservation.memo}\n`;
    }

    message += `\n#예약취소 #${reservation.roomName.replace(/\s/g, '')}`;

    const result = await this.sendMessage(message);
    console.log('❌ [텔레그램] 취소 알림 발송 완료:', result);
    return result;
  }

  // 일일 요약 리포트
  async sendDailySummary(data) {
    const message = `
📊 <b>오늘의 펜션 현황</b>
${new Date().toLocaleDateString('ko-KR')}

<b>📥 입실 예정: ${data.checkInCount}건</b>
${data.checkInList.map(r => `  • ${r.roomName} - ${r.customerName}`).join('\n')}

<b>📤 퇴실 예정: ${data.checkOutCount}건</b>
${data.checkOutList.map(r => `  • ${r.roomName} - ${r.customerName}`).join('\n')}

<b>🏠 현재 투숙: ${data.currentStayCount}/${data.totalRooms}</b>

<b>💰 오늘 매출: ${data.todayRevenue?.toLocaleString()}원</b>
<b>📈 이번달 매출: ${data.monthRevenue?.toLocaleString()}원</b>

#일일리포트
    `.trim();

    return await this.sendMessage(message);
  }

  // 예약 출처 이름 변환
  getSourceName(source) {
    const sourceMap = {
      'naver_place': '네이버 플레이스',
      'naver_booking': '네이버 펜션예약',
      'naver_map': '네이버 지도',
      'transfer': '이체예약',
      'group': '단체예약',
      '막기': '관리자 막기',
      'etc': '기타',
      '네이버 플레이스': '네이버 플레이스',
      '네이버 펜션예약': '네이버 펜션예약',
      '네이버 지도': '네이버 지도',
      '이체예약': '이체예약',
      '단체예약': '단체예약',
      '기타': '기타'
    };
    return sourceMap[source] || source || '기타';
  }

  // 박수 계산
  calculateNights(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // 연결 테스트 (Cloud Function 통해)
  // businessType: 'choho' 또는 'shelter'
  async testConnection(businessType = 'choho') {
    try {
      const response = await fetch(this.testFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ businessType })
      });

      const result = await response.json();

      if (result.success) {
        return true;
      }
      console.error('텔레그램 연결 테스트 실패:', result.error);
      return false;
    } catch (error) {
      console.error('텔레그램 연결 테스트 실패:', error);
      return false;
    }
  }

  // 하위 호환성을 위한 initialize 메서드 (더 이상 사용하지 않음)
  initialize(config) {
    console.log('📱 [INFO] telegramService.initialize() - Cloud Functions 사용으로 토큰 불필요');
  }
}

// 싱글톤 인스턴스
const telegramService = new TelegramService();
export default telegramService;
