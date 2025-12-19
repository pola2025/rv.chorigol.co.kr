// deleteTestReservations.js
// 테스트 예약 데이터 삭제 스크립트

import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase.js';

const deleteTestReservations = async () => {
  try {
    console.log('테스트 예약 데이터 삭제를 시작합니다...');
    
    // 모든 예약 가져오기
    const reservationsRef = collection(db, 'reservations');
    const snapshot = await getDocs(reservationsRef);
    
    if (snapshot.empty) {
      console.log('삭제할 예약이 없습니다.');
      return;
    }
    
    console.log(`총 ${snapshot.size}개의 예약을 찾았습니다.`);
    
    // 배치로 삭제 (500개씩)
    const batch = writeBatch(db);
    let count = 0;
    const batchSize = 500;
    
    for (const docSnapshot of snapshot.docs) {
      batch.delete(doc(db, 'reservations', docSnapshot.id));
      count++;
      
      // 500개마다 배치 실행
      if (count % batchSize === 0) {
        await batch.commit();
        console.log(`${count}개 삭제 완료...`);
      }
    }
    
    // 남은 문서 삭제
    if (count % batchSize !== 0) {
      await batch.commit();
    }
    
    console.log(`✅ 총 ${count}개의 예약이 삭제되었습니다.`);
    
  } catch (error) {
    console.error('❌ 예약 삭제 중 오류 발생:', error);
  }
};

// 실행
deleteTestReservations();
