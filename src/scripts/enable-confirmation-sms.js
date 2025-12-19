// 예약 확정 SMS 발송 활성화 스크립트
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCKi1jR1n-XgtLFRO-EUZ_W8KnsspuddKI",
  authDomain: "choho-pension.firebaseapp.com",
  projectId: "choho-pension",
  storageBucket: "choho-pension.appspot.com",
  messagingSenderId: "358452632058",
  appId: "1:358452632058:web:b9e0863a5e0e6c3c5de844"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function enableConfirmationSMS() {
  try {
    console.log('=================================================');
    console.log('🚀 예약 확정 SMS 발송 설정 활성화 스크립트');
    console.log('=================================================\n');
    
    // 초호펜션 설정 업데이트
    console.log('📌 초호펜션 설정 업데이트 중...');
    const chohoRef = doc(db, 'settings', 'notifications_v2_choho');
    const chohoDoc = await getDoc(chohoRef);
    
    if (chohoDoc.exists()) {
      const chohoData = chohoDoc.data();
      const updatedRoomSettings = {};
      
      console.log('\n초호펜션 객실별 현재 설정:');
      console.log('----------------------------------------');
      
      for (const [roomName, roomSetting] of Object.entries(chohoData.roomSettings || {})) {
        const currentStatus = roomSetting?.autoSend?.confirmationEnabled || false;
        console.log(`  ${roomName}: ${currentStatus ? '✅ 활성화' : '❌ 비활성화'}`);
        
        // 설정 업데이트
        updatedRoomSettings[roomName] = {
          ...roomSetting,
          enabled: true,  // 객실 알림 활성화
          autoSend: {
            ...roomSetting.autoSend,
            confirmationEnabled: true,  // 예약 확정 SMS 활성화
            checkInEnabled: roomSetting?.autoSend?.checkInEnabled ?? true,  // 입실 안내 활성화
            checkOutEnabled: roomSetting?.autoSend?.checkOutEnabled ?? true,  // 퇴실 안내 활성화
            cancellationEnabled: roomSetting?.autoSend?.cancellationEnabled ?? false,  // 취소 안내는 기본 비활성화
            checkInHoursBefore: roomSetting?.autoSend?.checkInHoursBefore ?? 3,  // 입실 3시간 전
            checkOutHoursBefore: roomSetting?.autoSend?.checkOutHoursBefore ?? 1   // 퇴실 1시간 전
          }
        };
      }
      
      // Firestore 업데이트
      await updateDoc(chohoRef, {
        roomSettings: updatedRoomSettings,
        updatedAt: new Date().toISOString()
      });
      
      console.log('\n✅ 초호펜션 모든 객실 설정 업데이트 완료!');
    }
    
    // 초호쉼터 설정 업데이트
    console.log('\n📌 초호쉼터 설정 업데이트 중...');
    const shelterRef = doc(db, 'settings', 'notifications_v2_shelter');
    const shelterDoc = await getDoc(shelterRef);
    
    if (shelterDoc.exists()) {
      const shelterData = shelterDoc.data();
      const updatedRoomSettings = {};
      
      console.log('\n초호쉼터 객실별 현재 설정:');
      console.log('----------------------------------------');
      
      for (const [roomName, roomSetting] of Object.entries(shelterData.roomSettings || {})) {
        const currentStatus = roomSetting?.autoSend?.confirmationEnabled || false;
        console.log(`  ${roomName}: ${currentStatus ? '✅ 활성화' : '❌ 비활성화'}`);
        
        // 설정 업데이트
        updatedRoomSettings[roomName] = {
          ...roomSetting,
          enabled: true,  // 객실 알림 활성화
          autoSend: {
            ...roomSetting.autoSend,
            confirmationEnabled: true,  // 예약 확정 SMS 활성화
            checkInEnabled: roomSetting?.autoSend?.checkInEnabled ?? true,  // 입실 안내 활성화
            checkOutEnabled: roomSetting?.autoSend?.checkOutEnabled ?? true,  // 퇴실 안내 활성화
            cancellationEnabled: roomSetting?.autoSend?.cancellationEnabled ?? false,  // 취소 안내는 기본 비활성화
            checkInHoursBefore: roomSetting?.autoSend?.checkInHoursBefore ?? 3,  // 입실 3시간 전
            checkOutHoursBefore: roomSetting?.autoSend?.checkOutHoursBefore ?? 1   // 퇴실 1시간 전
          }
        };
      }
      
      // Firestore 업데이트
      await updateDoc(shelterRef, {
        roomSettings: updatedRoomSettings,
        updatedAt: new Date().toISOString()
      });
      
      console.log('\n✅ 초호쉼터 모든 객실 설정 업데이트 완료!');
    }
    
    // 최종 확인
    console.log('\n=================================================');
    console.log('🎉 모든 설정이 성공적으로 업데이트되었습니다!');
    console.log('=================================================');
    console.log('\n📢 활성화된 기능:');
    console.log('  1. ✅ 예약 확정 시 SMS 자동 발송');
    console.log('  2. ✅ 입실 3시간 전 안내 SMS 자동 발송');
    console.log('  3. ✅ 퇴실 1시간 전 안내 SMS 자동 발송');
    console.log('\n📱 SMS는 고객 전화번호로 발송됩니다.');
    console.log('📞 발신번호: 010-7932-0029');
    console.log('\n🔧 설정 변경이 필요한 경우 알림 설정 메뉴에서 수정하세요.');
    
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    console.error('상세 오류:', error.message);
  }
}

// 스크립트 실행
enableConfirmationSMS();
