"use client";
// MainLayout.jsx - 공통 레이아웃 컴포넌트
//
// react-router → next 로 갈아끼웠다 (확정 아키텍처: react-router 폐기, Next 가 레거시를 렌더).
// 바뀐 건 라우팅 프리미티브 4개뿐이고 마크업·CSS·탭 구성은 그대로다:
//   Link to=       → next/link href=
//   useLocation()  → usePathname()
//   useNavigate()  → useRouter().push()
//   <Outlet />     → {children}   (Next 는 레이아웃이 children 을 받는다)
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MobileMenu from '../components/MobileMenu';
import MobileBottomNav from '../components/MobileBottomNav';
import useFirebaseStore from '../stores/useFirebaseStore';
import { useReservationStatistics } from '../hooks/useReservations';
import {
  CalendarIcon,
  BookingIcon,
  RoomIcon,
  OptionsIcon,
  CustomerIcon
} from '../components/Icons';
import './MainLayout.css';

// 네비게이션 탭 구성 (URL 경로 추가)
const TABS = [
  { id: 'calendar', path: '/calendar', label: '예약 캘린더', Icon: CalendarIcon },
  { id: 'reservations', path: '/reservations', label: '예약 목록', Icon: BookingIcon },
  { id: 'rooms', path: '/rooms', label: '객실 관리', Icon: RoomIcon },
  { id: 'options', path: '/options', label: '옵션 설정', Icon: OptionsIcon },
  { id: 'notifications', path: '/notifications', label: '알림 설정', Icon: CustomerIcon },
];

// user·onLogout 은 레거시가 넘겨받고도 **한 번도 안 쓰던 죽은 prop** 이다 (rv 에 로그아웃 UI 가 없다).
// 시그니처를 children 으로 바꾼다 — Next 레이아웃 규약.
function MainLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 모바일 감지
  const { data: isMobile } = useQuery({
    queryKey: ['isMobile-layout'],
    queryFn: () => window.innerWidth < 768,
    staleTime: Infinity,
    // Next 는 클라이언트 컴포넌트도 SSR 한다 → 렌더 중 window 를 읽으면 서버에서 터진다.
    // (Vite 는 CSR 전용이라 이 코드가 안전했다)
    initialData: typeof window !== 'undefined' ? window.innerWidth < 768 : false
  });

  // Window resize 이벤트 리스너
  React.useEffect(() => {
    const handleResize = () => {
      queryClient.setQueryData(['isMobile-layout'], window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [queryClient]);

  // 통계 가져오기
  const statistics = useReservationStatistics();

  // 현재 활성 탭 확인
  const currentTab = useMemo(() => {
    return TABS.find(tab => pathname === tab.path || pathname.startsWith(tab.path + '/'));
  }, [pathname]);


  // 하단 네비게이션 탭 변경 시 처리
  const handleBottomNavTabChange = (tabId) => {
    const tab = TABS.find(t => t.id === tabId);
    if (tab) {
      router.push(tab.path);
    }
  };

  return (
    <div className="main-layout">
      {/* 헤더 + 네비게이션 */}
      <header className="layout-header">
        <div className="header-left">
          <Link href="/calendar" className="logo">
            <img
              src="/images/logo-white.webp"
              alt="초호 펜션"
              className="logo-image"
            />
          </Link>
          <nav className="header-nav">
            {TABS.map(tab => {
              const isActive = pathname === tab.path || pathname.startsWith(tab.path + '/');
              return (
                <Link
                  key={tab.id}
                  href={tab.path}
                  className={`header-nav-tab ${isActive ? 'active' : ''}`}
                >
                  <span className="header-nav-label">{tab.label}</span>
                  {tab.id === 'notifications' && statistics.pendingPayments > 0 && (
                    <span className="header-nav-badge">{statistics.pendingPayments}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 모바일 메뉴 버튼 */}
        {isMobile && (
          <button
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="메뉴 열기"
          >
            <span className="menu-icon">☰</span>
          </button>
        )}
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main className="layout-content">
        {/* 모바일 페이지 타이틀 */}
        {isMobile && currentTab && (
          <div className="mobile-page-title">
            <h2>
              <currentTab.Icon className="icon" size={20} />
              {currentTab.label}
            </h2>
          </div>
        )}

        {/* 라우트 콘텐츠 */}
        {children}
      </main>

      {/* 모바일 메뉴 */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        tabs={TABS}
        activeTab={currentTab?.id}
      />

      {/* 모바일 하단 네비게이션 */}
      {isMobile && (
        <MobileBottomNav
          activeTab={currentTab?.id}
          onTabChange={handleBottomNavTabChange}
          allTabs={TABS}
        />
      )}
    </div>
  );
}

export default MainLayout;
