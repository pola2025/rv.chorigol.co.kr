// src/components/MonthlyStats/IntegratedStatsView.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatCurrency, formatNumber, formatPercentage, calculateConversionRate, calculateROI } from '../../utils';
import './IntegratedStatsView.css';

const IntegratedStatsView = () => {
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [pensionData, setPensionData] = useState(null);
  const [shelterData, setShelterData] = useState(null);
  
  const monthName = `${selectedYear}년 ${selectedMonth}월`;
  const isAutoRevenueMonth = selectedMonth >= 8;

  useEffect(() => {
    loadBothPensionsData();
  }, [selectedYear, selectedMonth]);

  const loadBothPensionsData = async () => {
    setLoading(true);
    try {
      const docId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      
      // 초호펜션 데이터 로드
      const pensionDocRef = doc(db, 'monthly_stats_pension', docId);
      const pensionDocSnap = await getDoc(pensionDocRef);
      
      // 초호쉼터 데이터 로드
      const shelterDocRef = doc(db, 'monthly_stats_shelter', docId);
      const shelterDocSnap = await getDoc(shelterDocRef);
      
      setPensionData(pensionDocSnap.exists() ? pensionDocSnap.data() : null);
      setShelterData(shelterDocSnap.exists() ? shelterDocSnap.data() : null);
      
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 초호쉼터 네이버 광고비 계산
  const calculateShelterNaverAdCost = () => {
    if (!shelterData || !pensionData) return 0;
    // 전체통계 - 초호 = 초호쉼터
    const totalNaver = shelterData.naverAdCostTotal || 0;
    const pensionNaver = pensionData.naverAdCostTotal || 0;
    return Math.max(0, totalNaver - pensionNaver);
  };

  // 통합 통계 계산
  const calculateIntegratedStats = () => {
    const pensionStats = pensionData || {};
    const shelterStats = shelterData || {};
    
    // 초호쉼터 네이버 광고비 계산
    const shelterNaverCost = calculateShelterNaverAdCost();
    
    return {
      // 매출 관련
      totalRevenue: (pensionStats.autoRevenue || 0) + (shelterStats.autoRevenue || 0),
      totalReservations: (pensionStats.autoReservations || 0) + (shelterStats.autoReservations || 0),
      
      // 방문자 통계
      totalVisitors: (pensionStats.websiteVisitors || 0) + (shelterStats.websiteVisitors || 0) +
                     (pensionStats.naverPlaceVisits || 0) + (shelterStats.naverPlaceVisits || 0),
      websiteVisitors: (pensionStats.websiteVisitors || 0) + (shelterStats.websiteVisitors || 0),
      websitePageviews: (pensionStats.websitePageviews || 0) + (shelterStats.websitePageviews || 0),
      naverPlaceVisits: (pensionStats.naverPlaceVisits || 0) + (shelterStats.naverPlaceVisits || 0),
      
      // 광고비
      totalAdCost: {
        naver: (pensionStats.adCost?.naver || 0) + shelterNaverCost,
        google: (pensionStats.adCost?.google || 0) + (shelterStats.adCost?.google || 0),
        meta: (pensionStats.adCost?.meta || 0) + (shelterStats.adCost?.meta || 0),
        kakao: (pensionStats.adCost?.kakao || 0) + (shelterStats.adCost?.kakao || 0),
        other: (pensionStats.adCost?.other || 0) + (shelterStats.adCost?.other || 0)
      },
      
      // 광고 성과
      totalClicks: {
        naver: (pensionStats.clicks?.naver || 0) + (shelterStats.clicks?.naver || 0),
        google: (pensionStats.clicks?.google || 0) + (shelterStats.clicks?.google || 0),
        meta: (pensionStats.clicks?.meta || 0) + (shelterStats.clicks?.meta || 0),
        kakao: (pensionStats.clicks?.kakao || 0) + (shelterStats.clicks?.kakao || 0),
        other: (pensionStats.clicks?.other || 0) + (shelterStats.clicks?.other || 0)
      },
      
      totalImpressions: {
        naver: (pensionStats.impressions?.naver || 0) + (shelterStats.impressions?.naver || 0),
        google: (pensionStats.impressions?.google || 0) + (shelterStats.impressions?.google || 0),
        meta: (pensionStats.impressions?.meta || 0) + (shelterStats.impressions?.meta || 0),
        kakao: (pensionStats.impressions?.kakao || 0) + (shelterStats.impressions?.kakao || 0),
        other: (pensionStats.impressions?.other || 0) + (shelterStats.impressions?.other || 0)
      },
      
      // 기타
      totalReviews: (pensionStats.reviews || 0) + (shelterStats.reviews || 0)
    };
  };

  if (loading) {
    return <div className="integrated-stats-loading">데이터를 불러오는 중...</div>;
  }

  const integratedStats = calculateIntegratedStats();
  const totalAdCostSum = Object.values(integratedStats.totalAdCost).reduce((sum, cost) => sum + cost, 0);
  const totalClicksSum = Object.values(integratedStats.totalClicks).reduce((sum, clicks) => sum + clicks, 0);
  const totalImpressionsSum = Object.values(integratedStats.totalImpressions).reduce((sum, imp) => sum + imp, 0);
  
  const avgCPC = totalClicksSum > 0 ? totalAdCostSum / totalClicksSum : 0;
  const avgCPM = totalImpressionsSum > 0 ? (totalAdCostSum / totalImpressionsSum) * 1000 : 0;
  const ctr = totalImpressionsSum > 0 ? (totalClicksSum / totalImpressionsSum) * 100 : 0;
  const conversionRate = calculateConversionRate(integratedStats.totalReservations, integratedStats.totalVisitors);
  const roi = calculateROI(integratedStats.totalRevenue, totalAdCostSum);

  return (
    <div className="integrated-stats-view">
      <div className="stats-header">
        <h2>📊 통합 통계 - {monthName}</h2>
        <div className="period-selector">
          <button 
            className="nav-btn"
            onClick={() => {
              if (selectedMonth === 1) {
                setSelectedYear(selectedYear - 1);
                setSelectedMonth(12);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
          >
            이전 ◀
          </button>
          
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="year-select"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="month-select"
          >
            {Array.from({length: 12}, (_, i) => i + 1).map(month => (
              <option key={month} value={month}>{month}월</option>
            ))}
          </select>
          
          <button 
            className="nav-btn"
            onClick={() => {
              if (selectedMonth === 12) {
                setSelectedYear(selectedYear + 1);
                setSelectedMonth(1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
          >
            다음 ▶
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {/* 매출 통계 */}
        {isAutoRevenueMonth && (
          <div className="stats-card revenue-card">
            <h3>💰 매출 통계</h3>
            <div className="stats-row">
              <div className="stat-item">
                <label style={{ textShadow: 'none' }}>총 매출</label>
                <div className="stat-value primary" style={{ textShadow: 'none' }}>{formatCurrency(integratedStats.totalRevenue)}</div>
              </div>
              <div className="stat-item">
                <label style={{ textShadow: 'none' }}>총 예약 건수</label>
                <div className="stat-value" style={{ textShadow: 'none' }}>{formatNumber(integratedStats.totalReservations)}건</div>
              </div>
              <div className="stat-item">
                <label style={{ textShadow: 'none' }}>평균 객단가</label>
                <div className="stat-value" style={{ textShadow: 'none' }}>
                  {integratedStats.totalReservations > 0 
                    ? formatCurrency(integratedStats.totalRevenue / integratedStats.totalReservations)
                    : '0원'}
                </div>
              </div>
            </div>
            <div className="pension-breakdown">
              <div className="breakdown-item">
                <span className="pension-label">🏠 초호펜션</span>
                <span className="pension-value">{formatCurrency(pensionData?.autoRevenue || 0)}</span>
                <span className="pension-count">({pensionData?.autoReservations || 0}건)</span>
              </div>
              <div className="breakdown-item">
                <span className="pension-label">🏡 초호쉼터</span>
                <span className="pension-value">{formatCurrency(shelterData?.autoRevenue || 0)}</span>
                <span className="pension-count">({shelterData?.autoReservations || 0}건)</span>
              </div>
            </div>
          </div>
        )}

        {/* 방문자 통계 */}
        <div className="stats-card visitor-card">
          <h3 style={{ textShadow: 'none' }}>👥 방문자 통계</h3>
          <div className="stats-row">
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>전체 방문자</label>
              <div className="stat-value primary" style={{ textShadow: 'none' }}>{formatNumber(integratedStats.totalVisitors)}명</div>
            </div>
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>웹사이트 방문자</label>
              <div className="stat-value" style={{ textShadow: 'none' }}>{formatNumber(integratedStats.websiteVisitors)}명</div>
            </div>
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>네이버 플레이스</label>
              <div className="stat-value" style={{ textShadow: 'none' }}>{formatNumber(integratedStats.naverPlaceVisits)}명</div>
            </div>
          </div>
        </div>

        {/* 광고비 통계 */}
        <div className="stats-card ad-cost-card">
          <h3 style={{ textShadow: 'none' }}>💸 광고비 통계</h3>
          <div className="stats-row">
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>총 광고비</label>
              <div className="stat-value primary" style={{ textShadow: 'none' }}>{formatCurrency(totalAdCostSum)}</div>
            </div>
          </div>
          <div className="ad-breakdown">
            <div className="ad-item">
              <span className="ad-platform" style={{ textShadow: 'none' }}>네이버</span>
              <span className="ad-value" style={{ textShadow: 'none' }}>{formatCurrency(integratedStats.totalAdCost.naver)}</span>
            </div>
            <div className="ad-item">
              <span className="ad-platform" style={{ textShadow: 'none' }}>구글</span>
              <span className="ad-value" style={{ textShadow: 'none' }}>{formatCurrency(integratedStats.totalAdCost.google)}</span>
            </div>
            <div className="ad-item">
              <span className="ad-platform" style={{ textShadow: 'none' }}>Meta</span>
              <span className="ad-value" style={{ textShadow: 'none' }}>{formatCurrency(integratedStats.totalAdCost.meta)}</span>
            </div>
            <div className="ad-item">
              <span className="ad-platform" style={{ textShadow: 'none' }}>카카오</span>
              <span className="ad-value" style={{ textShadow: 'none' }}>{formatCurrency(integratedStats.totalAdCost.kakao)}</span>
            </div>
            <div className="ad-item">
              <span className="ad-platform" style={{ textShadow: 'none' }}>기타</span>
              <span className="ad-value" style={{ textShadow: 'none' }}>{formatCurrency(integratedStats.totalAdCost.other)}</span>
            </div>
          </div>
        </div>

        {/* 광고 성과 */}
        <div className="stats-card performance-card">
          <h3 style={{ textShadow: 'none' }}>📈 광고 성과</h3>
          <div className="stats-row">
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>총 클릭 수</label>
              <div className="stat-value" style={{ textShadow: 'none' }}>{formatNumber(totalClicksSum)}회</div>
            </div>
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>총 노출 수</label>
              <div className="stat-value" style={{ textShadow: 'none' }}>{formatNumber(totalImpressionsSum)}회</div>
            </div>
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>평균 CPC</label>
              <div className="stat-value" style={{ textShadow: 'none' }}>{formatCurrency(avgCPC)}</div>
            </div>
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>평균 CPM</label>
              <div className="stat-value" style={{ textShadow: 'none' }}>{formatCurrency(avgCPM)}</div>
            </div>
            <div className="stat-item">
              <label style={{ textShadow: 'none' }}>CTR</label>
              <div className="stat-value" style={{ textShadow: 'none' }}>{formatPercentage(ctr)}</div>
            </div>
          </div>
        </div>

        {/* 핵심 지표 */}
        {isAutoRevenueMonth && (
          <div className="stats-card kpi-card">
            <h3 style={{ textShadow: 'none' }}>⚡ 핵심 지표</h3>
            <div className="stats-row">
              <div className="stat-item">
                <label style={{ textShadow: 'none' }}>전환율</label>
                <div className="stat-value" style={{ textShadow: 'none' }}>{formatPercentage(conversionRate)}</div>
              </div>
              <div className="stat-item">
                <label style={{ textShadow: 'none' }}>광고 ROI</label>
                <div className="stat-value roi-value" style={{ textShadow: 'none' }}>{formatPercentage(roi)}</div>
              </div>
              <div className="stat-item">
                <label style={{ textShadow: 'none' }}>리뷰 수</label>
                <div className="stat-value" style={{ textShadow: 'none' }}>{formatNumber(integratedStats.totalReviews)}개</div>
              </div>
            </div>
          </div>
        )}

        {/* 데이터 상태 */}
        <div className="stats-card status-card">
          <h3 style={{ textShadow: 'none' }}>📝 데이터 입력 상태</h3>
          <div className="status-row">
            <div className="status-item">
              <span className="status-label">🏠 초호펜션</span>
              <span className={`status-badge ${pensionData ? 'complete' : 'incomplete'}`}>
                {pensionData ? '입력완료' : '미입력'}
              </span>
              {pensionData && (
                <span className="status-date">
                  {new Date(pensionData.updatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="status-item">
              <span className="status-label">🏡 초호쉼터</span>
              <span className={`status-badge ${shelterData ? 'complete' : 'incomplete'}`}>
                {shelterData ? '입력완료' : '미입력'}
              </span>
              {shelterData && (
                <span className="status-date">
                  {new Date(shelterData.updatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegratedStatsView;