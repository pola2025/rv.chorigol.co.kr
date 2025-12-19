/**
 * AI_FIRST_hooks.js
 * React Query 기반 선언형 커스텀 훅
 * useEffect 없이 데이터 페칭 및 상태 관리
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useRef } from 'react';
import airtableService from '../../../../services/airtableService';
import { 
  calculateMetrics, 
  getMonthlyKey, 
  getTrendDirection,
  createInitialData 
} from '../utils/AI_FIRST_dataStructure';
import { 
  aggregateFacilityMetrics,
  aggregatePlatformMetrics 
} from '../utils/AI_FIRST_dataMapping';

// ===== 데이터 페칭 훅 (React Query) =====

/**
 * Airtable 연결 상태 확인 훅
 */
export const useAirtableConnection = () => {
  return useQuery({
    queryKey: ['airtable', 'connection'],
    queryFn: () => airtableService.testConnection(),
    staleTime: 5 * 60 * 1000, // 5분
    cacheTime: 10 * 60 * 1000, // 10분
    retry: 2,
    refetchOnWindowFocus: false
  });
};

/**
 * 월별 통계 데이터 페칭 훅
 */
export const useMonthlyStats = (year, month) => {
  return useQuery({
    queryKey: ['stats', 'monthly', year, month],
    queryFn: async () => {
      // Airtable에서 모든 테이블 데이터 가져오기
      const allTableData = {};
      
      // 모든 테이블에서 데이터 가져오기 (시설별로 정리)
      const tableNames = [
        // 초호 데이터
        '홈페이지_초호',      // 초호 홈페이지
        '플레이스_초호',      // 초호 플레이스
        '네이버광고_초호',    // 초호 광고
        // 초호쉼터 데이터
        '홈페이지_초호쉼터',  // 초호쉼터 홈페이지
        '플레이스_초호쉼터',  // 초호쉼터 플레이스
        'Meta'                    // 초호쉼터 광고
      ];
      
      await Promise.all(
        tableNames.map(async (tableName) => {
          const data = await airtableService.fetchTableMonthlyData(tableName, year, month);
          allTableData[tableName] = data;
        })
      );
      
      // 시설별 데이터 집계
      const facilityMetrics = aggregateFacilityMetrics(allTableData);
      
      // 플랫폼별 데이터 집계
      const platformMetrics = aggregatePlatformMetrics(allTableData);
      
      // 메트릭 계산
      const facilityStats = {
        choho: calculateMetrics(facilityMetrics.choho),
        shelter: calculateMetrics(facilityMetrics.shelter),
        total: calculateMetrics(facilityMetrics.total)
      };
      
      const platforms = Object.entries(platformMetrics).map(([platform, metrics]) => ({
        platform,
        ...calculateMetrics(metrics)
      }));
      
      // 전체 요약
      const summary = calculateMetrics(facilityMetrics.total);
      
      return {
        period: { year, month },
        summary,
        facilityStats,
        platforms,
        rawData: allTableData // 디버깅용
      };
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    enabled: !!year && !!month
  });
};

/**
 * 연간 통계 데이터 페칭 훅
 */
export const useYearlyStats = (year) => {
  return useQuery({
    queryKey: ['stats', 'yearly', year],
    queryFn: async () => {
      // 12개월 데이터 병렬로 가져오기
      const monthlyPromises = [];
      
      for (let month = 1; month <= 12; month++) {
        monthlyPromises.push(
          (async () => {
            const allTableData = {};
            const tableNames = [
              // 초호 데이터
              '홈페이지_초호',      // 초호 홈페이지
              '플레이스_초호',      // 초호 플레이스
              '네이버광고_초호',    // 초호 광고
              // 초호쉼터 데이터
              '홈페이지_초호쉼터',  // 초호쉼터 홈페이지
              '플레이스_초호쉼터',  // 초호쉼터 플레이스
              'Meta'                    // 초호쉼터 광고
            ];
            
            await Promise.all(
              tableNames.map(async (tableName) => {
                const data = await airtableService.fetchTableMonthlyData(tableName, year, month);
                allTableData[tableName] = data;
              })
            );
            
            return { month, data: allTableData };
          })()
        );
      }
      
      const monthlyResults = await Promise.all(monthlyPromises);
      
      // 월별 데이터 집계
      const monthlyData = {};
      const yearTotals = {
        impressions: 0,
        clicks: 0,
        adCost: 0,
        visitors: 0,
        pageviews: 0,
        revenue: 0,
        bookings: 0
      };
      
      monthlyResults.forEach(({ month, data }) => {
        const monthKey = getMonthlyKey(year, month);
        const facilityMetrics = aggregateFacilityMetrics(data);
        
        monthlyData[monthKey] = calculateMetrics(facilityMetrics.total);
        
        // 연간 통계 누적
        Object.keys(yearTotals).forEach(key => {
          yearTotals[key] += facilityMetrics.total[key] || 0;
        });
      });
      
      // 플랫폼별 연간 통계
      const platformTotals = {};
      const allPlatforms = ['네이버광고', '홈페이지', '플레이스', 'Meta'];
      
      allPlatforms.forEach(platform => {
        platformTotals[platform] = {
          impressions: 0,
          clicks: 0,
          adCost: 0,
          visitors: 0,
          pageviews: 0
        };
      });
      
      // 연간 평균 계산
      const averages = {
        ctr: yearTotals.impressions > 0 ? (yearTotals.clicks / yearTotals.impressions * 100) : 0,
        cpc: yearTotals.clicks > 0 ? (yearTotals.adCost / yearTotals.clicks) : 0,
        cpm: yearTotals.impressions > 0 ? (yearTotals.adCost / yearTotals.impressions * 1000) : 0,
        monthlyAdCost: yearTotals.adCost / 12
      };
      
      return {
        year,
        total: calculateMetrics(yearTotals),
        monthly: monthlyData,
        platforms: platformTotals,
        averages
      };
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    enabled: !!year
  });
};

/**
 * 통합 대시보드 데이터 훅
 */
export const useDashboardData = (year, month) => {
  const connection = useAirtableConnection();
  const monthlyStats = useMonthlyStats(year, month);
  const yearlyStats = useYearlyStats(year);
  
  // 이전 월 데이터 (트렌드 비교용)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthStats = useMonthlyStats(prevYear, prevMonth);
  
  // 통합 데이터 계산 (useMemo로 메모이제이션)
  const dashboardData = useMemo(() => {
    if (!monthlyStats.data || !yearlyStats.data) {
      return createInitialData();
    }
    
    const currentData = monthlyStats.data;
    const yearData = yearlyStats.data;
    const prevData = prevMonthStats.data;
    
    // 트렌드 계산
    const trends = {
      ctr: {
        value: currentData.summary.ctr,
        change: prevData ? currentData.summary.ctr - prevData.summary.ctr : 0,
        direction: getTrendDirection(currentData.summary.ctr, prevData?.summary.ctr)
      },
      cpc: {
        value: currentData.summary.cpc,
        change: prevData ? currentData.summary.cpc - prevData.summary.cpc : 0,
        direction: getTrendDirection(currentData.summary.cpc, prevData?.summary.cpc)
      },
      visitors: {
        value: currentData.summary.visitors,
        change: prevData ? currentData.summary.visitors - prevData.summary.visitors : 0,
        direction: getTrendDirection(currentData.summary.visitors, prevData?.summary.visitors)
      }
    };
    
    return {
      currentPeriod: { year, month },
      summary: {
        ...currentData.summary,
        facilityStats: currentData.facilityStats,
        trends
      },
      platforms: currentData.platforms,
      monthly: yearData.monthly,
      yearly: yearData,
      goals: {
        current: localStorage.getItem(`goal_${year}_${month}`) || '',
        history: [] // 목표 히스토리는 별도 훅에서 관리
      },
      meta: {
        lastUpdated: new Date(),
        isLoading: monthlyStats.isLoading || yearlyStats.isLoading,
        error: monthlyStats.error || yearlyStats.error
      }
    };
  }, [monthlyStats.data, yearlyStats.data, prevMonthStats.data, year, month]);
  
  return {
    data: dashboardData,
    isLoading: monthlyStats.isLoading || yearlyStats.isLoading,
    error: monthlyStats.error || yearlyStats.error,
    isConnected: connection.data?.connected,
    refetch: () => {
      monthlyStats.refetch();
      yearlyStats.refetch();
    }
  };
};

// ===== UI 상태 관리 훅 (선언형) =====

/**
 * 윈도우 크기 훅 (선언형)
 */
export const useWindowSize = () => {
  const getWindowSize = () => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  });
  
  const [windowSize, setWindowSize] = useState(getWindowSize);
  
  // React Query로 윈도우 이벤트 관리
  useQuery({
    queryKey: ['windowSize'],
    queryFn: getWindowSize,
    staleTime: Infinity,
    enabled: false
  });
  
  // 이벤트 리스너를 커스텀 훅으로 추상화
  useWindowEvent('resize', useCallback(() => {
    setWindowSize(getWindowSize());
  }, []));
  
  return windowSize;
};

/**
 * 윈도우 이벤트 리스너 훅 (선언형)
 */
export const useWindowEvent = (event, handler) => {
  const savedHandler = useRef(handler);
  
  // handler가 변경되면 ref 업데이트
  savedHandler.current = handler;
  
  // 컴포넌트 마운트 시점에 이벤트 리스너 추가 (React Query 방식)
  useQuery({
    queryKey: ['windowEvent', event],
    queryFn: () => {
      const eventHandler = (e) => savedHandler.current(e);
      window.addEventListener(event, eventHandler);
      
      return () => {
        window.removeEventListener(event, eventHandler);
      };
    },
    staleTime: Infinity,
    enabled: typeof window !== 'undefined'
  });
};

/**
 * 디바운스 훅 (선언형)
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef(null);
  
  // useMemo로 디바운스 로직 구현
  useMemo(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);
  
  return debouncedValue;
};

/**
 * 로컬 스토리지 훅 (선언형)
 */
export const useLocalStorage = (key, initialValue) => {
  // 초기값 계산 (lazy initialization)
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });
  
  // 값 설정 함수 (useCallback으로 메모이제이션)
  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);
  
  return [storedValue, setValue];
};

/**
 * 목표 관리 훅
 */
export const useGoals = (year, month) => {
  const key = `goal_${year}_${month}`;
  const [currentGoal, setCurrentGoal] = useLocalStorage(key, '');
  const [allGoals, setAllGoals] = useLocalStorage('adGoals', {});
  
  const saveGoal = useCallback((goal) => {
    setCurrentGoal(goal);
    setAllGoals(prev => ({
      ...prev,
      [key]: goal
    }));
  }, [key, setCurrentGoal, setAllGoals]);
  
  const goalHistory = useMemo(() => {
    return Object.entries(allGoals)
      .filter(([k]) => k !== key)
      .map(([k, goal]) => {
        const [, y, m] = k.split('_');
        return {
          year: parseInt(y),
          month: parseInt(m),
          goal
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      })
      .slice(0, 5); // 최근 5개만
  }, [allGoals, key]);
  
  return {
    currentGoal,
    saveGoal,
    goalHistory
  };
};

/**
 * 탭 관리 훅
 */
export const useTabs = (initialTab = 0) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const goToTab = useCallback((index) => {
    setActiveTab(index);
  }, []);
  
  const nextTab = useCallback((maxTabs) => {
    setActiveTab(prev => (prev + 1) % maxTabs);
  }, []);
  
  const prevTab = useCallback((maxTabs) => {
    setActiveTab(prev => (prev - 1 + maxTabs) % maxTabs);
  }, []);
  
  return {
    activeTab,
    goToTab,
    nextTab,
    prevTab
  };
};

/**
 * 알림 관리 훅
 */
export const useNotification = () => {
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    type: 'info' // info, success, error, warning
  });
  
  const timeoutRef = useRef(null);
  
  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    // 이전 타임아웃 클리어
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setNotification({
      open: true,
      message,
      type
    });
    
    timeoutRef.current = setTimeout(() => {
      setNotification(prev => ({ ...prev, open: false }));
    }, duration);
  }, []);
  
  const hideNotification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setNotification(prev => ({ ...prev, open: false }));
  }, []);
  
  return {
    notification,
    showNotification,
    hideNotification
  };
};

// ===== 데이터 변환 훅 =====

/**
 * 차트 데이터 변환 훅
 */
export const useChartData = (data, type) => {
  return useMemo(() => {
    if (!data) return null;
    
    switch (type) {
      case 'monthly-trend':
        return Object.entries(data.monthly || {}).map(([key, value]) => ({
          month: key.split('-')[1],
          ...value
        }));
        
      case 'platform-comparison':
        return data.platforms?.map(platform => ({
          name: platform.platform,
          value: platform.ctr,
          color: getPlatformColor(platform.platform)
        }));
        
      case 'facility-comparison':
        return Object.entries(data.facilityStats || {}).map(([facility, stats]) => ({
          facility,
          ...stats
        }));
        
      default:
        return null;
    }
  }, [data, type]);
};

export default {
  useAirtableConnection,
  useMonthlyStats,
  useYearlyStats,
  useDashboardData,
  useWindowSize,
  useWindowEvent,
  useDebounce,
  useLocalStorage,
  useGoals,
  useTabs,
  useNotification,
  useChartData
};
