// src/components/MobileBottomNav.jsx
// 모바일 하단 네비게이션 바 컴포넌트
import React, { useState } from 'react';
import {
  CalendarIcon,
  BookingIcon,
  RoomIcon,
  AlertIcon,
  MenuIcon
} from './Icons';
import './MobileBottomNav.css';

// 하단 네비게이션에 표시할 주요 탭 (최대 5개)
const BOTTOM_NAV_TABS = [
  { id: 'calendar', label: '캘린더', Icon: CalendarIcon },
  { id: 'reservations', label: '예약목록', Icon: BookingIcon },
  { id: 'rooms', label: '객실관리', Icon: RoomIcon },
  { id: 'notifications', label: '알림', Icon: AlertIcon },
];

const MobileBottomNav = ({
  activeTab,
  onTabChange,
  allTabs = [],
  onMoreClick
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // "더보기" 메뉴에 표시할 탭들 (하단 네비에 없는 탭들)
  const moreTabs = allTabs.filter(
    tab => !BOTTOM_NAV_TABS.find(navTab => navTab.id === tab.id)
  );

  const handleTabClick = (tabId) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
    setShowMoreMenu(false);
  };

  const handleMoreClick = () => {
    setShowMoreMenu(!showMoreMenu);
    if (onMoreClick) {
      onMoreClick();
    }
  };

  const isActiveInMore = moreTabs.some(tab => tab.id === activeTab);

  return (
    <>
      {/* 더보기 메뉴 오버레이 */}
      {showMoreMenu && (
        <div
          className="bottom-nav-overlay"
          onClick={() => setShowMoreMenu(false)}
        />
      )}

      {/* 더보기 메뉴 */}
      {showMoreMenu && (
        <div className="bottom-nav-more-menu">
          <div className="more-menu-header">
            <span>메뉴</span>
            <button
              className="more-menu-close"
              onClick={() => setShowMoreMenu(false)}
            >
              ✕
            </button>
          </div>
          <div className="more-menu-grid">
            {moreTabs.map(tab => {
              const TabIcon = tab.Icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`more-menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <TabIcon size={24} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 하단 네비게이션 바 */}
      <nav className="mobile-bottom-nav">
        {BOTTOM_NAV_TABS.map(tab => {
          const TabIcon = tab.Icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <TabIcon size={22} />
              <span className="bottom-nav-label">{tab.label}</span>
            </button>
          );
        })}

        {/* 더보기 버튼 */}
        <button
          className={`bottom-nav-item ${isActiveInMore || showMoreMenu ? 'active' : ''}`}
          onClick={handleMoreClick}
        >
          <MenuIcon size={22} />
          <span className="bottom-nav-label">더보기</span>
        </button>
      </nav>
    </>
  );
};

export default MobileBottomNav;
