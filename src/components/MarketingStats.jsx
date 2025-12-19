// src/components/MarketingStats.jsx
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import './MarketingStats.css';

const MarketingStats = ({ reservations = [] }) => {
  const [activeTab, setActiveTab] = useState('pension'); // 'pension' or 'shelter'
  const [activeSubTab, setActiveSubTab] = useState('revenue'); // 'revenue', 'visit', 'ad', 'expense'
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  
  // 기간 선택을 위한 상태
  const [weeklyDateRange, setWeeklyDateRange] = useState({
    startDate: new Date(),
    endDate: new Date()
  });
  const [monthlyDateRange, setMonthlyDateRange] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  
  const [salesData, setSalesData] = useState({
    pension: {
      weekly: { total: 0, count: 0, daily: [] },
      monthly: { total: 0, count: 0, daily: [] }
    },
    shelter: {
      weekly: { total: 0, count: 0, groupTotal: 0, groupCount: 0, daily: [] },
      monthly: { total: 0, count: 0, groupTotal: 0, groupCount: 0, daily: [] }
    }
  });
  
  // 초호펜션 통계
  const [pensionStats, setPensionStats] = useState({
    visitors: '',
    pageViews: '',
    totalVisits: '',
    channels: [
      { rank: 1, name: '', visits: '' },
      { rank: 2, name: '', visits: '' },
      { rank: 3, name: '', visits: '' },
      { rank: 4, name: '', visits: '' },
      { rank: 5, name: '', visits: '' }
    ],
    adExpense: {
      naver: '',
      google: '',
      facebook: '',
      instagram: '',
      total: ''
    },
    expenses: [],
    lastUpdated: null
  });
  
  // 초호쉼터 통계
  const [shelterStats, setShelterStats] = useState({
    visitors: '',
    pageViews: '',
    totalVisits: '',
    channels: [
      { rank: 1, name: '', visits: '' },
      { rank: 2, name: '', visits: '' },
      { rank: 3, name: '', visits: '' },
      { rank: 4, name: '', visits: '' },
      { rank: 5, name: '', visits: '' }
    ],
    adExpense: {
      naver: '',
      google: '',
      facebook: '',
      instagram: '',
      total: ''
    },
    expenses: [],
    lastUpdated: null
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 주간 기본 날짜 설정 (이번 주)
  useEffect(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    setWeeklyDateRange({ startDate: startOfWeek, endDate: endOfWeek });
  }, []);

  // 매출 통계 계산
  useEffect(() => {
    calculateRevenue();
  }, [reservations, weeklyDateRange, monthlyDateRange]);

  const calculateRevenue = () => {
    // 초호펜션 객실 타입
    const pensionRooms = ['forest', 'forest 패밀리', 'forest mini', 'forest mini 패밀리'];
    // 초호쉼터 객실 타입
    const shelterRooms = ['호수뷰객실'];
    
    // 주간 날짜 설정
    const weekStart = new Date(weeklyDateRange.startDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weeklyDateRange.endDate);
    weekEnd.setHours(23, 59, 59, 999);
    
    // 월간 날짜 설정
    const monthStart = new Date(monthlyDateRange.year, monthlyDateRange.month - 1, 1);
    const monthEnd = new Date(monthlyDateRange.year, monthlyDateRange.month, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    // 초기화
    const pensionWeeklyDaily = [];
    const pensionMonthlyDaily = [];
    const shelterWeeklyDaily = [];
    const shelterMonthlyDaily = [];
    
    let pensionWeeklyTotal = 0, pensionWeeklyCount = 0;
    let pensionMonthlyTotal = 0, pensionMonthlyCount = 0;
    let shelterWeeklyTotal = 0, shelterWeeklyCount = 0, shelterWeeklyGroupTotal = 0, shelterWeeklyGroupCount = 0;
    let shelterMonthlyTotal = 0, shelterMonthlyCount = 0, shelterMonthlyGroupTotal = 0, shelterMonthlyGroupCount = 0;
    
    // 일별 데이터 초기화
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      pensionWeeklyDaily.push({ date: new Date(d), revenue: 0, count: 0 });
      shelterWeeklyDaily.push({ date: new Date(d), revenue: 0, count: 0, groupRevenue: 0, groupCount: 0 });
    }
    
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      pensionMonthlyDaily.push({ date: new Date(monthlyDateRange.year, monthlyDateRange.month - 1, d), revenue: 0, count: 0 });
      shelterMonthlyDaily.push({ date: new Date(monthlyDateRange.year, monthlyDateRange.month - 1, d), revenue: 0, count: 0, groupRevenue: 0, groupCount: 0 });
    }
    
    // 예약 데이터 집계
    reservations.forEach(res => {
      if (res.status !== '예약확정') return;
      
      const checkIn = new Date(res.checkIn);
      const amount = res.totalPrice || 0;
      const roomName = res.roomName || '';
      
      // 초호펜션 매출
      if (pensionRooms.some(room => roomName.toLowerCase().includes(room.toLowerCase()))) {
        // 주간
        if (checkIn >= weekStart && checkIn <= weekEnd) {
          pensionWeeklyTotal += amount;
          pensionWeeklyCount++;
          
          const dayIndex = Math.floor((checkIn - weekStart) / (1000 * 60 * 60 * 24));
          if (pensionWeeklyDaily[dayIndex]) {
            pensionWeeklyDaily[dayIndex].revenue += amount;
            pensionWeeklyDaily[dayIndex].count++;
          }
        }
        
        // 월간
        if (checkIn >= monthStart && checkIn <= monthEnd) {
          pensionMonthlyTotal += amount;
          pensionMonthlyCount++;
          
          const dayIndex = checkIn.getDate() - 1;
          if (pensionMonthlyDaily[dayIndex]) {
            pensionMonthlyDaily[dayIndex].revenue += amount;
            pensionMonthlyDaily[dayIndex].count++;
          }
        }
      }
      
      // 초호쉼터 매출
      if (shelterRooms.some(room => roomName.includes(room)) || roomName === '단체예약' || roomName.includes('야유회')) {
        const isGroupReservation = roomName === '단체예약' || roomName.includes('야유회');
        
        // 주간
        if (checkIn >= weekStart && checkIn <= weekEnd) {
          shelterWeeklyTotal += amount;
          shelterWeeklyCount++;
          
          if (isGroupReservation) {
            shelterWeeklyGroupTotal += amount;
            shelterWeeklyGroupCount++;
          }
          
          const dayIndex = Math.floor((checkIn - weekStart) / (1000 * 60 * 60 * 24));
          if (shelterWeeklyDaily[dayIndex]) {
            shelterWeeklyDaily[dayIndex].revenue += amount;
            shelterWeeklyDaily[dayIndex].count++;
            
            if (isGroupReservation) {
              shelterWeeklyDaily[dayIndex].groupRevenue += amount;
              shelterWeeklyDaily[dayIndex].groupCount++;
            }
          }
        }
        
        // 월간
        if (checkIn >= monthStart && checkIn <= monthEnd) {
          shelterMonthlyTotal += amount;
          shelterMonthlyCount++;
          
          if (isGroupReservation) {
            shelterMonthlyGroupTotal += amount;
            shelterMonthlyGroupCount++;
          }
          
          const dayIndex = checkIn.getDate() - 1;
          if (shelterMonthlyDaily[dayIndex]) {
            shelterMonthlyDaily[dayIndex].revenue += amount;
            shelterMonthlyDaily[dayIndex].count++;
            
            if (isGroupReservation) {
              shelterMonthlyDaily[dayIndex].groupRevenue += amount;
              shelterMonthlyDaily[dayIndex].groupCount++;
            }
          }
        }
      }
    });
    
    setSalesData({
      pension: {
        weekly: { total: pensionWeeklyTotal, count: pensionWeeklyCount, daily: pensionWeeklyDaily },
        monthly: { total: pensionMonthlyTotal, count: pensionMonthlyCount, daily: pensionMonthlyDaily }
      },
      shelter: {
        weekly: { 
          total: shelterWeeklyTotal, 
          count: shelterWeeklyCount,
          groupTotal: shelterWeeklyGroupTotal,
          groupCount: shelterWeeklyGroupCount,
          daily: shelterWeeklyDaily 
        },
        monthly: { 
          total: shelterMonthlyTotal, 
          count: shelterMonthlyCount,
          groupTotal: shelterMonthlyGroupTotal,
          groupCount: shelterMonthlyGroupCount,
          daily: shelterMonthlyDaily 
        }
      }
    });
  };
  
  // 날짜 포맷 함수
  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  
  const formatMonth = (year, month) => {
    return `${year}년 ${month}월`;
  };
  
  // 주간 날짜 변경 핸들러
  const handleWeekChange = (direction) => {
    const newStart = new Date(weeklyDateRange.startDate);
    const newEnd = new Date(weeklyDateRange.endDate);
    
    if (direction === 'prev') {
      newStart.setDate(newStart.getDate() - 7);
      newEnd.setDate(newEnd.getDate() - 7);
    } else {
      newStart.setDate(newStart.getDate() + 7);
      newEnd.setDate(newEnd.getDate() + 7);
    }
    
    setWeeklyDateRange({ startDate: newStart, endDate: newEnd });
  };
  
  // 월간 날짜 변경 핸들러
  const handleMonthChange = (direction) => {
    let newYear = monthlyDateRange.year;
    let newMonth = monthlyDateRange.month;
    
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
    
    setMonthlyDateRange({ year: newYear, month: newMonth });
  };

  // Firebase에서 마케팅 통계 로드
  useEffect(() => {
    loadMarketingStats();
  }, []);

  const loadMarketingStats = async () => {
    try {
      // 초호펜션 통계 로드
      const pensionStatsDoc = await getDocs(collection(db, 'marketing_stats_pension'));
      if (!pensionStatsDoc.empty) {
        const data = pensionStatsDoc.docs[0].data();
        setPensionStats(prev => ({
          ...prev,
          visitors: data.visitors || '',
          pageViews: data.pageViews || '',
          totalVisits: data.totalVisits || '',
          channels: data.channels || prev.channels,
          adExpense: data.adExpense || prev.adExpense,
          expenses: data.expenses || [],
          lastUpdated: data.lastUpdated
        }));
      }
      
      // 초호쉼터 통계 로드
      const shelterStatsDoc = await getDocs(collection(db, 'marketing_stats_shelter'));
      if (!shelterStatsDoc.empty) {
        const data = shelterStatsDoc.docs[0].data();
        setShelterStats(prev => ({
          ...prev,
          visitors: data.visitors || '',
          pageViews: data.pageViews || '',
          totalVisits: data.totalVisits || '',
          channels: data.channels || prev.channels,
          adExpense: data.adExpense || prev.adExpense,
          expenses: data.expenses || [],
          lastUpdated: data.lastUpdated
        }));
      }
    } catch (error) {
      console.error('마케팅 통계 로드 오류:', error);
    }
  };

  // 마케팅 통계 저장
  const saveMarketingStats = async () => {
    setIsSaving(true);
    try {
      const currentStats = activeTab === 'pension' ? pensionStats : shelterStats;
      const collectionName = activeTab === 'pension' ? 'marketing_stats_pension' : 'marketing_stats_shelter';
      
      const statsData = {
        visitors: currentStats.visitors,
        pageViews: currentStats.pageViews,
        totalVisits: currentStats.totalVisits,
        channels: currentStats.channels,
        adExpense: currentStats.adExpense,
        expenses: currentStats.expenses,
        lastUpdated: new Date().toISOString()
      };
      
      const statsCollection = collection(db, collectionName);
      const snapshot = await getDocs(statsCollection);
      
      if (snapshot.empty) {
        await setDoc(doc(statsCollection), statsData);
      } else {
        await updateDoc(doc(db, collectionName, snapshot.docs[0].id), statsData);
      }
      
      setIsEditing(false);
      alert(`${activeTab === 'pension' ? '초호펜션' : '초호쉼터'} 통계가 저장되었습니다.`);
    } catch (error) {
      console.error('마케팅 통계 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 채널 추가
  const addChannel = () => {
    const currentChannels = activeTab === 'pension' ? pensionStats.channels : shelterStats.channels;
    const newRank = currentChannels.length + 1;
    const newChannel = { rank: newRank, name: '', visits: '' };
    
    if (activeTab === 'pension') {
      setPensionStats({
        ...pensionStats,
        channels: [...pensionStats.channels, newChannel]
      });
    } else {
      setShelterStats({
        ...shelterStats,
        channels: [...shelterStats.channels, newChannel]
      });
    }
  };

  // 채널 삭제
  const removeChannel = (index) => {
    if (activeTab === 'pension') {
      const newChannels = pensionStats.channels.filter((_, i) => i !== index);
      // 순위 재정렬
      const reorderedChannels = newChannels.map((channel, i) => ({
        ...channel,
        rank: i + 1
      }));
      setPensionStats({
        ...pensionStats,
        channels: reorderedChannels
      });
    } else {
      const newChannels = shelterStats.channels.filter((_, i) => i !== index);
      // 순위 재정렬
      const reorderedChannels = newChannels.map((channel, i) => ({
        ...channel,
        rank: i + 1
      }));
      setShelterStats({
        ...shelterStats,
        channels: reorderedChannels
      });
    }
  };

  // 지출 항목 추가
  const addExpenseItem = () => {
    const newExpense = { id: Date.now(), category: '', amount: '', note: '' };
    if (activeTab === 'pension') {
      setPensionStats({
        ...pensionStats,
        expenses: [...pensionStats.expenses, newExpense]
      });
    } else {
      setShelterStats({
        ...shelterStats,
        expenses: [...shelterStats.expenses, newExpense]
      });
    }
  };

  // 지출 항목 삭제
  const removeExpenseItem = (id) => {
    if (activeTab === 'pension') {
      setPensionStats({
        ...pensionStats,
        expenses: pensionStats.expenses.filter(item => item.id !== id)
      });
    } else {
      setShelterStats({
        ...shelterStats,
        expenses: shelterStats.expenses.filter(item => item.id !== id)
      });
    }
  };

  // 지출 항목 업데이트
  const updateExpenseItem = (id, field, value) => {
    if (activeTab === 'pension') {
      setPensionStats({
        ...pensionStats,
        expenses: pensionStats.expenses.map(item =>
          item.id === id ? { ...item, [field]: value } : item
        )
      });
    } else {
      setShelterStats({
        ...shelterStats,
        expenses: shelterStats.expenses.map(item =>
          item.id === id ? { ...item, [field]: value } : item
        )
      });
    }
  };

  const currentSalesData = salesData[activeTab];
  const currentStats = activeTab === 'pension' ? pensionStats : shelterStats;

  return (
    <div className="marketing-stats">
      <div className="stats-header">
        <h2>마케팅 통계</h2>
      </div>

      {/* 하위 탭 메뉴 - 상단 */}
      <div className="stats-tabs">
        <button 
          type="button"
          className={`tab ${activeSubTab === 'revenue' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveSubTab('revenue');
          }}
        >
          매출 통계
        </button>
        <button 
          type="button"
          className={`tab ${activeSubTab === 'visit' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveSubTab('visit');
          }}
        >
          방문 통계
        </button>
        <button 
          type="button"
          className={`tab ${activeSubTab === 'ad' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveSubTab('ad');
          }}
        >
          광고 통계
        </button>
        <button 
          type="button"
          className={`tab ${activeSubTab === 'expense' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveSubTab('expense');
          }}
        >
          지출 내역
        </button>
      </div>

      {/* 사업장 선택 탭 - 하단 */}
      <div className="business-tabs">
        <button 
          type="button"
          className={`business-tab ${activeTab === 'pension' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('pension');
          }}
        >
          초호펜션
        </button>
        <button 
          type="button"
          className={`business-tab ${activeTab === 'shelter' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('shelter');
          }}
        >
          초호쉼터
        </button>
      </div>

      {/* 편집 버튼 영역 */}
      <div className="edit-actions">
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="btn-edit-mode">
            수정 모드
          </button>
        ) : (
          <div className="edit-buttons">
            <button 
              onClick={saveMarketingStats} 
              className="btn-save"
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
            <button 
              onClick={() => setIsEditing(false)} 
              className="btn-cancel"
              disabled={isSaving}
            >
              취소
            </button>
          </div>
        )}
      </div>

      {/* 매출 통계 */}
      {activeSubTab === 'revenue' && (
        <div className="revenue-stats">
          {/* 주간 매출 */}
          <div className="revenue-section">
            <div className="section-header">
              <h3>{activeTab === 'pension' ? '초호펜션' : '초호쉼터'} 주간 매출</h3>
              <div className="date-navigation">
                <button onClick={() => handleWeekChange('prev')} className="nav-btn">◀</button>
                <span className="date-range">
                  {formatDate(weeklyDateRange.startDate)} ~ {formatDate(weeklyDateRange.endDate)}
                </span>
                <button onClick={() => handleWeekChange('next')} className="nav-btn">▶</button>
              </div>
            </div>
            <div className="revenue-summary">
              <div className="summary-item">
                <span className="label">총 매출</span>
                <span className="value">{currentSalesData.weekly.total.toLocaleString()}원</span>
              </div>
              {activeTab === 'shelter' && (
                <>
                  <div className="summary-item">
                    <span className="label">호수뷰 매출</span>
                    <span className="value">
                      {(currentSalesData.weekly.total - currentSalesData.weekly.groupTotal).toLocaleString()}원
                      <small> ({currentSalesData.weekly.count - currentSalesData.weekly.groupCount}건)</small>
                    </span>
                  </div>
                  <div className="summary-item group-revenue">
                    <span className="label">단체&야유회</span>
                    <span className="value">
                      {currentSalesData.weekly.groupTotal.toLocaleString()}원
                      <small> ({currentSalesData.weekly.groupCount}건)</small>
                    </span>
                  </div>
                </>
              )}
              {activeTab === 'pension' && (
                <div className="summary-item">
                  <span className="label">예약 건수</span>
                  <span className="value">{currentSalesData.weekly.count}건</span>
                </div>
              )}
              <div className="summary-item">
                <span className="label">일평균</span>
                <span className="value">
                  {Math.round(currentSalesData.weekly.total / 7).toLocaleString()}원
                </span>
              </div>
            </div>
            <div className="daily-breakdown">
              <h4>일별 매출</h4>
              <div className="daily-list">
                {currentSalesData.weekly.daily.map((day, index) => {
                  const dayName = ['일', '월', '화', '수', '목', '금', '토'][day.date.getDay()];
                  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                  return (
                    <div key={index} className={`daily-item ${isWeekend ? 'weekend' : ''}`}>
                      <span className="day-label">
                        {day.date.getMonth() + 1}/{day.date.getDate()} ({dayName})
                      </span>
                      <span className="day-revenue">
                        {day.revenue.toLocaleString()}원
                      </span>
                      <span className="day-count">({day.count}건)</span>
                      {activeTab === 'shelter' && day.groupCount > 0 && (
                        <span className="day-group" title="단체&야유회">
                          🚌 {day.groupRevenue.toLocaleString()}원
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 월간 매출 */}
          <div className="revenue-section">
            <div className="section-header">
              <h3>{activeTab === 'pension' ? '초호펜션' : '초호쉼터'} 월간 매출</h3>
              <div className="date-navigation">
                <button onClick={() => handleMonthChange('prev')} className="nav-btn">◀</button>
                <span className="date-range">
                  {formatMonth(monthlyDateRange.year, monthlyDateRange.month)}
                </span>
                <button onClick={() => handleMonthChange('next')} className="nav-btn">▶</button>
              </div>
            </div>
            <div className="revenue-summary">
              <div className="summary-item">
                <span className="label">총 매출</span>
                <span className="value">{currentSalesData.monthly.total.toLocaleString()}원</span>
              </div>
              {activeTab === 'shelter' && (
                <>
                  <div className="summary-item">
                    <span className="label">호수뷰 매출</span>
                    <span className="value">
                      {(currentSalesData.monthly.total - currentSalesData.monthly.groupTotal).toLocaleString()}원
                      <small> ({currentSalesData.monthly.count - currentSalesData.monthly.groupCount}건)</small>
                    </span>
                  </div>
                  <div className="summary-item group-revenue">
                    <span className="label">단체&야유회</span>
                    <span className="value">
                      {currentSalesData.monthly.groupTotal.toLocaleString()}원
                      <small> ({currentSalesData.monthly.groupCount}건)</small>
                    </span>
                  </div>
                </>
              )}
              {activeTab === 'pension' && (
                <div className="summary-item">
                  <span className="label">예약 건수</span>
                  <span className="value">{currentSalesData.monthly.count}건</span>
                </div>
              )}
              <div className="summary-item">
                <span className="label">일평균</span>
                <span className="value">
                  {currentSalesData.monthly.daily.length > 0 
                    ? Math.round(currentSalesData.monthly.total / currentSalesData.monthly.daily.length).toLocaleString()
                    : 0}원
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 방문 통계 */}
      {activeSubTab === 'visit' && (
        <div className="visit-stats">
          <div className="stats-section">
            <h3>{activeTab === 'pension' ? '초호펜션' : '초호쉼터'} 홈페이지 방문 통계</h3>
            <div className="input-grid">
              <div className="input-group">
                <label>방문자 수</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentStats.visitors}
                    onChange={(e) => {
                      if (activeTab === 'pension') {
                        setPensionStats({...pensionStats, visitors: e.target.value});
                      } else {
                        setShelterStats({...shelterStats, visitors: e.target.value});
                      }
                    }}
                    placeholder="예: 1,234"
                  />
                ) : (
                  <div className="display-value">{currentStats.visitors || '-'}</div>
                )}
              </div>
              <div className="input-group">
                <label>페이지뷰</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentStats.pageViews}
                    onChange={(e) => {
                      if (activeTab === 'pension') {
                        setPensionStats({...pensionStats, pageViews: e.target.value});
                      } else {
                        setShelterStats({...shelterStats, pageViews: e.target.value});
                      }
                    }}
                    placeholder="예: 5,678"
                  />
                ) : (
                  <div className="display-value">{currentStats.pageViews || '-'}</div>
                )}
              </div>
            </div>
          </div>

          <div className="stats-section">
            <h3>{activeTab === 'pension' ? '초호펜션' : '초호쉼터'} 네이버 플레이스 방문자 통계</h3>
            <div className="input-group">
              <label>총 유입수</label>
              {isEditing ? (
                <input
                  type="text"
                  value={currentStats.totalVisits}
                  onChange={(e) => {
                    if (activeTab === 'pension') {
                      setPensionStats({...pensionStats, totalVisits: e.target.value});
                    } else {
                      setShelterStats({...shelterStats, totalVisits: e.target.value});
                    }
                  }}
                  placeholder="예: 10,000"
                />
              ) : (
                <div className="display-value">{currentStats.totalVisits || '-'}</div>
              )}
            </div>

            <div className="channel-header">
              <h4>유입 채널 TOP</h4>
              {isEditing && (
                <button onClick={addChannel} className="btn-add-channel">
                  + 채널 추가
                </button>
              )}
            </div>
            <div className="channel-list">
              {currentStats.channels.map((channel, index) => (
                <div key={index} className="channel-item">
                  <div className="channel-rank">{channel.rank}위</div>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={channel.name}
                        onChange={(e) => {
                          const newChannels = [...currentStats.channels];
                          newChannels[index].name = e.target.value;
                          if (activeTab === 'pension') {
                            setPensionStats({...pensionStats, channels: newChannels});
                          } else {
                            setShelterStats({...shelterStats, channels: newChannels});
                          }
                        }}
                        placeholder="채널명"
                        className="channel-name-input"
                      />
                      <input
                        type="text"
                        value={channel.visits}
                        onChange={(e) => {
                          const newChannels = [...currentStats.channels];
                          newChannels[index].visits = e.target.value;
                          if (activeTab === 'pension') {
                            setPensionStats({...pensionStats, channels: newChannels});
                          } else {
                            setShelterStats({...shelterStats, channels: newChannels});
                          }
                        }}
                        placeholder="방문수"
                        className="channel-visits-input"
                      />
                      <button 
                        onClick={() => removeChannel(index)}
                        className="btn-remove-channel"
                      >
                        삭제
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="channel-name">{channel.name || '-'}</div>
                      <div className="channel-visits">{channel.visits || '-'}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {currentStats.lastUpdated && (
            <div className="last-updated">
              마지막 업데이트: {new Date(currentStats.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* 광고 통계 */}
      {activeSubTab === 'ad' && (
        <div className="ad-stats">
          <div className="stats-section">
            <h3>{activeTab === 'pension' ? '초호펜션' : '초호쉼터'} 광고 지출 현황</h3>
            <div className="ad-expense-grid">
              <div className="ad-expense-item">
                <label>네이버 광고</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentStats.adExpense.naver}
                    onChange={(e) => {
                      const newAdExpense = { ...currentStats.adExpense, naver: e.target.value };
                      if (activeTab === 'pension') {
                        setPensionStats({...pensionStats, adExpense: newAdExpense});
                      } else {
                        setShelterStats({...shelterStats, adExpense: newAdExpense});
                      }
                    }}
                    placeholder="예: 500,000"
                  />
                ) : (
                  <div className="display-value">{currentStats.adExpense.naver ? `${currentStats.adExpense.naver}원` : '-'}</div>
                )}
              </div>
              <div className="ad-expense-item">
                <label>구글 광고</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentStats.adExpense.google}
                    onChange={(e) => {
                      const newAdExpense = { ...currentStats.adExpense, google: e.target.value };
                      if (activeTab === 'pension') {
                        setPensionStats({...pensionStats, adExpense: newAdExpense});
                      } else {
                        setShelterStats({...shelterStats, adExpense: newAdExpense});
                      }
                    }}
                    placeholder="예: 300,000"
                  />
                ) : (
                  <div className="display-value">{currentStats.adExpense.google ? `${currentStats.adExpense.google}원` : '-'}</div>
                )}
              </div>
              <div className="ad-expense-item">
                <label>페이스북 광고</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentStats.adExpense.facebook}
                    onChange={(e) => {
                      const newAdExpense = { ...currentStats.adExpense, facebook: e.target.value };
                      if (activeTab === 'pension') {
                        setPensionStats({...pensionStats, adExpense: newAdExpense});
                      } else {
                        setShelterStats({...shelterStats, adExpense: newAdExpense});
                      }
                    }}
                    placeholder="예: 200,000"
                  />
                ) : (
                  <div className="display-value">{currentStats.adExpense.facebook ? `${currentStats.adExpense.facebook}원` : '-'}</div>
                )}
              </div>
              <div className="ad-expense-item">
                <label>인스타그램 광고</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentStats.adExpense.instagram}
                    onChange={(e) => {
                      const newAdExpense = { ...currentStats.adExpense, instagram: e.target.value };
                      if (activeTab === 'pension') {
                        setPensionStats({...pensionStats, adExpense: newAdExpense});
                      } else {
                        setShelterStats({...shelterStats, adExpense: newAdExpense});
                      }
                    }}
                    placeholder="예: 150,000"
                  />
                ) : (
                  <div className="display-value">{currentStats.adExpense.instagram ? `${currentStats.adExpense.instagram}원` : '-'}</div>
                )}
              </div>
            </div>
            <div className="ad-total">
              <label>총 광고 지출</label>
              {isEditing ? (
                <input
                  type="text"
                  value={currentStats.adExpense.total}
                  onChange={(e) => {
                    const newAdExpense = { ...currentStats.adExpense, total: e.target.value };
                    if (activeTab === 'pension') {
                      setPensionStats({...pensionStats, adExpense: newAdExpense});
                    } else {
                      setShelterStats({...shelterStats, adExpense: newAdExpense});
                    }
                  }}
                  placeholder="예: 1,150,000"
                  className="total-input"
                />
              ) : (
                <div className="display-value total">{currentStats.adExpense.total ? `${currentStats.adExpense.total}원` : '-'}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 지출 내역 */}
      {activeSubTab === 'expense' && (
        <div className="expense-stats">
          <div className="stats-section">
            <h3>{activeTab === 'pension' ? '초호펜션' : '초호쉼터'} 지출 내역</h3>
            {isEditing && (
              <button onClick={addExpenseItem} className="btn-add-expense">
                + 항목 추가
              </button>
            )}
            <div className="expense-list">
              {currentStats.expenses.length === 0 && !isEditing ? (
                <div className="no-expense">등록된 지출 내역이 없습니다.</div>
              ) : (
                currentStats.expenses.map((expense) => (
                  <div key={expense.id} className="expense-item">
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={expense.category}
                          onChange={(e) => updateExpenseItem(expense.id, 'category', e.target.value)}
                          placeholder="항목명"
                          className="expense-category"
                        />
                        <input
                          type="text"
                          value={expense.amount}
                          onChange={(e) => updateExpenseItem(expense.id, 'amount', e.target.value)}
                          placeholder="금액"
                          className="expense-amount"
                        />
                        <input
                          type="text"
                          value={expense.note}
                          onChange={(e) => updateExpenseItem(expense.id, 'note', e.target.value)}
                          placeholder="비고"
                          className="expense-note"
                        />
                        <button 
                          onClick={() => removeExpenseItem(expense.id)}
                          className="btn-remove-expense"
                        >
                          삭제
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="expense-category">{expense.category || '-'}</div>
                        <div className="expense-amount">{expense.amount ? `${expense.amount}원` : '-'}</div>
                        <div className="expense-note">{expense.note || '-'}</div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            {currentStats.expenses.length > 0 && !isEditing && (
              <div className="expense-total">
                <span>총 지출:</span>
                <span className="total-amount">
                  {currentStats.expenses
                    .reduce((sum, item) => sum + (parseInt(item.amount?.replace(/,/g, '') || 0)), 0)
                    .toLocaleString()}원
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingStats;