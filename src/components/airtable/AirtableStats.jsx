// Airtable 통계 대시보드
import React, { useState, useEffect } from 'react';
import AirtableService from '../../services/airtableService';
import './AirtableStats.css';

function AirtableStats() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [stats, setStats] = useState([]);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // 통계 데이터 로드
  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // 최근 6개월 데이터 로드
      const endYear = selectedYear;
      const endMonth = selectedMonth;
      const startYear = endMonth > 6 ? endYear : endYear - 1;
      const startMonth = endMonth > 6 ? endMonth - 5 : endMonth + 7;
      
      const data = await AirtableService.getMarketingStatsRange(
        'pension',
        startYear,
        startMonth,
        endYear,
        endMonth
      );
      
      setStats(data);
    } catch (err) {
      setError('데이터 로드 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Airtable 동기화
  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await AirtableService.syncAirtableToFirebase();
      
      if (result.success) {
        setLastSync(new Date());
        await loadStats(); // 동기화 후 데이터 새로고침
        alert('Airtable 데이터가 성공적으로 동기화되었습니다.');
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError('동기화 실패: ' + err.message);
      alert('동기화 실패: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadStats();
    
    // localStorage에서 마지막 동기화 시간 가져오기
    const lastSyncTime = localStorage.getItem('airtable_last_sync');
    if (lastSyncTime) {
      setLastSync(new Date(lastSyncTime));
    }
  }, [selectedYear, selectedMonth]);

  // 숫자 포맷팅
  const formatNumber = (num) => {
    if (!num) return '0';
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  // 금액 포맷팅
  const formatCurrency = (num) => {
    if (!num) return '₩0';
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(num);
  };

  // CTR 계산
  const calculateCTR = (clicks, impressions) => {
    if (!impressions || impressions === 0) return '0%';
    return ((clicks / impressions) * 100).toFixed(2) + '%';
  };

  // CPC 계산
  const calculateCPC = (cost, clicks) => {
    if (!clicks || clicks === 0) return '₩0';
    return formatCurrency(Math.round(cost / clicks));
  };

  return (
    <div className="airtable-stats">
      <div className="stats-header">
        <div className="header-left">
          <h2>📊 마케팅 통계 (Airtable 연동)</h2>
          <div className="sync-info">
            {lastSync && (
              <span className="last-sync">
                마지막 동기화: {lastSync.toLocaleString('ko-KR')}
              </span>
            )}
          </div>
        </div>
        
        <div className="header-right">
          <div className="period-selector">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}월</option>
              ))}
            </select>
          </div>
          
          <button 
            className="sync-button"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? '동기화 중...' : '🔄 Airtable 동기화'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="loading">데이터 로딩 중...</div>
      ) : (
        <div className="stats-grid">
          {stats.length === 0 ? (
            <div className="no-data">
              <p>데이터가 없습니다.</p>
              <p>Airtable 동기화 버튼을 눌러 데이터를 가져오세요.</p>
            </div>
          ) : (
            stats.map(stat => (
              <div key={stat.id} className="stat-card">
                <div className="stat-header">
                  <h3>{stat.year}년 {stat.month}월</h3>
                  {stat.source === 'airtable' && (
                    <span className="source-badge">Airtable</span>
                  )}
                </div>
                
                <div className="stat-content">
                  <div className="stat-row">
                    <span className="stat-label">노출수:</span>
                    <span className="stat-value">{formatNumber(stat.data?.impressions)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">클릭수:</span>
                    <span className="stat-value">{formatNumber(stat.data?.clicks)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">광고비:</span>
                    <span className="stat-value">{formatCurrency(stat.data?.adCost)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">CTR:</span>
                    <span className="stat-value">
                      {calculateCTR(stat.data?.clicks, stat.data?.impressions)}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">CPC:</span>
                    <span className="stat-value">
                      {calculateCPC(stat.data?.adCost, stat.data?.clicks)}
                    </span>
                  </div>
                </div>
                
                <div className="stat-footer">
                  <small>업데이트: {new Date(stat.timestamp).toLocaleDateString('ko-KR')}</small>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="stats-summary">
        <h3>📈 기간 요약</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">총 노출수:</span>
            <span className="summary-value">
              {formatNumber(stats.reduce((sum, s) => sum + (s.data?.impressions || 0), 0))}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">총 클릭수:</span>
            <span className="summary-value">
              {formatNumber(stats.reduce((sum, s) => sum + (s.data?.clicks || 0), 0))}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">총 광고비:</span>
            <span className="summary-value">
              {formatCurrency(stats.reduce((sum, s) => sum + (s.data?.adCost || 0), 0))}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">평균 CTR:</span>
            <span className="summary-value">
              {calculateCTR(
                stats.reduce((sum, s) => sum + (s.data?.clicks || 0), 0),
                stats.reduce((sum, s) => sum + (s.data?.impressions || 0), 0)
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AirtableStats;
