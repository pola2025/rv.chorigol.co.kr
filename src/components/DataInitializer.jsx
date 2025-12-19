// src/components/DataInitializer.jsx
import React, { useState } from 'react';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import './DataInitializer.css';

const DataInitializer = ({ onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const initializeData = async () => {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const batch = writeBatch(db);
      
      // 1. 객실 데이터
      const roomsData = [
        {
          id: 'forest',
          객실명: 'Forest',
          재고: 1,
          기준인원: 4,
          최대인원: 6,
          추가인원요금: 20000,
          기본요금: 150000,
          order: 1,
          created: new Date(),
          updated: new Date()
        },
        {
          id: 'forest-mini',
          객실명: 'Forest mini',
          재고: 1,
          기준인원: 2,
          최대인원: 4,
          추가인원요금: 20000,
          기본요금: 100000,
          order: 2,
          created: new Date(),
          updated: new Date()
        },
        {
          id: 'forest-family',
          객실명: 'Forest 패밀리',
          재고: 1,
          기준인원: 6,
          최대인원: 10,
          추가인원요금: 20000,
          기본요금: 250000,
          order: 3,
          created: new Date(),
          updated: new Date()
        },
        {
          id: 'forest-mini-family',
          객실명: 'Forest mini 패밀리',
          재고: 1,
          기준인원: 4,
          최대인원: 6,
          추가인원요금: 20000,
          기본요금: 150000,
          order: 4,
          created: new Date(),
          updated: new Date()
        },
        {
          id: 'lakeview',
          객실명: '호수뷰객실',
          재고: 1,
          기준인원: 2,
          최대인원: 4,
          추가인원요금: 25000,
          기본요금: 180000,
          order: 5,
          created: new Date(),
          updated: new Date()
        },
        {
          id: 'group-reservation',
          객실명: '단체예약',
          재고: 5,
          기준인원: 15,
          최대인원: 50,
          추가인원요금: 15000,
          기본요금: 1000000,
          order: 6,
          created: new Date(),
          updated: new Date()
        }
      ];

      // 객실 데이터 추가
      roomsData.forEach(room => {
        const roomRef = doc(db, 'rooms', room.id);
        batch.set(roomRef, room);
      });
      
      setProgress(33);

      // 2. 가격 규칙 데이터
      const pricingRulesData = [
        {
          id: 'weekend-rule',
          name: '주말 요금',
          roomName: 'all',
          dateRange: {
            type: 'weekdays',
            weekdays: [5, 6] // 금, 토
          },
          priceType: 'multiplier',
          priceValue: 1.2,
          priority: 10,
          isActive: true,
          created: new Date()
        },
        {
          id: 'peak-season-summer',
          name: '여름 성수기',
          roomName: 'all',
          dateRange: {
            type: 'date_range',
            startDate: '2025-07-01',
            endDate: '2025-08-31'
          },
          priceType: 'multiplier',
          priceValue: 1.5,
          priority: 20,
          isActive: true,
          created: new Date()
        },
        {
          id: 'peak-season-winter',
          name: '겨울 성수기',
          roomName: 'all',
          dateRange: {
            type: 'date_range',
            startDate: '2025-12-24',
            endDate: '2026-01-02'
          },
          priceType: 'multiplier',
          priceValue: 1.4,
          priority: 20,
          isActive: true,
          created: new Date()
        }
      ];

      // 가격 규칙 추가
      pricingRulesData.forEach(rule => {
        const ruleRef = doc(db, 'pricing_rules', rule.id);
        batch.set(ruleRef, rule);
      });
      
      setProgress(66);

      // 3. 옵션 데이터
      const optionsData = [
        {
          id: 'camping_burner',
          name: '캐핑버너&그릴',
          type: 'service',
          price: 20000,
          description: '호수뷰객실 제외, 객실 요금에 포함',
          isActive: true,
          order: 1,
          created: new Date()
        },
        {
          id: 'charcoal_bbq',
          name: '숯불바베큐',
          type: 'service',
          price: 30000,
          description: '현장 결제',
          isActive: true,
          order: 2,
          created: new Date()
        },
        {
          id: 'late_checkout',
          name: '레이트 체크아웃',
          type: 'service',
          price: 0,
          description: 'Forest, Forest mini 객실만 가능 (14:00까지)',
          isActive: true,
          order: 3,
          created: new Date()
        }
      ];

      // 옵션 추가
      optionsData.forEach(option => {
        const optionRef = doc(db, 'options', option.id);
        batch.set(optionRef, option);
      });

      // 배치 커밋
      await batch.commit();
      
      setProgress(100);
      setTimeout(() => {
        alert('초호수뷰펜션 데이터가 성공적으로 초기화되었습니다!');
        if (onComplete) onComplete();
      }, 500);

    } catch (err) {
      console.error('데이터 초기화 오류:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="data-initializer">
      <div className="initializer-card">
        <h2>초호수뷰펜션 데이터 초기화</h2>
        <p>아래 버튼을 클릭하여 초기 데이터를 설정하세요.</p>
        
        <div className="data-preview">
          <h3>초기화될 데이터:</h3>
          <ul>
            <li>객실 6개 (Forest, Forest mini, Forest 패밀리 등)</li>
            <li>가격 규칙 3개 (주말 요금, 성수기 요금)</li>
            <li>옵션 3개 (캐핑버너, 숯불바베큐, 레이트체크아웃)</li>
          </ul>
        </div>

        {error && (
          <div className="error-message">
            오류: {error}
          </div>
        )}

        {isLoading && (
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <button 
          onClick={initializeData}
          disabled={isLoading}
          className="btn-initialize"
        >
          {isLoading ? '초기화 중...' : '데이터 초기화 시작'}
        </button>
      </div>
    </div>
  );
};

export default DataInitializer;