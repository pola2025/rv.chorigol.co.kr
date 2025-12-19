// 매출 차트 컴포넌트 - 선언형 구조
import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './ChartStyles.css';

// 커스텀 툴팁 (선언형)
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }}>
          {entry.name}: ₩{entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

// 매출 차트 컴포넌트 (순수 함수형)
export const RevenueChart = ({ data, height = 400 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty" style={{ height }}>
        <p>데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">월별 매출 추이</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRoom" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorOption" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={36}
            iconType="rect"
          />
          <Area
            type="monotone"
            dataKey="room"
            stackId="1"
            stroke="#3B82F6"
            fill="url(#colorRoom)"
            name="객실 매출"
          />
          <Area
            type="monotone"
            dataKey="option"
            stackId="1"
            stroke="#8B5CF6"
            fill="url(#colorOption)"
            name="옵션 매출"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// 방문자 차트 컴포넌트 (순수 함수형)
export const VisitorChart = ({ data, height = 400 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty" style={{ height }}>
        <p>데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">월별 방문자 추이</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorWebsite" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorNaver" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={36}
            iconType="rect"
          />
          <Area
            type="monotone"
            dataKey="website"
            stackId="1"
            stroke="#10B981"
            fill="url(#colorWebsite)"
            name="웹사이트"
          />
          <Area
            type="monotone"
            dataKey="naver"
            stackId="1"
            stroke="#F59E0B"
            fill="url(#colorNaver)"
            name="네이버"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default {
  RevenueChart,
  VisitorChart
};
