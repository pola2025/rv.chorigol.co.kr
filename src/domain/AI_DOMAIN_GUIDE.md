# 🏛️ Domain 폴더 가이드 (Clean Architecture 핵심)

## 📁 도메인 계층 구조 및 용도

### 🎯 도메인 계층 개요
Domain 계층은 Clean Architecture의 핵심으로, 비즈니스 규칙과 로직을 담당합니다.
외부 의존성이 없으며, 순수한 비즈니스 로직만을 포함합니다.

### 📂 entities/ - 엔티티 (핵심 비즈니스 객체)
- **목적**: 비즈니스 핵심 개념을 표현하는 도메인 모델
- **특징**: ID를 가지며 생명주기 동안 동일성을 유지하는 객체
- **예시**: 
  - `Reservation.js` - 예약 엔티티 (예약번호로 식별)
  - `Room.js` - 객실 엔티티 (객실번호로 식별)
  - `Customer.js` - 고객 엔티티 (고객ID로 식별)

### 📂 value-objects/ - 값 객체 (불변 속성 객체)
- **목적**: 도메인의 측정, 수량, 설명을 표현하는 불변 객체
- **특징**: ID가 없고 속성으로만 식별되며 불변성을 가짐
- **예시**:
  - `Money.js` - 금액 (통화와 값으로 구성)
  - `DateRange.js` - 날짜 범위 (시작일과 종료일)
  - `RoomType.js` - 객실 타입 (스탠다드, 디럭스 등)

### 📂 repositories/ - 리포지토리 인터페이스
- **목적**: 데이터 영속성 계층에 대한 추상화 인터페이스 정의
- **특징**: 구현체가 아닌 인터페이스만 정의 (의존성 역전 원칙)
- **예시**:
  - `ReservationRepository.js` - 예약 데이터 접근 인터페이스
  - `RoomRepository.js` - 객실 데이터 접근 인터페이스
  - `CustomerRepository.js` - 고객 데이터 접근 인터페이스

### 📂 usecases/ - 유스케이스 (비즈니스 시나리오)
- **목적**: 애플리케이션의 비즈니스 규칙과 워크플로우 구현
- **특징**: 입력을 받아 비즈니스 로직을 실행하고 결과 반환
- **예시**:
  - `CreateReservation.js` - 새 예약 생성 유스케이스
  - `CancelReservation.js` - 예약 취소 유스케이스
  - `CheckAvailability.js` - 객실 가용성 확인 유스케이스

### 📂 interfaces/ - 도메인 서비스 인터페이스
- **목적**: 도메인 로직에 필요한 외부 서비스 인터페이스 정의
- **특징**: 도메인이 인프라에 의존하지 않도록 추상화
- **예시**:
  - `NotificationService.js` - 알림 서비스 인터페이스
  - `PaymentService.js` - 결제 서비스 인터페이스
  - `PricingService.js` - 가격 계산 서비스 인터페이스

## 🏗️ Clean Architecture 원칙

### 의존성 규칙
```
도메인 계층 → 의존성 없음 (순수 비즈니스 로직)
    ↑
애플리케이션 계층 → 도메인 계층만 의존
    ↑
인프라 계층 → 모든 계층 의존 가능
```

### 핵심 원칙
1. **비즈니스 로직 중심**: UI나 DB에 독립적인 비즈니스 규칙
2. **의존성 역전**: 상위 계층이 하위 계층에 의존하지 않음
3. **테스트 용이성**: 외부 의존성 없이 단위 테스트 가능
4. **변경 유연성**: 인프라 변경이 비즈니스 로직에 영향 없음

## 💡 도메인 모델링 예시

```javascript
// entities/Reservation.js
class Reservation {
  constructor(id, customerId, roomId, dateRange, status) {
    this.id = id;
    this.customerId = customerId;
    this.roomId = roomId;
    this.dateRange = dateRange; // Value Object
    this.status = status;
  }
  
  cancel() {
    if (this.status === 'CONFIRMED') {
      this.status = 'CANCELLED';
      return true;
    }
    return false;
  }
}

// value-objects/DateRange.js
class DateRange {
  constructor(startDate, endDate) {
    this.startDate = startDate;
    this.endDate = endDate;
    Object.freeze(this); // 불변성 보장
  }
  
  getDays() {
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  }
}
```

## 🔄 도메인 이벤트

- 도메인에서 발생하는 중요한 비즈니스 이벤트 정의
- 예: ReservationCreated, PaymentCompleted, RoomCleaned
- 이벤트 기반 아키텍처로 확장 가능
