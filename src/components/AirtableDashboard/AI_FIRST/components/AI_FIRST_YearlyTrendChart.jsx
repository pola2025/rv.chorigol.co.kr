/**
 * AI_FIRST_YearlyTrendChart.jsx
 * 연간 트렌드 라인차트 컴포넌트 (선언형)
 * Recharts 활용, useEffect 없이 구현
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Bar
} from 'recharts';
import { useYearlyStats } from '../hooks/AI_FIRST_hooks';
import '../styles/AI_FIRST_YearlyTrendChart.css';

/**
 * 커스텀 툴팁 컴포넌트
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className="chart-custom-tooltip">
      <div className="tooltip-header">{label}</div>
      <div className="tooltip-content">
        {payload.map((entry, index) => (
          <div key={index} className="tooltip-item">
            <span 
              className="tooltip-dot" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="tooltip-label">{entry.name}:</span>
            <span className="tooltip-value">
              {entry.name === 'CTR' || entry.name === 'CPM' 
                ? `${entry.value.toFixed(2)}%`
                : entry.name === 'CPC' || entry.name === '광고비'
                ? `₩${new Intl.NumberFormat('ko-KR').format(entry.value)}`
                : new Intl.NumberFormat('ko-KR').format(entry.value)
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 메트릭 선택 컴포넌트
 */
const MetricSelector = ({ selectedMetrics, onToggle }) => {
  const metrics = [
    { key: 'impressions', label: '노출수', color: '#8884d8' },
    { key: 'clicks', label: '클릭수', color: '#82ca9d' },
    { key: 'ctr', label: 'CTR', color: '#ffc658' },
    { key: 'adCost', label: '광고비', color: '#ff7c7c' },
    { key: 'cpc', label: 'CPC', color: '#8dd1e1' },
    { key: 'visitors', label: '방문자', color: '#d084d0' }
  ];
  
  return (
    <div className="metric-selector">
      {metrics.map(metric => (
        <label key={metric.key} className="metric-checkbox">
          <input
            type="checkbox"
            checked={selectedMetrics.includes(metric.key)}
            onChange={() => onToggle(metric.key)}
          />
          <span 
            className="metric-label"
            style={{ color: metric.color }}
          >
            {metric.label}
          </span>
        </label>
      ))}
    </div>
  );
};

/**
 * 차트 타입 선택 컴포넌트
 */
const ChartTypeSelector = ({ chartType, onChange }) => {
  const types = [
    { value: 'line', label: '라인 차트', icon: '📈' },
    { value: 'area', label: '영역 차트', icon: '📊' },
    { value: 'composed', label: '복합 차트', icon: '📉' }
  ];
  
  return (
    <div className="chart-type-selector">
      {types.map(type => (
        <button
          key={type.value}
          className={`type-btn ${chartType === type.value ? 'active' : ''}`}
          onClick={() => onChange(type.value)}
        >
          <span className="type-icon">{type.icon}</span>
          <span className="type-label">{type.label}</span>
        </button>
      ))}
    </div>
  );
};

/**
 * 기간 비교 인사이트
 */
const PeriodComparison = ({ data }) => {
  const insights = useMemo(() => {
    if (!data || data.length < 2) return null;
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const avgFirst = {
      ctr: firstHalf.reduce((sum, d) => sum + d.ctr, 0) / firstHalf.length,
      clicks: firstHalf.reduce((sum, d) => sum + d.clicks, 0) / firstHalf.length,
      adCost: firstHalf.reduce((sum, d) => sum + d.adCost, 0) / firstHalf.length
    };
    
    const avgSecond = {
      ctr: secondHalf.reduce((sum, d) => sum + d.ctr, 0) / secondHalf.length,
      clicks: secondHalf.reduce((sum, d) => sum + d.clicks, 0) / secondHalf.length,
      adCost: secondHalf.reduce((sum, d) => sum + d.adCost, 0) / secondHalf.length
    };
    
    return {
      ctrChange: ((avgSecond.ctr - avgFirst.ctr) / avgFirst.ctr * 100),
      clicksChange: ((avgSecond.clicks - avgFirst.clicks) / avgFirst.clicks * 100),
      costChange: ((avgSecond.adCost - avgFirst.adCost) / avgFirst.adCost * 100)
    };
  }, [data]);
  
  if (!insights) return null;
  
  return (
    <div className="period-comparison">
      <h4>📊 기간 비교 분석</h4>
      <div className="comparison-grid">
        <div className="comparison-item">
          <span className="comparison-label">CTR 변화</span>
          <span className={`comparison-value ${insights.ctrChange > 0 ? 'positive' : 'negative'}`}>
            {insights.ctrChange > 0 ? '↑' : '↓'} {Math.abs(insights.ctrChange).toFixed(1)}%
          </span>
        </div>
        <div className="comparison-item">
          <span className="comparison-label">클릭수 변화</span>
          <span className={`comparison-value ${insights.clicksChange > 0 ? 'positive' : 'negative'}`}>
            {insights.clicksChange > 0 ? '↑' : '↓'} {Math.abs(insights.clicksChange).toFixed(1)}%
          </span>
        </div>
        <div className="comparison-item">
          <span className="comparison-label">광고비 변화</span>
          <span className={`comparison-value ${insights.costChange > 0 ? 'negative' : 'positive'}`}>
            {insights.costChange > 0 ? '↑' : '↓'} {Math.abs(insights.costChange).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * 연간 트렌드 차트 메인 컴포넌트
 */
const AI_FIRST_YearlyTrendChart = ({ year }) => {
  // React Query로 데이터 페칭
  const { data, isLoading, error } = useYearlyStats(year);
  
  // 선택된 메트릭 상태
  const [selectedMetrics, setSelectedMetrics] = useState(['clicks', 'ctr']);
  
  // 차트 타입 상태
  const [chartType, setChartType] = useState('line');
  
  // 차트 데이터 변환 (useMemo로 메모이제이션)
  const chartData = useMemo(() => {
    if (!data?.monthly) return [];
    
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', 
                   '7월', '8월', '9월', '10월', '11월', '12월'];
    
    return months.map((month, index) => {
      const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
      const monthData = data.monthly[monthKey] || {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        adCost: 0,
        cpc: 0,
        visitors: 0
      };
      
      return {
        month,
        ...monthData
      };
    });
  }, [data, year]);
  
  // 메트릭 토글 핸들러
  const handleMetricToggle = useCallback((metric) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metric)) {
        return prev.filter(m => m !== metric);
      } else {
        return [...prev, metric];
      }
    });
  }, []);
  
  // Y축 도메인 계산
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    
    let maxValue = 0;
    selectedMetrics.forEach(metric => {
      const max = Math.max(...chartData.map(d => d[metric] || 0));
      if (max > maxValue) maxValue = max;
    });
    
    return [0, Math.ceil(maxValue * 1.1)];
  }, [chartData, selectedMetrics]);
  
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="ai-first-trend-chart loading">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-chart"></div>
        </div>
      </div>
    );
  }
  
  // 에러 상태
  if (error) {
    return (
      <div className="ai-first-trend-chart error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>차트 데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }
  
  // 차트 렌더링 함수
  const renderChart = useMemo(() => {
    const metricConfig = {
      impressions: { color: '#8884d8', label: '노출수' },
      clicks: { color: '#82ca9d', label: '클릭수' },
      ctr: { color: '#ffc658', label: 'CTR (%)' },
      adCost: { color: '#ff7c7c', label: '광고비' },
      cpc: { color: '#8dd1e1', label: 'CPC' },
      visitors: { color: '#d084d0', label: '방문자' }
    };
    
    switch (chartType) {
      case 'area':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#666" />
            <YAxis domain={yAxisDomain} stroke="#666" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {selectedMetrics.map(metric => (
              <Area
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={metricConfig[metric].color}
                fill={metricConfig[metric].color}
                fillOpacity={0.3}
                strokeWidth={2}
                name={metricConfig[metric].label}
              />
            ))}
          </LineChart>
        );
        
      case 'composed':
        return (
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#666" />
            <YAxis yAxisId="left" domain={yAxisDomain} stroke="#666" />
            <YAxis yAxisId="right" orientation="right" stroke="#666" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {selectedMetrics.includes('adCost') && (
              <Bar
                yAxisId="left"
                dataKey="adCost"
                fill="#ff7c7c"
                fillOpacity={0.6}
                name="광고비"
              />
            )}
            {selectedMetrics.filter(m => m !== 'adCost').map(metric => (
              <Line
                key={metric}
                yAxisId={metric === 'ctr' ? 'right' : 'left'}
                type="monotone"
                dataKey={metric}
                stroke={metricConfig[metric].color}
                strokeWidth={2}
                dot={{ r: 4 }}
                name={metricConfig[metric].label}
              />
            ))}
          </ComposedChart>
        );
        
      default: // line
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#666" />
            <YAxis domain={yAxisDomain} stroke="#666" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {selectedMetrics.map(metric => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={metricConfig[metric].color}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={metricConfig[metric].label}
              />
            ))}
          </LineChart>
        );
    }
  }, [chartType, chartData, selectedMetrics, yAxisDomain]);
  
  return (
    <div className="ai-first-trend-chart">
      <div className="chart-header">
        <h3 className="chart-title">
          📈 {year}년 월별 트렌드 분석
        </h3>
        <ChartTypeSelector 
          chartType={chartType}
          onChange={setChartType}
        />
      </div>
      
      <MetricSelector 
        selectedMetrics={selectedMetrics}
        onToggle={handleMetricToggle}
      />
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          {renderChart}
        </ResponsiveContainer>
      </div>
      
      <PeriodComparison data={chartData} />
    </div>
  );
};

export default AI_FIRST_YearlyTrendChart;
