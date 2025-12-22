// src/services/sensService.js
// Firebase Functions를 통한 SENS SMS 발송 서비스

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class SENSService {
  constructor() {
    this.configs = {
      choho: null,
      shelter: null
    };
    this.functionsUrl = 'https://asia-northeast3-choho-pension.cloudfunctions.net';
    this.initialized = false;
  }

  // 설정 직접 전달 (UI에서 테스트용)
  initializeWithConfig(config) {
    if (!config) return;

    // 설정을 choho에 저장
    this.configs.choho = {
      serviceId: config.serviceId,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      from: config.from
    };

    console.log('📡 [SENS] 설정 직접 초기화:', {
      serviceId: this.configs.choho.serviceId,
      from: this.configs.choho.from
    });
  }

  // Firestore에서 설정 로드 및 초기화
  async initialize(config = null) {
    // config가 전달되면 직접 초기화
    if (config) {
      this.initializeWithConfig(config);
      return;
    }

    if (this.initialized) return;

    try {
      // 초호펜션 설정 로드
      const chohoDoc = await getDoc(doc(db, 'settings', 'notifications_v2_choho'));
      if (chohoDoc.exists()) {
        const data = chohoDoc.data();
        if (data.globalSettings?.sens) {
          this.configs.choho = {
            serviceId: data.globalSettings.sens.serviceId,
            accessKey: data.globalSettings.sens.accessKey,
            secretKey: data.globalSettings.sens.secretKey,
            from: data.globalSettings.sens.from
          };
          
          console.log('📡 [SENS] 초호펜션 설정 로드됨:', {
            serviceId: this.configs.choho.serviceId,
            from: this.configs.choho.from
          });
        }
      }
      
      // 초호쉼터 설정 로드
      const shelterDoc = await getDoc(doc(db, 'settings', 'notifications_v2_shelter'));
      if (shelterDoc.exists()) {
        const data = shelterDoc.data();
        if (data.globalSettings?.sens) {
          this.configs.shelter = {
            serviceId: data.globalSettings.sens.serviceId,
            accessKey: data.globalSettings.sens.accessKey,
            secretKey: data.globalSettings.sens.secretKey,
            from: data.globalSettings.sens.from
          };
          
          console.log('📡 [SENS] 초호쉼터 설정 로드됨:', {
            serviceId: this.configs.shelter.serviceId,
            from: this.configs.shelter.from
          });
        }
      }
      
      // 기본값 설정 (초호펜션이 기본)
      if (!this.configs.choho) {
        console.warn('📡 [SENS] 초호펜션 설정이 없습니다.');
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('📡 [SENS] Failed to initialize:', error);
      throw error;
    }
  }

  // 예약의 객실명으로 업체 구분
  getBusinessType(reservation) {
    const roomName = reservation.roomName || '';

    // 초호쉼터 객실: 호수뷰객실, 단체예약, 1박2일워크샵, 야유회 등
    const shelterRooms = ['호수뷰객실', '1박2일워크샵', '야유회', '단체예약'];
    if (shelterRooms.some(room => roomName.includes(room) || room.includes(roomName))) {
      return 'shelter';
    }

    // 초호펜션 객실: Forest, Forest mini, Forest 패밀리, Forest mini 패밀리
    const chohoRooms = ['Forest', 'Forest mini', 'Forest 패밀리', 'Forest mini 패밀리'];
    if (chohoRooms.some(room => roomName.includes(room) || room.includes(roomName))) {
      return 'choho';
    }

    // 기본값: 초호펜션
    return 'choho';
  }

  // SMS 발송 (Firebase Functions 경유)
  async sendSMS(to, content, reservationId = null, reservation = null) {
    // 초기화 확인
    if (!this.initialized) {
      await this.initialize();
    }
    
    // 업체 구분
    const businessType = reservation ? this.getBusinessType(reservation) : 'choho';
    const config = this.configs[businessType];
    
    if (!config) {
      throw new Error(`${businessType === 'shelter' ? '초호쉼터' : '초호펜션'} SENS 설정이 없습니다.`);
    }
    
    console.log('📡 [SENS] =====================================');
    console.log('📡 [SENS] SMS 발송 시작');
    console.log('📡 [SENS] 업체:', businessType === 'shelter' ? '초호쉼터' : '초호펜션');
    console.log('📡 [SENS] 수신자:', to);
    console.log('📡 [SENS] 내용 길이:', content?.length, '자');
    console.log('📡 [SENS] 예약 ID:', reservationId);
    console.log('📡 [SENS] 타입:', content?.length > 90 ? 'LMS' : 'SMS');
    
    // 전화번호 정규화
    const normalizedPhone = to.replace(/[^0-9]/g, '');
    
    if (!/^01[0-9]{8,9}$/.test(normalizedPhone)) {
      throw new Error(`잘못된 전화번호 형식: ${to}`);
    }
    
    const functionsEndpoint = `${this.functionsUrl}/sendSENSSMS`;
    
    try {
      // Firebase Functions로 요청 - API 키 포함
      const requestBody = {
        serviceId: config.serviceId,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
        from: config.from,
        to: normalizedPhone,
        content,
        reservationId,
        businessType  // 업체 구분 추가
      };
      
      console.log('📡 [SENS] Functions 호출:', functionsEndpoint);
      console.log('📡 [SENS] 요청 설정:', {
        businessType,
        serviceId: config.serviceId,
        from: config.from,
        to: normalizedPhone,
        hasAccessKey: !!config.accessKey,
        hasSecretKey: !!config.secretKey
      });
      
      const response = await fetch(functionsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log('📡 [SENS] 응답 상태:', response.status);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('📡 [SENS] 응답 파싱 실패:', responseText);
        throw new Error(`응답 파싱 실패: ${responseText}`);
      }
      
      if (!response.ok) {
        console.error('📡 [SENS] SMS 발송 실패:', result);
        throw new Error(result.error || `SMS 발송 실패 (${response.status})`);
      }
      
      console.log('📡 [SENS] SMS 발송 성공:', {
        requestId: result.requestId,
        statusCode: result.statusCode
      });
      
      return {
        success: true,
        requestId: result.requestId,
        message: result.message || '발송 완료',
        statusCode: result.statusCode,
        statusName: result.statusName
      };
      
    } catch (error) {
      console.error('📡 [SENS] SMS 발송 실패:', error);
      throw error;
    }
  }

  // 입실 안내 발송
  async sendCheckInNotification(reservation, template) {
    const message = this.generateMessage(template, {
      customerName: reservation.customerName,
      roomName: reservation.roomName,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guests: reservation.guests,
      totalPrice: reservation.totalPrice,
      options: reservation.options,
      pensionPhone: '010-7932-0029',
      pensionAddress: '경기도 파주시 법원읍 초리골길 134'
    });

    return await this.sendSMS(
      reservation.phone || reservation.customerPhone,
      message,
      reservation.id,
      reservation
    );
  }

  // 퇴실 안내 발송
  async sendCheckOutNotification(reservation, template) {
    const message = this.generateMessage(template, {
      customerName: reservation.customerName,
      roomName: reservation.roomName,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guests: reservation.guests,
      totalPrice: reservation.totalPrice,
      options: reservation.options,
      pensionPhone: '010-7932-0029',
      pensionAddress: '경기도 파주시 법원읍 초리골길 134'
    });

    return await this.sendSMS(
      reservation.phone || reservation.customerPhone,
      message,
      reservation.id,
      reservation
    );
  }

  // 연결 테스트 (설정 유효성 확인)
  async testConnection() {
    console.log('📡 [SENS] 연결 테스트 시작');

    // 설정 확인
    const config = this.configs.choho || this.configs.shelter;

    if (!config) {
      console.error('📡 [SENS] 설정이 없습니다.');
      return false;
    }

    // 필수 설정 확인
    if (!config.serviceId || !config.accessKey || !config.secretKey || !config.from) {
      console.error('📡 [SENS] 필수 설정이 누락되었습니다:', {
        serviceId: !!config.serviceId,
        accessKey: !!config.accessKey,
        secretKey: !!config.secretKey,
        from: !!config.from
      });
      return false;
    }

    console.log('📡 [SENS] 설정 확인 완료:', {
      serviceId: config.serviceId,
      from: config.from
    });

    return true;
  }

  // SMS 테스트 발송
  async testSMS(phoneNumber = '01098979834') {
    console.log('📡 [SENS] SMS 테스트 발송 시작');

    if (!this.initialized) {
      await this.initialize();
    }

    const testMessage = `[초호펜션] SMS 테스트 발송입니다.\n발송시간: ${new Date().toLocaleString('ko-KR')}`;

    try {
      const result = await this.sendSMS(phoneNumber, testMessage);
      console.log('📡 [SENS] SMS 테스트 성공:', result);
      return { success: true, ...result };
    } catch (error) {
      console.error('📡 [SENS] SMS 테스트 실패:', error);
      return { success: false, error: error.message };
    }
  }

  // 메시지 생성 헬퍼
  generateMessage(template, data) {
    if (!template) return '';

    let message = template;

    // 현장결제 옵션 계산
    let onsiteText = '';
    if (data.options && data.options.length > 0) {
      const onsiteOptions = data.options.filter(opt => {
        const name = typeof opt === 'object' ? (opt.name || '') : opt;
        return name.includes('바베큐') || name.includes('BBQ') || name.toLowerCase().includes('bbq');
      });

      if (onsiteOptions.length > 0) {
        const onsiteTotal = onsiteOptions.reduce((sum, opt) => {
          const price = typeof opt === 'object' ? (opt.price || 0) : 0;
          return sum + price;
        }, 0);
        if (onsiteTotal > 0) {
          onsiteText = `현장결제: ${onsiteTotal.toLocaleString()}원`;
        }
      }
    }
    // onsitePrice 필드가 있는 경우도 처리
    if (!onsiteText && data.onsitePrice && data.onsitePrice > 0) {
      onsiteText = `현장결제: ${data.onsitePrice.toLocaleString()}원`;
    }

    // 금액 값 (원 없이, 숫자만)
    const priceValue = (data.totalPrice || 0).toLocaleString();

    // 변수 치환 (원, 명은 템플릿에서 직접 붙이도록)
    const replacements = {
      '{고객명}': data.customerName || '',
      '{객실명}': data.roomName || '',
      '{체크인}': data.checkIn || '',
      '{체크아웃}': data.checkOut || '',
      '{인원}': data.guests || '',
      '{금액}': priceValue,  // 숫자만 (원 없이)
      '{현장결제}': onsiteText,
      '{전화번호}': data.pensionPhone || '010-7932-0029',
      '{주소}': data.pensionAddress || '경기도 파주시 법원읍 초리골길 134'
    };

    for (const [key, value] of Object.entries(replacements)) {
      message = message.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return message;
  }

  // 템플릿 가져오기
  async getTemplate(type, roomName) {
    try {
      const { getDocs, collection, query, where, limit } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      const templatesQuery = query(
        collection(db, 'message_templates'),
        where('type', '==', type),
        limit(1)
      );

      const snapshot = await getDocs(templatesQuery);

      if (!snapshot.empty) {
        return snapshot.docs[0].data().content;
      }

      // 기본 템플릿 반환
      return this.getDefaultTemplate(type);
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
      return this.getDefaultTemplate(type);
    }
  }

  // 기본 템플릿
  getDefaultTemplate(type) {
    const templates = {
      confirmation: `[초호수뷰펜션]
{고객명}님, 예약이 확정되었습니다.

📅 일정: {체크인} ~ {체크아웃}
🏠 객실: {객실명}
👥 인원: {인원}명
💰 금액: {금액}원

입실 당일 안내 문자 드리겠습니다.
감사합니다 😊`,
      cancellation: `[초호수뷰펜션]
{고객명}님, 예약이 취소되었습니다.

📅 일정: {체크인} ~ {체크아웃}
🏠 객실: {객실명}

다음에 더 좋은 기회로 뵙겠습니다.
감사합니다.`,
      checkIn: `[초호수뷰펜션]
안녕하세요 {고객명}님!
오늘 오후 3시 입실 예정이십니다.

📍 주소: {주소}
🚗 주차: 객실 앞 전용주차장

준비된 편안한 휴식 되세요 ☺️
문의: {전화번호}`,
      checkOut: `[초호수뷰펜션]
{고객명}님, 즐거운 시간 보내셨나요?

🕐 퇴실시간: 오전 11시
🧹 퇴실준비: 사용하신 그릇은 싱크대에
🗑️ 쓰레기배출장소: 숯불바베큐장 옆

감사합니다. 또 뵙겠습니다 🙏`
    };

    return templates[type] || '';
  }
}

// 싱글톤 인스턴스
const sensService = new SENSService();

// 전역에서 테스트할 수 있도록 window에 할당
if (typeof window !== 'undefined') {
  window.sensService = sensService;
}

export default sensService;
