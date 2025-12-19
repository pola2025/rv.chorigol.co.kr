// 월별 통계 데이터 Hook
// monthly_stats 컬렉션에서 데이터를 읽어 시각화 컴포넌트에 제공

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getMonthlyStats, getYearlyStats, getQuarterlyStats } from '../services/monthlyStatsService';
import { calculateMonthlyRevenue } from '../services/monthlyRevenueService';

/**
 * 월별 통계 실시간 구독 Hook
 * @param {number} year - 연도
 * @param {number} month - 월 (선택사항)
 */
export const useMonthlyStats = (year, month = null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!year) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (month) {
          // 특정 월 데이터
          const monthData = await getMonthlyStats(year, month);
          setData(monthData);
        } else {
          // 연간 데이터
          const yearData = await getYearlyStats(year);
          setData(yearData);
        }
      } catch (err) {
        console.error('월별 통계 조회 오류:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year, month]);

  return { data, loading, error };
};

/**
 * 실시간 월별 통계 구독 Hook
 */
export const useMonthlyStatsRealtime = (year) => {
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!year) return;

    setLoading(true);
    
    // Firestore 실시간 리스너
    const q = query(
      collection(db, 'monthly_stats'),
      where('year', '==', year),
      orderBy('month', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        
        // 12개월 데이터 채우기 (빈 월 포함)
        const fullYearData = [];
        for (let m = 1; m <= 12; m++) {
          const monthData = data.find(d => d.month === m);
          if (monthData) {
            fullYearData.push(monthData);
          } else {
            // 빈 데이터
            fullYearData.push({
              month: m,
              year,
              revenue_total: 0,
              visitors_total: 0,
              bookings_new: 0,
              ad_total_spend: 0,
              isEmpty: true
            });
          }
        }
        
        setMonthlyData(fullYearData);
        setLoading(false);
      },
      (err) => {
        console.error('실시간 구독 오류:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [year]);

  return { monthlyData, loading, error };
};

/**
 * 통계 차트 데이터 변환 Hook
 */
export const useChartData = (year) => {
  const { monthlyData, loading, error } = useMonthlyStatsRealtime(year);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    if (!monthlyData || monthlyData.length === 0) return;

    // 차트용 데이터 변환
    const transformed = {
      // 월별 매출 차트
      revenue: {
        labels: monthlyData.map(d => `${d.month}월`),
        datasets: [{
          label: '객실 매출',
          data: monthlyData.map(d => d.revenue_room || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2
        }, {
          label: '옵션 매출',
          data: monthlyData.map(d => d.revenue_option || 0),
          backgroundColor: 'rgba(168, 85, 247, 0.5)',
          borderColor: 'rgb(168, 85, 247)',
          borderWidth: 2
        }]
      },
      
      // 방문자 트렌드
      visitors: {
        labels: monthlyData.map(d => `${d.month}월`),
        datasets: [{
          label: '네이버',
          data: monthlyData.map(d => d.visitors_naver || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2
        }, {
          label: '웹사이트',
          data: monthlyData.map(d => d.visitors_website || 0),
          backgroundColor: 'rgba(251, 146, 60, 0.5)',
          borderColor: 'rgb(251, 146, 60)',
          borderWidth: 2
        }]
      },
      
      // 전환율 추이
      conversion: {
        labels: monthlyData.map(d => `${d.month}월`),
        datasets: [{
          label: '전환율 (%)',
          data: monthlyData.map(d => d.metrics_conversion_rate || 0),
          backgroundColor: 'rgba(236, 72, 153, 0.5)',
          borderColor: 'rgb(236, 72, 153)',
          borderWidth: 2,
          tension: 0.4
        }]
      },
      
      // ROAS 추이
      roas: {
        labels: monthlyData.map(d => `${d.month}월`),
        datasets: [{
          label: 'ROAS',
          data: monthlyData.map(d => d.metrics_roas || 0),
          backgroundColor: 'rgba(14, 165, 233, 0.5)',
          borderColor: 'rgb(14, 165, 233)',
          borderWidth: 2,
          tension: 0.4
        }]
      },
      
      // 파이 차트 - 연간 매출 구성
      revenueComposition: {
        labels: ['객실 매출', '옵션 매출'],
        datasets: [{
          data: [
            monthlyData.reduce((sum, d) => sum + (d.revenue_room || 0), 0),
            monthlyData.reduce((sum, d) => sum + (d.revenue_option || 0), 0)
          ],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)'
          ],
          borderWidth: 1
        }]
      },
      
      // 광고비 대비 매출
      adEfficiency: {
        labels: monthlyData.map(d => `${d.month}월`),
        datasets: [{
          label: '매출',
          data: monthlyData.map(d => d.revenue_total || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2,
          yAxisID: 'y'
        }, {
          label: '광고비',
          data: monthlyData.map(d => d.ad_total_spend || 0),
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
          yAxisID: 'y1'
        }]
      }
    };

    setChartData(transformed);
  }, [monthlyData]);

  return { chartData, monthlyData, loading, error };
};

/**
 * 통계 요약 Hook
 */
export const useStatsSummary = (year) => {
  const { monthlyData, loading, error } = useMonthlyStatsRealtime(year);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!monthlyData || monthlyData.length === 0) return;

    // 연간 합계 계산
    const totals = monthlyData.reduce((acc, month) => {
      return {
        revenue: acc.revenue + (month.revenue_total || 0),
        visitors: acc.visitors + (month.visitors_total || 0),
        bookings: acc.bookings + (month.bookings_new || 0),
        adSpend: acc.adSpend + (month.ad_total_spend || 0)
      };
    }, { revenue: 0, visitors: 0, bookings: 0, adSpend: 0 });

    // 평균 계산
    const validMonths = monthlyData.filter(m => !m.isEmpty).length;
    const averages = {
      monthlyRevenue: validMonths > 0 ? Math.round(totals.revenue / validMonths) : 0,
      monthlyVisitors: validMonths > 0 ? Math.round(totals.visitors / validMonths) : 0,
      monthlyBookings: validMonths > 0 ? Math.round(totals.bookings / validMonths) : 0,
      monthlyAdSpend: validMonths > 0 ? Math.round(totals.adSpend / validMonths) : 0
    };

    // 최고/최저 실적
    const validData = monthlyData.filter(m => !m.isEmpty);
    const bestMonth = validData.reduce((best, month) => {
      return month.revenue_total > (best?.revenue_total || 0) ? month : best;
    }, null);
    
    const worstMonth = validData.reduce((worst, month) => {
      if (!worst) return month;
      return month.revenue_total < worst.revenue_total ? month : worst;
    }, null);

    // KPI 계산
    const kpi = {
      totalROAS: totals.adSpend > 0 ? (totals.revenue / totals.adSpend).toFixed(2) : 0,
      avgConversion: totals.visitors > 0 ? ((totals.bookings / totals.visitors) * 100).toFixed(2) : 0,
      avgRevPerBooking: totals.bookings > 0 ? Math.round(totals.revenue / totals.bookings) : 0
    };

    setSummary({
      year,
      totals,
      averages,
      bestMonth,
      worstMonth,
      kpi,
      dataCompleteness: `${validMonths}/12`
    });
  }, [monthlyData, year]);

  return { summary, loading, error };
};

export default {
  useMonthlyStats,
  useMonthlyStatsRealtime,
  useChartData,
  useStatsSummary
};