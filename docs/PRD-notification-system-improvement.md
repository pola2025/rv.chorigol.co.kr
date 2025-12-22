# PRD: 알림 시스템 개선

## 문서 정보
- **작성일**: 2025-12-20
- **최종 수정**: 2025-12-21
- **버전**: 2.0
- **목적**: 초호펜션 알림 시스템의 안정적 운영을 위한 개선
- **상태**: 주요 이슈 해결 완료

---

## 1. 현황 분석

### 1.1 시스템 구조
```
예약 생성/수정/취소
    ↓
useReservationStore.js
    ↓
notificationService.js (통합 알림 서비스)
    ↓
┌──────────────────┬────────────────────┐
│ sensService.js   │ telegramService.js │
│ (SMS 발송)       │ (텔레그램 발송)     │
└──────────────────┴────────────────────┘
    ↓
Firebase Functions (SENS API) / Telegram API
```

### 1.2 설정 구조
- **Firestore 문서**: `settings/notifications_v2_choho`, `settings/notifications_v2_shelter`
- **구조**:
  - `globalSettings`: SENS, 텔레그램 API 설정
  - `roomSettings`: 객실별 템플릿, 자동발송 설정

---

## 2. 해결된 문제점

### 2.1 Critical 이슈 (모두 해결)

| # | 문제 | 위치 | 해결 방법 | 상태 |
|---|------|------|-----------|------|
| C1 | 새 예약 시 SMS 미발송 | useReservationStore.js | status='예약확정'이면 sendConfirmationNotifications 호출 | ✅ 완료 |
| C2 | notificationValidator가 구버전 설정 참조 | notificationValidator.js | `notifications_v2_choho` 사용으로 변경 | ✅ 완료 |
| C3 | V2 데이터 구조 미인식 | notificationValidator.js | `roomSettings[].autoSend` 구조 지원 | ✅ 완료 |
| C4 | 스케줄러가 V2 설정 미사용 | notificationScheduler.js | V2 설정 기반 입실/퇴실 안내 로직 추가 | ✅ 완료 |
| C5 | UTC 기반 시간 계산 (KST 필요) | notificationScheduler.js | KST 기준 날짜/시간 함수 적용 | ✅ 완료 |

### 2.2 수정된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/stores/useReservationStore.js` | 새 예약 시 SMS 발송 로직 추가 (Line 204-213) |
| `src/utils/notificationValidator.js` | V2 설정 문서명 및 데이터 구조 지원 |
| `src/services/notificationService.js` | 상세 디버깅 로그 추가, refreshSettings 강화 |
| `src/services/notificationScheduler.js` | V2 기반 입실/퇴실 안내 로직 추가, **KST 기준 시간 처리** |
| `src/utils.js` | KST 유틸리티 함수 추가 (getKSTDateString, getKSTHour, getKSTMinute, getKSTToday) |

---

## 3. 수정 상세 내용

### 3.1 useReservationStore.js - 새 예약 SMS 발송

**문제**: 새 예약 추가 시 텔레그램만 발송되고 SMS는 발송되지 않음

**원인**: `addReservation`에서 `sendNewReservationNotifications` (텔레그램만)만 호출

**해결**:
```javascript
// 예약확정 상태로 저장된 경우 SMS 발송 (네이버 플레이스 등)
if (dataToSave.status === '예약확정') {
    console.log('📬 [Store] 예약확정 상태 - SMS 발송 시작');
    const smsResult = await notificationService.sendConfirmationNotifications({
        ...reservationData,
        id: docRef.id,
        status: '예약확정'
    });
    console.log('📬 [Store] 예약확정 SMS 발송 완료:', smsResult);
}
```

### 3.2 notificationValidator.js - V2 설정 지원

**문제**: `notifications_choho` (구버전) 문서 참조, V2 데이터 구조 미인식

**해결**:
```javascript
// 1. 문서명 변경
const docName = type === 'choho' ? 'notifications_v2_choho' : 'notifications_v2_shelter';

// 2. V2 구조 지원 (roomSettings[].autoSend)
Object.values(roomSettings).forEach(roomSetting => {
  if (roomSetting?.autoSend?.confirmationEnabled) confirmationEnabled = true;
  // ...
});
```

### 3.3 notificationScheduler.js - V2 스케줄러

**문제**: 입실/퇴실 안내가 구버전 설정만 사용

**해결**:
- `checkCheckInNotificationsV2()`, `checkCheckOutNotificationsV2()` 함수 추가
- `sendCheckInNotificationV2()`, `sendCheckOutNotificationV2()` 함수 추가
- 객실별 설정에 따라 개별 발송

---

## 4. 테스트 결과

### 4.1 SMS 발송 테스트 (2025-12-21)

| 테스트 | 결과 | 비고 |
|--------|------|------|
| 새 예약 (네이버 플레이스) + SMS | ✅ 성공 | 예약확정 즉시 SMS 발송 |
| 텔레그램 알림 | ✅ 성공 | 새 예약/확정 알림 정상 |
| Forest 객실 설정 매칭 | ✅ 성공 | confirmationEnabled=true 확인 |

### 4.2 콘솔 로그 확인

```
📬 [VALIDATION] 예약 확정 알림 검증 결과: {canSend: true, ...}
📬 [DEBUG] SMS 발송 조건 체크: {confirmationEnabled: true, shouldSendSms: true}
📡 [SENS] SMS 발송 성공: {statusCode: 202}
```

---

## 5. 알림 발송 흐름도

### 5.1 새 예약 추가 (예약확정 상태)
```
NewReservationModal
    ↓ onSubmit
useReservationStore.addReservation()
    ↓
1. Firestore 저장
2. sendNewReservationNotifications() → 텔레그램
3. status='예약확정'이면:
   sendConfirmationNotifications() → SMS + 텔레그램
```

### 5.2 기존 예약 확정
```
confirmReservation()
    ↓
1. Firestore 상태 업데이트
2. sendConfirmationNotifications() → SMS + 텔레그램
```

### 5.3 스케줄 기반 발송
```
notificationScheduler (10분 주기)
    ↓
loadSettingsV2() - 설정 새로고침
    ↓
checkCheckInNotificationsV2() - 입실 안내
checkCheckOutNotificationsV2() - 퇴실 안내
```

---

## 6. 설정 문서 구조 (V2)

### Firestore: `settings/notifications_v2_choho`
```json
{
  "globalSettings": {
    "sens": {
      "serviceId": "...",
      "accessKey": "...",
      "secretKey": "...",
      "from": "01079320029"
    },
    "telegram": {
      "botToken": "...",
      "chatId": "-1002484830636",
      "useReservation": true,
      "useCancellation": true,
      "autoSendDaily": true
    }
  },
  "roomSettings": {
    "Forest": {
      "enabled": true,
      "autoSend": {
        "confirmationEnabled": true,
        "cancellationEnabled": false,
        "checkInEnabled": true,
        "checkInHoursBefore": 3,
        "checkOutEnabled": true,
        "checkOutHoursBefore": 1
      },
      "templates": {
        "confirmation": { "content": "..." },
        "checkIn": { "content": "..." },
        "checkOut": { "content": "..." }
      }
    }
  }
}
```

---

## 7. 주의사항

### 7.1 설정 변경 시
- 알림 설정 화면에서 "저장" 버튼 클릭 필수
- 저장 후 즉시 Firestore에 반영됨
- 다음 알림 발송 시 최신 설정 자동 로드

### 7.2 디버깅
- 브라우저 콘솔에서 `📬 [DEBUG]`, `📬 [SETTINGS]`, `📬 [VALIDATION]` 로그 확인
- SMS 발송 결과: `📡 [SENS]` 로그 확인

---

## 8. 승인

| 역할 | 이름 | 승인일 |
|------|------|--------|
| 개발 | Claude | 2025-12-21 |
| 테스트 | 사용자 | 2025-12-21 |
