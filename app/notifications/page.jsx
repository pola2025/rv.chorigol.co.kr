"use client";
// 알림 설정 — **레거시 화면을 그대로 렌더한다**.
//
// 아키텍처 확정(사용자, 2026-07-17): 최종 화면은 Next 가 레거시 컴포넌트를 렌더한다.
// rv 는 "기존 모습 그대로" 이관이므로 재작성본(NotificationsClient.jsx)이 폐기 대상이다.
//
// 데이터는 전부 클라이언트가 /api/notifications · /api/sms-history 로 가져온다
// (레거시가 Firestore 를 직접 읽던 자리). 그래서 서버 컴포넌트가 할 일이 없다.
import NotificationsPage from "../../src/legacy-pages/NotificationsPage.jsx";

export default function Page() {
  return <NotificationsPage />;
}
