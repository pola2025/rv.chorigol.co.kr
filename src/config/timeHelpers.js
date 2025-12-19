// src/config/timeHelpers.js
// 타임스탬프 처리 3대 원칙을 준수하는 시간 처리 헬퍼 함수들

import { serverTimestamp } from "firebase/firestore";

/**
 * 시간 처리 헬퍼 함수 모음
 * 원칙 1: 데이터 저장/처리는 UTC
 * 원칙 2: 사용자 표시는 로컬 시간
 * 원칙 3: API는 ISO 8601 표준
 */
export const timeHelpers = {
    /**
     * Firebase 서버 타임스탬프 반환 (항상 UTC)
     * @returns {FieldValue} Firestore serverTimestamp
     */
    getServerTimestamp: () => serverTimestamp(),
    
    /**
     * 현재 UTC 시간을 ISO 8601 형식으로 반환
     * @returns {string} 예: "2025-08-05T09:00:00.000Z"
     */
    getNowUTC: () => {
        return new Date().toISOString();
    },
    
    /**
     * Firebase Timestamp를 ISO 8601 UTC 문자열로 변환
     * @param {Timestamp|Object|string|Date} timestamp - 변환할 타임스탬프
     * @returns {string|null} ISO 8601 형식 문자열 또는 null
     */
    timestampToUTC: (timestamp) => {
        if (!timestamp) return null;
        
        // Firestore Timestamp 객체
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toISOString();
        }
        
        // seconds/nanoseconds 형태
        if (timestamp.seconds !== undefined) {
            return new Date(timestamp.seconds * 1000).toISOString();
        }
        
        // 이미 ISO 문자열인 경우
        if (typeof timestamp === 'string') {
            return new Date(timestamp).toISOString();
        }
        
        // Date 객체인 경우
        if (timestamp instanceof Date) {
            return timestamp.toISOString();
        }
        
        return null;
    },
    
    /**
     * UTC를 로컬 시간으로 변환 (사용자 표시용)
     * @param {string} utcString - UTC ISO 8601 문자열
     * @param {string} locale - 로케일 (기본값: 'ko-KR')
     * @param {string} timeZone - 시간대 (기본값: 'Asia/Seoul')
     * @returns {string} 포맷된 로컬 시간 문자열
     */
    utcToLocal: (utcString, locale = 'ko-KR', timeZone = 'Asia/Seoul') => {
        if (!utcString) return '';
        
        try {
            const date = new Date(utcString);
            
            // Invalid Date 체크
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', utcString);
                return '';
            }
            
            // 날짜와 시간 포맷
            const dateOptions = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                timeZone
            };
            
            const timeOptions = {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone,
                hour12: false
            };
            
            const dateStr = date.toLocaleDateString(locale, dateOptions);
            const timeStr = date.toLocaleTimeString(locale, timeOptions);
            
            return `${dateStr} ${timeStr}`;
        } catch (error) {
            console.error('Date conversion error:', error, utcString);
            return '';
        }
    },
    
    /**
     * 로컬 날짜를 UTC 날짜로 변환 (YYYY-MM-DD 형식 유지)
     * @param {string} localDateStr - YYYY-MM-DD 형식의 날짜
     * @returns {string} UTC ISO 8601 문자열
     */
    localDateToUTC: (localDateStr) => {
        if (!localDateStr) return '';
        
        // 날짜만 처리할 때는 시간을 00:00:00 UTC로 설정
        return `${localDateStr}T00:00:00.000Z`;
    },
    
    /**
     * UTC를 로컬 날짜 문자열로 변환 (YYYY-MM-DD)
     * @param {string} utcString - UTC ISO 8601 문자열
     * @param {string} timeZone - 시간대 (기본값: 'Asia/Seoul')
     * @returns {string} YYYY-MM-DD 형식의 날짜
     */
    utcToLocalDate: (utcString, timeZone = 'Asia/Seoul') => {
        if (!utcString) return '';
        
        try {
            const date = new Date(utcString);
            
            // Invalid Date 체크
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', utcString);
                return '';
            }
            
            const options = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                timeZone
            };
            
            // en-CA 로케일은 YYYY-MM-DD 형식을 반환
            return date.toLocaleDateString('en-CA', options);
        } catch (error) {
            console.error('Date conversion error:', error, utcString);
            return '';
        }
    },
    
    /**
     * 상대 시간 표시 (예: 2시간 전, 3일 전)
     * @param {string} utcString - UTC ISO 8601 문자열
     * @param {string} locale - 로케일 (기본값: 'ko-KR')
     * @returns {string} 상대 시간 문자열
     */
    getRelativeTime: (utcString, locale = 'ko-KR') => {
        if (!utcString) return '';
        
        try {
            const date = new Date(utcString);
            const now = new Date();
            
            // Invalid Date 체크
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', utcString);
                return '';
            }
            
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);
            
            if (diffSec < 0) return '미래';
            if (diffSec < 60) return '방금 전';
            if (diffMin < 60) return `${diffMin}분 전`;
            if (diffHour < 24) return `${diffHour}시간 전`;
            if (diffDay < 7) return `${diffDay}일 전`;
            if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
            if (diffDay < 365) return `${Math.floor(diffDay / 30)}개월 전`;
            
            // 1년 이상이면 날짜 표시
            return timeHelpers.utcToLocal(utcString, locale);
        } catch (error) {
            console.error('Relative time error:', error, utcString);
            return '';
        }
    },
    
    /**
     * 날짜만 표시 (시간 제외)
     * @param {string} utcString - UTC ISO 8601 문자열
     * @param {string} locale - 로케일 (기본값: 'ko-KR')
     * @param {string} timeZone - 시간대 (기본값: 'Asia/Seoul')
     * @returns {string} 포맷된 날짜 문자열
     */
    formatDate: (utcString, locale = 'ko-KR', timeZone = 'Asia/Seoul') => {
        if (!utcString) return '';
        
        try {
            const date = new Date(utcString);
            
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', utcString);
                return '';
            }
            
            return date.toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone
            });
        } catch (error) {
            console.error('Date format error:', error, utcString);
            return '';
        }
    },
    
    /**
     * 시간만 표시 (날짜 제외)
     * @param {string} utcString - UTC ISO 8601 문자열
     * @param {string} locale - 로케일 (기본값: 'ko-KR')
     * @param {string} timeZone - 시간대 (기본값: 'Asia/Seoul')
     * @returns {string} 포맷된 시간 문자열
     */
    formatTime: (utcString, locale = 'ko-KR', timeZone = 'Asia/Seoul') => {
        if (!utcString) return '';
        
        try {
            const date = new Date(utcString);
            
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', utcString);
                return '';
            }
            
            return date.toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
                timeZone,
                hour12: false
            });
        } catch (error) {
            console.error('Time format error:', error, utcString);
            return '';
        }
    }
};

export default timeHelpers;