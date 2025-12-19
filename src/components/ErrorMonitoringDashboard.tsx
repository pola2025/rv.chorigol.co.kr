/**
 * 실시간 에러 모니터링 및 분석 대시보드
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { globalErrorHandler, ErrorCategory, ErrorSeverity, AppError } from '../core/ErrorSystem';
import './ErrorMonitoringDashboard.css';

// ============================================
// 1. 에러 분석기
// ============================================

class ErrorAnalyzer {
  /**
   * 에러 패턴 분석
   */
  static analyzePatterns(errors: AppError[]): ErrorPattern[] {
    const patterns: Map<string, ErrorPattern> = new Map();
    
    for (const error of errors) {
      const key = `${error.category}:${error.code}`;
      
      if (!patterns.has(key)) {
        patterns.set(key, {
          id: key,
          category: error.category,
          code: error.code,
          count: 0,
          firstOccurrence: error.timestamp,
          lastOccurrence: error.timestamp,
          severity: error.severity,
          examples: []
        });
      }
      
      const pattern = patterns.get(key)!;
      pattern.count++;
      pattern.lastOccurrence = error.timestamp;
      
      if (pattern.examples.length < 3) {
        pattern.examples.push(error);
      }
    }
    
    return Array.from(patterns.values())
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 시계열 분석
   */
  static analyzeTimeSeries(errors: AppError[], intervalMinutes = 5): TimeSeriesData[] {
    const now = new Date();
    const intervals: Map<number, TimeSeriesData> = new Map();
    
    // 최근 1시간 데이터
    for (let i = 0; i < 12; i++) {
      const time = new Date(now.getTime() - i * intervalMinutes * 60000);
      const key = Math.floor(time.getTime() / (intervalMinutes * 60000));
      
      intervals.set(key, {
        time: time.toISOString(),
        count: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      });
    }
    
    for (const error of errors) {
      const key = Math.floor(error.timestamp.getTime() / (intervalMinutes * 60000));
      
      if (intervals.has(key)) {
        const data = intervals.get(key)!;
        data.count++;
        
        switch (error.severity) {
          case ErrorSeverity.CRITICAL:
            data.critical++;
            break;
          case ErrorSeverity.HIGH:
            data.high++;
            break;
          case ErrorSeverity.MEDIUM:
            data.medium++;
            break;
          case ErrorSeverity.LOW:
            data.low++;
            break;
        }
      }
    }
    
    return Array.from(intervals.values())
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  /**
   * 영향도 분석
   */
  static analyzeImpact(errors: AppError[]): ImpactAnalysis {
    const userImpact = new Set<string>();
    const serviceImpact = new Set<string>();
    let totalDowntime = 0;
    let estimatedRevenueLoss = 0;
    
    for (const error of errors) {
      // 사용자 영향
      if (error.context?.userId) {
        userImpact.add(error.context.userId);
      }
      
      // 서비스 영향
      if (error.context?.serviceId) {
        serviceImpact.add(error.context.serviceId);
      }
      
      // 다운타임 계산
      if (error.severity === ErrorSeverity.CRITICAL) {
        totalDowntime += error.retryAfter || 5000;
      }
      
      // 수익 손실 추정 (임의 계산)
      if (error.category === ErrorCategory.BUSINESS_LOGIC) {
        estimatedRevenueLoss += 10000; // 예약 실패당 예상 손실
      }
    }
    
    return {
      affectedUsers: userImpact.size,
      affectedServices: serviceImpact.size,
      totalDowntimeMs: totalDowntime,
      estimatedRevenueLoss,
      criticalErrors: errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
      recoveryTime: totalDowntime / errors.length
    };
  }

  /**
   * 근본 원인 분석 (RCA)
   */
  static performRCA(errors: AppError[]): RootCauseAnalysis[] {
    const causes: Map<string, RootCauseAnalysis> = new Map();
    
    for (const error of errors) {
      // 에러 체인 추적
      let rootCause = error;
      while (rootCause.originalError) {
        rootCause = rootCause.originalError as AppError;
      }
      
      const key = rootCause.message;
      
      if (!causes.has(key)) {
        causes.set(key, {
          cause: key,
          frequency: 0,
          affectedComponents: new Set(),
          suggestedFix: this.suggestFix(rootCause),
          priority: this.calculatePriority(rootCause)
        });
      }
      
      const analysis = causes.get(key)!;
      analysis.frequency++;
      
      if (error.context?.component) {
        analysis.affectedComponents.add(error.context.component);
      }
    }
    
    return Array.from(causes.values())
      .sort((a, b) => b.priority - a.priority);
  }

  private static suggestFix(error: AppError): string {
    const suggestions: Record<ErrorCategory, string> = {
      [ErrorCategory.NETWORK]: '네트워크 재시도 로직 강화, 타임아웃 조정',
      [ErrorCategory.VALIDATION]: '입력 검증 로직 개선, 사용자 가이드 제공',
      [ErrorCategory.AUTHENTICATION]: '토큰 갱신 로직 점검, 자동 로그아웃 구현',
      [ErrorCategory.AUTHORIZATION]: '권한 체크 로직 검토, 역할 기반 접근 제어 강화',
      [ErrorCategory.BUSINESS_LOGIC]: '비즈니스 로직 검토, 엣지 케이스 처리',
      [ErrorCategory.SYSTEM]: '시스템 리소스 모니터링, 스케일링 검토',
      [ErrorCategory.EXTERNAL_SERVICE]: '서드파티 서비스 모니터링, Fallback 전략 구현',
      [ErrorCategory.DATA_INTEGRITY]: '데이터 검증 강화, 트랜잭션 관리 개선',
      [ErrorCategory.UNKNOWN]: '로깅 강화, 에러 분류 체계 개선'
    };
    
    return suggestions[error.category] || '상세 분석 필요';
  }

  private static calculatePriority(error: AppError): number {
    const severityScore = {
      [ErrorSeverity.CRITICAL]: 1000,
      [ErrorSeverity.HIGH]: 100,
      [ErrorSeverity.MEDIUM]: 10,
      [ErrorSeverity.LOW]: 1
    };
    
    return severityScore[error.severity];
  }
}

// ============================================
// 2. 타입 정의
// ============================================

interface ErrorPattern {
  id: string;
  category: ErrorCategory;
  code: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  severity: ErrorSeverity;
  examples: AppError[];
}

interface TimeSeriesData {
  time: string;
  count: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface ImpactAnalysis {
  affectedUsers: number;
  affectedServices: number;
  totalDowntimeMs: number;
  estimatedRevenueLoss: number;
  criticalErrors: number;
  recoveryTime: number;
}

interface RootCauseAnalysis {
  cause: string;
  frequency: number;
  affectedComponents: Set<string>;
  suggestedFix: string;
  priority: number;
}

// ============================================
// 3. 모니터링 대시보드 컴포넌트
// ============================================

export const ErrorMonitoringDashboard: React.FC = () => {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [patterns, setPatterns] = useState<ErrorPattern[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null);
  const [rootCauses, setRootCauses] = useState<RootCauseAnalysis[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 데이터 로드 및 분석
  const loadAndAnalyze = useCallback(() => {
    const errorHistory = globalErrorHandler.getErrorHistory();
    
    // 시간 범위 필터링
    const now = new Date();
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const filteredErrors = errorHistory.filter(error => 
      error.timestamp.getTime() > now.getTime() - timeRanges[selectedTimeRange]
    );
    
    setErrors(filteredErrors);
    setPatterns(ErrorAnalyzer.analyzePatterns(filteredErrors));
    setTimeSeries(ErrorAnalyzer.analyzeTimeSeries(filteredErrors));
    setImpact(ErrorAnalyzer.analyzeImpact(filteredErrors));
    setRootCauses(ErrorAnalyzer.performRCA(filteredErrors));
  }, [selectedTimeRange]);

  // 초기 로드 및 자동 새로고침
  useEffect(() => {
    loadAndAnalyze();
    
    if (autoRefresh) {
      const interval = setInterval(loadAndAnalyze, 5000);
      return () => clearInterval(interval);
    }
  }, [loadAndAnalyze, autoRefresh]);

  // 실시간 에러 구독
  useEffect(() => {
    const unsubscribe = globalErrorHandler.subscribe((error) => {
      setErrors(prev => [...prev, error].slice(-1000)); // 최대 1000개 유지
    });
    
    return unsubscribe;
  }, []);

  // 차트 색상
  const COLORS = {
    critical: '#FF0000',
    high: '#FF6B6B',
    medium: '#FFA500',
    low: '#FFD700',
    success: '#4CAF50'
  };

  // 카테고리별 통계
  const categoryStats = React.useMemo(() => {
    const stats: Record<string, number> = {};
    
    for (const error of errors) {
      stats[error.category] = (stats[error.category] || 0) + 1;
    }
    
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [errors]);

  return (
    <div className="error-monitoring-dashboard">
      {/* 헤더 */}
      <div className="dashboard-header">
        <h1>🛡️ 에러 모니터링 대시보드</h1>
        <div className="header-controls">
          <div className="time-range-selector">
            <button 
              className={selectedTimeRange === '1h' ? 'active' : ''}
              onClick={() => setSelectedTimeRange('1h')}
            >
              1시간
            </button>
            <button 
              className={selectedTimeRange === '24h' ? 'active' : ''}
              onClick={() => setSelectedTimeRange('24h')}
            >
              24시간
            </button>
            <button 
              className={selectedTimeRange === '7d' ? 'active' : ''}
              onClick={() => setSelectedTimeRange('7d')}
            >
              7일
            </button>
          </div>
          <label className="auto-refresh">
            <input 
              type="checkbox" 
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            자동 새로고침
          </label>
          <button onClick={loadAndAnalyze} className="refresh-btn">
            🔄 새로고침
          </button>
        </div>
      </div>

      {/* 주요 지표 */}
      <div className="metrics-grid">
        <div className="metric-card critical">
          <h3>심각한 오류</h3>
          <div className="metric-value">{impact?.criticalErrors || 0}</div>
          <div className="metric-trend">▲ 15%</div>
        </div>
        
        <div className="metric-card warning">
          <h3>영향받은 사용자</h3>
          <div className="metric-value">{impact?.affectedUsers || 0}</div>
          <div className="metric-trend">▼ 5%</div>
        </div>
        
        <div className="metric-card info">
          <h3>평균 복구 시간</h3>
          <div className="metric-value">
            {impact ? (impact.recoveryTime / 1000).toFixed(1) : 0}s
          </div>
          <div className="metric-trend">▼ 20%</div>
        </div>
        
        <div className="metric-card danger">
          <h3>예상 손실</h3>
          <div className="metric-value">
            ₩{impact?.estimatedRevenueLoss.toLocaleString() || 0}
          </div>
          <div className="metric-trend">▲ 8%</div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="charts-grid">
        {/* 시계열 차트 */}
        <div className="chart-card">
          <h3>에러 발생 추이</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                tickFormatter={(time) => new Date(time).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="critical" stroke={COLORS.critical} name="심각" />
              <Line type="monotone" dataKey="high" stroke={COLORS.high} name="높음" />
              <Line type="monotone" dataKey="medium" stroke={COLORS.medium} name="중간" />
              <Line type="monotone" dataKey="low" stroke={COLORS.low} name="낮음" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 카테고리별 분포 */}
        <div className="chart-card">
          <h3>카테고리별 분포</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 패턴 분석 */}
        <div className="chart-card">
          <h3>주요 에러 패턴</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={patterns.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="code" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 근본 원인 분석 테이블 */}
      <div className="rca-section">
        <h3>🔍 근본 원인 분석 (Root Cause Analysis)</h3>
        <table className="rca-table">
          <thead>
            <tr>
              <th>원인</th>
              <th>빈도</th>
              <th>영향 컴포넌트</th>
              <th>제안 조치</th>
              <th>우선순위</th>
            </tr>
          </thead>
          <tbody>
            {rootCauses.slice(0, 5).map((rca, index) => (
              <tr key={index}>
                <td className="cause">{rca.cause}</td>
                <td className="frequency">{rca.frequency}</td>
                <td className="components">
                  {Array.from(rca.affectedComponents).join(', ') || '-'}
                </td>
                <td className="fix">{rca.suggestedFix}</td>
                <td className="priority">
                  <span className={`priority-badge priority-${rca.priority > 100 ? 'high' : 'medium'}`}>
                    {rca.priority > 100 ? '높음' : '중간'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 실시간 에러 로그 */}
      <div className="error-log-section">
        <h3>📜 실시간 에러 로그</h3>
        <div className="error-log">
          {errors.slice(-10).reverse().map((error, index) => (
            <div key={index} className={`log-entry severity-${error.severity.toLowerCase()}`}>
              <span className="timestamp">
                {error.timestamp.toLocaleTimeString()}
              </span>
              <span className="category">[{error.category}]</span>
              <span className="code">{error.code}</span>
              <span className="message">{error.userMessage || error.message}</span>
              {error.retryable && <span className="retry-badge">재시도 가능</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="dashboard-actions">
        <button className="export-btn" onClick={() => {
          const data = {
            errors,
            patterns,
            impact,
            rootCauses: rootCauses.map(rca => ({
              ...rca,
              affectedComponents: Array.from(rca.affectedComponents)
            }))
          };
          
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `error-report-${new Date().toISOString()}.json`;
          a.click();
        }}>
          📥 리포트 내보내기
        </button>
        
        <button className="clear-btn" onClick={() => {
          if (confirm('모든 에러 기록을 삭제하시겠습니까?')) {
            globalErrorHandler.clearErrorHistory();
            loadAndAnalyze();
          }
        }}>
          🗑️ 기록 삭제
        </button>
        
        <button className="alert-btn" onClick={() => {
          alert('알림 설정 페이지로 이동');
        }}>
          🔔 알림 설정
        </button>
      </div>
    </div>
  );
};

export default ErrorMonitoringDashboard;