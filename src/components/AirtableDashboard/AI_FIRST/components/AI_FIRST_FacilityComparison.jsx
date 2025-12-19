/**
 * AI_FIRST_FacilityComparison.jsx
 * 초호/초호쉼터 비교 컴포넌트 (선언형)
 * useEffect 없이 순수 선언형 렌더링
 */

import React, { useMemo } from 'react';
import { useMonthlyStats } from '../hooks/AI_FIRST_hooks';
import { useCountUp, useIntersectionObserver } from '../hooks/AI_FIRST_utilHooks';
import { calculateMetrics } from '../utils/AI_FIRST_dataStructure';
import '../styles/AI_FIRST_FacilityComparison.css';

/**
 * 시설 메트릭 아이템
 */
const FacilityMetricItem = ({ label, value, format = 'number', highlight = false }) => {
  const formattedValue = useMemo(() => {
    const numValue = Number(value) || 0;
    
    switch (format) {
      case 'currency':
        return `₩${new Intl.NumberFormat('ko-KR').format(numValue)}`;
      case 'percent':
        return `${numValue.toFixed(2)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('ko-KR').format(numValue);
    }
  }, [value, format]);
  
  return (
    <div className="facility-metric-item">
      <label className="metric-label">{label}</label>
      <span className={`metric-value ${highlight ? 'highlight' : ''}`}>
        {formattedValue}
      </span>
    </div>
  );
};

/**
 * 시설 카드 컴포넌트
 */
const FacilityCard = ({ 
  facility, 
  data, 
  icon, 
  title, 
  subtitle,
  accentColor,
  isTotal = false 
}) => {
  const { targetRef, isIntersecting } = useIntersectionObserver({ threshold: 0.1 });
  
  // 애니메이션 값들
  const impressionsCount = useCountUp(data.impressions, 1000);
  const clicksCount = useCountUp(data.clicks, 1000);
  const visitorsCount = useCountUp(data.visitors, 1000);
  
  // 애니메이션 시작 (선언형)
  useMemo(() => {
    if (isIntersecting) {
      impressionsCount.startAnimation();
      clicksCount.startAnimation();
      visitorsCount.startAnimation();
    }
  }, [isIntersecting]);
  
  const cardClassName = useMemo(() => {
    return `ai-first-facility-card ${facility} ${isTotal ? 'total' : ''}`;
  }, [facility, isTotal]);
  
  return (
    <div className={cardClassName} ref={targetRef}>
      <div className="facility-header" style={{ borderBottomColor: isTotal ? 'rgba(255,255,255,0.2)' : accentColor }}>
        <span className="facility-icon">{icon}</span>
        <div className="facility-title-group">
          <span className="facility-title">{title}</span>
          {subtitle && <span className="facility-subtitle">{subtitle}</span>}
        </div>
      </div>
      
      <div className="facility-metrics">
        <div className="metric-row">
          <FacilityMetricItem 
            label="노출수" 
            value={isIntersecting ? impressionsCount.count : data.impressions}
          />
          <FacilityMetricItem 
            label="클릭수" 
            value={isIntersecting ? clicksCount.count : data.clicks}
          />
        </div>
        
        <div className="metric-row">
          <FacilityMetricItem 
            label="광고비" 
            value={data.adCost}
            format="currency"
          />
          <FacilityMetricItem 
            label="CTR" 
            value={data.ctr}
            format="percent"
            highlight
          />
        </div>
        
        <div className="metric-row">
          <FacilityMetricItem 
            label="CPC" 
            value={data.cpc}
            format="currency"
          />
          <FacilityMetricItem 
            label="방문자" 
            value={isIntersecting ? visitorsCount.count : data.visitors}
          />
        </div>
      </div>
      
      {/* 효율성 바 */}
      <div className="efficiency-bar-container">
        <div className="efficiency-label">효율성</div>
        <div className="efficiency-bar">
          <div 
            className="efficiency-fill"
            style={{ 
              width: `${Math.min(data.efficiency / 10 * 100, 100)}%`,
              backgroundColor: isTotal ? '#fff' : accentColor
            }}
          />
        </div>
        <div className="efficiency-value">
          {data.efficiency.toFixed(1)} 클릭/천원
        </div>
      </div>
    </div>
  );
};

/**
 * 비교 인사이트 컴포넌트
 */
const ComparisonInsights = ({ chohoData, shelterData }) => {
  // 인사이트 계산 (useMemo로 메모이제이션)
  const insights = useMemo(() => {
    const chohoCTR = Number(chohoData.ctr) || 0;
    const shelterCTR = Number(shelterData.ctr) || 0;
    const chohoCPC = Number(chohoData.cpc) || 0;
    const shelterCPC = Number(shelterData.cpc) || 0;
    const chohoEfficiency = Number(chohoData.efficiency) || 0;
    const shelterEfficiency = Number(shelterData.efficiency) || 0;
    
    return {
      betterCTR: chohoCTR > shelterCTR ? '초호' : '초호쉼터',
      ctrDiff: Math.abs(chohoCTR - shelterCTR),
      betterCPC: chohoCPC < shelterCPC ? '초호' : '초호쉼터',
      cpcDiff: Math.abs(chohoCPC - shelterCPC),
      betterEfficiency: chohoEfficiency > shelterEfficiency ? '초호' : '초호쉼터',
      efficiencyDiff: Math.abs(chohoEfficiency - shelterEfficiency)
    };
  }, [chohoData, shelterData]);
  
  return (
    <div className="ai-first-comparison-insights">
      <h4 className="insights-title">📊 비교 인사이트</h4>
      <div className="insights-grid">
        <div className="insight-item">
          <div className="insight-label">CTR 우위</div>
          <div className="insight-value">
            <strong>{insights.betterCTR}</strong>
            <span className="insight-diff">
              (+{insights.ctrDiff.toFixed(2)}%)
            </span>
          </div>
        </div>
        
        <div className="insight-item">
          <div className="insight-label">CPC 효율</div>
          <div className="insight-value">
            <strong>{insights.betterCPC}</strong>
            <span className="insight-diff">
              (₩{new Intl.NumberFormat('ko-KR').format(insights.cpcDiff)} 절감)
            </span>
          </div>
        </div>
        
        <div className="insight-item">
          <div className="insight-label">종합 효율성</div>
          <div className="insight-value">
            <strong>{insights.betterEfficiency}</strong>
            <span className="insight-diff">
              (+{insights.efficiencyDiff.toFixed(1)} 클릭/천원)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 시설 비교 메인 컴포넌트
 */
const AI_FIRST_FacilityComparison = ({ year, month }) => {
  // React Query로 데이터 페칭 (선언형)
  const { data, isLoading, error } = useMonthlyStats(year, month);
  
  // 시설별 데이터 계산 (useMemo로 메모이제이션)
  const facilityData = useMemo(() => {
    if (!data?.facilityStats) return null;
    
    const { choho, shelter } = data.facilityStats;
    
    // 전체 통계 계산
    const total = calculateMetrics({
      impressions: (choho.impressions || 0) + (shelter.impressions || 0),
      clicks: (choho.clicks || 0) + (shelter.clicks || 0),
      adCost: (choho.adCost || 0) + (shelter.adCost || 0),
      visitors: (choho.visitors || 0) + (shelter.visitors || 0),
      pageviews: (choho.pageviews || 0) + (shelter.pageviews || 0)
    });
    
    return {
      choho: calculateMetrics(choho),
      shelter: calculateMetrics(shelter),
      total
    };
  }, [data]);
  
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="ai-first-facility-comparison loading">
        <div className="loading-skeleton">
          <div className="skeleton-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-card"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // 에러 상태
  if (error) {
    return (
      <div className="ai-first-facility-comparison error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>시설 데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }
  
  // 데이터 없음
  if (!facilityData) {
    return (
      <div className="ai-first-facility-comparison empty">
        <p>데이터가 없습니다.</p>
      </div>
    );
  }
  
  return (
    <div className="ai-first-facility-comparison">
      <div className="comparison-header">
        <h3 className="comparison-title">
          🏘️ 초호/초호쉼터 광고 성과 비교
        </h3>
        <div className="period-badge">
          {year}년 {month}월
        </div>
      </div>
      
      <div className="facility-cards-grid">
        <FacilityCard
          facility="choho"
          data={facilityData.choho}
          icon="🏠"
          title="초호 펜션"
          subtitle="홈페이지 · 플레이스 · 네이버광고"
          accentColor="#4CAF50"
        />
        
        <FacilityCard
          facility="shelter"
          data={facilityData.shelter}
          icon="🏡"
          title="초호 쉼터"
          subtitle="홈페이지 · 플레이스 · Meta"
          accentColor="#2196F3"
        />
        
        <FacilityCard
          facility="total"
          data={facilityData.total}
          icon="📊"
          title="전체 통합"
          subtitle="모든 플랫폼"
          accentColor="#667eea"
          isTotal
        />
      </div>
      
      <ComparisonInsights 
        chohoData={facilityData.choho}
        shelterData={facilityData.shelter}
      />
    </div>
  );
};

export default AI_FIRST_FacilityComparison;
