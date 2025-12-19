// 한국 공휴일/명절/대체휴일 데이터
// 매년 업데이트 필요 (음력 명절은 매년 날짜가 다름)

// 2024년 공휴일
const holidays2024 = {
  '2024-01-01': { name: '신정', type: 'holiday' },
  '2024-02-09': { name: '설날 연휴', type: 'holiday' },
  '2024-02-10': { name: '설날', type: 'holiday' },
  '2024-02-11': { name: '설날 연휴', type: 'holiday' },
  '2024-02-12': { name: '대체휴일', type: 'substitute' },
  '2024-03-01': { name: '삼일절', type: 'holiday' },
  '2024-04-10': { name: '22대 국회의원 선거', type: 'holiday' },
  '2024-05-05': { name: '어린이날', type: 'holiday' },
  '2024-05-06': { name: '대체휴일', type: 'substitute' },
  '2024-05-15': { name: '부처님오신날', type: 'holiday' },
  '2024-06-06': { name: '현충일', type: 'holiday' },
  '2024-08-15': { name: '광복절', type: 'holiday' },
  '2024-09-16': { name: '추석 연휴', type: 'holiday' },
  '2024-09-17': { name: '추석', type: 'holiday' },
  '2024-09-18': { name: '추석 연휴', type: 'holiday' },
  '2024-10-03': { name: '개천절', type: 'holiday' },
  '2024-10-09': { name: '한글날', type: 'holiday' },
  '2024-12-25': { name: '크리스마스', type: 'holiday' },
};

// 2025년 공휴일
const holidays2025 = {
  '2025-01-01': { name: '신정', type: 'holiday' },
  '2025-01-28': { name: '설날 연휴', type: 'holiday' },
  '2025-01-29': { name: '설날', type: 'holiday' },
  '2025-01-30': { name: '설날 연휴', type: 'holiday' },
  '2025-03-01': { name: '삼일절', type: 'holiday' },
  '2025-03-03': { name: '대체휴일', type: 'substitute' },
  '2025-05-05': { name: '어린이날/부처님오신날', type: 'holiday' },
  '2025-05-06': { name: '대체휴일', type: 'substitute' },
  '2025-06-06': { name: '현충일', type: 'holiday' },
  '2025-08-15': { name: '광복절', type: 'holiday' },
  '2025-10-03': { name: '개천절', type: 'holiday' },
  '2025-10-05': { name: '추석 연휴', type: 'holiday' },
  '2025-10-06': { name: '추석', type: 'holiday' },
  '2025-10-07': { name: '추석 연휴', type: 'holiday' },
  '2025-10-08': { name: '대체휴일', type: 'substitute' },
  '2025-10-09': { name: '한글날', type: 'holiday' },
  '2025-12-25': { name: '크리스마스', type: 'holiday' },
};

// 2026년 공휴일
const holidays2026 = {
  '2026-01-01': { name: '신정', type: 'holiday' },
  '2026-02-16': { name: '설날 연휴', type: 'holiday' },
  '2026-02-17': { name: '설날', type: 'holiday' },
  '2026-02-18': { name: '설날 연휴', type: 'holiday' },
  '2026-03-01': { name: '삼일절', type: 'holiday' },
  '2026-03-02': { name: '대체휴일', type: 'substitute' },
  '2026-05-05': { name: '어린이날', type: 'holiday' },
  '2026-05-24': { name: '부처님오신날', type: 'holiday' },
  '2026-05-25': { name: '대체휴일', type: 'substitute' },
  '2026-06-06': { name: '현충일', type: 'holiday' },
  '2026-08-15': { name: '광복절', type: 'holiday' },
  '2026-08-17': { name: '대체휴일', type: 'substitute' },
  '2026-09-24': { name: '추석 연휴', type: 'holiday' },
  '2026-09-25': { name: '추석', type: 'holiday' },
  '2026-09-26': { name: '추석 연휴', type: 'holiday' },
  '2026-10-03': { name: '개천절', type: 'holiday' },
  '2026-10-05': { name: '대체휴일', type: 'substitute' },
  '2026-10-09': { name: '한글날', type: 'holiday' },
  '2026-12-25': { name: '크리스마스', type: 'holiday' },
};

// 모든 공휴일 합치기
const allHolidays = {
  ...holidays2024,
  ...holidays2025,
  ...holidays2026,
};

/**
 * 특정 날짜가 공휴일인지 확인
 * @param {string} dateStr - YYYY-MM-DD 형식
 * @returns {object|null} - 공휴일 정보 또는 null
 */
export const getHoliday = (dateStr) => {
  return allHolidays[dateStr] || null;
};

/**
 * 특정 날짜가 공휴일인지 여부만 확인
 * @param {string} dateStr - YYYY-MM-DD 형식
 * @returns {boolean}
 */
export const isHoliday = (dateStr) => {
  return !!allHolidays[dateStr];
};

/**
 * 특정 월의 모든 공휴일 가져오기
 * @param {number} year
 * @param {number} month - 0-indexed (0 = 1월)
 * @returns {object} - { dateStr: holidayInfo }
 */
export const getHolidaysInMonth = (year, month) => {
  const monthStr = String(month + 1).padStart(2, '0');
  const prefix = `${year}-${monthStr}`;

  const result = {};
  Object.entries(allHolidays).forEach(([dateStr, info]) => {
    if (dateStr.startsWith(prefix)) {
      result[dateStr] = info;
    }
  });

  return result;
};

export default allHolidays;
