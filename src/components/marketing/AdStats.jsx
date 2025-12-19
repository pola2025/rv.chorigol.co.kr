// src/components/marketing/AdStats.jsx
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import AdPlatformModal from './AdPlatformModal';
import AdDataInput from './AdDataInput';
import './AdStats.css';

const AdStats = ({ selectedMonth }) => {
  const [platforms, setPlatforms] = useState([]);
  const [monthlyData, setMonthlyData] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [showDataInput, setShowDataInput] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [chartMetric, setChartMetric] = useState('cost');

  useEffect(() => {
    loadPlatforms();
  }, []);

  useEffect(() => {
    if (platforms.length > 0) {
      loadMonthlyData();
    }
  }, [selectedMonth, platforms]);

  // 플랫폼 목록 로드
  const loadPlatforms = async () => {
    try {
      setLoading(true);
      const platformsSnapshot = await getDocs(collection(db, 'ad_platforms'));
      const platformsList = [];
      
      platformsSnapshot.forEach((doc) => {
        platformsList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setPlatforms(platformsList);
      if (platformsList.length > 0) {
        setActiveTab(0);
      }
    } catch (error) {
      console.error('플랫폼 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 월별 데이터 로드
  const loadMonthlyData = async () => {
    try {
      const year = selectedMonth.year;
      const month = String(selectedMonth.month).padStart(2, '0');
      const docId = `${year}${month}`; // 202501 형식
      
      const monthDoc = await getDoc(doc(db, 'monthly_ads', docId));
      
      if (monthDoc.exists()) {
        const docData = monthDoc.data();
        console.log('Loaded data:', docData);
        
        // 플랫폼별 데이터를 형식에 맞게 변환
        const formattedData = {};
        
        Object.keys(docData).forEach(key => {
          // 메타데이터 필드는 제외
          if (key !== 'lastUpdated' && key !== 'year' && key !== 'month') {
            formattedData[key] = {
              total: docData[key],
              campaigns: {}
            };
          }
        });
        
        setMonthlyData(formattedData);
      } else {
        setMonthlyData({});
      }
    } catch (error) {
      console.error('월별 광고 데이터 로드 오류:', error);
      setMonthlyData({});
    }
  };

  // 플랫폼 추가 - addDoc 사용으로 변경
  const handleAddPlatform = async (platformData) => {
    try {
      const newPlatform = {
        ...platformData,
        createdAt: new Date().toISOString()
      };
      
      // addDoc을 사용하여 자동으로 ID 생성
      const docRef = await addDoc(collection(db, 'ad_platforms'), newPlatform);
      console.log('플랫폼 추가 성공:', docRef.id);
      
      await loadPlatforms();
      setShowPlatformModal(false);
      return true;
    } catch (error) {
      console.error('플랫폼 추가 오류:', error);
      alert('플랫폼 추가 중 오류가 발생했습니다: ' + error.message);
      return false;
    }
  };

  // 플랫폼 삭제
  const handleDeletePlatform = async (platformId) => {
    if (!window.confirm('이 플랫폼을 삭제하시겠습니까?')) return;
    
    try {
      await deleteDoc(doc(db, 'ad_platforms', platformId));
      await loadPlatforms();
    } catch (error) {
      console.error('플랫폼 삭제 오류:', error);
    }
  };

  // 광고 데이터 저장
  const handleSaveAdData = async (platformName, data) => {
    try {
      const year = selectedMonth.year;
      const month = String(selectedMonth.month).padStart(2, '0');
      const docId = `${year}${month}`; // 202501 형식
      
      // 데이터 정리 - 매우 단순한 구조로
      const platformData = {};
      
      // total 데이터만 저장 (단순화)
      if (data.total) {
        platformData.impressions = parseInt(data.total.impressions) || 0;
        platformData.clicks = parseInt(data.total.clicks) || 0;
        platformData.cost = parseInt(data.total.cost) || 0;
        
        if (data.total.conversions !== undefined) {
          platformData.conversions = parseInt(data.total.conversions) || 0;
        }
        if (data.total.reach !== undefined) {
          platformData.reach = parseInt(data.total.reach) || 0;
        }
      }
      
      // 기존 데이터 로드
      let existingData = {};
      try {
        const existingDoc = await getDoc(doc(db, 'monthly_ads', docId));
        if (existingDoc.exists()) {
          existingData = existingDoc.data();
        }
      } catch (err) {
        console.log('No existing data');
      }
      
      // 플랫폼별 데이터 업데이트
      const updatedDoc = {
        ...existingData,
        [platformName]: platformData,
        lastUpdated: new Date().toISOString(),
        year: year,
        month: month
      };
      
      console.log('Saving simplified data:', updatedDoc);
      
      // Firebase에 저장
      await setDoc(doc(db, 'monthly_ads', docId), updatedDoc);
      
      // 로컬 상태 업데이트
      const newMonthlyData = { ...monthlyData };
      newMonthlyData[platformName] = {
        total: platformData,
        campaigns: data.campaigns || {}
      };
      setMonthlyData(newMonthlyData);
      
      setShowDataInput(false);
      alert('저장되었습니다!');
      return true;
    } catch (error) {
      console.error('광고 데이터 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다: ' + error.message);
      return false;
    }
  };

  // 자동 계산 지표
  const calculateMetrics = (platformData) => {
    if (!platformData) return {};
    
    const { impressions = 0, clicks = 0, cost = 0, conversions = 0 } = platformData.total || {};
    
    return {
      ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0,
      cpc: clicks > 0 ? Math.round(cost / clicks) : 0,
      cpm: impressions > 0 ? Math.round((cost / impressions) * 1000) : 0,
      cvr: clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : 0,
      cpa: conversions > 0 ? Math.round(cost / conversions) : 0
    };
  };

  // 전체 통계 계산
  const calculateTotalStats = () => {
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCost = 0;
    let totalConversions = 0;

    Object.values(monthlyData).forEach(platformData => {
      if (platformData && platformData.total) {
        totalImpressions += platformData.total.impressions || 0;
        totalClicks += platformData.total.clicks || 0;
        totalCost += platformData.total.cost || 0;
        totalConversions += platformData.total.conversions || 0;
      }
    });

    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      cost: totalCost,
      conversions: totalConversions,
      ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
      cpc: totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0,
      avgCpm: totalImpressions > 0 ? Math.round((totalCost / totalImpressions) * 1000) : 0
    };
  };

  const totalStats = calculateTotalStats();

  return (
    <div className="ad-stats">
      <div className="ad-stats-header">
        <h3>💰 광고 통계</h3>
        <button 
          onClick={() => setShowPlatformModal(true)}
          className="btn-add-platform"
        >
          + 플랫폼 추가
        </button>
      </div>

      {platforms.length === 0 ? (
        <div className="empty-state">
          <p>아직 등록된 광고 플랫폼이 없습니다.</p>
          <button 
            onClick={() => setShowPlatformModal(true)}
            className="btn-primary"
          >
            첫 플랫폼 추가하기
          </button>
        </div>
      ) : (
        <>
          {/* 플랫폼 탭 */}
          <div className="platform-tabs">
            {platforms.map((platform, index) => (
              <button
                key={platform.id}
                className={`platform-tab ${activeTab === index ? 'active' : ''}`}
                onClick={() => setActiveTab(index)}
              >
                {platform.name}
              </button>
            ))}
            <button 
              className="platform-tab add-tab"
              onClick={() => setShowPlatformModal(true)}
            >
              +
            </button>
          </div>

          {/* 전체 요약 */}
          <div className="total-summary">
            <h4>📊 전체 플랫폼 성과</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">총 노출</span>
                <span className="value">{totalStats.impressions.toLocaleString()}</span>
              </div>
              <div className="summary-item">
                <span className="label">총 클릭</span>
                <span className="value">{totalStats.clicks.toLocaleString()}</span>
              </div>
              <div className="summary-item">
                <span className="label">총 비용</span>
                <span className="value">{totalStats.cost.toLocaleString()}원</span>
              </div>
              <div className="summary-item">
                <span className="label">평균 CTR</span>
                <span className="value">{totalStats.ctr}%</span>
              </div>
              <div className="summary-item">
                <span className="label">평균 CPC</span>
                <span className="value">{totalStats.cpc.toLocaleString()}원</span>
              </div>
              <div className="summary-item">
                <span className="label">평균 CPM</span>
                <span className="value">{totalStats.avgCpm.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          {/* 선택된 플랫폼 상세 */}
          {platforms[activeTab] && (
            <div className="platform-detail">
              <div className="platform-header">
                <h4>{platforms[activeTab].name}</h4>
                <div className="platform-actions">
                  <button 
                    onClick={() => {
                      setSelectedPlatform(platforms[activeTab]);
                      setShowDataInput(true);
                    }}
                    className="btn-input-data"
                  >
                    데이터 입력
                  </button>
                  <button 
                    onClick={() => handleDeletePlatform(platforms[activeTab].id)}
                    className="btn-delete"
                    title="플랫폼 삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {monthlyData[platforms[activeTab].name] ? (
                <>
                  {/* 플랫폼 데이터 표시 */}
                  <div className="platform-data">
                    <h5>전체 성과</h5>
                    <div className="data-grid">
                      {platforms[activeTab].metrics.map(metric => (
                        <div key={metric} className="data-item">
                          <span className="label">{getMetricLabel(metric)}</span>
                          <span className="value">
                            {formatMetricValue(
                              monthlyData[platforms[activeTab].name].total?.[metric],
                              metric
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 자동 계산 지표 */}
                    <h5>💡 자동 계산 지표</h5>
                    <div className="calculated-metrics">
                      {(() => {
                        const metrics = calculateMetrics(monthlyData[platforms[activeTab].name]);
                        return (
                          <>
                            {metrics.ctr !== undefined && (
                              <div className="metric">
                                <span>CTR</span>
                                <strong>{metrics.ctr}%</strong>
                              </div>
                            )}
                            {metrics.cpc !== undefined && (
                              <div className="metric">
                                <span>CPC</span>
                                <strong>{metrics.cpc.toLocaleString()}원</strong>
                              </div>
                            )}
                            {metrics.cpm !== undefined && (
                              <div className="metric">
                                <span>CPM</span>
                                <strong>{metrics.cpm.toLocaleString()}원</strong>
                              </div>
                            )}
                            {metrics.cvr !== undefined && metrics.cvr > 0 && (
                              <div className="metric">
                                <span>CVR</span>
                                <strong>{metrics.cvr}%</strong>
                              </div>
                            )}
                            {metrics.cpa !== undefined && metrics.cpa > 0 && (
                              <div className="metric">
                                <span>CPA</span>
                                <strong>{metrics.cpa.toLocaleString()}원</strong>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* 캠페인별 데이터 */}
                    {platforms[activeTab].campaigns?.length > 0 && 
                     monthlyData[platforms[activeTab].name].campaigns && (
                      <div className="campaign-data">
                        <h5>세부 캠페인</h5>
                        {platforms[activeTab].campaigns.map(campaign => (
                          <div key={campaign} className="campaign-item">
                            <h6>{campaign}</h6>
                            <div className="campaign-metrics">
                              {platforms[activeTab].metrics.map(metric => (
                                <div key={metric} className="metric">
                                  <span>{getMetricLabel(metric)}</span>
                                  <strong>
                                    {formatMetricValue(
                                      monthlyData[platforms[activeTab].name].campaigns?.[campaign]?.[metric],
                                      metric
                                    )}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="no-data">
                  <p>이번 달 데이터가 없습니다.</p>
                  <button 
                    onClick={() => {
                      setSelectedPlatform(platforms[activeTab]);
                      setShowDataInput(true);
                    }}
                    className="btn-primary"
                  >
                    데이터 입력하기
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 시각화 섹션 */}
          <div className="visualization-section">
            <div className="viz-controls">
              <h4>📈 데이터 시각화</h4>
              <div className="controls">
                <select 
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  className="select-chart"
                >
                  <option value="bar">막대 차트</option>
                  <option value="line">선 그래프</option>
                  <option value="pie">원형 차트</option>
                  <option value="combo">복합 차트</option>
                </select>
                <select 
                  value={chartMetric}
                  onChange={(e) => setChartMetric(e.target.value)}
                  className="select-metric"
                >
                  <option value="impressions">노출수</option>
                  <option value="clicks">클릭수</option>
                  <option value="cost">비용</option>
                  <option value="ctr">CTR</option>
                  <option value="cpc">CPC</option>
                </select>
              </div>
            </div>
            <div className="chart-container">
              {/* Chart.js 차트 구현 예정 */}
              <div className="chart-placeholder">
                차트 영역 (Chart.js 구현 예정)
              </div>
            </div>
          </div>
        </>
      )}

      {/* 플랫폼 추가 모달 */}
      {showPlatformModal && (
        <AdPlatformModal
          onClose={() => setShowPlatformModal(false)}
          onSave={handleAddPlatform}
        />
      )}

      {/* 데이터 입력 모달 */}
      {showDataInput && selectedPlatform && (
        <AdDataInput
          platform={selectedPlatform}
          selectedMonth={selectedMonth}
          existingData={monthlyData[selectedPlatform.name]}
          onClose={() => setShowDataInput(false)}
          onSave={(data) => handleSaveAdData(selectedPlatform.name, data)}
        />
      )}
    </div>
  );
};

// 헬퍼 함수들
const getMetricLabel = (metric) => {
  const labels = {
    impressions: '노출수',
    clicks: '클릭수',
    cost: '비용',
    conversions: '전환수',
    reach: '도달수'
  };
  return labels[metric] || metric;
};

const formatMetricValue = (value, metric) => {
  if (value === undefined || value === null) return '-';
  
  if (metric === 'cost') {
    return `${value.toLocaleString()}원`;
  }
  return value.toLocaleString();
};

export default AdStats;
