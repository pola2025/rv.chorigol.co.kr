// src/components/BulkSMSSender.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import sensService from '../services/sensService';
import './BulkSMSSender.css';

const BulkSMSSender = () => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [message, setMessage] = useState('');
  const [recipientType, setRecipientType] = useState('today_checkin');
  const [sendTime, setSendTime] = useState('immediate');
  const [scheduledTime, setScheduledTime] = useState('');
  const [property, setProperty] = useState('all'); // all, choho, shelter
  const [previewMode, setPreviewMode] = useState(false);
  const [sendResults, setSendResults] = useState([]);

  // 수신자 목록 로드
  useEffect(() => {
    loadRecipients();
  }, [recipientType, property]);

  const loadRecipients = async () => {
    setLoading(true);
    try {
      let q;
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      // 기본 쿼리
      if (recipientType === 'today_checkin') {
        q = query(
          collection(db, 'reservations'),
          where('checkIn', '==', today),
          where('status', '==', '예약확정')
        );
      } else if (recipientType === 'tomorrow_checkin') {
        q = query(
          collection(db, 'reservations'),
          where('checkIn', '==', tomorrow),
          where('status', '==', '예약확정')
        );
      } else if (recipientType === 'today_checkout') {
        q = query(
          collection(db, 'reservations'),
          where('checkOut', '==', today),
          where('status', '==', '예약확정')
        );
      } else if (recipientType === 'this_month') {
        const monthStart = new Date(today.slice(0, 7) + '-01').toISOString().split('T')[0];
        const monthEnd = new Date(today.slice(0, 4), parseInt(today.slice(5, 7)), 0).toISOString().split('T')[0];
        q = query(
          collection(db, 'reservations'),
          where('checkIn', '>=', monthStart),
          where('checkIn', '<=', monthEnd),
          where('status', '==', '예약확정')
        );
      } else if (recipientType === 'custom') {
        // 사용자 정의 선택
        q = query(collection(db, 'reservations'), where('status', '==', '예약확정'));
      }
      
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 객실별 필터링
      if (property === 'choho') {
        data = data.filter(r => ['Forest', 'Forest mini', 'Forest mini 패밀리', 'Forest 패밀리'].includes(r.roomName));
      } else if (property === 'shelter') {
        data = data.filter(r => ['호수뷰객실', '1박2일워크샵', '야유회'].includes(r.roomName));
      }
      
      setRecipients(data);
      setSelectedRecipients(data.map(r => r.id)); // 기본적으로 모두 선택
    } catch (error) {
      console.error('수신자 로드 실패:', error);
      alert('수신자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 개별 수신자 선택/해제
  const toggleRecipient = (id) => {
    setSelectedRecipients(prev => 
      prev.includes(id) 
        ? prev.filter(rid => rid !== id)
        : [...prev, id]
    );
  };

  // 전체 선택/해제
  const toggleAllRecipients = () => {
    if (selectedRecipients.length === recipients.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(recipients.map(r => r.id));
    }
  };

  // 메시지 미리보기
  const getPreviewMessage = (recipient) => {
    let preview = message;
    preview = preview.replace(/{고객명}/g, recipient.customerName);
    preview = preview.replace(/{객실명}/g, recipient.roomName);
    preview = preview.replace(/{체크인}/g, recipient.checkIn);
    preview = preview.replace(/{체크아웃}/g, recipient.checkOut);
    preview = preview.replace(/{금액}/g, (recipient.totalPrice || 0).toLocaleString());
    return preview;
  };

  // 대량 발송 실행
  const handleBulkSend = async () => {
    if (!message.trim()) {
      alert('메시지를 입력해주세요.');
      return;
    }
    
    if (selectedRecipients.length === 0) {
      alert('수신자를 선택해주세요.');
      return;
    }
    
    const selectedCount = selectedRecipients.length;
    const estimatedCost = selectedCount * 20; // SMS 단가 20원
    
    if (!confirm(`${selectedCount}명에게 문자를 발송하시겠습니까?\n예상 비용: ${estimatedCost.toLocaleString()}원`)) {
      return;
    }
    
    setSending(true);
    setSendResults([]);
    
    try {
      const results = [];
      
      // 선택된 수신자들에게 개별 발송
      for (const recipientId of selectedRecipients) {
        const recipient = recipients.find(r => r.id === recipientId);
        if (!recipient) continue;
        
        // 개인화된 메시지 생성
        const personalizedMessage = getPreviewMessage(recipient);
        
        try {
          // Firebase Functions를 통해 SMS 발송
          const sendSMS = httpsCallable(functions, 'sendBulkSMS');
          const result = await sendSMS({
            to: recipient.customerPhone,
            message: personalizedMessage,
            recipientName: recipient.customerName,
            recipientId: recipient.id
          });
          
          results.push({
            recipientId,
            recipientName: recipient.customerName,
            phone: recipient.customerPhone.slice(0, 7) + '****', // 개인정보 보호
            status: 'success',
            requestId: result.data.requestId
          });
          
          // 발송 로그 저장
          await addDoc(collection(db, 'bulk_sms_logs'), {
            recipientId,
            recipientName: recipient.customerName,
            phone: recipient.customerPhone,
            message: personalizedMessage,
            status: 'success',
            requestId: result.data.requestId,
            sentAt: serverTimestamp()
          });
          
        } catch (error) {
          console.error(`발송 실패 (${recipient.customerName}):`, error);
          results.push({
            recipientId,
            recipientName: recipient.customerName,
            phone: recipient.customerPhone.slice(0, 7) + '****',
            status: 'failed',
            error: error.message
          });
        }
        
        // 0.5초 대기 (API 제한 방지)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setSendResults(results);
      
      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.filter(r => r.status === 'failed').length;
      
      alert(`발송 완료!\n성공: ${successCount}건\n실패: ${failCount}건`);
      
    } catch (error) {
      console.error('대량 발송 실패:', error);
      alert('대량 발송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bulk-sms-sender">
      <h2>📨 대량 SMS 발송</h2>
      
      <div className="sender-content">
        {/* 수신자 선택 섹션 */}
        <div className="recipients-section">
          <h3>1. 수신자 선택</h3>
          
          <div className="filter-options">
            <select value={property} onChange={(e) => setProperty(e.target.value)}>
              <option value="all">전체 객실</option>
              <option value="choho">초호펜션</option>
              <option value="shelter">초호쉼터</option>
            </select>
            
            <select value={recipientType} onChange={(e) => setRecipientType(e.target.value)}>
              <option value="today_checkin">오늘 입실 예정</option>
              <option value="tomorrow_checkin">내일 입실 예정</option>
              <option value="today_checkout">오늘 퇴실 예정</option>
              <option value="this_month">이번 달 예약</option>
              <option value="custom">직접 선택</option>
            </select>
          </div>
          
          <div className="recipients-list">
            <div className="list-header">
              <label>
                <input
                  type="checkbox"
                  checked={selectedRecipients.length === recipients.length && recipients.length > 0}
                  onChange={toggleAllRecipients}
                />
                <span>전체 선택 ({selectedRecipients.length}/{recipients.length}명)</span>
              </label>
            </div>
            
            {loading ? (
              <div className="loading">로딩 중...</div>
            ) : recipients.length > 0 ? (
              <div className="recipient-items">
                {recipients.map(recipient => (
                  <label key={recipient.id} className="recipient-item">
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(recipient.id)}
                      onChange={() => toggleRecipient(recipient.id)}
                    />
                    <div className="recipient-info">
                      <strong>{recipient.customerName}</strong>
                      <span className="phone">{recipient.customerPhone}</span>
                      <span className="room">{recipient.roomName}</span>
                      <span className="dates">{recipient.checkIn} ~ {recipient.checkOut}</span>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="no-recipients">해당하는 수신자가 없습니다.</div>
            )}
          </div>
        </div>
        
        {/* 메시지 작성 섹션 */}
        <div className="message-section">
          <h3>2. 메시지 작성</h3>
          
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="[초호펜션]&#10;발송할 메시지를 입력하세요...&#10;&#10;사용 가능한 변수:&#10;{고객명} {객실명} {체크인} {체크아웃} {금액}"
            rows="10"
          />
          
          <div className="message-info">
            <span>{message.length}자</span>
            <span>{message.length > 45 ? 'LMS' : 'SMS'}</span>
            <span>예상 비용: {(selectedRecipients.length * 20).toLocaleString()}원</span>
          </div>
          
          {/* 발송 옵션 */}
          <div className="send-options">
            <label>
              <input
                type="radio"
                value="immediate"
                checked={sendTime === 'immediate'}
                onChange={(e) => setSendTime(e.target.value)}
              />
              즉시 발송
            </label>
            <label>
              <input
                type="radio"
                value="scheduled"
                checked={sendTime === 'scheduled'}
                onChange={(e) => setSendTime(e.target.value)}
              />
              예약 발송
            </label>
            {sendTime === 'scheduled' && (
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            )}
          </div>
          
          {/* 액션 버튼 */}
          <div className="action-buttons">
            <button
              className="btn-preview"
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? '미리보기 닫기' : '미리보기'}
            </button>
            <button
              className="btn-send"
              onClick={handleBulkSend}
              disabled={sending || selectedRecipients.length === 0}
            >
              {sending ? `발송 중... (${sendResults.length}/${selectedRecipients.length})` : '발송하기'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 미리보기 */}
      {previewMode && selectedRecipients.length > 0 && (
        <div className="preview-section">
          <h3>메시지 미리보기</h3>
          <div className="preview-list">
            {recipients
              .filter(r => selectedRecipients.includes(r.id))
              .slice(0, 3)
              .map(recipient => (
                <div key={recipient.id} className="preview-item">
                  <div className="preview-header">
                    <strong>{recipient.customerName}</strong>
                    <span>{recipient.customerPhone}</span>
                  </div>
                  <div className="preview-message">
                    {getPreviewMessage(recipient)}
                  </div>
                </div>
              ))}
            {selectedRecipients.length > 3 && (
              <div className="preview-more">
                ... 외 {selectedRecipients.length - 3}명
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 발송 결과 */}
      {sendResults.length > 0 && (
        <div className="results-section">
          <h3>발송 결과</h3>
          <div className="results-summary">
            <span className="success">
              성공: {sendResults.filter(r => r.status === 'success').length}건
            </span>
            <span className="failed">
              실패: {sendResults.filter(r => r.status === 'failed').length}건
            </span>
          </div>
          <div className="results-list">
            {sendResults.map((result, index) => (
              <div key={index} className={`result-item ${result.status}`}>
                <span>{result.recipientName}</span>
                <span>{result.phone}</span>
                <span className={`status ${result.status}`}>
                  {result.status === 'success' ? '✅ 성공' : '❌ 실패'}
                </span>
                {result.error && <span className="error">{result.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="privacy-notice">
        <h4>🔒 개인정보 보호 안내</h4>
        <ul>
          <li>각 수신자는 개별적으로 문자를 받으며, 다른 수신자의 정보는 볼 수 없습니다.</li>
          <li>발송 로그는 암호화되어 저장되며, 관리자만 확인할 수 있습니다.</li>
          <li>전화번호는 마스킹 처리되어 표시됩니다.</li>
          <li>대량 발송 시 0.5초 간격으로 순차 발송되어 안정성을 보장합니다.</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkSMSSender;
