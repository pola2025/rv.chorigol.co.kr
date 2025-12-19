// src/services/notificationScheduler.js
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import sensService from './sensService';
import telegramService from './telegramService';

class NotificationScheduler {
  constructor() {
    this.intervalId = null;
    this.settings = null;
    this.templates = {};
  }

  // 스케줄러 시작
  async start() {
    await this.loadSettings();
    await this.loadTemplates();
    
    // 10분마다 체크
    this.intervalId = setInterval(() => {
      this.checkAndSendNotifications();
    }, 10 * 60 * 1000); // 10분

    // 즉시 한 번 실행
    this.checkAndSendNotifications();
  }

  // 스케줄러 중지
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 설정 로드
  async loadSettings() {
    try {
      const docRef = doc(db, 'settings', 'notifications');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        this.settings = docSnap.data();
        
        // SENS 초기화
        if (this.settings.sens) {
          sensService.initialize(this.settings.sens);
        }
        
        // 텔레그램 초기화
        if (this.settings.telegram) {
          telegramService.initialize(this.settings.telegram);
        }
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    }
  }

  // 템플릿 로드
  async loadTemplates() {
    try {
      const querySnapshot = await getDocs(collection(db, 'message_templates'));
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        this.templates[data.type] = data.content;
      });
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
    }
  }

  // 알림 체크 및 발송
  async checkAndSendNotifications() {
    if (!this.settings || !this.settings.autoSend) return;

    const now = new Date();
    
    // 입실 안내 체크
    if (this.settings.autoSend.checkInEnabled) {
      await this.checkCheckInNotifications(now);
    }
    
    // 퇴실 안내 체크
    if (this.settings.autoSend.checkOutEnabled) {
      await this.checkCheckOutNotifications(now);
    }
  }

  // 입실 안내 체크
  async checkCheckInNotifications(now) {
    const hoursBefore = this.settings.autoSend.checkInHoursBefore || 3;
    const targetTime = new Date(now.getTime() + (hoursBefore * 60 * 60 * 1000));
    const targetDate = targetTime.toISOString().split('T')[0];
    const targetHour = targetTime.getHours();

    try {
      // 오늘 입실 예약 조회
      const q = query(
        collection(db, 'reservations'),
        where('checkIn', '==', targetDate),
        where('status', '==', '예약확정'),
        where('checkInNotificationSent', '!=', true)
      );

      const querySnapshot = await getDocs(q);
      
      for (const doc of querySnapshot.docs) {
        const reservation = { id: doc.id, ...doc.data() };
        const checkInTime = parseInt(reservation.checkInTime?.split(':')[0] || 15);
        
        // 입실 시간 3시간 전인지 확인
        if (targetHour === checkInTime) {
          await this.sendCheckInNotification(reservation);
        }
      }
    } catch (error) {
      console.error('입실 안내 체크 실패:', error);
    }
  }

  // 퇴실 안내 체크
  async checkCheckOutNotifications(now) {
    const hoursBefore = this.settings.autoSend.checkOutHoursBefore || 1;
    const targetTime = new Date(now.getTime() + (hoursBefore * 60 * 60 * 1000));
    const targetDate = targetTime.toISOString().split('T')[0];
    const targetHour = targetTime.getHours();

    try {
      // 오늘 퇴실 예약 조회
      const q = query(
        collection(db, 'reservations'),
        where('checkOut', '==', targetDate),
        where('status', '==', '예약확정'),
        where('checkOutNotificationSent', '!=', true)
      );

      const querySnapshot = await getDocs(q);
      
      for (const doc of querySnapshot.docs) {
        const reservation = { id: doc.id, ...doc.data() };
        
        // 레이트 체크아웃 확인
        const hasLateCheckout = reservation.options?.includes('레이트 체크아웃');
        const checkOutTime = hasLateCheckout ? 14 : 11;
        
        // 퇴실 시간 1시간 전인지 확인
        if (targetHour === checkOutTime - hoursBefore) {
          await this.sendCheckOutNotification(reservation);
        }
      }
    } catch (error) {
      console.error('퇴실 안내 체크 실패:', error);
    }
  }

  // 입실 안내 발송
  async sendCheckInNotification(reservation) {
    try {
      const template = this.templates.checkIn || this.getDefaultCheckInTemplate();
      await sensService.sendCheckInNotification(reservation, template);
      
      // 발송 완료 표시
      await this.markNotificationSent(reservation.id, 'checkInNotificationSent');
      
      console.log(`입실 안내 발송 완료: ${reservation.customerName}`);
    } catch (error) {
      console.error('입실 안내 발송 실패:', error);
    }
  }

  // 퇴실 안내 발송
  async sendCheckOutNotification(reservation) {
    try {
      const template = this.templates.checkOut || this.getDefaultCheckOutTemplate();
      await sensService.sendCheckOutNotification(reservation, template);
      
      // 발송 완료 표시
      await this.markNotificationSent(reservation.id, 'checkOutNotificationSent');
      
      console.log(`퇴실 안내 발송 완료: ${reservation.customerName}`);
    } catch (error) {
      console.error('퇴실 안내 발송 실패:', error);
    }
  }

  // 발송 완료 표시
  async markNotificationSent(reservationId, field) {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'reservations', reservationId), {
        [field]: true,
        [`${field}At`]: new Date()
      });
    } catch (error) {
      console.error('발송 표시 업데이트 실패:', error);
    }
  }

  // 기본 입실 안내 템플릿
  getDefaultCheckInTemplate() {
    return `[초호수뷰펜션]
안녕하세요 {고객명}님!
오늘 오후 3시 입실 예정이십니다.

📍 주소: 경기도 파주시 법원읍 초리골길 134
🚗 주차: 객실 앞 전용주차장
🔑 비밀번호: 입실 1시간 전 발송

준비된 편안한 휴식 되세요 ☺️
문의: {전화번호}`;
  }

  // 기본 퇴실 안내 템플릿
  getDefaultCheckOutTemplate() {
    return `[초호수뷰펜션]
{고객명}님, 즐거운 시간 보내셨나요?

🕐 퇴실시간: 오전 11시
🧹 퇴실준비: 사용하신 그릇은 싱크대에
🗑️ 쓰레기: 분리수거 부탁드립니다
🔑 열쇠: 테이블 위에 놓아주세요

감사합니다. 또 뵙겠습니다 🙏`;
  }

  // 즉시 발송 (수동)
  async sendManualNotification(reservationId, type) {
    try {
      const docRef = doc(db, 'reservations', reservationId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('예약을 찾을 수 없습니다.');
      }
      
      const reservation = { id: docSnap.id, ...docSnap.data() };
      
      if (type === 'checkIn') {
        await this.sendCheckInNotification(reservation);
      } else if (type === 'checkOut') {
        await this.sendCheckOutNotification(reservation);
      }
      
      return { success: true, message: '발송 완료' };
    } catch (error) {
      console.error('수동 발송 실패:', error);
      return { success: false, error: error.message };
    }
  }
}

// 싱글톤 인스턴스
const notificationScheduler = new NotificationScheduler();
export default notificationScheduler;