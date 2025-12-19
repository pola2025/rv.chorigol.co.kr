# 🏠 초호펜션 관리 시스템

## 📌 프로젝트 개요
초호펜션과 초호쉼터를 통합 관리하는 예약 및 광고 효율 분석 시스템

## 🚀 주요 기능

### 1. 예약 관리
- 📅 **예약 캘린더**: 월별 예약 현황 시각화
- 🏢 **빠른객실관리**: 실시간 객실 상태 관리
- 📊 **간단예약관리**: 재고 매트릭스 관리
- 📋 **예약 목록**: 전체 예약 조회 및 관리

### 2. 광고 효율 분석 (Airtable 연동)
- 📈 **노출/클릭 효율**: CTR, CPC 분석
- 💰 **플랫폼별 비교**: 네이버 vs Meta 광고 성과
- 📊 **비용 효율성**: ROI 및 CPV 분석
- 📉 **월별 트렌드**: 6개월 추이 분석
- 🏠 **방문자 분석**: 홈페이지 & 플레이스 방문 데이터

### 3. 시스템 설정
- 🏠 **객실 관리**: 객실 정보 설정
- 💵 **가격 설정**: 날짜별 가격 규칙
- ⚙️ **옵션 설정**: 추가 옵션 관리
- 📱 **알림 설정**: SMS/텔레그램 알림
- 🔒 **보안 관리**: IP 차단 관리

## 🛠 기술 스택

- **Frontend**: React 18, Vite
- **Backend**: Firebase (Firestore, Auth, Functions)
- **Data**: Airtable API
- **Styling**: CSS Modules
- **State**: Zustand
- **Deploy**: Firebase Hosting

## 📁 프로젝트 구조

```
choho-admin/
├── src/
│   ├── components/
│   │   ├── AirtableDashboard/  # 광고 효율 분석
│   │   ├── Dashboard.jsx        # 메인 대시보드
│   │   └── ...
│   ├── services/
│   │   ├── airtableService.js  # Airtable API
│   │   ├── firebaseService.js  # Firebase 서비스
│   │   └── ...
│   └── config/
│       └── firebase.js          # Firebase 설정
├── .env.local                   # 환경 변수
└── package.json
```

## 🔧 환경 설정

### 1. 환경 변수 (.env.local)
```env
# Firebase
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Airtable
VITE_AIRTABLE_API_KEY=your_airtable_key
VITE_AIRTABLE_BASE_ID=your_base_id
```

### 2. 설치 및 실행
```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 배포
npm run deploy
```

## 📊 Airtable 데이터 구조

### 필수 테이블
1. **광고 데이터** (monthly_ads)
   - 플랫폼별 노출/클릭/비용

2. **방문 데이터** (monthly_visits)
   - 홈페이지 방문자/페이지뷰
   - 플레이스 방문자/페이지뷰

3. **예약 데이터** (reservations)
   - 예약 정보 및 매출

## 🌐 접속 정보

- **개발**: http://localhost:5173
- **프로덕션**: https://choho-admin.web.app

## 📝 주요 문서

- [README.md](./README.md) - 프로젝트 개요 (현재 문서)
- [README_TECHNICAL.md](./README_TECHNICAL.md) - 기술 상세 문서
- [README_PROJECT_STRUCTURE.md](./README_PROJECT_STRUCTURE.md) - 프로젝트 구조
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 배포 가이드
- [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) - 보안 가이드
- [CLEAN_ARCHITECTURE_README.md](./CLEAN_ARCHITECTURE_README.md) - 클린 아키텍처
- [DECLARATIVE_GUIDE.md](./DECLARATIVE_GUIDE.md) - 선언형 프로그래밍 가이드

## ⚡ 빠른 시작

1. **광고 효율 분석 메뉴** 클릭
2. 상단 탭에서 원하는 분석 선택:
   - 노출/클릭 효율
   - 플랫폼별 비교
   - 비용 효율성
   - 월별 트렌드
3. 년/월 선택하여 데이터 조회

## 🔒 보안

- Firebase Authentication으로 인증
- Firestore Security Rules로 데이터 보호
- 환경 변수로 민감 정보 관리
- IP 차단 기능으로 악의적 접근 방지

## 📞 문의

초호펜션 관리 시스템 관련 문의사항은 관리자에게 연락주세요.

---

**Last Updated**: 2025-01-21
**Version**: 2.0.0
