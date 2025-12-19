// src/components/marketing/AdDataInput.jsx
import React, { useState, useEffect } from 'react';
import './AdDataInput.css';

const AdDataInput = ({ platform, selectedMonth, existingData, onClose, onSave }) => {
  const [totalData, setTotalData] = useState({});
  const [campaignData, setCampaignData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 기존 데이터가 있으면 불러오기
    if (existingData) {
      setTotalData(existingData.total || {});
      setCampaignData(existingData.campaigns || {});
    } else {
      // 초기화
      const initialTotal = {};
      platform.metrics.forEach(metric => {
        initialTotal[metric] = '';
      });
      setTotalData(initialTotal);

      if (platform.campaigns?.length > 0) {
        const initialCampaigns = {};
        platform.campaigns.forEach(campaign => {
          initialCampaigns[campaign] = {};
          platform.metrics.forEach(metric => {
            initialCampaigns[campaign][metric] = '';
          });
        });
        setCampaignData(initialCampaigns);
      }
    }
  }, [platform, existingData]);

  const handleTotalChange = (metric, value) => {
    // 숫자만 입력 가능하도록
    const numValue = value.replace(/[^0-9]/g, '');
    setTotalData({
      ...totalData,
      [metric]: numValue ? parseInt(numValue) : ''
    });
  };

  const handleCampaignChange = (campaign, metric, value) => {
    const numValue = value.replace(/[^0-9]/g, '');
    setCampaignData({
      ...campaignData,
      [campaign]: {
        ...campaignData[campaign],
        [metric]: numValue ? parseInt(numValue) : ''
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // 데이터 정리
    const cleanedTotal = {};
    Object.entries(totalData).forEach(([key, value]) => {
      if (value !== '') {
        cleanedTotal[key] = parseInt(value);
      }
    });

    const cleanedCampaigns = {};
    Object.entries(campaignData).forEach(([campaign, metrics]) => {
      cleanedCampaigns[campaign] = {};
      Object.entries(metrics).forEach(([key, value]) => {
        if (value !== '') {
          cleanedCampaigns[campaign][key] = parseInt(value);
        }
      });
    });

    const data = {
      total: cleanedTotal,
      campaigns: platform.campaigns?.length > 0 ? cleanedCampaigns : {}
    };

    const success = await onSave(data);
    if (success) {
      onClose();
    }
    setIsSaving(false);
  };

  const formatMonth = (year, month) => {
    return `${year}년 ${month}월`;
  };

  const getMetricLabel = (metric) => {
    const labels = {
      impressions: '노출수',
      clicks: '클릭수',
      cost: '비용',
      conversions: '전환수',
      reach: '도달수'
    };
    return labels[metric] || metric;
  };

  const formatInputValue = (value) => {
    if (value === '' || value === undefined) return '';
    return value.toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="data-input-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            📝 {platform.name} - {formatMonth(selectedMonth.year, selectedMonth.month)} 데이터 입력
          </h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="modal-body">
          {/* 전체 성과 입력 */}
          <div className="input-section">
            <h4>전체 성과</h4>
            <div className="input-grid">
              {platform.metrics.map(metric => (
                <div key={metric} className="input-group">
                  <label>{getMetricLabel(metric)}</label>
                  <input
                    type="text"
                    value={formatInputValue(totalData[metric])}
                    onChange={(e) => handleTotalChange(metric, e.target.value)}
                    placeholder={metric === 'cost' ? '예: 1,234,567' : '예: 45,678'}
                  />
                  {metric === 'cost' && <span className="unit">원</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 세부 캠페인 입력 */}
          {platform.campaigns?.length > 0 && (
            <div className="input-section">
              <h4>세부 캠페인</h4>
              {platform.campaigns.map(campaign => (
                <div key={campaign} className="campaign-section">
                  <h5>{campaign}</h5>
                  <div className="input-grid">
                    {platform.metrics.map(metric => (
                      <div key={metric} className="input-group">
                        <label>{getMetricLabel(metric)}</label>
                        <input
                          type="text"
                          value={formatInputValue(campaignData[campaign]?.[metric])}
                          onChange={(e) => handleCampaignChange(campaign, metric, e.target.value)}
                          placeholder={metric === 'cost' ? '예: 567,890' : '예: 23,456'}
                        />
                        {metric === 'cost' && <span className="unit">원</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 자동 계산 미리보기 */}
          {(totalData.impressions > 0 || totalData.clicks > 0) && (
            <div className="preview-section">
              <h4>💡 자동 계산 지표 (미리보기)</h4>
              <div className="preview-metrics">
                {totalData.impressions > 0 && totalData.clicks > 0 && (
                  <div className="metric">
                    <span>CTR</span>
                    <strong>
                      {((totalData.clicks / totalData.impressions) * 100).toFixed(2)}%
                    </strong>
                  </div>
                )}
                {totalData.clicks > 0 && totalData.cost > 0 && (
                  <div className="metric">
                    <span>CPC</span>
                    <strong>
                      {Math.round(totalData.cost / totalData.clicks).toLocaleString()}원
                    </strong>
                  </div>
                )}
                {totalData.impressions > 0 && totalData.cost > 0 && (
                  <div className="metric">
                    <span>CPM</span>
                    <strong>
                      {Math.round((totalData.cost / totalData.impressions) * 1000).toLocaleString()}원
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            onClick={handleSave}
            className="btn-save"
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
          <button 
            onClick={onClose}
            className="btn-cancel"
            disabled={isSaving}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdDataInput;
