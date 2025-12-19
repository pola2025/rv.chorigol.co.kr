// src/components/marketing/AdEfficiencyDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList
} from 'recharts';
import './AdEfficiencyDashboard.css';

const AdEfficiencyDashboard = ({ selectedMonth, businessType = 'pension' }) => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('overview'); // overview, platform, funnel, trend
  const [dataMode, setDataMode] = useState('all'); // all, choho, shelter
  
  // 통합 데이터 상태
  const [integratedData, setIntegratedData] = useState({
    choho: {
      ad: {},
      visit: {},
      efficiency: {}
    },
    shelter: {
      ad: {},
      visit: {},
      efficiency: {}
    },
    total: {
      ad: {},
      visit: {},
      efficiency: {}
    }
  });

  // 월별 트렌드 데이터
  const [trendData, setTrendData] = useState([]);
  
  // 차트 색상
  const COLORS = {
    choho: '#667eea',
    shelter: '#f6ad55',
    naver: '#03C75A',
    meta: '#1877F2',
    homepage: '#4299e1',
    place: '#48bb78',
    good: '#48bb78',
    warning: '#ed8936',
    danger: '#f56565'
  };

  useEffect(() => {
    loadAllData();
  }, [selectedMonth]);

  // 전체 데이터 로드 및 처리
  const loadAllData = async () => {
    setLoading(true);
    try {
      const monthKey = `${selectedMonth.year}${String(selectedMonth.month).padStart(2, '0')}`;
      const visitMonthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`;
      
      // 1. 광고 데이터 로드 (전체)
      const adDoc = await getDoc(doc(db, 'monthly_ads', monthKey));
      const totalAdData = adDoc.exists() ? adDoc.data() : {};
      
      // 2. 초호 광고 데이터 (네이버에서 초호 체크된 것)
      const chohoAdDoc = await getDoc(doc(db, 'monthly_ads', `${monthKey}_choho`));
      const chohoAdData = chohoAdDoc.exists() ? chohoAdDoc.data() : {};
      
      // 3. 방문 데이터 로드 - 초호
      const chohoVisitDoc = await getDoc(doc(db, 'monthly_visits', `${visitMonthKey}_pension`));
      const chohoVisitData = chohoVisitDoc.exists() ? chohoVisitDoc.data() : {};
      
      // 4. 방문 데이터 로드 - 초호쉼터
      const shelterVisitDoc = await getDoc(doc(db, 'monthly_visits', `${visitMonthKey}_shelter`));
      const shelterVisitData = shelterVisitDoc.exists() ? shelterVisitDoc.data() : {};
      
      // 5. 월별 트렌드 데이터 로드 (최근 6개월)
      await loadTrendData(selectedMonth);
      
      // 6. 데이터 통합 및 계산
      processIntegratedData(totalAdData, chohoAdData, chohoVisitData, shelterVisitData);
      
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 트렌드 데이터 로드 (최근 6개월)
  const loadTrendData = async (currentMonth) => {
    const trends = [];
    
    for (let i = 5; i >= 0; i--) {
      let year = currentMonth.year;
      let month = currentMonth.month - i;
      
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      const monthKey = `${year}${String(month).padStart(2, '0')}`;
      const visitMonthKey = `${year}-${String(month).padStart(2, '0')}`;
      
      try {
        // 광고 데이터
        const adDoc = await getDoc(doc(db, 'monthly_ads', monthKey));
        const adData = adDoc.exists() ? adDoc.data() : {};
        
        // 방문 데이터 (초호 + 초호쉼터)
        const pensionVisitDoc = await getDoc(doc(db, 'monthly_visits', `${visitMonthKey}_pension`));
        const shelterVisitDoc = await getDoc(doc(db, 'monthly_visits', `${visitMonthKey}_shelter`));
        
        const pensionVisit = pensionVisitDoc.exists() ? pensionVisitDoc.data() : {};
        const shelterVisit = shelterVisitDoc.exists() ? shelterVisitDoc.data() : {};
        
        // 월별 데이터 집계
        const monthData = {
          month: `${month}월`,
          광고비: calculateTotalCost(adData),
          노출: calculateTotalImpressions(adData),
          클릭: calculateTotalClicks(adData),
          방문자: calculateTotalVisitors(pensionVisit) + calculateTotalVisitors(shelterVisit),
          페이지뷰: calculateTotalPageviews(pensionVisit) + calculateTotalPageviews(shelterVisit)
        };
        
        trends.push(monthData);
      } catch (error) {
        console.error(`${month}월 데이터 로드 실패:`, error);
      }
    }
    
    setTrendData(trends);
  };

  // 데이터 통합 처리
  const processIntegratedData = (totalAd, chohoAd, chohoVisit, shelterVisit) => {
    // 초호 데이터 처리
    const chohoData = {
      ad: processAdData(chohoAd),
      visit: processVisitData(chohoVisit),
      efficiency: {}
    };
    
    // 초호쉼터 데이터 계산 (전체 - 초호)
    const shelterAdData = calculateShelterAdData(totalAd, chohoAd);
    const shelterData = {
      ad: processAdData(shelterAdData),
      visit: processVisitData(shelterVisit),
      efficiency: {}
    };
    
    // 전체 데이터
    const totalData = {
      ad: processAdData(totalAd),
      visit: {
        홈페이지: {
          visitors: (chohoVisit['홈페이지']?.visitors || 0) + (shelterVisit['홈페이지']?.visitors || 0),
          pageviews: (chohoVisit['홈페이지']?.pageviews || 0) + (shelterVisit['홈페이지']?.pageviews || 0)
        },
        '네이버 플레이스': {
          visitors: (chohoVisit['네이버 플레이스']?.visitors || 0) + (shelterVisit['네이버 플레이스']?.visitors || 0),
          pageviews: (chohoVisit['네이버 플레이스']?.pageviews || 0) + (shelterVisit['네이버 플레이스']?.pageviews || 0)
        },
        인스타그램: {
          visitors: (chohoVisit['인스타그램']?.visitors || 0) + (shelterVisit['인스타그램']?.visitors || 0),
          pageviews: (chohoVisit['인스타그램']?.pageviews || 0) + (shelterVisit['인스타그램']?.pageviews || 0)
        },
        '직접 방문': {
          visitors: (chohoVisit['직접 방문']?.visitors || 0) + (shelterVisit['직접 방문']?.visitors || 0),
          pageviews: (chohoVisit['직접 방문']?.pageviews || 0) + (shelterVisit['직접 방문']?.pageviews || 0)
        }
      },
      efficiency: {}
    };
    
    // 효율성 계산
    chohoData.efficiency = calculateEfficiency(chohoData.ad, chohoData.visit);
    shelterData.efficiency = calculateEfficiency(shelterData.ad, shelterData.visit);
    totalData.efficiency = calculateEfficiency(totalData.ad, totalData.visit);
    
    setIntegratedData({
      choho: chohoData,
      shelter: shelterData,
      total: totalData
    });
  };

  // 광고 데이터 처리
  const processAdData = (adData) => {
    const processed = {
      platforms: {},
      total: {
        cost: 0,
        impressions: 0,
        clicks: 0
      }
    };
    
    Object.entries(adData).forEach(([key, value]) => {
      if (key !== 'lastUpdated' && key !== 'year' && key !== 'month' && key !== 'updatedAt') {
        processed.platforms[key] = {
          cost: value.cost || 0,
          impressions: value.impressions || 0,
          clicks: value.clicks || 0
        };
        
        processed.total.cost += value.cost || 0;
        processed.total.impressions += value.impressions || 0;
        processed.total.clicks += value.clicks || 0;
      }
    });
    
    return processed;
  };

  // 방문 데이터 처리
  const processVisitData = (visitData) => {
    const processed = {};
    let totalVisitors = 0;
    let totalPageviews = 0;
    
    Object.entries(visitData).forEach(([channel, data]) => {
      if (channel !== 'updatedAt') {
        processed[channel] = {
          visitors: data.visitors || 0,
          pageviews: data.pageviews || 0
        };
        totalVisitors += data.visitors || 0;
        totalPageviews += data.pageviews || 0;
      }
    });
    
    processed.total = {
      visitors: totalVisitors,
      pageviews: totalPageviews
    };
    
    return processed;
  };

  // 초호쉼터 광고 데이터 계산 (전체 - 초호)
  const calculateShelterAdData = (totalAd, chohoAd) => {
    const shelterAd = {};
    
    Object.keys(totalAd).forEach(key => {
      if (key !== 'lastUpdated' && key !== 'year' && key !== 'month') {
        shelterAd[key] = {
          cost: (totalAd[key]?.cost || 0) - (chohoAd[key]?.cost || 0),
          impressions: (totalAd[key]?.impressions || 0) - (chohoAd[key]?.impressions || 0),
          clicks: (totalAd[key]?.clicks || 0) - (chohoAd[key]?.clicks || 0)
        };
      }
    });
    
    return shelterAd;
  };

  // 효율성 계산
  const calculateEfficiency = (adData, visitData) => {
    const totalAd = adData.total || {};
    const totalVisit = visitData.total || {};
    
    return {
      ctr: totalAd.impressions > 0 ? ((totalAd.clicks / totalAd.impressions) * 100).toFixed(2) : 0,
      cpc: totalAd.clicks > 0 ? Math.round(totalAd.cost / totalAd.clicks) : 0,
      cpv: totalVisit.visitors > 0 ? Math.round(totalAd.cost / totalVisit.visitors) : 0,
      clickToVisit: totalAd.clicks > 0 ? ((totalVisit.visitors / totalAd.clicks) * 100).toFixed(1) : 0,
      avgPageviews: totalVisit.visitors > 0 ? (totalVisit.pageviews / totalVisit.visitors).toFixed(1) : 0
    };
  };

  // 헬퍼 함수들
  const calculateTotalCost = (data) => {
    return Object.entries(data).reduce((sum, [key, value]) => {
      if (key !== 'lastUpdated' && key !== 'year' && key !== 'month') {
        return sum + (value.cost || 0);
      }
      return sum;
    }, 0);
  };

  const calculateTotalImpressions = (data) => {
    return Object.entries(data).reduce((sum, [key, value]) => {
      if (key !== 'lastUpdated' && key !== 'year' && key !== 'month') {
        return sum + (value.impressions || 0);
      }
      return sum;
    }, 0);
  };

  const calculateTotalClicks = (data) => {
    return Object.entries(data).reduce((sum, [key, value]) => {
      if (key !== 'lastUpdated' && key !== 'year' && key !== 'month') {
        return sum + (value.clicks || 0);
      }
      return sum;
    }, 0);
  };

  const calculateTotalVisitors = (data) => {
    return Object.entries(data).reduce((sum, [key, value]) => {
      if (key !== 'updatedAt') {
        return sum + (value.visitors || 0);
      }
      return sum;
    }, 0);
  };

  const calculateTotalPageviews = (data) => {
    return Object.entries(data).reduce((sum, [key, value]) => {
      if (key !== 'updatedAt') {
        return sum + (value.pageviews || 0);
      }
      return sum;
    }, 0);
  };

  // 현재 선택된 데이터 가져오기
  const getCurrentData = () => {
    if (dataMode === 'choho') return integratedData.choho;
    if (dataMode === 'shelter') return integratedData.shelter;
    return integratedData.total;
  };

  // 펜션별 비교 데이터
  const getPensionComparisonData = () => {
    return [
      {
        name: '초호',
        광고비: integratedData.choho.ad.total?.cost || 0,
        방문자: integratedData.choho.visit.total?.visitors || 0,
        CPV: integratedData.choho.efficiency?.cpv || 0,
        CTR: parseFloat(integratedData.choho.efficiency?.ctr || 0)
      },
      {
        name: '초호쉼터',
        광고비: integratedData.shelter.ad.total?.cost || 0,
        방문자: integratedData.shelter.visit.total?.visitors || 0,
        CPV: integratedData.shelter.efficiency?.cpv || 0,
        CTR: parseFloat(integratedData.shelter.efficiency?.ctr || 0)
      }
    ];
  };

  // 플랫폼별 비교 데이터
  const getPlatformComparisonData = () => {
    const currentData = getCurrentData();
    return Object.entries(currentData.ad.platforms || {}).map(([name, data]) => ({
      name,
      노출: data.impressions,
      클릭: data.clicks,
      비용: data.cost,
      CTR: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : 0,
      CPC: data.clicks > 0 ? Math.round(data.cost / data.clicks) : 0
    }));
  };

  // 채널별 방문 데이터
  const getChannelVisitData = () => {
    const currentData = getCurrentData();
    return Object.entries(currentData.visit || {})
      .filter(([key]) => key !== 'total')
      .map(([name, data]) => ({
        name,
        방문자: data.visitors || 0,
        페이지뷰: data.pageviews || 0
      }));
  };

  // 퍼널 데이터
  const getFunnelData = () => {
    const currentData = getCurrentData();
    return [
      { 
        name: '광고 노출', 
        value: currentData.ad.total?.impressions || 0,
        fill: COLORS.naver 
      },
      { 
        name: '광고 클릭', 
        value: currentData.ad.total?.clicks || 0,
        fill: COLORS.meta 
      },
      { 
        name: '웹사이트 방문', 
        value: currentData.visit.total?.visitors || 0,
        fill: COLORS.choho 
      },
      { 
        name: '페이지뷰', 
        value: currentData.visit.total?.pageviews || 0,
        fill: COLORS.shelter 
      }
    ];
  };

  if (loading) {
    return <div className="loading">데이터 로딩 중...</div>;
  }

  const currentData = getCurrentData();

  return (
    <div className="ad-efficiency-dashboard">
      {/* 헤더 */}
      <div className="dashboard-header">
        <h2>🎯 광고 효율 분석</h2>
        <div className="header-controls">
          <div className="data-selector">
            <button 
              className={dataMode === 'all' ? 'active' : ''}
              onClick={() => setDataMode('all')}
            >
              전체
            </button>
            <button 
              className={dataMode === 'choho' ? 'active' : ''}
              onClick={() => setDataMode('choho')}
            >
              초호
            </button>
            <button 
              className={dataMode === 'shelter' ? 'active' : ''}
              onClick={() => setDataMode('shelter')}
            >
              초호쉼터
            </button>
          </div>
          <div className="view-selector">
            <button 
              className={viewMode === 'overview' ? 'active' : ''}
              onClick={() => setViewMode('overview')}
            >
              전체 개요
            </button>
            <button 
              className={viewMode === 'platform' ? 'active' : ''}
              onClick={() => setViewMode('platform')}
            >
              플랫폼별
            </button>
            <button 
              className={viewMode === 'funnel' ? 'active' : ''}
              onClick={() => setViewMode('funnel')}
            >
              퍼널 분석
            </button>
            <button 
              className={viewMode === 'trend' ? 'active' : ''}
              onClick={() => setViewMode('trend')}
            >
              월별 트렌드
            </button>
          </div>
        </div>
      </div>

      {/* 홈페이지/플레이스 분리 표시 섹션 */}
      <div className="platform-stats-section">
        <h3>🌐 홈페이지 방문 통계</h3>
        <div className="platform-stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-icon">🏠</span>
              <span className="stat-title">초호 홈페이지</span>
            </div>
            <div className="stat-value">
              방문자: {(integratedData.choho.visit['홈페이지']?.visitors || 0).toLocaleString()}명
            </div>
            <div className="stat-sub">
              페이지뷰: {(integratedData.choho.visit['홈페이지']?.pageviews || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-icon">🏡</span>
              <span className="stat-title">초호쉼터 홈페이지</span>
            </div>
            <div className="stat-value">
              방문자: {(integratedData.shelter.visit['홈페이지']?.visitors || 0).toLocaleString()}명
            </div>
            <div className="stat-sub">
              페이지뷰: {(integratedData.shelter.visit['홈페이지']?.pageviews || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="stat-card total">
            <div className="stat-header">
              <span className="stat-icon">📊</span>
              <span className="stat-title">홈페이지 전체</span>
            </div>
            <div className="stat-value">
              방문자: {((integratedData.choho.visit['홈페이지']?.visitors || 0) + 
                       (integratedData.shelter.visit['홈페이지']?.visitors || 0)).toLocaleString()}명
            </div>
            <div className="stat-sub">
              페이지뷰: {((integratedData.choho.visit['홈페이지']?.pageviews || 0) + 
                         (integratedData.shelter.visit['홈페이지']?.pageviews || 0)).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="platform-stats-section">
        <h3>📍 네이버 플레이스 방문 통계</h3>
        <div className="platform-stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-icon">🏠</span>
              <span className="stat-title">초호 플레이스</span>
            </div>
            <div className="stat-value">
              방문자: {(integratedData.choho.visit['네이버 플레이스']?.visitors || 0).toLocaleString()}명
            </div>
            <div className="stat-sub">
              페이지뷰: {(integratedData.choho.visit['네이버 플레이스']?.pageviews || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-icon">🏡</span>
              <span className="stat-title">초호쉼터 플레이스</span>
            </div>
            <div className="stat-value">
              방문자: {(integratedData.shelter.visit['네이버 플레이스']?.visitors || 0).toLocaleString()}명
            </div>
            <div className="stat-sub">
              페이지뷰: {(integratedData.shelter.visit['네이버 플레이스']?.pageviews || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="stat-card total">
            <div className="stat-header">
              <span className="stat-icon">📊</span>
              <span className="stat-title">플레이스 전체</span>
            </div>
            <div className="stat-value">
              방문자: {((integratedData.choho.visit['네이버 플레이스']?.visitors || 0) + 
                       (integratedData.shelter.visit['네이버 플레이스']?.visitors || 0)).toLocaleString()}명
            </div>
            <div className="stat-sub">
              페이지뷰: {((integratedData.choho.visit['네이버 플레이스']?.pageviews || 0) + 
                         (integratedData.shelter.visit['네이버 플레이스']?.pageviews || 0)).toLocaleString()}
            </div>
          </div>
        </div>
      </div>


      {/* 뷰 모드별 컨텐츠 */}
      {viewMode === 'overview' && (
        <div className="overview-content">
          {/* 펜션별 비교 */}
          <div className="chart-section">
            <h3>🏠 펜션별 광고 효율 비교</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getPensionComparisonData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => {
                  if (name === '광고비' || name === 'CPV') return `${value.toLocaleString()}원`;
                  if (name === 'CTR') return `${value}%`;
                  return value.toLocaleString();
                }} />
                <Legend />
                <Bar yAxisId="left" dataKey="광고비" fill={COLORS.meta} />
                <Bar yAxisId="left" dataKey="방문자" fill={COLORS.choho} />
                <Bar yAxisId="right" dataKey="CPV" fill={COLORS.warning} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 채널별 방문 분포 */}
          <div className="chart-section">
            <h3>📈 채널별 방문자 현황</h3>
            <div className="chart-grid">
              <ResponsiveContainer width="50%" height={300}>
                <PieChart>
                  <Pie
                    data={getChannelVisitData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="방문자"
                  >
                    {getChannelVisitData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              
              <ResponsiveContainer width="50%" height={300}>
                <BarChart data={getChannelVisitData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="방문자" fill={COLORS.homepage} />
                  <Bar dataKey="페이지뷰" fill={COLORS.place} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'platform' && (
        <div className="platform-content">
          <h3>📊 플랫폼별 광고 성과 분석</h3>
          
          {/* 플랫폼 효율 비교 차트 */}
          <div className="chart-section">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={getPlatformComparisonData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => {
                  if (name === '비용' || name === 'CPC') return `${value.toLocaleString()}원`;
                  if (name === 'CTR') return `${value}%`;
                  return value.toLocaleString();
                }} />
                <Legend />
                <Bar yAxisId="left" dataKey="노출" fill={COLORS.naver} />
                <Bar yAxisId="left" dataKey="클릭" fill={COLORS.meta} />
                <Line yAxisId="right" type="monotone" dataKey="CTR" stroke={COLORS.danger} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="CPC" stroke={COLORS.warning} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 플랫폼별 상세 메트릭 */}
          <div className="platform-cards">
            {Object.entries(currentData.ad.platforms || {}).map(([name, data]) => (
              <div key={name} className="platform-detail-card">
                <h4>{name}</h4>
                <div className="platform-metrics-grid">
                  <div className="metric-item">
                    <span>광고비</span>
                    <strong>{data.cost.toLocaleString()}원</strong>
                  </div>
                  <div className="metric-item">
                    <span>노출수</span>
                    <strong>{data.impressions.toLocaleString()}</strong>
                  </div>
                  <div className="metric-item">
                    <span>클릭수</span>
                    <strong>{data.clicks.toLocaleString()}</strong>
                  </div>
                  <div className="metric-item">
                    <span>CTR</span>
                    <strong>{data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : 0}%</strong>
                  </div>
                  <div className="metric-item">
                    <span>CPC</span>
                    <strong>{data.clicks > 0 ? Math.round(data.cost / data.clicks).toLocaleString() : 0}원</strong>
                  </div>
                  <div className="metric-item">
                    <span>CPM</span>
                    <strong>{data.impressions > 0 ? Math.round((data.cost / data.impressions) * 1000).toLocaleString() : 0}원</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'funnel' && (
        <div className="funnel-content">
          <h3>🔻 광고 퍼널 분석</h3>
          
          <div className="funnel-chart-container">
            {getFunnelData().map((step, index) => {
              const widthPercent = index === 0 ? 100 : 
                (step.value / getFunnelData()[0].value * 100);
              const conversionRate = index > 0 ? 
                ((step.value / getFunnelData()[index - 1].value) * 100).toFixed(1) : 100;
              
              return (
                <div key={step.name} className="funnel-step">
                  <div className="funnel-bar-wrapper">
                    <div 
                      className="funnel-bar"
                      style={{ 
                        width: `${widthPercent}%`,
                        backgroundColor: step.fill
                      }}
                    >
                      <div className="funnel-info">
                        <span className="funnel-name">{step.name}</span>
                        <span className="funnel-value">{step.value.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  {index > 0 && (
                    <div className="conversion-rate">
                      ↓ 전환율: {conversionRate}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 퍼널 인사이트 */}
          <div className="funnel-insights">
            <h4>💡 퍼널 분석 인사이트</h4>
            <div className="insights-grid">
              <div className="insight-card">
                <strong>노출 → 클릭 (CTR)</strong>
                <span className="insight-value">{currentData.efficiency?.ctr || 0}%</span>
                <span className={`insight-status ${parseFloat(currentData.efficiency?.ctr) >= 2 ? 'good' : 'warning'}`}>
                  {parseFloat(currentData.efficiency?.ctr) >= 2 ? '양호' : '개선 필요'}
                </span>
              </div>
              <div className="insight-card">
                <strong>클릭 → 방문 전환율</strong>
                <span className="insight-value">{currentData.efficiency?.clickToVisit || 0}%</span>
                <span className={`insight-status ${parseFloat(currentData.efficiency?.clickToVisit) >= 50 ? 'good' : 'warning'}`}>
                  {parseFloat(currentData.efficiency?.clickToVisit) >= 50 ? '우수' : '개선 필요'}
                </span>
              </div>
              <div className="insight-card">
                <strong>방문당 페이지뷰</strong>
                <span className="insight-value">{currentData.efficiency?.avgPageviews || 0}</span>
                <span className={`insight-status ${parseFloat(currentData.efficiency?.avgPageviews) >= 2 ? 'good' : 'warning'}`}>
                  {parseFloat(currentData.efficiency?.avgPageviews) >= 2 ? '양호' : '개선 필요'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'trend' && (
        <div className="trend-content">
          <h3>📈 월별 트렌드 분석 (최근 6개월)</h3>
          
          {/* 광고비 & 방문자 트렌드 */}
          <div className="chart-section">
            <h4>광고비 vs 방문자 추이</h4>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value) => value.toLocaleString()} />
                <Legend />
                <Bar yAxisId="left" dataKey="광고비" fill={COLORS.meta} />
                <Line yAxisId="right" type="monotone" dataKey="방문자" stroke={COLORS.choho} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* CTR & CPC 트렌드 */}
          <div className="chart-section">
            <h4>노출 & 클릭 효율 추이</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString()} />
                <Legend />
                <Line type="monotone" dataKey="노출" stroke={COLORS.naver} strokeWidth={2} />
                <Line type="monotone" dataKey="클릭" stroke={COLORS.meta} strokeWidth={2} />
                <Line type="monotone" dataKey="페이지뷰" stroke={COLORS.shelter} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 개선 제안 */}
      <div className="recommendations">
        <h3>🚀 AI 기반 개선 제안</h3>
        <div className="recommendation-list">
          {currentData.efficiency?.cpv > 1000 && (
            <div className="recommendation-item warning">
              <span className="icon">⚠️</span>
              <div>
                <strong>높은 방문당 비용</strong>
                <p>CPV가 {currentData.efficiency?.cpv.toLocaleString()}원으로 높습니다. 
                타겟팅을 더 정교하게 설정하거나 광고 문구를 개선해보세요.</p>
              </div>
            </div>
          )}
          
          {parseFloat(currentData.efficiency?.ctr) < 2 && (
            <div className="recommendation-item info">
              <span className="icon">💡</span>
              <div>
                <strong>CTR 개선 필요</strong>
                <p>광고 클릭률이 {currentData.efficiency?.ctr}%로 낮습니다. 
                광고 이미지나 카피를 더 매력적으로 변경해보세요.</p>
              </div>
            </div>
          )}
          
          {parseFloat(currentData.efficiency?.clickToVisit) < 50 && (
            <div className="recommendation-item warning">
              <span className="icon">🔧</span>
              <div>
                <strong>랜딩 페이지 최적화 필요</strong>
                <p>클릭 후 실제 방문 전환율이 {currentData.efficiency?.clickToVisit}%로 낮습니다. 
                페이지 로딩 속도나 모바일 최적화를 점검해보세요.</p>
              </div>
            </div>
          )}
          
          {parseFloat(currentData.efficiency?.clickToVisit) > 70 && (
            <div className="recommendation-item success">
              <span className="icon">✅</span>
              <div>
                <strong>우수한 전환율</strong>
                <p>클릭 → 방문 전환율이 {currentData.efficiency?.clickToVisit}%로 매우 좋습니다. 
                현재 랜딩 페이지를 계속 유지하세요.</p>
              </div>
            </div>
          )}

          {dataMode === 'all' && integratedData.choho.efficiency?.cpv && integratedData.shelter.efficiency?.cpv && (
            <div className="recommendation-item info">
              <span className="icon">📊</span>
              <div>
                <strong>펜션별 효율 차이</strong>
                <p>초호 CPV: {integratedData.choho.efficiency.cpv.toLocaleString()}원 vs 
                   초호쉼터 CPV: {integratedData.shelter.efficiency.cpv.toLocaleString()}원<br/>
                   {integratedData.choho.efficiency.cpv < integratedData.shelter.efficiency.cpv ? 
                    '초호의 광고 효율이 더 좋습니다.' : '초호쉼터의 광고 효율이 더 좋습니다.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdEfficiencyDashboard;
