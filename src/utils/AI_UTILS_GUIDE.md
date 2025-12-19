# 🛠️ Utils 폴더 가이드

## 📁 유틸리티 함수 구조 및 용도

### 🎯 유틸리티 모듈 개요
재사용 가능한 헬퍼 함수와 공통 로직을 모아놓은 유틸리티 모듈입니다.
비즈니스 로직과 독립적이며, 프로젝트 전반에서 활용됩니다.

### 🔐 보안 및 인증

#### authSecurity.js - 인증 보안 유틸리티
- **목적**: 사용자 인증 및 권한 검증 관련 보안 함수 제공
- **주요 기능**:
  - JWT 토큰 검증 및 디코딩
  - 권한 레벨 체크 (관리자, 직원, 읽기 전용)
  - 세션 만료 시간 관리
  - 비밀번호 강도 검증
```javascript
// 사용 예시
import { validateToken, hasPermission, isSessionValid } from './utils/authSecurity';

if (hasPermission(user, 'ADMIN')) {
  // 관리자 권한 필요한 작업
}
```

### 🔄 연결 관리

#### firebaseReconnect.js - Firebase 재연결 관리
- **목적**: Firebase 연결 끊김 시 자동 재연결 처리
- **주요 기능**:
  - 네트워크 상태 모니터링
  - 자동 재연결 시도 (지수 백오프)
  - 오프라인 데이터 동기화
  - 연결 상태 이벤트 발생
```javascript
// 사용 예시
import { initReconnectManager, onConnectionChange } from './utils/firebaseReconnect';

onConnectionChange((isOnline) => {
  console.log('Connection status:', isOnline);
});
```

### 💰 비즈니스 로직

#### priceCalculator.js - 가격 계산 유틸리티
- **목적**: 복잡한 가격 계산 로직을 중앙화
- **주요 기능**:
  - 시즌별 가격 적용 (성수기, 비수기, 주말)
  - 할인율 계산 (조기예약, 장기투숙)
  - 옵션 가격 합산
  - 세금 및 수수료 계산
```javascript
// 사용 예시
import { calculateTotalPrice, applyDiscount, getSeasonRate } from './utils/priceCalculator';

const totalPrice = calculateTotalPrice({
  basePrice: 100000,
  nights: 2,
  season: 'PEAK',
  options: ['BBQ', 'EXTRA_BED']
});
```

### ⚙️ 옵션 관리

#### optionHelpers.js - 옵션 처리 헬퍼
- **목적**: 추가 옵션 관련 데이터 처리 유틸리티
- **주요 기능**:
  - 옵션 유효성 검증
  - 옵션 조합 규칙 체크
  - 옵션별 가격 계산
  - 옵션 카테고리 분류
```javascript
// 사용 예시
import { validateOptions, getOptionPrice, isOptionAvailable } from './utils/optionHelpers';

const isValid = validateOptions(['BBQ', 'POOL'], roomType);
const optionPrice = getOptionPrice('BBQ', guestCount);
```

### 🐛 디버깅 도구

#### debugOptions.js - 디버그 옵션 설정
- **목적**: 개발 환경에서 디버깅을 위한 유틸리티
- **주요 기능**:
  - 콘솔 로그 레벨 설정
  - 성능 측정 도구
  - 네트워크 요청 로깅
  - 상태 변화 추적
```javascript
// 사용 예시
import { enableDebug, logPerformance, traceStateChange } from './utils/debugOptions';

if (process.env.NODE_ENV === 'development') {
  enableDebug({ 
    logLevel: 'verbose',
    trackPerformance: true,
    logNetworkRequests: true 
  });
}
```

### ❌ 에러 처리

#### errorHandler.js - 중앙 에러 처리
- **목적**: 일관된 에러 처리 및 로깅
- **주요 기능**:
  - 에러 분류 및 포맷팅
  - 사용자 친화적 메시지 변환
  - 에러 로깅 및 보고
  - 에러 복구 전략
```javascript
// 사용 예시
import { handleError, ErrorTypes, formatErrorMessage } from './utils/errorHandler';

try {
  // 위험한 작업
} catch (error) {
  handleError(error, {
    type: ErrorTypes.NETWORK,
    context: 'reservation_creation',
    userId: currentUser.id
  });
}
```

## 📋 유틸리티 함수 패턴

### 순수 함수 원칙
```javascript
// Good - 순수 함수
export const calculatePrice = (base, nights, discount = 0) => {
  return base * nights * (1 - discount);
};

// Bad - 사이드 이펙트
export const calculateAndSave = (base, nights) => {
  const price = base * nights;
  localStorage.setItem('price', price); // 사이드 이펙트
  return price;
};
```

### 에러 핸들링 패턴
```javascript
export const safeParser = (jsonString, defaultValue = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Parse error:', error);
    return defaultValue;
  }
};
```

### 커링 패턴
```javascript
export const createValidator = (rules) => (value) => {
  return rules.every(rule => rule(value));
};

// 사용
const emailValidator = createValidator([
  (v) => v.includes('@'),
  (v) => v.length > 5
]);
```

## 💡 Best Practices

1. **순수 함수**: 사이드 이펙트 없는 순수 함수로 작성
2. **단일 책임**: 하나의 함수는 하나의 기능만 수행
3. **명확한 네이밍**: 함수명으로 기능을 명확히 표현
4. **타입 안정성**: TypeScript 또는 JSDoc으로 타입 명시
5. **에러 처리**: 예상 가능한 에러는 모두 처리
6. **테스트 가능**: 단위 테스트가 쉬운 구조로 작성

## 🧪 테스트 예시

```javascript
// priceCalculator.test.js
describe('priceCalculator', () => {
  test('calculates peak season price correctly', () => {
    const result = calculateTotalPrice({
      basePrice: 100000,
      nights: 2,
      season: 'PEAK'
    });
    expect(result).toBe(240000); // 20% 할증
  });
});
```
