/**
 * AI_FIRST_DataSourceInfo.jsx
 * 데이터 소스 정보 표시 컴포넌트
 * 각 시설의 데이터 출처를 명확히 표시
 */

import React from 'react';
import { getFacilityDetails, getTableClassification } from '../utils/AI_FIRST_dataMapping';
import '../styles/AI_FIRST_DataSourceInfo.css';

const AI_FIRST_DataSourceInfo = () => {
  const facilityDetails = getFacilityDetails();
  const tableInfo = getTableClassification();
  
  return (
    <div className="ai-first-data-source-info">
      <h4 className="info-title">📊 데이터 소스 구조</h4>
      
      <div className="facility-info-grid">
        {/* 초호 펜션 */}
        <div className="facility-info-card choho">
          <div className="facility-info-header">
            <span className="facility-icon">🏠</span>
            <span className="facility-name">{facilityDetails.choho.name}</span>
          </div>
          <div className="data-sources">
            <div className="source-category">
              <div className="category-title">📱 홈페이지</div>
              <div className="source-item">
                <span className="source-icon">✅</span>
                <span>홈페이지_초호</span>
                <span className="source-type">방문 데이터</span>
              </div>
            </div>
            <div className="source-category">
              <div className="category-title">📍 플레이스</div>
              <div className="source-item">
                <span className="source-icon">✅</span>
                <span>플레이스_초호</span>
                <span className="source-type">노출 데이터</span>
              </div>
            </div>
            <div className="source-category">
              <div className="category-title">📢 광고</div>
              <div className="source-item">
                <span className="source-icon">✅</span>
                <span>네이버광고_초호</span>
                <span className="source-type">광고 데이터</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 초호쉼터 */}
        <div className="facility-info-card shelter">
          <div className="facility-info-header">
            <span className="facility-icon">🏡</span>
            <span className="facility-name">{facilityDetails.shelter.name}</span>
          </div>
          <div className="data-sources">
            <div className="source-category">
              <div className="category-title">📱 홈페이지</div>
              <div className="source-item">
                <span className="source-icon">✅</span>
                <span>홈페이지_초호쉼터</span>
                <span className="source-type">방문 데이터</span>
              </div>
            </div>
            <div className="source-category">
              <div className="category-title">📍 플레이스</div>
              <div className="source-item">
                <span className="source-icon">✅</span>
                <span>플레이스_초호쉼터</span>
                <span className="source-type">노출 데이터</span>
              </div>
            </div>
            <div className="source-category">
              <div className="category-title">📢 광고</div>
              <div className="source-item">
                <span className="source-icon">✅</span>
                <span>Meta</span>
                <span className="source-type">광고 데이터</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="data-structure-summary">
        <h5>데이터 구조 요약</h5>
        <div className="structure-grid">
          <div className="structure-item">
            <span className="structure-label">홈페이지</span>
            <span className="structure-value">초호 + 초호쉼터 (각각 별도)</span>
          </div>
          <div className="structure-item">
            <span className="structure-label">플레이스</span>
            <span className="structure-value">초호 + 초호쉼터 (각각 별도)</span>
          </div>
          <div className="structure-item">
            <span className="structure-label">광고</span>
            <span className="structure-value">초호(네이버) + 초호쉼터(Meta)</span>
          </div>
        </div>
      </div>
      
      <div className="info-footer">
        <p className="update-note">
          ℹ️ 각 시설별로 홈페이지, 플레이스, 광고 데이터가 독립적으로 관리됩니다
        </p>
      </div>
    </div>
  );
};

export default AI_FIRST_DataSourceInfo;
