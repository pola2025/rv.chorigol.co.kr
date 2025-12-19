# 📊 광고효율분석_대시보드_구현_진행절차가이드

## 🎯 프로젝트 개요
초호펜션 광고효율분석 대시보드를 고급 시각화 도구로 전면 개편하는 단계별 진행 가이드

### ⚠️ 핵심 원칙
- **useEffect 사용 금지**: 모든 사이드 이펙트는 선언형으로 처리
- **React Query**: 데이터 페칭은 useQuery 사용
- **Custom Hooks**: 이벤트 리스너는 커스텀 훅으로 추상화
- **useMemo/useCallback**: 계산 로직은 메모이제이션 활용

---

## 🚀 구현 진행 절차

### 📌 **STEP 0: 초기 설정**
```
요청: "STEP 0 시작 - 초기 설정 진행"

체크리스트:
□ 프로젝트 경로 확인: E:\PENSION_PROJECT\choho-admin\
□ 필수 라이브러리 설치 확인
□ 디렉토리 구조 생성
□ 기존 백업 완료
□ React Query 설정 확인
```

---

### 📌 **STEP 1: CSS 문제 수정**
```
요청: "STEP 1 시작 - CSS 문제 수정"

수정 대상:
□ section-title 어두운 글씨 → 밝은 배경 + 진한 글씨
□ facility-card.total 보라색 블록 → 흰색 텍스트 강제
□ visitor-card.total 보라색 블록 → 흰색 텍스트 강제
□ 전체 여백 축소 (컴팩트 디자인)

확인 방법:
- 브라우저에서 시각적 확인
- 개발자 도구로 CSS 적용 확인
```

---

### 📌 **STEP 2: 선언형 훅 및 데이터 구조 생성**
```
요청: "STEP 2 시작 - 선언형 훅 및 데이터 구조 생성"

구현 내용:
□ AI_FIRST_hooks.js (선언형 커스텀 훅)
□ AI_FIRST_dataStructure.js (데이터 구조)
□ useWindowSize, useDebounce 등 유틸 훅
□ 데이터 평탄화 (최대 2단계)

선언형 훅 예시:
- useAirtableData() // React Query 기반
- useMonthlyStats() // 월별 통계
- useYearlyStats() // 연간 통계
```

#### 선언형 훅 구현 예시:
```javascript
// AI_FIRST_hooks.js
import { useQuery } from '@tanstack/react-query';

// ❌ useEffect 사용 금지
// ✅ React Query 활용
export const useYearlyStats = (year) => {
  return useQuery({
    queryKey: ['yearlyStats', year],
    queryFn: () => fetchYearlyStats(year),
    staleTime: 5 * 60 * 1000, // 5분
    cacheTime: 10 * 60 * 1000 // 10분
  });
};

// ✅ 윈도우 크기 선언형 훅
export const useWindowSize = () => {
  const { data: windowSize } = useQuery({
    queryKey: ['windowSize'],
    queryFn: () => ({
      width: window.innerWidth,
      height: window.innerHeight
    }),
    staleTime: Infinity
  });
  
  // 이벤트 리스너는 별도 커스텀 훅으로
  useWindowEvent('resize', () => {
    queryClient.invalidateQueries(['windowSize']);
  });
  
  return windowSize;
};
```

---

### 📌 **STEP 3: 연간 통계 카드 구현 (선언형)**
```
요청: "STEP 3 시작 - 연간 통계 카드 구현 (선언형)"

구현 파일:
□ AI_FIRST_YearlyStatsCard.jsx
□ AI_FIRST_FacilityComparison.jsx
□ 스타일 파일 생성

선언형 패턴:
- React Query로 데이터 페칭
- useMemo로 계산 로직
- NO useEffect
```

#### 구현 예시:
```javascript
// AI_FIRST_YearlyStatsCard.jsx
const YearlyStatsCard = () => {
  // ✅ 선언형 데이터 페칭
  const { data: yearlyData, isLoading } = useYearlyStats(2025);
  
  // ✅ 메모이제이션으로 계산
  const statistics = useMemo(() => {
    if (!yearlyData) return null;
    return {
      ctr: (yearlyData.clicks / yearlyData.impressions * 100).toFixed(2),
      cpc: Math.round(yearlyData.adCost / yearlyData.clicks),
      roas: (yearlyData.revenue / yearlyData.adCost).toFixed(1)
    };
  }, [yearlyData]);
  
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <div className="ai-first-yearly-stats">
      {/* 렌더링 로직 */}
    </div>
  );
};
```

---

### 📌 **STEP 4: 월별 통합 테이블 구현 (선언형)**
```
요청: "STEP 4 시작 - 월별 통합 테이블 구현 (선언형)"

구현 내용:
□ AI_FIRST_IntegratedMonthlyTable.jsx
□ 1-12월 + 연간 합계 컬럼
□ 컴팩트 테이블 디자인
□ 전월 대비 증감 표시

선언형 처리:
- useMonthlyStats() 훅 사용
- 계산값은 useMemo
- 정렬/필터는 useState + useMemo 조합
```

---

### 📌 **STEP 5: 목표 설정 바 구현 (선언형)**
```
요청: "STEP 5 시작 - 목표 설정 바 구현 (선언형)"

구현 내용:
□ AI_FIRST_GoalBar.jsx
□ 최상단 배치 (테이블 아래)
□ 인라인 프로그레스 바
□ 목표 달성률 표시

선언형 애니메이션:
- @react-spring/web 사용
- CSS transition 활용
- NO setTimeout/setInterval
```

---

### 📌 **STEP 6: 트렌드 차트 구현 (선언형)**
```
요청: "STEP 6 시작 - 트렌드 차트 구현 (선언형)"

구현 차트:
□ AI_FIRST_YearlyTrendChart.jsx (라인차트)
□ AI_FIRST_EfficiencyMatrix.jsx (히트맵)
□ AI_FIRST_FunnelChart.jsx (퍼널)
□ Recharts + Nivo 활용

선언형 차트 데이터:
- useMemo로 차트 데이터 변환
- React Query로 실시간 업데이트
- 애니메이션은 라이브러리 내장 기능 활용
```

---

### 📌 **STEP 7: 데이터 유틸리티 구현 (순수 함수)**
```
요청: "STEP 7 시작 - 데이터 유틸리티 구현 (순수 함수)"

구현 파일:
□ AI_FIRST_dataAggregator.js
□ AI_FIRST_formatters.js
□ AI_FIRST_calculator.js

순수 함수 원칙:
- 사이드 이펙트 없음
- 동일 입력 → 동일 출력
- 불변성 유지
```

#### 유틸리티 예시:
```javascript
// AI_FIRST_dataAggregator.js
// ✅ 순수 함수로 구현
export const aggregateYearlyData = (monthlyData) => {
  return Object.values(monthlyData).reduce((acc, month) => ({
    visitors: acc.visitors + month.visitors,
    clicks: acc.clicks + month.clicks,
    // ...
  }), {
    visitors: 0,
    clicks: 0,
    // ...
  });
};

// ✅ 메모이제이션 적용
export const useAggregatedData = (monthlyData) => {
  return useMemo(() => 
    aggregateYearlyData(monthlyData),
    [monthlyData]
  );
};
```

---

### 📌 **STEP 8: 메인 대시보드 통합 (선언형)**
```
요청: "STEP 8 시작 - 메인 대시보드 통합 (선언형)"

통합 작업:
□ AI_FIRST_Dashboard.jsx 생성
□ 모든 컴포넌트 연결
□ 데이터 플로우 설정
□ 레이아웃 구성

선언형 상태 관리:
- React Query로 서버 상태
- useState로 UI 상태
- Context API로 전역 상태
- NO useEffect
```

#### 메인 대시보드 예시:
```javascript
// AI_FIRST_Dashboard.jsx
const Dashboard = () => {
  // ✅ 선언형 데이터 페칭
  const { data: monthlyData } = useMonthlyStats();
  const { data: yearlyData } = useYearlyStats(2025);
  
  // ✅ 선언형 윈도우 크기
  const windowSize = useWindowSize();
  const isMobile = windowSize?.width < 768;
  
  // ✅ 메모이제이션
  const processedData = useMemo(() => 
    processData(monthlyData, yearlyData),
    [monthlyData, yearlyData]
  );
  
  return (
    <div className="ai-first-dashboard">
      <Suspense fallback={<Loading />}>
        <YearlyStatsCard data={yearlyData} />
        <MonthlyTable data={monthlyData} />
        <TrendChart data={processedData} />
      </Suspense>
    </div>
  );
};
```

---

### 📌 **STEP 9: 반응형 및 성능 최적화 (선언형)**
```
요청: "STEP 9 시작 - 반응형 및 성능 최적화 (선언형)"

최적화 작업:
□ 반응형 브레이크포인트 설정
□ 레이지 로딩 적용
□ useMemo/useCallback 적용
□ React.memo 적용

선언형 최적화:
- useWindowSize() 훅 활용
- CSS Grid/Flexbox 우선
- React.lazy + Suspense
```

---

### 📌 **STEP 10: 테스트 및 디버그**
```
요청: "STEP 10 시작 - 테스트 및 디버그"

테스트 항목:
□ 데이터 연동 테스트
□ 차트 렌더링 테스트
□ 반응형 테스트
□ 성능 테스트
□ useEffect 제거 확인

디버그 체크:
- React Query Devtools 활용
- 콘솔 에러 확인
- 불필요한 리렌더링 체크
```

---

### 📌 **STEP 11: 기존 시스템 연동**
```
요청: "STEP 11 시작 - 기존 시스템 연동"

연동 작업:
□ AirtableDashboard.jsx 교체
□ airtableService.js 수정 (React Query 통합)
□ 라우팅 설정
□ 권한 체크

React Query 통합:
- QueryClient 설정
- 캐싱 전략 수립
- 에러 바운더리 설정
```

---

### 📌 **STEP 12: 최종 검증**
```
요청: "STEP 12 시작 - 최종 검증"

최종 체크리스트:
□ 모든 useEffect 제거 확인
□ 선언형 패턴 적용 확인
□ React Query 정상 작동
□ 메모이제이션 적용
□ 성능 최적화 완료
□ 에러 핸들링 완료
```

---

## 📋 진행 상태 체크리스트

```
전체 진행 상태:
□ STEP 0: 초기 설정
□ STEP 1: CSS 문제 수정
□ STEP 2: 선언형 훅 및 데이터 구조
□ STEP 3: 연간 통계 카드 (선언형)
□ STEP 4: 월별 통합 테이블 (선언형)
□ STEP 5: 목표 설정 바 (선언형)
□ STEP 6: 트렌드 차트 (선언형)
□ STEP 7: 데이터 유틸리티 (순수 함수)
□ STEP 8: 메인 대시보드 통합 (선언형)
□ STEP 9: 반응형 및 성능 최적화 (선언형)
□ STEP 10: 테스트 및 디버그
□ STEP 11: 기존 시스템 연동
□ STEP 12: 최종 검증

현재 진행 중: STEP _____
완료된 단계: _____ / 12
```

---

## 🚫 금지 패턴 체크리스트

```javascript
// ❌ 절대 사용 금지
useEffect(() => {
  // 어떤 코드도 금지
}, []);

// ✅ 대체 패턴
// 1. 데이터 페칭 → useQuery
// 2. 이벤트 리스너 → 커스텀 훅
// 3. 계산 로직 → useMemo
// 4. 함수 메모이제이션 → useCallback
// 5. 구독 → React Query subscriptions
```

---

## 🔧 문제 발생시 대응

### useEffect 발견시:
```
"STEP [번호]에서 useEffect 발견:
[코드 위치]
선언형으로 변경해줘"
```

### 선언형 변환 요청:
```
"STEP [번호]의 [컴포넌트]를
선언형 패턴으로 리팩토링"
```

---

## 💡 사용 방법

1. **시작**: "광고효율분석 대시보드 구현 시작. STEP 0부터 진행 (선언형)"
2. **다음 단계**: "STEP [번호] 완료. 다음 STEP 진행 (useEffect 없이)"
3. **확인**: "STEP [번호] 구현 내용 확인 (선언형 체크)"
4. **수정**: "STEP [번호] useEffect를 선언형으로 수정"
5. **완료**: "STEP 12 최종 검증 완료 (모든 useEffect 제거 확인)"

---

## 📚 참고 자료

### React Query 설정:
```javascript
// queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      cacheTime: 10 * 60 * 1000, // 10분
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});
```

### 커스텀 훅 패턴:
```javascript
// useDeclarative.js
export const useWindowEvent = (event, handler) => {
  // React Query나 다른 선언형 방식으로 구현
};

export const useDebounce = (value, delay) => {
  // useMemo와 useState 조합으로 구현
};
```

---

이 가이드를 따라 모든 구현을 선언형으로 진행하세요!