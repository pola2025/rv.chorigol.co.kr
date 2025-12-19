// src/components/marketing/MarketingStatsV2.jsx
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import MonthlyGoals from './MonthlyGoals';
import RevenueStats from './RevenueStats';
import VisitStats from './VisitStats';
import AdStats from './AdStats';
import MarketingExpenses from './MarketingExpenses';
import AdEfficiencyDashboard from './AdEfficiencyDashboard';
import './MarketingStatsV2.css';

const MarketingStatsV2 = ({ reservations = [] }) => {
  const [activeTab, setActiveTab] = useState('pension'); // pension 또는 shelter
  const [statsTab, setStatsTab] = useState('efficiency'); // efficiency, revenue, visit, ad, expense
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  
  const [loading, setLoading] = useState(false);
  const [monthlyGoalPension, setMonthlyGoalPension] = useState('');
  const [monthlyGoalShelter, setMonthlyGoalShelter] = useState('');

  // 월 변경 핸들러
  const handleMonthChange = (direction) => {
    let newYear = selectedMonth.year;
    let newMonth = selectedMonth.month;
    
    if (direction === 'prev') {
      newMonth--;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
    } else {
      newMonth++;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
    }
    
    setSelectedMonth({ year: newYear, month: newMonth });
  };

  // 월별 목표 로드
  useEffect(() => {
    loadMonthlyGoals();
  }, [selectedMonth]);

  const loadMonthlyGoals = async () => {
    try {
      const monthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`;
      
      // 초호펜션 목표
      const pensionGoalDoc = await getDoc(doc(db, 'marketing_stats', 'monthly_goals', `${monthKey}_pension`));
      if (pensionGoalDoc.exists()) {
        setMonthlyGoalPension(pensionGoalDoc.data().memo || '');
      } else {
        setMonthlyGoalPension('');
      }
      
      // 초호쉼터 목표
      const shelterGoalDoc = await getDoc(doc(db, 'marketing_stats', 'monthly_goals', `${monthKey}_shelter`));
      if (shelterGoalDoc.exists()) {
        setMonthlyGoalShelter(shelterGoalDoc.data().memo || '');
      } else {
        setMonthlyGoalShelter('');
      }
    } catch (error) {
      console.error('월별 목표 로드 오류:', error);
    }
  };

  // 월별 목표 저장
  const saveMonthlyGoal = async (memo, type) => {
    try {
      const monthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`;
      await setDoc(doc(db, 'marketing_stats', 'monthly_goals', `${monthKey}_${type}`), {
        memo,
        type,
        updatedAt: new Date().toISOString()
      });
      
      if (type === 'pension') {
        setMonthlyGoalPension(memo);
      } else {
        setMonthlyGoalShelter(memo);
      }
      return true;
    } catch (error) {
      console.error('월별 목표 저장 오류:', error);
      return false;
    }
  };

  const formatMonth = (year, month) => {
    return `${year}년 ${month}월`;
  };

  // 초호펜션 예약 필터링
  const pensionReservations = reservations.filter(res => {
    const roomName = res.roomName?.toLowerCase() || '';
    return roomName.includes('forest') && !roomName.includes('단체');
  });

  // 초호쉼터 예약 필터링
  const shelterReservations = reservations.filter(res => {
    const roomName = res.roomName?.toLowerCase() || '';
    return roomName.includes('호수뷰') || roomName.includes('단체') || roomName.includes('야유회');
  });

  // 현재 탭에 따른 예약 데이터
  const currentReservations = activeTab === 'pension' ? pensionReservations : shelterReservations;
  const currentGoal = activeTab === 'pension' ? monthlyGoalPension : monthlyGoalShelter;

  return (
    <div className="marketing-stats-v2">
      {/* 헤더 */}
      <div className="stats-header">
        <h2>📊 마케팅 통계</h2>
        <div className="month-navigation">
          <button onClick={() => handleMonthChange('prev')} className="nav-btn">
            <span>◀</span>
          </button>
          <span className="current-month">
            {formatMonth(selectedMonth.year, selectedMonth.month)}
          </span>
          <button onClick={() => handleMonthChange('next')} className="nav-btn">
            <span>▶</span>
          </button>
        </div>
      </div>

      {/* 사업장 선택 탭 */}
      <div className="business-tabs">
        <button 
          className={`business-tab ${activeTab === 'pension' ? 'active' : ''}`}
          onClick={() => setActiveTab('pension')}
        >
          <span className="tab-icon">🏠</span>
          초호펜션
          <span className="tab-desc">Forest & Forest Mini</span>
        </button>
        <button 
          className={`business-tab ${activeTab === 'shelter' ? 'active' : ''}`}
          onClick={() => setActiveTab('shelter')}
        >
          <span className="tab-icon">🏢</span>
          초호쉼터
          <span className="tab-desc">호수뷰 & 단체/야유회</span>
        </button>
      </div>

      {/* 월별 목표 메모 */}
      <MonthlyGoals 
        selectedMonth={selectedMonth}
        goal={currentGoal}
        onSave={(memo) => saveMonthlyGoal(memo, activeTab)}
        businessType={activeTab}
      />

      {/* 탭 메뉴 */}
      <div className="stats-tabs">
        <button 
          className={`tab ${statsTab === 'efficiency' ? 'active' : ''}`}
          onClick={() => setStatsTab('efficiency')}
        >
          <span className="tab-icon">🎯</span>
          광고 효율
        </button>
        <button 
          className={`tab ${statsTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setStatsTab('revenue')}
        >
          <span className="tab-icon">💰</span>
          매출 통계
        </button>
        <button 
          className={`tab ${statsTab === 'visit' ? 'active' : ''}`}
          onClick={() => setStatsTab('visit')}
        >
          <span className="tab-icon">👥</span>
          방문 통계
        </button>
        <button 
          className={`tab ${statsTab === 'ad' ? 'active' : ''}`}
          onClick={() => setStatsTab('ad')}
        >
          <span className="tab-icon">📢</span>
          광고 통계
        </button>
        <button 
          className={`tab ${statsTab === 'expense' ? 'active' : ''}`}
          onClick={() => setStatsTab('expense')}
        >
          <span className="tab-icon">📋</span>
          지출 내역
        </button>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="tab-content">
        <div className="content-sections">
          {/* 광고 효율 대시보드 */}
          {statsTab === 'efficiency' && (
            <div className="section-card">
              <AdEfficiencyDashboard 
                selectedMonth={selectedMonth}
                businessType={activeTab}
              />
            </div>
          )}

          {/* 매출 통계 */}
          {statsTab === 'revenue' && (
            <div className="section-card">
              <RevenueStats 
                reservations={currentReservations}
                selectedMonth={selectedMonth}
                businessType={activeTab}
              />
            </div>
          )}

          {/* 방문 통계 */}
          {statsTab === 'visit' && (
            <div className="section-card">
              <VisitStats 
                selectedMonth={selectedMonth}
                businessType={activeTab}
            />
            </div>
          )}

          {/* 광고 통계 */}
          {statsTab === 'ad' && (
            <div className="section-card">
              <AdStats 
                selectedMonth={selectedMonth}
                businessType={activeTab}
              />
            </div>
          )}

          {/* 지출 내역 */}
          {statsTab === 'expense' && (
            <div className="section-card">
              <MarketingExpenses 
                selectedMonth={selectedMonth}
                businessType={activeTab}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketingStatsV2;
