// GroupReservation.js - 단체예약 정보 모델
export const GroupReservationModel = {
  // 예약 정보는 일반 예약과 동일하지만 추가 필드
  reservationId: '',      // 연결된 예약 ID
  
  // 단체 정보
  groupName: '',          // 단체명
  groupType: '',          // 단체 유형 (회사, 학교, 동호회, 가족모임 등)
  purpose: '',            // 방문 목적 (워크샵, MT, 수련회, 가족행사 등)
  
  // 인원 정보
  adultCount: 0,          // 성인 인원
  childCount: 0,          // 아동 인원
  totalCount: 0,          // 총 인원
  
  // 단체 담당자
  organizerName: '',      // 담당자명
  organizerPhone: '',     // 담당자 연락처
  organizerEmail: '',     // 담당자 이메일
  
  // 추가 요청사항
  mealRequests: {
    breakfast: false,     // 조식
    lunch: false,         // 중식
    dinner: false,        // 석식
    mealCount: 0,         // 식사 인원
    specialDiet: []       // 특별 식단 (채식, 알러지 등)
  },
  
  eventSupport: {
    soundSystem: false,   // 음향장비
    projector: false,     // 프로젝터
    microphone: false,    // 마이크
    campfire: false,      // 캠프파이어
    bbqSupport: false,    // 바베큐 지원
    other: ''             // 기타 요청
  },
  
  // 객실 배정
  roomAssignment: [],     // [{roomName: '객실명', guestNames: ['게스트1', '게스트2']}]
  
  // 일정
  schedule: [],           // [{time: '14:00', activity: '체크인'}, ...]
  
  // 결제 정보
  paymentMethod: '',      // 현금, 카드, 계좌이체, 세금계산서
  taxInvoice: false,      // 세금계산서 발행 여부
  companyInfo: {          // 세금계산서용 회사 정보
    name: '',
    registrationNumber: '',
    representative: '',
    address: '',
    businessType: '',
    businessItem: ''
  },
  
  // 특별 요청
  specialRequests: '',    // 자유 텍스트
  
  // 내부 메모
  internalNotes: '',      // 관리자용 메모
  
  // 메타 정보
  createdAt: null,
  updatedAt: null
};

// 단체 유형
export const GroupTypes = [
  { id: 'company', name: '회사/기업', icon: '🏢' },
  { id: 'school', name: '학교/학원', icon: '🏫' },
  { id: 'club', name: '동호회/모임', icon: '👥' },
  { id: 'family', name: '가족/친지', icon: '👨‍👩‍👧‍👦' },
  { id: 'religious', name: '종교단체', icon: '⛪' },
  { id: 'sports', name: '스포츠팀', icon: '⚽' },
  { id: 'other', name: '기타', icon: '📋' }
];

// 방문 목적
export const VisitPurposes = [
  { id: 'workshop', name: '워크샵/세미나' },
  { id: 'mt', name: 'MT/수련회' },
  { id: 'teambuilding', name: '팀빌딩' },
  { id: 'celebration', name: '기념행사' },
  { id: 'reunion', name: '동창회/모임' },
  { id: 'vacation', name: '단체 휴가' },
  { id: 'training', name: '교육/연수' },
  { id: 'other', name: '기타' }
];
