/**
 * AI_FIRST_dataStructure.js
 * 광고 효율 분석 대시보드 데이터 구조 정의
 * 평탄화된 구조 (최대 2단계)
 * 
 * 초호: 홈페이지 방문자 데이터 + 네이버 광고 데이터
 * 초호쉼터: 플레이스 노출 데이터 + 메타 광고 데이터
 */

// ===== 기본 데이터 타입 정의 =====

/**
 * 광고 플랫폼 타입
 */
export const PLATFORMS = {
  NAVER: '네이버광고',
  HOMEPAGE: '홈페이지',
  PLACE: '플레이스',
  META: 'Meta'
};

/**
 * 시설 타입 및 데이터 소스 매핑
 */
export const FACILITIES = {
  CHOHO: {
    key: 'choho',
    name: '초호',
    dataSources: {
      primary: PLATFORMS.HOMEPAGE,    // 홈페이지 방문자 데이터
      secondary: PLATFORMS.NAVER      // 네이버 광고 데이터
    }
  },
  SHELTER: {
    key: 'shelter', 
    name: '초호쉼터',
    dataSources: {
      primary: PLATFORMS.PLACE,       // 플레이스 노출 데이터
      secondary: PLATFORMS.META        // Meta 광고 데이터
    }
  },
  TOTAL: {
    key: 'total',
    name: '전체',
    dataSources: {
      primary: 'combined',
      secondary: 'combined'
    }
  }
};

/**
 * CTR 등급 정의
 */
export const CTR_GRADES = {
  S: { min: 5, label: '최우수', color: '#FFD700' },
  A: { min: 3, label: '우수', color: '#4CAF50' },
  B: { min: 2, label: '양호', color: '#2196F3' },
  C: { min: 1, label: '보통', color: '#FF9800' },
  D: { min: 0.5, label: '개선필요', color: '#F44336' },
  F: { min: 0, label: '위험', color: '#9E9E9E' }
};

/**
 * CPC 효율 등급 정의
 */
export const CPC_GRADES = {
  VERY_EFFICIENT: { max: 50, label: '매우 효율적', color: '#4CAF50' },
  EFFICIENT: { max: 100, label: '효율적', color: '#8BC34A' },
  NORMAL: { max: 200, label: '보통', color: '#FFC107' },
  INEFFICIENT: { max: 500, label: '비효율적', color: '#FF9800' },
  VERY_INEFFICIENT: { max: Infinity, label: '매우 비효율적', color: '#F44336' }
};

// ===== 데이터 구조 =====

/**
 * 광고 메트릭 기본 구조
 */
export const AdMetrics = {
  impressions: 0,      // 노출수
  clicks: 0,           // 클릭수
  adCost: 0,          // 광고비
  visitors: 0,         // 방문자수
  pageviews: 0,        // 페이지뷰
  ctr: 0,             // 클릭률 (%)
  cpc: 0,             // 클릭당 비용
  cpm: 0,             // 1000노출당 비용
  efficiency: 0        // 효율성 (클릭/천원)
};

/**
 * 시설별 통계 구조
 * 초호: 홈페이지 + 네이버광고
 * 초호쉼터: 플레이스 + Meta
 */
export const FacilityStats = {
  choho: { 
    ...AdMetrics,
    sources: {
      homepage: { ...AdMetrics },
      naver: { ...AdMetrics }
    }
  },
  shelter: { 
    ...AdMetrics,
    sources: {
      place: { ...AdMetrics },
      meta: { ...AdMetrics }
    }
  },
  total: { ...AdMetrics }
};

/**
 * 플랫폼별 통계 구조
 */
export const PlatformStats = {
  platform: '',
  ...AdMetrics,
  facility: '', // 'choho' | 'shelter' | 'both'
  performance: {
    grade: '',
    trend: 'stable', // up, down, stable
    recommendation: ''
  }
};

/**
 * 월별 데이터 구조
 */
export const MonthlyData = {
  year: 0,
  month: 0,
  ...AdMetrics,
  facilityStats: { ...FacilityStats },
  platformStats: [],  // PlatformStats[]
  goals: {
    target: '',
    achieved: false,
    achievementRate: 0
  }
};

/**
 * 연간 통계 구조
 */
export const YearlyStats = {
  year: 0,
  total: { ...AdMetrics },
  monthlyData: {},  // { [month: number]: MonthlyData }
  bestMonth: {
    month: 0,
    metric: '',
    value: 0
  },
  worstMonth: {
    month: 0,
    metric: '',
    value: 0
  },
  averages: {
    ctr: 0,
    cpc: 0,
    cpm: 0,
    monthlyAdCost: 0
  }
};

/**
 * 대시보드 전체 데이터 구조
 */
export const DashboardData = {
  // 현재 선택된 기간
  currentPeriod: {
    year: 0,
    month: 0
  },
  
  // 요약 데이터
  summary: {
    ...AdMetrics,
    facilityStats: { ...FacilityStats },
    trends: {
      ctr: { value: 0, change: 0, direction: 'stable' },
      cpc: { value: 0, change: 0, direction: 'stable' },
      visitors: { value: 0, change: 0, direction: 'stable' }
    }
  },
  
  // 플랫폼별 데이터
  platforms: [], // PlatformStats[]
  
  // 월별 데이터
  monthly: {}, // { [key: string]: MonthlyData }
  
  // 연간 데이터
  yearly: null, // YearlyStats
  
  // 목표 데이터
  goals: {
    current: '',
    history: [] // { period: string, goal: string, achieved: boolean }[]
  },
  
  // 메타 정보
  meta: {
    lastUpdated: null,
    isLoading: false,
    error: null
  }
};

// ===== 유틸리티 함수 =====

/**
 * CTR 등급 계산
 */
export const getCTRGrade = (ctr) => {
  const numericCtr = Number(ctr) || 0;
  
  if (numericCtr >= CTR_GRADES.S.min) return { grade: 'S', ...CTR_GRADES.S };
  if (numericCtr >= CTR_GRADES.A.min) return { grade: 'A', ...CTR_GRADES.A };
  if (numericCtr >= CTR_GRADES.B.min) return { grade: 'B', ...CTR_GRADES.B };
  if (numericCtr >= CTR_GRADES.C.min) return { grade: 'C', ...CTR_GRADES.C };
  if (numericCtr >= CTR_GRADES.D.min) return { grade: 'D', ...CTR_GRADES.D };
  return { grade: 'F', ...CTR_GRADES.F };
};

/**
 * CPC 효율 등급 계산
 */
export const getCPCGrade = (cpc) => {
  const numericCpc = Number(cpc) || 0;
  
  if (numericCpc <= CPC_GRADES.VERY_EFFICIENT.max) 
    return { level: CPC_GRADES.VERY_EFFICIENT.label, ...CPC_GRADES.VERY_EFFICIENT };
  if (numericCpc <= CPC_GRADES.EFFICIENT.max) 
    return { level: CPC_GRADES.EFFICIENT.label, ...CPC_GRADES.EFFICIENT };
  if (numericCpc <= CPC_GRADES.NORMAL.max) 
    return { level: CPC_GRADES.NORMAL.label, ...CPC_GRADES.NORMAL };
  if (numericCpc <= CPC_GRADES.INEFFICIENT.max) 
    return { level: CPC_GRADES.INEFFICIENT.label, ...CPC_GRADES.INEFFICIENT };
  
  return { level: CPC_GRADES.VERY_INEFFICIENT.label, ...CPC_GRADES.VERY_INEFFICIENT };
};

/**
 * 메트릭 계산
 */
export const calculateMetrics = (data) => {
  const impressions = Number(data.impressions) || 0;
  const clicks = Number(data.clicks) || 0;
  const adCost = Number(data.adCost) || 0;
  const visitors = Number(data.visitors) || 0;
  const pageviews = Number(data.pageviews) || 0;
  
  return {
    impressions,
    clicks,
    adCost,
    visitors,
    pageviews,
    ctr: impressions > 0 ? (clicks / impressions * 100) : 0,
    cpc: clicks > 0 ? (adCost / clicks) : 0,
    cpm: impressions > 0 ? (adCost / impressions * 1000) : 0,
    efficiency: adCost > 0 ? (clicks / adCost * 1000) : 0
  };
};

/**
 * 시설별 데이터 집계
 * 초호 = 홈페이지 + 네이버광고
 * 초호쉼터 = 플레이스 + Meta
 */
export const aggregateFacilityData = (platformData) => {
  const chohoData = {
    impressions: 0,
    clicks: 0,
    adCost: 0,
    visitors: 0,
    pageviews: 0
  };
  
  const shelterData = {
    impressions: 0,
    clicks: 0,
    adCost: 0,
    visitors: 0,
    pageviews: 0
  };
  
  // 초호 데이터 집계 (홈페이지 + 네이버)
  if (platformData[PLATFORMS.HOMEPAGE]) {
    const homepage = platformData[PLATFORMS.HOMEPAGE];
    chohoData.impressions += homepage.impressions || 0;
    chohoData.clicks += homepage.clicks || 0;
    chohoData.adCost += homepage.adCost || 0;
    chohoData.visitors += homepage.visitors || 0;
    chohoData.pageviews += homepage.pageviews || 0;
  }
  
  if (platformData[PLATFORMS.NAVER]) {
    const naver = platformData[PLATFORMS.NAVER];
    chohoData.impressions += naver.impressions || 0;
    chohoData.clicks += naver.clicks || 0;
    chohoData.adCost += naver.adCost || 0;
    chohoData.visitors += naver.visitors || 0;
    chohoData.pageviews += naver.pageviews || 0;
  }
  
  // 초호쉼터 데이터 집계 (플레이스 + Meta)
  if (platformData[PLATFORMS.PLACE]) {
    const place = platformData[PLATFORMS.PLACE];
    shelterData.impressions += place.impressions || 0;
    shelterData.clicks += place.clicks || 0;
    shelterData.adCost += place.adCost || 0;
    shelterData.visitors += place.visitors || 0;
    shelterData.pageviews += place.pageviews || 0;
  }
  
  if (platformData[PLATFORMS.META]) {
    const meta = platformData[PLATFORMS.META];
    shelterData.impressions += meta.impressions || 0;
    shelterData.clicks += meta.clicks || 0;
    shelterData.adCost += meta.adCost || 0;
    shelterData.visitors += meta.visitors || 0;
    shelterData.pageviews += meta.pageviews || 0;
  }
  
  // 전체 데이터
  const totalData = {
    impressions: chohoData.impressions + shelterData.impressions,
    clicks: chohoData.clicks + shelterData.clicks,
    adCost: chohoData.adCost + shelterData.adCost,
    visitors: chohoData.visitors + shelterData.visitors,
    pageviews: chohoData.pageviews + shelterData.pageviews
  };
  
  return {
    choho: calculateMetrics(chohoData),
    shelter: calculateMetrics(shelterData),
    total: calculateMetrics(totalData)
  };
};

/**
 * 트렌드 방향 계산
 */
export const getTrendDirection = (current, previous) => {
  if (!previous || previous === 0) return 'stable';
  
  const change = ((current - previous) / previous) * 100;
  
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
};

/**
 * 월별 데이터 키 생성
 */
export const getMonthlyKey = (year, month) => {
  return `${year}-${String(month).padStart(2, '0')}`;
};

/**
 * 평탄화된 데이터 변환
 */
export const flattenData = (nestedData) => {
  const flattened = {};
  
  const flatten = (obj, prefix = '') => {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0) {
        // 최대 2단계까지만 평탄화
        if (prefix.split('.').length < 2) {
          flatten(value, newKey);
        } else {
          flattened[newKey] = value;
        }
      } else {
        flattened[newKey] = value;
      }
    });
  };
  
  flatten(nestedData);
  return flattened;
};

/**
 * 초기 데이터 생성
 */
export const createInitialData = () => {
  return JSON.parse(JSON.stringify(DashboardData));
};

/**
 * 플랫폼 색상 가져오기
 */
export const getPlatformColor = (platform) => {
  const colors = {
    [PLATFORMS.NAVER]: '#03C75A',
    [PLATFORMS.HOMEPAGE]: '#667eea',
    [PLATFORMS.PLACE]: '#FF6B6B',
    [PLATFORMS.META]: '#1877F2'
  };
  return colors[platform] || '#999';
};

/**
 * 시설별 색상 가져오기
 */
export const getFacilityColor = (facility) => {
  const colors = {
    choho: '#4CAF50',
    shelter: '#2196F3',
    total: '#667eea'
  };
  return colors[facility] || '#999';
};

export default {
  PLATFORMS,
  FACILITIES,
  CTR_GRADES,
  CPC_GRADES,
  AdMetrics,
  FacilityStats,
  PlatformStats,
  MonthlyData,
  YearlyStats,
  DashboardData,
  getCTRGrade,
  getCPCGrade,
  calculateMetrics,
  aggregateFacilityData,
  getTrendDirection,
  getMonthlyKey,
  flattenData,
  createInitialData,
  getPlatformColor,
  getFacilityColor
};
