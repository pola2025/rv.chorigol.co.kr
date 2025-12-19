// 메트릭 그리드 컴포넌트 - 선언형 구조
import React from 'react';
import './ChartStyles.css';

// 메트릭 카드 컴포넌트 (순수 함수)
const MetricCard = ({ title, value, subtitle, icon, color = 'blue' }) => (
  <div className={`metric-card metric-${color}`}>
    <div className="metric-header">
      <span className="metric-icon">{icon}</span>
      <h4 className="metric-title">{title}</h4>
    </div>
    <div className="metric-value">{value}</div>
    {subtitle && <div className="metric-subtitle">{subtitle}</div>}
  </div>
);

// 메트릭 그리드 컴포넌트 (선언형)
const MetricsGrid = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="metrics-empty">
        <p>메트릭 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="metrics-grid">
      <MetricCard
        title="평균 월 매출"
        value={`₩${(metrics.avg_monthly_revenue || 0).toLocaleString()}`}
        subtitle="월 평균"
        icon="💰"
        color="blue"
      />
      <MetricCard
        title="평균 월 방문자"
        value={(metrics.avg_monthly_visitors || 0).toLocaleString()}
        subtitle="월 평균"
        icon="👥"
        color="green"
      />
      <MetricCard
        title="전체 ROAS"
        value={metrics.total_roas || '0.00'}
        subtitle="광고 효율"
        icon="📈"
        color="purple"
      />
      <MetricCard
        title="평균 전환율"
        value={`${metrics.avg_conversion_rate || '0.00'}%`}
        subtitle="방문자 → 예약"
        icon="🎯"
        color="orange"
      />
      {metrics.best_month && (
        <MetricCard
          title="최고 실적"
          value={`${metrics.best_month.month}월`}
          subtitle={`₩${(metrics.best_month.revenue_total || 0).toLocaleString()}`}
          icon="🏆"
          color="gold"
        />
      )}
      <MetricCard
        title="데이터 완성도"
        value={metrics.data_completeness || '0/12'}
        subtitle="입력된 월"
        icon="📊"
        color="gray"
      />
    </div>
  );
};

export default MetricsGrid;
