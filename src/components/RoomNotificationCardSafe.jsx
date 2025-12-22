// src/components/RoomNotificationCardSafe.jsx
import React, { useState, useEffect } from 'react';
import './RoomNotificationCard.css';

// 메시지 템플릿 타입
const TEMPLATE_TYPES = {
  checkIn: { label: '입실안내', icon: '🏠' },
  checkOut: { label: '퇴실안내', icon: '👋' },
  confirmation: { label: '예약확정', icon: '✅' },
  cancellation: { label: '예약취소', icon: '❌' }
};

// 템플릿 변수
const TEMPLATE_VARIABLES = [
  { key: '{고객명}', label: '고객명' },
  { key: '{객실명}', label: '객실명' },
  { key: '{체크인}', label: '체크인날짜' },
  { key: '{체크아웃}', label: '체크아웃날짜' },
  { key: '{인원}', label: '인원수' },
  { key: '{금액}', label: '총금액' },
  { key: '{전화번호}', label: '펜션전화' },
  { key: '{주소}', label: '펜션주소' },
  { key: '{입실시간}', label: '입실시간' },
  { key: '{퇴실시간}', label: '퇴실시간' }
];

// 객실별 기본 템플릿 - null safe
const getDefaultTemplate = (roomName, templateType) => {
  // roomName이 null이나 undefined일 경우 기본값 사용
  const safeRoomName = roomName || '객실';
  const isChoho = safeRoomName.includes('Forest');
  const pensionName = isChoho ? '초호펜션' : '초호쉼터';
  
  const templates = {
    checkIn: {
      title: `${pensionName} ${safeRoomName} 입실안내`,
      content: `[${pensionName}]
안녕하세요 {고객명}님!
${safeRoomName} 예약 고객님 입실 안내드립니다.

📅 일정: {체크인} ~ {체크아웃}
🏠 객실: ${safeRoomName}
👥 인원: {인원}명
🕐 입실: 오후 3시

📍 주소: {주소}
🚗 주차: 객실 앞 전용주차장
🔑 비밀번호: 입실 1시간 전 발송

편안한 휴식 되세요 ☺️
문의: {전화번호}`
    },
    checkOut: {
      title: `${pensionName} ${safeRoomName} 퇴실안내`,
      content: isChoho
        ? `[${pensionName}]
{고객명}님, 즐거운 시간 보내셨나요?

🏠 객실: ${safeRoomName}
🕐 퇴실시간: 오전 11시

🧹 퇴실준비
- 사용하신 그릇은 싱크대에
- 쓰레기배출장소: 숯불바베큐장 옆
- 열쇠는 테이블 위에 놓아주세요

감사합니다. 또 뵙겠습니다 🙏
문의: {전화번호}`
        : `[${pensionName}]
{고객명}님, 즐거운 시간 보내셨나요?

🏠 객실: ${safeRoomName}
🕐 퇴실시간: 오전 11시

🧹 퇴실준비
- 사용하신 그릇은 싱크대에
- 쓰레기는 분리수거 부탁드립니다
- 열쇠는 테이블 위에 놓아주세요

감사합니다. 또 뵙겠습니다 🙏
문의: {전화번호}`
    },
    confirmation: {
      title: `${pensionName} ${safeRoomName} 예약확정`,
      content: `[${pensionName}]
{고객명}님, 예약이 확정되었습니다.

📅 일정: {체크인} ~ {체크아웃}
🏠 객실: ${safeRoomName}
👥 인원: {인원}명
💰 금액: {금액}원

입실 당일 안내 문자 드리겠습니다.
감사합니다 😊

문의: {전화번호}`
    },
    cancellation: {
      title: `${pensionName} ${safeRoomName} 예약취소`,
      content: `[${pensionName}]
{고객명}님, 예약이 취소되었습니다.

📅 취소일정: {체크인} ~ {체크아웃}
🏠 객실: ${safeRoomName}

다음에 더 좋은 기회로 뵙겠습니다.
감사합니다.

문의: {전화번호}`
    }
  };
  
  return templates[templateType] || templates.checkIn;
};

const RoomNotificationCardSafe = ({ roomName, settings, onSave, loading }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('checkIn');
  
  // 초기 설정을 안전하게 처리
  const getInitialSettings = () => {
    const defaultSettings = {
      enabled: true,
      templates: {
        checkIn: getDefaultTemplate(roomName, 'checkIn'),
        checkOut: getDefaultTemplate(roomName, 'checkOut'),
        confirmation: getDefaultTemplate(roomName, 'confirmation'),
        cancellation: getDefaultTemplate(roomName, 'cancellation')
      },
      autoSend: {
        checkInEnabled: true,
        checkInHoursBefore: 3,
        checkOutEnabled: true,
        checkOutHoursBefore: 1,
        confirmationEnabled: false,  // 기본값: 사용자가 명시적으로 켜야 함
        cancellationEnabled: false   // 기본값: 사용자가 명시적으로 켜야 함
      }
    };
    
    // settings가 있고 유효한 경우 병합
    if (settings) {
      const mergedSettings = {
        ...defaultSettings,
        enabled: settings.enabled !== undefined ? settings.enabled : defaultSettings.enabled
      };
      
      // templates 병합
      if (settings.templates && typeof settings.templates === 'object') {
        mergedSettings.templates = {
          ...defaultSettings.templates,
          ...settings.templates
        };
        
        // 각 템플릿이 유효한지 확인
        Object.keys(TEMPLATE_TYPES).forEach(type => {
          if (!mergedSettings.templates[type] || !mergedSettings.templates[type].content) {
            mergedSettings.templates[type] = getDefaultTemplate(roomName, type);
          }
        });
      }
      
      // autoSend 병합
      if (settings.autoSend && typeof settings.autoSend === 'object') {
        mergedSettings.autoSend = {
          ...defaultSettings.autoSend,
          ...settings.autoSend
        };
      }
      
      return mergedSettings;
    }
    
    return defaultSettings;
  };
  
  const [localSettings, setLocalSettings] = useState(getInitialSettings());

  // settings prop이 변경되면 업데이트
  useEffect(() => {
    if (settings) {
      const newSettings = getInitialSettings();
      setLocalSettings(newSettings);
    }
  }, [settings, roomName]);

  // 템플릿 내용 변경
  const handleTemplateChange = (type, field, value) => {
    setLocalSettings(prev => {
      // 현재 템플릿이 없으면 기본 템플릿 사용
      const currentTemplate = prev.templates?.[type] || getDefaultTemplate(roomName, type);
      return {
        ...prev,
        templates: {
          ...prev.templates,
          [type]: {
            ...currentTemplate,
            [field]: value
          }
        }
      };
    });
  };

  // 자동발송 설정 변경
  const handleAutoSendChange = (field, value) => {
    setLocalSettings(prev => ({
      ...prev,
      autoSend: {
        ...prev.autoSend,
        [field]: value
      }
    }));
  };

  // 변수 삽입
  const insertVariable = (variable) => {
    const currentTemplate = localSettings.templates[activeTemplate];
    if (!currentTemplate) return;
    
    const textarea = document.getElementById(`template-${roomName}-${activeTemplate}`);
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = currentTemplate.content || '';
      const newText = text.substring(0, start) + variable + text.substring(end);
      
      handleTemplateChange(activeTemplate, 'content', newText);
      
      // 커서 위치 조정
      setTimeout(() => {
        textarea.selectionStart = start + variable.length;
        textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  // 템플릿 초기화
  const resetTemplate = (type) => {
    if (confirm(`${TEMPLATE_TYPES[type].label} 템플릿을 초기화하시겠습니까?`)) {
      const defaultTemplate = getDefaultTemplate(roomName, type);
      handleTemplateChange(type, 'title', defaultTemplate.title);
      handleTemplateChange(type, 'content', defaultTemplate.content);
    }
  };

  // 모든 템플릿 초기화
  const resetAllTemplates = () => {
    if (confirm(`${roomName}의 모든 템플릿을 초기화하시겠습니까?`)) {
      const newTemplates = {};
      Object.keys(TEMPLATE_TYPES).forEach(type => {
        newTemplates[type] = getDefaultTemplate(roomName, type);
      });
      
      setLocalSettings(prev => ({
        ...prev,
        templates: newTemplates
      }));
    }
  };

  // 저장
  const handleSave = async () => {
    console.log('handleSave 호출됨', roomName, localSettings);
    
    // onSave가 있는 경우 직접 localSettings를 전달하여 저장
    if (onSave) {
      console.log('onSave 호출', roomName, localSettings);
      await onSave(roomName, localSettings);
    }
  };

  // 미리보기 데이터
  const previewData = {
    고객명: '홍길동',
    객실명: roomName || '객실',
    체크인: '2025-01-30',
    체크아웃: '2025-01-31',
    인원: '4',
    금액: '200,000',
    전화번호: '010-1234-5678',
    주소: '경기도 파주시 법원읍 초리골길 134',
    입실시간: '오후 3시',
    퇴실시간: '오전 11시'
  };

  // 템플릿 미리보기
  const getPreviewContent = (content) => {
    if (!content) return '';
    
    let preview = content;
    Object.entries(previewData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{${key}}`, 'g'), value);
    });
    return preview;
  };

  // 현재 템플릿 안전하게 가져오기
  const currentTemplate = localSettings.templates[activeTemplate] || getDefaultTemplate(roomName, activeTemplate);

  return (
    <div className={`room-notification-card ${expanded ? 'expanded' : ''}`}>
      {/* 헤더 */}
      <div className="room-card-header">
        <div className="room-info">
          <h4>{roomName || '객실'}</h4>
          <label className="room-enable-switch">
            <input
              type="checkbox"
              checked={localSettings.enabled}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <span className="switch-slider"></span>
            <span className="switch-label">
              {localSettings.enabled ? '활성' : '비활성'}
            </span>
          </label>
        </div>
        <button
          className="expand-button"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '접기 ▲' : '펼치기 ▼'}
        </button>
      </div>

      {/* 확장 컨텐츠 */}
      {expanded && (
        <div className="room-card-content">
          {/* 템플릿 탭 */}
          <div className="template-tabs">
            {Object.entries(TEMPLATE_TYPES).map(([type, info]) => (
              <button
                key={type}
                className={`template-tab ${activeTemplate === type ? 'active' : ''}`}
                onClick={() => setActiveTemplate(type)}
              >
                <span className="tab-icon">{info.icon}</span>
                <span className="tab-label">{info.label}</span>
              </button>
            ))}
          </div>

          {/* 템플릿 편집기 */}
          <div className="template-editor-section">
            <div className="editor-header">
              <input
                type="text"
                className="template-title"
                value={currentTemplate.title || ''}
                onChange={(e) => handleTemplateChange(activeTemplate, 'title', e.target.value)}
                placeholder="메시지 제목"
              />
              <button
                className="reset-button"
                onClick={() => resetTemplate(activeTemplate)}
                title="이 템플릿 초기화"
              >
                🔄
              </button>
            </div>

            <div className="editor-content">
              <div className="editor-column">
                <h5>템플릿 편집</h5>
                <textarea
                  id={`template-${roomName}-${activeTemplate}`}
                  className="template-editor"
                  value={currentTemplate.content || ''}
                  onChange={(e) => handleTemplateChange(activeTemplate, 'content', e.target.value)}
                  placeholder="메시지 내용을 입력하세요..."
                  rows="15"
                />
                
                {/* 변수 도우미 */}
                <div className="variable-helper">
                  <span className="helper-label">변수 삽입:</span>
                  <div className="variable-chips">
                    {TEMPLATE_VARIABLES.map(variable => (
                      <button
                        key={variable.key}
                        className="variable-chip"
                        onClick={() => insertVariable(variable.key)}
                        title={variable.label}
                      >
                        {variable.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="preview-column">
                <h5>미리보기</h5>
                <div className="template-preview">
                  <div className="preview-title">
                    {currentTemplate.title || ''}
                  </div>
                  <div className="preview-content">
                    {getPreviewContent(currentTemplate.content || '')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 자동발송 설정 */}
          <div className="auto-send-section">
            <h5>⏰ 자동발송 설정</h5>
            <div className="auto-send-grid">
              <div className="auto-send-item">
                <label>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSend.checkInEnabled}
                    onChange={(e) => handleAutoSendChange('checkInEnabled', e.target.checked)}
                  />
                  입실안내 자동발송
                </label>
                <div className="time-setting">
                  <span>입실</span>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={localSettings.autoSend.checkInHoursBefore}
                    onChange={(e) => handleAutoSendChange('checkInHoursBefore', parseInt(e.target.value) || 3)}
                    disabled={!localSettings.autoSend.checkInEnabled}
                  />
                  <span>시간 전</span>
                </div>
              </div>

              <div className="auto-send-item">
                <label>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSend.checkOutEnabled}
                    onChange={(e) => handleAutoSendChange('checkOutEnabled', e.target.checked)}
                  />
                  퇴실안내 자동발송
                </label>
                <div className="time-setting">
                  <span>퇴실</span>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={localSettings.autoSend.checkOutHoursBefore}
                    onChange={(e) => handleAutoSendChange('checkOutHoursBefore', parseInt(e.target.value) || 1)}
                    disabled={!localSettings.autoSend.checkOutEnabled}
                  />
                  <span>시간 전</span>
                </div>
              </div>

              <div className="auto-send-item">
                <label>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSend.confirmationEnabled}
                    onChange={(e) => handleAutoSendChange('confirmationEnabled', e.target.checked)}
                  />
                  예약확정 즉시발송
                </label>
              </div>

              <div className="auto-send-item">
                <label>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSend.cancellationEnabled}
                    onChange={(e) => handleAutoSendChange('cancellationEnabled', e.target.checked)}
                  />
                  예약취소 즉시발송
                </label>
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="room-card-actions">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? '저장 중...' : '💾 설정 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomNotificationCardSafe;