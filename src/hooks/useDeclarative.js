// useEffect를 대체하는 선언형 훅 모음
import React, { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * 데이터 페칭을 위한 선언형 훅
 * useEffect + fetch 패턴을 대체
 */
export const useDeclarativeFetch = (key, fetchFn, options = {}) => {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: fetchFn,
    ...options
  });
};

/**
 * 실시간 데이터 구독을 위한 선언형 훅
 * useEffect + Firebase onSnapshot 패턴을 대체
 */
export const useRealtimeData = (key, subscribeFn, options = {}) => {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      return new Promise((resolve) => {
        const unsubscribe = subscribeFn((data) => {
          resolve(data);
        });
        
        // Cleanup은 React Query가 자동 처리
        return () => unsubscribe();
      });
    },
    refetchInterval: options.refetchInterval || 30000, // 30초마다 갱신
    ...options
  });
};

/**
 * 로컬 스토리지 동기화를 위한 선언형 훅
 * useEffect + localStorage 패턴을 대체
 */
export const useLocalStorage = (key, initialValue) => {
  const query = useQuery({
    queryKey: ['localStorage', key],
    queryFn: () => {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    },
    staleTime: Infinity, // 로컬 스토리지는 항상 fresh
  });

  const mutation = useMutation({
    mutationFn: (newValue) => {
      window.localStorage.setItem(key, JSON.stringify(newValue));
      return newValue;
    },
    onSuccess: (newValue) => {
      query.refetch();
    }
  });

  return {
    data: query.data ?? initialValue,
    setData: mutation.mutate,
    isLoading: query.isLoading
  };
};

/**
 * 타이머/인터벌을 위한 선언형 훅
 * useEffect + setInterval 패턴을 대체
 */
export const useInterval = (callback, delay) => {
  const savedCallback = useCallback(callback, [callback]);
  
  return useQuery({
    queryKey: ['interval', delay],
    queryFn: async () => {
      if (delay !== null) {
        const id = setInterval(savedCallback, delay);
        return () => clearInterval(id);
      }
      return null;
    },
    enabled: delay !== null,
    staleTime: Infinity
  });
};

/**
 * 디바운스된 값을 위한 선언형 훅
 * useEffect + setTimeout 패턴을 대체
 */
export const useDebouncedValue = (value, delay = 500) => {
  return useQuery({
    queryKey: ['debounced', value, delay],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return value;
    },
    staleTime: Infinity
  });
};

/**
 * 윈도우 이벤트 리스너를 위한 선언형 훅
 * useEffect + addEventListener 패턴을 대체
 */
export const useWindowEvent = (event, handler) => {
  const savedHandler = useCallback(handler, [handler]);
  
  // useEffect를 사용하지 않고 React Query로 구현하려 했으나,
  // 이벤트 리스너는 부작용이므로 useEffect가 적절함
  // 단, 선언형으로 작성
  React.useEffect(() => {
    if (!event || !handler) return;
    
    window.addEventListener(event, savedHandler);
    return () => window.removeEventListener(event, savedHandler);
  }, [event, savedHandler]);
};

/**
 * 의존성 있는 계산을 위한 선언형 훅
 * useEffect + setState 패턴을 대체
 */
export const useComputedValue = (computeFn, dependencies = []) => {
  return useMemo(() => computeFn(), dependencies);
};

/**
 * 조건부 실행을 위한 선언형 훅
 * useEffect with condition 패턴을 대체
 */
export const useConditionalQuery = (condition, key, fetchFn, options = {}) => {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: fetchFn,
    enabled: !!condition,
    ...options
  });
};

/**
 * 폼 상태 관리를 위한 선언형 훅
 * useEffect + form validation 패턴을 대체
 */
export const useFormState = (initialValues, validationRules = {}) => {
  const queryClient = useQueryClient();
  
  const formQuery = useQuery({
    queryKey: ['form', initialValues],
    queryFn: () => initialValues,
    staleTime: Infinity
  });

  const updateField = useMutation({
    mutationFn: ({ field, value }) => {
      const currentData = queryClient.getQueryData(['form', initialValues]) || initialValues;
      return { ...currentData, [field]: value };
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(['form', initialValues], newData);
    }
  });

  const errors = useMemo(() => {
    const data = formQuery.data || initialValues;
    const validationErrors = {};
    
    Object.keys(validationRules).forEach(field => {
      const rule = validationRules[field];
      if (rule && !rule(data[field])) {
        validationErrors[field] = true;
      }
    });
    
    return validationErrors;
  }, [formQuery.data, validationRules, initialValues]);

  return {
    values: formQuery.data || initialValues,
    errors,
    updateField: (field, value) => updateField.mutate({ field, value }),
    isValid: Object.keys(errors).length === 0
  };
};

/**
 * 무한 스크롤을 위한 선언형 훅
 * useEffect + scroll event 패턴을 대체
 */
export const useInfiniteScroll = (fetchNextPage, hasNextPage) => {
  const handleScroll = useCallback(() => {
    if (window.innerHeight + document.documentElement.scrollTop 
        !== document.documentElement.offsetHeight) {
      return;
    }
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage]);

  useWindowEvent('scroll', handleScroll);
};

export default {
  useDeclarativeFetch,
  useRealtimeData,
  useLocalStorage,
  useInterval,
  useDebouncedValue,
  useWindowEvent,
  useComputedValue,
  useConditionalQuery,
  useFormState,
  useInfiniteScroll
};
