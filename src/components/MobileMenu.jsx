// src/components/MobileMenu.jsx
import React from 'react';
import './MobileMenu.css';

const MobileMenu = ({ isOpen, onClose, tabs, activeTab, onTabChange }) => {
  const handleTabClick = (tabId) => {
    onTabChange(tabId);
    onClose();
  };

  return (
    <>
      {/* 오버레이 */}
      {isOpen && (
        <div className="mobile-menu-overlay" onClick={onClose} />
      )}
      
      {/* 메뉴 */}
      <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <h2>
            <span className="menu-header-icon">🏠</span>
            초호 펜션
          </h2>
          <button onClick={onClose} className="mobile-menu-close">
            ✕
          </button>
        </div>
        
        <nav className="mobile-menu-nav">
          {tabs.map(tab => {
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`mobile-menu-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <TabIcon className="mobile-menu-icon" size={20} />
                <span className="mobile-menu-label">{tab.label}</span>
                {tab.id === 'notifications' && (
                  <span className="mobile-menu-badge">NEW</span>
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="mobile-menu-footer">
          <p className="mobile-menu-version">버전 1.0.0</p>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
