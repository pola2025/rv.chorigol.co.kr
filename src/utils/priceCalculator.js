// src/utils/priceCalculator.js

// 한국 공휴일 목록
export const KOREAN_HOLIDAYS = {
  2024: [
    { date: '2024-01-01', name: '신정' },
    { date: '2024-02-09', name: '설날 연휴' },
    { date: '2024-02-10', name: '설날' },
    { date: '2024-02-11', name: '설날 연휴' },
    { date: '2024-02-12', name: '대체공휴일' },
    { date: '2024-03-01', name: '삼일절' },
    { date: '2024-05-05', name: '어린이날' },
    { date: '2024-05-06', name: '대체공휴일' },
    { date: '2024-05-15', name: '부처님오신날' },
    { date: '2024-06-06', name: '현충일' },
    { date: '2024-08-15', name: '광복절' },
    { date: '2024-09-16', name: '추석 연휴' },
    { date: '2024-09-17', name: '추석' },
    { date: '2024-09-18', name: '추석 연휴' },
    { date: '2024-10-03', name: '개천절' },
    { date: '2024-10-09', name: '한글날' },
    { date: '2024-12-25', name: '크리스마스' },
    { date: '2024-12-31', name: '연말' }
  ],
  2025: [
    { date: '2025-01-01', name: '신정' },
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-03-01', name: '삼일절' },
    { date: '2025-05-05', name: '어린이날' },
    { date: '2025-05-06', name: '부처님오신날' },
    { date: '2025-06-06', name: '현충일' },
    { date: '2025-08-15', name: '광복절' },
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
    { date: '2025-10-03', name: '개천절' },
    { date: '2025-10-09', name: '한글날' },
    { date: '2025-12-25', name: '크리스마스' },
    { date: '2025-12-31', name: '연말' }
  ]
};

// 날짜가 주말인지 확인 (토요일만)
export const isWeekend = (date) => {
  const day = new Date(date).getDay();
  return day === 6; // 토요일만 주말
};

// 날짜가 공휴일인지 확인
export const isHoliday = (date, customHolidays = []) => {
  const dateStr = date instanceof Date ? 
    date.toISOString().split('T')[0] : date;
  
  const year = new Date(dateStr).getFullYear();
  const defaultHolidays = KOREAN_HOLIDAYS[year] || [];
  const allHolidays = [...defaultHolidays, ...customHolidays];
  
  return allHolidays.some(h => h.date === dateStr);
};

// 날짜가 공휴일 전날인지 확인
export const isBeforeHoliday = (date, customHolidays = []) => {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isHoliday(tomorrow, customHolidays);
};

// 특정 날짜의 가격 타입 결정
export const getPriceType = (date, customHolidays = []) => {
  const dateObj = new Date(date);
  const dateStr = dateObj.toISOString().split('T')[0];
  
  // 우선순위: 공휴일/전날 > 특별날짜 > 주말 > 주중
  if (isHoliday(dateStr, customHolidays) || isBeforeHoliday(dateStr, customHolidays)) {
    return 'weekend'; // 주말 가격 적용
  }
  
  // 크리스마스, 12/31, 1/1 체크
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  if ((month === 12 && (day === 25 || day === 31)) || (month === 1 && day === 1)) {
    return 'weekend';
  }
  
  // 토요일 체크
  if (isWeekend(dateObj)) {
    return 'weekend';
  }
  
  return 'weekday';
};

// 가격 계산 헬퍼 함수
export const calculatePriceForDate = (date, room, pricingRules, customHolidays = []) => {
  const dateStr = date.toISOString().split('T')[0];
  
  // 시즌 가격 확인
  const seasonRule = pricingRules?.find(rule => 
    rule.type === 'season' && 
    dateStr >= rule.startDate && 
    dateStr <= rule.endDate
  );
  
  const priceType = getPriceType(date, customHolidays);
  
  if (seasonRule) {
    if (priceType === 'weekend') {
      return seasonRule.weekendPrices?.[room.id] || room.주말요금 || room.기본요금 || 0;
    } else {
      return seasonRule.weekdayPrices?.[room.id] || room.주중요금 || room.기본요금 || 0;
    }
  }
  
  // 기본 주중/주말 가격
  return priceType === 'weekend' ? 
    (room.주말요금 || room.기본요금 || 0) : 
    (room.주중요금 || room.기본요금 || 0);
};
