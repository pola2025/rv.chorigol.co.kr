# PRD: 마케팅 통계 날짜 필터링 및 검색어 기능 개선

## 1. 개요

### 1.1 문제 정의
마케팅 통계 페이지에서 날짜 필터링이 제대로 작동하지 않고, 일부 값이 하드코딩되어 있으며, 검색어 탭 데이터가 없는 상태입니다.

### 1.2 영향 범위
- **개요(상단 요약)**: 날짜 필터와 무관하게 고정값 표시
- **유입분석**: 날짜 필터링 미작동
- **검색어 탭**: 데이터 없음 (기능 미구현)
- **방문자 통계**: 날짜 필터 작동 여부 점검 필요

---

## 2. 현재 상태 분석

### 2.1 MonthlyStats.jsx (개요/상단 요약) - 🔴 문제 있음
```
위치: src/components/marketing-v2/MonthlyStats.jsx
```

**문제점:**
- `loadPreviousMonthsData()` 함수가 컴포넌트 마운트 시 1회만 실행
- 항상 **현재 날짜 기준** 전전월/전월만 표시
- `selectedMonth` 변경과 연동되지 않음

**현재 코드 (Line 51-53):**
```javascript
useEffect(() => {
  loadPreviousMonthsData();
}, []);  // ← 빈 배열! 날짜 변경에 반응 안 함
```

**현재 코드 (Line 80-87):**
```javascript
const loadPreviousMonthsData = async () => {
  const now = new Date();  // ← 항상 현재 날짜!
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // ...
};
```

---

### 2.2 DashboardStats.jsx / DashboardStatsV2.jsx - 🔴 문제 있음
```
위치: src/components/marketing-v2/DashboardStats.jsx
위치: src/components/marketing-v2/DashboardStatsV2.jsx
```

**문제점:**
1. **날짜 선택 UI 없음** - 현재 월만 고정 표시
2. **하드코딩된 값들:**
   - Line 289, 293: `32` (예약 건수)
   - Line 301: `32` (객단가 계산)
   - Line 305: `2` (리뷰 수)
   - Line 243-245: 웹사이트/네이버 비율 `0.6`/`0.4` 하드코딩

**현재 코드 (Line 20-21):**
```javascript
const currentMonth = getKSTToday().slice(0, 7);  // ← 항상 현재 월!
```

**하드코딩 문제 (Line 289-294):**
```javascript
{statsData.currentMonth.visitors > 0
  ? ((32 / statsData.currentMonth.visitors) * 100).toFixed(1)  // 32 하드코딩!
  : '0'}
// ...
예약 신청: 32건  // 하드코딩!
```

---

### 2.3 검색어 탭 - 🔴 기능 없음
```
현재 상태: 미구현
```

**필요 사항:**
- 네이버 검색광고 API 연동 필요
- 검색어별 검색량 조회 기능

**사용자 요청 키워드:**
- 초호펜션
- 초호쉼터
- 초리골164카페

**API 정보 (제공됨):**
```json
{
  "naver_searchad": {
    "NAVER_AD_ACCESS_LICENSE": "0100000000c00ae8a28657f54600760fdd62b10a9fee18c318ab638d6a7dc77eae37bf53dd",
    "NAVER_AD_SECRET_KEY": "AQAAAADACuiihlf1RgB2D91isQqffrx2bXGlSs7jB79+AJyYNg=="
  }
}
```

---

### 2.4 VisitorsTab.jsx (방문자 통계) - 🟡 점검 필요
```
위치: src/components/marketing-v2/VisitorsTab.jsx
```

**현재 상태:**
- 상위 컴포넌트(MarketingStatsV2)에서 `currentMonthData?.visitors` 전달받음
- MarketingStatsV2에서 `selectedMonth` 변경 시 데이터 재로드

**점검 필요:**
- Firebase 데이터 존재 여부 확인
- 날짜 변경 시 실제 데이터 변경 여부 확인

---

### 2.5 IntegratedStats.jsx (통합 통계) - 🟢 정상 추정
```
위치: src/components/marketing-v2/IntegratedStats.jsx
```

**현재 상태:**
- `selectedMonth` prop 받아서 데이터 로드
- useEffect에서 `[selectedMonth]` 의존성 배열 사용 (정상)

```javascript
useEffect(() => {
  loadIntegratedData();
  loadCumulativeData();
}, [selectedMonth]);  // ← 정상 작동
```

---

## 3. 수정 계획

### 3.1 Phase 1: MonthlyStats 날짜 연동 수정
**목표:** 상단 요약이 선택된 월에 따라 변경되도록 수정

**수정 내용:**
1. `selectedMonth` prop 추가
2. `loadPreviousMonthsData` 함수가 선택된 월 기준으로 계산하도록 변경
3. useEffect 의존성에 `selectedMonth` 추가

**예상 변경:**
```javascript
// Before
useEffect(() => {
  loadPreviousMonthsData();
}, []);

// After
useEffect(() => {
  loadPreviousMonthsData(selectedMonth);
}, [selectedMonth]);
```

---

### 3.2 Phase 2: DashboardStats 하드코딩 제거 및 날짜 선택 추가
**목표:** 하드코딩된 값을 실제 데이터로 대체

**수정 내용:**
1. 날짜 선택 UI 추가 (선택적)
2. 예약 건수 실제 데이터로 대체 (reservations 컬렉션에서 조회)
3. 리뷰 수 실제 데이터로 대체
4. 웹사이트/네이버 비율을 실제 데이터로 계산

**데이터 소스:**
- 예약 건수: `reservations` 컬렉션에서 해당 월 예약 count
- 리뷰 수: `marketing_stats_v2` 컬렉션의 `visitors.naverPlace.reviews`
- 방문자 분리: `marketing_stats_v2` 컬렉션의 각 소스별 데이터

---

### 3.3 Phase 3: 검색어 탭 구현
**목표:** 네이버 검색광고 API를 활용한 검색어 검색량 조회

**구현 내용:**
1. 네이버 검색광고 API 서비스 모듈 생성
2. 검색어 탭 UI 컴포넌트 생성
3. 기본 검색어 목록 관리 기능

**API 연동:**
- 엔드포인트: `https://api.searchad.naver.com/keywordstool`
- 인증: Access License + Secret Key 기반 서명

**UI 요구사항:**
- 검색어 입력 필드
- 검색량 결과 테이블 (월간 검색량, PC/모바일 비율)
- 날짜 기간 선택

---

### 3.4 Phase 4: 방문자 통계 점검 및 보완
**목표:** 날짜 필터링 정상 작동 확인

**점검 항목:**
1. Firebase `marketing_stats_v2` 컬렉션 데이터 존재 여부
2. 날짜 변경 시 네트워크 요청 발생 확인
3. 반환 데이터가 UI에 정상 반영되는지 확인

---

## 4. 파일 변경 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/components/marketing-v2/MonthlyStats.jsx` | 수정 | selectedMonth 연동 |
| `src/components/marketing-v2/MarketingStatsV2.jsx` | 수정 | MonthlyStats에 selectedMonth 전달 |
| `src/components/marketing-v2/DashboardStats.jsx` | 수정 | 하드코딩 제거, 실제 데이터 사용 |
| `src/components/marketing-v2/DashboardStatsV2.jsx` | 수정 | 하드코딩 제거, 실제 데이터 사용 |
| `src/services/naverSearchAdService.js` | 신규 | 네이버 검색광고 API 서비스 |
| `src/components/marketing-v2/KeywordTab.jsx` | 신규 | 검색어 탭 UI |
| `src/components/marketing-v2/KeywordTab.css` | 신규 | 검색어 탭 스타일 |

---

## 5. 우선순위

| 순서 | 작업 | 우선순위 | 예상 난이도 |
|------|------|----------|-------------|
| 1 | MonthlyStats 날짜 연동 | 높음 | 낮음 |
| 2 | DashboardStats 하드코딩 제거 | 높음 | 중간 |
| 3 | 방문자 통계 점검 | 중간 | 낮음 |
| 4 | 검색어 탭 구현 | 중간 | 높음 |

---

## 6. 성공 기준

- [ ] 날짜 필터 변경 시 상단 요약(MonthlyStats)이 해당 기간 데이터 표시
- [ ] DashboardStats에서 하드코딩된 값이 실제 데이터로 대체
- [ ] 검색어 탭에서 키워드 검색량 조회 가능
- [ ] 방문자 통계 탭에서 날짜 변경 시 데이터 정상 변경

---

## 7. 기술 요구사항

### 7.1 네이버 검색광고 API
- API URL: `https://api.searchad.naver.com`
- 인증 방식: `X-API-KEY`, `X-Customer`, `X-Timestamp`, `X-Signature`
- CORS 문제로 인해 프록시 서버 또는 Firebase Functions 필요

### 7.2 Firebase 데이터 구조
```
marketing_stats_v2/
  └── {businessType}_{YYYY-MM}/
      ├── revenue
      ├── visitors
      │   ├── website
      │   └── naverPlace
      └── advertising
```

---

**문서 버전:** 1.0
**작성일:** 2025-12-21
**작성자:** Claude Code
