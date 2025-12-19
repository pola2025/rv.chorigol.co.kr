// src/services/notificationScheduler.js
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import sensService from './sensService';
import telegramService from './telegramService';

class NotificationScheduler {
  constructor() {
    this.intervalId = null;
    this.dailyIntervalId = null;
    this.settings = null;
    this.settingsV2 = { choho: null, shelter: null };
    this.templates = {};
    this.lastDailySentDate = null;
  }

  // 스케줄러 시작
  async start() {
    console.log('📅 [SCHEDULER] 알림 스케줄러 시작');
    await this.loadSettings();
    await this.loadSettingsV2();
    await this.loadTemplates();

    // 10분마다 체크 (입실/퇴실 안내)
    this.intervalId = setInterval(() => {
      this.checkAndSendNotifications();
    }, 10 * 60 * 1000); // 10분

    // 1분마다 일일현황 발송 시간 체크 (오전 9시)
    this.dailyIntervalId = setInterval(() => {
      this.checkDailySummary();
    }, 60 * 1000); // 1분

    // 즉시 한 번 실행
    this.checkAndSendNotifications();
    this.checkDailySummary();

    console.log('📅 [SCHEDULER] 알림 스케줄러 시작 완료');
  }

  // V2 설정 로드
  async loadSettingsV2() {
    try {
      // 초호펜션 설정
      const chohoDoc = await getDoc(doc(db, 'settings', 'notifications_v2_choho'));
      if (chohoDoc.exists()) {
        this.settingsV2.choho = chohoDoc.data();
        console.log('📅 [SCHEDULER] 초호펜션 V2 설정 로드됨');
      }

      // 초호쉼터 설정
      const shelterDoc = await getDoc(doc(db, 'settings', 'notifications_v2_shelter'));
      if (shelterDoc.exists()) {
        this.settingsV2.shelter = shelterDoc.data();
        console.log('📅 [SCHEDULER] 초호쉼터 V2 설정 로드됨');
      }
    } catch (error) {
      console.error('📅 [SCHEDULER] V2 설정 로드 실패:', error);
    }
  }

  // 일일현황 발송 체크
  async checkDailySummary() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 이미 오늘 발송했으면 스킵
    if (this.lastDailySentDate === todayStr) {
      return;
    }

    // 오전 9시 0분 ~ 9시 5분 사이에 발송
    if (currentHour === 9 && currentMinute < 5) {
      console.log('📅 [SCHEDULER] 일일현황 발송 시간 도달');
      await this.sendDailySummaries();
      this.lastDailySentDate = todayStr;
    }
  }

  // 일일현황 발송
  async sendDailySummaries() {
    console.log('📊 [DAILY] 일일현황 발송 시작');

    try {
      // 초호펜션 일일현황
      if (this.settingsV2.choho?.globalSettings?.telegram?.autoSendDaily) {
        const telegramConfig = this.settingsV2.choho.globalSettings.telegram;
        if (telegramConfig.botToken && telegramConfig.chatId) {
          telegramService.initialize(telegramConfig);
          const data = await this.getDailySummaryData('choho');
          await telegramService.sendDailySummary(data);
          console.log('📊 [DAILY] 초호펜션 일일현황 발송 완료');
        }
      }

      // 초호쉼터 일일현황
      if (this.settingsV2.shelter?.globalSettings?.telegram?.autoSendDaily) {
        const telegramConfig = this.settingsV2.shelter.globalSettings.telegram;
        if (telegramConfig.botToken && telegramConfig.chatId) {
          telegramService.initialize(telegramConfig);
          const data = await this.getDailySummaryData('shelter');
          await telegramService.sendDailySummary(data);
          console.log('📊 [DAILY] 초호쉼터 일일현황 발송 완료');
        }
      }
    } catch (error) {
      console.error('📊 [DAILY] 일일현황 발송 실패:', error);
    }
  }

  // 일일현황 데이터 조회
  async getDailySummaryData(type) {
    const today = new Date().toISOString().split('T')[0];
    const rooms = type === 'choho'
      ? ['Forest', 'Forest mini', 'Forest mini 패밀리', 'Forest 패밀리']
      : ['호수뷰객실'];

    try {
      // 오늘 입실 예약
      const checkInQuery = query(
        collection(db, 'reservations'),
        where('checkIn', '==', today),
        where('status', '==', '예약확정')
      );
      const checkInSnapshot = await getDocs(checkInQuery);
      const checkInList = checkInSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(r => rooms.some(room => r.roomName?.includes(room)));

      // 오늘 퇴실 예약
      const checkOutQuery = query(
        collection(db, 'reservations'),
        where('checkOut', '==', today),
        where('status', '==', '예약확정')
      );
      const checkOutSnapshot = await getDocs(checkOutQuery);
      const checkOutList = checkOutSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(r => rooms.some(room => r.roomName?.includes(room)));

      // 현재 투숙 중 (체크인 <= 오늘 < 체크아웃)
      const stayingQuery = query(
        collection(db, 'reservations'),
        where('checkIn', '<=', today),
        where('status', '==', '예약확정')
      );
      const stayingSnapshot = await getDocs(stayingQuery);
      const currentStayList = stayingSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(r => r.checkOut > today && rooms.some(room => r.roomName?.includes(room)));

      // 이번달 매출
      const monthStart = today.slice(0, 7) + '-01';
      const monthEnd = today.slice(0, 7) + '-31';
      const monthReservations = [...checkInSnapshot.docs, ...stayingSnapshot.docs]
        .map(doc => doc.data())
        .filter(r => r.checkIn >= monthStart && r.checkIn <= monthEnd);
      const monthRevenue = monthReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

      // 오늘 매출
      const todayRevenue = checkInList.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

      return {
        checkInCount: checkInList.length,
        checkInList,
        checkOutCount: checkOutList.length,
        checkOutList,
        currentStayCount: currentStayList.length,
        totalRooms: rooms.length,
        todayRevenue,
        monthRevenue
      };
    } catch (error) {
      console.error('일일현황 데이터 조회 실패:', error);
      return {
        checkInCount: 0,
        checkInList: [],
        checkOutCount: 0,
        checkOutList: [],
        currentStayCount: 0,
        totalRooms: rooms.length,
        todayRevenue: 0,
        monthRevenue: 0
      };
    }
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