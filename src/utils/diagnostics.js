// Firebase 환경 및 예약 시스템 진단 스크립트
import { db, auth } from '../config/firebase';
import reservationDebugger from '../utils/reservationDebugger';

export const runDiagnostics = async () => {
  console.log('='.repeat(50));
  console.log('🔍 예약 시스템 진단 시작');
  console.log('='.repeat(50));
  
  const results = {
    environment: {},
    firebase: {},
    auth: {},
    firestore: {},
    errors: [],
    warnings: []
  };
  
  // 1. 환경 변수 확인
  console.log('\n1️⃣ 환경 변수 확인 중...');
  const envVars = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
  
  Object.keys(envVars).forEach(key => {
    const value = envVars[key];
    const isSet = !!value;
    results.environment[key] = isSet;
    
    if (!isSet) {
      results.errors.push(`환경 변수 누락: VITE_FIREBASE_${key.toUpperCase()}`);
    }
    
    console.log(`  ${isSet ? '✅' : '❌'} ${key}: ${isSet ? '설정됨' : '누락'}`);
  });
  
  // 2. Firebase 연결 확인
  console.log('\n2️⃣ Firebase 연결 확인 중...');
  try {
    if (db) {
      results.firebase.initialized = true;
      console.log('  ✅ Firebase 초기화 완료');
      
      // Firestore 테스트 쿼리
      const { collection, getDocs, limit, query } = await import('firebase/firestore');
      const testQuery = query(collection(db, 'reservations'), limit(1));
      const snapshot = await getDocs(testQuery);
      
      results.firestore.connected = true;
      results.firestore.documentCount = snapshot.size;
      console.log(`  ✅ Firestore 연결 성공 (문서 수: ${snapshot.size})`);
    } else {
      results.firebase.initialized = false;
      results.errors.push('Firebase DB 인스턴스가 생성되지 않았습니다');
      console.log('  ❌ Firebase DB 초기화 실패');
    }
  } catch (error) {
    results.firestore.connected = false;
    results.firestore.error = error.message;
    results.errors.push(`Firestore 연결 실패: ${error.message}`);
    console.error('  ❌ Firestore 연결 실패:', error.message);
    
    // 권한 오류 상세 분석
    if (error.code === 'permission-denied') {
      console.log('\n  🔐 권한 오류 상세:');
      console.log('  - Firestore 보안 규칙을 확인하세요');
      console.log('  - 사용자가 로그인되어 있는지 확인하세요');
      results.warnings.push('Firestore 권한이 거부되었습니다. 보안 규칙을 확인하세요.');
    }
  }
  
  // 3. 인증 상태 확인
  console.log('\n3️⃣ 인증 상태 확인 중...');
  if (auth) {
    const user = auth.currentUser;
    if (user) {
      results.auth.authenticated = true;
      results.auth.userEmail = user.email;
      console.log(`  ✅ 인증됨: ${user.email}`);
    } else {
      results.auth.authenticated = false;
      results.warnings.push('사용자가 로그인되어 있지 않습니다');
      console.log('  ⚠️  사용자가 로그인되어 있지 않습니다');
    }
  } else {
    results.auth.initialized = false;
    results.errors.push('Firebase Auth가 초기화되지 않았습니다');
    console.log('  ❌ Firebase Auth 초기화 실패');
  }
  
  // 4. Timestamp 관련 확인
  console.log('\n4️⃣ Timestamp 함수 확인 중...');
  try {
    const { Timestamp, serverTimestamp } = await import('firebase/firestore');
    
    if (typeof Timestamp.now === 'function') {
      results.firebase.timestampAvailable = true;
      console.log('  ✅ Timestamp.now() 사용 가능');
    } else {
      results.warnings.push('Timestamp.now() 함수를 사용할 수 없습니다');
      console.log('  ⚠️  Timestamp.now() 사용 불가');
    }
    
    if (typeof serverTimestamp === 'function') {
      results.firebase.serverTimestampAvailable = true;
      console.log('  ✅ serverTimestamp() 사용 가능');
    } else {
      results.warnings.push('serverTimestamp() 함수를 사용할 수 없습니다');
      console.log('  ⚠️  serverTimestamp() 사용 불가');
    }
  } catch (error) {
    results.errors.push(`Timestamp 함수 import 실패: ${error.message}`);
    console.error('  ❌ Timestamp 함수 확인 실패:', error.message);
  }
  
  // 5. 예약 추가 테스트 (Dry Run)
  console.log('\n5️⃣ 예약 추가 시뮬레이션...');
  const testReservation = {
    customerName: '테스트 고객',
    phone: '010-1234-5678',
    roomName: 'Forest',
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    guests: 2,
    totalPrice: 100000,
    status: '입금대기',
    source: 'transfer'
  };
  
  const validation = reservationDebugger.validateReservationData(testReservation);
  if (validation.isValid) {
    console.log('  ✅ 예약 데이터 검증 통과');
  } else {
    console.log('  ❌ 예약 데이터 검증 실패:', validation.errors);
    results.errors.push(...validation.errors);
  }
  
  if (validation.warnings.length > 0) {
    console.log('  ⚠️  경고:', validation.warnings);
    results.warnings.push(...validation.warnings);
  }
  
  // 결과 요약
  console.log('\n' + '='.repeat(50));
  console.log('📊 진단 결과 요약');
  console.log('='.repeat(50));
  
  const totalErrors = results.errors.length;
  const totalWarnings = results.warnings.length;
  
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('✅ 모든 시스템이 정상입니다!');
  } else {
    if (totalErrors > 0) {
      console.log(`\n❌ 오류 ${totalErrors}개:`);
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    if (totalWarnings > 0) {
      console.log(`\n⚠️  경고 ${totalWarnings}개:`);
      results.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }
    
    console.log('\n💡 해결 방법:');
    console.log('1. .env 파일에 Firebase 설정이 올바르게 되어 있는지 확인');
    console.log('2. Firebase Console에서 Firestore가 활성화되어 있는지 확인');
    console.log('3. Firestore 보안 규칙이 올바르게 설정되어 있는지 확인');
    console.log('4. 사용자가 로그인되어 있는지 확인');
  }
  
  return results;
};

// 전역으로 사용 가능하도록 등록
if (typeof window !== 'undefined') {
  window.runDiagnostics = runDiagnostics;
}

export default runDiagnostics;
