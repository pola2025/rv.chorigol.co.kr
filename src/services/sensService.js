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

  // Firestore에서 설정 로드 및 초기화
  async initialize() {
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
    
    // 초호쉼터 객실
    const shelterRooms = ['호수뷰객실', '1박2일워크샵', '야유회'];
    if (shelterRooms.includes(roomName)) {
      return 'shelter';
    }
    
    // 초호펜션 객실 (기본)
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
}

// 싱글톤 인스턴스
const sensService = new SENSService();

export default sensService;
