/**
 * Performance Monitor
 * 실시간 성능 모니터링 및 분석
 */

import React, { useState, useCallback, useRef } from 'react';
import { useDerivedState } from '../application/hooks/useReactiveState';
import { cacheManager } from '../application/hooks/useReactiveState';

/**
 * 성능 메트릭 수집기
 */
class PerformanceCollector {
  constructor() {
    this.metrics = {
      renderCount: 0,
      renderTime: [],
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: [],
      errors: [],
      memoryUsage: []
    };
    
    this.startTime = performance.now();
  }

  recordRender(componentName, duration) {
    this.metrics.renderCount++;
    this.metrics.renderTime.push({
      component: componentName,
      duration,
      timestamp: Date.now()
    });
  }

  recordApiCall(endpoint, duration, status) {
    this.metrics.apiCalls.push({
      endpoint,
      duration,
      status,
      timestamp: Date.now()
    });
  }

  recordError(error, context) {
    this.metrics.errors.push({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }

  recordMemoryUsage() {
    if (performance.memory) {
      this.metrics.memoryUsage.push({
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      });
    }
  }

  getMetrics() {
    const uptime = performance.now() - this.startTime;
    const avgRenderTime = this.metrics.renderTime.length > 0
      ? this.metrics.renderTime.reduce((sum, r) => sum + r.duration, 0) / this.metrics.renderTime.length
      : 0;

    const avgApiTime = this.metrics.apiCalls.length > 0
      ? this.metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0) / this.metrics.apiCalls.length
      : 0;

    return {
      uptime,
      renderCount: this.metrics.renderCount,
      avgRenderTime,
      avgApiTime,
      errorCount: this.metrics.errors.length,
      apiCallCount: this.metrics.apiCalls.length,
      cacheStats: cacheManager.getStats(),
      cacheHitRate: cacheManager.getHitRate(),
      memoryUsage: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] || null
    };
  }

  reset() {
    this.metrics = {
      renderCount: 0,
      renderTime: [],
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: [],
      errors: [],
      memoryUsage: []
    };
    this.startTime = performance.now();
  }
}

// 전역 수집기 인스턴스
const globalCollector = new PerformanceCollector();

/**
 * 성능 모니터 컴포넌트
 */
export const PerformanceMonitor = ({ 
  visible = false, 
  position = 'bottom-right',
  refreshInterval = 1000 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const intervalRef = useRef(null);

  // 메트릭 상태 (선언형)
  const [metricsTimestamp, setMetricsTimestamp] = useState(Date.now());
  
  const metrics = useDerivedState(
    [metricsTimestamp],
    () => globalCollector.getMetrics(),
    `metrics:${metricsTimestamp}`
  );

  // 자동 갱신 (ref 콜백 패턴)
  const startMonitoring = useCallback((node) => {
    if (!node) return;

    intervalRef.current = setInterval(() => {
      globalCollector.recordMemoryUsage();
      setMetricsTimestamp(Date.now());
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval]);

  if (!visible) return null;

  const positionStyles = {
    'top-left': { top: 20, left: 20 },
    'top-right': { top: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
    'bottom-right': { bottom: 20, right: 20 }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div
      ref={startMonitoring}
      className="performance-monitor"
      style={{
        position: 'fixed',
        ...positionStyles[position],
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#00ff00',
        fontFamily: 'monospace',
        fontSize: '12px',
        padding: '10px',
        borderRadius: '5px',
        zIndex: 9999,
        minWidth: isExpanded ? '300px' : '150px',
        maxWidth: '400px',
        transition: 'all 0.3s ease'
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '5px',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <strong>성능 모니터</strong>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </div>

      <div style={{ marginTop: '10px' }}>
        <div>FPS: {(1000 / (metrics.avgRenderTime || 16)).toFixed(1)}</div>
        <div>렌더: {metrics.renderCount}회</div>
        <div>캐시 적중률: {metrics.cacheHitRate?.toFixed(1)}%</div>
        
        {isExpanded && (
          <>
            <hr style={{ margin: '10px 0', borderColor: '#00ff00' }} />
            
            <div style={{ marginBottom: '5px' }}>
              <strong>렌더링</strong>
              <div>평균 시간: {formatTime(metrics.avgRenderTime)}</div>
            </div>

            <div style={{ marginBottom: '5px' }}>
              <strong>API</strong>
              <div>호출 수: {metrics.apiCallCount}</div>
              <div>평균 시간: {formatTime(metrics.avgApiTime)}</div>
            </div>

            <div style={{ marginBottom: '5px' }}>
              <strong>캐시</strong>
              <div>크기: {metrics.cacheStats?.totalSize || 0}/{metrics.cacheStats?.maxSize || 0}</div>
              <div>사용률: {metrics.cacheStats?.usage?.toFixed(1)}%</div>
            </div>

            {metrics.memoryUsage && (
              <div style={{ marginBottom: '5px' }}>
                <strong>메모리</strong>
                <div>사용: {formatBytes(metrics.memoryUsage.usedJSHeapSize)}</div>
                <div>전체: {formatBytes(metrics.memoryUsage.totalJSHeapSize)}</div>
                <div>제한: {formatBytes(metrics.memoryUsage.jsHeapSizeLimit)}</div>
              </div>
            )}

            {metrics.errorCount > 0 && (
              <div style={{ color: '#ff0000' }}>
                <strong>에러: {metrics.errorCount}개</strong>
              </div>
            )}

            <hr style={{ margin: '10px 0', borderColor: '#00ff00' }} />
            
            <button
              onClick={() => {
                globalCollector.reset();
                cacheManager.invalidateAll();
                setMetricsTimestamp(Date.now());
              }}
              style={{
                backgroundColor: '#00ff00',
                color: '#000',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
                width: '100%'
              }}
            >
              리셋
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * 성능 측정 HOC
 */
export const withPerformance = (Component, componentName) => {
  return React.memo((props) => {
    const renderStartRef = useRef(performance.now());

    // 렌더링 시간 측정 (ref 콜백)
    const measureRender = useCallback((node) => {
      if (!node) return;
      
      const renderTime = performance.now() - renderStartRef.current;
      globalCollector.recordRender(componentName, renderTime);
    }, []);

    return (
      <div ref={measureRender}>
        <Component {...props} />
      </div>
    );
  });
};

/**
 * API 호출 성능 측정 래퍼
 */
export const measureApiCall = async (endpoint, fetchFn) => {
  const startTime = performance.now();
  
  try {
    const result = await fetchFn();
    const duration = performance.now() - startTime;
    globalCollector.recordApiCall(endpoint, duration, 'success');
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    globalCollector.recordApiCall(endpoint, duration, 'error');
    globalCollector.recordError(error, endpoint);
    throw error;
  }
};

/**
 * 성능 최적화 제안 생성기
 */
export const usePerformanceSuggestions = () => {
  return useDerivedState(
    [Date.now()],
    () => {
      const metrics = globalCollector.getMetrics();
      const suggestions = [];

      // 렌더링 성능
      if (metrics.avgRenderTime > 16) {
        suggestions.push({
          type: 'warning',
          message: '평균 렌더링 시간이 16ms를 초과합니다. 컴포넌트 최적화가 필요합니다.',
          action: 'React.memo, useMemo, useCallback 사용을 검토하세요.'
        });
      }

      // 캐시 성능
      if (metrics.cacheHitRate < 50) {
        suggestions.push({
          type: 'info',
          message: '캐시 적중률이 낮습니다.',
          action: '자주 사용되는 데이터의 캐시 TTL을 늘리는 것을 고려하세요.'
        });
      }

      // 메모리 사용
      if (metrics.memoryUsage) {
        const usagePercent = (metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100;
        if (usagePercent > 80) {
          suggestions.push({
            type: 'error',
            message: '메모리 사용량이 높습니다.',
            action: '불필요한 데이터를 정리하고 메모리 누수를 확인하세요.'
          });
        }
      }

      // API 성능
      if (metrics.avgApiTime > 1000) {
        suggestions.push({
          type: 'warning',
          message: 'API 응답 시간이 느립니다.',
          action: '배치 요청이나 캐싱을 활용하여 API 호출을 최적화하세요.'
        });
      }

      return suggestions;
    },
    'performance-suggestions'
  );
};

export { globalCollector };
