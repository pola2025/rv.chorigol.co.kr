"use client";
// 옵션 설정 — **레거시 화면을 그대로 렌더한다** (재작성본 폐기).
//
// 확정 아키텍처: Next 가 레거시 컴포넌트를 렌더한다.
// 실측: 이 체인(OptionsPage → OptionsSettings)은 react-router·import.meta 사용 0건 → 무수정 이식.
// OptionsSettings 의 쓰기는 이미 /api/options·/api/option-settings 로 이식돼 있다.
//
// 재작성본은 **읽기 전용 카드**였다. 레거시는 옵션·노출객실을 실제로 고치는 화면이다.
import OptionsPage from "../../src/legacy-pages/OptionsPage.jsx";

export default function Page() {
  return <OptionsPage />;
}
