/**
 * 엔터프라이즈급 에러 처리 시스템
 * Netflix의 Hystrix와 Airbnb의 에러 처리 패턴을 참고하여 구현
 */

// ============================================
// 1. 에러 분류 체계 (Error Taxonomy)
// ============================================

export enum ErrorCategory {
  // 비즈니스 로직 에러
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  // 검증 에러
  VALIDATION = 'VALIDATION',
  // 네트워크 에러
  NETWORK = 'NETWORK',
  // 인증/권한 에러
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  // 시스템 에러
  SYSTEM = 'SYSTEM',
  // 외부 서비스 에러
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  // 데이터 에러
  DATA_INTEGRITY = 'DATA_INTEGRITY',
  // 알 수 없는 에러
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',         // 무시 가능
  MEDIUM = 'MEDIUM',   // 기능 저하
  HIGH = 'HIGH',       // 주요 기능 중단
  CRITICAL = 'CRITICAL' // 시스템 전체 중단
}

export interface AppError extends Error {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, any>;
  originalError?: Error;
  userMessage?: string;
  technicalMessage?: string;
  actionRequired?: string;
  retryable?: boolean;
  retryAfter?: number;
}

// ============================================
// 2. 에러 생성 팩토리
// ============================================

export class ErrorFactory {
  static create(params: {
    code: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    context?: Record<string, any>;
    originalError?: Error;
    userMessage?: string;
    actionRequired?: string;
    retryable?: boolean;
    retryAfter?: number;
  }): AppError {
    const error = new Error(params.message) as AppError;
    error.code = params.code;
    error.category = params.category;
    error.severity = params.severity;
    error.timestamp = new Date();
    error.context = params.context;
    error.originalError = params.originalError;
    error.userMessage = params.userMessage || this.getDefaultUserMessage(params.category);
    error.technicalMessage = params.message;
    error.actionRequired = params.actionRequired;
    error.retryable = params.retryable ?? this.isRetryable(params.category);
    error.retryAfter = params.retryAfter;
    
    return error;
  }

  private static getDefaultUserMessage(category: ErrorCategory): string {
    const messages: Record<ErrorCategory, string> = {
      [ErrorCategory.BUSINESS_LOGIC]: '요청을 처리할 수 없습니다. 입력 내용을 확인해주세요.',
      [ErrorCategory.VALIDATION]: '입력하신 정보가 올바르지 않습니다.',
      [ErrorCategory.NETWORK]: '네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.',
      [ErrorCategory.AUTHENTICATION]: '로그인이 필요합니다.',
      [ErrorCategory.AUTHORIZATION]: '해당 작업을 수행할 권한이 없습니다.',
      [ErrorCategory.SYSTEM]: '시스템 오류가 발생했습니다. 관리자에게 문의해주세요.',
      [ErrorCategory.EXTERNAL_SERVICE]: '외부 서비스에 일시적인 문제가 있습니다.',
      [ErrorCategory.DATA_INTEGRITY]: '데이터 처리 중 오류가 발생했습니다.',
      [ErrorCategory.UNKNOWN]: '예기치 않은 오류가 발생했습니다.'
    };
    return messages[category];
  }

  private static isRetryable(category: ErrorCategory): boolean {
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.EXTERNAL_SERVICE
    ];
    return retryableCategories.includes(category);
  }
}

// ============================================
// 3. Circuit Breaker 패턴 구현
// ============================================

export enum CircuitState {
  CLOSED = 'CLOSED',     // 정상 작동
  OPEN = 'OPEN',         // 차단됨
  HALF_OPEN = 'HALF_OPEN' // 테스트 중
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  constructor(
    private readonly options: {
      failureThreshold: number;      // 실패 임계값
      recoveryTimeout: number;       // 복구 대기 시간 (ms)
      monitoringPeriod: number;      // 모니터링 기간 (ms)
      halfOpenMaxAttempts: number;   // Half-Open 상태 최대 시도
    }
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    // 회로 차단 상태 확인
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        if (fallback) {
          return fallback();
        }
        throw ErrorFactory.create({
          code: 'CIRCUIT_OPEN',
          message: 'Circuit breaker is open',
          category: ErrorCategory.SYSTEM,
          severity: ErrorSeverity.HIGH,
          userMessage: '서비스가 일시적으로 사용 불가능합니다.',
          retryable: true,
          retryAfter: this.getRetryAfter()
        });
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback && this.state === CircuitState.OPEN) {
        return fallback();
      }
      
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenMaxAttempts) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(
        Date.now() + this.options.recoveryTimeout
      );
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.nextAttemptTime != null &&
      new Date() >= this.nextAttemptTime
    );
  }

  private getRetryAfter(): number {
    if (this.nextAttemptTime) {
      return Math.max(0, this.nextAttemptTime.getTime() - Date.now());
    }
    return this.options.recoveryTimeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }
}

// ============================================
// 4. Retry 메커니즘
// ============================================

export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: any) => boolean;
}

export class RetryManager {
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config: RetryOptions = {
      maxAttempts: options.maxAttempts ?? 3,
      delay: options.delay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      jitter: options.jitter ?? true,
      retryCondition: options.retryCondition ?? ((error) => {
        if (error instanceof AppError) {
          return error.retryable === true;
        }
        return true;
      })
    };

    let lastError: any;
    let delay = config.delay;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === config.maxAttempts || !config.retryCondition(error)) {
          throw error;
        }

        // Exponential backoff with jitter
        if (config.jitter) {
          delay = delay + Math.random() * delay * 0.2;
        }
        
        await this.sleep(Math.min(delay, config.maxDelay));
        delay *= config.backoffMultiplier;
      }
    }

    throw lastError;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// 5. Error Boundary 고급 구현
// ============================================

import React, { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  isolate?: boolean;
  maxRetries?: number;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  level?: 'page' | 'section' | 'component';
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;
  private errorCounter = 0;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;
    const { errorId } = this.state;

    // 에러 로깅
    console.error(`[${level.toUpperCase()} Error Boundary]`, error, errorInfo);

    // 에러 리포팅
    if (onError && errorId) {
      onError(error, errorInfo, errorId);
    }

    // 에러 분석
    this.analyzeError(error, errorInfo);

    // 자동 복구 시도
    if (this.shouldAutoRecover(error)) {
      this.scheduleReset(5000);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError) {
      // resetKeys 변경 감지
      if (resetKeys && prevProps.resetKeys) {
        const hasResetKeyChanged = resetKeys.some(
          (key, index) => key !== prevProps.resetKeys![index]
        );
        
        if (hasResetKeyChanged) {
          this.resetErrorBoundary();
        }
      }

      // Props 변경 시 리셋
      if (resetOnPropsChange && prevProps.children !== this.props.children) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private analyzeError(error: Error, errorInfo: ErrorInfo) {
    // 에러 패턴 분석
    const errorPatterns = {
      chunkLoadError: /ChunkLoadError|Loading chunk/i,
      networkError: /NetworkError|fetch/i,
      syntaxError: /SyntaxError/i,
      typeError: /TypeError/i,
      referenceError: /ReferenceError/i
    };

    for (const [pattern, regex] of Object.entries(errorPatterns)) {
      if (regex.test(error.toString())) {
        console.log(`Error pattern detected: ${pattern}`);
        // 패턴별 특별 처리
        this.handleSpecificError(pattern, error);
        break;
      }
    }
  }

  private handleSpecificError(pattern: string, error: Error) {
    switch (pattern) {
      case 'chunkLoadError':
        // 청크 로드 에러 - 페이지 새로고침
        if (this.state.retryCount < 2) {
          window.location.reload();
        }
        break;
      case 'networkError':
        // 네트워크 에러 - 재시도
        this.scheduleReset(3000);
        break;
      default:
        // 기본 처리
        break;
    }
  }

  private shouldAutoRecover(error: Error): boolean {
    // 자동 복구 가능한 에러 판단
    const recoverableErrors = [
      /Network/i,
      /Timeout/i,
      /ChunkLoadError/i
    ];

    return recoverableErrors.some(pattern => pattern.test(error.toString()));
  }

  private scheduleReset(delay: number) {
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  }

  resetErrorBoundary = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        errorId: undefined,
        retryCount: this.state.retryCount + 1
      });
    }
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, isolate } = this.props;

    if (hasError && error && errorInfo) {
      if (fallback) {
        return fallback(error, errorInfo, this.resetErrorBoundary);
      }

      return (
        <div className="error-boundary-default-ui">
          <h2>⚠️ 오류가 발생했습니다</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>자세한 정보</summary>
            {error.toString()}
            <br />
            {errorInfo.componentStack}
          </details>
          <button onClick={this.resetErrorBoundary}>
            다시 시도
          </button>
        </div>
      );
    }

    // Isolate 모드: 에러 전파 차단
    if (isolate) {
      return (
        <ErrorBoundary fallback={fallback}>
          {children}
        </ErrorBoundary>
      );
    }

    return children;
  }
}

// ============================================
// 6. 글로벌 에러 핸들러
// ============================================

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: AppError[] = [];
  private listeners: Set<(error: AppError) => void> = new Set();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  private setupGlobalHandlers() {
    // 전역 에러 핸들러
    window.addEventListener('error', (event) => {
      this.handleError(ErrorFactory.create({
        code: 'GLOBAL_ERROR',
        message: event.message,
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.HIGH,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      }));
    });

    // Promise rejection 핸들러
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(ErrorFactory.create({
        code: 'UNHANDLED_REJECTION',
        message: event.reason?.message || 'Unhandled promise rejection',
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.HIGH,
        originalError: event.reason
      }));
      
      event.preventDefault();
    });
  }

  handleError(error: AppError) {
    // 에러 큐에 추가
    this.errorQueue.push(error);
    
    // 큐 크기 제한
    if (this.errorQueue.length > 100) {
      this.errorQueue.shift();
    }

    // 심각도별 처리
    this.handleBySeverity(error);

    // 리스너 알림
    this.notifyListeners(error);

    // 에러 리포팅
    this.reportError(error);
  }

  private handleBySeverity(error: AppError) {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        // 긴급 알림
        this.sendCriticalAlert(error);
        // 서비스 격리
        this.isolateService(error);
        break;
      case ErrorSeverity.HIGH:
        // 에러 로깅 강화
        console.error('HIGH SEVERITY ERROR:', error);
        // 복구 시도
        this.attemptRecovery(error);
        break;
      case ErrorSeverity.MEDIUM:
        // 일반 로깅
        console.warn('MEDIUM SEVERITY ERROR:', error);
        break;
      case ErrorSeverity.LOW:
        // 디버그 로깅
        console.log('LOW SEVERITY ERROR:', error);
        break;
    }
  }

  private sendCriticalAlert(error: AppError) {
    // Slack, PagerDuty 등 알림 전송
    console.error('🚨 CRITICAL ERROR ALERT:', error);
    
    // 관리자 즉시 알림
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('심각한 오류 발생', {
        body: error.userMessage || error.message,
        icon: '/error-icon.png'
      });
    }
  }

  private isolateService(error: AppError) {
    // 해당 서비스의 Circuit Breaker 열기
    const serviceId = error.context?.serviceId || 'default';
    const circuitBreaker = this.getCircuitBreaker(serviceId);
    
    // 강제로 회로 차단
    if (circuitBreaker) {
      // Circuit을 OPEN 상태로 변경
      console.log(`Service ${serviceId} isolated due to critical error`);
    }
  }

  private attemptRecovery(error: AppError) {
    if (error.retryable) {
      // 자동 재시도 스케줄링
      setTimeout(() => {
        console.log('Attempting automatic recovery...');
        // 복구 로직 실행
      }, error.retryAfter || 5000);
    }
  }

  private reportError(error: AppError) {
    // 에러 리포팅 서비스로 전송
    // Sentry, LogRocket, Bugsnag 등
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        level: this.mapSeverityToSentryLevel(error.severity),
        tags: {
          category: error.category,
          code: error.code
        },
        extra: error.context
      });
    }
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): string {
    const mapping = {
      [ErrorSeverity.LOW]: 'info',
      [ErrorSeverity.MEDIUM]: 'warning',
      [ErrorSeverity.HIGH]: 'error',
      [ErrorSeverity.CRITICAL]: 'fatal'
    };
    return mapping[severity];
  }

  getCircuitBreaker(serviceId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceId)) {
      this.circuitBreakers.set(serviceId, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000,
        halfOpenMaxAttempts: 3
      }));
    }
    return this.circuitBreakers.get(serviceId)!;
  }

  subscribe(listener: (error: AppError) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(error: AppError) {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  getErrorHistory(): AppError[] {
    return [...this.errorQueue];
  }

  getErrorStats() {
    const stats = {
      total: this.errorQueue.length,
      bySeverity: {} as Record<ErrorSeverity, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      recentErrors: this.errorQueue.slice(-10)
    };

    for (const error of this.errorQueue) {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
    }

    return stats;
  }

  clearErrorHistory() {
    this.errorQueue = [];
  }
}

// ============================================
// 7. React Hook for Error Handling
// ============================================

import { useState, useCallback, useEffect } from 'react';

export function useErrorHandler() {
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const errorHandler = GlobalErrorHandler.getInstance();

  const handleError = useCallback((error: any) => {
    let appError: AppError;
    
    if (error instanceof AppError) {
      appError = error;
    } else {
      appError = ErrorFactory.create({
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        originalError: error
      });
    }
    
    setError(appError);
    errorHandler.handleError(appError);
  }, [errorHandler]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const executeAsync = useCallback(async <T,>(
    operation: () => Promise<T>,
    options?: {
      retry?: boolean;
      retryOptions?: Partial<RetryOptions>;
      fallback?: () => T;
      circuitBreakerId?: string;
    }
  ): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      let result: T;
      
      // Circuit Breaker 적용
      if (options?.circuitBreakerId) {
        const circuitBreaker = errorHandler.getCircuitBreaker(options.circuitBreakerId);
        result = await circuitBreaker.execute(operation, options.fallback);
      }
      // Retry 적용
      else if (options?.retry) {
        result = await RetryManager.executeWithRetry(operation, options.retryOptions);
      }
      // 일반 실행
      else {
        result = await operation();
      }
      
      return result;
    } catch (error) {
      handleError(error);
      
      if (options?.fallback) {
        return options.fallback();
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [errorHandler, handleError]);

  // 에러 구독
  useEffect(() => {
    const unsubscribe = errorHandler.subscribe((error) => {
      console.log('Error received:', error);
    });
    
    return unsubscribe;
  }, [errorHandler]);

  return {
    error,
    isLoading,
    handleError,
    clearError,
    executeAsync
  };
}

// ============================================
// 8. 에러 복구 전략
// ============================================

export class RecoveryStrategy {
  static async executeWithFallback<T>(
    primary: () => Promise<T>,
    fallbacks: Array<() => Promise<T>>,
    options?: {
      timeout?: number;
      throwOnAllFailed?: boolean;
    }
  ): Promise<T> {
    const errors: Error[] = [];
    
    // Primary 시도
    try {
      return await this.withTimeout(primary(), options?.timeout);
    } catch (error) {
      errors.push(error as Error);
    }
    
    // Fallback 시도
    for (const fallback of fallbacks) {
      try {
        return await this.withTimeout(fallback(), options?.timeout);
      } catch (error) {
        errors.push(error as Error);
      }
    }
    
    // 모든 시도 실패
    if (options?.throwOnAllFailed) {
      throw ErrorFactory.create({
        code: 'ALL_STRATEGIES_FAILED',
        message: 'All recovery strategies failed',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        context: { errors: errors.map(e => e.message) }
      });
    }
    
    throw errors[errors.length - 1];
  }
  
  private static withTimeout<T>(
    promise: Promise<T>,
    timeout?: number
  ): Promise<T> {
    if (!timeout) return promise;
    
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);
  }
}

// 싱글톤 인스턴스 export
export const globalErrorHandler = GlobalErrorHandler.getInstance();