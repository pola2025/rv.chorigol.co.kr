// ROAS 차트 컴포넌트 - 선언형 구조
import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import './ChartStyles.css';

// ROAS 라인 차트 (선언형)
export const ROASChart = ({ data, height = 300 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty" style={{ height }}>
        <p>ROAS 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">ROAS 추이</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <ReferenceLine y={1} stroke="#EF4444" strokeDasharray="5 5" />
          <Line
            type="monotone"
            dataKey="roas"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: '#3B82F6', r: 4 }}
            activeDot={{ r: 6 }}
            name="ROAS"
          />
          <Line
            type="monotone"
            dataKey="conversion"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', r: 4 }}
            yAxisId="right"
            name="전환율(%)"
          />
          <YAxis yAxisId="right" orientation="right" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// 광고 효율 차트 (선언형)
export const AdEfficiencyChart = ({ data, height = 300 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty" style={{ height }}>
        <p>광고 효율 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">광고비 대비 매출</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis 
            yAxisId="left" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip 
            formatter={(value, name) => {
              if (name === '효율') return `${value}%`;
              return `₩${value.toLocaleString()}`;
            }}
          />
          <Legend />
          <Bar 
            yAxisId="left" 
            dataKey="revenue" 
            fill="#3B82F6" 
            name="매출"
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            yAxisId="left" 
            dataKey="adSpend" 
            fill="#EF4444" 
            name="광고비"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="efficiency"
            stroke="#10B981"
            strokeWidth={2}
            name="효율"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default {
  ROASChart,
  AdEfficiencyChart
};
