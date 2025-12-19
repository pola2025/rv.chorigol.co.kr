// src/scripts/updateFirestoreData.js
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  setDoc,
  writeBatch 
} from 'firebase/firestore';

// Firebase 설정 (환경변수 대신 직접 입력 필요)
const firebaseConfig = {
  apiKey: process.env.VITE_APP_API_KEY,
  authDomain: process.env.VITE_APP_AUTH_DOMAIN,
  projectId: process.env.VITE_APP_PROJECT_ID,
  storageBucket: process.env.VITE_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_APP_MESSAGING_SENDER_ID,
  appId: process.env.VITE_APP_APP_ID
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 1. rooms 컬렉션에 주중/주말 요금 필드 추가
async function updateRoomsPricing() {
  console.log('객실 가격 정보 업데이트 시작...');
  
  const roomsRef = collection(db, 'rooms');
  const snapshot = await getDocs(roomsRef);
  
  const batch = writeBatch(db);
  
  snapshot.forEach((roomDoc) => {
    const roomData = roomDoc.data();
    const updates = {};
    
    // 주중요금, 주말요금이 없으면 기본요금으로 설정
    if (!roomData.주중요금) {
      updates.주중요금 = roomData.기본요금 || 0;
    }
    if (!roomData.주말요금) {
      updates.주말요금 = roomData.기본요금 || 0;
    }
    if (!roomData.기본재고 && roomData.재고) {
      updates.기본재고 = roomData.재고;
    }
    
    if (Object.keys(updates).length > 0) {
      batch.update(doc(db, 'rooms', roomDoc.id), updates);
      console.log(`- ${roomData.객실명} 업데이트 예정:`, updates);
    }
  });
  
  await batch.commit();
  console.log('객실 가격 정보 업데이트 완료!');
}

// 2. 기존 예약에 source 필드 추가 (기본값: 'etc')
async function updateReservationsSource() {
  console.log('예약 출처 정보 업데이트 시작...');
  
  const reservationsRef = collection(db, 'reservations');
  const snapshot = await getDocs(reservationsRef);
  
  const batch = writeBatch(db);
  let count = 0;
  
  snapshot.forEach((resDoc) => {
    const resData = resDoc.data();
    
    // source 필드가 없으면 'etc'로 설정
    if (!resData.source) {
      batch.update(doc(db, 'reservations', resDoc.id), {
        source: 'etc'
      });
      count++;
    }
  });
  
  await batch.commit();
  console.log(`${count}개의 예약에 출처 정보 추가 완료!`);
}

// 3. marketing_stats 컬렉션 초기화
async function initMarketingStats() {
  console.log('마케팅 통계 초기화 시작...');
  
  const statsRef = collection(db, 'marketing_stats');
  const snapshot = await getDocs(statsRef);
  
  // 이미 데이터가 있으면 스킵
  if (!snapshot.empty) {
    console.log('마케팅 통계가 이미 존재합니다.');
    return;
  }
  
  // 초기 데이터 생성
  await setDoc(doc(statsRef), {
    visitors: '',
    pageViews: '',
    totalVisits: '',
    channels: [
      { rank: 1, name: '', visits: '' },
      { rank: 2, name: '', visits: '' },
      { rank: 3, name: '', visits: '' },
      { rank: 4, name: '', visits: '' },
      { rank: 5, name: '', visits: '' }
    ],
    lastUpdated: new Date().toISOString()
  });
  
  console.log('마케팅 통계 초기화 완료!');
}

// 4. 공휴일 데이터 초기화
async function initHolidays() {
  console.log('공휴일 데이터 초기화 시작...');
  
  const holidaysRef = collection(db, 'holidays');
  const snapshot = await getDocs(holidaysRef);
  
  // 이미 데이터가 있으면 스킵
  if (!snapshot.empty) {
    console.log('공휴일 데이터가 이미 존재합니다.');
    return;
  }
  
  // 2025년 주요 공휴일 추가 (샘플)
  const holidays2025 = [
    { date: '2025-01-01', name: '신정', year: 2025 },
    { date: '2025-01-28', name: '설날 연휴', year: 2025 },
    { date: '2025-01-29', name: '설날', year: 2025 },
    { date: '2025-01-30', name: '설날 연휴', year: 2025 },
    { date: '2025-03-01', name: '삼일절', year: 2025 },
    { date: '2025-05-05', name: '어린이날', year: 2025 },
    { date: '2025-06-06', name: '현충일', year: 2025 },
    { date: '2025-08-15', name: '광복절', year: 2025 },
    { date: '2025-10-03', name: '개천절', year: 2025 },
    { date: '2025-10-09', name: '한글날', year: 2025 },
    { date: '2025-12-25', name: '크리스마스', year: 2025 }
  ];
  
  const batch = writeBatch(db);
  
  holidays2025.forEach(holiday => {
    const docRef = doc(holidaysRef);
    batch.set(docRef, {
      ...holiday,
      isCustom: false,
      createdAt: new Date().toISOString()
    });
  });
  
  await batch.commit();
  console.log('공휴일 데이터 초기화 완료!');
}

// 메인 실행 함수
async function main() {
  console.log('=== Firestore 데이터 업데이트 시작 ===\n');
  
  try {
    await updateRoomsPricing();
    console.log('');
    
    await updateReservationsSource();
    console.log('');
    
    await initMarketingStats();
    console.log('');
    
    await initHolidays();
    console.log('');
    
    console.log('=== 모든 업데이트 완료! ===');
    process.exit(0);
  } catch (error) {
    console.error('업데이트 중 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
main();
