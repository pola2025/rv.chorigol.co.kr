// src/components/marketing-v2/MarketingStatsV2.jsx
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc,
  getDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import MonthlyStats from './MonthlyStats';
import RevenueTab from './RevenueTab';
import VisitorsTab from './VisitorsTab';
import AdvertisingTab from './AdvertisingTab';
import GoalsTab from './GoalsTab';
import StatusTab from './StatusTab';
import IntegratedStats from './IntegratedStats';
import DataInputTabTemp from './DataInputTabTemp'; // 임시 버전 (업그레이드 중)
import './MarketingStatsV2.css';

const MarketingStatsV2 = () => {
  // 상태 관리
  const [activeTab, setActiveTab] = useState('dataInput'); // dataInput, integrated, revenue, visitors, advertising, goals, status
  const [businessType, setBusinessType] = useState('pension'); // pension, shelter
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 월별 데이터
  const [monthlyData, setMonthlyData] = useState({});
  const [currentMonthData, setCurrentMonthData] = useState(null);
  
  // 전전월, 전월 데이터 (상단 표시용)
  const [previousMonthsData, setPreviousMonthsData] = useState({
    twoMonthsAgo: null,
    lastMonth: null
  });

  // Firebase에서 데이터 로드
  useEffect(() => {
    loadMonthlyData();
  }, [selectedMonth, businessType]);

  // 전전월, 전월 데이터 로드
  useEffect(() => {
    loadPreviousMonthsData();
  }, []);

  const loadMonthlyData = async () => {
    try {
      const docId = `${businessType}_${selectedMonth}`;
      const docRef = doc(db, 'marketing_stats_v2', docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentMonthData(data);
        setMonthlyData(prev => ({
          ...prev,
          [docId]: data
        }));
      } else {
        // 기본 데이터 구조 생성
        const defaultData = createDefaultMonthData();
        setCurrentMonthData(defaultData);
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      const defaultData = createDefaultMonthData();
      setCurrentMonthData(defaultData);
    }
  };

  const loadPreviousMonthsData = async () => {
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const formatMonth = (date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };
    
    try {
      // 전전월 데이터
      const twoMonthsAgoData = await loadMonthDataForSummary(formatMonth(twoMonthsAgo));
      // 전월 데이터
      const lastMonthData = await loadMonthDataForSummary(formatMonth(lastMonth));
      
      setPreviousMonthsData({
        twoMonthsAgo: twoMonthsAgoData,
        lastMonth: lastMonthData
      });
    } catch (error) {
      console.error('이전 월 데이터 로드 오류:', error);
    }
  };

  const loadMonthDataForSummary = async (month) => {
    const summaryData = {
      month: month,
      pension: null,
      shelter: null
    };
    
    try {
      // 펜션 데이터
      const pensionDocRef = doc(db, 'marketing_stats_v2', `pension_${month}`);
      const pensionDoc = await getDoc(pensionDocRef);
      if (pensionDoc.exists()) {
        summaryData.pension = pensionDoc.data();
      }
      
      // 쉼터 데이터
      const shelterDocRef = doc(db, 'marketing_stats_v2', `shelter_${month}`);
      const shelterDoc = await getDoc(shelterDocRef);
      if (shelterDoc.exists()) {
        summaryData.shelter = shelterDoc.data();
      }
    } catch (error) {
      console.error(`${month} 데이터 로드 오류:`, error);
    }
    
    return summaryData;
  };

  const createDefaultMonthData = () => {
    return {
      businessType: businessType,
      month: selectedMonth,
      revenue: {
        total: 0,
        reservationCount: 0,
        byRoom: {
          forest: 0,
          forestFamily: 0,
          forestMini: 0,
          forestMiniFamily: 0,
          lakeView: 0,
          group: 0
        }
      },
      visitors: {
        website: {
          visitors: 0,
          pageViews: 0
        },
        naverPlace: {
          placeVisits: 0,
          reservationRequests: 0,
          reviews: 0,
          channels: [
            { name: "검색", count: 0 },
            { name: "지도", count: 0 },
            { name: "추천", count: 0 },
            { name: "광고", count: 0 },
            { name: "기타", count: 0 }
          ]
        }
      },
      advertising: {
        channels: []
      },
      goals: {
        memo: ""
      },
      status: {
        memo: ""
      }
    };
  };

  // 데이터 저장 - 단순화된 버전
  const saveMonthlyData = async () => {
    if (!currentMonthData) {
      alert('저장할 데이터가 없습니다.');
      return;
    }
    
    setIsSaving(true);
    try {
      const docId = `${businessType}_${selectedMonth}`;
      const docRef = doc(db, 'marketing_stats_v2', docId);
      
      // 단순한 데이터 구조로 저장
      const dataToSave = {
        businessType: businessType || 'pension',
        month: selectedMonth || '2025-01',
        revenue: {
          total: Number(currentMonthData.revenue?.total) || 0,
          reservationCount: Number(currentMonthData.revenue?.reservationCount) || 0,
          byRoom: {
            forest: Number(currentMonthData.revenue?.byRoom?.forest) || 0,
            forestFamily: Number(currentMonthData.revenue?.byRoom?.forestFamily) || 0,
            forestMini: Number(currentMonthData.revenue?.byRoom?.forestMini) || 0,
            forestMiniFamily: Number(currentMonthData.revenue?.byRoom?.forestMiniFamily) || 0,
            lakeView: Number(currentMonthData.revenue?.byRoom?.lakeView) || 0,
            group: Number(currentMonthData.revenue?.byRoom?.group) || 0
          }
        },
        visitors: {
          website: {
            visitors: Number(currentMonthData.visitors?.website?.visitors) || 0,
            pageViews: Number(currentMonthData.visitors?.website?.pageViews) || 0
          },
          naverPlace: {
            placeVisits: Number(currentMonthData.visitors?.naverPlace?.placeVisits) || 0,
            reservationRequests: Number(currentMonthData.visitors?.naverPlace?.reservationRequests) || 0,
            reviews: Number(currentMonthData.visitors?.naverPlace?.reviews) || 0,
            channels: (currentMonthData.visitors?.naverPlace?.channels || []).map(ch => ({
              name: String(ch.name || ''),
              count: Number(ch.count) || 0
            }))
          }
        },
        advertising: {
          channels: (currentMonthData.advertising?.channels || []).map(ch => ({
            name: String(ch.name || ''),
            clicks: Number(ch.clicks) || 0,
            impressions: Number(ch.impressions) || 0,
            cost: Number(ch.cost) || 0
          }))
        },
        goals: {
          memo: String(currentMonthData.goals?.memo || '')
        },
        status: {
          memo: String(currentMonthData.status?.memo || '')
        },
        updatedAt: new Date().toISOString()
      };
      
      console.log('Saving simplified data:', JSON.stringify(dataToSave, null, 2));
      
      // 새로운 문서로 완전히 덮어쓰기
      await setDoc(docRef, dataToSave);
      
      console.log('Data saved successfully');
      
      // 저장 후 데이터 다시 로드
      await loadMonthlyData();
      await loadPreviousMonthsData();
      
      alert('저장되었습니다.');
      setIsEditMode(false);
    } catch (error) {
      console.error('저장 오류 상세:', error);
      alert(`저장 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 데이터 업데이트 핸들러
  const updateData = (path, value) => {
    if (!isEditMode) return;
    
    setCurrentMonthData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  // 월 변경 핸들러
  const handleMonthChange = (direction) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = month;
    
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
    
    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const getMonthDisplay = () => {
    const [year, month] = selectedMonth.split('-');
    return `${year}년 ${parseInt(month)}월`;
  };

  return (
    <div className="marketing-stats-v2">
      {/* 상단 통계 요약 */}
      <MonthlyStats previousData={previousMonthsData} />
      
      {/* 헤더 */}
      <div className="stats-header">
        <h2>마케팅 통계</h2>
      </div>
      
      {/* 탭 메뉴 */}
      <div className="stats-tabs">
        <button 
          className={`tab ${activeTab === 'dataInput' ? 'active' : ''}`}
          onClick={() => setActiveTab('dataInput')}
        >
          데이터 입력
        </button>
        <button 
          className={`tab ${activeTab === 'integrated' ? 'active' : ''}`}
          onClick={() => setActiveTab('integrated')}
        >
          통합 통계
        </button>
        <button 
          className={`tab ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
        >
          매출 통계
        </button>
        <button 
          className={`tab ${activeTab === 'visitors' ? 'active' : ''}`}
          onClick={() => setActiveTab('visitors')}
        >
          방문 통계
        </button>
        <button 
          className={`tab ${activeTab === 'advertising' ? 'active' : ''}`}
          onClick={() => setActiveTab('advertising')}
        >
          광고 통계
        </button>
        <button 
          className={`tab ${activeTab === 'goals' ? 'active' : ''}`}
          onClick={() => setActiveTab('goals')}
        >
          마케팅 목표
        </button>
        <button 
          className={`tab ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          마케팅 현황
        </button>
      </div>
      
      {/* 사업장 선택 - 통합 통계가 아닐 때만 표시 */}
      {activeTab !== 'integrated' && (
        <div className="business-tabs">
          <button 
            className={`business-tab ${businessType === 'pension' ? 'active' : ''}`}
            onClick={() => setBusinessType('pension')}
          >
            초호펜션
          </button>
          <button 
            className={`business-tab ${businessType === 'shelter' ? 'active' : ''}`}
            onClick={() => setBusinessType('shelter')}
          >
            초호쉼터
          </button>
        </div>
      )}
      
      {/* 월 선택 및 편집 모드 */}
      <div className="controls-bar">
        <div className="month-selector">
          <button onClick={() => handleMonthChange('prev')} className="month-nav">◀</button>
          <span className="current-month">{getMonthDisplay()}</span>
          <button onClick={() => handleMonthChange('next')} className="month-nav">▶</button>
        </div>
        
        <div className="edit-controls">
          {activeTab !== 'integrated' && !isEditMode ? (
            <button onClick={() => setIsEditMode(true)} className="btn-edit">
              수정 모드
            </button>
          ) : activeTab !== 'integrated' && (
            <>
              <button 
                onClick={saveMonthlyData} 
                className="btn-save"
                disabled={isSaving}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
              <button 
                onClick={() => {
                  setIsEditMode(false);
                  loadMonthlyData(); // 변경사항 취소
                }} 
                className="btn-cancel"
                disabled={isSaving}
              >
                취소
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* 탭 컨텐츠 */}
      <div className="tab-content">
        {activeTab === 'dataInput' && (
          <DataInputTabTemp /> // 임시 화면 (업그레이드 중)
        )}
        {activeTab === 'integrated' && (
          <IntegratedStats selectedMonth={selectedMonth} />
        )}
        {activeTab === 'revenue' && (
          <RevenueTab 
            data={currentMonthData?.revenue || {}}
            businessType={businessType}
            isEditMode={isEditMode}
            updateData={updateData}
          />
        )}
        {activeTab === 'visitors' && (
          <VisitorsTab 
            data={currentMonthData?.visitors || {}}
            isEditMode={isEditMode}
            updateData={updateData}
          />
        )}
        {activeTab === 'advertising' && (
          <AdvertisingTab 
            data={currentMonthData?.advertising || {}}
            isEditMode={isEditMode}
            updateData={updateData}
            currentMonth={selectedMonth}
          />
        )}
        {activeTab === 'goals' && (
          <GoalsTab 
            data={currentMonthData?.goals || {}}
            isEditMode={isEditMode}
            updateData={updateData}
          />
        )}
        {activeTab === 'status' && (
          <StatusTab 
            data={currentMonthData?.status || {}}
            isEditMode={isEditMode}
            updateData={updateData}
          />
        )}
      </div>
      
      {/* 광고 효율 분석 (광고 탭일 때만 표시) */}
      {activeTab === 'advertising' && currentMonthData?.advertising && (
        <div className="ad-efficiency-analysis">
          <h3>광고 투자 효율 분석</h3>
          <div className="efficiency-metrics">
            <div className="metric">
              <span className="label">총 광고비</span>
              <span className="value">
                {currentMonthData.advertising.channels?.reduce((sum, ch) => sum + (ch.cost || 0), 0).toLocaleString()}원
              </span>
            </div>
            <div className="metric">
              <span className="label">총 매출</span>
              <span className="value">
                {(currentMonthData.revenue?.total || 0).toLocaleString()}원
              </span>
            </div>
            <div className="metric">
              <span className="label">ROAS</span>
              <span className="value">
                {currentMonthData.advertising.channels?.reduce((sum, ch) => sum + (ch.cost || 0), 0) > 0
                  ? Math.round((currentMonthData.revenue?.total || 0) / currentMonthData.advertising.channels.reduce((sum, ch) => sum + (ch.cost || 0), 0) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingStatsV2;