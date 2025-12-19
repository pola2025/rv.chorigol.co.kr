// src/components/marketing-v2/RevenueTab.jsx
import React from 'react';
import './RevenueTab.css';

const RevenueTab = ({ data, businessType, isEditMode, updateData }) => {
  const roomTypes = businessType === 'pension' 
    ? [
        { key: 'forest', label: 'Forest' },
        { key: 'forestFamily', label: 'Forest 패밀리' },
        { key: 'forestMini', label: 'Forest mini' },
        { key: 'forestMiniFamily', label: 'Forest mini 패밀리' }
      ]
    : [
        { key: 'lakeView', label: '호수뷰객실' },
        { key: 'group', label: '단체&야유회' }
      ];
  
  const handleInputChange = (path, value) => {
    // 숫자 입력 처리
    const numValue = value.replace(/[^0-9]/g, '');
    updateData(path, numValue ? parseInt(numValue) : 0);
  };
  
  const formatNumber = (num) => {
    return (num || 0).toLocaleString();
  };
  
  return (
    <div className="revenue-tab">
      <h3>매출 통계 - {businessType === 'pension' ? '초호펜션' : '초호쉼터'}</h3>
      
      <div className="revenue-summary">
        <div className="summary-row">
          <label>총 매출</label>
          {isEditMode ? (
            <input
              type="text"
              value={data.total || ''}
              onChange={(e) => handleInputChange('revenue.total', e.target.value)}
              placeholder="0"
            />
          ) : (
            <span className="value">{formatNumber(data.total)}원</span>
          )}
        </div>
        
        <div className="summary-row">
          <label>예약 건수</label>
          {isEditMode ? (
            <input
              type="text"
              value={data.reservationCount || ''}
              onChange={(e) => handleInputChange('revenue.reservationCount', e.target.value)}
              placeholder="0"
            />
          ) : (
            <span className="value">{formatNumber(data.reservationCount)}건</span>
          )}
        </div>
      </div>
      
      <div className="room-revenue">
        <h4>객실별 매출</h4>
        <div className="room-list">
          {roomTypes.map(room => (
            <div key={room.key} className="room-row">
              <label>{room.label}</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={data.byRoom?.[room.key] || ''}
                  onChange={(e) => handleInputChange(`revenue.byRoom.${room.key}`, e.target.value)}
                  placeholder="0"
                />
              ) : (
                <span className="value">{formatNumber(data.byRoom?.[room.key])}원</span>
              )}
            </div>
          ))}
        </div>
        
        {/* 객실별 매출 합계 */}
        <div className="room-total">
          <label>객실 매출 합계</label>
          <span className="value">
            {formatNumber(
              roomTypes.reduce((sum, room) => sum + (data.byRoom?.[room.key] || 0), 0)
            )}원
          </span>
        </div>
      </div>
    </div>
  );
};

export default RevenueTab;