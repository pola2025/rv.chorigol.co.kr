// 초호펜션 예약관리 admin — Next.js App Router 루트 레이아웃
export const metadata = {
  title: "초호펜션 예약관리",
  robots: { index: false, follow: false }, // admin — 검색 색인 차단
};

// 레거시 전역 CSS — **Vite 진입점(main.jsx·App.jsx)이 로드하던 것과 같은 것**.
// 이게 없으면 컴포넌트별 CSS 는 붙어도 :root 디자인 토큰(--color-*)과 리셋이 없어
// 모달·버튼 같은 것들이 뼈대만 남는다 (실측: 예약 수정 모달이 오버레이 없는 맨 블록으로 나왔다).
//   main.jsx → theme.css + index.css(@import ui-enhancements.css)
//   App.jsx  → App.css(@import vertical-optimization.css + settings-vertical-optimization.css)
import "../src/styles/theme.css";
import "../src/index.css";
import "../src/App.css";
import Providers from "./providers.jsx";

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      {/* body 에 인라인 스타일을 주지 않는다 — 인라인은 스타일시트를 이긴다.
          재작성본 시절의 font/background 인라인이 theme.css:170 의 body 규칙
          (--font-sans / --bg-secondary / --text-primary)을 덮어써서 rv 모양이 안 나온다. */}
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
