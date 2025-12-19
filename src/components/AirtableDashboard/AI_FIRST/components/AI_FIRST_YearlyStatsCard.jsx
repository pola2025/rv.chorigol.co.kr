/**
 * AI_FIRST_YearlyStatsCard.jsx
 * 연간 통계 카드 컴포넌트 (선언형)
 * useEffect 없이 React Query와 useMemo 활용
 */

import React, { useMemo } from 'react';
import { useYearlyStats } from '../hooks/AI_FIRST_hooks';
import { useCountUp, useIntersectionObserver } from '../hooks/AI_FIRST_utilHooks';
import { getCTRGrade, getCPCGrade } from '../utils/AI_FIRST_dataStructure';
import '../styles/AI_FIRST_YearlyStatsCard.css';

/**
 * 메트릭 카드 컴포넌트
 */
const MetricCard = ({ label, value, unit = '', change = null, format = 'number', animate = true }) => {
  const { targetRef, isIntersecting } = useIntersectionObserver({ threshold: 0.1 });
  
  // 숫자 포맷팅
  const formatValue = useMemo(() => {
    const numValue = Number(value) || 0;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('ko-KR', {
          style: 'currency',
          currency: 'KRW',
          maximumFractionDigits: 0
        }).format(numValue);
      case 'percent':
        return `${numValue.toFixed(2)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('ko-KR').format(numValue);
    }
  }, [value, format]);
  
  // 애니메이션 값
  const { count, startAnimation } = useCountUp(
    format === 'percent' ? Number(value) * 100 : Number(value),
    1000
  );
  
  // 인터섹션 시 애니메이션 시작 (선언형)
  useMemo(() => {
    if (isIntersecting && animate) {
      startAnimation();
    }
  }, [isIntersecting, animate, startAnimation]);
  
  // 변화율 표시
  const changeIndicator = useMemo(() => {
    if (change === null || change === 0) return null;
    
    const isPositive = change > 0;
    return (
      <span className={`metric-change ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
      </span>
    );
  }, [change]);
  
  return (
    <div className="ai-first-metric-card" ref={targetRef}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {animate && isIntersecting ? (
          format === 'currency' ? 
            `₩${new Intl.NumberFormat('ko-KR').format(count)}` :
          format === 'percent' ? 
            `${(count / 100).toFixed(2)}%` :
            new Intl.NumberFormat('ko-KR').format(count)
        ) : formatValue}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {changeIndicator}
    </div>
  );
};

/**
 * 연간 통계 요약 컴포넌트
 */
const YearlySummary = ({ data }) => {
  // 주요 지표 계산 (useMemo로 메모이제이션)
  const summaryMetrics = useMemo(() => {
    if (!data?.total) return null;
    
    const { total, averages } = data;
    
    // 전년 대비 계산 (실제로는 이전 년도 데이터와 비교 필요)
    const prevYearData = null; // TODO: 이전 년도 데이터 가져오기
    
    return {
      totalImpressions: {
        value: total.impressions,
        change: prevYearData ? 
          ((total.impressions - prevYearData.impressions) / prevYearData.impressions * 100) : null
      },
      totalClicks: {
        value: total.clicks,
        change: prevYearData ? 
          ((total.clicks - prevYearData.clicks) / prevYearData.clicks * 100) : null
      },
      totalAdCost: {
        value: total.adCost,
        change: prevYearData ? 
          ((total.adCost - prevYearData.adCost) / prevYearData.adCost * 100) : null
      },
      avgCTR: {
        value: averages.ctr,
        grade: getCTRGrade(averages.ctr)
      },
      avgCPC: {
        value: averages.cpc,
        grade: getCPCGrade(averages.cpc)
      },
      totalVisitors: {
        value: total.visitors,
        change: prevYearData ? 
          ((total.visitors - prevYearData.visitors) / prevYearData.visitors * 100) : null
      }
    };
  }, [data]);
  
  if (!summaryMetrics) return null;
  
  return (
    <div className="ai-first-yearly-summary">
      <div className="summary-grid">
        <MetricCard 
          label="총 노출수"
          value={summaryMetrics.totalImpressions.value}
          change={summaryMetrics.totalImpressions.change}
          animate
        />
        <MetricCard 
          label="총 클릭수"
          value={summaryMetrics.totalClicks.value}
          change={summaryMetrics.totalClicks.change}
          animate
        />
        <MetricCard 
          label="총 광고비"
          value={summaryMetrics.totalAdCost.value}
          format="currency"
          change={summaryMetrics.totalAdCost.change}
          animate
        />
        <MetricCard 
          label="총 방문자"
          value={summaryMetrics.totalVisitors.value}
          change={summaryMetrics.totalVisitors.change}
          animate
        />
      </div>
      
      <div className="efficiency-indicators">
        <div className="indicator-card ctr">
          <div className="indicator-header">
            <span className="indicator-label">평균 CTR</span>
            <span 
              className={`indicator-grade grade-${summaryMetrics.avgCTR.grade.grade}`}
              style={{ backgroundColor: summaryMetrics.avgCTR.grade.color }}
            >
              {summaryMetrics.avgCTR.grade.grade}
            </span>
          </div>
          <div className="indicator-value">
            {summaryMetrics.avgCTR.value.toFixed(2)}%
          </div>
          <div className="indicator-status">
            {summaryMetrics.avgCTR.grade.label}
          </div>
        </div>
        
        <div className="indicator-card cpc">
          <div className="indicator-header">
            <span className="indicator-label">평균 CPC</span>
            <span 
              className="indicator-level"
              style={{ color: summaryMetrics.avgCPC.grade.color }}
            >
              {summaryMetrics.avgCPC.grade.level}
            </span>
          </div>
          <div className="indicator-value">
            ₩{new Intl.NumberFormat('ko-KR').format(summaryMetrics.avgCPC.value)}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 월별 트렌드 미니 차트
 */
const MonthlyTrendChart = ({ data }) => {
  // 월별 데이터 변환 (useMemo로 메모이제이션)
  const chartData = useMemo(() => {
    if (!data?.monthly) return [];
    
    return Object.entries(data.monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        month: parseInt(key.split('-')[1]),
        ctr: value.ctr,
        clicks: value.clicks,
        adCost: value.adCost
      }));
  }, [data]);
  
  // 최대값 계산 (차트 스케일링용)
  const maxValues = useMemo(() => ({
    ctr: Math.max(...chartData.map(d => d.ctr), 1),
    clicks: Math.max(...chartData.map(d => d.clicks), 1),
    adCost: Math.max(...chartData.map(d => d.adCost), 1)
  }), [chartData]);
  
  return (
    <div className="ai-first-monthly-trend">
      <h4 className="trend-title">월별 트렌드</h4>
      <div className="trend-chart">
        <svg viewBox="0 0 360 100" className="trend-svg">
          {/* CTR 라인 */}
          <polyline
            className="trend-line ctr-line"
            points={chartData.map((item, index) => {
              const x = (index / (chartData.length - 1)) * 340 + 10;
              const y = 90 - (item.ctr / maxValues.ctr) * 80;
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke="#667eea"
            strokeWidth="2"
          />
          
          {/* 데이터 포인트 */}
          {chartData.map((item, index) => {
            const x = (index / (chartData.length - 1)) * 340 + 10;
            const y = 90 - (item.ctr / maxValues.ctr) * 80;
            
            return (
              <g key={item.month}>
                <circle
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#667eea"
                  className="trend-point"
                />
                <text
                  x={x}
                  y="98"
                  textAnchor="middle"
                  className="month-label"
                  fontSize="10"
                  fill="#999"
                >
                  {item.month}월
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      
      <div className="trend-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#667eea' }}></span>
          CTR 추이
        </span>
      </div>
    </div>
  );
};

/**
 * 연간 통계 카드 메인 컴포넌트
 */
const AI_FIRST_YearlyStatsCard = ({ year }) => {
  // React Query로 데이터 페칭 (선언형)
  const { data, isLoading, error } = useYearlyStats(year);
  
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="ai-first-yearly-stats-card loading">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-grid">
            {[1, 2, 3, 4].map(i => (
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
      <div className="ai-first-yearly-stats-card error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>연간 통계를 불러올 수 없습니다.</p>
          <small>{error.message}</small>
        </div>
      </div>
    );
  }
  
  // 데이터 없음
  if (!data) {
    return (
      <div className="ai-first-yearly-stats-card empty">
        <p>데이터가 없습니다.</p>
      </div>
    );
  }
  
  return (
    <div className="ai-first-yearly-stats-card">
      <div className="card-header">
        <h3 className="card-title">
          <span className="year-badge">{year}년</span>
          연간 광고 효율 통계
        </h3>
        <div className="card-actions">
          <button className="btn-export" title="내보내기">
            📊
          </button>
        </div>
      </div>
      
      <div className="card-body">
        <YearlySummary data={data} />
        <MonthlyTrendChart data={data} />
      </div>
      
      <div className="card-footer">
        <div className="footer-info">
          <span className="update-time">
            마지막 업데이트: {new Date().toLocaleString('ko-KR')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AI_FIRST_YearlyStatsCard;
