// src/components/MessageTemplates.jsx
import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import sensService from '../services/sensService';
import './MessageTemplates.css';

const MessageTemplates = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('checkIn');
  const [templates, setTemplates] = useState({
    checkIn: {
      title: '초호수뷰펜션 입실안내',
      content: `[초호수뷰펜션]
안녕하세요 {고객명}님!
오늘 오후 3시 입실 예정이십니다.

📍 주소: 경기도 파주시 법원읍 초리골길 134
🚗 주차: 객실 앞 전용주차장
🔑 비밀번호: 입실 1시간 전 발송

준비된 편안한 휴식 되세요 ☺️
문의: {전화번호}`
    },
    checkOut: {
      title: '초호수뷰펜션 퇴실안내',
      content: `[초호수뷰펜션]
{고객명}님, 즐거운 시간 보내셨나요?

🕐 퇴실시간: 오전 11시
🧹 퇴실준비: 사용하신 그릇은 싱크대에
🗑️ 쓰레기: 분리수거 부탁드립니다
🔑 열쇠: 테이블 위에 놓아주세요

감사합니다. 또 뵙겠습니다 🙏`
    },
    confirmation: {
      title: '초호수뷰펜션 예약확정',
      content: `[초호수뷰펜션]
{고객명}님, 예약이 확정되었습니다.

📅 일정: {체크인} ~ {체크아웃}
🏠 객실: {객실명}
👥 인원: {인원}명
💰 금액: {금액}원

입실 당일 안내 문자 드리겠습니다.
감사합니다 😊`
    },
    cancellation: {
      title: '초호수뷰펜션 예약취소',
      content: `[초호수뷰펜션]
{고객명}님, 예약이 취소되었습니다.

📅 일정: {체크인} ~ {체크아웃}
🏠 객실: {객실명}

다음에 더 좋은 기회로 뵙겠습니다.
감사합니다.`
    }
  });

  const [previewData, setPreviewData] = useState({
    customerName: '홍길동',
    roomName: 'Forest',
    checkIn: '2025-01-15',
    checkOut: '2025-01-17',
    guests: 4,
    totalPrice: 360000,
    pensionPhone: '010-0000-0000'
  });

  // 템플릿 불러오기
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'message_templates'));
      const loadedTemplates = {};
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedTemplates[data.type] = {
          id: doc.id,
          title: data.title,
          content: data.content
        };
      });
      
      // 기존 템플릿과 병합
      setTemplates(prev => ({
        ...prev,
        ...loadedTemplates
      }));
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 템플릿 저장
  const saveTemplate = async (type) => {
    setLoading(true);
    try {
      const template = templates[type];
      const docId = template.id || type;
      
      await setDoc(doc(db, 'message_templates', docId), {
        type,
        title: template.title,
        content: template.content,
        updatedAt: new Date()
      });
      
      alert(`${getTabLabel(type)} 템플릿이 저장되었습니다.`);
    } catch (error) {
      console.error('템플릿 저장 실패:', error);
      alert('템플릿 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 템플릿 초기화
  const resetTemplate = (type) => {
    const defaultTemplates = {
      checkIn: `[초호수뷰펜션]
안녕하세요 {고객명}님!
오늘 오후 3시 입실 예정이십니다.

📍 주소: 경기도 파주시 법원읍 초리골길 134
🚗 주차: 객실 앞 전용주차장
🔑 비밀번호: 입실 1시간 전 발송

준비된 편안한 휴식 되세요 ☺️
문의: {전화번호}`,
      checkOut: `[초호수뷰펜션]
{고객명}님, 즐거운 시간 보내셨나요?

🕐 퇴실시간: 오전 11시
🧹 퇴실준비: 사용하신 그릇은 싱크대에
🗑️ 쓰레기: 분리수거 부탁드립니다
🔑 열쇠: 테이블 위에 놓아주세요

감사합니다. 또 뵙겠습니다 🙏`,
      confirmation: `[초호수뷰펜션]
{고객명}님, 예약이 확정되었습니다.

📅 일정: {체크인} ~ {체크아웃}
🏠 객실: {객실명}
👥 인원: {인원}명
💰 금액: {금액}원

입실 당일 안내 문자 드리겠습니다.
감사합니다 😊`,
      cancellation: `[초호수뷰펜션]
{고객명}님, 예약이 취소되었습니다.

📅 일정: {체크인} ~ {체크아웃}
🏠 객실: {객실명}

다음에 더 좋은 기회로 뵙겠습니다.
감사합니다.`
    };

    if (window.confirm('템플릿을 초기값으로 되돌리시겠습니까?')) {
      setTemplates(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          content: defaultTemplates[type]
        }
      }));
    }
  };

  // 미리보기 생성
  const getPreview = () => {
    const template = templates[activeTab];
    return sensService.replaceTemplateVariables(template.content, previewData);
  };

  // 탭 레이블 가져오기
  const getTabLabel = (type) => {
    const labels = {
      checkIn: '입실 안내',
      checkOut: '퇴실 안내',
      confirmation: '예약 확정',
      cancellation: '취소 안내'
    };
    return labels[type] || type;
  };

  // 템플릿 업데이트
  const updateTemplate = (type, field, value) => {
    setTemplates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>템플릿을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="message-templates">
      <h2>📝 메시지 템플릿 관리</h2>

      {/* 탭 네비게이션 */}
      <div className="template-tabs">
        {Object.keys(templates).map(type => (
          <button
            key={type}
            className={`tab-button ${activeTab === type ? 'active' : ''}`}
            onClick={() => setActiveTab(type)}
          >
            {getTabLabel(type)}
          </button>
        ))}
      </div>

      {/* 템플릿 편집 영역 */}
      <div className="template-editor">
        <div className="editor-section">
          <h3>{getTabLabel(activeTab)} 메시지</h3>
          
          <div className="form-group">
            <label>제목</label>
            <input
              type="text"
              value={templates[activeTab].title}
              onChange={(e) => updateTemplate(activeTab, 'title', e.target.value)}
              placeholder="메시지 제목"
            />
          </div>

          <div className="form-group">
            <label>내용</label>
            <textarea
              value={templates[activeTab].content}
              onChange={(e) => updateTemplate(activeTab, 'content', e.target.value)}
              rows="15"
              placeholder="메시지 내용을 입력하세요"
            />
          </div>

          <div className="variable-info">
            <h4>사용 가능한 변수</h4>
            <div className="variable-list">
              <span className="variable">{'{고객명}'}</span>
              <span className="variable">{'{객실명}'}</span>
              <span className="variable">{'{체크인}'}</span>
              <span className="variable">{'{체크아웃}'}</span>
              <span className="variable">{'{인원}'}</span>
              <span className="variable">{'{금액}'}</span>
              <span className="variable">{'{전화번호}'}</span>
            </div>
          </div>

          <div className="button-group">
            <button
              onClick={() => resetTemplate(activeTab)}
              className="btn btn-secondary"
            >
              초기화
            </button>
            <button
              onClick={() => saveTemplate(activeTab)}
              className="btn btn-primary"
              disabled={loading}
            >
              저장
            </button>
          </div>
        </div>

        {/* 미리보기 영역 */}
        <div className="preview-section">
          <h3>미리보기</h3>
          
          <div className="preview-settings">
            <h4>테스트 데이터</h4>
            <div className="preview-form">
              <input
                type="text"
                placeholder="고객명"
                value={previewData.customerName}
                onChange={(e) => setPreviewData({...previewData, customerName: e.target.value})}
              />
              <input
                type="text"
                placeholder="객실명"
                value={previewData.roomName}
                onChange={(e) => setPreviewData({...previewData, roomName: e.target.value})}
              />
              <input
                type="date"
                value={previewData.checkIn}
                onChange={(e) => setPreviewData({...previewData, checkIn: e.target.value})}
              />
              <input
                type="date"
                value={previewData.checkOut}
                onChange={(e) => setPreviewData({...previewData, checkOut: e.target.value})}
              />
              <input
                type="number"
                placeholder="인원"
                value={previewData.guests}
                onChange={(e) => setPreviewData({...previewData, guests: e.target.value})}
              />
              <input
                type="number"
                placeholder="금액"
                value={previewData.totalPrice}
                onChange={(e) => setPreviewData({...previewData, totalPrice: e.target.value})}
              />
            </div>
          </div>

          <div className="preview-message">
            <div className="phone-mockup">
              <div className="phone-screen">
                <div className="message-bubble">
                  <pre>{getPreview()}</pre>
                </div>
                <div className="message-info">
                  <span className="char-count">
                    {getPreview().length}자 / {getPreview().length > 90 ? 'LMS' : 'SMS'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageTemplates;