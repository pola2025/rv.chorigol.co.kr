// DashboardStatsV2.jsx - 정식 버전
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getKSTToday, getKSTDateString } from '../../utils';
import './DashboardStatsV2.css';

const DashboardStatsV2 = () => {
  const [statsData, setStatsData] = useState({
    currentMonth: {
      visitors: 0,
      websiteVisitors: 0,
      naverVisitors: 0,
      revenue: 0,
      manualRevenue: 0,
      autoRevenue: 0,
      reservationCount: 0,
      reviewCount: 0
    }
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempManualRevenue, setTempManualRevenue] = useState('');
  
  const currentMonth = getKSTToday().slice(0, 7);
  const currentMonthDisplay = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;
  
  useEffect(() => {
    loadStats();
    loadReservationRevenue();
  }, []);
  
  const loadStats = async () => {
    try {
      const pensionDoc = await getDoc(doc(db, 'marketing_stats_v2', `pension_${currentMonth}`));
      const shelterDoc = await getDoc(doc(db, 'marketing_stats_v2', `shelter_${currentMonth}`));

      let websiteVisitors = 0;
      let naverVisitors = 0;
      let reviewCount = 0;

      if (pensionDoc.exists()) {
        const data = pensionDoc.data();
        websiteVisitors += (data.visitors?.website?.visitors || 0);
        naverVisitors += (data.visitors?.naverPlace?.placeVisits || 0);
        reviewCount += (data.visitors?.naverPlace?.reviews || 0);
      }

      if (shelterDoc.exists()) {
        const data = shelterDoc.data();
        websiteVisitors += (data.visitors?.website?.visitors || 0);
        naverVisitors += (data.visitors?.naverPlace?.placeVisits || 0);
        reviewCount += (data.visitors?.naverPlace?.reviews || 0);
      }

      const totalVisitors = websiteVisitors + naverVisitors;

      const manualRevenueDoc = await getDoc(doc(db, 'manual_revenue', currentMonth));
      const manualRevenue = manualRevenueDoc.exists() ? manualRevenueDoc.data().amount || 0 : 0;

      setStatsData(prev => ({
        ...prev,
        currentMonth: {
          ...prev.currentMonth,
          visitors: totalVisitors,
          websiteVisitors: websiteVisitors,
          naverVisitors: naverVisitors,
          reviewCount: reviewCount,
          manualRevenue: manualRevenue
        }
      }));

      setTempManualRevenue(manualRevenue.toString());
    } catch (error) {
      console.error('통계 데이터 로드 오류:', error);
    }
  };
  
  const loadReservationRevenue = async () => {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');

      const startDate = new Date(currentMonth + '-01');
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      const reservationsQuery = query(
        collection(db, 'reservations'),
        where('checkIn', '>=', getKSTDateString(startDate)),
        where('checkIn', '<=', getKSTDateString(endDate))
      );

      const snapshot = await getDocs(reservationsQuery);
      let totalRevenue = 0;
      let reservationCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === '예약확정' && data.source !== '막기') {
          totalRevenue += (data.totalPrice || 0);
          reservationCount++;
        }
      });

      setStatsData(prev => ({
        ...prev,
        currentMonth: {
          ...prev.currentMonth,
          autoRevenue: totalRevenue,
          reservationCount: reservationCount
        }
      }));
    } catch (error) {
      console.error('예약 매출 계산 오류:', error);
    }
  };
  
  const saveManualRevenue = async () => {
    try {
      const amount = parseInt(tempManualRevenue.replace(/[^0-9]/g, '')) || 0;
      
      await setDoc(doc(db, 'manual_revenue', currentMonth), {
        amount: amount,
        updatedAt: new Date().toISOString(),
        month: currentMonth
      });
      
      setStatsData(prev => ({
        ...prev,
        currentMonth: {
          ...prev.currentMonth,
          manualRevenue: amount
        }
      }));
      
      setIsEditMode(false);
      alert('매출액이 저장되었습니다.');
    } catch (error) {
      console.error('매출 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };
  
  const formatNumber = (num) => {
    return (num || 0).toLocaleString();
  };
  
  const formatRevenue = (num) => {
    const billion = Math.floor(num / 100000000);
    const million = Math.floor((num % 100000000) / 10000);
    const remainder = num % 10000;
    
    if (billion > 0) {
      return `${billion}억 ${million > 0 ? million + '만' : ''}${remainder > 0 ? remainder.toLocaleString() : ''}원`;
    } else if (million > 0) {
      return `${million}만${remainder > 0 ? remainder.toLocaleString() : ''}원`;
    } else {
      return `${formatNumber(num)}원`;
    }
  };
  
  const totalRevenue = Math.max(statsData.currentMonth.manualRevenue, statsData.currentMonth.autoRevenue);
  
  return (
    <div className="dashboard-stats-v2">
      <div className="stats-header">
        <h2>{currentMonthDisplay} 운영 현황</h2>
        {!isEditMode ? (
          <button className="btn-edit-revenue" onClick={() => setIsEditMode(true)}>
            매출 수정
          </button>
        ) : (
          <div className="edit-controls">
            <button className="btn-save" onClick={saveManualRevenue}>저장</button>
            <button className="btn-cancel" onClick={() => {
              setIsEditMode(false);
              setTempManualRevenue(statsData.currentMonth.manualRevenue.toString());
            }}>취소</button>
          </div>
        )}
      </div>
      
      <div className="stats-grid">
        <div className="stat-item total-visitors">
          <div className="stat-label">전체 유입 통계</div>
          <div className="stat-value">{formatNumber(statsData.currentMonth.visitors)}<span className="unit">명</span></div>
          <div className="stat-details">
            <span>웹사이트: {formatNumber(statsData.currentMonth.websiteVisitors)}명</span>
            <span className="divider">|</span>
            <span>네이버: {formatNumber(statsData.currentMonth.naverVisitors)}명</span>
          </div>
        </div>

        <div className="stat-item total-revenue">
          <div className="stat-label">
            {currentMonth < '2024-09' ? '매출액 (수동입력)' : '매출액'}
          </div>
          {isEditMode ? (
            <div className="revenue-edit">
              <input
                type="text"
                value={tempManualRevenue}
                onChange={(e) => setTempManualRevenue(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="매출액 입력"
                className="revenue-input"
              />
              <span className="unit">원</span>
            </div>
          ) : (
            <>
              <div className="stat-value">
                {formatRevenue(totalRevenue)}
              </div>
              {statsData.currentMonth.autoRevenue > 0 && (
                <div className="stat-details">
                  <span>예약 시스템: {formatNumber(statsData.currentMonth.autoRevenue)}원</span>
                  {statsData.currentMonth.manualRevenue > 0 && (
                    <>
                      <span className="divider">|</span>
                      <span>수동 입력: {formatNumber(statsData.currentMonth.manualRevenue)}원</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="stat-item conversion-rate">
          <div className="stat-label">예약 전환율</div>
          <div className="stat-value">
            {statsData.currentMonth.visitors > 0 && statsData.currentMonth.reservationCount > 0
              ? ((statsData.currentMonth.reservationCount / statsData.currentMonth.visitors) * 100).toFixed(1)
              : '0'}<span className="unit">%</span>
          </div>
          <div className="stat-details">
            예약 확정: {formatNumber(statsData.currentMonth.reservationCount)}건
          </div>
        </div>

        <div className="stat-item average-price">
          <div className="stat-label">평균 객단가</div>
          <div className="stat-value">
            {totalRevenue > 0 && statsData.currentMonth.reservationCount > 0
              ? formatNumber(Math.floor(totalRevenue / statsData.currentMonth.reservationCount))
              : '0'}<span className="unit">원</span>
          </div>
          <div className="stat-details">
            리뷰: {formatNumber(statsData.currentMonth.reviewCount)}개
          </div>
        </div>
      </div>
      
      <div className="stats-footer">
        <p className="stats-note">
          ※ 2024년 8월 이전 데이터는 수동으로 입력해주세요.
          {currentMonth >= '2024-09' && ' 9월부터는 예약 시스템에서 자동 계산됩니다.'}
        </p>
      </div>
    </div>
  );
};

export default DashboardStatsV2;