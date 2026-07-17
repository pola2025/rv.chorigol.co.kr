"use client";
// 예약 목록 — **레거시 화면을 그대로 렌더한다** (재작성본 폐기).
//
// 확정 아키텍처: Next 가 레거시 컴포넌트를 렌더한다.
// 실측: 이 체인(ReservationsPage → ReservationList/BookingModal)은 react-router·import.meta
// 사용 0건 → 무수정 이식.
//
// 재작성본은 **읽기 전용 표**였다. 레거시는 수정·확정·취소가 되는 진짜 화면이다.
// 스토어 초기화(FirebaseProvider)와 셸(MainLayout)은 app/providers.jsx 가 쥔다.
import ReservationsPage from "../../src/legacy-pages/ReservationsPage.jsx";

export default function Page() {
  return <ReservationsPage />;
}
