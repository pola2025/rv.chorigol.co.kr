// src/services/airtableService.js
import Airtable from 'airtable';

// Airtable 설정 (Vite 환경변수 사용)
const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;

console.log('Airtable Config:', {
  apiKey: AIRTABLE_API_KEY ? 'Set' : 'Not Set',
  baseId: AIRTABLE_BASE_ID || 'Not Set'
});

// 캐시 설정
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

const getCacheKey = (tableName, year, month) => `${tableName}_${year}_${month}`;

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached data for ${key}`);
    return cached.data;
  }
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// Airtable 초기화
let base;
try {
  if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
    base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
  } else {
    console.error('Airtable API Key or Base ID is missing');
  }
} catch (error) {
  console.error('Failed to initialize Airtable:', error);
}

// 테이블 ID와 이름 매핑
const TABLES = {
  '네이버광고_초호': 'tblekatqfobp0t954',
  '네이버광고_전체통계': 'tblLgFkHGWsSAZ7gu',
  '홈페이지_초호': 'tblK4ykD9KvPRr3Zd',
  '홈페이지_초호쉼터': 'tblWhgbF7Bsfd5bX3',
  '플레이스_초호': 'tblDuSE1vDKC4Btsy',
  '플레이스_초호쉼터': 'tblxwIevTbld01dvk',
  'Meta': 'tblya4SsAiH9eOtmu'
};

// 플랫폼 그룹 정의
const PLATFORM_GROUPS = {
  '네이버광고': ['네이버광고_초호', '네이버광고_전체통계'],
  '홈페이지': ['홈페이지_초호', '홈페이지_초호쉼터'],
  '플레이스': ['플레이스_초호', '플레이스_초호쉼터'],
  'Meta': ['Meta']
};

// 월 컬럼명 생성 함수
const getMonthColumn = (year, month) => {
  return `${year}.${String(month).padStart(2, '0')}`;
};

// 숫자 파싱 함수
const parseNumber = (value) => {
  if (!value) return 0;
  const cleanValue = String(value).replace(/[^0-9.-]/g, '');
  return parseFloat(cleanValue) || 0;
};

// 특정 테이블의 월별 데이터 가져오기 (캐싱 적용)
export const fetchTableMonthlyData = async (tableName, year, month) => {
  const cacheKey = getCacheKey(tableName, year, month);
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    if (!base) throw new Error('Airtable not initialized');
    
    const tableId = TABLES[tableName];
    if (!tableId) {
      throw new Error(`테이블을 찾을 수 없습니다: ${tableName}`);
    }

    const monthColumn = getMonthColumn(year, month);
    const records = await base(tableId).select({
      maxRecords: 100,
      view: "Grid view"
    }).all();

    const data = [];
    records.forEach(record => {
      const category = record.get('분류');
      const value = record.get(monthColumn);
      
      if (category) {
        data.push({
          id: record.id,
          category,
          value: parseNumber(value),
          rawValue: value || '0'
        });
      }
    });

    setCachedData(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`${tableName} 데이터 조회 실패:`, error);
    return [];
  }
};

// 모든 플랫폼의 월별 통계 가져오기 (병렬 처리)
export const fetchAllPlatformStats = async (year, month) => {
  try {
    if (!base) throw new Error('Airtable not initialized');
    
    const allStats = {};
    
    // 병렬로 모든 플랫폼 데이터 가져오기
    const promises = Object.entries(PLATFORM_GROUPS).map(async ([platformGroup, tables]) => {
      const platformData = {
        tables: {},
        total: {
          revenue: 0,
          bookings: 0,
          clicks: 0,
          impressions: 0,
          adCost: 0
        }
      };
      
      // 각 테이블 데이터 병렬 처리
      const tablePromises = tables.map(async (tableName) => {
        const data = await fetchTableMonthlyData(tableName, year, month);
        return { tableName, data };
      });
      
      const tableResults = await Promise.all(tablePromises);
      
      tableResults.forEach(({ tableName, data }) => {
        platformData.tables[tableName] = data;
        
        // 카테고리별 데이터 합산
        data.forEach(item => {
          if (!item.category) return;
          
          if (item.category.includes('매출')) {
            platformData.total.revenue += item.value;
          } else if (item.category.includes('예약') || item.category.includes('건수')) {
            platformData.total.bookings += item.value;
          } else if (item.category.includes('클릭')) {
            platformData.total.clicks += item.value;
          } else if (item.category.includes('노출')) {
            platformData.total.impressions += item.value;
          } else if (item.category.includes('광고비')) {
            platformData.total.adCost += item.value;
          }
        });
      });
      
      return { platformGroup, data: platformData };
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ platformGroup, data }) => {
      allStats[platformGroup] = data;
    });
    
    return allStats;
  } catch (error) {
    console.error('전체 플랫폼 통계 조회 실패:', error);
    return {};
  }
};

// 연간 통계 가져오기 (최적화)
export const fetchYearlyStats = async (year) => {
  try {
    if (!base) throw new Error('Airtable not initialized');
    
    const yearlyStats = {};
    
    // 모든 플랫폼과 월을 병렬로 처리
    const platformPromises = Object.entries(PLATFORM_GROUPS).map(async ([platformGroup, tables]) => {
      const platformData = {
        monthlyData: {},
        yearTotal: {
          revenue: 0,
          bookings: 0,
          clicks: 0,
          impressions: 0,
          adCost: 0
        }
      };
      
      // 1-12월 데이터를 병렬로 가져오기
      const monthPromises = [];
      for (let month = 1; month <= 12; month++) {
        monthPromises.push(
          Promise.all(tables.map(tableName => fetchTableMonthlyData(tableName, year, month)))
            .then(results => ({ month, results }))
        );
      }
      
      const monthResults = await Promise.all(monthPromises);
      
      monthResults.forEach(({ month, results }) => {
        platformData.monthlyData[month] = {
          revenue: 0,
          bookings: 0,
          clicks: 0,
          impressions: 0,
          adCost: 0
        };
        
        results.forEach(tableData => {
          tableData.forEach(item => {
            if (!item.category) return;
            
            if (item.category.includes('매출')) {
              platformData.monthlyData[month].revenue += item.value;
              platformData.yearTotal.revenue += item.value;
            } else if (item.category.includes('예약') || item.category.includes('건수')) {
              platformData.monthlyData[month].bookings += item.value;
              platformData.yearTotal.bookings += item.value;
            } else if (item.category.includes('클릭')) {
              platformData.monthlyData[month].clicks += item.value;
              platformData.yearTotal.clicks += item.value;
            } else if (item.category.includes('노출')) {
              platformData.monthlyData[month].impressions += item.value;
              platformData.yearTotal.impressions += item.value;
            } else if (item.category.includes('광고비')) {
              platformData.monthlyData[month].adCost += item.value;
              platformData.yearTotal.adCost += item.value;
            }
          });
        });
      });
      
      return { platformGroup, data: platformData };
    });
    
    const results = await Promise.all(platformPromises);
    results.forEach(({ platformGroup, data }) => {
      yearlyStats[platformGroup] = data;
    });
    
    return yearlyStats;
  } catch (error) {
    console.error('연간 통계 조회 실패:', error);
    return {};
  }
};

// 통계 요약 및 분석 (초호와 초호쉼터 분리)
export const fetchStatsSummary = async (year, month) => {
  try {
    const monthStats = await fetchAllPlatformStats(year, month);
    
    // 초호와 초호쉼터 분리 집계
    const chohoStats = {
      revenue: 0,
      bookings: 0,
      clicks: 0,
      impressions: 0,
      adCost: 0,
      visitors: 0,
      pageviews: 0
    };
    
    const shelterStats = {
      revenue: 0,
      bookings: 0,
      clicks: 0,
      impressions: 0,
      adCost: 0,
      visitors: 0,
      pageviews: 0
    };
    
    let totalRevenue = 0;
    let totalBookings = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalAdCost = 0;
    const platformSummary = {};

    // 네이버 광고 데이터 처리 (초호쉼터는 전체통계 - 초호)
    if (monthStats['네이버광고']) {
      const naverData = monthStats['네이버광고'];
      
      // 초호 네이버광고 데이터
      if (naverData.tables['네이버광고_초호']) {
        naverData.tables['네이버광고_초호'].forEach(item => {
          if (item.category.includes('클릭')) chohoStats.clicks += item.value;
          if (item.category.includes('노출')) chohoStats.impressions += item.value;
          if (item.category.includes('광고비')) chohoStats.adCost += item.value;
        });
      }
      
      // 전체 네이버광고 데이터
      let totalNaverClicks = 0;
      let totalNaverImpressions = 0;
      let totalNaverAdCost = 0;
      
      if (naverData.tables['네이버광고_전체통계']) {
        naverData.tables['네이버광고_전체통계'].forEach(item => {
          if (item.category.includes('클릭')) totalNaverClicks += item.value;
          if (item.category.includes('노출')) totalNaverImpressions += item.value;
          if (item.category.includes('광고비')) totalNaverAdCost += item.value;
        });
      }
      
      // 초호쉼터 = 전체 - 초호
      shelterStats.clicks = Math.max(0, totalNaverClicks - chohoStats.clicks);
      shelterStats.impressions = Math.max(0, totalNaverImpressions - chohoStats.impressions);
      shelterStats.adCost = Math.max(0, totalNaverAdCost - chohoStats.adCost);
    }
    
    // 홈페이지 데이터 처리 - 각 플랫폼/펜션별로 분리
    let homepageChohoVisitors = 0;
    let homepageChohoPageviews = 0;
    let homepageShelterVisitors = 0;
    let homepageShelterPageviews = 0;
    
    if (monthStats['홈페이지']) {
      const homepageData = monthStats['홈페이지'];
      
      if (homepageData.tables['홈페이지_초호']) {
        homepageData.tables['홈페이지_초호'].forEach(item => {
          if (item.category.includes('방문자')) {
            chohoStats.visitors += item.value;
            homepageChohoVisitors += item.value;
          }
          if (item.category.includes('페이지뷰')) {
            chohoStats.pageviews += item.value;
            homepageChohoPageviews += item.value;
          }
        });
      }
      
      if (homepageData.tables['홈페이지_초호쉼터']) {
        homepageData.tables['홈페이지_초호쉼터'].forEach(item => {
          if (item.category.includes('방문자')) {
            shelterStats.visitors += item.value;
            homepageShelterVisitors += item.value;
          }
          if (item.category.includes('페이지뷰')) {
            shelterStats.pageviews += item.value;
            homepageShelterPageviews += item.value;
          }
        });
      }
    }
    
    // 플레이스 데이터 처리 - 각 플랫폼/펜션별로 분리
    let placeChohoVisitors = 0;
    let placeChohoPageviews = 0;
    let placeShelterVisitors = 0;
    let placeShelterPageviews = 0;
    
    if (monthStats['플레이스']) {
      const placeData = monthStats['플레이스'];
      
      if (placeData.tables['플레이스_초호']) {
        placeData.tables['플레이스_초호'].forEach(item => {
          if (item.category.includes('방문자')) {
            chohoStats.visitors += item.value;
            placeChohoVisitors += item.value;
          }
          if (item.category.includes('페이지뷰')) {
            chohoStats.pageviews += item.value;
            placeChohoPageviews += item.value;
          }
        });
      }
      
      if (placeData.tables['플레이스_초호쉼터']) {
        placeData.tables['플레이스_초호쉼터'].forEach(item => {
          if (item.category.includes('방문자')) {
            shelterStats.visitors += item.value;
            placeShelterVisitors += item.value;
          }
          if (item.category.includes('페이지뷰')) {
            shelterStats.pageviews += item.value;
            placeShelterPageviews += item.value;
          }
        });
      }
    }
    
    // 전체 통계 계산
    Object.entries(monthStats).forEach(([platform, data]) => {
      totalRevenue += data.total.revenue;
      totalBookings += data.total.bookings;
      totalClicks += data.total.clicks;
      totalImpressions += data.total.impressions;
      totalAdCost += data.total.adCost;
      
      platformSummary[platform] = {
        revenue: data.total.revenue,
        bookings: data.total.bookings,
        clicks: data.total.clicks,
        impressions: data.total.impressions,
        adCost: data.total.adCost,
        roas: data.total.adCost > 0 ? (data.total.revenue / data.total.adCost).toFixed(2) : 0,
        ctr: data.total.impressions > 0 ? ((data.total.clicks / data.total.impressions) * 100).toFixed(2) : 0,
        cvr: data.total.clicks > 0 ? ((data.total.bookings / data.total.clicks) * 100).toFixed(2) : 0
      };
    });

    // 전월 대비 증감률 계산
    let previousMonthStats = null;
    let growthRate = { 
      revenue: 0, 
      bookings: 0,
      roas: 0
    };
    
    const prevMonth = month > 1 ? month - 1 : 12;
    const prevYear = month > 1 ? year : year - 1;
    
    if (prevYear >= 2024) {
      previousMonthStats = await fetchAllPlatformStats(prevYear, prevMonth);
      
      let prevRevenue = 0;
      let prevBookings = 0;
      let prevAdCost = 0;
      
      Object.values(previousMonthStats).forEach(data => {
        prevRevenue += data.total.revenue;
        prevBookings += data.total.bookings;
        prevAdCost += data.total.adCost;
      });
      
      if (prevRevenue > 0) {
        growthRate.revenue = ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1);
      }
      if (prevBookings > 0) {
        growthRate.bookings = ((totalBookings - prevBookings) / prevBookings * 100).toFixed(1);
      }
      
      const currentRoas = totalAdCost > 0 ? totalRevenue / totalAdCost : 0;
      const prevRoas = prevAdCost > 0 ? prevRevenue / prevAdCost : 0;
      if (prevRoas > 0) {
        growthRate.roas = ((currentRoas - prevRoas) / prevRoas * 100).toFixed(1);
      }
    }

    // 분석 인사이트 생성
    const insights = generateInsights({
      totalRevenue,
      totalBookings,
      totalAdCost,
      totalClicks,
      totalImpressions,
      platformSummary,
      growthRate
    });

    return {
      totalRevenue,
      totalBookings,
      totalClicks,
      totalImpressions,
      totalAdCost,
      averageRevenue: totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0,
      totalRoas: totalAdCost > 0 ? (totalRevenue / totalAdCost).toFixed(2) : 0,
      totalCtr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
      totalCvr: totalClicks > 0 ? ((totalBookings / totalClicks) * 100).toFixed(2) : 0,
      // 초호 통계
      chohoStats: {
        ...chohoStats,
        ctr: chohoStats.impressions > 0 ? ((chohoStats.clicks / chohoStats.impressions) * 100).toFixed(2) : 0,
        cpc: chohoStats.clicks > 0 ? Math.round(chohoStats.adCost / chohoStats.clicks) : 0
      },
      // 초호쉼터 통계
      shelterStats: {
        ...shelterStats,
        ctr: shelterStats.impressions > 0 ? ((shelterStats.clicks / shelterStats.impressions) * 100).toFixed(2) : 0,
        cpc: shelterStats.clicks > 0 ? Math.round(shelterStats.adCost / shelterStats.clicks) : 0
      },
      // 홈페이지 방문자 통계 (기존 호환성 유지)
      homepageVisitors: homepageChohoVisitors,  // 초호 홈페이지
      homepagePageviews: homepageChohoPageviews,
      // 플레이스 방문자 통계 (기존 호환성 유지)
      placeVisitors: placeShelterVisitors,  // 초호쉼터 플레이스
      placePageviews: placeShelterPageviews,
      // 새로운 상세 통계
      homepageChohoVisitors,
      homepageChohoPageviews,
      homepageShelterVisitors,
      homepageShelterPageviews,
      placeChohoVisitors,
      placeChohoPageviews,
      placeShelterVisitors,
      placeShelterPageviews,
      platformSummary,
      growthRate,
      insights,
      lastUpdate: new Date().toISOString()
    };
  } catch (error) {
    console.error('통계 요약 조회 실패:', error);
    return null;
  }
};

// 인사이트 생성 함수
const generateInsights = (data) => {
  const insights = [];
  
  // 성과 분석
  if (data.growthRate.revenue > 10) {
    insights.push({
      type: 'success',
      message: `매출이 전월 대비 ${data.growthRate.revenue}% 증가했습니다! 우수한 성과입니다.`
    });
  } else if (data.growthRate.revenue < -10) {
    insights.push({
      type: 'warning',
      message: `매출이 전월 대비 ${Math.abs(data.growthRate.revenue)}% 감소했습니다. 마케팅 전략 점검이 필요합니다.`
    });
  }
  
  // ROAS 분석
  const roas = data.totalAdCost > 0 ? data.totalRevenue / data.totalAdCost : 0;
  if (roas > 5) {
    insights.push({
      type: 'success',
      message: `ROAS가 ${roas.toFixed(1)}로 매우 우수합니다. 광고 효율이 뛰어납니다.`
    });
  } else if (roas < 3) {
    insights.push({
      type: 'warning',
      message: `ROAS가 ${roas.toFixed(1)}로 낮습니다. 광고 최적화가 필요합니다.`
    });
  }
  
  // 플랫폼별 성과
  let bestPlatform = null;
  let bestRevenue = 0;
  
  Object.entries(data.platformSummary).forEach(([platform, stats]) => {
    if (stats.revenue > bestRevenue) {
      bestRevenue = stats.revenue;
      bestPlatform = platform;
    }
  });
  
  if (bestPlatform) {
    insights.push({
      type: 'info',
      message: `${bestPlatform}이(가) 가장 높은 매출(${new Intl.NumberFormat('ko-KR').format(bestRevenue)}원)을 기록했습니다.`
    });
  }
  
  // 전환율 분석
  const cvr = data.totalClicks > 0 ? (data.totalBookings / data.totalClicks) * 100 : 0;
  if (cvr > 5) {
    insights.push({
      type: 'success',
      message: `전환율이 ${cvr.toFixed(1)}%로 우수합니다. 타겟팅이 효과적입니다.`
    });
  } else if (cvr < 2) {
    insights.push({
      type: 'warning',
      message: `전환율이 ${cvr.toFixed(1)}%로 낮습니다. 랜딩 페이지 개선을 고려해보세요.`
    });
  }
  
  return insights;
};

// Airtable 연결 테스트
export const testConnection = async () => {
  try {
    if (!base) {
      return {
        connected: false,
        message: 'Airtable이 초기화되지 않았습니다. API 키와 Base ID를 확인하세요.',
        error: 'Not initialized'
      };
    }
    
    // Meta 테이블로 연결 테스트
    const records = await base(TABLES['Meta'])
      .select({ maxRecords: 1 })
      .firstPage();
    
    return {
      connected: true,
      message: 'Airtable 연결 성공',
      tablesAvailable: Object.keys(TABLES),
      baseId: AIRTABLE_BASE_ID
    };
  } catch (error) {
    console.error('Airtable 연결 실패:', error);
    return {
      connected: false,
      message: `연결 실패: ${error.message}`,
      error
    };
  }
};

// 캐시 클리어
export const clearCache = () => {
  cache.clear();
  console.log('Cache cleared');
};

// =====================================================
// 데이터 쓰기 기능 (Airtable에 데이터 저장)
// =====================================================

// 특정 테이블의 레코드 업데이트
export const updateTableRecord = async (tableName, recordId, fields) => {
  try {
    if (!base) throw new Error('Airtable not initialized');

    const tableId = TABLES[tableName];
    if (!tableId) {
      throw new Error(`테이블을 찾을 수 없습니다: ${tableName}`);
    }

    const updatedRecord = await base(tableId).update(recordId, fields);

    // 캐시 무효화
    clearCache();

    return {
      success: true,
      record: updatedRecord
    };
  } catch (error) {
    console.error(`${tableName} 레코드 업데이트 실패:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 특정 테이블에 새 레코드 추가
export const createTableRecord = async (tableName, fields) => {
  try {
    if (!base) throw new Error('Airtable not initialized');

    const tableId = TABLES[tableName];
    if (!tableId) {
      throw new Error(`테이블을 찾을 수 없습니다: ${tableName}`);
    }

    const newRecord = await base(tableId).create(fields);

    // 캐시 무효화
    clearCache();

    return {
      success: true,
      record: newRecord
    };
  } catch (error) {
    console.error(`${tableName} 레코드 생성 실패:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 월별 데이터 업데이트 (기존 레코드가 있으면 업데이트, 없으면 생성)
export const upsertMonthlyData = async (tableName, category, year, month, value) => {
  try {
    if (!base) throw new Error('Airtable not initialized');

    const tableId = TABLES[tableName];
    if (!tableId) {
      throw new Error(`테이블을 찾을 수 없습니다: ${tableName}`);
    }

    const monthColumn = getMonthColumn(year, month);

    // 해당 분류의 레코드 찾기
    const records = await base(tableId).select({
      filterByFormula: `{분류} = '${category}'`,
      maxRecords: 1
    }).firstPage();

    if (records.length > 0) {
      // 기존 레코드 업데이트
      const updatedRecord = await base(tableId).update(records[0].id, {
        [monthColumn]: value
      });

      // 캐시 무효화
      const cacheKey = getCacheKey(tableName, year, month);
      cache.delete(cacheKey);

      return {
        success: true,
        action: 'updated',
        record: updatedRecord
      };
    } else {
      // 새 레코드 생성
      const newRecord = await base(tableId).create({
        '분류': category,
        [monthColumn]: value
      });

      // 캐시 무효화
      const cacheKey = getCacheKey(tableName, year, month);
      cache.delete(cacheKey);

      return {
        success: true,
        action: 'created',
        record: newRecord
      };
    }
  } catch (error) {
    console.error(`${tableName} 월별 데이터 저장 실패:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 여러 월별 데이터 일괄 저장
export const batchUpsertMonthlyData = async (tableName, dataArray) => {
  // dataArray: [{ category, year, month, value }, ...]
  const results = [];

  for (const data of dataArray) {
    const result = await upsertMonthlyData(
      tableName,
      data.category,
      data.year,
      data.month,
      data.value
    );
    results.push({
      ...data,
      result
    });
  }

  return results;
};

// 네이버 광고 CSV 파싱 함수
export const parseNaverAdsCsv = (csvText) => {
  try {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV 파일에 데이터가 없습니다.');
    }

    // 헤더 분석
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    // 데이터 행 파싱
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    // 합계 계산
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCost = 0;

    data.forEach(row => {
      // 네이버 광고 CSV의 일반적인 컬럼명들
      const impressions = parseNumber(row['노출수'] || row['Impressions'] || row['노출'] || 0);
      const clicks = parseNumber(row['클릭수'] || row['Clicks'] || row['클릭'] || 0);
      const cost = parseNumber(row['총비용'] || row['Cost'] || row['비용'] || row['광고비'] || 0);

      totalImpressions += impressions;
      totalClicks += clicks;
      totalCost += cost;
    });

    return {
      success: true,
      summary: {
        impressions: totalImpressions,
        clicks: totalClicks,
        cost: totalCost,
        ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
        cpc: totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0
      },
      rowCount: data.length,
      headers,
      rawData: data
    };
  } catch (error) {
    console.error('CSV 파싱 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 네이버 광고 CSV 데이터를 Airtable에 저장
export const saveNaverAdsFromCsv = async (tableName, year, month, csvSummary) => {
  try {
    const results = [];

    // 노출수 저장
    results.push(await upsertMonthlyData(tableName, '노출수', year, month, csvSummary.impressions));

    // 클릭수 저장
    results.push(await upsertMonthlyData(tableName, '클릭수', year, month, csvSummary.clicks));

    // 광고비 저장
    results.push(await upsertMonthlyData(tableName, '광고비', year, month, csvSummary.cost));

    // CTR 저장 (선택적)
    results.push(await upsertMonthlyData(tableName, 'CTR', year, month, csvSummary.ctr));

    // CPC 저장 (선택적)
    results.push(await upsertMonthlyData(tableName, 'CPC', year, month, csvSummary.cpc));

    const allSuccess = results.every(r => r.success);

    return {
      success: allSuccess,
      results,
      message: allSuccess ? '네이버 광고 데이터가 저장되었습니다.' : '일부 데이터 저장에 실패했습니다.'
    };
  } catch (error) {
    console.error('네이버 광고 CSV 저장 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  fetchTableMonthlyData,
  fetchAllPlatformStats,
  fetchYearlyStats,
  fetchStatsSummary,
  testConnection,
  clearCache,
  updateTableRecord,
  createTableRecord,
  upsertMonthlyData,
  batchUpsertMonthlyData,
  parseNaverAdsCsv,
  saveNaverAdsFromCsv,
  TABLES,
  PLATFORM_GROUPS
};