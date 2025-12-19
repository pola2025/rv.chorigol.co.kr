import React, { useState } from 'react';
import StatisticsCard from '../components/statistics/StatisticsCard';

const StatisticsCardDemo = () => {
  const [period, setPeriod] = useState('today');

  // 더미 데이터
  const mockStats = {
    today: [
      { label: '체크인', value: 3, type: 'check-in' },
      { label: '체크아웃', value: 2, type: 'check-out' },
      { label: '신규', value: 5, type: 'new' },
      { label: '매출', value: 1800000, unit: '원', type: 'revenue' }
    ],
    week: [
      { label: '체크인', value: 21, type: 'check-in' },
      { label: '체크아웃', value: 18, type: 'check-out' },
      { label: '신규', value: 32, type: 'new' },
      { label: '매출', value: 12600000, unit: '원', type: 'revenue' }
    ],
    month: [
      { label: '체크인', value: 87, type: 'check-in' },
      { label: '체크아웃', value: 82, type: 'check-out' },
      { label: '신규', value: 145, type: 'new' },
      { label: '매출', value: 52300000, unit: '원', type: 'revenue' }
    ]
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '20px' }}>통계 카드 데모</h1>
      
      {/* 기간 선택 버튼 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setPeriod('today')}
          style={{
            padding: '8px 16px',
            backgroundColor: period === 'today' ? '#3b82f6' : '#fff',
            color: period === 'today' ? '#fff' : '#000',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          오늘
        </button>
        <button 
          onClick={() => setPeriod('week')}
          style={{
            padding: '8px 16px',
            backgroundColor: period === 'week' ? '#3b82f6' : '#fff',
            color: period === 'week' ? '#fff' : '#000',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          이번 주
        </button>
        <button 
          onClick={() => setPeriod('month')}
          style={{
            padding: '8px 16px',
            backgroundColor: period === 'month' ? '#3b82f6' : '#fff',
            color: period === 'month' ? '#fff' : '#000',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          이번 달
        </button>
      </div>

      {/* 통계 카드 */}
      <div style={{ marginBottom: '20px' }}>
        <StatisticsCard 
          date={new Date()} 
          stats={mockStats[period]}
          period={period}
        />
      </div>

      {/* 설명 */}
      <div style={{ 
        backgroundColor: '#fff', 
        padding: '20px', 
        borderRadius: '8px',
        marginTop: '30px'
      }}>
        <h2 style={{ marginBottom: '15px' }}>특징</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li>✅ 컴팩트한 36px 높이</li>
          <li>✅ 명확한 날짜 기준 표시</li>
          <li>✅ 아이콘으로 직관적인 구분</li>
          <li>✅ 만원 단위 자동 변환</li>
          <li>✅ 반응형 디자인 (모바일 대응)</li>
        </ul>

        <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>데이터 구조</h3>
        <pre style={{ 
          backgroundColor: '#f9fafb', 
          padding: '15px', 
          borderRadius: '6px',
          fontSize: '13px',
          overflow: 'auto'
        }}>
{`stats: [
  { label: '체크인', value: 3, type: 'check-in' },
  { label: '체크아웃', value: 2, type: 'check-out' },
  { label: '신규', value: 5, type: 'new' },
  { label: '매출', value: 1800000, unit: '원', type: 'revenue' }
]`}
        </pre>
      </div>
    </div>
  );
};

export default StatisticsCardDemo;