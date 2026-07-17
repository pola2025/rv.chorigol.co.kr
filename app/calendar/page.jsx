"use client";
// 예약 캘린더 — **레거시 화면을 그대로 렌더한다** (재작성본 CalendarClient 폐기).
//
// 아키텍처 확정(사용자, 2026-07-17): 최종 화면은 Next 가 레거시 컴포넌트를 렌더한다.
//
// 이 체인(CalendarPage → ReservationCalendar → CustomCalendar/NewReservationModal/
// CancelReservationModal)은 **react-router 를 안 쓴다**(실측 0건) → Next 에 그대로 올라간다.
// 데이터는 useFirebaseStore 가 /api/snapshot 으로 가져온다(이미 이식됨. Firebase 접점 없음).
//
// 스토어 초기화(FirebaseProvider)와 셸(MainLayout)은 app/providers.jsx 가 쥔다 — 전 화면 공통이다.
import CalendarPage from "../../src/legacy-pages/CalendarPage.jsx";

export default function Page() {
  return <CalendarPage />;
}
