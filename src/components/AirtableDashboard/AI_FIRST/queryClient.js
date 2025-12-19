/**
 * React Query Client 설정
 * 선언형 데이터 페칭을 위한 기본 설정
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      cacheTime: 10 * 60 * 1000, // 10분
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchInterval: false
    },
    mutations: {
      retry: 1
    }
  }
});

// 전역 에러 핸들러
queryClient.setMutationDefaults(['default'], {
  mutationFn: async (variables) => {
    throw new Error('Mutation function not implemented');
  },
  onError: (error) => {
    console.error('Mutation error:', error);
  }
});

// 전역 성공 핸들러
queryClient.setQueryDefaults(['default'], {
  queryFn: async () => {
    throw new Error('Query function not implemented');
  },
  onError: (error) => {
    console.error('Query error:', error);
  }
});

export default queryClient;
