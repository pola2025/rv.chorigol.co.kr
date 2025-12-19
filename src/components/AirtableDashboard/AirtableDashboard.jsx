// src/components/AirtableDashboard/AirtableDashboard.jsx
// 완전히 새로운 구조의 에어테이블 대시보드
import React, { useState, useEffect } from 'react';
import airtableService from '../../services/airtableService';
import { ChartIcon } from '../Icons';
import './AirtableDashboard.css';

// 숫자 포맷
const formatNumber = (num) => {
  return new Intl.NumberFormat('ko-KR').format(num || 0);
};

// 금액 포맷
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount || 0);
};

// CTR 계산
const calculateCTR = (clicks, impressions) => {
  if (!impressions || impressions === 0) return '0.00';
  return ((clicks / impressions) * 100).toFixed(2);
};

// CPC 계산  
const calculateCPC = (cost, clicks) => {
  if (!clicks || clicks === 0) return 0;
  return Math.round(cost / clicks);
};

// 로딩 게이지 컴포넌트
const LoadingGauge = ({ progress = 0, message = '데이터를 불러오는 중입니다...' }) => {
  return (
    <div className="loading-gauge-container">
      <div className="loading-gauge">
        <div className="gauge-background">
          <div 
            className="gauge-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="gauge-text">{progress}%</div>
      </div>
      <p className="loading-message">{message}</p>
    </div>
  );
};

const AirtableDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [viewMode, setViewMode] = useState('yearly'); // 'yearly' | 'pension' | 'platform' | 'integrated'
  const [selectedPension, setSelectedPension] = useState('choho');
  const [selectedPlatform, setSelectedPlatform] = useState('naverAds');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  const [yearlyData, setYearlyData] = useState({});
  const [processedData, setProcessedData] = useState({
    choho: {},
    shelter: {},
    integrated: {}
  });

  // 연간 데이터 로드
  useEffect(() => {
    if (viewMode === 'yearly') {
      loadYearlyData();
    } else {
      loadMonthlyData();
    }
  }, [selectedYear, selectedMonth, viewMode]);

  // 연간 데이터 로드 함수
  const loadYearlyData = async () => {
    setLoading(true);
    setLoadingProgress(0);
    
    try {
      const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      const yearData = {};
      
      for (let month = 1; month <= 12; month++) {
        setLoadingProgress(Math.round((month / 12) * 100));
        
        // 각 월별 데이터 로드
        const [
          naverChoho,
          naverTotal,
          homepageChoho,
          homepageShelter,
          placeChoho,
          placeShelter,
          meta
        ] = await Promise.all([
          airtableService.fetchTableMonthlyData('네이버광고_초호', selectedYear, month),
          airtableService.fetchTableMonthlyData('네이버광고_전체통계', selectedYear, month),
          airtableService.fetchTableMonthlyData('홈페이지_초호', selectedYear, month),
          airtableService.fetchTableMonthlyData('홈페이지_초호쉼터', selectedYear, month),
          airtableService.fetchTableMonthlyData('플레이스_초호', selectedYear, month),
          airtableService.fetchTableMonthlyData('플레이스_초호쉼터', selectedYear, month),
          airtableService.fetchTableMonthlyData('Meta', selectedYear, month)
        ]);

        // 데이터 처리
        const chohoMetrics = extractMetrics(naverChoho);
        const totalMetrics = extractMetrics(naverTotal);
        const shelterNaverMetrics = calculateDifference(totalMetrics, chohoMetrics);
        
        yearData[months[month - 1]] = {
          choho: {
            naver: chohoMetrics,
            homepage: extractMetrics(homepageChoho),
            place: extractMetrics(placeChoho)
          },
          shelter: {
            naver: shelterNaverMetrics,
            homepage: extractMetrics(homepageShelter),
            place: extractMetrics(placeShelter)
          },
          meta: extractMetrics(meta, true) // Meta는 달러이므로 true 전달
        };
      }
      
      setYearlyData(yearData);
      setLoadingProgress(100);
    } catch (error) {
      console.error('연간 데이터 로드 실패:', error);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
      }, 500);
    }
  };

  const loadMonthlyData = async () => {
    setLoading(true);
    setLoadingProgress(20);
    
    try {
      // 모든 테이블 데이터 병렬로 가져오기
      setLoadingProgress(40);
      
      const [
        naverChoho,
        naverTotal,
        homepageChoho,
        homepageShelter,
        placeChoho,
        placeShelter,
        meta
      ] = await Promise.all([
        airtableService.fetchTableMonthlyData('네이버광고_초호', selectedYear, selectedMonth),
        airtableService.fetchTableMonthlyData('네이버광고_전체통계', selectedYear, selectedMonth),
        airtableService.fetchTableMonthlyData('홈페이지_초호', selectedYear, selectedMonth),
        airtableService.fetchTableMonthlyData('홈페이지_초호쉼터', selectedYear, selectedMonth),
        airtableService.fetchTableMonthlyData('플레이스_초호', selectedYear, selectedMonth),
        airtableService.fetchTableMonthlyData('플레이스_초호쉼터', selectedYear, selectedMonth),
        airtableService.fetchTableMonthlyData('Meta', selectedYear, selectedMonth)
      ]);

      setLoadingProgress(70);

      // 데이터 처리
      const choho = {
        naverAds: extractMetrics(naverChoho),
        homepage: extractMetrics(homepageChoho),
        place: extractMetrics(placeChoho)
      };

      // 초호쉼터 네이버광고 = 전체 - 초호
      const naverShelter = calculateDifference(
        extractMetrics(naverTotal),
        extractMetrics(naverChoho)
      );

      // 초호쉼터 데이터
      const shelter = {
        naverAds: naverShelter,
        homepage: extractMetrics(homepageShelter),
        place: extractMetrics(placeShelter)
      };

      // 통합 데이터
      const integrated = {
        naverAds: {
          impressions: choho.naverAds.impressions + shelter.naverAds.impressions,
          clicks: choho.naverAds.clicks + shelter.naverAds.clicks,
          cost: choho.naverAds.cost + shelter.naverAds.cost,
          ctr: 0,
          cpc: 0
        },
        homepage: {
          visitors: choho.homepage.visitors + shelter.homepage.visitors,
          pageviews: choho.homepage.pageviews + shelter.homepage.pageviews,
          avgTime: (choho.homepage.avgTime + shelter.homepage.avgTime) / 2,
          bounceRate: (choho.homepage.bounceRate + shelter.homepage.bounceRate) / 2
        },
        place: {
          visitors: choho.place.visitors + shelter.place.visitors,
          pageviews: choho.place.pageviews + shelter.place.pageviews,
          inquiries: choho.place.inquiries + shelter.place.inquiries,
          reservations: choho.place.reservations + shelter.place.reservations
        },
        meta: extractMetrics(meta, true) // Meta는 달러이므로 true 전달
      };

      // CTR, CPC 계산
      choho.naverAds.ctr = calculateCTR(choho.naverAds.clicks, choho.naverAds.impressions);
      choho.naverAds.cpc = calculateCPC(choho.naverAds.cost, choho.naverAds.clicks);
      shelter.naverAds.ctr = calculateCTR(shelter.naverAds.clicks, shelter.naverAds.impressions);
      shelter.naverAds.cpc = calculateCPC(shelter.naverAds.cost, shelter.naverAds.clicks);
      integrated.naverAds.ctr = calculateCTR(integrated.naverAds.clicks, integrated.naverAds.impressions);
      integrated.naverAds.cpc = calculateCPC(integrated.naverAds.cost, integrated.naverAds.clicks);

      setLoadingProgress(90);
      setProcessedData({ choho, shelter, integrated });
      setLoadingProgress(100);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
      }, 500);
    }
  };

  // 메트릭 추출
  const extractMetrics = (data, isMeta = false) => {
    const metrics = {
      impressions: 0,
      clicks: 0,
      cost: 0,
      visitors: 0,
      pageviews: 0,
      avgTime: 0,
      bounceRate: 0,
      inquiries: 0,
      reservations: 0,
      conversions: 0
    };

    if (!data || !Array.isArray(data)) return metrics;

    data.forEach(item => {
      if (!item.category) return;
      
      const category = item.category.toLowerCase();
      const value = parseFloat(item.value) || 0;

      if (category.includes('노출')) metrics.impressions += value;
      else if (category.includes('클릭')) metrics.clicks += value;
      else if (category.includes('광고비') || category.includes('비용')) {
        // Meta 광고비는 달러이므로 원화로 환산 (환율 1400원)
        metrics.cost += isMeta ? value * 1400 : value;
      }
      else if (category.includes('방문자') || category.includes('사용자')) metrics.visitors += value;
      else if (category.includes('페이지뷰') || category.includes('조회')) metrics.pageviews += value;
      else if (category.includes('체류시간') || category.includes('평균시간')) metrics.avgTime = value;
      else if (category.includes('이탈률')) metrics.bounceRate = value;
      else if (category.includes('문의')) metrics.inquiries += value;
      else if (category.includes('예약')) metrics.reservations += value;
      else if (category.includes('전환')) metrics.conversions += value;
    });

    return metrics;
  };

  // 차이 계산 (전체 - 초호 = 초호쉼터)
  const calculateDifference = (total, choho) => {
    return {
      impressions: Math.max(0, total.impressions - choho.impressions),
      clicks: Math.max(0, total.clicks - choho.clicks),
      cost: Math.max(0, total.cost - choho.cost),
      visitors: Math.max(0, total.visitors - choho.visitors),
      pageviews: Math.max(0, total.pageviews - choho.pageviews),
      avgTime: total.avgTime,
      bounceRate: total.bounceRate,
      inquiries: Math.max(0, total.inquiries - choho.inquiries),
      reservations: Math.max(0, total.reservations - choho.reservations)
    };
  };

  return (
    <div className="airtable-dashboard">
      {/* 헤더 */}
      <div className="airtable-header">
        <div className="header-left">
          <h2>
            <ChartIcon size={24} className="header-icon" />
            마케팅 통합 대시보드
          </h2>
        </div>
        
        <div className="header-controls">
          <div className="view-mode-toggle">
            <button 
              className={`mode-btn ${viewMode === 'yearly' ? 'active' : ''}`}
              onClick={() => setViewMode('yearly')}
            >
              📅 연간통계
            </button>
            <button 
              className={`mode-btn ${viewMode === 'pension' ? 'active' : ''}`}
              onClick={() => setViewMode('pension')}
            >
              🏢 펜션별
            </button>
            <button 
              className={`mode-btn ${viewMode === 'platform' ? 'active' : ''}`}
              onClick={() => setViewMode('platform')}
            >
              📱 플랫폼별
            </button>
            <button 
              className={`mode-btn ${viewMode === 'integrated' ? 'active' : ''}`}
              onClick={() => setViewMode('integrated')}
            >
              📊 통합
            </button>
          </div>
          
          <div className="date-selector">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="year-select"
            >
              <option value={2024}>2024년</option>
              <option value={2025}>2025년</option>
            </select>
            
            {viewMode !== 'yearly' && (
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="month-select"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}월
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 서브 네비게이션 */}
      {viewMode === 'pension' && (
        <div className="sub-navigation">
          <button 
            className={`sub-nav-btn ${selectedPension === 'choho' ? 'active' : ''}`}
            onClick={() => setSelectedPension('choho')}
          >
            초호 펜션
          </button>
          <button 
            className={`sub-nav-btn ${selectedPension === 'shelter' ? 'active' : ''}`}
            onClick={() => setSelectedPension('shelter')}
          >
            초호쉼터
          </button>
        </div>
      )}
      
      {viewMode === 'platform' && (
        <div className="sub-navigation">
          <button 
            className={`sub-nav-btn ${selectedPlatform === 'naverAds' ? 'active' : ''}`}
            onClick={() => setSelectedPlatform('naverAds')}
          >
            네이버광고
          </button>
          <button 
            className={`sub-nav-btn ${selectedPlatform === 'homepage' ? 'active' : ''}`}
            onClick={() => setSelectedPlatform('homepage')}
          >
            홈페이지
          </button>
          <button 
            className={`sub-nav-btn ${selectedPlatform === 'place' ? 'active' : ''}`}
            onClick={() => setSelectedPlatform('place')}
          >
            플레이스
          </button>
          <button 
            className={`sub-nav-btn ${selectedPlatform === 'meta' ? 'active' : ''}`}
            onClick={() => setSelectedPlatform('meta')}
          >
            Meta
          </button>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="airtable-content">
        {loading ? (
          <LoadingGauge 
            progress={loadingProgress} 
            message={viewMode === 'yearly' ? '연간 데이터를 불러오는 중입니다...' : '데이터를 불러오는 중입니다...'} 
          />
        ) : (
          <>
            {/* 연간 통계 뷰 */}
            {viewMode === 'yearly' && (
              <div className="yearly-view">
                <h3 className="section-title">
                  📊 {selectedYear}년 연간 통계
                </h3>
                
                <div className="yearly-table-container">
                  <table className="yearly-table">
                    <thead>
                      <tr>
                        <th className="sticky-col">구분</th>
                        <th>1월</th>
                        <th>2월</th>
                        <th>3월</th>
                        <th>4월</th>
                        <th>5월</th>
                        <th>6월</th>
                        <th>7월</th>
                        <th>8월</th>
                        <th>9월</th>
                        <th>10월</th>
                        <th>11월</th>
                        <th>12월</th>
                        <th className="total-col">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 초호 펜션 */}
                      <tr className="category-row choho-row">
                        <td className="sticky-col category-header" colSpan="14">🏠 초호 펜션</td>
                      </tr>
                      <tr>
                        <td className="sticky-col">홈페이지 방문자</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.choho?.homepage?.visitors)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.choho?.homepage?.visitors || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">홈페이지 페이지뷰</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.choho?.homepage?.pageviews)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.choho?.homepage?.pageviews || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">플레이스 방문자</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.choho?.place?.visitors)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.choho?.place?.visitors || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 광고비</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatCurrency(yearlyData[month]?.choho?.naver?.cost)}</td>
                        ))}
                        <td className="total-col">
                          {formatCurrency(Object.values(yearlyData).reduce((sum, month) => sum + (month?.choho?.naver?.cost || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 클릭수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.choho?.naver?.clicks)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.choho?.naver?.clicks || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 노출수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.choho?.naver?.impressions)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.choho?.naver?.impressions || 0), 0))}
                        </td>
                      </tr>

                      {/* 초호쉼터 */}
                      <tr className="category-row shelter-row">
                        <td className="sticky-col category-header" colSpan="14">🏡 초호쉼터</td>
                      </tr>
                      <tr>
                        <td className="sticky-col">홈페이지 방문자</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.shelter?.homepage?.visitors)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.shelter?.homepage?.visitors || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">홈페이지 페이지뷰</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.shelter?.homepage?.pageviews)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.shelter?.homepage?.pageviews || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">플레이스 방문자</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.shelter?.place?.visitors)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.shelter?.place?.visitors || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 광고비</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatCurrency(yearlyData[month]?.shelter?.naver?.cost)}</td>
                        ))}
                        <td className="total-col">
                          {formatCurrency(Object.values(yearlyData).reduce((sum, month) => sum + (month?.shelter?.naver?.cost || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 클릭수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.shelter?.naver?.clicks)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.shelter?.naver?.clicks || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 노출수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.shelter?.naver?.impressions)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.shelter?.naver?.impressions || 0), 0))}
                        </td>
                      </tr>

                      {/* 통합 통계 (초호 + 초호쉼터) */}
                      <tr className="category-row integrated-row">
                        <td className="sticky-col category-header" colSpan="14">📊 통합 통계 (초호 + 초호쉼터)</td>
                      </tr>
                      <tr>
                        <td className="sticky-col">홈페이지 방문자</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month} className="integrated-total">
                            {formatNumber(
                              (yearlyData[month]?.choho?.homepage?.visitors || 0) + 
                              (yearlyData[month]?.shelter?.homepage?.visitors || 0)
                            )}
                          </td>
                        ))}
                        <td className="total-col integrated-total">
                          {formatNumber(
                            Object.values(yearlyData).reduce((sum, month) => 
                              sum + (month?.choho?.homepage?.visitors || 0) + (month?.shelter?.homepage?.visitors || 0), 0
                            )
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">홈페이지 페이지뷰</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month} className="integrated-total">
                            {formatNumber(
                              (yearlyData[month]?.choho?.homepage?.pageviews || 0) + 
                              (yearlyData[month]?.shelter?.homepage?.pageviews || 0)
                            )}
                          </td>
                        ))}
                        <td className="total-col integrated-total">
                          {formatNumber(
                            Object.values(yearlyData).reduce((sum, month) => 
                              sum + (month?.choho?.homepage?.pageviews || 0) + (month?.shelter?.homepage?.pageviews || 0), 0
                            )
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">플레이스 방문자</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month} className="integrated-total">
                            {formatNumber(
                              (yearlyData[month]?.choho?.place?.visitors || 0) + 
                              (yearlyData[month]?.shelter?.place?.visitors || 0)
                            )}
                          </td>
                        ))}
                        <td className="total-col integrated-total">
                          {formatNumber(
                            Object.values(yearlyData).reduce((sum, month) => 
                              sum + (month?.choho?.place?.visitors || 0) + (month?.shelter?.place?.visitors || 0), 0
                            )
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 총 광고비</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month} className="integrated-total">
                            {formatCurrency(
                              (yearlyData[month]?.choho?.naver?.cost || 0) + 
                              (yearlyData[month]?.shelter?.naver?.cost || 0)
                            )}
                          </td>
                        ))}
                        <td className="total-col integrated-total">
                          {formatCurrency(
                            Object.values(yearlyData).reduce((sum, month) => 
                              sum + (month?.choho?.naver?.cost || 0) + (month?.shelter?.naver?.cost || 0), 0
                            )
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 총 클릭수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month} className="integrated-total">
                            {formatNumber(
                              (yearlyData[month]?.choho?.naver?.clicks || 0) + 
                              (yearlyData[month]?.shelter?.naver?.clicks || 0)
                            )}
                          </td>
                        ))}
                        <td className="total-col integrated-total">
                          {formatNumber(
                            Object.values(yearlyData).reduce((sum, month) => 
                              sum + (month?.choho?.naver?.clicks || 0) + (month?.shelter?.naver?.clicks || 0), 0
                            )
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">네이버 총 노출수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month} className="integrated-total">
                            {formatNumber(
                              (yearlyData[month]?.choho?.naver?.impressions || 0) + 
                              (yearlyData[month]?.shelter?.naver?.impressions || 0)
                            )}
                          </td>
                        ))}
                        <td className="total-col integrated-total">
                          {formatNumber(
                            Object.values(yearlyData).reduce((sum, month) => 
                              sum + (month?.choho?.naver?.impressions || 0) + (month?.shelter?.naver?.impressions || 0), 0
                            )
                          )}
                        </td>
                      </tr>

                      {/* Meta 광고 */}
                      <tr className="category-row meta-row">
                        <td className="sticky-col category-header" colSpan="14">📘 Meta 광고</td>
                      </tr>
                      <tr>
                        <td className="sticky-col">Meta 광고비</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatCurrency(yearlyData[month]?.meta?.cost)}</td>
                        ))}
                        <td className="total-col">
                          {formatCurrency(Object.values(yearlyData).reduce((sum, month) => sum + (month?.meta?.cost || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">Meta 클릭수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.meta?.clicks)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.meta?.clicks || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">Meta 노출수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.meta?.impressions)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.meta?.impressions || 0), 0))}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky-col">Meta 전환수</td>
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(month => (
                          <td key={month}>{formatNumber(yearlyData[month]?.meta?.conversions)}</td>
                        ))}
                        <td className="total-col">
                          {formatNumber(Object.values(yearlyData).reduce((sum, month) => sum + (month?.meta?.conversions || 0), 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 펜션별 뷰 */}
            {viewMode === 'pension' && (
              <div className="pension-view">
                <h3 className="section-title">
                  {selectedPension === 'choho' ? '🏠 초호 펜션' : '🏡 초호쉼터'} 통계
                  <span className="date-label"> ({selectedYear}년 {selectedMonth}월)</span>
                </h3>
                
                <div className="pension-stats-container">
                  {/* 네이버광고 카드 */}
                  <div className="pension-stat-card">
                    <div className="card-header naver">
                      <span className="card-icon">🔍</span>
                      <h4>네이버광고</h4>
                    </div>
                    <div className="card-body">
                      <div className="stat-row">
                        <div className="stat-item">
                          <label>노출수</label>
                          <value>{formatNumber(processedData[selectedPension]?.naverAds?.impressions)}</value>
                        </div>
                        <div className="stat-item">
                          <label>클릭수</label>
                          <value>{formatNumber(processedData[selectedPension]?.naverAds?.clicks)}</value>
                        </div>
                      </div>
                      <div className="stat-row">
                        <div className="stat-item">
                          <label>광고비</label>
                          <value className="cost">{formatCurrency(processedData[selectedPension]?.naverAds?.cost)}</value>
                        </div>
                        <div className="stat-item">
                          <label>CPC</label>
                          <value>{formatCurrency(processedData[selectedPension]?.naverAds?.cpc)}</value>
                        </div>
                      </div>
                      <div className="stat-footer">
                        <span>CTR: {processedData[selectedPension]?.naverAds?.ctr}%</span>
                      </div>
                    </div>
                  </div>

                  {/* 홈페이지 카드 */}
                  <div className="pension-stat-card">
                    <div className="card-header homepage">
                      <span className="card-icon">🌐</span>
                      <h4>홈페이지</h4>
                    </div>
                    <div className="card-body">
                      <div className="stat-row">
                        <div className="stat-item">
                          <label>방문자</label>
                          <value>{formatNumber(processedData[selectedPension]?.homepage?.visitors)}</value>
                        </div>
                        <div className="stat-item">
                          <label>페이지뷰</label>
                          <value>{formatNumber(processedData[selectedPension]?.homepage?.pageviews)}</value>
                        </div>
                      </div>
                      <div className="stat-row">
                        <div className="stat-item">
                          <label>평균 체류시간</label>
                          <value>{processedData[selectedPension]?.homepage?.avgTime || 0}분</value>
                        </div>
                        <div className="stat-item">
                          <label>이탈률</label>
                          <value>{processedData[selectedPension]?.homepage?.bounceRate || 0}%</value>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 플레이스 카드 */}
                  <div className="pension-stat-card">
                    <div className="card-header place">
                      <span className="card-icon">📍</span>
                      <h4>네이버 플레이스</h4>
                    </div>
                    <div className="card-body">
                      <div className="stat-row">
                        <div className="stat-item">
                          <label>방문자</label>
                          <value>{formatNumber(processedData[selectedPension]?.place?.visitors)}</value>
                        </div>
                        <div className="stat-item">
                          <label>페이지뷰</label>
                          <value>{formatNumber(processedData[selectedPension]?.place?.pageviews)}</value>
                        </div>
                      </div>
                      <div className="stat-row">
                        <div className="stat-item">
                          <label>문의</label>
                          <value>{formatNumber(processedData[selectedPension]?.place?.inquiries)}</value>
                        </div>
                        <div className="stat-item">
                          <label>예약</label>
                          <value>{formatNumber(processedData[selectedPension]?.place?.reservations)}</value>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 플랫폼별 뷰 */}
            {viewMode === 'platform' && (
              <div className="platform-view">
                <h3 className="section-title">
                  {selectedPlatform === 'naverAds' && '🔍 네이버광고'}
                  {selectedPlatform === 'homepage' && '🌐 홈페이지'}
                  {selectedPlatform === 'place' && '📍 네이버 플레이스'}
                  {selectedPlatform === 'meta' && '📘 Meta 광고'}
                  {' '}비교 분석
                  <span className="date-label"> ({selectedYear}년 {selectedMonth}월)</span>
                </h3>

                <div className="comparison-container">
                  {/* 네이버광고 비교 */}
                  {selectedPlatform === 'naverAds' && (
                    <div className="comparison-grid">
                      <div className="comparison-card choho">
                        <h4>🏠 초호 펜션</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item">
                            <span>노출수</span>
                            <strong>{formatNumber(processedData.choho?.naverAds?.impressions)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>클릭수</span>
                            <strong>{formatNumber(processedData.choho?.naverAds?.clicks)}</strong>
                          </div>
                          <div className="comparison-item highlight">
                            <span>CTR</span>
                            <strong>{processedData.choho?.naverAds?.ctr}%</strong>
                          </div>
                          <div className="comparison-item">
                            <span>광고비</span>
                            <strong>{formatCurrency(processedData.choho?.naverAds?.cost)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>CPC</span>
                            <strong>{formatCurrency(processedData.choho?.naverAds?.cpc)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="comparison-card shelter">
                        <h4>🏡 초호쉼터</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item">
                            <span>노출수</span>
                            <strong>{formatNumber(processedData.shelter?.naverAds?.impressions)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>클릭수</span>
                            <strong>{formatNumber(processedData.shelter?.naverAds?.clicks)}</strong>
                          </div>
                          <div className="comparison-item highlight">
                            <span>CTR</span>
                            <strong>{processedData.shelter?.naverAds?.ctr}%</strong>
                          </div>
                          <div className="comparison-item">
                            <span>광고비</span>
                            <strong>{formatCurrency(processedData.shelter?.naverAds?.cost)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>CPC</span>
                            <strong>{formatCurrency(processedData.shelter?.naverAds?.cpc)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="comparison-card integrated-total">
                        <h4>🔍 통합 성과</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item">
                            <span>노출수</span>
                            <strong>{formatNumber(processedData.integrated?.naverAds?.impressions)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>클릭수</span>
                            <strong>{formatNumber(processedData.integrated?.naverAds?.clicks)}</strong>
                          </div>
                          <div className="comparison-item highlight">
                            <span>CTR</span>
                            <strong>{processedData.integrated?.naverAds?.ctr}%</strong>
                          </div>
                          <div className="comparison-item">
                            <span>광고비</span>
                            <strong>{formatCurrency(processedData.integrated?.naverAds?.cost)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>CPC</span>
                            <strong>{formatCurrency(processedData.integrated?.naverAds?.cpc)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 홈페이지 비교 */}
                  {selectedPlatform === 'homepage' && (
                    <div className="comparison-grid">
                      <div className="comparison-card choho">
                        <h4>🏠 초호 펜션</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item">
                            <span>방문자</span>
                            <strong>{formatNumber(processedData.choho?.homepage?.visitors)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>페이지뷰</span>
                            <strong>{formatNumber(processedData.choho?.homepage?.pageviews)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>체류시간</span>
                            <strong>{processedData.choho?.homepage?.avgTime || 0}분</strong>
                          </div>
                          <div className="comparison-item">
                            <span>이탈률</span>
                            <strong>{processedData.choho?.homepage?.bounceRate || 0}%</strong>
                          </div>
                        </div>
                      </div>

                      <div className="comparison-card shelter">
                        <h4>🏡 초호쉼터</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item">
                            <span>방문자</span>
                            <strong>{formatNumber(processedData.shelter?.homepage?.visitors)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>페이지뷰</span>
                            <strong>{formatNumber(processedData.shelter?.homepage?.pageviews)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>체류시간</span>
                            <strong>{processedData.shelter?.homepage?.avgTime || 0}분</strong>
                          </div>
                          <div className="comparison-item">
                            <span>이탈률</span>
                            <strong>{processedData.shelter?.homepage?.bounceRate || 0}%</strong>
                          </div>
                        </div>
                      </div>

                      <div className="comparison-card integrated-total">
                        <h4>🎯 통합 지표</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item highlight">
                            <span>총 방문자</span>
                            <strong>{formatNumber(processedData.integrated?.homepage?.visitors)}</strong>
                          </div>
                          <div className="comparison-item highlight">
                            <span>총 페이지뷰</span>
                            <strong>{formatNumber(processedData.integrated?.homepage?.pageviews)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 플레이스 비교 */}
                  {selectedPlatform === 'place' && (
                    <div className="comparison-grid">
                      <div className="comparison-card choho">
                        <h4>🏠 초호 펜션</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item">
                            <span>방문자</span>
                            <strong>{formatNumber(processedData.choho?.place?.visitors)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>페이지뷰</span>
                            <strong>{formatNumber(processedData.choho?.place?.pageviews)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>문의</span>
                            <strong>{formatNumber(processedData.choho?.place?.inquiries)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>예약</span>
                            <strong>{formatNumber(processedData.choho?.place?.reservations)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="comparison-card shelter">
                        <h4>🏡 초호쉼터</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item">
                            <span>방문자</span>
                            <strong>{formatNumber(processedData.shelter?.place?.visitors)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>페이지뷰</span>
                            <strong>{formatNumber(processedData.shelter?.place?.pageviews)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>문의</span>
                            <strong>{formatNumber(processedData.shelter?.place?.inquiries)}</strong>
                          </div>
                          <div className="comparison-item">
                            <span>예약</span>
                            <strong>{formatNumber(processedData.shelter?.place?.reservations)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="comparison-card integrated-summary">
                        <h4>📈 통합 실적</h4>
                        <div className="comparison-stats">
                          <div className="comparison-item highlight">
                            <span>총 방문자</span>
                            <strong>{formatNumber(processedData.integrated?.place?.visitors)}</strong>
                          </div>
                          <div className="comparison-item highlight">
                            <span>총 페이지뷰</span>
                            <strong>{formatNumber(processedData.integrated?.place?.pageviews)}</strong>
                          </div>
                          <div className="comparison-item highlight">
                            <span>총 문의</span>
                            <strong>{formatNumber(processedData.integrated?.place?.inquiries)}</strong>
                          </div>
                          <div className="comparison-item highlight">
                            <span>총 예약</span>
                            <strong>{formatNumber(processedData.integrated?.place?.reservations)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Meta 광고 */}
                  {selectedPlatform === 'meta' && (
                    <div className="meta-container">
                      <div className="meta-stats-grid">
                        <div className="stat-card meta">
                          <div className="stat-label">노출수</div>
                          <div className="stat-value">
                            {formatNumber(processedData.integrated?.meta?.impressions)}
                          </div>
                        </div>
                        <div className="stat-card meta">
                          <div className="stat-label">클릭수</div>
                          <div className="stat-value">
                            {formatNumber(processedData.integrated?.meta?.clicks)}
                          </div>
                          <div className="stat-sub">
                            CTR: {calculateCTR(
                              processedData.integrated?.meta?.clicks,
                              processedData.integrated?.meta?.impressions
                            )}%
                          </div>
                        </div>
                        <div className="stat-card meta">
                          <div className="stat-label">광고비</div>
                          <div className="stat-value">
                            {formatCurrency(processedData.integrated?.meta?.cost)}
                          </div>
                          <div className="stat-sub">
                            CPC: {formatCurrency(
                              calculateCPC(
                                processedData.integrated?.meta?.cost,
                                processedData.integrated?.meta?.clicks
                              )
                            )}
                          </div>
                        </div>
                        <div className="stat-card meta">
                          <div className="stat-label">전환수</div>
                          <div className="stat-value">
                            {formatNumber(processedData.integrated?.meta?.conversions)}
                          </div>
                          <div className="stat-sub">
                            CPA: {formatCurrency(
                              processedData.integrated?.meta?.conversions > 0
                                ? processedData.integrated?.meta?.cost / processedData.integrated?.meta?.conversions
                                : 0
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 통합 뷰 */}
            {viewMode === 'integrated' && (
              <div className="integrated-view">
                <h3 className="section-title">
                  📊 전체 통합 대시보드
                  <span className="date-label"> ({selectedYear}년 {selectedMonth}월)</span>
                </h3>

                <div className="integrated-summary">
                  <div className="summary-grid">
                    {/* 전체 광고 성과 */}
                    <div className="summary-section">
                      <h4>💰 전체 광고 성과</h4>
                      <div className="summary-stats">
                        <div className="summary-item">
                          <span>총 광고비</span>
                          <strong>{formatCurrency(
                            processedData.integrated?.naverAds?.cost + 
                            (processedData.integrated?.meta?.cost || 0)
                          )}</strong>
                        </div>
                        <div className="summary-item">
                          <span>총 노출</span>
                          <strong>{formatNumber(
                            processedData.integrated?.naverAds?.impressions + 
                            (processedData.integrated?.meta?.impressions || 0)
                          )}</strong>
                        </div>
                        <div className="summary-item">
                          <span>총 클릭</span>
                          <strong>{formatNumber(
                            processedData.integrated?.naverAds?.clicks + 
                            (processedData.integrated?.meta?.clicks || 0)
                          )}</strong>
                        </div>
                      </div>
                    </div>

                    {/* 전체 웹사이트 성과 */}
                    <div className="summary-section">
                      <h4>🌐 전체 웹사이트 성과</h4>
                      <div className="summary-stats">
                        <div className="summary-item">
                          <span>총 방문자</span>
                          <strong>{formatNumber(
                            processedData.integrated?.homepage?.visitors + 
                            processedData.integrated?.place?.visitors
                          )}</strong>
                        </div>
                        <div className="summary-item">
                          <span>총 페이지뷰</span>
                          <strong>{formatNumber(
                            processedData.integrated?.homepage?.pageviews + 
                            processedData.integrated?.place?.pageviews
                          )}</strong>
                        </div>
                        <div className="summary-item">
                          <span>총 문의/예약</span>
                          <strong>{formatNumber(
                            processedData.integrated?.place?.inquiries + 
                            processedData.integrated?.place?.reservations
                          )}</strong>
                        </div>
                      </div>
                    </div>

                    {/* 펜션별 광고비 분포 */}
                    <div className="summary-section">
                      <h4>🏢 펜션별 광고비 분포</h4>
                      <div className="summary-stats">
                        <div className="summary-item">
                          <span>초호 펜션</span>
                          <strong>{formatCurrency(processedData.choho?.naverAds?.cost)}</strong>
                        </div>
                        <div className="summary-item">
                          <span>초호쉼터</span>
                          <strong>{formatCurrency(processedData.shelter?.naverAds?.cost)}</strong>
                        </div>
                        <div className="summary-item">
                          <span>Meta (통합)</span>
                          <strong>{formatCurrency(processedData.integrated?.meta?.cost)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AirtableDashboard;