// src/services/notificationService.js
// 통합 알림 서비스 (SMS + 텔레그램)

import sensService from './sensService';
import telegramService from './telegramService';
import notificationValidator from '../utils/notificationValidator';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class NotificationService {
  constructor() {
    this.initialized = false;
    this.settings = {
      choho: null,
      shelter: null
    };
  }

  // 초기화
  async initialize() {
    if (this.initialized) return;

    try {
      // 초호펜션 설정 로드
      const chohoDoc = await getDoc(doc(db, 'settings', 'notifications_v2_choho'));
      if (chohoDoc.exists()) {
        this.settings.choho = chohoDoc.data();
        
        // SENS 초기화
        if (this.settings.choho?.globalSettings?.sens) {
          sensService.initialize(this.settings.choho.globalSettings.sens);
        }
        
        // 텔레그램 초기화
        if (this.settings.choho?.globalSettings?.telegram) {
          telegramService.initialize(this.settings.choho.globalSettings.telegram);
        }
      }

      // 초호쉼터 설정 로드
      const shelterDoc = await getDoc(doc(db, 'settings', 'notifications_v2_shelter'));
      if (shelterDoc.exists()) {
        this.settings.shelter = shelterDoc.data();
      }

      this.initialized = true;
      console.log('🎉 [INIT] NotificationService 초기화 완료');
      console.log('🎉 [INIT] 초호펜션 텔레그램 설정:', this.settings.choho?.globalSettings?.telegram);
      console.log('🎉 [INIT] 초호쉼터 텔레그램 설정:', this.settings.shelter?.globalSettings?.telegram);
      
      // 텔레그램 취소 알림 설정 상태 확인
      if (this.settings.choho?.globalSettings?.telegram) {
        const tg = this.settings.choho.globalSettings.telegram;
        console.log('❌ [INIT] 텔레그램 취소 알림 설정:', {
          botToken: tg.botToken ? 'SET' : 'NOT SET',
          chatId: tg.chatId || 'NOT SET',
          useCancellation: tg.useCancellation,
          useReservation: tg.useReservation
        });
      }
    } catch (error) {
      console.error('NotificationService 초기화 실패:', error);
    }
  }

  // 객실명으로 적절한 설정 가져오기
  getSettingsForRoom(roomName) {
    const isChoho = roomName && roomName.includes('Forest');
    const settings = isChoho ? this.settings.choho : this.settings.shelter;
    
    if (!settings) {
      console.warn(`No settings found for room: ${roomName}`);
      return null;
    }

    return {
      global: settings.globalSettings,
      room: settings.roomSettings?.[roomName] || null
    };
  }

  // 예약출처 ID를 한글로 변환
  getSourceName(source) {
    const sourceMap = {
      'naver_place': '네이버 플레이스',
      'naver_booking': '네이버 펜션예약',
      'naver_map': '네이버 지도',
      'transfer': '이체예약',
      'group': '단체예약',
      'etc': '기타',
      '막기': '관리자 막기',
      // 한글로 저장된 경우도 처리
      '네이버 플레이스': '네이버 플레이스',
      '네이버 펜션예약': '네이버 펜션예약',
      '네이버 지도': '네이버 지도',
      '이체예약': '이체예약',
      '단체예약': '단체예약',
      '기타': '기타'
    };
    return sourceMap[source] || source || '기타';
  }

  // 새 예약 알림 발송 (텔레그램만)
  async sendNewReservationNotifications(reservation) {
    console.log('📬 [DEBUG] sendNewReservationNotifications 시작:', reservation);

    if (!this.initialized) {
      console.log('📬 [DEBUG] 초기화 필요, initialize 호출');
      await this.initialize();
    }

    const roomName = reservation.roomName || reservation.room;
    const settings = this.getSettingsForRoom(roomName);

    const results = {
      telegram: null
    };

    // 텔레그램 알림 발송 (새 예약)
    if (settings?.global?.telegram?.useReservation) {
      try {
        // 예약출처 한글 변환
        const sourceName = this.getSourceName(reservation.source);

        // 옵션 정보 파싱
        let includedOptions = [];
        let onsiteOptions = [];
        let includedOptionPrice = 0;
        let onsiteOptionPrice = 0;

        if (reservation.options && reservation.options.length > 0) {
          reservation.options.forEach(option => {
            let optName = '';
            let optPrice = 0;

            if (typeof option === 'object') {
              optName = option.name || '';
              optPrice = option.price || 0;
            } else if (typeof option === 'string') {
              // 문자열 옵션 처리
              if (option === 'camping_burner') {
                optName = '캠핑버너&그릴';
                optPrice = 20000;
              } else if (option === 'charcoal_bbq') {
                optName = '숯불바베큐';
                optPrice = 30000;
              } else if (option === 'late_checkout') {
                optName = '레이트 체크아웃';
                optPrice = 0;
              } else {
                optName = option;
              }
            }

            if (optName) {
              // 숯불바베큐는 현장결제
              if (optName === '숯불바베큐') {
                onsiteOptions.push({ name: optName, price: optPrice });
                onsiteOptionPrice += optPrice;
              } else {
                includedOptions.push({ name: optName, price: optPrice });
                if (optName !== '레이트 체크아웃') {
                  includedOptionPrice += optPrice;
                }
              }
            }
          });
        }

        // 메시지 구성
        let message = `🆕 새 예약\n\n`;
        message += `고객명: ${reservation.customerName}\n`;
        message += `연락처: ${reservation.phone || reservation.customerPhone}\n`;
        message += `객실: ${roomName}\n`;
        message += `일정: ${reservation.checkIn} ~ ${reservation.checkOut}\n`;
        message += `인원: ${reservation.guests || reservation.guestCount || 2}명\n`;
        message += `금액: ${(reservation.totalPrice || 0).toLocaleString()}원\n`;
        message += `예약출처: ${sourceName}\n`;
        message += `상태: ${reservation.status || '입금대기'}`;

        // 옵션 정보 추가
        if (includedOptions.length > 0) {
          message += `\n\n📦 옵션:\n`;
          includedOptions.forEach(opt => {
            if (opt.price > 0) {
              message += `• ${opt.name}: ${opt.price.toLocaleString()}원\n`;
            } else {
              message += `• ${opt.name}\n`;
            }
          });
        }

        // 현장결제 정보 추가
        if (onsiteOptions.length > 0 || onsiteOptionPrice > 0) {
          message += `\n💳 현장결제:\n`;
          onsiteOptions.forEach(opt => {
            message += `• ${opt.name}: ${opt.price.toLocaleString()}원\n`;
          });
          message += `현장결제 합계: ${onsiteOptionPrice.toLocaleString()}원`;
        }

        // 특이사항(메모) 추가
        if (reservation.memo && reservation.memo.trim()) {
          message += `\n\n📝 특이사항:\n${reservation.memo}`;
        }

        results.telegram = await telegramService.sendMessage(message);
        console.log('📬 [DEBUG] 텔레그램 알림 발송 완료');

        // 호수뷰객실인 경우 전용 채널로 추가 발송
        if (roomName && roomName.includes('호수뷰')) {
          try {
            const LAKE_VIEW_CHAT_ID = '-1002863320782';
            console.log('🏞️ [DEBUG] 호수뷰객실 예약 - 전용 채널로 발송');
            await telegramService.sendMessage(message, 'HTML', LAKE_VIEW_CHAT_ID);
            console.log('🏞️ [DEBUG] 호수뷰객실 전용 채널 발송 완료');
          } catch (lakeViewError) {
            console.error('🏞️ [ERROR] 호수뷰객실 전용 채널 발송 실패:', lakeViewError);
            // 전용 채널 발송 실패는 전체 프로세스를 중단하지 않음
          }
        }
      } catch (error) {
        console.error('📬 [ERROR] 텔레그램 알림 발송 실패:', error);
        results.telegram = { error: error.message };
      }
    }

    return results;
  }

  // 예약 확정 알림 발송
  async sendConfirmationNotifications(reservation) {
    console.log('📬 [DEBUG] sendConfirmationNotifications 시작:', reservation);
    
    if (!this.initialized) {
      console.log('📬 [DEBUG] 초기화 필요, initialize 호출');
      await this.initialize();
    }
    
    // 알림 발송 전 검증
    const validation = await notificationValidator.preValidate(reservation, 'confirmation');
    console.log('📬 [VALIDATION] 예약 확정 알림 검증 결과:', validation);
    
    if (!validation.canSend) {
      console.warn('📬 [VALIDATION] 알림 발송 불가:', validation.reason);
      return {
        sms: { skipped: true, reason: validation.reason },
        telegram: null
      };
    }

    // 고정 수신 번호 사용 (관리자 번호)
    const ADMIN_PHONE = '010-9897-9834';
    console.log('📬 [DEBUG] SMS 수신번호 (고정):', ADMIN_PHONE);

    const roomName = reservation.roomName || reservation.room;
    console.log('📬 [DEBUG] 객실명:', roomName);
    console.log('📬 [DEBUG] 예약자:', reservation.customerName);
    console.log('📬 [DEBUG] 예약자 번호:', reservation.phone || reservation.customerPhone);
    
    const settings = this.getSettingsForRoom(roomName);
    console.log('📬 [DEBUG] 설정 정보:', JSON.stringify(settings, null, 2));
    
    if (!settings) {
      console.error('📬 [DEBUG] No notification settings found for room:', roomName);
      return;
    }

    const results = {
      sms: null,
      telegram: null
    };

    // SMS 발송 조건 디버깅
    console.log('📬 [DEBUG] SMS 발송 조건 체크:', {
      'settings.room': !!settings.room,
      'settings.room?.enabled': settings.room?.enabled,
      'settings.room?.autoSend': !!settings.room?.autoSend,
      'settings.room?.autoSend?.confirmationEnabled': settings.room?.autoSend?.confirmationEnabled,
      'global.sens': !!settings.global?.sens,
      'global.sens.serviceId': settings.global?.sens?.serviceId,
      'will_send_sms': settings.room?.enabled !== false && settings.room?.autoSend?.confirmationEnabled
    });

    // SMS 발송 (객실 설정 확인)
    if (settings.room?.enabled !== false && settings.room?.autoSend?.confirmationEnabled) {
      try {
        const template = settings.room?.templates?.confirmation || 
                        await sensService.getTemplate('confirmation', roomName);
        
        const message = sensService.generateMessage(template.content || template, {
          customerName: reservation.customerName,
          roomName: roomName,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          guests: reservation.guests,
          totalPrice: reservation.totalPrice,
          pensionPhone: '010-7932-0029',
          pensionAddress: '경기도 파주시 법원읍 초리골길 134'
        });

        const phoneNumber = reservation.phone || reservation.customerPhone;
        console.log('📬 [DEBUG] SMS 발송 시도 - 전화번호:', phoneNumber);
        console.log('📬 [DEBUG] SMS 발송 메시지:', message);
        console.log('📬 [DEBUG] 예약 ID:', reservation.id);
        
        if (!phoneNumber) {
          throw new Error('전화번호가 없습니다');
        }
        
        results.sms = await sensService.sendSMS(
          phoneNumber,
          message,
          reservation.id
        );
        console.log('📬 [DEBUG] SMS sent successfully:', results.sms);
      } catch (error) {
        console.error('📬 [DEBUG] SMS 발송 실패:', error);
        console.error('📬 [DEBUG] SMS 에러 스택:', error.stack);
        results.sms = { error: error.message };
      }
    } else {
      console.log('📬 [DEBUG] SMS 발송 스킵 - 조건 미충족');
    }

    // 텔레그램 알림 체크
    console.log('📬 [DEBUG] 텔레그램 발송 조건 체크:', {
      hasTelegram: !!settings.global?.telegram,
      useReservation: settings.global?.telegram?.useReservation,
      shouldSend: settings.global?.telegram?.useReservation
    });

    // 텔레그램 알림 (관리자용)
    if (settings.global?.telegram?.useReservation) {
      try {
        console.log('📬 [DEBUG] 텔레그램 예약 확정 알림 발송');
        // sendReservationNotification 메서드 호출
        results.telegram = await telegramService.sendReservationNotification(reservation);
        console.log('📬 [DEBUG] 텔레그램 발송 완료:', results.telegram);
      } catch (error) {
        console.error('📬 [DEBUG] 텔레그램 발송 실패:', error);
        console.error('📬 [DEBUG] 텔레그램 에러 스택:', error.stack);
        results.telegram = { error: error.message };
      }
    } else {
      console.log('📬 [DEBUG] 텔레그램 발송 스킵 (설정 비활성화)');
    }

    console.log('📬 [DEBUG] sendConfirmationNotifications 완료:', results);
    return results;
  }



  // 예약 취소 알림 발송
  async sendCancellationNotifications(reservation) {
    console.log('❌ [CANCEL DEBUG] 예약 취소 알림 시작:', reservation);
    
    if (!this.initialized) {
      console.log('❌ [CANCEL DEBUG] 초기화 필요, initialize 호출');
      await this.initialize();
    }
    
    // 알림 발송 전 검증
    const validation = await notificationValidator.preValidate(reservation, 'cancellation');
    console.log('❌ [VALIDATION] 예약 취소 알림 검증 결과:', validation);
    
    if (!validation.canSend) {
      console.warn('❌ [VALIDATION] 알림 발송 불가:', validation.reason);
      return {
        sms: { skipped: true, reason: validation.reason },
        telegram: null
      };
    }

    const roomName = reservation.roomName || reservation.room;
    console.log('❌ [CANCEL DEBUG] 객실명:', roomName);
    
    const settings = this.getSettingsForRoom(roomName);
    console.log('❌ [CANCEL DEBUG] 설정 정보:', JSON.stringify(settings, null, 2));
    
    if (!settings) {
      console.error('❌ [CANCEL DEBUG] No notification settings found for room:', roomName);
      return;
    }

    const results = {
      sms: null,
      telegram: null
    };

    // SMS 발송 (객실 설정 확인)
    if (settings.room?.enabled !== false && settings.room?.autoSend?.cancellationEnabled) {
      try {
        const template = settings.room?.templates?.cancellation || 
                        await sensService.getTemplate('cancellation', roomName);
        
        const message = sensService.generateMessage(template.content || template, {
          customerName: reservation.customerName,
          roomName: roomName,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          guests: reservation.guests,
          totalPrice: reservation.totalPrice,
          pensionPhone: '010-7932-0029',
          pensionAddress: '경기도 파주시 법원읍 초리골길 134'
        });

        results.sms = await sensService.sendSMS(
          reservation.phone,
          message,
          reservation.id
        );
        console.log('SMS sent successfully:', results.sms);
      } catch (error) {
        console.error('SMS 발송 실패:', error);
        results.sms = { error: error.message };
      }
    }

    // 텔레그램 알림 (관리자용)
    console.log('❌ [CANCEL DEBUG] 텔레그램 발송 조건:', {
      hasTelegram: !!settings.global?.telegram,
      useCancellation: settings.global?.telegram?.useCancellation,
      botToken: !!settings.global?.telegram?.botToken,
      chatId: !!settings.global?.telegram?.chatId
    });
    
    if (settings.global?.telegram?.useCancellation) {
      try {
        console.log('❌ [CANCEL DEBUG] 텔레그램 취소 알림 발송');
        
        // cancellationData 추출
        const cancellationData = {
          reason: reservation.cancelReason || reservation.reason || '고객 요청',
          refundAmount: reservation.refundAmount || 0,
          refundRate: reservation.refundRate || 0,
          cancellationFee: reservation.cancellationFee || 0
        };
        
        console.log('❌ [CANCEL DEBUG] cancellationData:', cancellationData);
        
        // sendCancellationNotification 메서드 호출
        results.telegram = await telegramService.sendCancellationNotification(reservation, cancellationData);
        console.log('❌ [CANCEL DEBUG] Telegram sent successfully:', results.telegram);
      } catch (error) {
        console.error('❌ [CANCEL DEBUG] 텔레그램 발송 실패:', error);
        console.error('❌ [CANCEL DEBUG] 텔레그램 에러 스택:', error.stack);
        results.telegram = { error: error.message };
      }
    } else {
      console.log('❌ [CANCEL DEBUG] 텔레그램 발송 스킵 (설정 비활성화)');
    }

    return results;
  }

  // 텔레그램 메시지 포맷
  formatTelegramMessage(reservation, type, isCancellation = false) {
    const roomName = reservation.roomName || reservation.room;
    const pension = roomName.includes('Forest') ? '초호펜션' : '초호쉼터';
    const icon = isCancellation ? '❌' : (type === '예약 확정' ? '✅' : '🆕');
    
    let message = `${icon} **${type}** - ${pension}\n`;
    message += `━━━━━━━━━━━━━━━\n`;
    message += `👤 고객명: ${reservation.customerName}\n`;
    message += `📱 연락처: ${this.formatPhone(reservation.phone)}\n`;
    message += `🏠 객실: ${roomName}\n`;
    message += `📅 체크인: ${this.formatDate(reservation.checkIn)}\n`;
    message += `📅 체크아웃: ${this.formatDate(reservation.checkOut)}\n`;
    
    // 인원 표시 개선
    const baseGuests = this.getBaseGuests(roomName);
    const guests = reservation.guests || baseGuests;
    const extraGuests = guests - baseGuests;
    if (extraGuests > 0) {
      message += `👥 인원: ${guests}명 (기준 ${baseGuests}명 + 추가 ${extraGuests}명)\n`;
    } else {
      message += `👥 인원: ${guests}명\n`;
    }
    
    // 요금 내역 상세
    message += `\n💰 **요금 내역**\n`;
    
    // 객실 요금
    const basePrice = reservation.basePrice || reservation.totalPrice || 0;
    const nights = this.calculateNights(reservation.checkIn, reservation.checkOut);
    message += `├ 객실요금: ${basePrice.toLocaleString()}원`;
    if (nights > 1) message += ` (${nights}박)`;
    message += `\n`;
    
    // 추가인원 요금
    if (reservation.extraGuestPrice && reservation.extraGuestPrice > 0) {
      message += `├ 추가인원: ${reservation.extraGuestPrice.toLocaleString()}원`;
      if (extraGuests > 0) message += ` (${extraGuests}명)`;
      message += `\n`;
    }
    
    // 옵션 처리
    const includedOptions = [];
    const onsiteOptions = [];
    
    if (reservation.options && reservation.options.length > 0) {
      reservation.options.forEach(option => {
        let optionName = '';
        let optionPrice = 0;
        
        if (typeof option === 'string') {
          optionName = option;
        } else if (typeof option === 'object' && option !== null) {
          optionName = option.name || '';
          optionPrice = option.price || 0;
        }
        
        if (optionName) {
          // 현장결제 옵션 구분
          if (optionName.toLowerCase().includes('바베큐') || 
              optionName.toLowerCase().includes('bbq') ||
              optionName.toLowerCase().includes('알파카')) {
            onsiteOptions.push({ name: optionName, price: optionPrice });
          } else if (optionName !== '레이트 체크아웃') {
            includedOptions.push({ name: optionName, price: optionPrice });
          }
        }
      });
    }
    
    // 포함 옵션 표시
    includedOptions.forEach(opt => {
      message += `├ ${opt.name}: `;
      message += opt.price > 0 ? `${opt.price.toLocaleString()}원\n` : '포함\n';
    });
    
    // 레이트 체크아웃은 별도 표시
    const hasLateCheckout = reservation.options?.some(opt => {
      const name = typeof opt === 'object' ? opt.name : opt;
      return name && name.includes('레이트 체크아웃');
    });
    if (hasLateCheckout) {
      message += `├ 레이트 체크아웃: 오후 2시\n`;
    }
    
    // 총 금액
    message += `└ 총 금액: ${(reservation.totalPrice || 0).toLocaleString()}원\n`;
    
    // 현장결제 옵션
    if (onsiteOptions.length > 0) {
      message += `\n💳 **현장결제**\n`;
      onsiteOptions.forEach((opt, idx) => {
        const isLast = idx === onsiteOptions.length - 1;
        message += `${isLast ? '└' : '├'} ${opt.name}: ${opt.price.toLocaleString()}원\n`;
      });
    }
    
    // 메모
    if (reservation.memo) {
      message += `\n📝 메모: ${reservation.memo}\n`;
    }
    
    message += `⏰ ${type} 시간: ${new Date().toLocaleString('ko-KR')}`;
    
    return message;
  }

  // 날짜 포맷
  formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
    } catch {
      return dateString;
    }
  }

  // 전화번호 포맷
  formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.substr(0, 3)}-${cleaned.substr(3, 4)}-${cleaned.substr(7, 4)}`;
    }
    if (cleaned.length === 10) {
      return `${cleaned.substr(0, 3)}-${cleaned.substr(3, 3)}-${cleaned.substr(6, 4)}`;
    }
    return phone;
  }

  // 박수 계산
  calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  }

  // 객실 기준인원 가져오기
  getBaseGuests(roomName) {
    if (!roomName) return 2;
    
    const name = roomName.toLowerCase();
    
    // Forest 패밀리, Forest_Mini 패밀리는 4인 기준
    if ((name.includes('forest') || name.includes('forest_mini')) && name.includes('패밀리')) {
      return 4;
    }
    
    // 호수뷰는 4인 기준
    if (name.includes('호수뷰')) {
      return 4;
    }
    
    // 그 외 Forest, Forest_Mini 일반 객실은 2인 기준
    if (name.includes('forest') || name.includes('forest_mini')) {
      return 2;
    }
    
    // 기본값 2인
    return 2;
  }

  // 입실 안내 발송 (자동 스케줄러용)
  async sendCheckInNotifications(reservation) {
    if (!this.initialized) {
      await this.initialize();
    }

    const roomName = reservation.roomName || reservation.room;
    const settings = this.getSettingsForRoom(roomName);
    
    if (!settings?.room?.enabled || !settings.room?.autoSend?.checkInEnabled) {
      console.log('Check-in notification disabled for room:', roomName);
      return;
    }

    try {
      const template = settings.room?.templates?.checkIn || 
                      await sensService.getTemplate('checkIn', roomName);
      
      const message = sensService.generateMessage(template.content || template, {
        customerName: reservation.customerName,
        roomName: roomName,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        guests: reservation.guests,
        totalPrice: reservation.totalPrice,
        pensionPhone: '010-7932-0029',
        pensionAddress: '경기도 파주시 법원읍 초리골길 134'
      });

      const result = await sensService.sendSMS(
        reservation.phone,
        message,
        reservation.id
      );
      console.log('Check-in SMS sent:', result);
      return result;
    } catch (error) {
      console.error('입실 안내 발송 실패:', error);
      throw error;
    }
  }

  // 퇴실 안내 발송 (자동 스케줄러용)
  async sendCheckOutNotifications(reservation) {
    if (!this.initialized) {
      await this.initialize();
    }

    const roomName = reservation.roomName || reservation.room;
    const settings = this.getSettingsForRoom(roomName);
    
    if (!settings?.room?.enabled || !settings.room?.autoSend?.checkOutEnabled) {
      console.log('Check-out notification disabled for room:', roomName);
      return;
    }

    try {
      const template = settings.room?.templates?.checkOut || 
                      await sensService.getTemplate('checkOut', roomName);
      
      const message = sensService.generateMessage(template.content || template, {
        customerName: reservation.customerName,
        roomName: roomName,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        guests: reservation.guests,
        totalPrice: reservation.totalPrice,
        pensionPhone: '010-7932-0029',
        pensionAddress: '경기도 파주시 법원읍 초리골길 134'
      });

      const result = await sensService.sendSMS(
        reservation.phone,
        message,
        reservation.id
      );
      console.log('Check-out SMS sent:', result);
      return result;
    } catch (error) {
      console.error('퇴실 안내 발송 실패:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
const notificationService = new NotificationService();
export default notificationService;