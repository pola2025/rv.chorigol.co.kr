# 🗄️ Stores 폴더 가이드 (Zustand 상태 관리)

## 📁 상태 관리 스토어 구조 및 용도

### 🎯 Zustand 스토어 개요
Zustand는 React를 위한 간단하고 빠른 상태 관리 라이브러리입니다.
Redux보다 간결하며, Context API보다 성능이 우수합니다.

### 📊 스토어 모듈

#### index.js - 스토어 통합 관리
- **목적**: 모든 스토어를 하나로 통합하여 export하는 진입점
- **기능**: 스토어 초기화, 미들웨어 설정, 개발 도구 연동
```javascript
// 사용 예시
import { useStore } from '@/stores';
const { user, reservations } = useStore();
```

#### useFirebaseStore.js - Firebase 연동 상태
- **목적**: Firebase 인증 및 연결 상태 관리
- **주요 상태**: 
  - 사용자 인증 정보 (uid, email, role)
  - Firebase 연결 상태 (online/offline)
  - 실시간 리스너 관리
```javascript
// 상태 구조
{
  user: null | { uid, email, role },
  isAuthenticated: boolean,
  isOnline: boolean,
  listeners: Map<string, unsubscribe>
}
```

#### useReservationStore.js - 예약 전역 상태
- **목적**: 예약 데이터의 중앙 집중식 관리
- **주요 상태**:
  - 전체 예약 목록
  - 필터 및 정렬 상태
  - 선택된 예약 정보
  - 예약 통계 데이터
```javascript
// 상태 구조
{
  reservations: [],
  selectedReservation: null,
  filters: { date, status, room },
  sortBy: 'date' | 'customer' | 'status',
  stats: { total, confirmed, cancelled }
}
```

#### useReservationCache.js - 예약 캐시 관리
- **목적**: 예약 데이터 캐싱 및 성능 최적화
- **주요 기능**:
  - 메모리 캐싱으로 API 호출 최소화
  - 캐시 무효화 전략 구현
  - 낙관적 업데이트 (Optimistic Updates)
  - 백그라운드 동기화
```javascript
// 캐시 구조
{
  cache: Map<string, { data, timestamp, ttl }>,
  pending: Set<string>,
  invalidate: (key) => void,
  prefetch: (keys) => Promise<void>
}
```

## 🏗️ Zustand 스토어 패턴

### 기본 스토어 구조
```javascript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useStore = create(
  devtools(
    persist(
      (set, get) => ({
        // 상태
        data: [],
        loading: false,
        error: null,
        
        // 액션
        fetchData: async () => {
          set({ loading: true });
          try {
            const data = await api.getData();
            set({ data, loading: false });
          } catch (error) {
            set({ error, loading: false });
          }
        },
        
        // 선택자
        getItemById: (id) => {
          return get().data.find(item => item.id === id);
        },
        
        // 리셋
        reset: () => set({ data: [], loading: false, error: null })
      }),
      {
        name: 'store-name', // localStorage 키
        partialize: (state) => ({ data: state.data }) // 일부만 저장
      }
    )
  )
);
```

## 💡 스토어 설계 원칙

### 상태 분리 전략
1. **도메인별 분리**: 예약, 객실, 고객 등 도메인별 스토어
2. **UI 상태 분리**: UI 관련 상태는 별도 스토어로 관리
3. **캐시 분리**: 캐싱 로직은 독립적인 스토어로 구현

### 성능 최적화
```javascript
// 선택적 구독 (필요한 상태만 구독)
const reservations = useReservationStore(state => state.reservations);
const loading = useReservationStore(state => state.loading);

// 얕은 비교로 불필요한 리렌더링 방지
const { date, status } = useReservationStore(
  state => ({ date: state.filters.date, status: state.filters.status }),
  shallow
);
```

## 🔄 미들웨어 활용

### Persist 미들웨어 (영속성)
```javascript
persist(storeCreator, {
  name: 'reservation-storage',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    // 저장할 상태만 선택
    filters: state.filters,
    preferences: state.preferences
  }),
  onRehydrateStorage: () => {
    console.log('Store hydrated from localStorage');
  }
})
```

### DevTools 미들웨어 (디버깅)
```javascript
devtools(storeCreator, {
  name: 'ReservationStore',
  enabled: process.env.NODE_ENV === 'development'
})
```

## 📋 사용 가이드

### 컴포넌트에서 사용
```javascript
// 전체 스토어 사용
function Component() {
  const store = useReservationStore();
  return <div>{store.reservations.length}</div>;
}

// 선택적 사용 (권장)
function OptimizedComponent() {
  const count = useReservationStore(state => state.reservations.length);
  return <div>{count}</div>;
}

// 액션 사용
function ActionComponent() {
  const fetchReservations = useReservationStore(state => state.fetchReservations);
  
  useEffect(() => {
    fetchReservations();
  }, []);
}
```

## 🔐 보안 고려사항

1. **민감 정보**: 토큰, 비밀번호 등은 스토어에 저장하지 않음
2. **암호화**: localStorage 저장 시 민감 데이터 암호화
3. **만료 처리**: 캐시된 데이터에 TTL 설정
4. **정리**: 로그아웃 시 스토어 상태 초기화
