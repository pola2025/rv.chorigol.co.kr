/**
 * AI_FIRST_dataMapping.js
 * Airtable 데이터와 시설별 매핑 정의
 * 
 * 각 시설별 데이터 구조:
 * 초호: 홈페이지, 플레이스, 네이버광고
 * 초호쉼터: 홈페이지, 플레이스, Meta광고
 */

// Airtable 테이블 매핑
export const AIRTABLE_TABLES = {
  // 초호 관련 테이블
  HOMEPAGE_CHOHO: '홈페이지_초호',      // 초호 홈페이지 방문 데이터
  PLACE_CHOHO: '플레이스_초호',         // 초호 플레이스 노출 데이터
  NAVER_CHOHO: '네이버광고_초호',       // 초호 네이버 광고 데이터
  
  // 초호쉼터 관련 테이블  
  HOMEPAGE_SHELTER: '홈페이지_초호쉼터', // 초호쉼터 홈페이지 방문 데이터
  PLACE_SHELTER: '플레이스_초호쉼터',    // 초호쉼터 플레이스 노출 데이터
  META: 'Meta',                         // 초호쉼터 Meta 광고 데이터
  
  // 전체 통계 (필요시 사용)
  NAVER_TOTAL: '네이버광고_전체통계'
};

// 시설별 데이터 소스 매핑
export const FACILITY_DATA_MAPPING = {
  CHOHO: {
    name: '초호',
    tables: {
      homepage: AIRTABLE_TABLES.HOMEPAGE_CHOHO,   // 홈페이지
      place: AIRTABLE_TABLES.PLACE_CHOHO,         // 플레이스
      ad: AIRTABLE_TABLES.NAVER_CHOHO            // 광고 (네이버)
    },
    platforms: {
      '홈페이지': AIRTABLE_TABLES.HOMEPAGE_CHOHO,
      '플레이스': AIRTABLE_TABLES.PLACE_CHOHO,
      '네이버광고': AIRTABLE_TABLES.NAVER_CHOHO
    },
    description: '초호 펜션 - 홈페이지, 플레이스, 네이버광고'
  },
  SHELTER: {
    name: '초호쉼터',
    tables: {
      homepage: AIRTABLE_TABLES.HOMEPAGE_SHELTER, // 홈페이지
      place: AIRTABLE_TABLES.PLACE_SHELTER,       // 플레이스
      ad: AIRTABLE_TABLES.META                   // 광고 (Meta)
    },
    platforms: {
      '홈페이지': AIRTABLE_TABLES.HOMEPAGE_SHELTER,
      '플레이스': AIRTABLE_TABLES.PLACE_SHELTER,
      'Meta': AIRTABLE_TABLES.META
    },
    description: '초호쉼터 - 홈페이지, 플레이스, Meta광고'
  }
};

// 플랫폼 타입별 분류
export const PLATFORM_TYPES = {
  HOMEPAGE: '홈페이지',    // 웹사이트 방문 데이터
  PLACE: '플레이스',       // 네이버 플레이스 노출 데이터
  AD: '광고'              // 광고 플랫폼 (네이버/Meta)
};

// 데이터 카테고리 매핑
export const DATA_CATEGORIES = {
  // 광고 관련
  IMPRESSIONS: ['노출', '노출수', '노출 수'],
  CLICKS: ['클릭', '클릭수', '클릭 수'],
  AD_COST: ['광고비', '비용', '광고 비용'],
  
  // 웹사이트 관련
  VISITORS: ['방문자', '사용자', '신규방문자', '유저', '사용자수', '방문자수'],
  PAGEVIEWS: ['페이지뷰', '페이지 조회수', '페이지수', '페이지', '페이지 뷰'],
  SESSIONS: ['세션', '세션수', '세션 수'],
  
  // 비즈니스 관련
  REVENUE: ['매출', '매출액', '수익'],
  BOOKINGS: ['예약', '예약건수', '예약 건수', '건수'],
  INQUIRIES: ['문의', '문의건수', '문의 건수']
};

/**
 * 카테고리 판별 함수
 */
export const getCategoryType = (category) => {
  if (!category) return 'unknown';
  
  const categoryStr = String(category).toLowerCase().replace(/\s/g, '');
  
  // 노출
  if (DATA_CATEGORIES.IMPRESSIONS.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'impressions';
  }
  
  // 클릭
  if (DATA_CATEGORIES.CLICKS.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'clicks';
  }
  
  // 광고비
  if (DATA_CATEGORIES.AD_COST.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'adCost';
  }
  
  // 방문자
  if (DATA_CATEGORIES.VISITORS.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'visitors';
  }
  
  // 페이지뷰
  if (DATA_CATEGORIES.PAGEVIEWS.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'pageviews';
  }
  
  // 세션
  if (DATA_CATEGORIES.SESSIONS.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'sessions';
  }
  
  // 매출
  if (DATA_CATEGORIES.REVENUE.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'revenue';
  }
  
  // 예약
  if (DATA_CATEGORIES.BOOKINGS.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'bookings';
  }
  
  // 문의
  if (DATA_CATEGORIES.INQUIRIES.some(term => 
    categoryStr.includes(term.toLowerCase().replace(/\s/g, '')))) {
    return 'inquiries';
  }
  
  return 'unknown';
};

/**
 * Airtable 데이터를 표준 메트릭으로 변환
 */
export const transformAirtableData = (airtableData, tableName = '') => {
  const metrics = {
    impressions: 0,
    clicks: 0,
    adCost: 0,
    visitors: 0,
    pageviews: 0,
    sessions: 0,
    revenue: 0,
    bookings: 0,
    inquiries: 0
  };
  
  // 데이터가 없으면 빈 메트릭 반환
  if (!airtableData || !Array.isArray(airtableData)) {
    return metrics;
  }
  
  // 카테고리별로 데이터 집계
  airtableData.forEach(item => {
    if (!item.category || item.value === undefined) return;
    
    const categoryType = getCategoryType(item.category);
    const value = Number(item.value) || 0;
    
    if (categoryType !== 'unknown' && metrics.hasOwnProperty(categoryType)) {
      metrics[categoryType] += value;
    }
  });
  
  return metrics;
};

/**
 * 시설별 데이터 집계
 * 각 시설의 홈페이지, 플레이스, 광고 데이터를 합산
 */
export const aggregateFacilityMetrics = (allTableData) => {
  const facilityMetrics = {
    choho: {
      impressions: 0,
      clicks: 0,
      adCost: 0,
      visitors: 0,
      pageviews: 0,
      sessions: 0,
      revenue: 0,
      bookings: 0,
      inquiries: 0
    },
    shelter: {
      impressions: 0,
      clicks: 0,
      adCost: 0,
      visitors: 0,
      pageviews: 0,
      sessions: 0,
      revenue: 0,
      bookings: 0,
      inquiries: 0
    }
  };
  
  // 초호 데이터 집계 (홈페이지 + 플레이스 + 네이버광고)
  Object.values(FACILITY_DATA_MAPPING.CHOHO.tables).forEach(tableName => {
    if (allTableData[tableName]) {
      const metrics = transformAirtableData(allTableData[tableName], tableName);
      Object.keys(metrics).forEach(key => {
        facilityMetrics.choho[key] += metrics[key];
      });
    }
  });
  
  // 초호쉼터 데이터 집계 (홈페이지 + 플레이스 + Meta)
  Object.values(FACILITY_DATA_MAPPING.SHELTER.tables).forEach(tableName => {
    if (allTableData[tableName]) {
      const metrics = transformAirtableData(allTableData[tableName], tableName);
      Object.keys(metrics).forEach(key => {
        facilityMetrics.shelter[key] += metrics[key];
      });
    }
  });
  
  // 전체 합계
  const total = {
    impressions: facilityMetrics.choho.impressions + facilityMetrics.shelter.impressions,
    clicks: facilityMetrics.choho.clicks + facilityMetrics.shelter.clicks,
    adCost: facilityMetrics.choho.adCost + facilityMetrics.shelter.adCost,
    visitors: facilityMetrics.choho.visitors + facilityMetrics.shelter.visitors,
    pageviews: facilityMetrics.choho.pageviews + facilityMetrics.shelter.pageviews,
    sessions: facilityMetrics.choho.sessions + facilityMetrics.shelter.sessions,
    revenue: facilityMetrics.choho.revenue + facilityMetrics.shelter.revenue,
    bookings: facilityMetrics.choho.bookings + facilityMetrics.shelter.bookings,
    inquiries: facilityMetrics.choho.inquiries + facilityMetrics.shelter.inquiries
  };
  
  return {
    choho: facilityMetrics.choho,
    shelter: facilityMetrics.shelter,
    total
  };
};

/**
 * 플랫폼별 데이터 집계
 * 홈페이지, 플레이스, 광고별로 데이터 합산
 */
export const aggregatePlatformMetrics = (allTableData) => {
  const platformMetrics = {
    홈페이지: { impressions: 0, clicks: 0, adCost: 0, visitors: 0, pageviews: 0 },
    플레이스: { impressions: 0, clicks: 0, adCost: 0, visitors: 0, pageviews: 0 },
    네이버광고: { impressions: 0, clicks: 0, adCost: 0, visitors: 0, pageviews: 0 },
    Meta: { impressions: 0, clicks: 0, adCost: 0, visitors: 0, pageviews: 0 }
  };
  
  // 홈페이지 데이터 (초호 + 초호쉼터)
  [AIRTABLE_TABLES.HOMEPAGE_CHOHO, AIRTABLE_TABLES.HOMEPAGE_SHELTER].forEach(tableName => {
    if (allTableData[tableName]) {
      const metrics = transformAirtableData(allTableData[tableName]);
      Object.keys(metrics).forEach(key => {
        if (platformMetrics.홈페이지.hasOwnProperty(key)) {
          platformMetrics.홈페이지[key] += metrics[key];
        }
      });
    }
  });
  
  // 플레이스 데이터 (초호 + 초호쉼터)
  [AIRTABLE_TABLES.PLACE_CHOHO, AIRTABLE_TABLES.PLACE_SHELTER].forEach(tableName => {
    if (allTableData[tableName]) {
      const metrics = transformAirtableData(allTableData[tableName]);
      Object.keys(metrics).forEach(key => {
        if (platformMetrics.플레이스.hasOwnProperty(key)) {
          platformMetrics.플레이스[key] += metrics[key];
        }
      });
    }
  });
  
  // 네이버광고 데이터 (초호만)
  if (allTableData[AIRTABLE_TABLES.NAVER_CHOHO]) {
    const metrics = transformAirtableData(allTableData[AIRTABLE_TABLES.NAVER_CHOHO]);
    Object.keys(metrics).forEach(key => {
      if (platformMetrics.네이버광고.hasOwnProperty(key)) {
        platformMetrics.네이버광고[key] += metrics[key];
      }
    });
  }
  
  // Meta 데이터 (초호쉼터만)
  if (allTableData[AIRTABLE_TABLES.META]) {
    const metrics = transformAirtableData(allTableData[AIRTABLE_TABLES.META]);
    Object.keys(metrics).forEach(key => {
      if (platformMetrics.Meta.hasOwnProperty(key)) {
        platformMetrics.Meta[key] += metrics[key];
      }
    });
  }
  
  return platformMetrics;
};

/**
 * 시설별 플랫폼 데이터 분리
 * 각 시설이 어떤 플랫폼 데이터를 가지고 있는지 구분
 */
export const getFacilityPlatformBreakdown = (allTableData) => {
  return {
    choho: {
      homepage: transformAirtableData(allTableData[AIRTABLE_TABLES.HOMEPAGE_CHOHO]),
      place: transformAirtableData(allTableData[AIRTABLE_TABLES.PLACE_CHOHO]),
      ad: transformAirtableData(allTableData[AIRTABLE_TABLES.NAVER_CHOHO])
    },
    shelter: {
      homepage: transformAirtableData(allTableData[AIRTABLE_TABLES.HOMEPAGE_SHELTER]),
      place: transformAirtableData(allTableData[AIRTABLE_TABLES.PLACE_SHELTER]),
      ad: transformAirtableData(allTableData[AIRTABLE_TABLES.META])
    }
  };
};

/**
 * 시설별 상세 정보
 */
export const getFacilityDetails = () => {
  return {
    choho: {
      name: '초호 펜션',
      platforms: {
        homepage: '홈페이지',
        place: '플레이스',
        ad: '네이버광고'
      },
      color: '#4CAF50'
    },
    shelter: {
      name: '초호쉼터',
      platforms: {
        homepage: '홈페이지',
        place: '플레이스',
        ad: 'Meta'
      },
      color: '#2196F3'
    }
  };
};

/**
 * 테이블별 데이터 분류
 */
export const getTableClassification = () => {
  return {
    '홈페이지_초호': { 
      facility: '초호', 
      platform: '홈페이지', 
      type: '방문',
      description: '초호 펜션 홈페이지 방문자 데이터'
    },
    '플레이스_초호': { 
      facility: '초호', 
      platform: '플레이스', 
      type: '노출',
      description: '초호 펜션 네이버 플레이스 노출 데이터'
    },
    '네이버광고_초호': { 
      facility: '초호', 
      platform: '네이버광고', 
      type: '광고',
      description: '초호 펜션 네이버 광고 데이터'
    },
    '홈페이지_초호쉼터': { 
      facility: '초호쉼터', 
      platform: '홈페이지', 
      type: '방문',
      description: '초호쉼터 홈페이지 방문자 데이터'
    },
    '플레이스_초호쉼터': { 
      facility: '초호쉼터', 
      platform: '플레이스', 
      type: '노출',
      description: '초호쉼터 네이버 플레이스 노출 데이터'
    },
    'Meta': { 
      facility: '초호쉼터', 
      platform: 'Meta', 
      type: '광고',
      description: '초호쉼터 Meta(Facebook/Instagram) 광고 데이터'
    }
  };
};

export default {
  AIRTABLE_TABLES,
  FACILITY_DATA_MAPPING,
  PLATFORM_TYPES,
  DATA_CATEGORIES,
  getCategoryType,
  transformAirtableData,
  aggregateFacilityMetrics,
  aggregatePlatformMetrics,
  getFacilityPlatformBreakdown,
  getFacilityDetails,
  getTableClassification
};
