// src/components/marketing-v2/DataInputTab.jsx
import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
// import * as XLSX from 'xlsx'; // npm install xlsx 필요
import './DataInputTab.css';

const DataInputTab = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedBusiness, setSelectedBusiness] = useState('pension');
  const [yearData, setYearData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  // 커스텀 광고 채널 상태 - 기본 채널도 포함
  const [adChannels, setAdChannels] = useState([
    { key: 'naver', label: '네이버', removable: true },
    { key: 'google', label: '구글', removable: true },
    { key: 'meta', label: 'Meta(인스타+페북)', removable: true }
  ]);
  const [newChannelName, setNewChannelName] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);

  // 월 배열
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  
  // 기본 데이터 구조 정의
  const getDataStructure = () => ({
    revenue: {
      title: '💰 매출 데이터',
      fields: [
        { key: 'total', label: '총매출(만)', type: 'number' },
        { key: 'reservations', label: '예약건수', type: 'number' }
      ]
    },
    rooms: {
      title: '🏠 객실별 매출 (만원)',
      fields: selectedBusiness === 'pension' ? [
        { key: 'forest', label: 'Forest', type: 'number' },
        { key: 'forestFamily', label: 'F.패밀리', type: 'number' },
        { key: 'forestMini', label: 'F.mini', type: 'number' },
        { key: 'forestMiniFamily', label: 'F.mini패', type: 'number' }
      ] : [
        { key: 'lakeView', label: '호수뷰', type: 'number' },
        { key: 'group', label: '단체&야유회', type: 'number' }
      ]
    },
    website: {
      title: '🌐 웹사이트 통계',
      fields: [
        { key: 'visitors', label: '방문자', type: 'number' },
        { key: 'pageViews', label: '페이지뷰', type: 'number' }
      ]
    },
    naverPlace: {
      title: '📍 네이버 플레이스',
      fields: [
        { key: 'visits', label: '플레이스', type: 'number' },
        { key: 'reservationRequests', label: '예약신청', type: 'number' },
        { key: 'reviews', label: '리뷰', type: 'number' }
      ]
    },
    naverChannels: {
      title: '📈 네이버 유입 채널',
      fields: [
        { key: 'search', label: '검색', type: 'number' },
        { key: 'map', label: '지도', type: 'number' },
        { key: 'recommend', label: '추천', type: 'number' },
        { key: 'ad', label: '광고', type: 'number' },
        { key: 'other', label: '기타', type: 'number' }
      ]
    },
    advertising: {
      title: '💰 광고비 (만원)',
      editable: true, // 항목 추가 가능
      fields: adChannels.map(channel => ({
        key: channel.key,
        label: channel.label,
        type: 'number',
        removable: channel.removable
      }))
    },
    adPerformance: {
      title: '📊 광고 성과',
      subSections: [
        {
          title: '클릭 수',
          key: 'clicks',
          fields: adChannels.map(channel => ({
            key: `${channel.key}Clicks`,
            label: channel.label,
            type: 'number',
            removable: channel.removable
          }))
        },
        {
          title: '노출 수',
          key: 'impressions',
          fields: adChannels.map(channel => ({
            key: `${channel.key}Impressions`,
            label: channel.label,
            type: 'number',
            removable: channel.removable
          }))
        }
      ]
    }
  });

  // 데이터 로드
  useEffect(() => {
    loadYearData();
  }, [selectedYear, selectedBusiness]);

  const loadYearData = async () => {
    setIsLoading(true);
    try {
      const docId = `${selectedYear}_${selectedBusiness}`;
      const docRef = doc(db, 'yearly_marketing_data', docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Loaded flat data:', data);
        
        // 평면화된 데이터를 원래 구조로 변환
        const reconstructedData = {};
        
        // 12개월 데이터 재구성
        for (let i = 0; i < 12; i++) {
          reconstructedData[i] = {
            revenue: {
              total: data[`m${i}_revenue_total`] || 0,
              reservations: data[`m${i}_revenue_reservations`] || 0
            },
            rooms: {},
            website: {
              visitors: data[`m${i}_website_visitors`] || 0,
              pageViews: data[`m${i}_website_pageViews`] || 0
            },
            naverPlace: {
              visits: data[`m${i}_naverPlace_visits`] || 0,
              reservationRequests: data[`m${i}_naverPlace_reservationRequests`] || 0,
              reviews: data[`m${i}_naverPlace_reviews`] || 0
            },
            naverChannels: {
              search: data[`m${i}_naverChannels_search`] || 0,
              map: data[`m${i}_naverChannels_map`] || 0,
              recommend: data[`m${i}_naverChannels_recommend`] || 0,
              ad: data[`m${i}_naverChannels_ad`] || 0,
              other: data[`m${i}_naverChannels_other`] || 0
            },
            advertising: {},
            adPerformance: {
              clicks: {},
              impressions: {}
            }
          };
          
          // 객실 데이터 재구성
          if (selectedBusiness === 'pension') {
            reconstructedData[i].rooms = {
              forest: data[`m${i}_rooms_forest`] || 0,
              forestFamily: data[`m${i}_rooms_forestFamily`] || 0,
              forestMini: data[`m${i}_rooms_forestMini`] || 0,
              forestMiniFamily: data[`m${i}_rooms_forestMiniFamily`] || 0
            };
          } else {
            reconstructedData[i].rooms = {
              lakeView: data[`m${i}_rooms_lakeView`] || 0,
              group: data[`m${i}_rooms_group`] || 0
            };
          }
        }
        
        // 광고 채널 재구성
        if (data.adChannels) {
          try {
            const parsedChannels = typeof data.adChannels === 'string' 
              ? JSON.parse(data.adChannels) 
              : data.adChannels;
            setAdChannels(parsedChannels);
            
            // 광고 데이터 재구성
            for (let i = 0; i < 12; i++) {
              parsedChannels.forEach(channel => {
                reconstructedData[i].advertising[channel.key] = 
                  data[`m${i}_advertising_${channel.key}`] || 0;
                reconstructedData[i].adPerformance.clicks[`${channel.key}Clicks`] = 
                  data[`m${i}_adPerf_clicks_${channel.key}`] || 0;
                reconstructedData[i].adPerformance.impressions[`${channel.key}Impressions`] = 
                  data[`m${i}_adPerf_impressions_${channel.key}`] || 0;
              });
            }
          } catch (e) {
            console.error('Error parsing channels:', e);
          }
        }
        
        setYearData(reconstructedData);
      } else {
        // 빈 데이터 구조 생성
        console.log('No existing data, creating empty structure');
        const emptyData = {};
        for (let i = 0; i < 12; i++) {
          emptyData[i] = createEmptyMonthData();
        }
        setYearData(emptyData);
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      // 오류 발생시 빈 데이터로 초기화
      const emptyData = {};
      for (let i = 0; i < 12; i++) {
        emptyData[i] = createEmptyMonthData();
      }
      setYearData(emptyData);
    } finally {
      setIsLoading(false);
    }
  };

  const createEmptyMonthData = () => {
    const data = {};
    const structure = getDataStructure();
    
    Object.keys(structure).forEach(section => {
      if (section === 'adPerformance') {
        // 광고 성과는 서브섹션이 있음
        data[section] = {};
        structure[section].subSections.forEach(sub => {
          data[section][sub.key] = {};
          sub.fields.forEach(field => {
            data[section][sub.key][field.key] = 0;
          });
        });
      } else {
        data[section] = {};
        structure[section].fields.forEach(field => {
          data[section][field.key] = 0;
        });
      }
    });
    return data;
  };

  // 데이터 저장
  const saveYearData = async () => {
    setIsSaving(true);
    try {
      const docId = `${selectedYear}_${selectedBusiness}`;
      const docRef = doc(db, 'yearly_marketing_data', docId);
      
      // 데이터를 평면화하여 저장
      const flatData = {
        year: selectedYear,
        business: selectedBusiness,
        adChannels: JSON.stringify(adChannels), // JSON 문자열로 저장
        updatedAt: new Date().toISOString()
      };
      
      // 월별 데이터를 평면화
      for (let i = 0; i < 12; i++) {
        const monthData = yearData[i] || createEmptyMonthData();
        
        // 각 섹션의 데이터를 평면화
        // Revenue
        flatData[`m${i}_revenue_total`] = Number(monthData.revenue?.total) || 0;
        flatData[`m${i}_revenue_reservations`] = Number(monthData.revenue?.reservations) || 0;
        
        // Rooms
        if (selectedBusiness === 'pension') {
          flatData[`m${i}_rooms_forest`] = Number(monthData.rooms?.forest) || 0;
          flatData[`m${i}_rooms_forestFamily`] = Number(monthData.rooms?.forestFamily) || 0;
          flatData[`m${i}_rooms_forestMini`] = Number(monthData.rooms?.forestMini) || 0;
          flatData[`m${i}_rooms_forestMiniFamily`] = Number(monthData.rooms?.forestMiniFamily) || 0;
        } else {
          flatData[`m${i}_rooms_lakeView`] = Number(monthData.rooms?.lakeView) || 0;
          flatData[`m${i}_rooms_group`] = Number(monthData.rooms?.group) || 0;
        }
        
        // Website
        flatData[`m${i}_website_visitors`] = Number(monthData.website?.visitors) || 0;
        flatData[`m${i}_website_pageViews`] = Number(monthData.website?.pageViews) || 0;
        
        // Naver Place
        flatData[`m${i}_naverPlace_visits`] = Number(monthData.naverPlace?.visits) || 0;
        flatData[`m${i}_naverPlace_reservationRequests`] = Number(monthData.naverPlace?.reservationRequests) || 0;
        flatData[`m${i}_naverPlace_reviews`] = Number(monthData.naverPlace?.reviews) || 0;
        
        // Naver Channels
        flatData[`m${i}_naverChannels_search`] = Number(monthData.naverChannels?.search) || 0;
        flatData[`m${i}_naverChannels_map`] = Number(monthData.naverChannels?.map) || 0;
        flatData[`m${i}_naverChannels_recommend`] = Number(monthData.naverChannels?.recommend) || 0;
        flatData[`m${i}_naverChannels_ad`] = Number(monthData.naverChannels?.ad) || 0;
        flatData[`m${i}_naverChannels_other`] = Number(monthData.naverChannels?.other) || 0;
        
        // Advertising
        adChannels.forEach(channel => {
          flatData[`m${i}_advertising_${channel.key}`] = 
            Number(monthData.advertising?.[channel.key]) || 0;
          flatData[`m${i}_adPerf_clicks_${channel.key}`] = 
            Number(monthData.adPerformance?.clicks?.[`${channel.key}Clicks`]) || 0;
          flatData[`m${i}_adPerf_impressions_${channel.key}`] = 
            Number(monthData.adPerformance?.impressions?.[`${channel.key}Impressions`]) || 0;
        });
      }
      
      console.log('Saving flat data:', Object.keys(flatData).length, 'fields');
      
      await setDoc(docRef, flatData);
      
      alert('저장되었습니다.');
    } catch (error) {
      console.error('저장 오류 상세:', error);
      alert('저장에 실패했습니다: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 연간 합계 계산 - 삭제 (더 이상 사용하지 않음)

  // 셀 값 변경 핸들러
  const handleCellChange = (monthIndex, section, field, value, subKey = null) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, '') || 0);
    
    setYearData(prev => {
      const newData = { ...prev };
      if (!newData[monthIndex]) {
        newData[monthIndex] = createEmptyMonthData();
      }
      
      if (subKey) {
        // 서브섹션이 있는 경우 (광고 성과)
        if (!newData[monthIndex][section]) {
          newData[monthIndex][section] = {};
        }
        if (!newData[monthIndex][section][subKey]) {
          newData[monthIndex][section][subKey] = {};
        }
        newData[monthIndex][section][subKey][field] = numValue;
      } else {
        // 일반 섹션
        if (!newData[monthIndex][section]) {
          newData[monthIndex][section] = {};
        }
        newData[monthIndex][section][field] = numValue;
      }
      
      return newData;
    });
  };

  // 행 합계 계산
  const calculateRowTotal = (section, field, subKey = null) => {
    return Object.values(yearData).reduce((sum, monthData) => {
      if (!monthData) return sum;
      if (subKey) {
        return sum + (monthData[section]?.[subKey]?.[field] || 0);
      }
      return sum + (monthData[section]?.[field] || 0);
    }, 0);
  };

  // 채널 추가
  const addChannel = () => {
    if (!newChannelName.trim()) {
      alert('채널 이름을 입력해주세요.');
      return;
    }
    
    const key = newChannelName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // 중복 체크
    if (adChannels.some(ch => ch.key === key)) {
      alert('이미 존재하는 채널입니다.');
      return;
    }
    
    const newChannel = {
      key: key,
      label: newChannelName,
      removable: true
    };
    
    setAdChannels([...adChannels, newChannel]);
    setNewChannelName('');
    setShowAddChannel(false);
    
    // 기존 데이터에 새 필드 추가
    const newYearData = { ...yearData };
    Object.keys(newYearData).forEach(monthIdx => {
      if (!newYearData[monthIdx]) {
        newYearData[monthIdx] = createEmptyMonthData();
      }
      if (!newYearData[monthIdx].advertising) {
        newYearData[monthIdx].advertising = {};
      }
      newYearData[monthIdx].advertising[key] = 0;
      
      if (!newYearData[monthIdx].adPerformance) {
        newYearData[monthIdx].adPerformance = { clicks: {}, impressions: {} };
      }
      if (!newYearData[monthIdx].adPerformance.clicks) {
        newYearData[monthIdx].adPerformance.clicks = {};
      }
      if (!newYearData[monthIdx].adPerformance.impressions) {
        newYearData[monthIdx].adPerformance.impressions = {};
      }
      newYearData[monthIdx].adPerformance.clicks[`${key}Clicks`] = 0;
      newYearData[monthIdx].adPerformance.impressions[`${key}Impressions`] = 0;
    });
    setYearData(newYearData);
  };

  // 채널 삭제
  const removeChannel = (channelKey) => {
    const channel = adChannels.find(ch => ch.key === channelKey);
    if (!channel) return;
    
    if (!confirm(`'${channel.label}' 채널을 삭제하시겠습니까? 데이터도 함께 삭제됩니다.`)) return;
    
    setAdChannels(adChannels.filter(ch => ch.key !== channelKey));
    
    // 데이터에서도 제거
    const newYearData = { ...yearData };
    Object.keys(newYearData).forEach(monthIdx => {
      if (newYearData[monthIdx]?.advertising) {
        delete newYearData[monthIdx].advertising[channelKey];
      }
      if (newYearData[monthIdx]?.adPerformance?.clicks) {
        delete newYearData[monthIdx].adPerformance.clicks[`${channelKey}Clicks`];
      }
      if (newYearData[monthIdx]?.adPerformance?.impressions) {
        delete newYearData[monthIdx].adPerformance.impressions[`${channelKey}Impressions`];
      }
    });
    setYearData(newYearData);
  };

  // CSV 내보내기
  const handleExcelExport = () => {
    const structure = getDataStructure();
    let csvContent = '';
    
    // BOM 추가 for UTF-8
    csvContent = '\uFEFF';
    
    // 헤더 추가
    csvContent += '항목,' + months.join(',') + ',합계\n';
    
    // 데이터 추가
    Object.keys(structure).forEach(section => {
      csvContent += structure[section].title + '\n';
      
      if (section === 'adPerformance') {
        // 광고 성과는 서브섹션 처리
        structure[section].subSections.forEach(sub => {
          csvContent += sub.title + '\n';
          sub.fields.forEach(field => {
            const row = [field.label];
            months.forEach((_, idx) => {
              row.push(yearData[idx]?.[section]?.[sub.key]?.[field.key] || 0);
            });
            row.push(calculateRowTotal(section, field.key, sub.key));
            csvContent += row.join(',') + '\n';
          });
        });
      } else {
        structure[section].fields.forEach(field => {
          const row = [field.label];
          months.forEach((_, idx) => {
            row.push(yearData[idx]?.[section]?.[field.key] || 0);
          });
          row.push(calculateRowTotal(section, field.key));
          csvContent += row.join(',') + '\n';
        });
      }
      
      csvContent += '\n'; // 빈 줄
    });
    
    // CSV 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `marketing_data_${selectedYear}_${selectedBusiness}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 이전년도 복사
  const handleCopyPreviousYear = async () => {
    if (!confirm(`${selectedYear - 1}년 데이터를 복사하시겠습니까?`)) return;
    
    try {
      const prevDocId = `${selectedYear - 1}_${selectedBusiness}`;
      const prevDocRef = doc(db, 'yearly_marketing_data', prevDocId);
      const prevDocSnap = await getDoc(prevDocRef);
      
      if (prevDocSnap.exists()) {
        const prevData = prevDocSnap.data();
        setYearData(prevData.monthlyData || {});
        if (prevData.adChannels) {
          setAdChannels(prevData.adChannels);
        }
        alert('이전년도 데이터를 불러왔습니다.');
      } else {
        alert('이전년도 데이터가 없습니다.');
      }
    } catch (error) {
      console.error('복사 오류:', error);
      alert('데이터 복사에 실패했습니다.');
    }
  };

  if (isLoading) {
    return <div className="loading">데이터를 불러오는 중...</div>;
  }

  const dataStructure = getDataStructure();

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
            {[2025, 2024, 2023, 2022, 2021].map(year => (
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
          <button onClick={saveYearData} disabled={isSaving} className="btn-save">
            {isSaving ? '저장 중...' : '저장'}
          </button>
          
          <button onClick={handleExcelExport} className="btn-export">
            CSV 내보내기
          </button>
          
          <button onClick={handleCopyPreviousYear} className="btn-copy">
            이전년도 복사
          </button>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="data-table-container">
        <table className="data-input-table">
          <thead>
            <tr>
              <th className="section-header" colSpan={14}>
                📊 {selectedYear}년 {selectedBusiness === 'pension' ? '초호펜션' : '초호쉼터'} 월간 데이터 입력
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
            {Object.keys(dataStructure).map(section => (
              <React.Fragment key={section}>
                <tr className="section-divider">
                  <td colSpan={14} className="section-title">
                    {dataStructure[section].title}
                    {dataStructure[section].editable && (
                      <button 
                        className="btn-add-item"
                        onClick={() => setShowAddChannel(true)}
                      >
                        + 항목 추가
                      </button>
                    )}
                  </td>
                </tr>
                
                {/* 광고 성과 섹션 (서브섹션 있음) */}
                {section === 'adPerformance' ? (
                  dataStructure[section].subSections.map(sub => (
                    <React.Fragment key={sub.key}>
                      <tr className="subsection-divider">
                        <td colSpan={14} className="subsection-title">{sub.title}</td>
                      </tr>
                      {sub.fields.map(field => (
                        <tr key={`${section}-${sub.key}-${field.key}`}>
                          <td className="item-label">
                            {field.label}
                            {field.removable && (
                              <button 
                                className="btn-remove-item"
                                onClick={() => removeChannel(field.key.replace(/(Clicks|Impressions)$/, ''))}
                                title="삭제"
                              >
                                ×
                              </button>
                            )}
                          </td>
                          {months.map((_, idx) => (
                            <td key={idx} className="data-cell">
                              <input
                                type="text"
                                value={yearData[idx]?.[section]?.[sub.key]?.[field.key] || ''}
                                onChange={(e) => handleCellChange(idx, section, field.key, e.target.value, sub.key)}
                                className="cell-input"
                              />
                            </td>
                          ))}
                          <td className="total-cell">
                            {calculateRowTotal(section, field.key, sub.key).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  // 일반 섹션
                  dataStructure[section].fields.map(field => (
                    <tr key={`${section}-${field.key}`}>
                      <td className="item-label">
                        {field.label}
                        {field.removable && section === 'advertising' && (
                          <button 
                            className="btn-remove-item"
                            onClick={() => removeChannel(field.key)}
                            title="삭제"
                          >
                            ×
                          </button>
                        )}
                      </td>
                      {months.map((_, idx) => (
                        <td key={idx} className="data-cell">
                          <input
                            type="text"
                            value={yearData[idx]?.[section]?.[field.key] || ''}
                            onChange={(e) => handleCellChange(idx, section, field.key, e.target.value)}
                            className="cell-input"
                          />
                        </td>
                      ))}
                      <td className="total-cell">
                        {calculateRowTotal(section, field.key).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 채널 추가 모달 */}
      {showAddChannel && (
        <div className="modal-overlay" onClick={() => setShowAddChannel(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>광고 채널 추가</h3>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="채널 이름 (예: 유튜브, 블로그)"
              className="channel-input"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && addChannel()}
            />
            <div className="modal-actions">
              <button onClick={addChannel} className="btn-confirm">추가</button>
              <button onClick={() => {
                setShowAddChannel(false);
                setNewChannelName('');
              }} className="btn-cancel">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataInputTab;