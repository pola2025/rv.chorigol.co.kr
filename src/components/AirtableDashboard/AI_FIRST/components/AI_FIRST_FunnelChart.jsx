/**
 * AI_FIRST_FunnelChart.jsx
 * 전환 퍼널 차트 컴포넌트 (선언형)
 * useEffect 없이 구현
 */

import React, { useMemo, useState } from 'react';
import { 
  FunnelChart as RechartsF


,
  Funnel,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { useMonthlyStats } from '../hooks/AI_FIRST_hooks';
import '../styles/AI_FIRST_FunnelChart.css';

/**
 * 커스텀 라벨 컴포넌트
 */
const CustomLabel = ({ x, y, width, height, value, name, percentage }) => {
  return (
    <g>
      <text 
        x={x + width / 2} 
        y={y + height / 2 - 10}
        fill="#fff"
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
      >
        {name}
      </text>
      <text 
        x={x + width / 2} 
        y={y + height / 2 + 10}
        fill="#fff"
        textAnchor="middle"
        fontSize="12"
      >
        {new Intl.NumberFormat('ko-KR').format(value)}
      </text>
      <text 
        x={x + width / 2} 
        y={y + height / 2 + 28}
        fill="#fff"
        textAnchor="middle"
        fontSize="11"
        opacity="0.9"
      >
        ({percentage}%)
      </text>
    </g>
  );
};

/**
 * 전환율 카드 컴포넌트
 */
const ConversionCard = ({ from, to, rate, count, icon }) => {
  const rateColor = useMemo(() => {
    if (rate >= 80) return '#28a745';
    if (rate >= 60) return '#17a2b8';
    if (rate >= 40) return '#ffc107';
    if (rate >= 20) return '#fd7e14';
    return '#dc3545';
  }, [rate]);
  
  return (
    <div className="conversion-card">
      <div className="conversion-header">
        <span className="conversion-icon">{icon}</span>
        <span className="conversion-path">{from} → {to}</span>
      </div>
      <div className="conversion-metrics">
        <div className="conversion-rate" style={{ color: rateColor }}>
          {rate.toFixed(1)}%
        </div>
        <div className="conversion-count">
          {new Intl.NumberFormat('ko-KR').format(count)} 전환
        </div>
      </div>
      <div className="conversion-bar">
        <div 
          className="conversion-fill"
          style={{ 
            width: `${rate}%`,
            backgroundColor: rateColor
          }}
        />
      </div>
    </div>
  );
};

/**
 * 퍼널 단계별 분석
 */
const StageAnalysis = ({ data }) => {
  const analysis = useMemo(() => {
    if (!data || data.length < 2) return [];
    
    const results = [];
    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const next = data[i + 1];
      const dropRate = ((current.value - next.value) / current.value * 100);
      
      results.push({
        from: current.name,
        to: next.name,
        dropRate,
        retained: next.value,
        lost: current.value - next.value
      });
    }
    
    return results;
  }, [data]);
  
  return (
    <div className="stage-analysis">
      <h4 className="analysis-title">📉 단계별 이탈 분석</h4>
      <div className="analysis-grid">
        {analysis.map((stage, index) => (
          <div key={index} className="stage-item">
            <div className="stage-header">
              <span className="stage-from">{stage.from}</span>
              <span className="stage-arrow">→</span>
              <span className="stage-to">{stage.to}</span>
            </div>
            <div className="stage-metrics">
              <div className="metric-item">
                <span className="metric-label">이탈율</span>
                <span className="metric-value negative">
                  {stage.dropRate.toFixed(1)}%
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">이탈수</span>
                <span className="metric-value">
                  {new Intl.NumberFormat('ko-KR').format(stage.lost)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 퍼널 최적화 제안
 */
const OptimizationSuggestions = ({ funnelData }) => {
  const suggestions = useMemo(() => {
    if (!funnelData || funnelData.length === 0) return [];
    
    const results = [];
    
    // 첫 단계 전환율 체크
    if (funnelData.length >= 2) {
      const firstConversion = (funnelData[1].value / funnelData[0].value) * 100;
      if (firstConversion < 30) {
        results.push({
          type: 'critical',
          stage: '노출 → 클릭',
          message: '광고 문구나 타겟팅 개선이 필요합니다.',
          icon: '🚨'
        });
      }
    }
    
    // 중간 단계 체크
    if (funnelData.length >= 3) {
      const midConversion = (funnelData[2].value / funnelData[1].value) * 100;
      if (midConversion < 50) {
        results.push({
          type: 'warning',
          stage: '클릭 → 방문',
          message: '랜딩 페이지 로딩 속도를 확인하세요.',
          icon: '⚠️'
        });
      }
    }
    
    // 최종 전환 체크
    if (funnelData.length >= 4) {
      const finalConversion = (funnelData[3].value / funnelData[2].value) * 100;
      if (finalConversion < 10) {
        results.push({
          type: 'info',
          stage: '방문 → 예약',
          message: '예약 프로세스 간소화를 고려하세요.',
          icon: 'ℹ️'
        });
      }
    }
    
    return results;
  }, [funnelData]);
  
  if (suggestions.length === 0) return null;
  
  return (
    <div className="optimization-suggestions">
      <h4 className="suggestions-title">💡 최적화 제안</h4>
      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => (
          <div 
            key={index} 
            className={`suggestion-item ${suggestion.type}`}
          >
            <span className="suggestion-icon">{suggestion.icon}</span>
            <div className="suggestion-content">
              <div className="suggestion-stage">{suggestion.stage}</div>
              <div className="suggestion-message">{suggestion.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 퍼널 차트 메인 컴포넌트
 */
const AI_FIRST_FunnelChart = ({ year, month }) => {
  // React Query로 데이터 페칭
  const { data, isLoading, error } = useMonthlyStats(year, month);
  
  // 퍼널 타입 상태
  const [funnelType, setFunnelType] = useState('marketing');
  
  // 퍼널 데이터 변환 (useMemo로 메모이제이션)
  const funnelData = useMemo(() => {
    if (!data) return [];
    
    if (funnelType === 'marketing') {
      // 마케팅 퍼널
      return [
        { 
          name: '노출', 
          value: data.impressions || 0,
          fill: '#8884d8'
        },
        { 
          name: '클릭', 
          value: data.clicks || 0,
          fill: '#83a6ed'
        },
        { 
          name: '방문', 
          value: data.visitors || 0,
          fill: '#8dd1e1'
        },
        { 
          name: '문의', 
          value: Math.floor((data.visitors || 0) * 0.15),
          fill: '#82ca9d'
        },
        { 
          name: '예약', 
          value: Math.floor((data.visitors || 0) * 0.08),
          fill: '#ffc658'
        }
      ];
    } else {
      // 사용자 행동 퍼널
      return [
        { 
          name: '홈페이지', 
          value: data.pageviews || 0,
          fill: '#ff7c7c'
        },
        { 
          name: '객실정보', 
          value: Math.floor((data.pageviews || 0) * 0.6),
          fill: '#ff9f40'
        },
        { 
          name: '예약확인', 
          value: Math.floor((data.pageviews || 0) * 0.3),
          fill: '#ffcd56'
        },
        { 
          name: '결제', 
          value: Math.floor((data.pageviews || 0) * 0.15),
          fill: '#c9cbcf'
        },
        { 
          name: '완료', 
          value: Math.floor((data.pageviews || 0) * 0.08),
          fill: '#4bc0c0'
        }
      ];
    }
  }, [data, funnelType]);
  
  // 전환율 계산
  const conversionRates = useMemo(() => {
    if (funnelData.length === 0) return [];
    
    const rates = [];
    const initial = funnelData[0].value;
    
    for (let i = 1; i < funnelData.length; i++) {
      rates.push({
        from: funnelData[i-1].name,
        to: funnelData[i].name,
        rate: (funnelData[i].value / funnelData[i-1].value) * 100,
        count: funnelData[i].value,
        icon: i === funnelData.length - 1 ? '🎯' : '→'
      });
    }
    
    // 전체 전환율
    if (funnelData.length > 1) {
      rates.push({
        from: funnelData[0].name,
        to: funnelData[funnelData.length - 1].name,
        rate: (funnelData[funnelData.length - 1].value / initial) * 100,
        count: funnelData[funnelData.length - 1].value,
        icon: '🏆'
      });
    }
    
    return rates;
  }, [funnelData]);
  
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="ai-first-funnel-chart loading">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-funnel"></div>
        </div>
      </div>
    );
  }
  
  // 에러 상태
  if (error) {
    return (
      <div className="ai-first-funnel-chart error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>퍼널 데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="ai-first-funnel-chart">
      <div className="funnel-header">
        <h3 className="funnel-title">
          🔻 {year}년 {month}월 전환 퍼널 분석
        </h3>
        
        <div className="funnel-type-selector">
          <button 
            className={`type-btn ${funnelType === 'marketing' ? 'active' : ''}`}
            onClick={() => setFunnelType('marketing')}
          >
            마케팅 퍼널
          </button>
          <button 
            className={`type-btn ${funnelType === 'behavior' ? 'active' : ''}`}
            onClick={() => setFunnelType('behavior')}
          >
            행동 퍼널
          </button>
        </div>
      </div>
      
      <div className="funnel-container">
        <ResponsiveContainer width="100%" height={400}>
          <FunnelChart>
            <Tooltip />
            <Funnel
              dataKey="value"
              data={funnelData}
              isAnimationActive
              labelLine
            >
              {funnelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList 
                position="center" 
                content={(props) => {
                  const { value, name } = props;
                  const total = funnelData[0].value;
                  const percentage = ((value / total) * 100).toFixed(1);
                  return (
                    <CustomLabel 
                      {...props} 
                      percentage={percentage}
                    />
                  );
                }}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
      
      <div className="conversion-rates">
        <h4 className="rates-title">전환율 상세</h4>
        <div className="rates-grid">
          {conversionRates.map((rate, index) => (
            <ConversionCard key={index} {...rate} />
          ))}
        </div>
      </div>
      
      <StageAnalysis data={funnelData} />
      
      <OptimizationSuggestions funnelData={funnelData} />
    </div>
  );
};

export default AI_FIRST_FunnelChart;
