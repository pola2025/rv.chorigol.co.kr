// src/components/marketing-v2/AdvertisingTab.jsx
import React, { useState, useEffect } from 'react';
import './AdvertisingTab.css';

const AdvertisingTab = ({ data, isEditMode, updateData, currentMonth }) => {
  const [channels, setChannels] = useState(data.channels || []);
  
  useEffect(() => {
    setChannels(data.channels || []);
  }, [data.channels]);
  
  // 채널 추가
  const addChannel = () => {
    if (!isEditMode) return;
    const newChannel = {
      id: `ch_${Date.now()}`,
      name: '',
      clicks: 0,
      impressions: 0,
      cost: 0,
      campaigns: []
    };
    const newChannels = [...channels, newChannel];
    setChannels(newChannels);
    updateData('advertising.channels', newChannels);
  };
  
  // 채널 삭제
  const removeChannel = (channelId) => {
    if (!isEditMode) return;
    const newChannels = channels.filter(ch => ch.id !== channelId);
    setChannels(newChannels);
    updateData('advertising.channels', newChannels);
  };
  
  // 채널 데이터 업데이트
  const updateChannel = (channelId, field, value) => {
    if (!isEditMode) return;
    const numValue = field !== 'name' ? parseInt(value.replace(/[^0-9]/g, '') || 0) : value;
    const newChannels = channels.map(ch => {
      if (ch.id === channelId) {
        return { ...ch, [field]: numValue };
      }
      return ch;
    });
    setChannels(newChannels);
    updateData('advertising.channels', newChannels);
  };
  
  // 캠페인 추가
  const addCampaign = (channelId) => {
    if (!isEditMode) return;
    const newChannels = channels.map(ch => {
      if (ch.id === channelId) {
        const newCampaign = {
          id: `camp_${Date.now()}`,
          name: '',
          clicks: 0,
          impressions: 0,
          cost: 0
        };
        return {
          ...ch,
          campaigns: [...(ch.campaigns || []), newCampaign]
        };
      }
      return ch;
    });
    setChannels(newChannels);
    updateData('advertising.channels', newChannels);
  };
  
  // 캠페인 삭제
  const removeCampaign = (channelId, campaignId) => {
    if (!isEditMode) return;
    const newChannels = channels.map(ch => {
      if (ch.id === channelId) {
        return {
          ...ch,
          campaigns: ch.campaigns.filter(camp => camp.id !== campaignId)
        };
      }
      return ch;
    });
    setChannels(newChannels);
    updateData('advertising.channels', newChannels);
  };
  
  // 캠페인 데이터 업데이트
  const updateCampaign = (channelId, campaignId, field, value) => {
    if (!isEditMode) return;
    const numValue = field !== 'name' ? parseInt(value.replace(/[^0-9]/g, '') || 0) : value;
    const newChannels = channels.map(ch => {
      if (ch.id === channelId) {
        return {
          ...ch,
          campaigns: ch.campaigns.map(camp => {
            if (camp.id === campaignId) {
              return { ...camp, [field]: numValue };
            }
            return camp;
          })
        };
      }
      return ch;
    });
    setChannels(newChannels);
    updateData('advertising.channels', newChannels);
  };
  
  const formatNumber = (num) => {
    return (num || 0).toLocaleString();
  };
  
  // 통합 성과 계산
  const totalClicks = channels.reduce((sum, ch) => sum + (ch.clicks || 0), 0);
  const totalImpressions = channels.reduce((sum, ch) => sum + (ch.impressions || 0), 0);
  const totalCost = channels.reduce((sum, ch) => sum + (ch.cost || 0), 0);
  const avgCPC = totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
  
  return (
    <div className="advertising-tab">
      <h3>광고 통계</h3>
      
      {isEditMode && (
        <button onClick={addChannel} className="btn-add-channel">
          + 광고 채널 추가
        </button>
      )}
      
      <div className="channels-list">
        {channels.map(channel => (
          <div key={channel.id} className="channel-item">
            <div className="channel-header">
              {isEditMode ? (
                <input
                  type="text"
                  value={channel.name}
                  onChange={(e) => updateChannel(channel.id, 'name', e.target.value)}
                  placeholder="채널명 입력 (예: 네이버, 구글, Meta)"
                  className="channel-name-input"
                />
              ) : (
                <h4>{channel.name || '채널명 없음'}</h4>
              )}
              {isEditMode && (
                <button 
                  onClick={() => removeChannel(channel.id)} 
                  className="btn-remove"
                >
                  삭제
                </button>
              )}
            </div>
            
            <div className="channel-metrics">
              <div className="metric-row">
                <label>클릭</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={channel.clicks || ''}
                    onChange={(e) => updateChannel(channel.id, 'clicks', e.target.value)}
                    placeholder="0"
                  />
                ) : (
                  <span>{formatNumber(channel.clicks)} 회</span>
                )}
              </div>
              <div className="metric-row">
                <label>노출</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={channel.impressions || ''}
                    onChange={(e) => updateChannel(channel.id, 'impressions', e.target.value)}
                    placeholder="0"
                  />
                ) : (
                  <span>{formatNumber(channel.impressions)} 회</span>
                )}
              </div>
              <div className="metric-row">
                <label>광고비</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={channel.cost || ''}
                    onChange={(e) => updateChannel(channel.id, 'cost', e.target.value)}
                    placeholder="0"
                  />
                ) : (
                  <span>{formatNumber(channel.cost)} 원</span>
                )}
              </div>
            </div>
            
            {/* 캠페인 상세 */}
            <div className="campaigns-section">
              <div className="campaigns-header">
                <h5>캠페인 상세</h5>
                {isEditMode && (
                  <button 
                    onClick={() => addCampaign(channel.id)} 
                    className="btn-add-campaign"
                  >
                    + 캠페인 추가
                  </button>
                )}
              </div>
              
              {channel.campaigns && channel.campaigns.length > 0 ? (
                <div className="campaigns-list">
                  {channel.campaigns.map(campaign => (
                    <div key={campaign.id} className="campaign-item">
                      {isEditMode ? (
                        <>
                          <input
                            type="text"
                            value={campaign.name}
                            onChange={(e) => updateCampaign(channel.id, campaign.id, 'name', e.target.value)}
                            placeholder="캠페인명"
                            className="campaign-name"
                          />
                          <input
                            type="text"
                            value={campaign.clicks || ''}
                            onChange={(e) => updateCampaign(channel.id, campaign.id, 'clicks', e.target.value)}
                            placeholder="클릭"
                            className="campaign-metric"
                          />
                          <input
                            type="text"
                            value={campaign.impressions || ''}
                            onChange={(e) => updateCampaign(channel.id, campaign.id, 'impressions', e.target.value)}
                            placeholder="노출"
                            className="campaign-metric"
                          />
                          <input
                            type="text"
                            value={campaign.cost || ''}
                            onChange={(e) => updateCampaign(channel.id, campaign.id, 'cost', e.target.value)}
                            placeholder="비용"
                            className="campaign-metric"
                          />
                          <button 
                            onClick={() => removeCampaign(channel.id, campaign.id)}
                            className="btn-remove-campaign"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="campaign-name">{campaign.name || '-'}</span>
                          <span>클릭: {formatNumber(campaign.clicks)}</span>
                          <span>노출: {formatNumber(campaign.impressions)}</span>
                          <span>비용: {formatNumber(campaign.cost)}원</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                !isEditMode && <div className="no-campaigns">캠페인 없음</div>
              )}
            </div>
          </div>
        ))}
        
        {channels.length === 0 && !isEditMode && (
          <div className="no-channels">
            등록된 광고 채널이 없습니다.
          </div>
        )}
      </div>
      
      {/* 통합 성과 */}
      <div className="total-performance">
        <h4>통합 성과</h4>
        <div className="performance-grid">
          <div className="performance-item">
            <label>총 클릭</label>
            <span>{formatNumber(totalClicks)} 회</span>
          </div>
          <div className="performance-item">
            <label>총 노출</label>
            <span>{formatNumber(totalImpressions)} 회</span>
          </div>
          <div className="performance-item">
            <label>총 광고비</label>
            <span>{formatNumber(totalCost)} 원</span>
          </div>
          <div className="performance-item">
            <label>평균 CPC</label>
            <span>{formatNumber(avgCPC)} 원</span>
          </div>
          <div className="performance-item">
            <label>CTR</label>
            <span>{ctr}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvertisingTab;