"use client";
// 객실 관리 — **레거시 화면을 그대로 렌더한다** (재작성본 폐기).
//
// 확정 아키텍처: Next 가 레거시 컴포넌트를 렌더한다.
// 실측: 이 체인(RoomsPage → RoomManagement)은 react-router·import.meta 사용 0건 → 무수정 이식.
// RoomManagement 의 쓰기는 이미 /api/rooms 로 이식돼 있다 (split-brain 해소, 커밋 33665e6).
//
// 재작성본은 **읽기 전용 표**였다. 레거시는 요금·재고를 실제로 고치는 화면이다.
import RoomsPage from "../../src/legacy-pages/RoomsPage.jsx";

export default function Page() {
  return <RoomsPage />;
}
