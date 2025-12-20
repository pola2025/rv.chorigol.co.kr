# rv-chorigol.co.kr 프로젝트 가이드

## 프로젝트 개요
- **프로젝트명**: 초호펜션 예약 관리 시스템
- **도메인**: rv-chorigol.co.kr
- **기술 스택**: React + Vite, Firebase (Firestore, Auth), Zustand

---

## 배포 정보 (CRITICAL)

### 현재 배포 플랫폼: Vercel
```bash
# 프로덕션 배포
vercel --prod

# 또는
npm run build && vercel --prod
```

### ⚠️ 레거시 (사용 금지)
- `firebase deploy --only hosting` - **사용하지 말 것**
- https://choho-pension.web.app - **레거시 URL**

---

## 알림 시스템

### 텔레그램 채널
- **초호펜션 (Forest 객실)**: `-1002484830636`
- **호수뷰객실 전용**: `-1002863320782`
- **백필 알림 (전체)**: `-1003394139746`

### 알림 발송 위치
- `src/stores/useReservationStore.js` - 예약 추가/확정/취소 시 자동 발송
- `src/services/notificationService.js` - 알림 서비스 로직
- `src/services/telegramService.js` - 텔레그램 API 연동

### SMS 발송
- Naver Cloud SENS 서비스 사용
- `src/services/sensService.js`

---

## 주요 디렉토리 구조

```
src/
├── components/       # UI 컴포넌트
├── stores/          # Zustand 상태 관리
├── services/        # 외부 서비스 연동 (알림, SMS 등)
├── hooks/           # 커스텀 훅
├── pages/           # 페이지 컴포넌트
├── config/          # Firebase 설정
└── utils/           # 유틸리티 함수

functions/           # Firebase Cloud Functions
```

---

## Firebase 설정
- **프로젝트 ID**: `choho-pension`
- **Firestore**: 예약, 고객, 객실 데이터
- **Auth**: 관리자 인증
- **Functions**: 서버리스 함수 (asia-northeast3)

---

## 개발 서버
```bash
npm run dev
```

## 빌드
```bash
npm run build
```

---

## 환경 변수 (.env.local)
- `VITE_FIREBASE_*` - Firebase 설정
- `VITE_TELEGRAM_BOT_TOKEN` - 텔레그램 봇 토큰
- `VITE_TELEGRAM_CHAT_ID` - 텔레그램 채팅 ID
