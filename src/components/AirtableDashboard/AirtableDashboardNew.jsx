// src/components/AirtableDashboard/AirtableDashboardNew.jsx
import React, { useState, useEffect } from 'react';
import airtableService from '../../services/airtableService';
import { ChartIcon } from '../Icons';
import './AirtableDashboardNew.css';

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

const AirtableDashboardNew = () => {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('pension'); // 'pension' | 'platform' | 'integrated'
  const [selectedPension, setSelectedPension] = useState('choho'); // 'choho' | 'shelter'
  const [selectedPlatform, setSelectedPlatform] = useState('naverAds'); // 'naverAds' | 'homepage' | 'place' | 'meta'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  const [pensionData, setPensionData] = useState({
    choho: null,
    shelter: null
  });
  
  const [platformData, setPlatformData] = useState({
    naverAds: null,
    homepage: null,
    place: null,
    meta: null
  });
  
  const [integratedData, setIntegratedData] = useState(null);
  const [reservationData, setReservationData] = useState(null);

  // 데이터 로드
  useEffect(() => {
    loadAllData();
  }, [selectedYear, selectedMonth]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPensionData(),
        loadPlatformData(),
        loadIntegratedData(),
        loadReservationData()
      ]);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 펜션별 데이터 로드
  const loadPensionData = async () => {
    try {
      // 초호 데이터
      const chohoData = {
        naverAds: await airtableService.fetchTableMonthlyData('네이버광고_초호', selectedYear, selectedMonth),
        homepage: await airtableService.fetchTableMonthlyData('홈페이지_초호', selectedYear, selectedMonth),
        place: await airtableService.fetchTableMonthlyData('플레이스_초호', selectedYear, selectedMonth)
      };
      
      // 초호쉼터 데이터 (네이버광고는 전체 - 초호)
      const naverTotal = await airtableService.fetchTableMonthlyData('네이버광고_전체통계', selectedYear, selectedMonth);
      const shelterData = {
        naverAds: calculateDifference(naverTotal, chohoData.naverAds),
        homepage: await airtableService.fetchTableMonthlyData('홈페이지_초호쉼터', selectedYear, selectedMonth),
        place: await airtableService.fetchTableMonthlyData('플레이스_초호쉼터', selectedYear, selectedMonth)
      };
      
      setPensionData({
        choho: processRawData(chohoData),
        shelter: processRawData(shelterData)
      });
    } catch (error) {
      console.error('펜션 데이터 로드 실패:', error);
    }
  };

  // 플랫폼별 데이터 로드
  const loadPlatformData = async () => {
    try {
      const data = {
        naverAds: {
          choho: await airtableService.fetchTableMonthlyData('네이버광고_초호', selectedYear, selectedMonth),
          total: await airtableService.fetchTableMonthlyData('네이버광고_전체통계', selectedYear, selectedMonth)
        },
        homepage: {
          choho: await airtableService.fetchTableMonthlyData('홈페이지_초호', selectedYear, selectedMonth),
          shelter: await airtableService.fetchTableMonthlyData('홈페이지_초호쉼터', selectedYear, selectedMonth)
        },
        place: {
          choho: await airtableService.fetchTableMonthlyData('플레이스_초호', selectedYear, selectedMonth),
          shelter: await airtableService.fetchTableMonthlyData('플레이스_초호쉼터', selectedYear, selectedMonth)
        },
        meta: await airtableService.fetchTableMonthlyData('Meta', selectedYear, selectedMonth)
      };
      
      // 초호쉼터 네이버광고 = 전체 - 초호
      data.naverAds.shelter = calculateDifference(data.naverAds.total, data.naverAds.choho);
      
      setPlatformData({
        naverAds: processNaverAdsData(data.naverAds),
        homepage: processHomepageData(data.homepage),
        place: processPlaceData(data.place),
        meta: processMetaData(data.meta)
      });
    } catch (error) {
      console.error('플랫폼 데이터 로드 실패:', error);
    }
  };

  // 통합 데이터 로드
  const loadIntegratedData = async () => {
    try {
      const allData = await airtableService.