// React Query 설정 파일
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 선언형 데이터 관리를 위한 기본 설정
      staleTime: 5 * 60 * 1000, // 5분간 fresh 상태 유지
      gcTime: 10 * 60 * 1000, // 10분간 캐시 유지 (구 cacheTime)
      retry: 1, // 실패 시 1회 재시도
      refetchOnWindowFocus: false, // 포커스 시 재요청 안함
      refetchOnReconnect: true, // 재연결 시 재요청
    },
    mutations: {
      retry: 0, // mutation은 재시도 안함
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

// 개발 환경에서 쿼리 캐시 확인용
if (process.env.NODE_ENV === 'development') {
  window.queryClient = queryClient;
}
