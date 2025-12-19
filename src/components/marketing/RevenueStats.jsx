// src/components/marketing/RevenueStats.jsx
import React, { useState, useEffect } from 'react';
import './RevenueStats.css';

const RevenueStats = ({ reservations, selectedMonth }) => {
  const [viewMode, setViewMode] = useState('monthly'); // monthly, weekly, daily
  const [revenueData, setRevenueData] = useState({
    total: 0,
    count: 0,
    groupTotal: 0,
    groupCount: 0,
    average: 0,
    daily: []
  });

  useEffect(() => {
    calculateRevenue();
  }, [reservations, selectedMonth, viewMode]);

  const calculateRevenue = () => {
    const monthStart = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
    const monthEnd = new Date(selectedMonth.year, selectedMonth.month, 0);
    monthEnd.setHours(23, 59, 59, 999);

    let total = 0;
    let count = 0;
    let groupTotal = 0;
    let groupCount = 0;
    const dailyData = {};

    // 일별 데이터 초기화
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      const dateKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dailyData[dateKey] = {
        date: new Date(selectedMonth.year, selectedMonth.month - 1, d),
        revenue: 0,
        count: 0,
        groupRevenue: 0,
        groupCount: 0
      };
    }

    // 예약 데이터 집계
    reservations.forEach(res => {
      if (res.status !== '예약확정') return;
      
      const checkIn = new Date(res.checkIn);
      if (checkIn < monthStart || checkIn > monthEnd) return;
      
      const amount = res.totalPrice || 0;
      const isGroupReservation = res.roomName === '단체예약';
      const dateKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, '0')}-${String(checkIn.getDate()).padStart(2, '0')}`;
      
      total += amount;
      count++;
      
      if (isGroupReservation) {
        groupTotal += amount;
        groupCount++;
      }
      
      if (dailyData[dateKey]) {
        dailyData[dateKey].revenue += amount;
        dailyData[dateKey].count++;
        
        if (isGroupReservation) {
          dailyData[dateKey].groupRevenue += amount;
          dailyData[dateKey].groupCount++;
        }
      }
    });

    const dailyArray = Object.values(dailyData).sort((a, b) => a.date - b.date);
    const average = dailyArray.length > 0 ? Math.round(total / dailyArray.length) : 0;

    setRevenueData({
      total,
      count,
      groupTotal,
      groupCount,
      average,
      daily: dailyArray
    });
  };

  // 주간 데이터 그룹핑
  const getWeeklyData = () => {
    const weeks = {};
    
    revenueData.daily.forEach(day => {
      const weekNum = getWeekNumber(day.date);
      if (!weeks[weekNum]) {
        weeks[weekNum] = {
          weekNum,
          startDate: getWeekStartDate(day.date),
          endDate: getWeekEndDate(day.date),
          revenue: 0,
          count: 0,
          groupRevenue: 0,
          groupCount: 0,
          days: []
        };
      }
      
      weeks[weekNum].revenue += day.revenue;
      weeks[weekNum].count += day.count;
      weeks[weekNum].groupRevenue += day.groupRevenue;
      weeks[weekNum].groupCount += day.groupCount;
      weeks[weekNum].days.push(day);
    });
    
    return Object.values(weeks);
  };

  // 주차 계산 헬퍼 함수들
  const getWeekNumber = (date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const diff = date.getDate() + firstDay.getDay();
    return Math.ceil(diff / 7);
  };

  const getWeekStartDate = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  };

  const getWeekEndDate = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    return d;
  };

  const formatDate = (date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatMonth = (year, month) => {
    return `${year}년 ${month}월`;
  };

  const getDayName = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
  };

  return (
    <div className="revenue-stats">
      <div className="revenue-header">
        <h3>💰 {formatMonth(selectedMonth.year, selectedMonth.month)} 매출 통계</h3>
        <div className="view-mode-tabs">
          <button 
            className={viewMode === 'monthly' ? 'active' : ''}
            onClick={() => setViewMode('monthly')}
          >
            월간
          </button>
          <button 
            className={viewMode === 'weekly' ? 'active' : ''}
            onClick={() => setViewMode('weekly')}
          >
            주간
          </button>
          <button 
            className={viewMode === 'daily' ? 'active' : ''}
            onClick={() => setViewMode('daily')}
          >
            일간
          </button>
        </div>
      </div>

      {/* 전체 요약 */}
      <div className="revenue-summary">
        <div className="summary-card total">
          <h4>총 매출</h4>
          <div className="value">{revenueData.total.toLocaleString()}원</div>
          <div className="sub-info">{revenueData.count}건</div>
        </div>
        <div className="summary-card general">
          <h4>일반 매출</h4>
          <div className="value">
            {(revenueData.total - revenueData.groupTotal).toLocaleString()}원
          </div>
          <div className="sub-info">{revenueData.count - revenueData.groupCount}건</div>
        </div>
        <div className="summary-card group">
          <h4>단체 매출</h4>
          <div className="value">{revenueData.groupTotal.toLocaleString()}원</div>
          <div className="sub-info">{revenueData.groupCount}건</div>
        </div>
        <div className="summary-card average">
          <h4>일평균</h4>
          <div className="value">{revenueData.average.toLocaleString()}원</div>
          <div className="sub-info">
            {revenueData.groupCount > 0 && 
              `단체 ${Math.round(revenueData.groupTotal / revenueData.daily.length).toLocaleString()}원`
            }
          </div>
        </div>
      </div>

      {/* 월간 뷰 */}
      {viewMode === 'monthly' && (
        <div className="monthly-view">
          <h4>월간 추이</h4>
          <div className="monthly-chart">
            {/* 간단한 막대 차트 */}
            <div className="chart-bars">
              {revenueData.daily.map((day, idx) => {
                const maxRevenue = Math.max(...revenueData.daily.map(d => d.revenue));
                const heightPercent = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                
                return (
                  <div key={idx} className="bar-wrapper">
                    <div 
                      className={`bar ${isWeekend ? 'weekend' : ''}`}
                      style={{ height: `${heightPercent}%` }}
                      title={`${formatDate(day.date)}: ${day.revenue.toLocaleString()}원`}
                    >
                      {day.groupCount > 0 && (
                        <div 
                          className="group-portion"
                          style={{ 
                            height: `${(day.groupRevenue / day.revenue) * 100}%` 
                          }}
                        />
                      )}
                    </div>
                    <div className="bar-label">
                      {day.date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 주간 뷰 */}
      {viewMode === 'weekly' && (
        <div className="weekly-view">
          <h4>주간별 매출</h4>
          <div className="weekly-list">
            {getWeeklyData().map((week, idx) => (
              <div key={idx} className="week-item">
                <div className="week-header">
                  <span className="week-label">
                    {week.weekNum}주차 ({formatDate(week.startDate)} ~ {formatDate(week.endDate)})
                  </span>
                  <span className="week-total">
                    {week.revenue.toLocaleString()}원
                  </span>
                </div>
                <div className="week-details">
                  <div className="detail-item">
                    <span>일반: {(week.revenue - week.groupRevenue).toLocaleString()}원</span>
                    <span className="count">({week.count - week.groupCount}건)</span>
                  </div>
                  {week.groupCount > 0 && (
                    <div className="detail-item group">
                      <span>단체: {week.groupRevenue.toLocaleString()}원</span>
                      <span className="count">({week.groupCount}건)</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일간 뷰 */}
      {viewMode === 'daily' && (
        <div className="daily-view">
          <h4>일별 상세</h4>
          <div className="daily-list">
            {revenueData.daily.map((day, idx) => {
              const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
              return (
                <div key={idx} className={`daily-item ${isWeekend ? 'weekend' : ''}`}>
                  <div className="date-info">
                    <span className="date">
                      {day.date.getMonth() + 1}/{day.date.getDate()}
                    </span>
                    <span className="day-name">({getDayName(day.date)})</span>
                  </div>
                  <div className="revenue-info">
                    <span className="revenue">
                      {day.revenue.toLocaleString()}원
                    </span>
                    <span className="count">({day.count}건)</span>
                  </div>
                  {day.groupCount > 0 && (
                    <div className="group-badge" title="단체 예약">
                      🚌 {day.groupRevenue.toLocaleString()}원
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 예약 출처별 통계 */}
      <div className="source-stats">
        <h4>예약 출처별 매출</h4>
        <div className="source-grid">
          {getBookingSourceStats(reservations, selectedMonth).map((source, idx) => (
            <div key={idx} className="source-item">
              <div className="source-name">{source.name}</div>
              <div className="source-revenue">
                {source.revenue.toLocaleString()}원
              </div>
              <div className="source-count">{source.count}건</div>
              <div className="source-percent">
                {source.percentage.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 예약 출처 통계 헬퍼 함수
const getBookingSourceStats = (reservations, selectedMonth) => {
  const monthStart = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
  const monthEnd = new Date(selectedMonth.year, selectedMonth.month, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const sourceStats = {
    naver_place: { name: '네이버 플레이스', count: 0, revenue: 0 },
    naver_booking: { name: '네이버 예약', count: 0, revenue: 0 },
    naver_map: { name: '네이버 지도', count: 0, revenue: 0 },
    etc: { name: '기타', count: 0, revenue: 0 }
  };
  
  let totalRevenue = 0;
  
  reservations.forEach(res => {
    if (res.status !== '예약확정') return;
    
    const checkIn = new Date(res.checkIn);
    if (checkIn < monthStart || checkIn > monthEnd) return;
    
    const source = res.source || 'etc';
    if (sourceStats[source]) {
      sourceStats[source].count += 1;
      sourceStats[source].revenue += res.totalPrice || 0;
      totalRevenue += res.totalPrice || 0;
    }
  });
  
  return Object.values(sourceStats).map(source => ({
    ...source,
    percentage: totalRevenue > 0 ? (source.revenue / totalRevenue) * 100 : 0
  }));
};

export default RevenueStats;
