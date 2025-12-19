// 간단한 테스트 버전
import { initializeApp } from 'firebase-admin/app';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Admin SDK 초기화
initializeApp();

// 테스트 함수
export const testFunction = onSchedule({
  schedule: '0 9 * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3'
}, async (event) => {
  console.log('Test function executed');
});
