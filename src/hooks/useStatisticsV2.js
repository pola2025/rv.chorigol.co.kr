// 선언형 통계 Hook - useEffect 완전 제거
import { useQuery, useQueries, useMutation } from '@tanstack/react-query';
import { queryClient } from '../config/queryClient';
import {
  fetchMonthlyStatistics,
  fetchYearlyStatistics,
  fetchIntegratedStatistics,
  transformToChartData,
  calculateMetrics,
  analyzeTrends,
  statisticsKeys
} from '../services/statisticsServiceV2';
import { saveMonthlyStats } from '../services/monthlyStatsService';
import { useMemo } from 'react';

/**
 * 연간 통계 조회 Hook (선언형)
 */
export const useYearlyStatistics = (year, businessType = 'pension') => {
  const query = useQuery({
    queryKey: statisticsKeys.yearly(year, businessType),
    queryFn: () => fetchYearlyStatistics({ year, businessType }),
    enabled: !!year,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // 선언형 데이터 변환 (useEffect 없이 즉시 계산)
  const chartData = useMemo(() => 
    query.data ? transformToChartData(query.data) : null,
    [query.data]
  );

  const metrics = useMemo(() => 
    query.data ? calculateMetrics(query.data) : null,
    [query.data]
  );

  const trends = useMemo(() => 
    query.data ? analyzeTrends(query.data) : null,
    [query.data]
  );

  return {
    data: query.data,
    chartData,
    metrics,
    trends,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch
  };
};

/**
 * 월별 통계 조회 Hook (선언형)
 */
export const useMonthlyStatistics = (year, month, businessType = 'pension') => {
  return useQuery({
    queryKey: statisticsKeys.monthly(year, month, businessType),
    queryFn: () => fetchMonthlyStatistics({ year, month, businessType }),
    enabled: !!year && !!month,
    select: (data) => ({
      // 선언형 데이터 변환
      ...data,
      formatted: {
        revenue: `₩${(data.revenue_total || 0).toLocaleString()}`,
        visitors: (data.visitors_total || 0).toLocaleString(),
        bookings: (data.bookings_new || 0).toLocaleString(),
        roas: data.metrics_roas || '0.00'
      }
    })
  });
};

/**
 * 통합 통계 조회 Hook (두 펜션 합산)
 */
export const useIntegratedStatistics = (year, month) => {
  return useQuery({
    queryKey: statisticsKeys.integrated(year, month),
    queryFn: () => fetchIntegratedStatistics({ year, month }),
    enabled: !!year,
    select: (data) => ({
      ...data,
      // 선언형으로 비율 계산
      pensionRatio: data.total_revenue > 0 
        ? (data.pension_revenue / data.total_revenue * 100).toFixed(1)
        : 0,
      shelterRatio: data.total_revenue > 0
        ? (data.shelter_revenue / data.total_revenue * 100).toFixed(1)
        : 0
    })
  });
};

/**
 * 다중 월 통계 조회 Hook (병렬 조회)
 */
export const useMultipleMonthsStatistics = (year, months, businessType = 'pension') => {
  const queries = useQueries({
    queries: months.map(month => ({
      queryKey: statisticsKeys.monthly(year, month, businessType),
      queryFn: () => fetchMonthlyStatistics({ year, month, businessType }),
      enabled: !!year && !!month,
    }))
  });

  // 모든 쿼리 결과 집계 (선언형)
  const aggregatedData = useMemo(() => {
    if (queries.some(q => q.isLoading)) return null;
    
    const allData = queries.map(q => q.data).filter(Boolean);
    if (allData.length === 0) return null;

    // 평탄화된 집계 데이터
    return {
      total_revenue: allData.reduce((sum, d) => sum + (d.revenue_total || 0), 0),
      total_visitors: allData.reduce((sum, d) => sum + (d.visitors_total || 0), 0),
      total_bookings: allData.reduce((sum, d) => sum + (d.bookings_new || 0), 0),
      total_ad_spend: allData.reduce((sum, d) => sum + (d.ad_total_spend || 0), 0),
      months_count: allData.length,
      months_data: allData
    };
  }, [queries]);

  return {
    data: aggregatedData,
    isLoading: queries.some(q => q.isLoading),
    isError: queries.some(q => q.isError),
    errors: queries.filter(q => q.isError).map(q => q.error)
  };
};

/**
 * 통계 저장 Mutation Hook
 */
export const useSaveStatistics = () => {
  return useMutation({
    mutationFn: ({ businessType, year, month, data }) => 
      saveMonthlyStats(businessType, year, month, data),
    onSuccess: (result, variables) => {
      // 캐시 무효화 (선언형)
      queryClient.invalidateQueries({
        queryKey: statisticsKeys.monthly(
          variables.year, 
          variables.month, 
          variables.businessType
        )
      });
      queryClient.invalidateQueries({
        queryKey: statisticsKeys.yearly(
          variables.year, 
          variables.businessType
        )
      });
    },
    onError: (error) => {
      console.error('통계 저장 실패:', error);
    }
  });
};

/**
 * 실시간 통계 구독 Hook (WebSocket 대체)
 */
export const useRealtimeStatistics = (year, businessType = 'pension') => {
  // React Query의 refetchInterval로 실시간 효과 구현
  return useQuery({
    queryKey: statisticsKeys.yearly(year, businessType),
    queryFn: () => fetchYearlyStatistics({ year, businessType }),
    enabled: !!year,
    refetchInterval: 30000, // 30초마다 자동 갱신
    refetchIntervalInBackground: false,
  });
};

/**
 * 통계 비교 Hook (선언형)
 */
export const useStatisticsComparison = (currentYear, previousYear, businessType = 'pension') => {
  const currentQuery = useYearlyStatistics(currentYear, businessType);
  const previousQuery = useYearlyStatistics(previousYear, businessType);

  // 선언형 비교 계산
  const comparison = useMemo(() => {
    if (!currentQuery.data || !previousQuery.data) return null;

    const current = currentQuery.metrics;
    const previous = previousQuery.metrics;

    if (!current || !previous) return null;

    return {
      revenue_growth: previous.avg_monthly_revenue > 0
        ? ((current.avg_monthly_revenue - previous.avg_monthly_revenue) / previous.avg_monthly_revenue * 100).toFixed(1)
        : 0,
      visitor_growth: previous.avg_monthly_visitors > 0
        ? ((current.avg_monthly_visitors - previous.avg_monthly_visitors) / previous.avg_monthly_visitors * 100).toFixed(1)
        : 0,
      roas_improvement: (parseFloat(current.total_roas) - parseFloat(previous.total_roas)).toFixed(2),
      conversion_improvement: (parseFloat(current.avg_conversion_rate) - parseFloat(previous.avg_conversion_rate)).toFixed(2)
    };
  }, [currentQuery.metrics, previousQuery.metrics]);

  return {
    current: currentQuery,
    previous: previousQuery,
    comparison,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError
  };
};

/**
 * 대시보드 요약 Hook (선언형)
 */
export const useDashboardSummary = (year) => {
  const pensionQuery = useYearlyStatistics(year, 'pension');
  const shelterQuery = useYearlyStatistics(year, 'shelter');

  // 선언형 요약 계산
  const summary = useMemo(() => {
    if (pensionQuery.isLoading || shelterQuery.isLoading) return null;

    const pensionData = pensionQuery.data;
    const shelterData = shelterQuery.data;

    if (!pensionData && !shelterData) return null;

    return {
      // 평탄화된 요약 데이터
      total_revenue: (pensionData?.yearly_revenue_total || 0) + (shelterData?.yearly_revenue_total || 0),
      total_visitors: (pensionData?.yearly_visitors_total || 0) + (shelterData?.yearly_visitors_total || 0),
      total_bookings: (pensionData?.yearly_bookings_total || 0) + (shelterData?.yearly_bookings_total || 0),
      total_ad_spend: (pensionData?.yearly_ad_spend_total || 0) + (shelterData?.yearly_ad_spend_total || 0),
      pension_contribution: pensionData?.yearly_revenue_total || 0,
      shelter_contribution: shelterData?.yearly_revenue_total || 0,
      best_performing: (pensionData?.yearly_revenue_total || 0) > (shelterData?.yearly_revenue_total || 0) 
        ? 'pension' 
        : 'shelter'
    };
  }, [pensionQuery.data, shelterQuery.data]);

  return {
    summary,
    isLoading: pensionQuery.isLoading || shelterQuery.isLoading,
    isError: pensionQuery.isError || shelterQuery.isError,
    refetch: () => {
      pensionQuery.refetch();
      shelterQuery.refetch();
    }
  };
};

// Hook 내보내기
export default {
  useYearlyStatistics,
  useMonthlyStatistics,
  useIntegratedStatistics,
  useMultipleMonthsStatistics,
  useSaveStatistics,
  useRealtimeStatistics,
  useStatisticsComparison,
  useDashboardSummary
};
