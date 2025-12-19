// src/components/marketing/AdPlatformModal.jsx
import React, { useState } from 'react';
import './AdPlatformModal.css';

const AdPlatformModal = ({ onClose, onSave }) => {
  const [platformName, setPlatformName] = useState('');
  const [metrics, setMetrics] = useState({
    impressions: true,
    clicks: true,
    cost: true,
    conversions: false,
    reach: false,
    custom: false
  });
  const [customMetric, setCustomMetric] = useState('');
  const [useCampaigns, setUseCampaigns] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [newCampaign, setNewCampaign] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCampaign = () => {
    if (newCampaign.trim() && !campaigns.includes(newCampaign.trim())) {
      setCampaigns([...campaigns, newCampaign.trim()]);
      setNewCampaign('');
    }
  };

  const handleRemoveCampaign = (index) => {
    setCampaigns(campaigns.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!platformName.trim()) {
      alert('플랫폼명을 입력해주세요.');
      return;
    }

    const selectedMetrics = [];
    Object.entries(metrics).forEach(([key, value]) => {
      if (value) {
        if (key === 'custom' && customMetric.trim()) {
          selectedMetrics.push(customMetric.trim());
        } else if (key !== 'custom') {
          selectedMetrics.push(key);
        }
      }
    });

    if (selectedMetrics.length === 0) {
      alert('최소 하나 이상의 측정 항목을 선택해주세요.');
      return;
    }

    setIsSaving(true);
    const platformData = {
      name: platformName.trim(),
      metrics: selectedMetrics,
      campaigns: useCampaigns ? campaigns : []
    };

    const success = await onSave(platformData);
    if (success) {
      onClose();
    }
    setIsSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>➕ 광고 플랫폼 추가</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="modal-body">
          {/* 플랫폼명 입력 */}
          <div className="form-group">
            <label>플랫폼명</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="예: 네이버 광고"
              autoFocus
            />
          </div>

          {/* 측정 항목 선택 */}
          <div className="form-group">
            <label>측정 항목 (체크된 항목만 입력받음)</label>
            <div className="metrics-list">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={metrics.impressions}
                  onChange={(e) => setMetrics({...metrics, impressions: e.target.checked})}
                />
                <span>노출수</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={metrics.clicks}
                  onChange={(e) => setMetrics({...metrics, clicks: e.target.checked})}
                />
                <span>클릭수</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={metrics.cost}
                  onChange={(e) => setMetrics({...metrics, cost: e.target.checked})}
                />
                <span>비용</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={metrics.conversions}
                  onChange={(e) => setMetrics({...metrics, conversions: e.target.checked})}
                />
                <span>전환수</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={metrics.reach}
                  onChange={(e) => setMetrics({...metrics, reach: e.target.checked})}
                />
                <span>도달수</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={metrics.custom}
                  onChange={(e) => setMetrics({...metrics, custom: e.target.checked})}
                />
                <span>기타:</span>
                {metrics.custom && (
                  <input
                    type="text"
                    value={customMetric}
                    onChange={(e) => setCustomMetric(e.target.value)}
                    placeholder="커스텀 지표명"
                    className="custom-metric-input"
                  />
                )}
              </label>
            </div>
          </div>

          {/* 세부 캠페인 구분 */}
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={useCampaigns}
                onChange={(e) => setUseCampaigns(e.target.checked)}
              />
              <span>세부 캠페인 구분 사용 (캠페인별 세부 입력)</span>
            </label>
          </div>

          {useCampaigns && (
            <div className="campaigns-section">
              <label>캠페인명</label>
              <div className="campaign-list">
                {campaigns.map((campaign, index) => (
                  <div key={index} className="campaign-item">
                    <span>{campaign}</span>
                    <button 
                      onClick={() => handleRemoveCampaign(index)}
                      className="remove-btn"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <div className="add-campaign">
                <input
                  type="text"
                  value={newCampaign}
                  onChange={(e) => setNewCampaign(e.target.value)}
                  placeholder="캠페인명 입력"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCampaign()}
                />
                <button onClick={handleAddCampaign} className="btn-add">
                  + 캠페인 추가
                </button>
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

export default AdPlatformModal;
