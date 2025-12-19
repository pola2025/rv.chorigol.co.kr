// 디버그 및 모니터링 시스템
import { QueryClient } from '@tanstack/react-query';

/**
 * 디버그 모드 활성화 여부
 */
export const DEBUG_MODE = process.env.NODE_ENV === 'development';

/**
 * 디버그 레벨
 */
export const DEBUG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

/**
 * 현재 디버그 레벨 (localStorage에서 설정 가능)
 */
export const getCurrentDebugLevel = () => {
  if (!DEBUG_MODE) return DEBUG_LEVELS.ERROR;
  const level = localStorage.getItem('DEBUG_LEVEL');
  return level ? parseInt(level) : DEBUG_LEVELS.INFO;
};

/**
 * 마이그레이션 디버거 클래스
 */
class MigrationDebugger {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.performance = {};
    this.queryCache = new Map();
    
    // 전역 에러 핸들러
    if (DEBUG_MODE) {
      window.addEventListener('error', this.handleGlobalError.bind(this));
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }
  }

  /**
   * 로그 출력 및 저장
   */
  log(level, component, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      component,
      message,
      data,
      stack: new Error().stack
    };

    // 로그 저장
    this.logs.push(logEntry);
    if (this.logs.length > 1000) {
      this.logs.shift(); // 최대 1000개 유지
    }

    // 콘솔 출력
    if (getCurrentDebugLevel() >= level) {
      const prefix = `[${timestamp.slice(11, 19)}] [${component}]`;
      const color = this.getLogColor(level);
      
      console.log(
        `%c${prefix} ${message}`,
        `color: ${color}; font-weight: bold;`,
        data || ''
      );

      // 스택 트레이스 (TRACE 레벨)
      if (level === DEBUG_LEVELS.TRACE && data?.stack) {
        console.log('%cStack:', 'color: gray; font-size: 0.9em;', data.stack);
      }
    }

    // 에러인 경우 별도 저장
    if (level === DEBUG_LEVELS.ERROR) {
      this.errors.push(logEntry);
      this.showErrorNotification(component, message);
    }
  }

  /**
   * 로그 색상 반환
   */
  getLogColor(level) {
    switch (level) {
      case DEBUG_LEVELS.ERROR: return '#ff4444';
      case DEBUG_LEVELS.WARN: return '#ffaa00';
      case DEBUG_LEVELS.INFO: return '#4444ff';
      case DEBUG_LEVELS.DEBUG: return '#44ff44';
      case DEBUG_LEVELS.TRACE: return '#888888';
      default: return '#000000';
    }
  }

  /**
   * 에러 알림 표시
   */
  showErrorNotification(component, message) {
    if (!DEBUG_MODE) return;

    const notification = document.createElement('div');
    notification.className = 'debug-error-notification';
    notification.innerHTML = `
      <strong>Error in ${component}</strong>
      <p>${message}</p>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  /**
   * 성능 측정 시작
   */
  startPerformance(key) {
    this.performance[key] = {
      start: performance.now(),
      marks: []
    };
  }

  /**
   * 성능 마크 추가
   */
  markPerformance(key, label) {
    if (this.performance[key]) {
      const elapsed = performance.now() - this.performance[key].start;
      this.performance[key].marks.push({ label, elapsed });
      this.log(DEBUG_LEVELS.TRACE, 'Performance', `${key} - ${label}: ${elapsed.toFixed(2)}ms`);
    }
  }

  /**
   * 성능 측정 종료
   */
  endPerformance(key) {
    if (this.performance[key]) {
      const total = performance.now() - this.performance[key].start;
      this.log(DEBUG_LEVELS.INFO, 'Performance', `${key} completed in ${total.toFixed(2)}ms`, {
        total,
        marks: this.performance[key].marks
      });
      delete this.performance[key];
    }
  }

  /**
   * React Query 쿼리 추적
   */
  trackQuery(queryKey, status, data = null) {
    const key = JSON.stringify(queryKey);
    
    if (!this.queryCache.has(key)) {
      this.queryCache.set(key, {
        count: 0,
        statuses: [],
        lastData: null
      });
    }

    const cache = this.queryCache.get(key);
    cache.count++;
    cache.statuses.push({ status, timestamp: Date.now() });
    cache.lastData = data;

    this.log(
      DEBUG_LEVELS.DEBUG,
      'Query',
      `${key} - ${status} (${cache.count} calls)`,
      { data, history: cache.statuses }
    );
  }

  /**
   * 전역 에러 핸들러
   */
  handleGlobalError(event) {
    this.log(DEBUG_LEVELS.ERROR, 'Global', event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  }

  /**
   * Promise rejection 핸들러
   */
  handleUnhandledRejection(event) {
    this.log(DEBUG_LEVELS.ERROR, 'Promise', 'Unhandled rejection', {
      reason: event.reason,
      promise: event.promise
    });
  }

  /**
   * 마이그레이션 전후 비교
   */
  compareMigration(component, before, after) {
    const comparison = {
      component,
      before: {
        hasUseEffect: before.includes('useEffect'),
        lineCount: before.split('\n').length,
        stateCount: (before.match(/useState/g) || []).length
      },
      after: {
        hasUseEffect: after.includes('useEffect'),
        lineCount: after.split('\n').length,
        useQueryCount: (after.match(/useQuery/g) || []).length
      },
      improvement: {
        useEffectRemoved: before.includes('useEffect') && !after.includes('useEffect'),
        linesReduced: before.split('\n').length - after.split('\n').length,
        declarative: (after.match(/useQuery|useMutation/g) || []).length > 0
      }
    };

    this.log(DEBUG_LEVELS.INFO, 'Migration', `${component} migration completed`, comparison);
    return comparison;
  }

  /**
   * 디버그 패널 표시
   */
  showDebugPanel() {
    if (!DEBUG_MODE) return;

    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.innerHTML = `
      <div class="debug-panel-header">
        <h3>Debug Panel</h3>
        <button onclick="migrationDebugger.hideDebugPanel()">×</button>
      </div>
      <div class="debug-panel-content">
        <div class="debug-section">
          <h4>Recent Logs (${this.logs.length})</h4>
          <div id="debug-logs"></div>
        </div>
        <div class="debug-section">
          <h4>Errors (${this.errors.length})</h4>
          <div id="debug-errors"></div>
        </div>
        <div class="debug-section">
          <h4>Query Cache (${this.queryCache.size})</h4>
          <div id="debug-queries"></div>
        </div>
        <div class="debug-section">
          <h4>Performance</h4>
          <div id="debug-performance"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.updateDebugPanel();
  }

  /**
   * 디버그 패널 숨기기
   */
  hideDebugPanel() {
    const panel = document.getElementById('debug-panel');
    if (panel) panel.remove();
  }

  /**
   * 디버그 패널 업데이트
   */
  updateDebugPanel() {
    const panel = document.getElementById('debug-panel');
    if (!panel) return;

    // 최근 로그
    const logsDiv = document.getElementById('debug-logs');
    logsDiv.innerHTML = this.logs.slice(-10).map(log => `
      <div class="debug-log-entry level-${log.level}">
        <span class="time">${log.timestamp.slice(11, 19)}</span>
        <span class="component">[${log.component}]</span>
        <span class="message">${log.message}</span>
      </div>
    `).join('');

    // 에러
    const errorsDiv = document.getElementById('debug-errors');
    errorsDiv.innerHTML = this.errors.slice(-5).map(err => `
      <div class="debug-error-entry">
        <span class="time">${err.timestamp.slice(11, 19)}</span>
        <span class="component">[${err.component}]</span>
        <span class="message">${err.message}</span>
      </div>
    `).join('');

    // 쿼리 캐시
    const queriesDiv = document.getElementById('debug-queries');
    const queries = Array.from(this.queryCache.entries()).slice(-5);
    queriesDiv.innerHTML = queries.map(([key, value]) => `
      <div class="debug-query-entry">
        <span class="key">${key}</span>
        <span class="count">Calls: ${value.count}</span>
        <span class="status">Last: ${value.statuses[value.statuses.length - 1]?.status}</span>
      </div>
    `).join('');

    // 성능
    const perfDiv = document.getElementById('debug-performance');
    const activePerf = Object.entries(this.performance);
    perfDiv.innerHTML = activePerf.map(([key, value]) => `
      <div class="debug-perf-entry">
        <span class="key">${key}</span>
        <span class="elapsed">${(performance.now() - value.start).toFixed(2)}ms</span>
      </div>
    `).join('');

    // 1초마다 업데이트
    setTimeout(() => this.updateDebugPanel(), 1000);
  }

  /**
   * 로그 내보내기
   */
  exportLogs() {
    const data = {
      logs: this.logs,
      errors: this.errors,
      queries: Array.from(this.queryCache.entries()),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 로그 초기화
   */
  clearLogs() {
    this.logs = [];
    this.errors = [];
    this.queryCache.clear();
    this.performance = {};
    this.log(DEBUG_LEVELS.INFO, 'Debug', 'Logs cleared');
  }
}

// 전역 디버거 인스턴스
export const migrationDebugger = new MigrationDebugger();

// 전역 접근 가능하도록 설정
if (DEBUG_MODE) {
  window.migrationDebugger = migrationDebugger;
  
  // 디버그 명령어
  window.debug = {
    show: () => migrationDebugger.showDebugPanel(),
    hide: () => migrationDebugger.hideDebugPanel(),
    export: () => migrationDebugger.exportLogs(),
    clear: () => migrationDebugger.clearLogs(),
    setLevel: (level) => {
      localStorage.setItem('DEBUG_LEVEL', level.toString());
      console.log(`Debug level set to ${level}`);
    },
    levels: DEBUG_LEVELS
  };

  console.log('%c🔧 Debug Mode Active', 'color: #44ff44; font-size: 14px; font-weight: bold;');
  console.log('Commands: debug.show(), debug.hide(), debug.export(), debug.clear(), debug.setLevel(n)');
}

// React Query 클라이언트에 디버그 미들웨어 추가
export const createDebugQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        // 디버그 미들웨어
        onSuccess: (data, query) => {
          migrationDebugger.trackQuery(query.queryKey, 'success', data);
        },
        onError: (error, query) => {
          migrationDebugger.trackQuery(query.queryKey, 'error', error);
          migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Query', `Query failed: ${JSON.stringify(query.queryKey)}`, error);
        },
        onSettled: (data, error, query) => {
          migrationDebugger.trackQuery(query.queryKey, 'settled', { data, error });
        }
      },
      mutations: {
        onSuccess: (data, variables, context, mutation) => {
          migrationDebugger.log(DEBUG_LEVELS.INFO, 'Mutation', 'Mutation succeeded', { data, variables });
        },
        onError: (error, variables, context, mutation) => {
          migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Mutation', 'Mutation failed', { error, variables });
        }
      }
    }
  });
};

export default migrationDebugger;
