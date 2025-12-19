// src/components/marketing-v2/DataInputTabSimple.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import './DataInputTab.css';

const DataInputTabSimple = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedBusiness, setSelectedBusiness] = useState('pension');
  const [yearData, setYearData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // 데이터 로드
  useEffect(() => {
    loadYearData();
  }, [selectedYear, selectedBusiness]);

  const loadYearData = async () => {
    setIsLoading(true);
    try {
      // 각 월별로 별도 문서로 저장/로드
      const loadedData = {};
      
      for (let month = 0; month < 12; month++) {
        const docId = `${selectedYear}${String(month).padStart(2, '0')}${selectedBusiness}`;
        const docRef = doc(db, 'marketing', docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          loadedData[month] = docSnap.data();
        } else {
          loadedData[month] = {
            revenue: 0,
            reservations: 0,
            visitors: 0,
            naverAd: 0,
            googleAd: 0,
            metaAd: 0
          };
        }
      }
      
      setYearData(loadedData);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      // 빈 데이터로 초기화
      const emptyData = {};
      for (let i = 0; i < 12; i++) {
        emptyData[i] = {
          revenue: 0,
          reservations: 0,
          visitors: 0,
          naverAd: 0,
          googleAd: 0,
          metaAd: 0
        };
      }
      setYearData(emptyData);
    } finally {
      setIsLoading(false);
    }
  };

  // 개별 월 저장
  const saveMonthData = async (monthIndex) => {
    try {
      const docId = `${selectedYear}${String(monthIndex).padStart(2, '0')}${selectedBusiness}`;
      const docRef = doc(db, 'marketing', docId);
      
      const monthData = yearData[monthIndex] || {};
      const dataToSave = {
        revenue: Number(monthData.revenue) || 0,
        reservations: Number(monthData.reservations) || 0,
        visitors: Number(monthData.visitors) || 0,
        naverAd: Number(monthData.naverAd) || 0,
        googleAd: Number(monthData.googleAd) || 0,
        metaAd: Number(monthData.metaAd) || 0,
        year: selectedYear,
        month: monthIndex,
        business: selectedBusiness,
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(docRef, dataToSave);
      return true;
    } catch (error) {
      console.error(`${monthIndex}월 저장 오류:`, error);
      return false;
    }
  };

  // 전체 저장
  const saveAllData = async () => {
    setIsSaving(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      // 각 월별로 개별 저장
      for (let month = 0; month < 12; month++) {
        const success = await saveMonthData(month);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      if (failCount === 0) {
        alert('모든 데이터가 저장되었습니다.');
      } else {
        alert(`${successCount}개월 저장 성공, ${failCount}개월 저장 실패`);
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 값 변경 핸들러
  const handleChange = (monthIndex, field, value) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, '') || 0);
    setYearData(prev => ({
      ...prev,
      [monthIndex]: {
        ...prev[monthIndex],
        [field]: numValue
      }
    }));
  };

  // 행 합계 계산
  const calculateTotal = (field) => {
    return Object.values(yearData).reduce((sum, month) => {
      return sum + (month?.[field] || 0);
    }, 0);
  };

  if (isLoading) {
    return <div className="loading">데이터를 불러오는 중...</div>;
  }

  return (
    <div className="data-input-tab">
      {/* 컨트롤 바 */}
      <div className="control-bar">
        <div className="selectors">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="year-selector"
          >
            {[2025, 2024, 2023].map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          
          <select 
            value={selectedBusiness} 
            onChange={(e) => setSelectedBusiness(e.target.value)}
            className="business-selector"
          >
            <option value="pension">초호펜션</option>
            <option value="shelter">초호쉼터</option>
          </select>
        </div>
        
        <div className="actions">
          <button onClick={saveAllData} disabled={isSaving} className="btn-save">
            {isSaving ? '저장 중...' : '전체 저장'}
          </button>
        </div>
      </div>

      {/* 간단한 데이터 테이블 */}
      <div className="data-table-container">
        <table className="data-input-table">
          <thead>
            <tr>
              <th className="section-header" colSpan={14}>
                📊 {selectedYear}년 {selectedBusiness === 'pension' ? '초호펜션' : '초호쉼터'} 핵심 데이터
              </th>
            </tr>
            <tr>
              <th className="item-header">항목</th>
              {months.map(month => (
                <th key={month} className="month-header">{month}</th>
              ))}
              <th className="total-header">합계</th>
            </tr>
          </thead>
          <tbody>
            {/* 매출 */}
            <tr>
              <td className="item-label">매출(만원)</td>
              {months.map((_, idx) => (
                <td key={idx} className="data-cell">
                  <input
                    type="text"
                    value={yearData[idx]?.revenue || ''}
                    onChange={(e) => handleChange(idx, 'revenue', e.target.value)}
                    className="cell-input"
                  />
                </td>
              ))}
              <td className="total-cell">
                {calculateTotal('revenue').toLocaleString()}
              </td>
            </tr>
            
            {/* 예약건수 */}
            <tr>
              <td className="item-label">예약건수</td>
              {months.map((_, idx) => (
                <td key={idx} className="data-cell">
                  <input
                    type="text"
                    value={yearData[idx]?.reservations || ''}
                    onChange={(e) => handleChange(idx, 'reservations', e.target.value)}
                    className="cell-input"
                  />
                </td>
              ))}
              <td className="total-cell">
                {calculateTotal('reservations').toLocaleString()}
              </td>
            </tr>
            
            {/* 방문자 */}
            <tr>
              <td className="item-label">웹사이트 방문자</td>
              {months.map((_, idx) => (
                <td key={idx} className="data-cell">
                  <input
                    type="text"
                    value={yearData[idx]?.visitors || ''}
                    onChange={(e) => handleChange(idx, 'visitors', e.target.value)}
                    className="cell-input"
                  />
                </td>
              ))}
              <td className="total-cell">
                {calculateTotal('visitors').toLocaleString()}
              </td>
            </tr>
            
            {/* 구분선 */}
            <tr className="section-divider">
              <td colSpan={14} className="section-title">💰 광고비 (만원)</td>
            </tr>
            
            {/* 네이버 광고 */}
            <tr>
              <td className="item-label">네이버</td>
              {months.map((_, idx) => (
                <td key={idx} className="data-cell">
                  <input
                    type="text"
                    value={yearData[idx]?.naverAd || ''}
                    onChange={(e) => handleChange(idx, 'naverAd', e.target.value)}
                    className="cell-input"
                  />
                </td>
              ))}
              <td className="total-cell">
                {calculateTotal('naverAd').toLocaleString()}
              </td>
            </tr>
            
            {/* 구글 광고 */}
            <tr>
              <td className="item-label">구글</td>
              {months.map((_, idx) => (
                <td key={idx} className="data-cell">
                  <input
                    type="text"
                    value={yearData[idx]?.googleAd || ''}
                    onChange={(e) => handleChange(idx, 'googleAd', e.target.value)}
                    className="cell-input"
                  />
                </td>
              ))}
              <td className="total-cell">
                {calculateTotal('googleAd').toLocaleString()}
              </td>
            </tr>
            
            {/* Meta 광고 */}
            <tr>
              <td className="item-label">Meta(인스타+페북)</td>
              {months.map((_, idx) => (
                <td key={idx} className="data-cell">
                  <input
                    type="text"
                    value={yearData[idx]?.metaAd || ''}
                    onChange={(e) => handleChange(idx, 'metaAd', e.target.value)}
                    className="cell-input"
                  />
                </td>
              ))}
              <td className="total-cell">
                {calculateTotal('metaAd').toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* 월별 저장 버튼 */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p style={{ color: '#666', fontSize: '14px' }}>
          💡 각 월별로 개별 저장되므로 안정적입니다.
        </p>
      </div>
    </div>
  );
};

export default DataInputTabSimple;