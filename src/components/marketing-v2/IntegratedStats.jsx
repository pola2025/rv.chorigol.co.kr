// src/components/marketing-v2/IntegratedStats.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import './IntegratedStats.css';

const IntegratedStats = ({ selectedMonth }) => {
  const [pensionData, setPensionData] = useState(null);
  const [shelterData, setShelterData] = useState(null);
  const [cumulativeData, setCumulativeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);

  useEffect(() => {
    loadIntegratedData();
    loadCumulativeData();
  }, [selectedMonth]);

  const loadIntegratedData = async () => {
    setIsLoading(true);
    try {
      // 초호펜션 데이터 로드
      const pensionDocRef = doc(db, 'marketing_stats_v2', `pension_${selectedMonth}`);
      const pensionDoc = await getDoc(pensionDocRef);
      
      // 초호쉼터 데이터 로드
      const shelterDocRef = doc(db, 'marketing_stats_v2', `shelter_${selectedMonth}`);
      const shelterDoc = await getDoc(shelterDocRef);
      
      if (pensionDoc.exists()) {
        setPensionData(pensionDoc.data());
      } else {
        setPensionData(null);
      }
      
      if (shelterDoc.exists()) {
        setShelterData(shelterDoc.data());
      } else {
        setShelterData(null);
      }
    } catch (error) {
      console.error('통합 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCumulativeData = async () => {
    try {
      const currentYear = selectedMonth.split('-')[0];
      const currentMonth = parseInt(selectedMonth.split('-')[1]);
      
      let totalRevenue = 0;
      let totalVisitors = 0;
      let totalReservations = 0;
      let totalAdCost = 0;
      let totalReviews = 0;
      
      // 1월부터 현재 선택된 월까지의 데이터 집계
      for (let month = 1; month <= currentMonth; month++) {
        const monthStr = `${currentYear}-${String(month).padStart(2, '0')}`;
        
        // 초호펜션 데이터
        const pensionDoc = await getDoc(doc(db, 'marketing_stats_v2', `pension_${monthStr}`));
        if (pensionDoc.exists()) {
          const data = pensionDoc.data();
          totalRevenue += data.revenue?.total || 0;
          totalReservations += data.revenue?.reservationCount || 0;
          totalVisitors += data.visitors?.website?.visitors || 0;
          totalVisitors += data.visitors?.naverPlace?.placeVisits || 0;
          totalReviews += data.visitors?.naverPlace?.reviews || 0;
          
          // 광고비 집계
          if (data.advertising?.channels) {
            data.advertising.channels.forEach(channel => {
              totalAdCost += channel.cost || 0;
            });
          }
        }
        
        // 초호쉼터 데이터
        const shelterDoc = await getDoc(doc(db, 'marketing_stats_v2', `shelter_${monthStr}`));
        if (shelterDoc.exists()) {
          const data = shelterDoc.data();
          totalRevenue += data.revenue?.total || 0;
          totalReservations += data.revenue?.reservationCount || 0;
          totalVisitors += data.visitors?.website?.visitors || 0;
          totalVisitors += data.visitors?.naverPlace?.placeVisits || 0;
          totalReviews += data.visitors?.naverPlace?.reviews || 0;
          
          // 광고비 집계
          if (data.advertising?.channels) {
            data.advertising.channels.forEach(channel => {
              totalAdCost += channel.cost || 0;
            });
          }
        }
      }
      
      setCumulativeData({
        revenue: totalRevenue,
        visitors: totalVisitors,
        reservations: totalReservations,
        adCost: totalAdCost,
        reviews: totalReviews,
        roas: totalAdCost > 0 ? Math.round((totalRevenue / totalAdCost) * 100) : 0
      });
    } catch (error) {
      console.error('누적 데이터 로드 오류:', error);
    }
  };

  const formatNumber = (num) => {
    return (num || 0).toLocaleString();
  };

  const calculateTotal = (field) => {
    const pensionValue = pensionData?.[field] || 0;
    const shelterValue = shelterData?.[field] || 0;
    return pensionValue + shelterValue;
  };

  const calculateRevenueTotal = () => {
    const pensionRevenue = pensionData?.revenue?.total || 0;
    const shelterRevenue = shelterData?.revenue?.total || 0;
    return pensionRevenue + shelterRevenue;
  };

  const calculateReservationTotal = () => {
    const pensionCount = pensionData?.revenue?.reservationCount || 0;
    const shelterCount = shelterData?.revenue?.reservationCount || 0;
    return pensionCount + shelterCount;
  };

  const calculateVisitorTotal = () => {
    const pensionVisitors = pensionData?.visitors?.website?.visitors || 0;
    const shelterVisitors = shelterData?.visitors?.website?.visitors || 0;
    return pensionVisitors + shelterVisitors;
  };

  const calculatePageViewTotal = () => {
    const pensionViews = pensionData?.visitors?.website?.pageViews || 0;
    const shelterViews = shelterData?.visitors?.website?.pageViews || 0;
    return pensionViews + shelterViews;
  };

  const calculateNaverTotal = () => {
    const pensionNaver = pensionData?.visitors?.naverPlace?.placeVisits || 0;
    const shelterNaver = shelterData?.visitors?.naverPlace?.placeVisits || 0;
    return pensionNaver + shelterNaver;
  };

  const calculateReservationRequestsTotal = () => {
    const pensionRequests = pensionData?.visitors?.naverPlace?.reservationRequests || 0;
    const shelterRequests = shelterData?.visitors?.naverPlace?.reservationRequests || 0;
    return pensionRequests + shelterRequests;
  };

  const calculateReviewsTotal = () => {
    const pensionReviews = pensionData?.visitors?.naverPlace?.reviews || 0;
    const shelterReviews = shelterData?.visitors?.naverPlace?.reviews || 0;
    return pensionReviews + shelterReviews;
  };

  const calculateAdTotal = () => {
    const pensionAds = pensionData?.advertising?.channels || [];
    const shelterAds = shelterData?.advertising?.channels || [];
    
    const pensionTotal = pensionAds.reduce((sum, channel) => 
      sum + (channel.cost || 0), 0);
    const shelterTotal = shelterAds.reduce((sum, channel) => 
      sum + (channel.cost || 0), 0);
    
    return pensionTotal + shelterTotal;
  };

  if (isLoading) {
    return <div className="integrated-stats loading">데이터 로딩 중...</div>;
  }

  return (
    <div className="integrated-stats">
      <div className="integrated-header">
        <h3>통합 통계 ({selectedMonth})</h3>
        <div className="header-buttons">
          <button 
            className="toggle-details"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '간단히 보기' : '자세히 보기'}
          </button>
          <button 
            className="toggle-cumulative"
            onClick={() => setShowCumulative(!showCumulative)}
          >
            {showCumulative ? '월별 통계' : '누적 통계'}
          </button>
        </div>
      </div>

      <div className="integrated-summary">
        <div className="summary-card total" style={{ textShadow: 'none' }}>
          <h4 style={{ textShadow: 'none' }}>전체 매출</h4>
          <div className="summary-value" style={{ textShadow: 'none' }}>
            {formatNumber(calculateRevenueTotal())}원
          </div>
          {showDetails && (
            <div className="summary-details" style={{ textShadow: 'none' }}>
              <div style={{ textShadow: 'none' }}>초호펜션: {formatNumber(pensionData?.revenue?.total)}원</div>
              <div style={{ textShadow: 'none' }}>초호쉼터: {formatNumber(shelterData?.revenue?.total)}원</div>
            </div>
          )}
        </div>

        <div className="summary-card">
          <h4>총 예약 건수</h4>
          <div className="summary-value">
            {formatNumber(calculateReservationTotal())}건
          </div>
          {showDetails && (
            <div className="summary-details">
              <div>초호펜션: {formatNumber(pensionData?.revenue?.reservationCount)}건</div>
              <div>초호쉼터: {formatNumber(shelterData?.revenue?.reservationCount)}건</div>
            </div>
          )}
        </div>

        <div className="summary-card">
          <h4>웹사이트 방문자</h4>
          <div className="summary-value">
            {formatNumber(calculateVisitorTotal())}명
          </div>
          {showDetails && (
            <div className="summary-details">
              <div>초호펜션: {formatNumber(pensionData?.visitors?.website?.visitors)}명</div>
              <div>초호쉼터: {formatNumber(shelterData?.visitors?.website?.visitors)}명</div>
            </div>
          )}
        </div>

        <div className="summary-card">
          <h4>네이버 플레이스 유입</h4>
          <div className="summary-value">
            {formatNumber(calculateNaverTotal())}회
          </div>
          {showDetails && (
            <div className="summary-details">
              <div>초호펜션: {formatNumber(pensionData?.visitors?.naverPlace?.placeVisits)}회</div>
              <div>초호쉼터: {formatNumber(shelterData?.visitors?.naverPlace?.placeVisits)}회</div>
            </div>
          )}
        </div>

        <div className="summary-card">
          <h4>예약 주문 신청</h4>
          <div className="summary-value">
            {formatNumber(calculateReservationRequestsTotal())}건
          </div>
          {showDetails && (
            <div className="summary-details">
              <div>초호펜션: {formatNumber(pensionData?.visitors?.naverPlace?.reservationRequests)}건</div>
              <div>초호쉼터: {formatNumber(shelterData?.visitors?.naverPlace?.reservationRequests)}건</div>
            </div>
          )}
        </div>

        <div className="summary-card">
          <h4>리뷰</h4>
          <div className="summary-value">
            {formatNumber(calculateReviewsTotal())}개
          </div>
          {showDetails && (
            <div className="summary-details">
              <div>초호펜션: {formatNumber(pensionData?.visitors?.naverPlace?.reviews)}개</div>
              <div>초호쉼터: {formatNumber(shelterData?.visitors?.naverPlace?.reviews)}개</div>
            </div>
          )}
        </div>

        <div className="summary-card">
          <h4>광고비 총액</h4>
          <div className="summary-value">
            {formatNumber(calculateAdTotal())}원
          </div>
          {showDetails && (
            <div className="summary-details">
              <div>초호펜션: {formatNumber(
                (pensionData?.advertising?.channels || []).reduce((sum, ch) => 
                  sum + (ch.cost || 0), 0)
              )}원</div>
              <div>초호쉼터: {formatNumber(
                (shelterData?.advertising?.channels || []).reduce((sum, ch) => 
                  sum + (ch.cost || 0), 0)
              )}원</div>
            </div>
          )}
        </div>
      </div>

      {/* 누적 통계 섹션 */}
      {showCumulative && cumulativeData && (
        <div className="cumulative-section">
          <h3 className="cumulative-title">
            {selectedMonth.split('-')[0]}년 누적 통계 (1월 ~ {parseInt(selectedMonth.split('-')[1])}월)
          </h3>
          <div className="cumulative-stats">
            <div className="cumulative-card">
              <div className="cumulative-label">누적 매출</div>
              <div className="cumulative-value">{formatNumber(cumulativeData.revenue)}원</div>
            </div>
            <div className="cumulative-card">
              <div className="cumulative-label">누적 예약</div>
              <div className="cumulative-value">{formatNumber(cumulativeData.reservations)}건</div>
            </div>
            <div className="cumulative-card">
              <div className="cumulative-label">누적 방문자</div>
              <div className="cumulative-value">{formatNumber(cumulativeData.visitors)}명</div>
            </div>
            <div className="cumulative-card">
              <div className="cumulative-label">누적 광고비</div>
              <div className="cumulative-value">{formatNumber(cumulativeData.adCost)}원</div>
            </div>
            <div className="cumulative-card">
              <div className="cumulative-label">누적 리뷰</div>
              <div className="cumulative-value">{formatNumber(cumulativeData.reviews)}개</div>
            </div>
            <div className="cumulative-card highlight">
              <div className="cumulative-label">누적 ROAS</div>
              <div className="cumulative-value">{cumulativeData.roas}%</div>
            </div>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="integrated-details">
          <div className="detail-section">
            <h4>객실별 매출 상세</h4>
            <div className="room-details">
              <div className="pension-rooms">
                <h5>초호펜션</h5>
                <div>Forest: {formatNumber(pensionData?.revenue?.byRoom?.forest)}원</div>
                <div>Forest 패밀리: {formatNumber(pensionData?.revenue?.byRoom?.forestFamily)}원</div>
                <div>Forest mini: {formatNumber(pensionData?.revenue?.byRoom?.forestMini)}원</div>
                <div>Forest mini 패밀리: {formatNumber(pensionData?.revenue?.byRoom?.forestMiniFamily)}원</div>
              </div>
              <div className="shelter-rooms">
                <h5>초호쉼터</h5>
                <div>호수뷰객실: {formatNumber(shelterData?.revenue?.byRoom?.lakeView)}원</div>
                <div>단체&야유회: {formatNumber(shelterData?.revenue?.byRoom?.group)}원</div>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h4>광고 채널별 상세</h4>
            <div className="ad-details">
              <div className="pension-ads">
                <h5>초호펜션</h5>
                {(pensionData?.advertising?.channels || []).map((channel, idx) => (
                  <div key={idx}>
                    {channel.name}: {formatNumber(channel.cost)}원
                    {channel.clicks && ` (${channel.clicks} 클릭)`}
                  </div>
                ))}
              </div>
              <div className="shelter-ads">
                <h5>초호쉼터</h5>
                {(shelterData?.advertising?.channels || []).map((channel, idx) => (
                  <div key={idx}>
                    {channel.name}: {formatNumber(channel.cost)}원
                    {channel.clicks && ` (${channel.clicks} 클릭)`}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedStats;