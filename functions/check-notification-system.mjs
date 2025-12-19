import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, 'service-account-key.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkNotificationSystem() {
  console.log('=====================================');
  console.log('알림 시스템 점검 시작');
  console.log('=====================================');
  
  try {
    // 초호펜션 설정 확인
    const chohoDoc = await db.doc('settings/notifications_v2_choho').get();
    if (chohoDoc.exists) {
      const data = chohoDoc.data();
      console.log('\n[초호펜션 설정]');
      console.log('SENS 설정:', data.globalSettings?.sens ? 'O' : 'X');
      console.log('텔레그램:', data.globalSettings?.telegram ? 'O' : 'X');
      
      // 객실별 설정 확인
      if (data.roomSettings) {
        console.log('\n객실별 알림 설정:');
        Object.keys(data.roomSettings).forEach(room => {
          const rs = data.roomSettings[room];
          console.log(`  ${room}:`);
          console.log(`    - 활성화: ${rs.enabled !== false ? 'O' : 'X'}`);
          console.log(`    - 확정문자: ${rs.autoSend?.confirmationEnabled ? 'O' : 'X'}`);
          console.log(`    - 입실안내: ${rs.autoSend?.checkInEnabled ? 'O' : 'X'}`);
          console.log(`    - 퇴실안내: ${rs.autoSend?.checkOutEnabled ? 'O' : 'X'}`);
        });
      }
    }
    
    // 초호쉼터 설정 확인
    const shelterDoc = await db.doc('settings/notifications_v2_shelter').get();
    if (shelterDoc.exists) {
      const data = shelterDoc.data();
      console.log('\n[초호쉼터 설정]');
      console.log('SENS 설정:', data.globalSettings?.sens ? 'O' : 'X');
      console.log('텔레그램:', data.globalSettings?.telegram ? 'O' : 'X');
      
      // 객실별 설정 확인
      if (data.roomSettings) {
        console.log('\n객실별 알림 설정:');
        Object.keys(data.roomSettings).forEach(room => {
          const rs = data.roomSettings[room];
          console.log(`  ${room}:`);
          console.log(`    - 활성화: ${rs.enabled !== false ? 'O' : 'X'}`);
          console.log(`    - 확정문자: ${rs.autoSend?.confirmationEnabled ? 'O' : 'X'}`);
          console.log(`    - 입실안내: ${rs.autoSend?.checkInEnabled ? 'O' : 'X'}`);
          console.log(`    - 퇴실안내: ${rs.autoSend?.checkOutEnabled ? 'O' : 'X'}`);
        });
      }
    }
    
    // 오늘 예약 확인
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHour = now.getHours();
    
    console.log('\n[현재 시간]', now.toLocaleString('ko-KR'));
    console.log('[오늘 날짜]', today);
    
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
        console.log(`  입실안내: ${sent ? '발송완료' : '미발송'}`);
        
        if (!sent && currentHour >= 13) {
          console.log('  ⚠️ 오후 1시가 지났는데 미발송!');
        }
      });
    }
    
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
        console.log(`  퇴실안내: ${sent ? '발송완료' : '미발송'}`);
        
        if (!sent && currentHour >= 10) {
          console.log('  ⚠️ 오전 10시가 지났는데 미발송!');
        }
      });
    }
    
    // 최근 예약 확정 확인
    console.log('\n[최근 예약 확정 (5건)]');
    const recentConfirmed = await db.collection('reservations')
      .where('status', '==', '예약확정')
      .orderBy('updatedAt', 'desc')
      .limit(5)
      .get();
    
    recentConfirmed.forEach(doc => {
      const data = doc.data();
      const confirmSent = data.smsStatus?.confirmationSent;
      console.log(`- ${data.customerName} (${data.roomName})`);
      console.log(`  체크인: ${data.checkIn}`);
      console.log(`  확정문자: ${confirmSent ? '발송완료' : '미발송'}`);
    });
    
    console.log('\n=====================================');
    console.log('점검 완료!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('오류:', error.message);
    console.error('상세:', error);
  }
  
  process.exit(0);
}

checkNotificationSystem();
