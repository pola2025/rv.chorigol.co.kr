/**
 * AI_FIRST_IntegratedMonthlyTable.jsx
 * 월별 통합 테이블 컴포넌트 (선언형)
 * useEffect 없이 useState + useMemo 조합
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useYearlyStats } from '../hooks/AI_FIRST_hooks';
import { getCTRGrade, getCPCGrade, getPlatformColor } from '../utils/AI_FIRST_dataStructure';
import '../styles/AI_FIRST_IntegratedMonthlyTable.css';

/**
 * 테이블 헤더 컴포넌트
 */
const TableHeader = ({ sortConfig, onSort }) => {
  const headers = [
    { key: 'month', label: '월', sortable: false },
    { key: 'impressions', label: '노출수', sortable: true },
    { key: 'clicks', label: '클릭수', sortable: true },
    { key: 'ctr', label: 'CTR (%)', sortable: true },
    { key: 'adCost', label: '광고비', sortable: true },
    { key: 'cpc', label: 'CPC', sortable: true },
    { key: 'visitors', label: '방문자', sortable: true },
    { key: 'efficiency', label: '효율성', sortable: true },
    { key: 'trend', label: '전월대비', sortable: false }
  ];
  
  return (
    <thead className="table-header">
      <tr>
        {headers.map(header => (
          <th 
            key={header.key}
            className={`header-cell ${header.sortable ? 'sortable' : ''} ${
              sortConfig.key === header.key ? `sorted-${sortConfig.direction}` : ''
            }`}
            onClick={header.sortable ? () => onSort(header.key) : undefined}
          >
            <div className="header-content">
              <span>{header.label}</span>
              {header.sortable && (
                <span className="sort-indicator">
                  {sortConfig.key === header.key ? (
                    sortConfig.direction === 'asc' ? '↑' : '↓'
                  ) : '↕'}
                </span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
};

/**
 * 트렌드 인디케이터 컴포넌트
 */
const TrendIndicator = ({ current, previous, format = 'number' }) => {
  const trend = useMemo(() => {
    if (!previous || previous === 0) return { value: 0, direction: 'stable' };
    
    const change = ((current - previous) / previous) * 100;
    let direction = 'stable';
    
    if (change > 5) direction = 'up';
    else if (change < -5) direction = 'down';
    
    return { value: change, direction };
  }, [current, previous]);
  
  if (trend.direction === 'stable') {
    return <span className="trend-indicator stable">→</span>;
  }
  
  return (
    <span className={`trend-indicator ${trend.direction}`}>
      {trend.direction === 'up' ? '↑' : '↓'}
      <span className="trend-value">
        {Math.abs(trend.value).toFixed(1)}%
      </span>
    </span>
  );
};

/**
 * 테이블 행 컴포넌트
 */
const TableRow = ({ data, previousData, isTotal = false, isCurrentMonth = false }) => {
  // CTR, CPC 등급 계산
  const ctrGrade = useMemo(() => getCTRGrade(data.ctr), [data.ctr]);
  const cpcGrade = useMemo(() => getCPCGrade(data.cpc), [data.cpc]);
  
  // 포맷팅 함수들
  const formatNumber = useCallback((num) => {
    return new Intl.NumberFormat('ko-KR').format(num || 0);
  }, []);
  
  const formatCurrency = useCallback((amount) => {
    return `₩${new Intl.NumberFormat('ko-KR').format(amount || 0)}`;
  }, []);
  
  const rowClassName = useMemo(() => {
    const classes = ['table-row'];
    if (isTotal) classes.push('total-row');
    if (isCurrentMonth) classes.push('current-month');
    return classes.join(' ');
  }, [isTotal, isCurrentMonth]);
  
  return (
    <tr className={rowClassName}>
      <td className="month-cell">
        {isTotal ? '합계' : `${data.month}월`}
      </td>
      <td className="number-cell">{formatNumber(data.impressions)}</td>
      <td className="number-cell">{formatNumber(data.clicks)}</td>
      <td className="ctr-cell">
        <span 
          className={`ctr-value grade-${ctrGrade.grade}`}
          style={{ color: ctrGrade.color }}
        >
          {data.ctr.toFixed(2)}%
        </span>
      </td>
      <td className="currency-cell">{formatCurrency(data.adCost)}</td>
      <td className="cpc-cell">
        <span 
          className="cpc-value"
          style={{ color: cpcGrade.color }}
        >
          {formatCurrency(data.cpc)}
        </span>
      </td>
      <td className="number-cell">{formatNumber(data.visitors)}</td>
      <td className="efficiency-cell">
        <div className="efficiency-wrapper">
          <div className="efficiency-bar">
            <div 
              className="efficiency-fill"
              style={{ 
                width: `${Math.min(data.efficiency / 10 * 100, 100)}%`,
                backgroundColor: '#667eea'
              }}
            />
          </div>
          <span className="efficiency-value">
            {data.efficiency.toFixed(1)}
          </span>
        </div>
      </td>
      <td className="trend-cell">
        {!isTotal && previousData && (
          <TrendIndicator 
            current={data.clicks} 
            previous={previousData.clicks}
          />
        )}
      </td>
    </tr>
  );
};

/**
 * 플랫폼별 분석 섹션
 */
const PlatformBreakdown = ({ platforms }) => {
  const platformData = useMemo(() => {
    if (!platforms) return [];
    
    return Object.entries(platforms)
      .map(([platform, data]) => ({
        platform,
        ...data,
        color: getPlatformColor(platform)
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [platforms]);
  
  if (platformData.length === 0) return null;
  
  return (
    <div className="platform-breakdown">
      <h4 className="breakdown-title">플랫폼별 성과</h4>
      <div className="platform-grid">
        {platformData.map(platform => (
          <div 
            key={platform.platform}
            className="platform-item"
            style={{ borderLeftColor: platform.color }}
          >
            <div className="platform-name">{platform.platform}</div>
            <div className="platform-metrics">
              <span>CTR: {platform.ctr.toFixed(2)}%</span>
              <span>CPC: ₩{new Intl.NumberFormat('ko-KR').format(platform.cpc)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 월별 통합 테이블 메인 컴포넌트
 */
const AI_FIRST_IntegratedMonthlyTable = ({ year }) => {
  // React Query로 데이터 페칭 (선언형)
  const { data, isLoading, error } = useYearlyStats(year);
  
  // 정렬 상태 (선언형)
  const [sortConfig, setSortConfig] = useState({ key: 'month', direction: 'asc' });
  
  // 필터 상태 (선언형)
  const [filterConfig, setFilterConfig] = useState({
    minCTR: 0,
    minClicks: 0,
    showOnlyPositiveTrend: false
  });
  
  // 현재 월
  const currentMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === year ? now.getMonth() + 1 : 0;
  }, [year]);
  
  // 월별 데이터 처리 (useMemo로 메모이제이션)
  const processedData = useMemo(() => {
    if (!data?.monthly) return { monthly: [], total: null };
    
    // 월별 데이터 배열로 변환
    const monthlyArray = Object.entries(data.monthly)
      .map(([key, value]) => ({
        ...value,
        month: parseInt(key.split('-')[1])
      }));
    
    // 필터링
    let filtered = monthlyArray.filter(item => {
      if (filterConfig.minCTR > 0 && item.ctr < filterConfig.minCTR) return false;
      if (filterConfig.minClicks > 0 && item.clicks < filterConfig.minClicks) return false;
      if (filterConfig.showOnlyPositiveTrend) {
        const prevMonth = monthlyArray.find(m => m.month === item.month - 1);
        if (prevMonth && item.clicks <= prevMonth.clicks) return false;
      }
      return true;
    });
    
    // 정렬
    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    // 합계 계산
    const total = filtered.reduce((acc, item) => ({
      month: '합계',
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      adCost: acc.adCost + item.adCost,
      visitors: acc.visitors + item.visitors,
      pageviews: acc.pageviews + item.pageviews,
      ctr: 0, // 계산 필요
      cpc: 0, // 계산 필요
      cpm: 0, // 계산 필요
      efficiency: 0 // 계산 필요
    }), {
      impressions: 0,
      clicks: 0,
      adCost: 0,
      visitors: 0,
      pageviews: 0
    });
    
    // 합계 메트릭 계산
    total.ctr = total.impressions > 0 ? (total.clicks / total.impressions * 100) : 0;
    total.cpc = total.clicks > 0 ? (total.adCost / total.clicks) : 0;
    total.cpm = total.impressions > 0 ? (total.adCost / total.impressions * 1000) : 0;
    total.efficiency = total.adCost > 0 ? (total.clicks / total.adCost * 1000) : 0;
    
    return { monthly: filtered, total };
  }, [data, sortConfig, filterConfig]);
  
  // 정렬 핸들러 (useCallback으로 메모이제이션)
  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  
  // 필터 핸들러
  const handleFilterChange = useCallback((key, value) => {
    setFilterConfig(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);
  
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="ai-first-monthly-table loading">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-rows">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="skeleton-row"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // 에러 상태
  if (error) {
    return (
      <div className="ai-first-monthly-table error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>월별 데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }
  
  // 데이터 없음
  if (!processedData.monthly.length) {
    return (
      <div className="ai-first-monthly-table empty">
        <p>표시할 데이터가 없습니다.</p>
      </div>
    );
  }
  
  return (
    <div className="ai-first-monthly-table">
      <div className="table-header-section">
        <h3 className="table-title">
          📅 {year}년 월별 광고 성과 통합
        </h3>
        
        {/* 필터 컨트롤 */}
        <div className="filter-controls">
          <div className="filter-item">
            <label>최소 CTR:</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={filterConfig.minCTR}
              onChange={(e) => handleFilterChange('minCTR', parseFloat(e.target.value))}
              className="filter-input"
            />
            <span className="filter-unit">%</span>
          </div>
          
          <div className="filter-item">
            <label>최소 클릭:</label>
            <input
              type="number"
              min="0"
              value={filterConfig.minClicks}
              onChange={(e) => handleFilterChange('minClicks', parseInt(e.target.value))}
              className="filter-input"
            />
          </div>
          
          <div className="filter-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={filterConfig.showOnlyPositiveTrend}
                onChange={(e) => handleFilterChange('showOnlyPositiveTrend', e.target.checked)}
              />
              상승 트렌드만
            </label>
          </div>
        </div>
      </div>
      
      <div className="table-wrapper">
        <table className="monthly-table">
          <TableHeader sortConfig={sortConfig} onSort={handleSort} />
          
          <tbody>
            {processedData.monthly.map((monthData, index) => {
              const prevMonthData = index > 0 ? processedData.monthly[index - 1] : null;
              
              return (
                <TableRow
                  key={monthData.month}
                  data={monthData}
                  previousData={prevMonthData}
                  isCurrentMonth={monthData.month === currentMonth}
                />
              );
            })}
            
            {/* 합계 행 */}
            {processedData.total && (
              <TableRow
                data={processedData.total}
                isTotal={true}
              />
            )}
          </tbody>
        </table>
      </div>
      
      {/* 플랫폼별 분석 */}
      {data?.platforms && (
        <PlatformBreakdown platforms={data.platforms} />
      )}
      
      {/* 테이블 푸터 */}
      <div className="table-footer">
        <div className="footer-stats">
          <span className="stat-item">
            표시된 항목: {processedData.monthly.length}개월
          </span>
          <span className="stat-item">
            평균 CTR: {(processedData.total.ctr).toFixed(2)}%
          </span>
          <span className="stat-item">
            평균 CPC: ₩{new Intl.NumberFormat('ko-KR').format(processedData.total.cpc)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AI_FIRST_IntegratedMonthlyTable;
