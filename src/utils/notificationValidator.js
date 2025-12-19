// src/utils/notificationValidator.js
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * 알림 설정 검증 유틸리티
 */
class NotificationValidator {
  /**
   * 예약 확정/취소 즉시 발송 설정 확인
   * @param {string} type - 'choho' 또는 'shelter'
   * @returns {Promise<Object>} 설정 상태
   */
  async validateImmediateSettings(type = 'choho') {
    try {
      const docName = type === 'choho' ? 'notifications_choho' : 'notifications_shelter';
      const settingsDoc = await getDoc(doc(db, 'settings', docName));
      
      if (!settingsDoc.exists()) {
        console.warn(`⚠️ ${type} 알림 설정이 존재하지 않습니다.`);
        return {
          exists: false,
          confirmationEnabled: false,
          cancellationEnabled: false,
          message: '알림 설정이 구성되지 않았습니다.'
        };
      }
      
      const data = settingsDoc.data();
      const autoSend = data.autoSend || {};
      
      const result = {
        exists: true,
        confirmationEnabled: autoSend.confirmationEnabled || false,
        cancellationEnabled: autoSend.cancellationEnabled || false,
        checkInEnabled: autoSend.checkInEnabled || false,
        checkOutEnabled: autoSend.checkOutEnabled || false,
        checkInHoursBefore: autoSend.checkInHoursBefore || 3,
        checkOutHoursBefore: autoSend.checkOutHoursBefore || 1,
        message: ''
      };
      
      // 경고 메시지 생성
      const warnings = [];
      if (!result.confirmationEnabled) {
        warnings.push('예약 확정 즉시발송이 비활성화됨');
      }
      if (!result.cancellationEnabled) {
        warnings.push('예약 취소 즉시발송이 비활성화됨');
      }
      
      if (warnings.length > 0) {
        result.message = `⚠️ 주의: ${warnings.join(', ')}`;
      } else {
        result.message = '✅ 모든 즉시발송 설정이 활성화됨';
      }
      
      return result;
    } catch (error) {
      console.error('알림 설정 검증 실패:', error);
      return {
        exists: false,
        confirmationEnabled: false,
        cancellationEnabled: false,
        message: '설정 확인 중 오류 발생'
      };
    }
  }
  
  /**
   * SMS 발송 가능 여부 확인
   * @param {string} roomName - 객실명
   * @param {string} type - 'choho' 또는 'shelter'
   * @returns {Promise<boolean>} SMS 발송 가능 여부
   */
  async canSendSMS(roomName, type = 'choho') {
    try {
      const docName = type === 'choho' ? 'notifications_choho' : 'notifications_shelter';
      const settingsDoc = await getDoc(doc(db, 'settings', docName));
      
      if (!settingsDoc.exists()) {
        console.warn(`⚠️ ${type} SMS 설정이 존재하지 않습니다.`);
        return false;
      }
      
      const data = settingsDoc.data();
      const smsRooms = data.smsRooms || {};
      
      // 객실별 SMS 발송 설정 확인
      const canSend = smsRooms[roomName] !== false; // 명시적으로 false가 아니면 true
      
      if (!canSend) {
        console.log(`📧 ${roomName} 객실은 SMS 발송이 비활성화되어 있습니다.`);
      }
      
      return canSend;
    } catch (error) {
      console.error('SMS 설정 확인 실패:', error);
      return false;
    }
  }
  
  /**
   * 전체 알림 설정 상태 확인
   * @param {string} type - 'choho' 또는 'shelter'
   * @returns {Promise<Object>} 전체 설정 상태
   */
  async getFullStatus(type = 'choho') {
    try {
      const docName = type === 'choho' ? 'notifications_choho' : 'notifications_shelter';
      const settingsDoc = await getDoc(doc(db, 'settings', docName));
      
      if (!settingsDoc.exists()) {
        return {
          status: 'not_configured',
          message: '알림 설정이 구성되지 않았습니다.',
          details: null
        };
      }
      
      const data = settingsDoc.data();
      
      // SENS 설정 확인
      const hasSens = data.sens && 
                      data.sens.serviceId && 
                      data.sens.accessKey && 
                      data.sens.secretKey && 
                      data.sens.from;
      
      // 텔레그램 설정 확인
      const hasTelegram = data.telegram && 
                         data.telegram.botToken && 
                         data.telegram.chatId;
      
      // 자동 발송 설정
      const autoSend = data.autoSend || {};
      
      // SMS 객실 설정
      const smsRooms = data.smsRooms || {};
      const enabledRooms = Object.entries(smsRooms)
        .filter(([room, enabled]) => enabled)
        .map(([room]) => room);
      
      return {
        status: 'configured',
        message: '알림 설정이 구성되었습니다.',
        details: {
          sens: {
            configured: hasSens,
            from: data.sens?.from || '미설정'
          },
          telegram: {
            configured: hasTelegram,
            useReservation: data.telegram?.useReservation || false,
            useCancellation: data.telegram?.useCancellation || false,
            autoSendDaily: data.telegram?.autoSendDaily || false
          },
          autoSend: {
            confirmationEnabled: autoSend.confirmationEnabled || false,
            cancellationEnabled: autoSend.cancellationEnabled || false,
            checkInEnabled: autoSend.checkInEnabled || false,
            checkInHoursBefore: autoSend.checkInHoursBefore || 3,
            checkOutEnabled: autoSend.checkOutEnabled || false,
            checkOutHoursBefore: autoSend.checkOutHoursBefore || 1
          },
          smsRooms: {
            enabledCount: enabledRooms.length,
            enabledRooms: enabledRooms
          }
        }
      };
    } catch (error) {
      console.error('설정 상태 확인 실패:', error);
      return {
        status: 'error',
        message: '설정 확인 중 오류가 발생했습니다.',
        details: null
      };
    }
  }
  
  /**
   * 알림 발송 전 사전 검증
   * @param {Object} reservation - 예약 정보
   * @param {string} notificationType - 'confirmation', 'cancellation', 'checkIn', 'checkOut'
   * @returns {Promise<Object>} 검증 결과
   */
  async preValidate(reservation, notificationType) {
    try {
      // 객실명으로 타입 판별
      const roomName = reservation.roomName || reservation.room;
      const type = this.getRoomType(roomName);
      
      // 설정 확인
      const settings = await this.validateImmediateSettings(type);
      
      // SMS 발송 가능 여부 확인
      const canSendSMS = await this.canSendSMS(roomName, type);
      
      // 알림 타입별 검증
      let canSend = false;
      let reason = '';
      
      switch (notificationType) {
        case 'confirmation':
          canSend = settings.confirmationEnabled && canSendSMS;
          if (!settings.confirmationEnabled) {
            reason = '예약 확정 즉시발송이 비활성화되어 있습니다.';
          } else if (!canSendSMS) {
            reason = `${roomName} 객실은 SMS 발송이 비활성화되어 있습니다.`;
          }
          break;
          
        case 'cancellation':
          canSend = settings.cancellationEnabled && canSendSMS;
          if (!settings.cancellationEnabled) {
            reason = '예약 취소 즉시발송이 비활성화되어 있습니다.';
          } else if (!canSendSMS) {
            reason = `${roomName} 객실은 SMS 발송이 비활성화되어 있습니다.`;
          }
          break;
          
        case 'checkIn':
          canSend = settings.checkInEnabled && canSendSMS;
          if (!settings.checkInEnabled) {
            reason = '입실 안내 자동발송이 비활성화되어 있습니다.';
          } else if (!canSendSMS) {
            reason = `${roomName} 객실은 SMS 발송이 비활성화되어 있습니다.`;
          }
          break;
          
        case 'checkOut':
          canSend = settings.checkOutEnabled && canSendSMS;
          if (!settings.checkOutEnabled) {
            reason = '퇴실 안내 자동발송이 비활성화되어 있습니다.';
          } else if (!canSendSMS) {
            reason = `${roomName} 객실은 SMS 발송이 비활성화되어 있습니다.`;
          }
          break;
          
        default:
          reason = '알 수 없는 알림 타입입니다.';
      }
      
      return {
        canSend,
        reason,
        type,
        roomName,
        settings
      };
    } catch (error) {
      console.error('사전 검증 실패:', error);
      return {
        canSend: false,
        reason: '검증 중 오류가 발생했습니다.',
        type: 'unknown',
        roomName: '',
        settings: null
      };
    }
  }
  
  /**
   * 객실명으로 타입 판별
   * @param {string} roomName - 객실명
   * @returns {string} 'choho' 또는 'shelter'
   */
  getRoomType(roomName) {
    const chohoRooms = ['Forest', 'Forest mini', 'Forest mini 패밀리', 'Forest 패밀리'];
    const shelterRooms = ['호수뷰객실', '1박2일워크샵', '야유회'];
    
    if (chohoRooms.includes(roomName)) {
      return 'choho';
    } else if (shelterRooms.includes(roomName)) {
      return 'shelter';
    }
    
    // 기본값은 choho
    return 'choho';
  }
  
  /**
   * 설정 디버깅 정보 출력
   * @param {string} type - 'choho' 또는 'shelter'
   */
  async debugSettings(type = 'choho') {
    const status = await this.getFullStatus(type);
    
    console.group(`🔍 ${type === 'choho' ? '초호펜션' : '초호쉼터'} 알림 설정 디버깅`);
    console.log('전체 상태:', status.status);
    console.log('메시지:', status.message);
    
    if (status.details) {
      console.group('📧 SENS 설정');
      console.log('구성됨:', status.details.sens.configured);
      console.log('발신번호:', status.details.sens.from);
      console.groupEnd();
      
      console.group('💬 텔레그램 설정');
      console.log('구성됨:', status.details.telegram.configured);
      console.log('예약 알림:', status.details.telegram.useReservation);
      console.log('취소 알림:', status.details.telegram.useCancellation);
      console.log('일일 현황:', status.details.telegram.autoSendDaily);
      console.groupEnd();
      
      console.group('⏰ 자동 발송 설정');
      console.log('예약 확정 즉시발송:', status.details.autoSend.confirmationEnabled);
      console.log('예약 취소 즉시발송:', status.details.autoSend.cancellationEnabled);
      console.log('입실 안내:', status.details.autoSend.checkInEnabled, 
                  `(${status.details.autoSend.checkInHoursBefore}시간 전)`);
      console.log('퇴실 안내:', status.details.autoSend.checkOutEnabled,
                  `(${status.details.autoSend.checkOutHoursBefore}시간 전)`);
      console.groupEnd();
      
      console.group('🏠 SMS 객실 설정');
      console.log('활성화된 객실 수:', status.details.smsRooms.enabledCount);
      console.log('활성화된 객실:', status.details.smsRooms.enabledRooms);
      console.groupEnd();
    }
    
    console.groupEnd();
  }
}

// 싱글톤 인스턴스 생성
const notificationValidator = new NotificationValidator();

export default notificationValidator;
