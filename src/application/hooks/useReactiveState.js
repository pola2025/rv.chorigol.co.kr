/**
 * Reactive State Manager
 * 선언형 상태 관리 - useEffect 없이 파생 상태 자동 계산
 */

import { useMemo, useRef, useCallback } from 'react';
import { QueryCache } from '../../infrastructure/cache/LRUCache';

// 싱글톤 캐시 인스턴스
const globalQueryCache = new QueryCache(100, 5 * 60 * 1000);

/**
 * 선언형 파생 상태 훅
 * useEffect 없이 자동으로 파생 상태 계산
 */
export function useDerivedState(dependencies, computeFn, cacheKey = null) {
  const previousDepsRef = useRef();
  const previousResultRef = useRef();

  return useMemo(() => {
    // 캐시 확인
    if (cacheKey) {
      const cached = globalQueryCache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // 의존성 체크 (얕은 비교)
    const depsChanged = !previousDepsRef.current || 
      dependencies.some((dep, i) => dep !== previousDepsRef.current[i]);

    if (!depsChanged && previousResultRef.current !== undefined) {
      return previousResultRef.current;
    }

    // 새로운 값 계산
    const result = computeFn();
    
    // 캐시 저장
    if (cacheKey) {
      globalQueryCache.set(cacheKey, result);
    }

    // 이전 값 저장
    previousDepsRef.current = dependencies;
    previousResultRef.current = result;

    return result;
  }, dependencies);
}

/**
 * 선언형 컬렉션 파생 상태
 * 컬렉션에 대한 필터링, 정렬, 그룹화 등을 선언적으로 처리
 */
export function useDerivedCollection(collection, transforms = []) {
  return useMemo(() => {
    if (!collection) return [];
    
    return transforms.reduce((acc, transform) => {
      switch (transform.type) {
        case 'filter':
          return acc.filter(transform.predicate);
        
        case 'sort':
          return [...acc].sort(transform.compareFn);
        
        case 'map':
          return acc.map(transform.mapFn);
        
        case 'groupBy':
          return acc.reduce((groups, item) => {
            const key = transform.keyFn(item);
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
            return groups;
          }, {});
        
        case 'slice':
          return acc.slice(transform.start, transform.end);
        
        default:
          return acc;
      }
    }, collection);
  }, [collection, ...transforms.map(t => t.predicate || t.compareFn || t.mapFn || t.keyFn || t.start || t.end)]);
}

/**
 * 비동기 파생 상태 (Suspense 지원)
 */
export function useAsyncDerivedState(asyncFn, dependencies, options = {}) {
  const { 
    suspense = false, 
    cacheKey = null,
    fallback = null,
    retryCount = 3,
    retryDelay = 1000
  } = options;

  const promiseRef = useRef();
  const resultRef = useRef({ status: 'idle', data: fallback, error: null });

  const execute = useCallback(async () => {
    // 캐시 확인
    if (cacheKey) {
      const cached = globalQueryCache.get(cacheKey);
      if (cached !== null) {
        resultRef.current = { status: 'success', data: cached, error: null };
        return cached;
      }
    }

    // 재시도 로직
    let lastError;
    for (let i = 0; i < retryCount; i++) {
      try {
        resultRef.current = { status: 'loading', data: fallback, error: null };
        const data = await asyncFn();
        
        // 캐시 저장
        if (cacheKey) {
          globalQueryCache.set(cacheKey, data);
        }
        
        resultRef.current = { status: 'success', data, error: null };
        return data;
      } catch (error) {
        lastError = error;
        if (i < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
        }
      }
    }

    resultRef.current = { status: 'error', data: fallback, error: lastError };
    throw lastError;
  }, dependencies);

  // Suspense 모드
  if (suspense) {
    if (resultRef.current.status === 'idle' || resultRef.current.status === 'loading') {
      if (!promiseRef.current) {
        promiseRef.current = execute();
      }
      throw promiseRef.current;
    }
    
    if (resultRef.current.status === 'error') {
      throw resultRef.current.error;
    }
    
    return resultRef.current.data;
  }

  // 일반 모드
  return useMemo(() => {
    if (resultRef.current.status === 'idle') {
      execute();
    }
    return resultRef.current;
  }, dependencies);
}

/**
 * 메모이제이션된 계산 값
 */
export function useMemoizedValue(computeFn, dependencies, options = {}) {
  const { 
    equals = (a, b) => a === b,
    cacheKey = null 
  } = options;

  const previousValueRef = useRef();

  return useMemo(() => {
    // 캐시 확인
    if (cacheKey) {
      const cached = globalQueryCache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const newValue = computeFn();

    // 깊은 비교
    if (previousValueRef.current !== undefined && equals(previousValueRef.current, newValue)) {
      return previousValueRef.current;
    }

    // 캐시 저장
    if (cacheKey) {
      globalQueryCache.set(cacheKey, newValue);
    }

    previousValueRef.current = newValue;
    return newValue;
  }, dependencies);
}

/**
 * 캐시 관리 유틸리티
 */
export const cacheManager = {
  invalidate: (pattern) => globalQueryCache.invalidatePattern(pattern),
  invalidateAll: () => globalQueryCache.clear(),
  getStats: () => globalQueryCache.getStats(),
  getHitRate: () => globalQueryCache.getHitRate()
};
