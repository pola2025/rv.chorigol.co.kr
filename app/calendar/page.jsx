"use client";
// 예약 캘린더 — **레거시 화면을 그대로 렌더한다** (재작성본 CalendarClient 폐기).
//
// 아키텍처 확정(사용자, 2026-07-17): 최종 화면은 Next 가 레거시 컴포넌트를 렌더한다.
//
// 이 체인(CalendarPage → ReservationCalendar → CustomCalendar/NewReservationModal/
// CancelReservationModal)은 **react-router 를 안 쓴다**(실측 0건) → Next 에 그대로 올라간다.
// 데이터는 useFirebaseStore 가 /api/snapshot 으로 가져온다(이미 이식됨. Firebase 접점 없음).
//
// FirebaseProvider 는 이름만 Firebase 다 — 하는 일은 store.initialize() 한 번뿐이고
// 그 안은 이미 D1 이다. 이게 없으면 스토어가 비어 캘린더가 빈 화면이 된다.
import { FirebaseProvider } from "../../src/providers/FirebaseProvider";
import CalendarPage from "../../src/legacy-pages/CalendarPage.jsx";

export default function Page() {
  return (
    <FirebaseProvider>
      <CalendarPage />
    </FirebaseProvider>
  );
}
