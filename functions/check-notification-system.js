// check-notification-system.js
// 알림 설정이 실제로 작동하는지 점검하는 스크립트

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Firebase Admin 초기화
const serviceAccount = require('./service-account-key.json');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function checkNotificationSystem() {
  console.clear();
  console.log(colors.cyan + '🔍 알림 시스템 전체 점검 시작' + colors.reset);
  console.log('=' .repeat(60));
  
  const issues = [];
  
  // 1. 알림 설정 확인
  console.log('\n' + colors.blue + '[1] 알림 설정 확인' + colors.reset);
  console.log('-'.repeat(40));
  
  // 초호펜션 설정
  const chohoSettings = await db.doc('settings/notifications_v2_choho').get();
  if (chohoSettings.exists) {
    const data = chohoSettings.data();
    console.log('\n📋 초호펜션 설정:');
    
    // SENS (SMS) 설정
    if (data.globalSettings?.sens) {
      console.log(colors.green + '  ✅ SENS 설정 있음' + colors.reset);
      console.log('     - Service ID:', data.globalSettings.sens.serviceId || '❌ 없음');
      console.log('     - From:', data.globalSettings.sens.from || '❌ 없음');
    } else {
      console.log(colors.red + '  ❌ SENS 설정 없음' + colors.reset);
      issues.push('초호펜션 SENS 설정 누락');
    }
    
    // 텔레그램 설정
    if (data.globalSettings?.telegram) {
      console.log(colors.green + '  ✅ 텔레그램 설정 있음' + colors.reset);
      console.log('     - Chat ID:', data.globalSettings.telegram.chatId || '❌ 없음');
      console.log('     - 예약 알림:', data.globalSettings.telegram.useReservation ? '✅' : '❌');
      console.log('     - 취소 알림:', data.globalSettings.telegram.useCancellation ? '✅' : '❌');
    }
    
    // 객실별 설정
    console.log('\n  객실별 알림 설정:');
    const chohoRooms = ['Forest', 'Forest mini', 'Forest 패밀리', 'Forest mini 패밀리'];
    for (const room of chohoRooms) {
      const roomSetting = data.roomSettings?.[room];
      if (roomSetting) {
        console.log(`  • ${room}:`);
        console.log(`    - 활성화: ${roomSetting.enabled !== false ? '✅' : '❌'}`);
        console.log(`    - 확정 문자: ${roomSetting.autoSend?.confirmationEnabled ? '✅' : '❌'}`);
        console.log(`    - 입실 안내: ${roomSetting.autoSend?.checkInEnabled ? '✅' : '❌'}`);
        console.log(`    - 퇴실 안내: ${roomSetting.autoSend?.checkOutEnabled ? '✅' : '❌'}`);
      } else {
        console.log(`  • ${room}: ` + colors.yellow + '설정 없음' + colors.reset);
      }
    }
  } else {
    console.log(colors.red + '❌ 초호펜션 설정 문서 없음' + colors.reset);
    issues.push('초호펜션 설정 문서 누락');
  }
  
  // 초호쉼터 설정
  const shelterSettings = await db.doc('settings/notifications_v2_shelter').get();
  if (shelterSettings.exists) {
    const data = shelterSettings.data();
    console.log('\n📋 초호쉼터 설정:');
    
    // SENS 설정
    if (data.globalSettings?.sens) {
      console.log(colors.green + '  ✅ SENS 설정 있음' + colors.reset);
    } else {
      console.log(colors.red + '  ❌ SENS 설정 없음' + colors.reset);
      issues.push('초호쉼터 SENS 설정 누락');
    }
    
    // 텔레그램 설정
    if (data.globalSettings?.telegram) {
      console.log(colors.green + '  ✅ 텔레그램 설정 있음' + colors.reset);
      console.log('     - Chat ID:', data.globalSettings.telegram.chatId || '❌ 없음');
    }
    
    // 객실별 설정
    console.log('\n  객실별 알림 설정:');
    const shelterRooms = ['호수뷰객실', '1박2일워크샵', '야유회'];
    for (const room of shelterRooms) {
      const roomSetting = data.roomSettings?.[room];
      if (roomSetting) {
        console.log(`  • ${room}:`);
        console.log(`    - 활성화: ${roomSetting.enabled !== false ? '✅' : '❌'}`);
        console.log(`    - 확정 문자: ${roomSetting.autoSend?.confirmationEnabled ? '✅' : '❌'}`);
        console.log(`    - 입실 안내: ${roomSetting.autoSend?.checkInEnabled ? '✅' : '❌'}`);
        console.log(`    - 퇴실 안내: ${roomSetting.autoSend?.checkOutEnabled ? '✅' : '❌'}`);
      } else {
        console.log(`  • ${room}: ` + colors.yellow + '설정 없음' + colors.reset);
      }
    }
  } else {
    console.log(colors.red + '❌ 초호쉼터 설정 문서 없음' + colors.reset);
    issues.push('초호쉼터 설정 문서 누락');
  }
  
  // 2. Cloud Functions 확인
  console.log('\n' + colors.blue + '[2] Cloud Functions 스케줄러 상태' + colors.reset);
  console.log('-'.repeat(40));
  console.log('⚠️  Cloud Console에서 직접 확인 필요:');
  console.log('   https://console.cloud.google.com/cloudscheduler');
  console.log('   - autoSendSMSScheduler Job 확인');
  console.log('   - 스케줄: 0 10,13 * * * (오전 10시, 오후 1시)');
  console.log('   - 시간대: Asia/Seoul');
  
  // 3. 오늘 예약 확인
  console.log('\n' + colors.blue + '[3] 오늘 예약 및 SMS 발송 상태' + colors.reset);
  console.log('-'.repeat(40));
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  
  console.log(`현재 시간: ${now.toLocaleString('ko-KR')}`);
  console.log(`오늘 날짜: ${today}`);
  
  // 입실 예약
  const checkInReservations = await db.collection('reservations')
    .where('checkIn', '==', today)
    .where('status', '==', '예약확정')
    .get();
  
  console.log(`\n📥 오늘 입실 예약: ${checkInReservations.size}건`);
  if (checkInReservations.size > 0) {
    checkInReservations.forEach(doc => {
      const data = doc.data();
      const smsSent = data.smsStatus?.checkInSent;
      console.log(`  • ${data.customerName} (${data.roomName})`);
      console.log(`    - 전화번호: ${data.phone || data.customerPhone || '❌ 없음'}`);
      console.log(`    - 입실 안내 발송: ${smsSent ? '✅' : '❌ 미발송'}`);
      if (data.smsStatus?.checkInSentAt) {
        console.log(`    - 발송 시간: ${new Date(data.smsStatus.checkInSentAt.toDate()).toLocaleString('ko-KR')}`);
      }
      
      if (!smsSent && currentHour >= 13) {
        console.log(colors.red + '    ⚠️  오후 1시가 지났는데 입실 안내가 발송되지 않았습니다!' + colors.reset);
        issues.push(`${data.customerName} 입실 안내 미발송`);
      }
    });
  }
  
  // 퇴실 예약
  const checkOutReservations = await db.collection('reservations')
    .where('checkOut', '==', today)
    .where('status', '==', '예약확정')
    .get();
  
  console.log(`\n📤 오늘 퇴실 예약: ${checkOutReservations.size}건`);
  if (checkOutReservations.size > 0) {
    checkOutReservations.forEach(doc => {
      const data = doc.data();
      const smsSent = data.smsStatus?.checkOutSent;
      console.log(`  • ${data.customerName} (${data.roomName})`);
      console.log(`    - 전화번호: ${data.phone || data.customerPhone || '❌ 없음'}`);
      console.log(`    - 퇴실 안내 발송: ${smsSent ? '✅' : '❌ 미발송'}`);
      if (data.smsStatus?.checkOutSentAt) {
        console.log(`    - 발송 시간: ${new Date(data.smsStatus.checkOutSentAt.toDate()).toLocaleString('ko-KR')}`);
      }
      
      if (!smsSent && currentHour >= 10) {
        console.log(colors.red + '    ⚠️  오전 10시가 지났는데 퇴실 안내가 발송되지 않았습니다!' + colors.reset);
        issues.push(`${data.customerName} 퇴실 안내 미발송`);
      }
    });
  }
  
  // 4. 최근 예약 확정 확인
  console.log('\n' + colors.blue + '[4] 최근 예약 확정 문자 발송 상태' + colors.reset);
  console.log('-'.repeat(40));
  
  const recentConfirmed = await db.collection('reservations')
    .where('status', '==', '예약확정')
    .orderBy('updatedAt', 'desc')
    .limit(5)
    .get();
  
  console.log('최근 예약 확정 5건:');
  recentConfirmed.forEach(doc => {
    const data = doc.data();
    const confirmSent = data.smsStatus?.confirmationSent;
    console.log(`  • ${data.customerName} (${data.roomName})`);
    console.log(`    - 체크인: ${data.checkIn}`);
    console.log(`    - 확정 문자: ${confirmSent ? '✅ 발송됨' : '❌ 미발송'}`);
    if (!confirmSent) {
      issues.push(`${data.customerName} 확정 문자 미발송`);
    }
  });
  
  // 5. 문제점 요약
  console.log('\n' + colors.blue + '[5] 점검 결과 요약' + colors.reset);
  console.log('=' .repeat(60));
  
  if (issues.length === 0) {
    console.log(colors.green + '✅ 시스템이 정상적으로 설정되어 있습니다!' + colors.reset);
  } else {
    console.log(colors.red + '❌ 발견된 문제점:' + colors.reset);
    issues.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. ${issue}`);
    });
  }
  
  // 6. 권장 조치
  console.log('\n' + colors.blue + '[6] 권장 조치사항' + colors.reset);
  console.log('=' .repeat(60));
  
  if (issues.some(i => i.includes('미발송'))) {
    console.log('\n📱 SMS 발송 문제 해결:');
    console.log('  1. Cloud Scheduler 확인');
    console.log('     - https://console.cloud.google.com/cloudscheduler');
    console.log('     - Job이 실행되고 있는지 확인');
    console.log('     - 마지막 실행 시간과 결과 확인');
    console.log('\n  2. Functions 로그 확인');
    console.log('     - firebase functions:log --only autoSendSMSScheduler');
    console.log('\n  3. 수동 발송 테스트');
    console.log('     - node manual-trigger-sms.js');
  }
  
  if (issues.some(i => i.includes('설정'))) {
    console.log('\n⚙️  설정 문제 해결:');
    console.log('  - Firebase Console > Firestore > settings 확인');
    console.log('  - 알림 설정 페이지에서 재설정');
  }
}

// 메인 실행
async function main() {
  await checkNotificationSystem();
}

main().catch(console.error);
