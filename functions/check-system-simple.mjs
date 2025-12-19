// check-system-simple.mjs
// Service Account Key 없이 간단히 점검하는 스크립트

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin 초기화 (기본 인증 사용)
// Firebase CLI로 로그인되어 있으면 작동합니다
initializeApp({
  projectId: 'choho-pension'
});

const db = getFirestore();

async function checkNotificationSystem() {
  console.log('=====================================');
  console.log('알림 시스템 간단 점검');
  console.log('=====================================');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHour = now.getHours();
    
    console.log('\n[현재 시간]', now.toLocaleString('ko-KR'));
    console.log('[오늘 날짜]', today);
    
    // 오늘 입실 예약 확인
    console.log('\n조회 중...');
    const checkInRes = await db.collection('reservations')
      .where('checkIn', '==', today)
      .where('status', '==', '예약확정')
      .get();
    
    console.log('\n[오늘 입실 예약]', checkInRes.size, '건');
    if (checkInRes.size > 0) {
      checkInRes.forEach(doc => {
        const data = doc.data();
        const sent = data.smsStatus?.checkInSent;
        console.log(`- ${data.customerName} (${data.roomName})`);
        console.log(`  전화: ${data.phone || '없음'}`);
        console.log(`  입실안내: ${sent ? '✅ 발송완료' : '❌ 미발송'}`);
        
        if (!sent && currentHour >= 13) {
          console.log('  ⚠️ 오후 1시가 지났는데 미발송!');
        }
      });
    }
    
    // 오늘 퇴실 예약 확인
    const checkOutRes = await db.collection('reservations')
      .where('checkOut', '==', today)
      .where('status', '==', '예약확정')
      .get();
    
    console.log('\n[오늘 퇴실 예약]', checkOutRes.size, '건');
    if (checkOutRes.size > 0) {
      checkOutRes.forEach(doc => {
        const data = doc.data();
        const sent = data.smsStatus?.checkOutSent;
        console.log(`- ${data.customerName} (${data.roomName})`);
        console.log(`  전화: ${data.phone || '없음'}`);
        console.log(`  퇴실안내: ${sent ? '✅ 발송완료' : '❌ 미발송'}`);
        
        if (!sent && currentHour >= 10) {
          console.log('  ⚠️ 오전 10시가 지났는데 미발송!');
        }
      });
    }
    
    console.log('\n=====================================');
    console.log('점검 완료!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('오류:', error.message);
    if (error.message.includes('Could not load')) {
      console.error('\n⚠️ Firebase 인증 오류!');
      console.error('해결 방법:');
      console.error('1. Firebase Console에서 service-account-key.json 다운로드');
      console.error('2. functions 폴더에 저장');
      console.error('3. 다시 실행');
    }
  }
  
  process.exit(0);
}

checkNotificationSystem();
