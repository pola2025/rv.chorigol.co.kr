// Customer.js - 고객 정보 모델
export const CustomerModel = {
  // 고객 ID는 전화번호를 기준으로 생성 (010-1234-5678 -> 01012345678)
  id: '', // phone number without hyphens
  
  // 기본 정보
  name: '',           // 고객명
  phone: '',          // 전화번호
  email: '',          // 이메일 (선택)
  
  // 방문 정보
  firstVisitDate: null,     // 첫 방문 날짜
  lastVisitDate: null,      // 마지막 방문 날짜
  visitCount: 0,            // 총 방문 횟수
  totalSpent: 0,            // 총 결제 금액
  
  // 예약 정보
  reservations: [],         // 예약 ID 목록
  cancelCount: 0,           // 취소 횟수
  noShowCount: 0,           // 노쇼 횟수
  
  // 선호도 정보
  preferredRooms: [],       // 선호 객실
  specialRequests: [],      // 특별 요청사항
  
  // 고객 등급
  customerGrade: 'NORMAL',  // NORMAL, VIP, VVIP
  
  // 메모
  notes: '',               // 관리자 메모
  tags: [],                // 태그 (가족단위, 비즈니스, 커플 등)
  
  // 마케팅 동의
  marketingConsent: false,  // 마케팅 수신 동의
  
  // 메타 정보
  createdAt: null,
  updatedAt: null
};

// 고객 등급 기준
export const CustomerGrades = {
  NORMAL: {
    name: '일반',
    minVisits: 0,
    minSpent: 0,
    color: '#666666'
  },
  VIP: {
    name: 'VIP',
    minVisits: 3,
    minSpent: 1000000,
    color: '#FF9800'
  },
  VVIP: {
    name: 'VVIP',
    minVisits: 5,
    minSpent: 3000000,
    color: '#9C27B0'
  }
};

// 고객 태그
export const CustomerTags = [
  { id: 'family', name: '가족단위', color: '#4CAF50' },
  { id: 'couple', name: '커플', color: '#E91E63' },
  { id: 'business', name: '비즈니스', color: '#2196F3' },
  { id: 'group', name: '단체', color: '#FF5722' },
  { id: 'regular', name: '단골', color: '#795548' },
  { id: 'event', name: '이벤트', color: '#9C27B0' },
  { id: 'vip_care', name: 'VIP케어', color: '#FFD700' }
];
