"use client";
// 레거시 셸 — App.jsx 가 하던 provider 조립을 Next 레이아웃으로 옮긴 것.
//
// App.jsx 원본 구성:
//   QueryClientProvider > BrowserRouter > FirebaseProvider > MainLayout > <Route .../>
// 여기선 BrowserRouter 가 빠진다 (라우팅은 Next 가 한다 — 확정: react-router 폐기).
//
// · QueryClientProvider — MainLayout 이 useQuery 로 모바일 감지를 한다. 없으면 셸이 못 뜬다
// · FirebaseProvider    — 이름만 Firebase. 하는 일은 useFirebaseStore.initialize() 1회이고
//                         그 안은 이미 /api/snapshot(D1) 이다
// · MainLayout          — rv 원본 헤더탭 + 모바일메뉴 + 하단네비
import { useState } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FirebaseProvider } from "../src/providers/FirebaseProvider";
import MainLayout from "../src/layouts/MainLayout";

// App.jsx:30 의 설정을 그대로 옮겼다 (staleTime 5분 / gcTime 10분 / retry 1 / 포커스 재조회 끔)
const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });

export default function Providers({ children }) {
  // 요청마다 새로 만들지 않게 state 로 고정 (App.jsx 는 모듈 스코프였다)
  const [queryClient] = useState(makeQueryClient);
  const pathname = usePathname();

  // 로그인 화면은 셸 없이 — 보호 페이지 링크를 눌러봐야 다시 튕기기만 한다 (구 nav.jsx 와 같은 규칙).
  // 스냅샷 로드(FirebaseProvider)도 돌리지 않는다: 인증 전이라 401 이다.
  // 단 `.app` 래퍼는 씌운다 — App.jsx 도 로그인 화면을 `.app` 안에서 그렸다.
  if (pathname === "/login") return <div className="app">{children}</div>;

  return (
    <QueryClientProvider client={queryClient}>
      {/* `.app` = App.css:13 — width 100% / min-height 100vh / **background #f8f9fa** / flex column.
          이게 없으면 theme.css 의 어두운 body 배경(--bg-secondary)이 그대로 비친다.
          App.jsx 는 로그인 화면까지 포함해 전체를 이 div 로 감싸고 있었다. */}
      <div className="app">
        <FirebaseProvider>
          <MainLayout>{children}</MainLayout>
        </FirebaseProvider>
      </div>
    </QueryClientProvider>
  );
}
