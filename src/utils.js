// src/utils.js

import { useState, useEffect } from 'react';

export const useWindowWidth = () => {
const [width, setWidth] = useState(window.innerWidth);
useEffect(() => {
const handleResize = () => setWidth(window.innerWidth);
window.addEventListener('resize', handleResize);
return () => window.removeEventListener('resize', handleResize);
}, []);
return width;
};

// 날짜에서 다음 날짜 문자열을 반환하는 함수
export const getNextDateStr = (dateStr) => {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateStr);
      return '';
    }
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error in getNextDateStr:', error, dateStr);
    return '';
  }
};

// Firebase Timestamp를 YYYY-MM-DD 형식으로 변환
// 데이터는 UTC로 저장, 표시할 때만 로컬 시간으로 변환
export const toYYYYMMDD = (d) => {
  if (!d) return '';
  
  let date;
  
  // Firebase Timestamp 처리
  if (d.toDate && typeof d.toDate === 'function') {
    date = d.toDate();
  } 
  // Firebase serverTimestamp 처리 (seconds 필드가 있는 경우)
  else if (d.seconds) {
    date = new Date(d.seconds * 1000);
  }
  // Date 객체인 경우
  else if (d instanceof Date) {
    date = d;
  }
  // 문자열인 경우
  else if (typeof d === 'string') {
    // 이미 YYYY-MM-DD 형식인지 확인
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return d;
    }
    date = new Date(d);
  }
  // 숫자(timestamp)인 경우
  else if (typeof d === 'number') {
    date = new Date(d);
  }
  else {
    return '';
  }
  
  // 유효한 날짜인지 확인
  if (isNaN(date.getTime())) {
    console.error('Invalid date:', d);
    return '';
  }
  
  // 로컬 시간으로 표시 (브라우저가 자동으로 시간대 처리)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// UTC로 저장하고 로컬 시간으로 표시하는 헬퍼 함수들
export const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  
  let date;
  
  // Firebase Timestamp 처리
  if (timestamp && typeof timestamp === 'object') {
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (typeof timestamp.seconds === 'number') {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    }
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  }
  
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  
  // 로컬 시간으로 표시 (브라우저가 자동으로 시간대 처리)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// 날짜를 UTC ISO 문자열로 저장용 변환
export const toUTCString = (dateStr) => {
  if (!dateStr) return null;
  
  // YYYY-MM-DD 형식을 UTC 날짜로 변환
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  
  return date.toISOString();
};

// UTC 날짜를 로컬 YYYY-MM-DD로 변환
export const fromUTCString = (utcStr) => {
  if (!utcStr) return '';
  
  const date = new Date(utcStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// getNextDateStr 함수는 이미 위에 선언되어 있음 (15번째 줄)

// 전화번호 포맷팅 함수
export const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
};

// 통화 포맷팅 함수
export const formatCurrency = (amount) => {
    if (!amount) return '0';
    return Number(amount).toLocaleString() + '원';
};

// 숫자 포맷팅 함수
export const formatNumber = (num) => {
    if (!num) return '0';
    return Number(num).toLocaleString();
};

// 퍼센티지 포맷팅 함수
export const formatPercentage = (value) => {
    if (!value || isNaN(value)) return '0.0%';
    return Number(value).toFixed(1) + '%';
};

// 전환율 계산 함수
export const calculateConversionRate = (conversions, visitors) => {
    if (!visitors || visitors === 0) return 0;
    return (conversions / visitors) * 100;
};

// ROI 계산 함수
export const calculateROI = (revenue, cost) => {
    if (!cost || cost === 0) return 0;
    return ((revenue - cost) / cost) * 100;
};