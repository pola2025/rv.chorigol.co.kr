// src/services/notificationService.js
// 통합 알림 서비스 (SMS + 텔레그램)

import sensService from './sensService';
import telegramService from './telegramService';
import notificationValidator from '../utils/notificationValidator';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class NotificationService {
  constructor() {
    this.initialized = false;
    this.settings = {
      choho: null,
      shelter: null
    };
  }

  // 설정 강제 새로고침 (알림 발송 시마다 호출)
  async refreshSettings() {
    console.log('📬 [REFRESH] =====================================');
    console.log('📬 [REFRESH] 설정 새로고침 시작');
    try {
      // 초호펜션 설정 로드
      const chohoDoc = await getDoc(doc(db, 'settings', 'notifications_v2_choho'));
      if (chohoDoc.exists()) {
        this.settings.choho = chohoDoc.data();

        console.log('📬 [REFRESH] 초호펜션 설정 로드됨');
        console.log('📬 [REFRESH] roomSettings 키:', Object.keys(this.settings.choho?.roomSettings || {}));

        // 각 객실별 confirmationEnabled 상태 출력
        if (this.settings.choho?.roomSettings) {
          Object.entries(this.settings.choho.roomSettings).forEach(([room, setting]) => {
            console.log(`📬 [REFRESH] ${room}: confirmationEnabled=${setting?.autoSend?.confirmationEnabled}`);
          });
        }

        // SENS 초기화
        if (this.settings.choho?.globalSettings?.sens) {
          sensService.initialize(this.settings.choho.globalSettings.sens);
        }

        // 텔레그램 초기화
        if (this.settings.choho?.globalSettings?.telegram) {
          telegramService.initialize(this.settings.choho.globalSettings.telegram);
        }
      } else {
        console.warn('📬 [REFRESH] ⚠️ notifications_v2_choho 문서가 없습니다!');
      }

      // 초호쉼터 설정 로드
      const shelterDoc = await getDoc(doc(db, 'settings', 'notifications_v2_shelter'));
      if (shelterDoc.exists()) {
        this.settings.shelter = shelterDoc.data();
        console.log('📬 [REFRESH] 초호쉼터 설정 로드됨');
        console.log('📬 [REFRESH] shelter roomSettings 키:', Object.keys(this.settings.shelter?.roomSettings || {}));

        // globalSettings.telegram이 없으면 기본값 설정
        if (!this.settings.shelter.globalSettings) {
          this.settings.shelter.globalSettings = {};
        }
        if (!this.settings.shelter.globalSettings.telegram) {
          this.settings.shelter.globalSettings.telegram = {
            useReservation: true,
            useCancellation: true
          };
          console.log('📬 [REFRESH] shelter telegram 기본값 설정됨');
        }
      } else {
        console.warn('📬 [REFRESH] ⚠️ notifications_v2_shelter 문서가 없습니다!');
        this.settings.shelter = {
          globalSettings: {
            telegram: { useReservation: true, useCancellation: true }
          },
          roomSettings: {}
        };
      }

      console.log('📬 [REFRESH] 설정 새로고침 완료');
      console.log('📬 [REFRESH] =====================================');
    } catch (error) {
      console.error('📬 [REFRESH] 설정 새로고침 실패:', error);
    }
  }

  // 초기화
  async initialize() {
    if (this.initialized) return;

    // 텔레그램은 Cloud Functions를 통해 발송 (토큰 불필요)
    // 채팅 ID 등 설정은 Firestore에서 관리

    try {
      // 초호펜션 설정 로드
      const chohoDoc = await getDoc(doc(db, 'settings', 'notifications_v2_choho'));
      if (chohoDoc.exists()) {
        this.settings.choho = chohoDoc.data();

        // SENS 초기화
        if (this.settings.choho?.globalSettings?.sens) {
          sensService.initialize(this.settings.choho.globalSettings.sens);
        }

        // 텔레그램은 Cloud Functions 사용으로 별도 초기화 불필요
        console.log('📬 [INIT] 텔레그램: Cloud Functions 사용');
      } else {
        // Firestore에 설정이 없으면 기본값 사용
        console.warn('📬 [INIT] notifications_v2_choho 문서가 없습니다.');
        this.settings.choho = {
          globalSettings: {
            telegram: { useReservation: true, useCancellation: true }
          },
          roomSettings: {}
        };
      }

      // 초호쉼터 설정 로드
      const shelterDoc = await getDoc(doc(db, 'settings', 'notifications_v2_shelter'));
      if (shelterDoc.exists()) {
        this.settings.shelter = shelterDoc.data();
        // globalSettings.telegram이 없으면 기본값 설정
        if (!this.settings.shelter.globalSettings) {
          this.settings.shelter.globalSettings = {};
        }
        if (!this.settings.shelter.globalSettings.telegram) {
          this.settings.shelter.globalSettings.telegram = {
            useReservation: true,
            useCancellation: true
          };
          console.log('📬 [INIT] shelter telegram 기본값 설정됨');
        }
      } else {
        // Firestore에 설정이 없으면 기본값 사용
        console.warn('📬 [INIT] notifications_v2_shelter 문서가 없습니다.');
        this.settings.shelter = {
          globalSettings: {
            telegram: { useReservation: true, useCancellation: true }
          },
          roomSettings: {}
        };
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
    // 초호펜션 객실: Forest, Forest mini, Forest 패밀리, Forest mini 패밀리
    // 초호쉼터 객실: 호수뷰객실, 그 외
    const isChoho = roomName && roomName.includes('Forest') && !roomName.includes('호수뷰');
    const settingsType = isChoho ? 'choho' : 'shelter';
    const settings = isChoho ? this.settings.choho : this.settings.shelter;

    console.log('📬 [SETTINGS] =====================================');
    console.log('📬 [SETTINGS] 객실명:', roomName);
    console.log('📬 [SETTINGS] 설정 타입:', settingsType);
    console.log('📬 [SETTINGS] 전체 설정 존재:', !!settings);
    console.log('📬 [SETTINGS] roomSettings 키:', settings?.roomSettings ? Object.keys(settings.roomSettings) : 'NONE');

    if (!settings) {
      console.warn(`📬 [SETTINGS] ❌ No settings found for room: ${roomName}`);
      return null;
    }

    // 객실 설정 찾기 (정확히 일치하는 것 먼저, 없으면 유사 이름 시도)
    let roomSettings = settings.roomSettings?.[roomName];
    let matchMethod = '정확히 일치';

    console.log('📬 [SETTINGS] 정확히 일치하는 설정:', !!roomSettings);

    // 정확히 일치하는 설정이 없으면, roomSettings에서 유사한 이름 찾기
    if (!roomSettings && settings.roomSettings) {
      const roomKeys = Object.keys(settings.roomSettings);
      const matchedKey = roomKeys.find(key =>
        roomName.includes(key) || key.includes(roomName)
      );
      if (matchedKey) {
        roomSettings = settings.roomSettings[matchedKey];
        matchMethod = `유사 매칭: "${roomName}" → "${matchedKey}"`;
        console.log(`📬 [SETTINGS] ${matchMethod}`);
      }
    }

    // 기본값 설정: roomSettings가 없으면 명시적 설정 필요 (발송 안함)
    const defaultRoomSettings = {
      enabled: true,
      autoSend: {
        confirmationEnabled: false,  // 기본값: 사용자가 명시적으로 켜야 함
        cancellationEnabled: false   // 기본값: 사용자가 명시적으로 켜야 함
      }
    };

    const finalRoomSettings = roomSettings || defaultRoomSettings;

    console.log('📬 [SETTINGS] 최종 객실 설정:', {
      매칭방식: roomSettings ? matchMethod : '기본값 사용 (설정 없음)',
      enabled: finalRoomSettings.enabled,
      confirmationEnabled: finalRoomSettings.autoSend?.confirmationEnabled,
      cancellationEnabled: finalRoomSettings.autoSend?.cancellationEnabled
    });
    console.log('📬 [SETTINGS] =====================================');

    return {
      global: settings.globalSettings,
      room: finalRoomSettings
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

    console.log('📬 [DEBUG] sendNewReservationNotifications - settings:', {
      hasSettings: !!settings,
      hasGlobal: !!settings?.global,
      hasTelegram: !!settings?.global?.telegram,
      useReservation: settings?.global?.telegram?.useReservation,
      botToken: settings?.global?.telegram?.botToken ? 'SET' : 'NOT SET',
      chatId: settings?.global?.telegram?.chatId || 'NOT SET'
    });

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
    } else {
      console.warn('📬 [SKIP] 텔레그램 알림 발송 스킵 - useReservation이 false이거나 설정이 없습니다.');
      console.warn('📬 [SKIP] Firestore settings/notifications_v2_choho 문서에서 globalSettings.telegram.useReservation을 true로 설정하세요.');
      results.telegram = { skipped: true, reason: 'useReservation is not enabled' };
    }

    return results;
  }

  // 예약 확정 알림 발송
  async sendConfirmationNotifications(reservation) {
    console.log('📬 [DEBUG] sendConfirmationNotifications 시작:', reservation);

    // 초기화 및 설정 새로고침 (항상 최신 설정 사용)
    if (!this.initialized) {
      console.log('📬 [DEBUG] 초기화 필요, initialize 호출');
      await this.initialize();
    } else {
      // 이미 초기화됐어도 설정 새로고침
      await this.refreshSettings();
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

    // SMS 발송 조건: 명시적으로 활성화된 경우에만 발송
    const roomEnabled = settings.room?.enabled !== false;
    const confirmationEnabled = settings.room?.autoSend?.confirmationEnabled === true;
    const shouldSendSms = roomEnabled && confirmationEnabled;

    console.log('📬 [DEBUG] SMS 발송 조건 체크:', {
      'settings.room': !!settings.room,
      'settings.room?.enabled': settings.room?.enabled,
      'roomEnabled': roomEnabled,
      'confirmationEnabled': confirmationEnabled,
      'shouldSendSms': shouldSendSms
    });

    // SMS 발송 (명시적으로 활성화된 경우에만)
    if (shouldSendSms) {
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
          reservation.id,
          reservation  // 업체 구분을 위해 reservation 객체 전달
        );
        console.log('📬 [DEBUG] SMS sent successfully:', results.sms);

        // SMS 발송 성공 시 smsStatus 업데이트
        if (reservation.id && results.sms && !results.sms.error) {
          try {
            await updateDoc(doc(db, 'reservations', reservation.id), {
              'smsStatus.confirmationSent': true,
              'smsStatus.confirmationSentAt': new Date().toISOString()
            });
            console.log('📬 [DEBUG] smsStatus 업데이트 완료');
          } catch (updateError) {
            console.error('📬 [DEBUG] smsStatus 업데이트 실패:', updateError);
          }
        }
      } catch (error) {
        console.error('📬 [DEBUG] SMS 발송 실패:', error);
        console.error('📬 [DEBUG] SMS 에러 스택:', error.stack);
        results.sms = { error: error.message };

        // SMS 발송 실패 시 에러 상태 기록
        if (reservation.id) {
          try {
            await updateDoc(doc(db, 'reservations', reservation.id), {
              'smsStatus.confirmationError': error.message,
              'smsStatus.confirmationErrorAt': new Date().toISOString()
            });
          } catch (updateError) {
            console.error('📬 [DEBUG] smsStatus 에러 업데이트 실패:', updateError);
          }
        }
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

    // 초기화 및 설정 새로고침 (항상 최신 설정 사용)
    if (!this.initialized) {
      console.log('❌ [CANCEL DEBUG] 초기화 필요, initialize 호출');
      await this.initialize();
    } else {
      // 이미 초기화됐어도 설정 새로고침
      await this.refreshSettings();
    }
    
    // 알림 발송 전 검증 (SMS용)
    const validation = await notificationValidator.preValidate(reservation, 'cancellation');
    console.log('❌ [VALIDATION] 예약 취소 알림 검증 결과:', validation);

    // SMS 검증 실패해도 조기 리턴하지 않음 (텔레그램은 별도 처리)
    const smsValidationFailed = !validation.canSend;
    if (smsValidationFailed) {
      console.warn('❌ [VALIDATION] SMS 발송 불가:', validation.reason);
    }

    const roomName = reservation.roomName || reservation.room;
    console.log('❌ [CANCEL DEBUG] 객실명:', roomName);

    const settings = this.getSettingsForRoom(roomName);
    console.log('❌ [CANCEL DEBUG] 설정 정보:', JSON.stringify(settings, null, 2));

    if (!settings) {
      console.error('❌ [CANCEL DEBUG] No notification settings found for room:', roomName);
      return {
        sms: { skipped: true, reason: '설정 없음' },
        telegram: null
      };
    }

    const results = {
      sms: null,
      telegram: null
    };

    // SMS 검증이 실패했으면 스킵
    if (smsValidationFailed) {
      results.sms = { skipped: true, reason: validation.reason };
    } else {
      // SMS 발송 조건: 명시적으로 활성화된 경우에만 발송
      const roomEnabledCancel = settings.room?.enabled !== false;
      const cancellationEnabled = settings.room?.autoSend?.cancellationEnabled === true;
      const shouldSendCancelSms = roomEnabledCancel && cancellationEnabled;

      console.log('❌ [CANCEL DEBUG] SMS 발송 조건 체크:', {
        roomEnabled: roomEnabledCancel,
        cancellationEnabled: cancellationEnabled,
        shouldSendSms: shouldSendCancelSms
      });

      // SMS 발송 (명시적으로 활성화된 경우에만)
      if (shouldSendCancelSms) {
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
            reservation.id,
            reservation  // 업체 구분을 위해 reservation 객체 전달
          );
          console.log('📬 [CANCEL] SMS sent successfully:', results.sms);
        } catch (error) {
          console.error('SMS 발송 실패:', error);
          results.sms = { error: error.message };
        }
      }
    }

    // 텔레그램 알림 (관리자용)
    // useCancellation이 명시적으로 false가 아니면 발송 (useReservation이 true면 취소도 발송)
    const shouldSendTelegram = settings.global?.telegram?.useCancellation !== false &&
                               (settings.global?.telegram?.useCancellation === true ||
                                settings.global?.telegram?.useReservation === true);

    console.log('❌ [CANCEL DEBUG] 텔레그램 발송 조건:', {
      hasTelegram: !!settings.global?.telegram,
      useCancellation: settings.global?.telegram?.useCancellation,
      useReservation: settings.global?.telegram?.useReservation,
      shouldSendTelegram: shouldSendTelegram
    });

    if (shouldSendTelegram) {
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
      message += `├ 레이트 체크아웃: 낮 12시\n`;
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

// 브라우저 디버깅용 함수
if (typeof window !== 'undefined') {
  window.debugNotificationSettings = async () => {
    console.log('🔍 [DEBUG] 알림 설정 디버깅 시작...');

    // 설정 새로고침
    await notificationService.refreshSettings();

    console.log('🔍 [DEBUG] 현재 로드된 설정:');
    console.log('🔍 [DEBUG] 초호펜션:', notificationService.settings.choho);
    console.log('🔍 [DEBUG] 초호쉼터:', notificationService.settings.shelter);

    // 각 객실별 SMS 발송 가능 여부 테스트
    // 초호펜션: Forest 계열 / 초호쉼터: 호수뷰객실
    const testRooms = ['Forest', 'Forest mini', 'Forest 패밀리', 'Forest mini 패밀리', '호수뷰객실'];

    console.log('\n🔍 [DEBUG] 객실별 SMS 발송 상태:');
    console.log('─'.repeat(60));

    testRooms.forEach(roomName => {
      const settings = notificationService.getSettingsForRoom(roomName);
      const canSendSms = settings?.room?.enabled !== false &&
                         settings?.room?.autoSend?.confirmationEnabled === true;

      console.log(`🔍 [DEBUG] ${roomName}: SMS 발송 가능=${canSendSms}`);
    });

    console.log('─'.repeat(60));
    console.log('🔍 [DEBUG] 디버깅 완료');

    return {
      choho: notificationService.settings.choho,
      shelter: notificationService.settings.shelter
    };
  };

  window.notificationService = notificationService;
  console.log('💡 [TIP] 브라우저 콘솔에서 window.debugNotificationSettings() 실행하여 설정 확인 가능');
}

export default notificationService;