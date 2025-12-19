// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log('Firebase Config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-4) : 'undefined'
});

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Auth 인스턴스
export const auth = getAuth(app);

// Firestore 인스턴스
export const db = getFirestore(app);

// 로컬 개발 환경에서 에뮬레이터 사용 (선택사항)
// if (import.meta.env.DEV) {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

// Storage 인스턴스
export const storage = getStorage(app);

// Functions 인스턴스
export const functions = getFunctions(app, 'asia-northeast3');

// serverTimestamp 헬퍼 함수
export const getServerTimestamp = () => serverTimestamp();

// timeHelpers 객체 - 날짜 관련 유틸리티 함수들
export const timeHelpers = {
  // 날짜 문자열을 YYYY-MM-DD 형식으로 변환
  formatDate: (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  // 두 날짜 사이의 일수 계산
  daysBetween: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  },
  
  // 날짜가 오늘인지 확인
  isToday: (date) => {
    const today = new Date();
    const d = new Date(date);
    return d.toDateString() === today.toDateString();
  },
  
  // 날짜가 과거인지 확인
  isPast: (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  },
  
  // 날짜가 미래인지 확인
  isFuture: (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d > today;
  },
  
  // 날짜 범위 생성
  getDateRange: (startDate, endDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate < end) {
      dates.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  },
  
  // 서버 타임스탬프 생성
  serverTimestamp: () => serverTimestamp()
};

// 디버깅을 위한 로그
if (import.meta.env.DEV) {
  console.log('Firebase initialized successfully');
}

export default app;