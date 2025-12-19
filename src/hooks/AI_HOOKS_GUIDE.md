# 🪝 Hooks 폴더 가이드

## 📁 커스텀 훅 구조 및 용도

### 🎯 커스텀 훅 개요
React Custom Hooks는 컴포넌트 로직을 재사용 가능한 함수로 추출한 것입니다.
상태 관리, 사이드 이펙트, 데이터 페칭 등의 로직을 캡슐화합니다.

### 📊 데이터 관리 훅

#### useReservations.js - 예약 데이터 관리
- **목적**: 예약 CRUD 작업 및 상태 관리를 위한 통합 인터페이스 제공
- **주요 기능**: 예약 조회, 생성, 수정, 삭제, 필터링, 실시간 업데이트 구독
```javascript
// 사용 예시
const { reservations, loading, error, createReservation, updateReservation } = useReservations();
```

#### useRooms.js - 객실 데이터 관리
- **목적**: 객실 정보 관리 및 가용성 체크 로직 제공
- **주요 기능**: 객실 목록 조회, 상태 업데이트, 가용 객실 필터링, 가격 정보 관리
```javascript
// 사용 예시
const { rooms, availableRooms, getRoomById, updateRoomStatus } = useRooms();
```

#### useCustomers.js - 고객 데이터 관리
- **목적**: 고객 정보 조회 및 관리를 위한 중앙화된 인터페이스
- **주요 기능**: 고객 검색, 예약 이력 조회, 고객 정보 업데이트, VIP 관리
```javascript
// 사용 예시
const { customers, searchCustomer, getCustomerHistory } = useCustomers();
```

### 📈 통계 및 분석 훅

#### useMonthlyStats.js - 월별 통계 관리
- **목적**: 월간 운영 통계 데이터 집계 및 분석 제공
- **주요 기능**: 매출 통계, 객실 가동률, 예약 추세, 전월 대비 성장률 계산
```javascript
// 사용 예시
const { monthlyStats, revenue, occupancyRate, loadMonthlyData } = useMonthlyStats();
```

#### useInventoryReadModel.js - 재고 읽기 모델
- **목적**: 객실 재고 현황을 읽기 최적화된 형태로 제공
- **주요 기능**: 날짜별 재고 조회, 가용성 매트릭스 생성, 캐싱 및 메모이제이션
```javascript
// 사용 예시
const { inventory, getAvailability, refreshInventory } = useInventoryReadModel();
```

### ⚙️ 설정 관리 훅

#### useOptions.js - 옵션 설정 관리
- **목적**: 추가 서비스 옵션 및 부가 상품 관리
- **주요 기능**: 옵션 목록 관리, 가격 설정, 옵션별 예약 통계, 활성화/비활성화
```javascript
// 사용 예시
const { options, addOption, updateOptionPrice, toggleOption } = useOptions();
```

## 🔧 훅 설계 패턴

### 기본 구조
```javascript
function useCustomHook() {
  // 1. 상태 정의
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 2. 사이드 이펙트
  useEffect(() => {
    // 데이터 페칭 또는 구독
  }, [dependencies]);
  
  // 3. 메모이제이션
  const computedValue = useMemo(() => {
    // 복잡한 계산
  }, [data]);
  
  // 4. 콜백 함수
  const handleAction = useCallback(() => {
    // 액션 처리
  }, [dependencies]);
  
  // 5. 반환값
  return {
    data,
    loading,
    error,
    computedValue,
    handleAction
  };
}
```

## 💡 사용 지침

### Best Practices
1. **네이밍**: `use`로 시작하는 카멜케이스 사용
2. **단일 책임**: 하나의 훅은 하나의 관심사만 처리
3. **의존성 관리**: 의존성 배열 정확히 명시
4. **에러 처리**: 모든 비동기 작업에 에러 처리 포함
5. **로딩 상태**: 비동기 작업 시 로딩 상태 제공
6. **메모이제이션**: 성능 최적화를 위한 적절한 메모이제이션

### 반환값 컨벤션
```javascript
return {
  // 데이터
  data,           // 주요 데이터
  
  // 상태
  loading,        // 로딩 중 여부
  error,          // 에러 정보
  
  // 액션
  create,         // 생성 함수
  update,         // 수정 함수
  delete,         // 삭제 함수
  refresh,        // 새로고침 함수
  
  // 유틸리티
  filters,        // 필터 상태
  setFilters,     // 필터 설정
  pagination,     // 페이지네이션
};
```

## 🔄 상태 동기화

- **전역 상태**: Zustand store와 연동
- **로컬 스토리지**: 영속성이 필요한 데이터 저장
- **실시간 동기화**: Firebase 리스너로 실시간 업데이트
- **캐싱 전략**: 자주 사용되는 데이터 메모리 캐싱
