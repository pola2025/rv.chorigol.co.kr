# 🔧 Services 폴더 가이드

## 📁 서비스 모듈 구조 및 용도

### 📊 데이터 연동 서비스
- **airtableService.js**        → Airtable API 연동 서비스
  - 외부 데이터베이스와의 CRUD 작업 처리 및 동기화 로직 구현

### 💰 통계 및 수익 관리
- **monthlyRevenueService.js**  → 월별 수익 계산 서비스
  - 예약 데이터 기반 월별 매출 집계 및 수익 분석 로직 처리
  
- **monthlyStatsService.js**    → 월별 통계 집계 서비스
  - 객실 가동률, 평균 단가, 예약 패턴 등 경영 지표 계산

### 📱 알림 및 메시징 서비스
- **notificationScheduler.js**  → 알림 스케줄링 서비스
  - 예약 확인, 체크인 안내 등 자동 알림 예약 및 발송 관리
  
- **sensService.js**            → NCP SENS SMS 발송 서비스
  - 네이버 클라우드 플랫폼 SMS API를 통한 문자 메시지 발송
  
- **telegramService.js**        → 텔레그램 봇 연동 서비스
  - 관리자 알림 및 실시간 예약 알림을 텔레그램으로 전송

## 🔄 서비스 계층 역할

### 주요 책임
1. **외부 API 통신**: 써드파티 서비스와의 안전한 통신 처리
2. **비즈니스 로직**: 복잡한 계산 및 데이터 처리 로직 구현
3. **데이터 변환**: API 응답 데이터를 앱에서 사용할 형태로 변환
4. **에러 처리**: API 호출 실패 시 재시도 및 에러 핸들링
5. **캐싱 전략**: 성능 향상을 위한 데이터 캐싱 구현

### 사용 예시
```javascript
// 월별 수익 조회
import { getMonthlyRevenue } from './services/monthlyRevenueService';

// SMS 발송
import { sendSMS } from './services/sensService';

// 텔레그램 알림
import { sendTelegramMessage } from './services/telegramService';
```

## 📋 서비스 통합 패턴

1. **싱글톤 패턴**: 서비스 인스턴스를 전역에서 하나만 유지
2. **에러 바운더리**: try-catch로 모든 API 호출 감싸기
3. **로깅**: 모든 외부 통신 로그 기록
4. **환경 변수**: API 키는 .env 파일에서 관리
5. **비동기 처리**: async/await 패턴 일관성 있게 사용

## 🔐 보안 고려사항

- API 키는 절대 코드에 하드코딩하지 않음
- 민감한 데이터는 암호화하여 전송
- Rate limiting 구현으로 API 호출 제한
- 에러 메시지에 민감한 정보 노출 방지
