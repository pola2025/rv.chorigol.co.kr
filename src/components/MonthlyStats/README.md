# MonthlyStatsInput 컴포넌트

월별 통계 입력을 위한 하이브리드 React 컴포넌트입니다.

## 주요 기능

### 1. 하이브리드 입력 시스템
- **8월 이후**: 매출 데이터 자동 집계 (예약 데이터 기반)
- **8월 이전**: 수동 입력 모드
- 실시간 자동계산 지표 제공

### 2. 데이터 구조

#### 자동 집계 데이터 (8월 이후)
- 총 매출 (Firestore 예약 데이터 기반)
- 예약 건수
- 객단가 (자동 계산)

#### 수동 입력 데이터
- **방문자 통계**
  - 웹사이트 방문자 (Google Analytics)
  - 네이버 플레이스 방문

- **마케팅 데이터**
  - 광고비 (네이버, 구글, Meta, 카카오, 기타)
  - 클릭 수 (플랫폼별)
  - 노출 수 (플랫폼별)

- **기타 지표**
  - 리뷰 수
  - 블로그 포스팅 수
  - SNS 팔로워 증가

#### 실시간 계산 지표
- 전체 방문자 수
- 총 광고비
- 총 클릭/노출 수
- 평균 CPC/CPM
- CTR (클릭율)
- 전환율 (8월 이후)
- 광고 ROI (8월 이후)

## 사용법

### 기본 사용
```jsx
import { MonthlyStatsInput } from '../components/MonthlyStats';

function App() {
  return (
    <MonthlyStatsInput year={2024} month={8} />
  );
}
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| year | number | 현재 년도 | 통계를 입력할 년도 |
| month | number | 현재 월 | 통계를 입력할 월 (1-12) |

## 스타일링

### CSS 클래스 구조
```css
.monthly-stats-input          /* 메인 컨테이너 */
├── .stats-header            /* 헤더 영역 */
│   ├── .auto-indicator      /* 자동집계 표시 */
│   └── .save-button         /* 저장 버튼 */
├── .stats-grid              /* 그리드 레이아웃 */
    ├── .auto-section        /* 자동집계 섹션 (녹색) */
    ├── .manual-section      /* 수동입력 섹션 */
    └── .calculated-section  /* 계산된 지표 섹션 (노란색) */
```

### 색상 테마
- **자동집계 영역**: 녹색 계열 (`#27ae60`)
- **수동입력 영역**: 기본 흰색 배경
- **계산된 지표**: 노란색 계열 (`#f39c12`)
- **메인 액션**: 파란색 계열 (`#3498db`)

## 데이터 저장

### Firestore 구조
```javascript
// Collection: monthly_stats
// Document ID: {year}-{month} (예: "2024-08")
{
  year: 2024,
  month: 8,
  websiteVisitors: 1500,
  naverPlaceVisits: 800,
  adCost: {
    naver: 100000,
    google: 150000,
    meta: 80000,
    kakao: 50000,
    other: 20000
  },
  clicks: { ... },
  impressions: { ... },
  reviews: 15,
  blogPosts: 8,
  socialFollowers: 120,
  autoRevenue: 5000000,      // 자동집계된 매출
  autoReservations: 45,      // 자동집계된 예약수
  calculatedMetrics: {
    totalVisitors: 2300,
    totalAdCost: 400000,
    conversionRate: 1.96,
    roi: 1150.0
  },
  updatedAt: "2024-08-20T..."
}
```

## 반응형 디자인

### 브레이크포인트
- **Desktop**: > 768px (기본 그리드)
- **Tablet**: ≤ 768px (1열 그리드, 헤더 세로 배치)
- **Mobile**: ≤ 480px (컴팩트 레이아웃)

### 접근성
- 키보드 네비게이션 지원
- 포커스 표시 강화
- `prefers-reduced-motion` 지원
- ARIA 레이블 적용

## 유틸리티 함수

### 포함된 함수들
```javascript
// src/utils.js에서 import
import { 
  formatCurrency,          // 통화 포맷 (1000 → "1,000원")
  formatNumber,            // 숫자 포맷 (1000 → "1,000")
  formatPercentage,        // 퍼센티지 (15.5 → "15.5%")
  calculateConversionRate, // 전환율 계산
  calculateROI            // ROI 계산
} from '../../utils';
```

## 성능 최적화

### 특징
- 실시간 계산으로 즉시 피드백 제공
- debounced 입력 처리 (타이핑 중 과도한 계산 방지)
- 메모이제이션된 계산 결과
- 조건부 렌더링으로 불필요한 DOM 최소화

## 에러 처리

### 포함된 에러 처리
- Firestore 연결 실패
- 데이터 로드/저장 실패
- 잘못된 데이터 형식
- 네트워크 오류

### 사용자 피드백
- 로딩 상태 표시
- 저장 성공/실패 알림
- 입력 유효성 검사

## 확장 가능성

### 추가 가능한 기능
1. **데이터 내보내기**: CSV/Excel 내보내기
2. **비교 분석**: 월별/연도별 비교 차트
3. **목표 설정**: 월별 목표 대비 실적
4. **알림 시스템**: 목표 달성/미달성 알림
5. **대시보드 통합**: 메인 대시보드와 연동

### 커스터마이제이션
- 추가 광고 플랫폼 지원
- 사용자 정의 지표 추가
- 테마 커스터마이징
- 다국어 지원