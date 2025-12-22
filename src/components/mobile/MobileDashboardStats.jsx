// src/components/mobile/MobileDashboardStats.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getKSTToday, getKSTDateString } from '../../utils';
import './MobileDashboardStats.css';

const MobileDashboardStats = () => {
  const [statsData, setStatsData] = useState({
    visitors: 0,
    revenue: 0,
    averagePrice: 0
  });
  
  // 현재 월 포맷 (KST)
  const currentMonth = getKSTToday().slice(0, 7);
  
  useEffect(() => {
    loadStats();
  }, []);
  
  // 통계 데이터 로드
  const loadStats = async () => {
    try {
      // 마케팅 통계에서 방문자 수 가져오기
      const pensionDoc = await getDoc(doc(db, 'marketing_stats_v2', `pension_${currentMonth}`));
      const shelterDoc = await getDoc(doc(db, 'marketing_stats_v2', `shelter_${currentMonth}`));
      
      let totalVisitors = 0;
      
      if (pensionDoc.exists()) {
        const data = pensionDoc.data();
        totalVisitors += (data.visitors?.website?.visitors || 0);
        totalVisitors += (data.visitors?.naverPlace?.placeVisits || 0);
      }
      
      if (shelterDoc.exists()) {
        const data = shelterDoc.data();
        totalVisitors += (data.visitors?.website?.visitors || 0);
        totalVisitors += (data.visitors?.naverPlace?.placeVisits || 0);
      }
      
      // 예약 시스템의 실제 매출 계산
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
      
      // 수동 입력 매출이 있으면 그것을 우선 사용
      const manualRevenueDoc = await getDoc(doc(db, 'manual_revenue', currentMonth));
      if (manualRevenueDoc.exists() && manualRevenueDoc.data().amount > 0) {
        totalRevenue = manualRevenueDoc.data().amount;
      }
      
      const averagePrice = reservationCount > 0 ? Math.floor(totalRevenue / reservationCount) : 0;
      
      setStatsData({
        visitors: totalVisitors,
        revenue: totalRevenue,
        averagePrice: averagePrice
      });
    } catch (error) {
      console.error('통계 데이터 로드 오류:', error);
    }
  };
  
  const formatNumber = (num) => {
    if (num >= 10000) {
      return Math.floor(num / 10000) + '만' + (num % 10000 > 0 ? '+' : '');
    }
    return num.toLocaleString();
  };
  
  const formatRevenue = (num) => {
    if (num >= 100000000) {
      const billion = Math.floor(num / 100000000);
      const million = Math.floor((num % 100000000) / 10000);
      return `${billion}.${Math.floor(million / 1000)}억`;
    } else if (num >= 10000) {
      return Math.floor(num / 10000) + '만';
    }
    return formatNumber(num);
  };
  
  return (
    <div className="mobile-dashboard-stats">
      {/* 전체 유입 통계 */}
      <div className="mobile-stat-card">
        <h3 className="mobile-stat-title">전체 유입통계</h3>
        <p className="mobile-stat-value">{formatNumber(statsData.visitors)}</p>
        <p className="mobile-stat-label">방문자수</p>
      </div>
      
      {/* 매출액 */}
      <div className="mobile-stat-card">
        <h3 className="mobile-stat-title">매출액</h3>
        <p className="mobile-stat-value">{formatRevenue(statsData.revenue)}원</p>
        <p className="mobile-stat-label">이번달</p>
      </div>
      
      {/* 평균 객단가 */}
      <div className="mobile-stat-card">
        <h3 className="mobile-stat-title">평균객단가</h3>
        <p className="mobile-stat-value">{formatNumber(statsData.averagePrice)}원</p>
        <p className="mobile-stat-label">건당 평균</p>
      </div>
    </div>
  );
};

export default MobileDashboardStats;