> # ⚠️ 이 문서는 낡았다 — 그대로 믿지 말 것 (2026-07-17 확인)
>
> 여기 적힌 파일 **30개 중 20개가 이미 삭제됐다**. 죽은 코드 159개를 정리하면서
> `Dashboard.jsx` 서브트리·`marketing*`·동명이인 컴포넌트들이 전부 사라졌다.
> 이 문서를 근거로 "어떤 컴포넌트가 살아있나"를 판단하면 **틀린다** —
> 실제로 이전 세션들이 `Dashboard.jsx`(사실은 죽은 코드)를 살아있는 화면으로 알고 분석했다.
>
> **살아있는 컴포넌트의 근거는 도달성 그래프뿐이다:**
> ```
> node scripts/audit/reachability.mjs
> ```
> 진짜 진입점(index.html → src/main.jsx, Next 규약 app/**/page|route|layout)에서 BFS 하고,
> 정적·동적 import·re-export·CSS @import 까지 따라간다. grep 으로 세면 안 된다
> (죽은 파일이 죽은 파일을 import 해서 살아 보인다).
>
> 아래 내용은 참고용 히스토리로만 남긴다.

# 🧩 Components 폴더 가이드

## 📁 컴포넌트 구조 및 용도

### 📊 대시보드 컴포넌트
- **Dashboard.jsx**             → 메인 대시보드 화면 (예약 현황, 통계 요약 표시)
- **AirtableDashboard/**        → Airtable 연동 대시보드 (외부 데이터 시각화)

### 📅 캘린더 및 예약 관리
- **CustomCalendar.jsx**        → 데스크톱용 예약 캘린더 (월별 예약 현황 표시)
- **MobileCalendar.jsx**        → 모바일 최적화 캘린더 (터치 인터페이스 지원)
- **MobileCalendarEnhanced.jsx**→ 모바일 캘린더 개선 버전 (성능 최적화 적용)
- **DateDetailPanel.jsx**       → 날짜별 상세 정보 패널 (특정 날짜 예약 상세 표시)

### 🏨 예약 리스트 컴포넌트
- **ReservationList.jsx**       → 기본 예약 목록 (전체 예약 리스트 표시)
- **ReservationListEnhanced.jsx**→ 성능 최적화된 예약 목록 (가상 스크롤링 적용)
- **OptimizedReservationList.jsx**→ 추가 최적화 예약 목록 (메모이제이션 적용)

### 🏠 객실 관리
- **RoomManagement.jsx**        → 객실 정보 관리 (객실 추가/수정/삭제)
- **QuickRoomManagement.jsx**   → 빠른 객실 관리 (간편한 상태 변경 UI)
- **InventoryMatrix.jsx**       → 객실 재고 매트릭스 (날짜별 객실 가용성 표시)
- **MobileInventoryMatrix.jsx** → 모바일용 재고 매트릭스 (반응형 디자인)

### 💰 예약 모달
- **BookingModal.jsx**          → 예약 생성/수정 모달 (예약 정보 입력 폼)
- **CancelReservationModal.jsx**→ 예약 취소 확인 모달 (취소 사유 입력)

### ⚙️ 설정 관리
- **PricingSettings.jsx**       → 가격 설정 관리 (시즌별/객실별 가격 설정)
- **OptionsSettings.jsx**       → 옵션 설정 관리 (추가 서비스 옵션 설정)
- **NotificationSettings.jsx**  → 알림 설정 관리 (SMS/이메일 알림 설정)
- **MessageTemplates.jsx**      → 메시지 템플릿 관리 (자동 발송 메시지 편집)
- **BlockedIPManager.jsx**      → IP 차단 관리 (악성 접근 IP 관리)

### 📈 통계 및 마케팅
- **statistics/**               → 통계 관련 컴포넌트 (매출, 점유율 등)
- **MonthlyStats/**             → 월별 통계 컴포넌트 (월간 실적 분석)
- **MarketingStats.jsx**        → 마케팅 통계 (채널별 성과 분석)
- **marketing/**                → 마케팅 관련 컴포넌트 v1
- **marketing-v2/**             → 마케팅 관련 컴포넌트 v2 (개선 버전)

### 🎨 UI 요소
- **Icons.jsx**                 → 아이콘 컴포넌트 모음 (SVG 아이콘 세트)
- **CustomerBadge.jsx**         → 고객 등급 배지 (VIP, 일반 등 표시)
- **OptionRenderer.jsx**        → 옵션 렌더링 컴포넌트 (선택 옵션 표시)
- **MobileMenu.jsx**            → 모바일 메뉴 (햄버거 메뉴 네비게이션)

### 🛠️ 유틸리티 컴포넌트
- **LazyImage.jsx**             → 지연 로딩 이미지 (성능 최적화용)
- **VirtualList.jsx**           → 가상 스크롤 리스트 (대용량 리스트 렌더링)
- **DebugPanel.jsx**            → 디버그 패널 (개발용 상태 모니터링)
- **PerformanceMonitor.jsx**    → 성능 모니터링 (렌더링 성능 추적)

### 🔐 인증
- **LoginScreen.jsx**           → 로그인 화면 (관리자 인증 화면)

### 🗂️ Airtable 연동
- **airtable/**                 → Airtable API 연동 컴포넌트 (외부 DB 동기화)

## 💡 컴포넌트 사용 규칙

1. **네이밍 규칙**: PascalCase 사용 (예: BookingModal.jsx)
2. **스타일 파일**: 동일한 이름의 .css 파일로 스타일 관리
3. **모바일 대응**: Mobile 접두사로 모바일 전용 컴포넌트 구분
4. **성능 최적화**: Enhanced/Optimized 접미사로 최적화 버전 표시
5. **폴더 구조**: 관련 컴포넌트는 폴더로 그룹화 (예: statistics/, marketing/)
