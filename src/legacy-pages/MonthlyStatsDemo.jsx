// src/pages/MonthlyStatsDemo.jsx
import React, { useState } from 'react';
import { MonthlyStatsInput } from '../components/MonthlyStats';

const MonthlyStatsDemo = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const months = [
    { value: 1, label: '1월' },
    { value: 2, label: '2월' },
    { value: 3, label: '3월' },
    { value: 4, label: '4월' },
    { value: 5, label: '5월' },
    { value: 6, label: '6월' },
    { value: 7, label: '7월' },
    { value: 8, label: '8월' },
    { value: 9, label: '9월' },
    { value: 10, label: '10월' },
    { value: 11, label: '11월' },
    { value: 12, label: '12월' }
  ];

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ 
        padding: '20px', 
        background: 'white', 
        borderBottom: '1px solid #ddd',
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>월별 통계 입력 데모</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label>년도:</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          
          <label>월:</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>
      </div>
      
      <MonthlyStatsInput year={selectedYear} month={selectedMonth} />
    </div>
  );
};

export default MonthlyStatsDemo;