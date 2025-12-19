import { initializeApp } from 'firebase-admin/app';

// Admin SDK 초기화
initializeApp();

// 기존 텔레그램 일일 현황 자동 발송 (통합 버전)
export { sendDailyTelegramSummary } from './telegram-scheduler.js';

// 알림 관련 함수들 (초호펜션/초호쉼터 분리 버전)
export { 
  testNaverSens, 
  testTelegram, 
  sendReservationNotification, 
  sendCancellationNotification,
  sendDailyTelegramSummaryV2 
} from './notifications.js';
