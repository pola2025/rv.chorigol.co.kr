// 월별 통계 데이터 저장/조회 서비스
// 평탄화 구조로 Firebase 400 오류 해결

import { doc, setDoc, getDoc, collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { calculateMonthlyRevenue, isAutoCalculationAvailable } from './monthlyRevenueService';

/**
 * 월별 통계 데이터 저장 (평탄화 구조)
 * @param {string} businessType - 'pension' or 'shelter'
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {Object} data - 입력 데이터
 */
export const saveMonthlyStats = async (businessType, year, month, data) => {
  try {
    const businessName = businessType === 'pension' ? '초호펜션' : '초호쉼터';
    console.log(`💾 ${businessName} ${year}년 ${month}월 통계 저장 시작...`);
    
    const docId = `${year}_${String(month).padStart(2, '0')}`;
    const collectionName = businessType === 'pension' ? 'monthly_stats_pension' : 'monthly_stats_shelter';
    
    // 매출 데이터 처리 (8월 이후 자동집계)
    let revenueData = {};
    if (isAutoCalculationAvailable(year, month)) {
      // 자동집계 (businessType 전달)
      const autoRevenue = await calculateMonthlyRevenue(year, month, businessType);
      if (autoRevenue) {
        revenueData = {
          revenue_room: autoRevenue.room,
          revenue_option: autoRevenue.option,
          revenue_total: autoRevenue.total,
          revenue_source: 'auto',
          revenue_calculated_at: Timestamp.fromDate(autoRevenue.lastCalculated)
        };
      }
    } else {
      // 수동입력
      revenueData = {
        revenue_room: data.revenue_room || 0,
        revenue_option: data.revenue_option || 0,
        revenue_total: (data.revenue_room || 0) + (data.revenue_option || 0),
        revenue_source: 'manual'
      };
    }
    
    // 평탄화된 데이터 구조
    const flatData = {
      // 메타데이터
      business_type: businessType,
      business_name: businessName,
      year,
      month,
      doc_id: docId,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      
      // 매출 데이터
      ...revenueData,
      
      // 방문자 데이터 (수동입력)
      visitors_website: data.visitors_website || 0,
      website_pageviews: data.website_pageviews || 0,
      visitors_naver: data.visitors_naver || 0,
      visitors_instagram: data.visitors_instagram || 0,
      visitors_total: (data.visitors_website || 0) + 
                     (data.visitors_naver || 0) + 
                     (data.visitors_instagram || 0),
      
      // 예약 데이터 (수동입력)
      bookings_inquiries: data.bookings_inquiries || 0,
      bookings_new: data.bookings_new || 0,
      bookings_confirmed: data.bookings_confirmed || 0,
      bookings_cancelled: data.bookings_cancelled || 0,
      
      // 광고 데이터 (수동입력)
      ad_naver_spend: data.ad_naver_spend || 0,
      ad_naver_clicks: data.ad_naver_clicks || 0,
      ad_naver_impressions: data.ad_naver_impressions || 0,
      ad_google_spend: data.ad_google_spend || 0,
      ad_google_clicks: data.ad_google_clicks || 0,
      ad_google_impressions: data.ad_google_impressions || 0,
      ad_meta_spend: data.ad_meta_spend || 0,
      ad_meta_clicks: data.ad_meta_clicks || 0,
      ad_kakao_spend: data.ad_kakao_spend || 0,
      ad_other_spend: data.ad_other_spend || 0,
      ad_total_spend: (data.ad_naver_spend || 0) + 
                      (data.ad_google_spend || 0) + 
                      (data.ad_meta_spend || 0) + 
                      (data.ad_kakao_spend || 0) + 
                      (data.ad_other_spend || 0),
      
      // 기타 데이터 (수동입력)
      reviews_count: data.reviews_count || 0,
      
      // 계산된 메트릭
      metrics_conversion_rate: 0,
      metrics_avg_revenue: 0,
      metrics_roas: 0,
      metrics_cpa: 0,
      metrics_cpc: 0,
      metrics_cpm: 0,
      metrics_ctr: 0,
      
      // 상태 플래그
      is_complete: false,
      validation_passed: true
    };
    
    // 메트릭 계산
    if (flatData.visitors_total > 0 && flatData.bookings_new > 0) {
      flatData.metrics_conversion_rate = 
        ((flatData.bookings_new / flatData.visitors_total) * 100).toFixed(2);
    }
    
    if (flatData.bookings_confirmed > 0) {
      flatData.metrics_avg_revenue = 
        Math.round(flatData.revenue_total / flatData.bookings_confirmed);
    }
    
    if (flatData.ad_total_spend > 0) {
      flatData.metrics_roas = 
        (flatData.revenue_total / flatData.ad_total_spend).toFixed(2);
      
      if (flatData.bookings_new > 0) {
        flatData.metrics_cpa = 
          Math.round(flatData.ad_total_spend / flatData.bookings_new);
      }
    }
    
    // 광고 메트릭 계산
    const totalClicks = (flatData.ad_naver_clicks || 0) + 
                       (flatData.ad_google_clicks || 0) + 
                       (flatData.ad_meta_clicks || 0);
    const totalImpressions = (flatData.ad_naver_impressions || 0) + 
                            (flatData.ad_google_impressions || 0);
    
    if (totalClicks > 0) {
      flatData.metrics_cpc = Math.round(flatData.ad_total_spend / totalClicks);
    }
    
    if (totalImpressions > 0) {
      flatData.metrics_cpm = Math.round((flatData.ad_total_spend / totalImpressions) * 1000);
      flatData.metrics_ctr = ((totalClicks / totalImpressions) * 100).toFixed(2);
    }
    
    // 완료 상태 체크
    flatData.is_complete = checkCompleteness(flatData);
    
    // Firestore에 저장 (펜션별 컬렉션)
    await setDoc(doc(db, collectionName, docId), flatData);
    
    console.log(`✅ ${businessName} ${year}년 ${month}월 통계 저장 완료`);
    return { success: true, docId, data: flatData };
    
  } catch (error) {
    console.error('❌ 월별 통계 저장 오류:', error);
    throw new Error(`통계 저장 실패: ${error.message}`);
  }
};

/**
 * 월별 통계 데이터 조회
 * @param {string} businessType - 'pension' or 'shelter'
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const getMonthlyStats = async (businessType, year, month) => {
  try {
    const collectionName = businessType === 'pension' ? 'monthly_stats_pension' : 'monthly_stats_shelter';
    const businessName = businessType === 'pension' ? '초호펜션' : '초호쉼터';
    const docId = `${year}_${String(month).padStart(2, '0')}`;
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log(`📊 ${businessName} ${year}년 ${month}월 통계 조회 성공`);
      return docSnap.data();
    } else {
      console.log(`📝 ${businessName} ${year}년 ${month}월 통계 없음 (신규 입력 필요)`);
      return null;
    }
  } catch (error) {
    console.error('❌ 월별 통계 조회 오류:', error);
    throw new Error(`통계 조회 실패: ${error.message}`);
  }
};

/**
 * 통합 월별 통계 데이터 조회 (두 펜션 합산)
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const getIntegratedMonthlyStats = async (year, month) => {
  try {
    const pensionData = await getMonthlyStats('pension', year, month);
    const shelterData = await getMonthlyStats('shelter', year, month);
    
    // 두 펜션 데이터 합산
    const integratedData = {
      year,
      month,
      pension: pensionData,
      shelter: shelterData,
      total: {
        revenue_total: (pensionData?.revenue_total || 0) + (shelterData?.revenue_total || 0),
        visitors_total: (pensionData?.visitors_total || 0) + (shelterData?.visitors_total || 0),
        bookings_new: (pensionData?.bookings_new || 0) + (shelterData?.bookings_new || 0),
        ad_total_spend: (pensionData?.ad_total_spend || 0) + (shelterData?.ad_total_spend || 0)
      }
    };
    
    return integratedData;
  } catch (error) {
    console.error('❌ 통합 월별 통계 조회 오류:', error);
    throw error;
  }
};

/**
 * 연간 통계 데이터 조회
 * @param {string} businessType - 'pension' or 'shelter' or 'integrated'
 * @param {number} year - 연도
 */
export const getYearlyStats = async (businessType, year) => {
  try {
    // 통합 통계인 경우 두 펜션 데이터 모두 조회
    if (businessType === 'integrated') {
      const pensionStats = await getYearlyStats('pension', year);
      const shelterStats = await getYearlyStats('shelter', year);
      
      return {
        year,
        pension: pensionStats,
        shelter: shelterStats,
        total: {
          revenue: pensionStats.total.revenue + shelterStats.total.revenue,
          visitors: pensionStats.total.visitors + shelterStats.total.visitors,
          bookings: pensionStats.total.bookings + shelterStats.total.bookings,
          adSpend: pensionStats.total.adSpend + shelterStats.total.adSpend
        }
      };
    }
    
    const collectionName = businessType === 'pension' ? 'monthly_stats_pension' : 'monthly_stats_shelter';
    const q = query(
      collection(db, collectionName),
      where('year', '==', year),
      orderBy('month', 'asc')
    );
    
    const snapshot = await getDocs(q);
    const monthlyData = [];
    
    snapshot.forEach(doc => {
      monthlyData.push(doc.data());
    });
    
    // 연간 합계 계산
    const yearlyTotal = {
      revenue: 0,
      visitors: 0,
      bookings: 0,
      adSpend: 0
    };
    
    monthlyData.forEach(data => {
      yearlyTotal.revenue += data.revenue_total || 0;
      yearlyTotal.visitors += data.visitors_total || 0;
      yearlyTotal.bookings += data.bookings_new || 0;
      yearlyTotal.adSpend += data.ad_total_spend || 0;
    });
    
    console.log(`📊 ${year}년 연간 통계 조회 성공`);
    return {
      year,
      months: monthlyData,
      total: yearlyTotal
    };
    
  } catch (error) {
    console.error('❌ 연간 통계 조회 오류:', error);
    throw new Error(`연간 통계 조회 실패: ${error.message}`);
  }
};

/**
 * 분기별 통계 계산
 * @param {string} businessType - 'pension' or 'shelter' or 'integrated'
 * @param {number} year - 연도
 * @param {number} quarter - 분기 (1-4)
 */
export const getQuarterlyStats = async (businessType, year, quarter) => {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  
  const monthlyData = [];
  for (let month = startMonth; month <= endMonth; month++) {
    const data = businessType === 'integrated' 
      ? await getIntegratedMonthlyStats(year, month)
      : await getMonthlyStats(businessType, year, month);
    if (data) {
      monthlyData.push(data);
    }
  }
  
  // 분기 합계 계산
  const quarterlyTotal = {
    revenue: 0,
    visitors: 0,
    bookings: 0,
    adSpend: 0
  };
  
  monthlyData.forEach(data => {
    quarterlyTotal.revenue += data.revenue_total || 0;
    quarterlyTotal.visitors += data.visitors_total || 0;
    quarterlyTotal.bookings += data.bookings_new || 0;
    quarterlyTotal.adSpend += data.ad_total_spend || 0;
  });
  
  return {
    year,
    quarter,
    months: monthlyData,
    total: quarterlyTotal
  };
};

/**
 * 데이터 완료 상태 체크
 * @param {Object} data - 통계 데이터
 */
const checkCompleteness = (data) => {
  // 필수 필드 체크
  const requiredFields = [
    'revenue_total',
    'visitors_total',
    'bookings_new'
  ];
  
  for (const field of requiredFields) {
    if (!data[field] || data[field] === 0) {
      return false;
    }
  }
  
  return true;
};

/**
 * 월별 통계 상태 조회 (대시보드용)
 * @param {string} businessType - 'pension' or 'shelter' or 'integrated'
 * @param {number} year - 연도
 */
export const getMonthlyStatsStatus = async (businessType, year) => {
  try {
    const statuses = [];
    
    for (let month = 1; month <= 12; month++) {
      const data = businessType === 'integrated'
        ? await getIntegratedMonthlyStats(year, month)
        : await getMonthlyStats(businessType, year, month);
      
      statuses.push({
        month,
        status: data ? (data.is_complete ? 'complete' : 'partial') : 'empty',
        hasAutoRevenue: isAutoCalculationAvailable(year, month),
        revenue: data?.revenue_total || 0,
        visitors: data?.visitors_total || 0,
        adSpend: data?.ad_total_spend || 0
      });
    }
    
    return statuses;
    
  } catch (error) {
    console.error('❌ 월별 상태 조회 오류:', error);
    throw error;
  }
};

export default {
  saveMonthlyStats,
  getMonthlyStats,
  getIntegratedMonthlyStats,
  getYearlyStats,
  getQuarterlyStats,
  getMonthlyStatsStatus
};