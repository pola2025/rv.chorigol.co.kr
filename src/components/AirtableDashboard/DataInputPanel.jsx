// src/components/AirtableDashboard/DataInputPanel.jsx
// 광고 데이터 입력 패널 (CSV 업로드 + 수동 입력)
import React, { useState, useRef } from 'react';
import airtableService from '../../services/airtableService';

const formatNumber = (num) => {
  return new Intl.NumberFormat('ko-KR').format(num || 0);
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount || 0);
};

const DataInputPanel = ({ selectedYear, selectedMonth, onDataSaved }) => {
  const [activeInputTab, setActiveInputTab] = useState('naverCsv');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  // CSV 업로드 상태
  const [csvPreview, setCsvPreview] = useState(null);
  const [selectedPension, setSelectedPension] = useState('choho');

  // 수동 입력 폼 상태
  const [manualData, setManualData] = useState({
    platform: 'homepage_choho',
    visitors: '',
    pageviews: '',
    avgTime: '',
    bounceRate: '',
    inquiries: '',
    reservations: '',
    // Meta 전용
    impressions: '',
    clicks: '',
    cost: '',
    conversions: ''
  });

  // CSV 파일 처리
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target.result;
      const result = airtableService.parseNaverAdsCsv(csvText);

      if (result.success) {
        setCsvPreview(result);
        setMessage({ type: 'info', text: `${result.rowCount}개 행 분석 완료` });
      } else {
        setMessage({ type: 'error', text: result.error });
        setCsvPreview(null);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // CSV 데이터 저장
  const handleSaveCsvData = async () => {
    if (!csvPreview?.summary) {
      setMessage({ type: 'error', text: 'CSV 데이터가 없습니다.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const tableName = selectedPension === 'choho' ? '네이버광고_초호' : '네이버광고_전체통계';
      const result = await airtableService.saveNaverAdsFromCsv(
        tableName,
        selectedYear,
        selectedMonth,
        csvPreview.summary
      );

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setCsvPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onDataSaved?.();
      } else {
        setMessage({ type: 'error', text: result.error || '저장 실패' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  // 수동 입력 데이터 저장
  const handleSaveManualData = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const dataToSave = [];
      const platform = manualData.platform;
      let tableName = '';

      // 테이블명 결정
      if (platform === 'homepage_choho') {
        tableName = '홈페이지_초호';
      } else if (platform === 'homepage_shelter') {
        tableName = '홈페이지_초호쉼터';
      } else if (platform === 'place_choho') {
        tableName = '플레이스_초호';
      } else if (platform === 'place_shelter') {
        tableName = '플레이스_초호쉼터';
      } else if (platform === 'meta') {
        tableName = 'Meta';
      }

      // 플랫폼별 데이터 수집
      if (platform.startsWith('homepage') || platform.startsWith('place')) {
        if (manualData.visitors) {
          dataToSave.push({ category: '방문자수', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.visitors) });
        }
        if (manualData.pageviews) {
          dataToSave.push({ category: '페이지뷰', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.pageviews) });
        }
        if (platform.startsWith('homepage')) {
          if (manualData.avgTime) {
            dataToSave.push({ category: '평균체류시간', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.avgTime) });
          }
          if (manualData.bounceRate) {
            dataToSave.push({ category: '이탈률', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.bounceRate) });
          }
        }
        if (platform.startsWith('place')) {
          if (manualData.inquiries) {
            dataToSave.push({ category: '문의수', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.inquiries) });
          }
          if (manualData.reservations) {
            dataToSave.push({ category: '예약수', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.reservations) });
          }
        }
      } else if (platform === 'meta') {
        if (manualData.impressions) {
          dataToSave.push({ category: '노출수', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.impressions) });
        }
        if (manualData.clicks) {
          dataToSave.push({ category: '클릭수', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.clicks) });
        }
        if (manualData.cost) {
          dataToSave.push({ category: '광고비', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.cost) });
        }
        if (manualData.conversions) {
          dataToSave.push({ category: '전환수', year: selectedYear, month: selectedMonth, value: parseFloat(manualData.conversions) });
        }
      }

      if (dataToSave.length === 0) {
        setMessage({ type: 'error', text: '입력된 데이터가 없습니다.' });
        setSaving(false);
        return;
      }

      // 일괄 저장
      const results = await airtableService.batchUpsertMonthlyData(tableName, dataToSave);
      const successCount = results.filter(r => r.result?.success).length;

      if (successCount === dataToSave.length) {
        setMessage({ type: 'success', text: `${successCount}개 항목이 저장되었습니다.` });
        // 폼 초기화
        setManualData(prev => ({
          ...prev,
          visitors: '',
          pageviews: '',
          avgTime: '',
          bounceRate: '',
          inquiries: '',
          reservations: '',
          impressions: '',
          clicks: '',
          cost: '',
          conversions: ''
        }));
        onDataSaved?.();
      } else {
        setMessage({ type: 'warning', text: `${successCount}/${dataToSave.length}개 항목 저장됨` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  // 플랫폼별 입력 폼 렌더링
  const renderManualInputForm = () => {
    const platform = manualData.platform;

    if (platform.startsWith('homepage')) {
      return (
        <div className="input-form-grid">
          <div className="input-group">
            <label>방문자수</label>
            <input
              type="number"
              value={manualData.visitors}
              onChange={(e) => setManualData({ ...manualData, visitors: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="input-group">
            <label>페이지뷰</label>
            <input
              type="number"
              value={manualData.pageviews}
              onChange={(e) => setManualData({ ...manualData, pageviews: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="input-group">
            <label>평균 체류시간 (분)</label>
            <input
              type="number"
              step="0.1"
              value={manualData.avgTime}
              onChange={(e) => setManualData({ ...manualData, avgTime: e.target.value })}
              placeholder="0.0"
            />
          </div>
          <div className="input-group">
            <label>이탈률 (%)</label>
            <input
              type="number"
              step="0.1"
              value={manualData.bounceRate}
              onChange={(e) => setManualData({ ...manualData, bounceRate: e.target.value })}
              placeholder="0.0"
            />
          </div>
        </div>
      );
    }

    if (platform.startsWith('place')) {
      return (
        <div className="input-form-grid">
          <div className="input-group">
            <label>방문자수</label>
            <input
              type="number"
              value={manualData.visitors}
              onChange={(e) => setManualData({ ...manualData, visitors: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="input-group">
            <label>페이지뷰</label>
            <input
              type="number"
              value={manualData.pageviews}
              onChange={(e) => setManualData({ ...manualData, pageviews: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="input-group">
            <label>문의수</label>
            <input
              type="number"
              value={manualData.inquiries}
              onChange={(e) => setManualData({ ...manualData, inquiries: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="input-group">
            <label>예약수</label>
            <input
              type="number"
              value={manualData.reservations}
              onChange={(e) => setManualData({ ...manualData, reservations: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>
      );
    }

    if (platform === 'meta') {
      return (
        <div className="input-form-grid">
          <div className="input-group">
            <label>노출수</label>
            <input
              type="number"
              value={manualData.impressions}
              onChange={(e) => setManualData({ ...manualData, impressions: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="input-group">
            <label>클릭수</label>
            <input
              type="number"
              value={manualData.clicks}
              onChange={(e) => setManualData({ ...manualData, clicks: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="input-group">
            <label>광고비 ($)</label>
            <input
              type="number"
              step="0.01"
              value={manualData.cost}
              onChange={(e) => setManualData({ ...manualData, cost: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="input-group">
            <label>전환수</label>
            <input
              type="number"
              value={manualData.conversions}
              onChange={(e) => setManualData({ ...manualData, conversions: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="data-input-panel">
      <h3 className="section-title">
        <span className="title-icon">📝</span>
        데이터 입력
        <span className="date-label">({selectedYear}년 {selectedMonth}월)</span>
      </h3>

      {/* 메시지 표시 */}
      {message && (
        <div className={`message-box ${message.type}`}>
          {message.type === 'success' && '✅ '}
          {message.type === 'error' && '❌ '}
          {message.type === 'warning' && '⚠️ '}
          {message.type === 'info' && 'ℹ️ '}
          {message.text}
        </div>
      )}

      {/* 입력 방식 탭 */}
      <div className="input-tabs">
        <button
          className={`input-tab ${activeInputTab === 'naverCsv' ? 'active' : ''}`}
          onClick={() => setActiveInputTab('naverCsv')}
        >
          📤 네이버 광고 CSV
        </button>
        <button
          className={`input-tab ${activeInputTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveInputTab('manual')}
        >
          ✏️ 수동 입력
        </button>
      </div>

      {/* 네이버 광고 CSV 업로드 */}
      {activeInputTab === 'naverCsv' && (
        <div className="csv-upload-section">
          <div className="pension-selector">
            <label>대상 펜션:</label>
            <select
              value={selectedPension}
              onChange={(e) => setSelectedPension(e.target.value)}
            >
              <option value="choho">초호 펜션</option>
              <option value="total">전체 통계 (초호 + 초호쉼터)</option>
            </select>
          </div>

          <div className="file-upload-area">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              ref={fileInputRef}
              className="file-input"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="file-upload-label">
              <span className="upload-icon">📁</span>
              <span>CSV 파일 선택</span>
              <small>네이버 광고 다운로드 파일</small>
            </label>
          </div>

          {/* CSV 미리보기 */}
          {csvPreview && (
            <div className="csv-preview">
              <h4>분석 결과</h4>
              <div className="preview-stats">
                <div className="preview-stat">
                  <span className="stat-label">노출수</span>
                  <span className="stat-value">{formatNumber(csvPreview.summary.impressions)}</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">클릭수</span>
                  <span className="stat-value">{formatNumber(csvPreview.summary.clicks)}</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">광고비</span>
                  <span className="stat-value">{formatCurrency(csvPreview.summary.cost)}</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">CTR</span>
                  <span className="stat-value">{csvPreview.summary.ctr}%</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">CPC</span>
                  <span className="stat-value">{formatCurrency(csvPreview.summary.cpc)}</span>
                </div>
              </div>

              <button
                className="save-btn"
                onClick={handleSaveCsvData}
                disabled={saving}
              >
                {saving ? '저장 중...' : 'Airtable에 저장'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 수동 입력 */}
      {activeInputTab === 'manual' && (
        <div className="manual-input-section">
          <div className="platform-selector">
            <label>플랫폼 선택:</label>
            <select
              value={manualData.platform}
              onChange={(e) => setManualData({ ...manualData, platform: e.target.value })}
            >
              <optgroup label="홈페이지">
                <option value="homepage_choho">홈페이지 - 초호 펜션</option>
                <option value="homepage_shelter">홈페이지 - 초호쉼터</option>
              </optgroup>
              <optgroup label="플레이스">
                <option value="place_choho">플레이스 - 초호 펜션</option>
                <option value="place_shelter">플레이스 - 초호쉼터</option>
              </optgroup>
              <optgroup label="Meta">
                <option value="meta">Meta 광고</option>
              </optgroup>
            </select>
          </div>

          {renderManualInputForm()}

          <button
            className="save-btn"
            onClick={handleSaveManualData}
            disabled={saving}
          >
            {saving ? '저장 중...' : 'Airtable에 저장'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DataInputPanel;
