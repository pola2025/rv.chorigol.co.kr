// src/utils/authSecurity.js

import { auth } from '../config/firebase';

// 허용된 관리자 이메일 목록
const ALLOWED_ADMINS = [
  'admin@choho-pension.com',
  'manager@choho-pension.com'
  // 실제 관리자 이메일을 여기에 추가하세요
];

// 관리자 권한 확인
export const isUserAdmin = async (user) => {
  if (!user) return false;
  
  try {
    // 이메일 인증 확인
    if (!user.emailVerified) {
      console.warn('User email not verified:', user.email);
      return false;
    }
    
    // 허용된 관리자 목록 확인
    if (!ALLOWED_ADMINS.includes(user.email)) {
      console.warn('Unauthorized access attempt:', user.email);
      return false;
    }
    
    // ID 토큰 강제 새로고침하여 최신 클레임 가져오기
    const idTokenResult = await user.getIdTokenResult(true);
    
    // 커스텀 클레임 확인 (선택사항)
    // if (!idTokenResult.claims.admin) {
    //   return false;
    // }
    
    return true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// 세션 타임아웃 설정 (30분)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30분
let lastActivityTime = Date.now();

export const updateLastActivity = () => {
  lastActivityTime = Date.now();
};

export const checkSessionTimeout = () => {
  const now = Date.now();
  if (now - lastActivityTime > SESSION_TIMEOUT) {
    auth.signOut();
    alert('보안을 위해 자동으로 로그아웃되었습니다.');
    return true;
  }
  return false;
};

// 의심스러운 활동 감지
export const detectSuspiciousActivity = (activity) => {
  // 예: 짧은 시간에 너무 많은 요청
  // 실제 구현은 더 복잡할 수 있습니다
  console.log('Activity logged:', activity);
};

// IP 주소 기반 접근 제한 (선택사항)
export const checkIPRestriction = async () => {
  // Firebase Functions를 사용하여 구현 가능
  // 현재는 클라이언트 사이드에서 제한적
  return true;
};
