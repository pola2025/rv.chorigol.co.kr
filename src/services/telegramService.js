// src/services/telegramService.js

class TelegramService {
  constructor() {
    this.config = null;
  }

  // 설정 초기화
  initialize(config) {
    this.config = config;
  }

  // 호수뷰객실 전용 추가 채널 ID
  static LAKE_VIEW_CHAT_ID = '-1002863320782';

  // 메시지 발송 (targetChatId가 있으면 해당 채널로, 없으면 기본 채널로 발송)
  async sendMessage(text, parseMode = 'HTML', targetChatId = null) {
    console.log('📱 [DEBUG] Telegram sendMessage 시작');
    console.log('📱 [DEBUG] Config:', this.config);

    if (!this.config) {
      console.error('📱 [DEBUG] 텔레그램 설정이 초기화되지 않았습니다.');
      throw new Error('텔레그램 설정이 초기화되지 않았습니다.');
    }

    const { botToken, chatId: defaultChatId } = this.config;
    const chatId = targetChatId || defaultChatId;
    
    console.log('📱 [DEBUG] Bot Token:', botToken ? `${botToken.substring(0, 10)}...` : 'undefined');
    console.log('📱 [DEBUG] Chat ID:', chatId);
    
    if (!botToken || !chatId) {
      console.error('📱 [DEBUG] Bot token or chat ID is missing:', { botToken: !!botToken, chatId: !!chatId });
      throw new Error('Bot token 또는 chat ID가 없습니다.');
    }
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    console.log('📱 [DEBUG] Telegram API URL:', url.replace(botToken, 'BOT_TOKEN'));
    console.log('📱 [DEBUG] Message length:', text.length);
    console.log('📱 [DEBUG] Message preview:', text.substring(0, 100) + '...');

    try {
      console.log('📱 [DEBUG] Fetch 요청 시작');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: parseMode,
          disable_web_page_preview: true
        })
      });

      console.log('📱 [DEBUG] Response status:', response.status);
      const result = await response.json();
      console.log('📱 [DEBUG] Response result:', result);

      if (result.ok) {
        console.log('📱 [DEBUG] 텔레그램 발송 성공, message_id:', result.result.message_id);
        
        // 발송 성공 로그
        await this.logNotification({
          type: 'telegram',
          recipient: chatId,
          content: text,
          status: 'success',
          messageId: result.result.message_id,
          sentAt: new Date()
        });

        return {
          success: true,
          messageId: result.result.message_id
        };
      } else {
        console.error('📱 [DEBUG] 텔레그램 발송 실패:', result);
        throw new Error(result.description || '발송 실패');
      }
    } catch (error) {
      console.error('📱 [DEBUG] Telegram sendMessage 오류:', error);
      console.error('📱 [DEBUG] Error stack:', error.stack);
      
      // 발송 실패 로그
      await this.logNotification({
        type: 'telegram',
        recipient: chatId,
        content: text,
        status: 'failed',
        error: error.message,
        sentAt: new Date()
      });

      throw error;
    }
  }

  // 예약 확정 알림 (개선된 버전)
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
            includedOptions.push({
              name: option.name,
              price: option.price || 20000
            });
            includedOptionPrice += (option.price || 20000);
          } else if (option.name === '숯불바베큐') {
            onsiteOptions.push({
              name: option.name,
              price: option.price || 30000
            });
            onsiteOptionPrice += (option.price || 30000);
          } else if (option.name === '레이트 체크아웃') {
            includedOptions.push({
              name: option.name,
              price: 0
            });
          }
        } else if (typeof option === 'string') {
          // 문자열로 저장된 경우 처리
          if (option === 'camping_burner' || option === '캠핑버너&그릴') {
            includedOptions.push({
              name: '캠핑버너&그릴',
              price: 20000
            });
            includedOptionPrice += 20000;
          } else if (option === 'charcoal_bbq' || option === '숯불바베큐') {
            onsiteOptions.push({
              name: '숯불바베큐',
              price: 30000
            });
            onsiteOptionPrice += 30000;
          } else if (option === 'late_checkout' || option === '레이트 체크아웃') {
            includedOptions.push({
              name: '레이트 체크아웃',
              price: 0
            });
          }
        }
      });
    }
    
    // 숙박 요금 계산 (옵션 제외)
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
    
    // 추가 인원이 있을 경우에만 표시
    if (extraGuests > 0) {
      message += ` (기준 ${baseGuests}명 + 추가 ${extraGuests}명)`;
    }
    message += '\n';
    
    // 가격 상세 정보
    message += `\n💰 <b>결제 정보</b>\n`;
    message += `────────────────\n`;
    
    // 숙박 요금
    message += `객실 요금: ${basePrice.toLocaleString()}원\n`;
    
    // 추가 인원 요금
    if (extraGuests > 0) {
      message += `인원 추가: ${extraGuestPrice.toLocaleString()}원 (${extraGuests}명 × ${nights}박)\n`;
    }
    
    // 포함된 옵션
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
    
    // 결제 금액 합계
    const totalPaidAmount = reservation.totalPrice || 
                           (basePrice + extraGuestPrice + includedOptionPrice);
    message += `────────────────\n`;
    message += `<b>총 결제금액: ${totalPaidAmount.toLocaleString()}원</b>\n`;
    
    // 현장 결제 옵션
    if (onsiteOptions.length > 0) {
      message += `\n💳 <b>현장 결제</b>\n`;
      message += `────────────────\n`;
      onsiteOptions.forEach(opt => {
        message += `• ${opt.name}: ${opt.price.toLocaleString()}원\n`;
      });
      message += `────────────────\n`;
      message += `<b>현장 결제금액: ${onsiteOptionPrice.toLocaleString()}원</b>\n`;
    }
    
    // 예약 출처
    message += `\n📍 출처: ${this.getSourceName(reservation.source)}`;
    
    // 메모가 있으면 추가 (더 눈에 띄게 표시)
    if (reservation.memo && reservation.memo.trim()) {
      message += `\n\n📝 <b>메모</b>\n`;
      message += `────────────────\n`;
      message += `${reservation.memo}`;
    }
    
    // 해시태그
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
        // 추가 채널 발송 실패는 전체 프로세스를 중단하지 않음
      }
    }

    return result;
  }

  // 예약 취소 알림 (개선된 버전)
  async sendCancellationNotification(reservation, cancellationData) {
    console.log('❌ [텔레그램] 취소 알림 시작');
    console.log('❌ [텔레그램] reservation:', reservation);
    console.log('❌ [텔레그램] cancellationData:', cancellationData);
    
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
    
    // 취소된 옵션 정보 파싱
    let cancelledOptions = [];
    let cancelledOptionsPrice = 0;
    
    if (reservation.options && reservation.options.length > 0) {
      reservation.options.forEach(option => {
        if (typeof option === 'object') {
          cancelledOptions.push(option.name);
          if (option.name === '캠핑버너&그릴') {
            cancelledOptionsPrice += (option.price || 20000);
          } else if (option.name === '숯불바베큐') {
            // 현장결제는 취소 금액에 포함하지 않음
          }
        } else if (typeof option === 'string') {
          if (option === 'camping_burner' || option === '캠핑버너&그릴') {
            cancelledOptions.push('캠핑버너&그릴');
            cancelledOptionsPrice += 20000;
          } else if (option === 'charcoal_bbq' || option === '숯불바베큐') {
            cancelledOptions.push('숯불바베큐');
          } else if (option === 'late_checkout' || option === '레이트 체크아웃') {
            cancelledOptions.push('레이트 체크아웃');
          }
        }
      });
    }
    
    // 메시지 구성
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
    
    // 취소된 옵션
    if (cancelledOptions.length > 0) {
      message += `\n📦 취소된 옵션:\n`;
      cancelledOptions.forEach(opt => {
        message += `• ${opt}\n`;
      });
    }
    
    // 취소 금액 정보
    message += `\n💰 <b>취소 정보</b>\n`;
    message += `────────────────\n`;
    message += `취소 금액: ${reservation.totalPrice?.toLocaleString()}원\n`;
    message += `취소 사유: ${cancellationData?.reason || '고객 요청'}\n`;
    
    // 환불 정보
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
    
    // 메모가 있으면 추가 (취소 시에도 메모 표시)
    if (reservation.memo && reservation.memo.trim()) {
      message += `\n📝 <b>예약 메모</b>\n`;
      message += `────────────────\n`;
      message += `${reservation.memo}\n`;
    }
    
    // 해시태그
    message += `\n#예약취소 #${reservation.roomName.replace(/\s/g, '')}`;
    
    console.log('❌ [텔레그램] 취소 알림 메시지 발송 시작');
    console.log('❌ [텔레그램] 메시지:', message);
    
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
      // 혹시 한글로 저장된 경우도 처리
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

  // 발송 로그 저장
  async logNotification(logData) {
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      await addDoc(collection(db, 'notification_logs'), {
        ...logData,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('로그 저장 실패:', error);
    }
  }

  // 연결 테스트
  async testConnection() {
    try {
      const { botToken } = this.config;
      const url = `https://api.telegram.org/bot${botToken}/getMe`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.ok) {
        // 테스트 메시지 발송
        await this.sendMessage('✅ 텔레그램 연결 테스트 성공!');
        return true;
      }
      return false;
    } catch (error) {
      console.error('텔레그램 연결 테스트 실패:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스
const telegramService = new TelegramService();
export default telegramService;