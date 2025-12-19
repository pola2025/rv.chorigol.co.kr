// 선언형 통계 서비스 - useEffect 없이 구현
import { 
  getMonthlyStats, 
  getYearlyStats, 
  getIntegratedMonthlyStats,
  getQuarterlyStats 
} from './monthlyStatsService';

/**
 * 통계 데이터 페칭 함수들 (순수 함수)
 * React Query의 queryFn으로 사용
 */

// 월별 통계 페칭
export const fetchMonthlyStatistics = async ({ year, month, businessType = 'pension' }) => {
  const data = await getMonthlyStats(businessType, year, month);
  
  // 평탄화된 데이터 그대로 반환 (중첩 없음)
  return {
    ...data,
    // 계산된 필드 추가 (선언형)
    hasRevenue: (data?.revenue_total || 0) > 0,
    hasVisitors: (data?.visitors_total || 0) > 0,
    isComplete: data?.is_complete || false
  };
};

// 연간 통계 페칭
export const fetchYearlyStatistics = async ({ year, businessType = 'pension' }) => {
  const data = await getYearlyStats(businessType, year);
  
  // 평탄화된 구조 유지
  const flatMonths = data.months.map(month => ({
    month: month.month,
    revenue_total: month.revenue_total || 0,
    revenue_room: month.revenue_room || 0,
    revenue_option: month.revenue_option || 0,
    visitors_total: month.visitors_total || 0,
    visitors_website: month.visitors_website || 0,
    visitors_naver: month.visitors_naver || 0,
    bookings_new: month.bookings_new || 0,
    ad_total_spend: month.ad_total_spend || 0,
    metrics_roas: month.metrics_roas || 0,
    metrics_conversion_rate: month.metrics_conversion_rate || 0
  }));
  
  return {
    year,
    businessType,
    months: flatMonths,
    yearly_revenue_total: data.total.revenue,
    yearly_visitors_total: data.total.visitors,
    yearly_bookings_total: data.total.bookings,
    yearly_ad_spend_total: data.total.adSpend
  };
};

// 통합 통계 페칭 (두 펜션)
export const fetchIntegratedStatistics = async ({ year, month }) => {
  const data = await getIntegratedMonthlyStats(year, month);
  
  // 평탄화된 통합 데이터
  return {
    year,
    month,
    pension_revenue: data.pension?.revenue_total || 0,
    pension_visitors: data.pension?.visitors_total || 0,
    shelter_revenue: data.shelter?.revenue_total || 0,
    shelter_visitors: data.shelter?.visitors_total || 0,
    total_revenue: data.total.revenue_total,
    total_visitors: data.total.visitors_total,
    total_bookings: data.total.bookings_new,
    total_ad_spend: data.total.ad_total_spend
  };
};

// 차트용 데이터 변환 (순수 함수, 선언형)
export const transformToChartData = (yearlyData) => {
  if (!yearlyData?.months) return null;
  
  return {
    // 매출 차트 데이터 (평탄화)
    revenueChart: yearlyData.months.map(m => ({
      name: `${m.month}월`,
      room: m.revenue_room,
      option: m.revenue_option,
      total: m.revenue_total
    })),
    
    // 방문자 차트 데이터 (평탄화)
    visitorChart: yearlyData.months.map(m => ({
      name: `${m.month}월`,
      website: m.visitors_website,
      naver: m.visitors_naver,
      total: m.visitors_total
    })),
    
    // ROAS 차트 데이터 (평탄화)
    roasChart: yearlyData.months.map(m => ({
      name: `${m.month}월`,
      roas: parseFloat(m.metrics_roas) || 0,
      conversion: parseFloat(m.metrics_conversion_rate) || 0
    })),
    
    // 광고 효율 차트 데이터 (평탄화)
    adEfficiencyChart: yearlyData.months.map(m => ({
      name: `${m.month}월`,
      revenue: m.revenue_total,
      adSpend: m.ad_total_spend,
      efficiency: m.ad_total_spend > 0 
        ? Math.round((m.revenue_total / m.ad_total_spend) * 100) 
        : 0
    }))
  };
};

// 메트릭 계산 (순수 함수, 선언형)
export const calculateMetrics = (yearlyData) => {
  if (!yearlyData?.months) return null;
  
  const validMonths = yearlyData.months.filter(m => m.revenue_total > 0);
  const totalRevenue = yearlyData.yearly_revenue_total;
  const totalVisitors = yearlyData.yearly_visitors_total;
  const totalBookings = yearlyData.yearly_bookings_total;
  const totalAdSpend = yearlyData.yearly_ad_spend_total;
  
  return {
    // 평탄화된 메트릭
    avg_monthly_revenue: validMonths.length > 0 
      ? Math.round(totalRevenue / validMonths.length) 
      : 0,
    avg_monthly_visitors: validMonths.length > 0 
      ? Math.round(totalVisitors / validMonths.length) 
      : 0,
    total_roas: totalAdSpend > 0 
      ? (totalRevenue / totalAdSpend).toFixed(2) 
      : 0,
    avg_conversion_rate: totalVisitors > 0 
      ? ((totalBookings / totalVisitors) * 100).toFixed(2) 
      : 0,
    best_month: validMonths.reduce((best, month) => 
      month.revenue_total > (best?.revenue_total || 0) ? month : best
    , null),
    data_completeness: `${validMonths.length}/12`
  };
};

// 트렌드 분석 (순수 함수, 선언형)
export const analyzeTrends = (yearlyData) => {
  if (!yearlyData?.months || yearlyData.months.length < 2) return null;
  
  const months = yearlyData.months;
  const recentMonths = months.slice(-3).filter(m => m.revenue_total > 0);
  const previousMonths = months.slice(-6, -3).filter(m => m.revenue_total > 0);
  
  if (recentMonths.length === 0 || previousMonths.length === 0) return null;
  
  const recentAvg = recentMonths.reduce((sum, m) => sum + m.revenue_total, 0) / recentMonths.length;
  const previousAvg = previousMonths.reduce((sum, m) => sum + m.revenue_total, 0) / previousMonths.length;
  
  return {
    // 평탄화된 트렌드 데이터
    revenue_trend: previousAvg > 0 
      ? ((recentAvg - previousAvg) / previousAvg * 100).toFixed(1) 
      : 0,
    revenue_trend_direction: recentAvg > previousAvg ? 'up' : 'down',
    visitor_trend: calculateVisitorTrend(recentMonths, previousMonths),
    conversion_trend: calculateConversionTrend(recentMonths, previousMonths),
    seasonal_pattern: detectSeasonalPattern(months)
  };
};

// 보조 함수들 (모두 순수 함수)
const calculateVisitorTrend = (recent, previous) => {
  const recentVisitors = recent.reduce((sum, m) => sum + m.visitors_total, 0) / recent.length;
  const previousVisitors = previous.reduce((sum, m) => sum + m.visitors_total, 0) / previous.length;
  
  return previousVisitors > 0 
    ? ((recentVisitors - previousVisitors) / previousVisitors * 100).toFixed(1)
    : 0;
};

const calculateConversionTrend = (recent, previous) => {
  const recentRate = recent.reduce((sum, m) => sum + parseFloat(m.metrics_conversion_rate || 0), 0) / recent.length;
  const previousRate = previous.reduce((sum, m) => sum + parseFloat(m.metrics_conversion_rate || 0), 0) / previous.length;
  
  return (recentRate - previousRate).toFixed(2);
};

const detectSeasonalPattern = (months) => {
  const summerMonths = months.filter(m => [6, 7, 8].includes(m.month));
  const winterMonths = months.filter(m => [12, 1, 2].includes(m.month));
  
  const summerAvg = summerMonths.reduce((sum, m) => sum + m.revenue_total, 0) / (summerMonths.length || 1);
  const winterAvg = winterMonths.reduce((sum, m) => sum + m.revenue_total, 0) / (winterMonths.length || 1);
  
  return {
    peak_season: summerAvg > winterAvg ? 'summer' : 'winter',
    peak_difference: Math.abs(summerAvg - winterAvg)
  };
};

// Query Key 생성 함수 (일관성 유지)
export const statisticsKeys = {
  all: ['statistics'],
  monthly: (year, month, businessType) => ['statistics', 'monthly', year, month, businessType],
  yearly: (year, businessType) => ['statistics', 'yearly', year, businessType],
  integrated: (year, month) => ['statistics', 'integrated', year, month],
  quarterly: (year, quarter) => ['statistics', 'quarterly', year, quarter]
};
