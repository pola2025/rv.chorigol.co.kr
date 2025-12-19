// src/components/marketing-v2/VisitorsTab.jsx
import React, { useState, useEffect } from 'react';
import './VisitorsTab.css';

const VisitorsTab = ({ data, isEditMode, updateData }) => {
  // 기본 채널 구조
  const defaultChannels = [
    { name: "검색", count: 0 },
    { name: "지도", count: 0 },
    { name: "추천", count: 0 },
    { name: "광고", count: 0 },
    { name: "기타", count: 0 }
  ];

  // 채널 데이터 초기화
  const [channels, setChannels] = useState(
    data.naverPlace?.channels?.length > 0 
      ? data.naverPlace.channels 
      : defaultChannels
  );

  // data가 변경될 때 channels 업데이트
  useEffect(() => {
    if (data.naverPlace?.channels?.length > 0) {
      setChannels(data.naverPlace.channels);
    }
  }, [data.naverPlace?.channels]);

  const handleInputChange = (path, value) => {
    const numValue = value.replace(/[^0-9]/g, '');
    updateData(path, numValue ? parseInt(numValue) : 0);
  };
  
  const formatNumber = (num) => {
    return (num || 0).toLocaleString();
  };
  
  // 채널 이름 변경
  const handleChannelNameChange = (index, value) => {
    if (!isEditMode) return;
    const newChannels = [...channels];
    newChannels[index] = { ...newChannels[index], name: value };
    setChannels(newChannels);
    updateData('visitors.naverPlace.channels', newChannels);
  };
  
  // 채널 수치 변경
  const handleChannelCountChange = (index, value) => {
    if (!isEditMode) return;
    const newChannels = [...channels];
    newChannels[index] = { 
      ...newChannels[index], 
      count: parseInt(value.replace(/[^0-9]/g, '') || 0) 
    };
    setChannels(newChannels);
    updateData('visitors.naverPlace.channels', newChannels);
  };

  // 채널 추가
  const addChannel = () => {
    if (!isEditMode || channels.length >= 10) return;
    const newChannels = [...channels, { name: "", count: 0 }];
    setChannels(newChannels);
    updateData('visitors.naverPlace.channels', newChannels);
  };

  // 채널 삭제
  const removeChannel = (index) => {
    if (!isEditMode || channels.length <= 1) return;
    const newChannels = channels.filter((_, i) => i !== index);
    setChannels(newChannels);
    updateData('visitors.naverPlace.channels', newChannels);
  };
  
  return (
    <div className="visitors-tab">
      <h3>방문 통계</h3>
      
      {/* 홈페이지 통계 */}
      <div className="website-stats">
        <h4>홈페이지 통계</h4>
        <div className="stats-grid">
          <div className="stat-row">
            <label>방문자 수</label>
            {isEditMode ? (
              <input
                type="text"
                value={data.website?.visitors || ''}
                onChange={(e) => handleInputChange('visitors.website.visitors', e.target.value)}
                placeholder="0"
              />
            ) : (
              <span className="value">{formatNumber(data.website?.visitors)}명</span>
            )}
          </div>
          
          <div className="stat-row">
            <label>페이지뷰</label>
            {isEditMode ? (
              <input
                type="text"
                value={data.website?.pageViews || ''}
                onChange={(e) => handleInputChange('visitors.website.pageViews', e.target.value)}
                placeholder="0"
              />
            ) : (
              <span className="value">{formatNumber(data.website?.pageViews)}회</span>
            )}
          </div>
        </div>
      </div>
      
      {/* 네이버 플레이스 통계 */}
      <div className="naver-stats">
        <h4>네이버 플레이스 통계</h4>
        
        <div className="stats-grid">
          {/* 플레이스 유입 */}
          <div className="stat-row">
            <label>플레이스 유입</label>
            {isEditMode ? (
              <input
                type="text"
                value={data.naverPlace?.placeVisits || ''}
                onChange={(e) => handleInputChange('visitors.naverPlace.placeVisits', e.target.value)}
                placeholder="0"
              />
            ) : (
              <span className="value">{formatNumber(data.naverPlace?.placeVisits)}회</span>
            )}
          </div>
          
          {/* 예약 주문 신청 */}
          <div className="stat-row">
            <label>예약 주문 신청</label>
            {isEditMode ? (
              <input
                type="text"
                value={data.naverPlace?.reservationRequests || ''}
                onChange={(e) => handleInputChange('visitors.naverPlace.reservationRequests', e.target.value)}
                placeholder="0"
              />
            ) : (
              <span className="value">{formatNumber(data.naverPlace?.reservationRequests)}건</span>
            )}
          </div>
          
          {/* 리뷰 */}
          <div className="stat-row">
            <label>리뷰</label>
            {isEditMode ? (
              <input
                type="text"
                value={data.naverPlace?.reviews || ''}
                onChange={(e) => handleInputChange('visitors.naverPlace.reviews', e.target.value)}
                placeholder="0"
              />
            ) : (
              <span className="value">{formatNumber(data.naverPlace?.reviews)}개</span>
            )}
          </div>
        </div>
        
        <div className="channel-breakdown">
          <div className="channel-header">
            <h5>유입 채널</h5>
            {isEditMode && channels.length < 10 && (
              <button onClick={addChannel} className="btn-add-channel">
                + 채널 추가
              </button>
            )}
          </div>
          
          <div className="channel-list">
            {channels.map((channel, index) => (
              <div 
                key={index} 
                className={`channel-row ${isEditMode ? 'editing' : ''}`}
              >
                <span className="rank">{index + 1}.</span>
                {isEditMode ? (
                  <>
                    <input
                      type="text"
                      className="channel-name-input"
                      value={channel.name || ''}
                      onChange={(e) => handleChannelNameChange(index, e.target.value)}
                      placeholder="채널명 입력"
                    />
                    <input
                      type="text"
                      className="channel-count-input"
                      value={channel.count || ''}
                      onChange={(e) => handleChannelCountChange(index, e.target.value)}
                      placeholder="0"
                    />
                    {channels.length > 1 && (
                      <button 
                        onClick={() => removeChannel(index)} 
                        className="btn-remove-channel"
                        title="채널 삭제"
                      >
                        ×
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="channel-name">{channel.name || '(채널명 없음)'}</span>
                    <span className="value">{formatNumber(channel.count)}명</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 전체 통계 요약 */}
      <div className="total-visitors">
        <h4>전체 유입 통계</h4>
        <div className="total-value">
          {formatNumber(
            (data.website?.visitors || 0) + (data.naverPlace?.placeVisits || 0)
          )}명
        </div>
        <div className="total-breakdown">
          <span>웹사이트: {formatNumber(data.website?.visitors || 0)}명</span>
          <span> | </span>
          <span>네이버 플레이스: {formatNumber(data.naverPlace?.placeVisits || 0)}회</span>
          <span> | </span>
          <span>예약 신청: {formatNumber(data.naverPlace?.reservationRequests || 0)}건</span>
          <span> | </span>
          <span>리뷰: {formatNumber(data.naverPlace?.reviews || 0)}개</span>
        </div>
      </div>
    </div>
  );
};

export default VisitorsTab;