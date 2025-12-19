// 월별 매출 자동집계 서비스
// 8월 이후 예약 데이터에서 자동으로 매출 계산

import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * 월별 매출 자동 계산
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {string} businessType - 'pension' or 'shelter' (optional)
 * @returns {Object|null} 매출 데이터 또는 null (자동집계 불가 시)
 */
export const calculateMonthlyRevenue = async (year, month, businessType = null) => {
  try {
    // 8월 이전은 수동입력만 허용
    if (year < 2025 || (year === 2025 && month < 8)) {
      console.log(`📝 ${year}년 ${month}월은 수동입력 기간입니다.`);
      return null;
    }

    console.log(`🤖 ${year}년 ${month}월 매출 자동집계 시작...`);

    // 해당 월의 시작일과 종료일 계산
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    // Firestore 쿼리: 해당 월의 확정된 예약
    const constraints = [
      where('checkIn', '>=', Timestamp.fromDate(startDate)),
      where('checkIn', '<=', Timestamp.fromDate(endDate)),
      where('status', 'in', ['예약확정', '입금완료'])
    ];
    
    // businessType이 지정된 경우 필터 추가
    if (businessType) {
      constraints.push(where('businessType', '==', businessType));
    }
    
    const reservationsQuery = query(
      collection(db, 'reservations'),
      ...constraints
    );

    const snapshot = await getDocs(reservationsQuery);
    
    // 매출 집계
    let roomRevenue = 0;
    let optionRevenue = 0;
    let reservationCount = 0;
    const reservationDetails = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      reservationCount++;
      
      // 객실 매출 계산
      const roomPrice = data.roomPrice || data.totalPrice || 0;
      roomRevenue += roomPrice;
      
      // 옵션 매출 계산 (바베큐, 캠핑버너 등)
      let optionPrice = 0;
      if (data.options && Array.isArray(data.options)) {
        data.options.forEach(option => {
          optionPrice += option.price || 0;
        });
      } else if (data.optionPrice) {
        optionPrice = data.optionPrice;
      }
      optionRevenue += optionPrice;
      
      // 상세 내역 저장 (디버깅용)
      reservationDetails.push({
        id: doc.id,
        customerName: data.customerName,
        roomName: data.roomName,
        checkIn: data.checkIn.toDate().toISOString().split('T')[0],
        roomPrice,
        optionPrice,
        totalPrice: roomPrice + optionPrice
      });
    });

    const result = {
      room: roomRevenue,
      option: optionRevenue,
      total: roomRevenue + optionRevenue,
      reservationCount,
      lastCalculated: new Date(),
      source: 'system',
      details: reservationDetails
    };

    console.log(`✅ ${year}년 ${month}월 매출 자동집계 완료:`, {
      객실매출: roomRevenue.toLocaleString(),
      옵션매출: optionRevenue.toLocaleString(),
      총매출: result.total.toLocaleString(),
      예약건수: reservationCount
    });

    return result;

  } catch (error) {
    console.error('❌ 매출 자동집계 오류:', error);
    throw new Error(`매출 자동집계 실패: ${error.message}`);
  }
};

/**
 * 특정 기간 매출 합계 계산
 * @param {number} year - 연도
 * @param {number} startMonth - 시작 월
 * @param {number} endMonth - 종료 월
 */
export const calculatePeriodRevenue = async (year, startMonth, endMonth) => {
  let totalRevenue = 0;
  const monthlyData = [];

  for (let month = startMonth; month <= endMonth; month++) {
    const revenue = await calculateMonthlyRevenue(year, month);
    if (revenue) {
      totalRevenue += revenue.total;
      monthlyData.push({
        month,
        revenue: revenue.total
      });
    }
  }

  return {
    total: totalRevenue,
    monthly: monthlyData,
    period: `${year}년 ${startMonth}월 ~ ${endMonth}월`
  };
};

/**
 * 월별 매출 비교 (전월 대비)
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const compareWithPreviousMonth = async (year, month) => {
  const currentRevenue = await calculateMonthlyRevenue(year, month);
  
  // 이전 월 계산
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  
  const previousRevenue = await calculateMonthlyRevenue(prevYear, prevMonth);
  
  if (!currentRevenue || !previousRevenue) {
    return null;
  }

  const difference = currentRevenue.total - previousRevenue.total;
  const growthRate = (difference / previousRevenue.total) * 100;

  return {
    current: {
      period: `${year}년 ${month}월`,
      revenue: currentRevenue.total
    },
    previous: {
      period: `${prevYear}년 ${prevMonth}월`,
      revenue: previousRevenue.total
    },
    difference,
    growthRate: growthRate.toFixed(2)
  };
};

/**
 * 자동집계 가능 여부 확인
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const isAutoCalculationAvailable = (year, month) => {
  // 2025년 8월 이후만 자동집계 가능
  return year > 2025 || (year === 2025 && month >= 8);
};

export default {
  calculateMonthlyRevenue,
  calculatePeriodRevenue,
  compareWithPreviousMonth,
  isAutoCalculationAvailable
};