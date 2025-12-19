import React from 'react';
import './StatisticsCard.css';

interface StatData {
  label: string;
  value: number | string;
  unit?: string;
  type?: 'check-in' | 'check-out' | 'new' | 'revenue';
}

interface StatisticsCardProps {
  date?: Date;
  stats: StatData[];
  period?: 'today' | 'week' | 'month';
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ 
  date = new Date(), 
  stats,
  period = 'today' 
}) => {
  const formatDate = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}/${day} (${weekDay})`;
  };

  const getPeriodLabel = () => {
    switch(period) {
      case 'today':
        return `오늘 ${formatDate(date)}`;
      case 'week':
        return '이번 주';
      case 'month':
        return '이번 달';
      default:
        return formatDate(date);
    }
  };

  const getIcon = (type?: string) => {
    switch(type) {
      case 'check-in':
        return '↓';
      case 'check-out':
        return '↑';
      case 'new':
        return '+';
      case 'revenue':
        return '₩';
      default:
        return '';
    }
  };

  const formatValue = (value: number | string, unit?: string) => {
    if (typeof value === 'number' && unit === '원') {
      // 만원 단위로 변환
      if (value >= 10000) {
        const inManWon = Math.floor(value / 10000);
        return `${inManWon.toLocaleString()}만원`;
      }
      return `${value.toLocaleString()}원`;
    }
    return `${value}${unit || ''}`;
  };

  return (
    <div className="statistics-card">
      <div className="statistics-header">
        <span className="period-label">📅 {getPeriodLabel()}</span>
      </div>
      <div className="statistics-content">
        {stats.map((stat, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="divider">|</span>}
            <div className="stat-item">
              <span className="stat-label">
                {stat.label}
              </span>
              <span className="stat-value">
                {getIcon(stat.type)} {formatValue(stat.value, stat.unit)}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default StatisticsCard;