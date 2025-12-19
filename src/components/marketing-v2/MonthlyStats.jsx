// src/components/marketing-v2/MonthlyStats.jsx
import React from 'react';
import './MonthlyStats.css';

const MonthlyStats = ({ previousData }) => {
  const { twoMonthsAgo, lastMonth } = previousData || {};
  
  const getMonthName = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    return `${parseInt(month)}월`;
  };
  
  const calculateTotals = (data) => {
    if (!data) {
      return {
        revenue: 0,
        visitors: 0,
        adCost: 0,
        clicks: 0,
        impressions: 0
      };
    }
    
    // 펜션과 쉼터 데이터 합산
    let totals = {
      revenue: 0,
      visitors: 0,
      adCost: 0,
      clicks: 0,
      impressions: 0
    };
    
    ['pension', 'shelter'].forEach(type => {
      if (data[type]) {
        totals.revenue += data[type].revenue?.total || 0;
        totals.visitors += data[type].visitors?.website?.visitors || 0;
        totals.visitors += data[type].visitors?.naverPlace?.total || 0;
        
        if (data[type].advertising?.channels) {
          data[type].advertising.channels.forEach(channel => {
            totals.adCost += channel.cost || 0;
            totals.clicks += channel.clicks || 0;
            totals.impressions += channel.impressions || 0;
          });
        }
      }
    });
    
    return totals;
  };
  
  const twoMonthsAgoTotals = calculateTotals(twoMonthsAgo);
  const lastMonthTotals = calculateTotals(lastMonth);
  
  return (
    <div className="monthly-stats-summary">
      {/* 전전월 통계 */}
      <div className="month-summary">
        <h3>{getMonthName(twoMonthsAgo?.month)} 통계 요약</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">전체 매출</span>
            <span className="value">{twoMonthsAgoTotals.revenue.toLocaleString()}원</span>
          </div>
          <div className="summary-item">
            <span className="label">전체 방문자</span>
            <span className="value">{twoMonthsAgoTotals.visitors.toLocaleString()}명</span>
          </div>
          <div className="summary-item">
            <span className="label">전체 광고비</span>
            <span className="value">{twoMonthsAgoTotals.adCost.toLocaleString()}원</span>
          </div>
          <div className="summary-item">
            <span className="label">광고 성과</span>
            <span className="value">
              클릭: {twoMonthsAgoTotals.clicks.toLocaleString()}<br/>
              노출: {twoMonthsAgoTotals.impressions.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      
      {/* 전월 통계 */}
      <div className="month-summary">
        <h3>{getMonthName(lastMonth?.month)} 통계 요약</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">전체 매출</span>
            <span className="value">{lastMonthTotals.revenue.toLocaleString()}원</span>
          </div>
          <div className="summary-item">
            <span className="label">전체 방문자</span>
            <span className="value">{lastMonthTotals.visitors.toLocaleString()}명</span>
          </div>
          <div className="summary-item">
            <span className="label">전체 광고비</span>
            <span className="value">{lastMonthTotals.adCost.toLocaleString()}원</span>
          </div>
          <div className="summary-item">
            <span className="label">광고 성과</span>
            <span className="value">
              클릭: {lastMonthTotals.clicks.toLocaleString()}<br/>
              노출: {lastMonthTotals.impressions.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      
      {/* 전월 대비 증감 */}
      {twoMonthsAgo && lastMonth && (
        <div className="month-comparison">
          <h4>전월 대비</h4>
          <div className="comparison-items">
            <span className={`comparison-item ${lastMonthTotals.revenue >= twoMonthsAgoTotals.revenue ? 'up' : 'down'}`}>
              매출 {lastMonthTotals.revenue >= twoMonthsAgoTotals.revenue ? '▲' : '▼'} 
              {Math.abs(Math.round((lastMonthTotals.revenue - twoMonthsAgoTotals.revenue) / (twoMonthsAgoTotals.revenue || 1) * 100))}%
            </span>
            <span className={`comparison-item ${lastMonthTotals.visitors >= twoMonthsAgoTotals.visitors ? 'up' : 'down'}`}>
              방문자 {lastMonthTotals.visitors >= twoMonthsAgoTotals.visitors ? '▲' : '▼'} 
              {Math.abs(Math.round((lastMonthTotals.visitors - twoMonthsAgoTotals.visitors) / (twoMonthsAgoTotals.visitors || 1) * 100))}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyStats;