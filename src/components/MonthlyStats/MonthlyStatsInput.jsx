// src/components/MonthlyStats/MonthlyStatsInput.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatCurrency, formatNumber, formatPercentage, calculateConversionRate, calculateROI } from '../../utils';
import './MonthlyStatsInput.css';
import AirtableTest from './AirtableTest';

const MonthlyStatsInput = () => {
  // 컴포넌트 마운트 시 바로 실행
  React.useEffect(() => {
    console.error('MonthlyStatsInput 마운트됨!!!');
    console.warn('경고 테스트');
    console.info('정보 테스트');
    console.log('일반 로그 테스트');
  }, []);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoRevenue, setAutoRevenue] = useState(0);
  const [autoReservations, setAutoReservations] = useState(0);
  const [businessType, setBusinessType] = useState('pension'); // 'pension' or 'shelter'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  // 수동 입력 데이터
  const [formData, setFormData] = useState({
    // 방문자 통계
    websiteVisitors: 0,
    websitePageviews: 0,
    naverPlaceVisits: 0,
    
    // 마케팅 데이터
    adCost: {
      naver: 0,
      google: 0,
      meta: 0,
      kakao: 0,
      other: 0
    },
    
    // 네이버 광고 전체통계 (초호+초호쉼터)
    naverAdCostTotal: 0,
    
    // 메타 광고비 달러 (표시용)
    metaAdCostUSD: 0,
    
    // 광고 성과
    clicks: {
      naver: 0,
      google: 0,
      meta: 0,
      kakao: 0,
      other: 0
    },
    
    impressions: {
      naver: 0,
      google: 0,
      meta: 0,
      kakao: 0,
      other: 0
    },
    
    // 기타 지표
    reviews: 0
  });

  const monthName = `${selectedYear}년 ${selectedMonth}월`;
  const isAutoRevenueMonth = selectedMonth >= 8; // 8월 이후는 자동집계
  const businessName = businessType === 'pension' ? '초호펜션' : '초호쉼터';

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, businessType]);

  const loadData = async () => {
    console.log('=== loadData 시작 ===', businessType, selectedYear, selectedMonth);
    setLoading(true);
    
    try {
      // 펜션별 월별 통계 데이터 로드
      const collectionName = businessType === 'pension' ? 'monthly_stats_pension' : 'monthly_stats_shelter';
      const docId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      console.log('Firebase 조회:', collectionName, '/', docId);
      
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      console.log('문서 존재 여부:', docSnap.exists());
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Firebase 데이터 발견:', data);
        
        setFormData({
          websiteVisitors: data.websiteVisitors || 0,
          websitePageviews: data.websitePageviews || 0,
          naverPlaceVisits: data.naverPlaceVisits || 0,
          adCost: data.adCost || {
            naver: 0, google: 0, meta: 0, kakao: 0, other: 0
          },
          naverAdCostTotal: data.naverAdCostTotal || 0,
          metaAdCostUSD: data.metaAdCostUSD || 0,
          clicks: data.clicks || {
            naver: 0, google: 0, meta: 0, kakao: 0, other: 0
          },
          impressions: data.impressions || {
            naver: 0, google: 0, meta: 0, kakao: 0, other: 0
          },
          reviews: data.reviews || 0
        });
      } else {
        console.log('Firebase 문서 없음');
      }

      // 자동 매출 집계 (8월 이후)
      if (isAutoRevenueMonth) {
        console.log('자동 매출 집계 시작');
        await loadAutoRevenue();
      }

    } catch (error) {
      console.error('loadData 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAutoRevenue = async () => {
    try {
      console.log('=== loadAutoRevenue 시작 ===');
      
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
      
      console.log('조회 기간:', startDate, '~', endDate);
      
      // Firestore에서 예약 데이터 조회 (businessType 필드 없이 모든 예약 조회)
      const reservationsRef = collection(db, 'reservations');
      const q = query(
        reservationsRef,
        where('checkInDate', '>=', startDate),
        where('checkInDate', '<=', endDate),
        where('status', '==', 'confirmed')
      );
      
      console.log('예약 쿼리 실행 중...');
      const querySnapshot = await getDocs(q);
      console.log('전체 예약 수:', querySnapshot.size);
      
      if (querySnapshot.size === 0) {
        console.log('예약 데이터가 없습니다.');
      }
      
      let totalRevenue = 0;
      let totalReservations = 0;
      
      querySnapshot.forEach((doc) => {
        const reservation = doc.data();
        const roomType = reservation.roomType || reservation.roomName || '';
        
        console.log('예약:', doc.id, 'roomType:', roomType, 'roomName:', reservation.roomName, 'price:', reservation.totalPrice);
        
        // 객실 타입으로 펜션 구분
        // Forest 객실 → 초호펜션
        // 호수뷰, 단체, 야유회 → 초호쉼터
        const isChoho = roomType.toLowerCase().includes('forest');
        const isChohoShelter = roomType.includes('호수뷰') || 
                               roomType.includes('단체') || 
                               roomType.includes('야유회');
        
        if (businessType === 'pension' && isChoho) {
          totalRevenue += reservation.totalPrice || 0;
          totalReservations++;
          console.log('→ 초호펜션 매출 추가');
        } else if (businessType === 'shelter' && isChohoShelter) {
          totalRevenue += reservation.totalPrice || 0;
          totalReservations++;
          console.log('→ 초호쉼터 매출 추가');
        }
      });
      
      console.log('최종 집계:', businessType, '매출:', totalRevenue, '예약:', totalReservations);
      
      setAutoRevenue(totalRevenue);
      setAutoReservations(totalReservations);
    } catch (error) {
      console.error('loadAutoRevenue 오류:', error);
    }
  };

  const handleInputChange = (section, field, value) => {
    const numValue = Number(value.replace(/[^0-9.]/g, '')) || 0;
    
    // 메타 광고비 달러 입력 처리
    if (field === 'metaAdCostUSD') {
      const usdValue = numValue;
      const krwValue = Math.round(usdValue * 1400); // 달러를 원화로 변환 (환율 1400원)
      
      setFormData(prev => ({
        ...prev,
        metaAdCostUSD: usdValue,
        adCost: {
          ...prev.adCost,
          meta: krwValue
        }
      }));
      return;
    }
    
    // 네이버 광고 전체통계 입력 처리
    if (field === 'naverAdCostTotal') {
      const totalValue = numValue;
      
      // 초호펜션: 초호 데이터만 입력
      // 초호쉼터: 전체통계 - 초호 데이터
      if (businessType === 'pension') {
        // 초호펜션은 입력값 그대로 사용
        setFormData(prev => ({
          ...prev,
          naverAdCostTotal: totalValue,
          adCost: {
            ...prev.adCost,
            naver: totalValue // 초호는 그대로
          }
        }));
      } else {
        // 초호쉼터는 전체통계만 저장 (실제 값은 계산해서 표시)
        setFormData(prev => ({
          ...prev,
          naverAdCostTotal: totalValue
        }));
      }
      return;
    }
    
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: numValue
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: numValue
      }));
    }
  };

  const saveData = async () => {
    setSaving(true);
    try {
      const collectionName = businessType === 'pension' ? 'monthly_stats_pension' : 'monthly_stats_shelter';
      const docId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const docRef = doc(db, collectionName, docId);
      
      const saveData = {
        businessType,
        businessName,
        year: selectedYear,
        month: selectedMonth,
        ...formData,
        naverAdCostTotal: formData.naverAdCostTotal, // 네이버 전체통계 저장
        metaAdCostUSD: formData.metaAdCostUSD, // 달러 값도 저장
        autoRevenue,
        autoReservations,
        updatedAt: new Date().toISOString(),
        // 계산된 지표들도 저장
        calculatedMetrics: {
          totalVisitors: formData.websiteVisitors + formData.naverPlaceVisits,
          totalAdCost: Object.values(formData.adCost).reduce((sum, cost) => sum + cost, 0),
          totalClicks: Object.values(formData.clicks).reduce((sum, clicks) => sum + clicks, 0),
          totalImpressions: Object.values(formData.impressions).reduce((sum, imp) => sum + imp, 0),
          conversionRate: calculateConversionRate(
            isAutoRevenueMonth ? autoReservations : 0,
            formData.websiteVisitors + formData.naverPlaceVisits
          ),
          roi: calculateROI(
            isAutoRevenueMonth ? autoRevenue : 0,
            Object.values(formData.adCost).reduce((sum, cost) => sum + cost, 0)
          )
        }
      };
      
      await setDoc(docRef, saveData);
      alert('저장되었습니다!');
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장에 실패했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 실시간 계산 지표들
  const totalVisitors = formData.websiteVisitors + formData.naverPlaceVisits;
  const totalAdCost = Object.values(formData.adCost).reduce((sum, cost) => sum + cost, 0);
  const totalClicks = Object.values(formData.clicks).reduce((sum, clicks) => sum + clicks, 0);
  const totalImpressions = Object.values(formData.impressions).reduce((sum, imp) => sum + imp, 0);
  const avgCPC = totalClicks > 0 ? totalAdCost / totalClicks : 0;
  const avgCPM = totalImpressions > 0 ? (totalAdCost / totalImpressions) * 1000 : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const conversionRate = calculateConversionRate(
    isAutoRevenueMonth ? autoReservations : 0,
    totalVisitors
  );
  const roi = calculateROI(
    isAutoRevenueMonth ? autoRevenue : 0,
    totalAdCost
  );

  if (loading) {
    return <div className="monthly-stats-loading">데이터를 불러오는 중...</div>;
  }
  
  return (
    <div className="monthly-stats-input">
      <div style={{background: 'lightblue', padding: 10, margin: 10}}>
        <h3>디버그 정보</h3>
        <p>로딩: {loading ? '예' : '아니오'}</p>
        <p>펜션: {businessType}</p>
        <p>년월: {selectedYear}년 {selectedMonth}월</p>
        <p>자동집계: {isAutoRevenueMonth ? '예' : '아니오'}</p>
        <p>매출: {formatCurrency(autoRevenue)}</p>
        <p>예약: {autoReservations}건</p>
        <button onClick={async () => {
          console.log('=== 수동 로드 시작 ===');
          await loadData();
          console.log('=== 수동 로드 완료 ===');
          console.log('autoRevenue:', autoRevenue);
          console.log('autoReservations:', autoReservations);
        }}>수동 로드</button>
        <button onClick={async () => {
          try {
            alert('쿼리 시작');
            const startDate = new Date(selectedYear, selectedMonth - 1, 1);
            const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
            
            const reservationsRef = collection(db, 'reservations');
            const q = query(
              reservationsRef,
              where('checkInDate', '>=', startDate),
              where('checkInDate', '<=', endDate)
            );
            
            const snapshot = await getDocs(q);
            alert(`전체 예약 수: ${snapshot.size}개`);
            
            let resultText = `2025년 ${selectedMonth}월 예약:\n`;
            snapshot.forEach(doc => {
              const data = doc.data();
              resultText += `- ${data.roomName || data.roomType}: ${data.totalPrice}원 (${data.status})\n`;
            });
            
            alert(resultText || '예약 데이터가 없습니다.');
          } catch (error) {
            alert('에러: ' + error.message);
          }
        }}>직접 쿼리 테스트</button>
      </div>
      
      {/* 펜션 선택 탭 */}
      <div className="business-selector">
        <button 
          className={`business-tab ${businessType === 'pension' ? 'active' : ''}`}
          onClick={() => setBusinessType('pension')}
        >
          🏠 초호펜션
        </button>
        <button 
          className={`business-tab ${businessType === 'shelter' ? 'active' : ''}`}
          onClick={() => setBusinessType('shelter')}
        >
          🏡 초호쉼터
        </button>
        <button 
          className="business-tab integrated"
          onClick={() => {
            // Dashboard의 activeTab을 변경하는 방법
            const event = new CustomEvent('changeTab', { detail: 'integratedStats' });
            window.dispatchEvent(event);
          }}
        >
          📊 통합보기
        </button>
      </div>

      <div className="stats-header">
        <div className="header-top">
          <h2>{businessName} - {monthName} 통계 입력</h2>
          {/* 년/월 선택기 */}
          <div className="period-selector">
            <button 
              className="nav-btn"
              onClick={() => {
                if (selectedMonth === 1) {
                  setSelectedYear(selectedYear - 1);
                  setSelectedMonth(12);
                } else {
                  setSelectedMonth(selectedMonth - 1);
                }
              }}
            >
              이전 ◀
            </button>
            
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="year-select"
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="month-select"
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{month}월</option>
              ))}
            </select>
            
            <button 
              className="nav-btn"
              onClick={() => {
                if (selectedMonth === 12) {
                  setSelectedYear(selectedYear + 1);
                  setSelectedMonth(1);
                } else {
                  setSelectedMonth(selectedMonth + 1);
                }
              }}
            >
              다음 ▶
            </button>
          </div>
        </div>
        <div className="header-info">
          {isAutoRevenueMonth && (
            <span className="auto-indicator">매출 자동집계 활성화</span>
          )}
          <button 
            className="save-button" 
            onClick={saveData} 
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {/* 자동 집계 영역 */}
        {isAutoRevenueMonth && (
          <div className="stats-section auto-section">
            <h3>📊 자동 집계 데이터</h3>
            <div className="auto-stats-grid">
              <div className="auto-stat-item">
                <label>총 매출</label>
                <div className="auto-value">{formatCurrency(autoRevenue)}</div>
              </div>
              <div className="auto-stat-item">
                <label>예약 건수</label>
                <div className="auto-value">{formatNumber(autoReservations)}건</div>
              </div>
              <div className="auto-stat-item">
                <label>객단가</label>
                <div className="auto-value">
                  {autoReservations > 0 ? formatCurrency(autoRevenue / autoReservations) : '0원'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 방문자 통계 */}
        <div className="stats-section manual-section">
          <h3>👥 방문자 통계</h3>
          <div className="input-grid">
            <div className="input-group">
              <label htmlFor="websiteVisitors">
                웹사이트 방문자
                <span className="help-text">Google Analytics 사용자 수</span>
              </label>
              <input
                type="text"
                id="websiteVisitors"
                value={formData.websiteVisitors.toLocaleString()}
                onChange={(e) => handleInputChange(null, 'websiteVisitors', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="input-group">
              <label htmlFor="websitePageviews">
                홈페이지 페이지뷰
                <span className="help-text">Google Analytics 페이지뷰 수</span>
              </label>
              <input
                type="text"
                id="websitePageviews"
                value={formData.websitePageviews.toLocaleString()}
                onChange={(e) => handleInputChange(null, 'websitePageviews', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="input-group">
              <label htmlFor="naverPlaceVisits">
                네이버 플레이스 방문
                <span className="help-text">네이버 마이 비즈니스 기준</span>
              </label>
              <input
                type="text"
                id="naverPlaceVisits"
                value={formData.naverPlaceVisits.toLocaleString()}
                onChange={(e) => handleInputChange(null, 'naverPlaceVisits', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* 광고비 입력 */}
        <div className="stats-section manual-section">
          <h3>💰 광고비</h3>
          <div className="input-grid">
            {Object.keys(formData.adCost).map(platform => {
              if (platform === 'naver') {
                // 네이버는 펜션별로 다른 입력 방식
                if (businessType === 'pension') {
                  return (
                    <div key={platform} className="input-group">
                      <label htmlFor="naverAdCostTotal">
                        네이버 광고비 (원)
                        <span className="help-text">초호펜션 광고비만 입력</span>
                      </label>
                      <input
                        type="text"
                        id="naverAdCostTotal"
                        value={formData.naverAdCostTotal.toLocaleString()}
                        onChange={(e) => handleInputChange(null, 'naverAdCostTotal', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  );
                } else {
                  // 초호쉼터는 전체통계 입력 후 자동 계산
                  return (
                    <div key={platform} className="input-group">
                      <label htmlFor="naverAdCostTotal">
                        네이버 광고비 전체통계 (원)
                        <span className="help-text">초호+초호쉼터 합산 입력</span>
                      </label>
                      <input
                        type="text"
                        id="naverAdCostTotal"
                        value={formData.naverAdCostTotal.toLocaleString()}
                        onChange={(e) => handleInputChange(null, 'naverAdCostTotal', e.target.value)}
                        placeholder="0"
                      />
                      <div style={{ marginTop: '5px', color: '#666', fontSize: '14px' }}>
                        초호쉼터 광고비: {/* 추후 계산 로직 추가 */}
                      </div>
                    </div>
                  );
                }
              }
              
              if (platform === 'meta') {
                // 메타는 달러 입력 필드 표시
                return (
                  <div key={platform} className="input-group">
                    <label htmlFor="metaAdCostUSD">
                      Meta(인스타+페북) - USD
                      <span className="help-text">달러 입력 (자동 환율 적용: $1 = ₩1,400)</span>
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        id="metaAdCostUSD"
                        value={formData.metaAdCostUSD || ''}
                        onChange={(e) => handleInputChange(null, 'metaAdCostUSD', e.target.value)}
                        placeholder="0"
                        style={{ flex: 1 }}
                      />
                      <span style={{ color: '#666', fontSize: '14px' }}>
                        = {formData.adCost.meta.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                );
              }
              
              return (
                <div key={platform} className="input-group">
                  <label htmlFor={`adCost_${platform}`}>
                    {platform === 'google' ? '구글 (원)' :
                     platform === 'kakao' ? '카카오 (원)' : '기타 (원)'}
                  </label>
                  <input
                    type="text"
                    id={`adCost_${platform}`}
                    value={formData.adCost[platform].toLocaleString()}
                    onChange={(e) => handleInputChange('adCost', platform, e.target.value)}
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 광고 성과 */}
        <div className="stats-section manual-section">
          <h3>📈 광고 성과</h3>
          <div className="performance-tabs">
            <div className="performance-section">
              <h4>클릭 수</h4>
              <div className="input-grid">
                {Object.keys(formData.clicks).map(platform => (
                  <div key={platform} className="input-group">
                    <label htmlFor={`clicks_${platform}`}>
                      {platform === 'naver' ? '네이버' : 
                       platform === 'google' ? '구글' :
                       platform === 'meta' ? 'Meta' :
                       platform === 'kakao' ? '카카오' : '기타'}
                    </label>
                    <input
                      type="text"
                      id={`clicks_${platform}`}
                      value={formData.clicks[platform].toLocaleString()}
                      onChange={(e) => handleInputChange('clicks', platform, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="performance-section">
              <h4>노출 수</h4>
              <div className="input-grid">
                {Object.keys(formData.impressions).map(platform => (
                  <div key={platform} className="input-group">
                    <label htmlFor={`impressions_${platform}`}>
                      {platform === 'naver' ? '네이버' : 
                       platform === 'google' ? '구글' :
                       platform === 'meta' ? 'Meta' :
                       platform === 'kakao' ? '카카오' : '기타'}
                    </label>
                    <input
                      type="text"
                      id={`impressions_${platform}`}
                      value={formData.impressions[platform].toLocaleString()}
                      onChange={(e) => handleInputChange('impressions', platform, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 기타 지표 */}
        <div className="stats-section manual-section">
          <h3>📝 기타 지표</h3>
          <div className="input-grid">
            <div className="input-group">
              <label htmlFor="reviews">
                리뷰 수
                <span className="help-text">신규 리뷰 개수</span>
              </label>
              <input
                type="text"
                id="reviews"
                value={formData.reviews.toLocaleString()}
                onChange={(e) => handleInputChange(null, 'reviews', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* 실시간 계산 지표 */}
        <div className="stats-section calculated-section">
          <h3>⚡ 실시간 계산 지표</h3>
          <div className="calculated-grid">
            <div className="calculated-item">
              <label>전체 방문자</label>
              <div className="calculated-value">{formatNumber(totalVisitors)}명</div>
            </div>
            <div className="calculated-item">
              <label>전체 페이지뷰</label>
              <div className="calculated-value">{formatNumber(formData.websitePageviews)}회</div>
            </div>
            <div className="calculated-item">
              <label>총 광고비</label>
              <div className="calculated-value">{formatCurrency(totalAdCost)}</div>
            </div>
            <div className="calculated-item">
              <label>총 클릭 수</label>
              <div className="calculated-value">{formatNumber(totalClicks)}회</div>
            </div>
            <div className="calculated-item">
              <label>총 노출 수</label>
              <div className="calculated-value">{formatNumber(totalImpressions)}회</div>
            </div>
            <div className="calculated-item">
              <label>평균 CPC</label>
              <div className="calculated-value">{formatCurrency(avgCPC)}</div>
            </div>
            <div className="calculated-item">
              <label>평균 CPM</label>
              <div className="calculated-value">{formatCurrency(avgCPM)}</div>
            </div>
            <div className="calculated-item">
              <label>CTR</label>
              <div className="calculated-value">{formatPercentage(ctr)}</div>
            </div>
            {isAutoRevenueMonth && (
              <>
                <div className="calculated-item">
                  <label>전환율</label>
                  <div className="calculated-value">{formatPercentage(conversionRate)}</div>
                </div>
                <div className="calculated-item">
                  <label>광고 ROI</label>
                  <div className="calculated-value roi-value">
                    {formatPercentage(roi)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyStatsInput;