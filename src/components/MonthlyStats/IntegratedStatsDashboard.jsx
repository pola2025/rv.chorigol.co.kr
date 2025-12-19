// 초호펜션 + 초호쉼터 통합 통계 대시보드
import React, { useState, useEffect } from 'react';
import { getIntegratedMonthlyStats, getYearlyStats } from '../../services/monthlyStatsService';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils';
import './IntegratedStatsDashboard.css';

const IntegratedStatsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [monthlyData, setMonthlyData] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'yearly'

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, viewMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewMode === 'monthly') {
        const data = await getIntegratedMonthlyStats(selectedYear, selectedMonth);
        setMonthlyData(data);
      } else {
        const data = await getYearlyStats('integrated', selectedYear);
        setYearlyData(data);
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderMonthlyView = () => {
    if (!monthlyData) return null;

    const { pension, shelter, total } = monthlyData;

    return (
      <div className="monthly-view">
        {/* 월별 요약 */}
        <div className="summary-section">
          <h3>📊 {selectedYear}년 {selectedMonth}월 통합 요약</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <label>총 매출</label>
              <div className="summary-value">{formatCurrency(total.revenue_total)}</div>
            </div>
            <div className="summary-item">
              <label>총 방문자</label>
              <div className="summary-value">{formatNumber(total.visitors_total)}명</div>
            </div>
            <div className="summary-item">
              <label>신규 예약</label>
              <div className="summary-value">{formatNumber(total.bookings_new)}건</div>
            </div>
            <div className="summary-item">
              <label>총 광고비</label>
              <div className="summary-value">{formatCurrency(total.ad_total_spend)}</div>
            </div>
          </div>
        </div>

        {/* 펜션별 비교 */}
        <div className="comparison-section">
          <h3>🏠 펜션별 상세 비교</h3>
          <table className="comparison-table">
            <thead>
              <tr>
                <th>구분</th>
                <th>초호펜션</th>
                <th>초호쉼터</th>
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>매출</td>
                <td>{formatCurrency(pension?.revenue_total || 0)}</td>
                <td>{formatCurrency(shelter?.revenue_total || 0)}</td>
                <td className="total">{formatCurrency(total.revenue_total)}</td>
              </tr>
              <tr>
                <td>방문자</td>
                <td>{formatNumber(pension?.visitors_total || 0)}명</td>
                <td>{formatNumber(shelter?.visitors_total || 0)}명</td>
                <td className="total">{formatNumber(total.visitors_total)}명</td>
              </tr>
              <tr>
                <td>신규 예약</td>
                <td>{formatNumber(pension?.bookings_new || 0)}건</td>
                <td>{formatNumber(shelter?.bookings_new || 0)}건</td>
                <td className="total">{formatNumber(total.bookings_new)}건</td>
              </tr>
              <tr>
                <td>광고비</td>
                <td>{formatCurrency(pension?.ad_total_spend || 0)}</td>
                <td>{formatCurrency(shelter?.ad_total_spend || 0)}</td>
                <td className="total">{formatCurrency(total.ad_total_spend)}</td>
              </tr>
              <tr>
                <td>전환율</td>
                <td>{formatPercentage(pension?.metrics_conversion_rate || 0)}</td>
                <td>{formatPercentage(shelter?.metrics_conversion_rate || 0)}</td>
                <td className="total">
                  {formatPercentage(
                    total.visitors_total > 0 
                      ? (total.bookings_new / total.visitors_total) * 100 
                      : 0
                  )}
                </td>
              </tr>
              <tr>
                <td>ROAS</td>
                <td>{formatPercentage(pension?.metrics_roas || 0)}</td>
                <td>{formatPercentage(shelter?.metrics_roas || 0)}</td>
                <td className="total">
                  {formatPercentage(
                    total.ad_total_spend > 0 
                      ? (total.revenue_total / total.ad_total_spend) * 100 
                      : 0
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 매출 구성 비율 */}
        <div className="ratio-section">
          <h3>📈 매출 구성 비율</h3>
          <div className="ratio-grid">
            <div className="ratio-item">
              <div className="ratio-label">초호펜션</div>
              <div className="ratio-bar">
                <div 
                  className="ratio-fill pension"
                  style={{
                    width: `${total.revenue_total > 0 
                      ? ((pension?.revenue_total || 0) / total.revenue_total) * 100 
                      : 0}%`
                  }}
                />
              </div>
              <div className="ratio-value">
                {total.revenue_total > 0 
                  ? formatPercentage(((pension?.revenue_total || 0) / total.revenue_total) * 100)
                  : '0%'}
              </div>
            </div>
            <div className="ratio-item">
              <div className="ratio-label">초호쉼터</div>
              <div className="ratio-bar">
                <div 
                  className="ratio-fill shelter"
                  style={{
                    width: `${total.revenue_total > 0 
                      ? ((shelter?.revenue_total || 0) / total.revenue_total) * 100 
                      : 0}%`
                  }}
                />
              </div>
              <div className="ratio-value">
                {total.revenue_total > 0 
                  ? formatPercentage(((shelter?.revenue_total || 0) / total.revenue_total) * 100)
                  : '0%'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderYearlyView = () => {
    if (!yearlyData) return null;

    const { pension, shelter, total } = yearlyData;

    return (
      <div className="yearly-view">
        {/* 연간 요약 */}
        <div className="summary-section">
          <h3>📊 {selectedYear}년 연간 통합 요약</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <label>연간 총 매출</label>
              <div className="summary-value">{formatCurrency(total.revenue)}</div>
            </div>
            <div className="summary-item">
              <label>연간 총 방문자</label>
              <div className="summary-value">{formatNumber(total.visitors)}명</div>
            </div>
            <div className="summary-item">
              <label>연간 신규 예약</label>
              <div className="summary-value">{formatNumber(total.bookings)}건</div>
            </div>
            <div className="summary-item">
              <label>연간 총 광고비</label>
              <div className="summary-value">{formatCurrency(total.adSpend)}</div>
            </div>
          </div>
        </div>

        {/* 월별 추이 차트 (간단한 테이블 형태) */}
        <div className="trend-section">
          <h3>📈 월별 매출 추이</h3>
          <table className="trend-table">
            <thead>
              <tr>
                <th>월</th>
                <th>초호펜션</th>
                <th>초호쉼터</th>
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              {pension?.months?.map((_, index) => {
                const month = index + 1;
                const pensionMonth = pension.months[index];
                const shelterMonth = shelter?.months?.[index];
                const monthTotal = (pensionMonth?.revenue_total || 0) + 
                                 (shelterMonth?.revenue_total || 0);
                
                return (
                  <tr key={month}>
                    <td>{month}월</td>
                    <td>{formatCurrency(pensionMonth?.revenue_total || 0)}</td>
                    <td>{formatCurrency(shelterMonth?.revenue_total || 0)}</td>
                    <td className="total">{formatCurrency(monthTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>합계</th>
                <th>{formatCurrency(pension?.total?.revenue || 0)}</th>
                <th>{formatCurrency(shelter?.total?.revenue || 0)}</th>
                <th className="total">{formatCurrency(total.revenue)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="integrated-loading">데이터를 불러오는 중...</div>;
  }

  return (
    <div className="integrated-stats-dashboard">
      {/* 헤더 */}
      <div className="dashboard-header">
        <h2>초호펜션 + 초호쉼터 통합 통계</h2>
        <div className="header-controls">
          {/* 보기 모드 선택 */}
          <div className="view-mode-selector">
            <button 
              className={`mode-btn ${viewMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setViewMode('monthly')}
            >
              월별 보기
            </button>
            <button 
              className={`mode-btn ${viewMode === 'yearly' ? 'active' : ''}`}
              onClick={() => setViewMode('yearly')}
            >
              연간 보기
            </button>
          </div>

          {/* 기간 선택 */}
          {viewMode === 'monthly' && (
            <div className="period-selector">
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'yearly' && (
            <div className="period-selector">
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="dashboard-content">
        {viewMode === 'monthly' ? renderMonthlyView() : renderYearlyView()}
      </div>
    </div>
  );
};

export default IntegratedStatsDashboard;