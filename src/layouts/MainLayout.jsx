// MainLayout.jsx - 공통 레이아웃 컴포넌트
import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MobileMenu from '../components/MobileMenu';
import MobileBottomNav from '../components/MobileBottomNav';
import useFirebaseStore from '../stores/useFirebaseStore';
import { useReservationStatistics } from '../hooks/useReservations';
import {
  CalendarIcon,
  BookingIcon,
  RoomIcon,
  PriceIcon,
  OptionsIcon,
  ChartIcon,
  CustomerIcon
} from '../components/Icons';
import './MainLayout.css';

// 네비게이션 탭 구성 (URL 경로 추가)
const TABS = [
  { id: 'calendar', path: '/calendar', label: '예약 캘린더', Icon: CalendarIcon },
  { id: 'reservations', path: '/reservations', label: '예약 목록', Icon: BookingIcon },
  { id: 'rooms', path: '/rooms', label: '객실 관리', Icon: RoomIcon },
  { id: 'pricing', path: '/pricing', label: '가격 설정', Icon: PriceIcon },
  { id: 'options', path: '/options', label: '옵션 설정', Icon: OptionsIcon },
  { id: 'notifications', path: '/notifications', label: '알림 설정', Icon: CustomerIcon },
  { id: 'airtableStats', path: '/analytics', label: '광고 효율 분석', Icon: ChartIcon },
  { id: 'security', path: '/security', label: '보안 관리', Icon: OptionsIcon },
];

function MainLayout({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 모바일 감지
  const { data: isMobile } = useQuery({
    queryKey: ['isMobile-layout'],
    queryFn: () => window.innerWidth < 768,
    staleTime: Infinity,
    initialData: window.innerWidth < 768
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
    return TABS.find(tab => location.pathname === tab.path || location.pathname.startsWith(tab.path + '/'));
  }, [location.pathname]);

  // 모바일 메뉴에서 탭 변경 시 처리
  const handleMobileTabChange = (tabId) => {
    setIsMobileMenuOpen(false);
  };

  // 하단 네비게이션 탭 변경 시 처리
  const handleBottomNavTabChange = (tabId) => {
    const tab = TABS.find(t => t.id === tabId);
    if (tab) {
      navigate(tab.path);
    }
  };

  return (
    <div className="main-layout">
      {/* 헤더 + 네비게이션 */}
      <header className="layout-header">
        <div className="header-left">
          <Link to="/calendar" className="logo">
            <img
              src="/images/logo-white.webp"
              alt="초호 펜션"
              className="logo-image"
            />
          </Link>
          <nav className="header-nav">
            {TABS.map(tab => {
              const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
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
      <main className={`layout-content ${currentTab?.id === 'airtableStats' ? 'airtable-tab' : ''}`}>
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
        <Outlet />
      </main>

      {/* 모바일 메뉴 */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        tabs={TABS}
        activeTab={currentTab?.id}
        onTabChange={handleMobileTabChange}
        useLinks={true}
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
