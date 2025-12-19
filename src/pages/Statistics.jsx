// 선언형 통계 페이지 - useEffect 완전 제거
import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '../../config/queryClient';
import { 
  useYearlyStatistics, 
  useDashboardSummary,
  useStatisticsComparison 
} from '../../hooks/useStatisticsV2';
import { RevenueChart, VisitorChart } from '../../components/charts/RevenueChart';
import MetricsGrid from '../../components/charts/MetricsGrid';
import ROASChart from '../../components/charts/ROASChart';
import './Statistics.css';

// 통계 페이지 컴포넌트 (선언형)
const StatisticsContent = () => {
  // 상태 선언 (선언형)
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedBusinessType, setSelectedBusinessType] = useState('pension');
  const [viewMode, setViewMode] = useState('charts'); // charts, metrics, comparison

  // 데이터 조회 (선언형 Hook 사용)
  const yearlyStats = useYearlyStatistics(selectedYear, selectedBusinessType);
  const dashboardSummary = useDashboardSummary(selectedYear);
  const comparison = useStatisticsComparison(selectedYear, selectedYear - 1, selectedBusinessType);

  // 로딩 상태 (선언형 렌더링)
  if (yearlyStats.isLoading) {
    return <StatisticsSkeleton />;
  }

  // 에러 상태 (선언형 렌더링)
  if (yearlyStats.isError) {
    return (
      <div className="error-container">
        <h3>데이터를 불러올 수 없습니다</h3>
        <p>{yearlyStats.error?.message}</p>
        <button onClick={() => yearlyStats.refetch()}>다시 시도</button>
      </div>
    );
  }

  // 메인 렌더링 (선언형)
  return (
    <div className="statistics-container">
      {/* 헤더 섹션 */}
      <div className="statistics-header">
        <h1>통계 대시보드</h1>
        <div className="statistics-controls">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="year-selector"
          >
            <option value={2024}>2024년</option>
            <option value={2023}>2023년</option>
            <option value={2022}>2022년</option>
          </select>
          
          <select 
            value={selectedBusinessType} 
            onChange={(e) => setSelectedBusinessType(e.target.value)}
            className="business-selector"
          >
            <option value="pension">초호펜션</option>
            <option value="shelter">초호쉼터</option>
            <option value="integrated">통합</option>
          </select>

          <div className="view-mode-tabs">
            <button 
              className={viewMode === 'charts' ? 'active' : ''}
              onClick={() => setViewMode('charts')}
            >
              차트
            </button>
            <button 
              className={viewMode === 'metrics' ? 'active' : ''}
              onClick={() => setViewMode('metrics')}
            >
              지표
            </button>
            <button 
              className={viewMode === 'comparison' ? 'active' : ''}
              onClick={() => setViewMode('comparison')}
            >
              비교
            </button>
          </div>
        </div>
      </div>

      {/* 요약 카드 섹션 */}
      <div className="summary-cards">
        <SummaryCard
          title="총 매출"
          value={`₩${(dashboardSummary.summary?.total_revenue || 0).toLocaleString()}`}
          trend={comparison.comparison?.revenue_growth}
          icon="💰"
        />
        <SummaryCard
          title="총 방문자"
          value={(dashboardSummary.summary?.total_visitors || 0).toLocaleString()}
          trend={comparison.comparison?.visitor_growth}
          icon="👥"
        />
        <SummaryCard
          title="총 예약"
          value={(dashboardSummary.summary?.total_bookings || 0).toLocaleString()}
          trend={null}
          icon="📅"
        />
        <SummaryCard
          title="ROAS"
          value={yearlyStats.metrics?.total_roas || '0.00'}
          trend={comparison.comparison?.roas_improvement}
          icon="📈"
        />
      </div>

      {/* 메인 콘텐츠 영역 (선언형 조건부 렌더링) */}
      <div className="statistics-content">
        {viewMode === 'charts' && (
          <ChartsView 
            revenueData={yearlyStats.chartData?.revenueChart}
            visitorData={yearlyStats.chartData?.visitorChart}
            roasData={yearlyStats.chartData?.roasChart}
            adEfficiencyData={yearlyStats.chartData?.adEfficiencyChart}
          />
        )}
        
        {viewMode === 'metrics' && (
          <MetricsView 
            metrics={yearlyStats.metrics}
            trends={yearlyStats.trends}
          />
        )}
        
        {viewMode === 'comparison' && (
          <ComparisonView 
            current={comparison.current}
            previous={comparison.previous}
            comparison={comparison.comparison}
          />
        )}
      </div>
    </div>
  );
};

// 차트 뷰 컴포넌트 (선언형)
const ChartsView = ({ revenueData, visitorData, roasData, adEfficiencyData }) => (
  <div className="charts-grid">
    <div className="chart-item full-width">
      <RevenueChart data={revenueData} />
    </div>
    <div className="chart-item full-width">
      <VisitorChart data={visitorData} />
    </div>
    <div className="chart-item">
      <ROASChart data={roasData} />
    </div>
    <div className="chart-item">
      <AdEfficiencyChart data={adEfficiencyData} />
    </div>
  </div>
);

// 지표 뷰 컴포넌트 (선언형)
const MetricsView = ({ metrics, trends }) => (
  <div className="metrics-view">
    <MetricsGrid metrics={metrics} />
    {trends && (
      <div className="trends-section">
        <h3>트렌드 분석</h3>
        <div className="trend-cards">
          <TrendCard 
            title="매출 트렌드"
            value={`${trends.revenue_trend}%`}
            direction={trends.revenue_trend_direction}
          />
          <TrendCard 
            title="방문자 트렌드"
            value={`${trends.visitor_trend}%`}
            direction={trends.visitor_trend > 0 ? 'up' : 'down'}
          />
          <TrendCard 
            title="전환율 변화"
            value={`${trends.conversion_trend}%p`}
            direction={trends.conversion_trend > 0 ? 'up' : 'down'}
          />
        </div>
      </div>
    )}
  </div>
);

// 비교 뷰 컴포넌트 (선언형)
const ComparisonView = ({ current, previous, comparison }) => (
  <div className="comparison-view">
    <div className="comparison-header">
      <h3>전년 대비 성과 비교</h3>
    </div>
    {comparison && (
      <div className="comparison-grid">
        <ComparisonCard
          metric="평균 월 매출"
          current={current.metrics?.avg_monthly_revenue}
          previous={previous.metrics?.avg_monthly_revenue}
          growth={comparison.revenue_growth}
        />
        <ComparisonCard
          metric="평균 월 방문자"
          current={current.metrics?.avg_monthly_visitors}
          previous={previous.metrics?.avg_monthly_visitors}
          growth={comparison.visitor_growth}
        />
        <ComparisonCard
          metric="ROAS"
          current={current.metrics?.total_roas}
          previous={previous.metrics?.total_roas}
          growth={comparison.roas_improvement}
        />
        <ComparisonCard
          metric="전환율"
          current={current.metrics?.avg_conversion_rate}
          previous={previous.metrics?.avg_conversion_rate}
          growth={comparison.conversion_improvement}
        />
      </div>
    )}
  </div>
);

// 요약 카드 컴포넌트 (선언형)
const SummaryCard = ({ title, value, trend, icon }) => (
  <div className="summary-card">
    <div className="summary-icon">{icon}</div>
    <div className="summary-content">
      <h4>{title}</h4>
      <p className="summary-value">{value}</p>
      {trend && (
        <span className={`trend ${trend > 0 ? 'positive' : 'negative'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  </div>
);

// 트렌드 카드 컴포넌트 (선언형)
const TrendCard = ({ title, value, direction }) => (
  <div className={`trend-card ${direction}`}>
    <h4>{title}</h4>
    <p className="trend-value">
      {direction === 'up' ? '📈' : '📉'} {value}
    </p>
  </div>
);

// 비교 카드 컴포넌트 (선언형)
const ComparisonCard = ({ metric, current, previous, growth }) => (
  <div className="comparison-card">
    <h4>{metric}</h4>
    <div className="comparison-values">
      <div className="previous-value">
        <span className="label">이전</span>
        <span className="value">{previous || '-'}</span>
      </div>
      <div className="arrow">→</div>
      <div className="current-value">
        <span className="label">현재</span>
        <span className="value">{current || '-'}</span>
      </div>
    </div>
    {growth && (
      <div className={`growth ${growth > 0 ? 'positive' : 'negative'}`}>
        {growth > 0 ? '+' : ''}{growth}%
      </div>
    )}
  </div>
);

// 스켈레톤 로더 컴포넌트 (선언형)
const StatisticsSkeleton = () => (
  <div className="statistics-skeleton">
    <div className="skeleton-header" />
    <div className="skeleton-cards">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
    <div className="skeleton-content">
      <div className="skeleton-chart" />
      <div className="skeleton-chart" />
    </div>
  </div>
);

// 메인 Statistics 컴포넌트 (Provider 포함)
const Statistics = () => (
  <QueryClientProvider client={queryClient}>
    <StatisticsContent />
    {process.env.NODE_ENV === 'development' && (
      <ReactQueryDevtools initialIsOpen={false} />
    )}
  </QueryClientProvider>
);

export default Statistics;
