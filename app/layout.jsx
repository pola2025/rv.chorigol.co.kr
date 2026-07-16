// 초호펜션 예약관리 admin — Next.js App Router 루트 레이아웃
export const metadata = {
  title: "초호펜션 예약관리",
  robots: { index: false, follow: false }, // admin — 검색 색인 차단
};

import Nav from "./nav.jsx";

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily:
            "'Malgun Gothic','Apple SD Gothic Neo',system-ui,sans-serif",
          background: "#f5f6f4",
          color: "#12211c",
        }}
      >
        <Nav />
        {children}
      </body>
    </html>
  );
}
