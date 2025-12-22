// src/components/NotificationSettings.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import sensService from '../services/sensService';
import telegramService from '../services/telegramService';
import './NotificationSettings.css';

// 객실 그룹 정의
const ROOM_GROUPS = {
  choho: {
    name: '초호펜션',
    rooms: ['Forest', 'Forest mini', 'Forest mini 패밀리', 'Forest 패밀리']
  },
  shelter: {
    name: '초호쉼터',
    rooms: ['호수뷰객실', '1박2일워크샵', '야유회']
  }
};

const NotificationSettings = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('choho'); // 'choho' or 'shelter'
  
  // 초호펜션 SENS 설정
  const [chohoSensConfig, setChohoSensConfig] = useState({
    serviceId: '',
    accessKey: '',
    secretKey: '',
    from: ''
  });
  
  // 초호쉼터 SENS 설정
  const [shelterSensConfig, setShelterSensConfig] = useState({
    serviceId: '',
    accessKey: '',
    secretKey: '',
    from: ''
  });
  
  // 초호펜션 텔레그램 설정 (봇 토큰은 서버에서 관리)
  const [chohoTelegramConfig, setChohoTelegramConfig] = useState({
    botToken: '', // Firestore에서 로드 (보안)
    chatId: '', // Firestore에서 로드
    useReservation: true,
    useCancellation: true,
    autoSendDaily: true
  });
  
  // 초호쉼터 텔레그램 설정
  const [shelterTelegramConfig, setShelterTelegramConfig] = useState({
    botToken: '',
    chatId: '',
    useReservation: true,
    useCancellation: true,
    autoSendDaily: true
  });
  
  // 초호펜션 자동 발송 설정
  const [chohoAutoSendConfig, setChohoAutoSendConfig] = useState({
    checkInEnabled: true,
    checkInHoursBefore: 3,
    checkOutEnabled: true,
    checkOutHoursBefore: 1,
    confirmationEnabled: false,
    cancellationEnabled: false
  });
  
  // 초호펜션 문자 발송 객실 설정
  const [chohoSmsRooms, setChohoSmsRooms] = useState({
    'Forest': true,
    'Forest mini': true,
    'Forest mini 패밀리': true,
    'Forest 패밀리': true
  });
  
  // 초호쉼터 자동 발송 설정
  const [shelterAutoSendConfig, setShelterAutoSendConfig] = useState({
    checkInEnabled: true,
    checkInHoursBefore: 3,
    checkOutEnabled: true,
    checkOutHoursBefore: 1,
    confirmationEnabled: false,
    cancellationEnabled: false
  });
  
  // 초호쉼터 문자 발송 객실 설정
  const [shelterSmsRooms, setShelterSmsRooms] = useState({
    '호수뷰객실': true,
    '1박2일워크샵': true,
    '야유회': true
  });
  
  // 설정 불러오기
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    setLoading(true);
    try {
      // 초호펜션 설정 로드
      const chohoDocRef = doc(db, 'settings', 'notifications_choho');
      const chohoDocSnap = await getDoc(chohoDocRef);
      
      if (chohoDocSnap.exists()) {
        const data = chohoDocSnap.data();
        if (data.sens) setChohoSensConfig(data.sens);
        if (data.telegram) {
          setChohoTelegramConfig({
            botToken: data.telegram.botToken || '', // 서버에서 관리
            chatId: data.telegram.chatId || '',
            useReservation: data.telegram.useReservation !== undefined ? data.telegram.useReservation : true,
            useCancellation: data.telegram.useCancellation !== undefined ? data.telegram.useCancellation : true,
            autoSendDaily: data.telegram.autoSendDaily !== undefined ? data.telegram.autoSendDaily : true
          });
        }
        if (data.autoSend) setChohoAutoSendConfig(data.autoSend);
        if (data.smsRooms) setChohoSmsRooms(data.smsRooms);
      } else {
        // 기존 설정 마이그레이션 (있다면)
        const oldDocRef = doc(db, 'settings', 'notifications');
        const oldDocSnap = await getDoc(oldDocRef);
        
        if (oldDocSnap.exists()) {
          const data = oldDocSnap.data();
          if (data.sens) setChohoSensConfig(data.sens);
          if (data.telegram) setChohoTelegramConfig(data.telegram);
          if (data.autoSend) setChohoAutoSendConfig(data.autoSend);
          
          // 초호펜션 설정으로 저장
          await setDoc(chohoDocRef, data);
          console.log('기존 설정을 초호펜션 설정으로 마이그레이션했습니다.');
        }
      }
      
      // 초호쉼터 설정 로드
      const shelterDocRef = doc(db, 'settings', 'notifications_shelter');
      const shelterDocSnap = await getDoc(shelterDocRef);
      
      if (shelterDocSnap.exists()) {
        const data = shelterDocSnap.data();
        if (data.sens) setShelterSensConfig(data.sens);
        if (data.telegram) setShelterTelegramConfig(data.telegram);
        if (data.autoSend) setShelterAutoSendConfig(data.autoSend);
        if (data.smsRooms) setShelterSmsRooms(data.smsRooms);
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
      alert('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // SENS 설정 저장
  const saveSensConfig = async (type) => {
    setLoading(true);
    const config = type === 'choho' ? chohoSensConfig : shelterSensConfig;
    const docName = type === 'choho' ? 'notifications_choho' : 'notifications_shelter';
    
    try {
      // Firestore에 저장
      await setDoc(doc(db, 'settings', docName), {
        sens: config,
        rooms: ROOM_GROUPS[type].rooms // 해당 객실 목록도 저장
      }, { merge: true });
      
      alert(`${ROOM_GROUPS[type].name} SENS 설정이 저장되었습니다.`);
    } catch (error) {
      console.error('SENS 설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 텔레그램 설정 저장
  const saveTelegramConfig = async (type) => {
    setLoading(true);
    const config = type === 'choho' ? chohoTelegramConfig : shelterTelegramConfig;
    const docName = type === 'choho' ? 'notifications_choho' : 'notifications_shelter';
    
    try {
      // Firestore에 저장
      await setDoc(doc(db, 'settings', docName), {
        telegram: config,
        rooms: ROOM_GROUPS[type].rooms
      }, { merge: true });
      
      alert(`${ROOM_GROUPS[type].name} 텔레그램 설정이 저장되었습니다.`);
    } catch (error) {
      console.error('텔레그램 설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 자동 발송 설정 저장
  const saveAutoSendConfig = async (type) => {
    setLoading(true);
    const config = type === 'choho' ? chohoAutoSendConfig : shelterAutoSendConfig;
    const docName = type === 'choho' ? 'notifications_choho' : 'notifications_shelter';
    
    try {
      await setDoc(doc(db, 'settings', docName), {
        autoSend: config,
        rooms: ROOM_GROUPS[type].rooms
      }, { merge: true });
      
      alert(`${ROOM_GROUPS[type].name} 자동 발송 설정이 저장되었습니다.`);
    } catch (error) {
      console.error('자동 발송 설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // SMS 객실 설정 저장
  const saveSmsRoomsConfig = async (type) => {
    setLoading(true);
    const smsRooms = type === 'choho' ? chohoSmsRooms : shelterSmsRooms;
    const docName = type === 'choho' ? 'notifications_choho' : 'notifications_shelter';
    
    try {
      await setDoc(doc(db, 'settings', docName), {
        smsRooms: smsRooms
      }, { merge: true });
      
      alert(`${ROOM_GROUPS[type].name} SMS 객실 설정이 저장되었습니다.`);
    } catch (error) {
      console.error('SMS 객실 설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // SENS 연결 테스트
  const testSensConnection = async (type) => {
    setTesting(true);
    const config = type === 'choho' ? chohoSensConfig : shelterSensConfig;
    
    try {
      sensService.initialize(config);
      const result = await sensService.testConnection();
      
      if (result) {
        alert(`${ROOM_GROUPS[type].name} SENS 연결 테스트 성공!`);
      } else {
        alert(`${ROOM_GROUPS[type].name} SENS 연결 테스트 실패. 설정을 확인해주세요.`);
      }
    } catch (error) {
      console.error('SENS 테스트 실패:', error);
      alert('연결 테스트 중 오류가 발생했습니다.');
    } finally {
      setTesting(false);
    }
  };
  
  // 텔레그램 연결 테스트
  const testTelegramConnection = async (type) => {
    setTesting(true);
    const config = type === 'choho' ? chohoTelegramConfig : shelterTelegramConfig;
    
    try {
      telegramService.initialize(config);
      const result = await telegramService.testConnection();
      
      if (result) {
        alert(`${ROOM_GROUPS[type].name} 텔레그램 연결 테스트 성공! 테스트 메시지를 확인해주세요.`);
      } else {
        alert(`${ROOM_GROUPS[type].name} 텔레그램 연결 테스트 실패. 설정을 확인해주세요.`);
      }
    } catch (error) {
      console.error('텔레그램 테스트 실패:', error);
      alert('연결 테스트 중 오류가 발생했습니다.');
    } finally {
      setTesting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>설정을 불러오는 중...</p>
      </div>
    );
  }
  
  // 현재 탭에 따른 설정 가져오기
  const currentSensConfig = activeTab === 'choho' ? chohoSensConfig : shelterSensConfig;
  const setCurrentSensConfig = activeTab === 'choho' ? setChohoSensConfig : setShelterSensConfig;
  const currentTelegramConfig = activeTab === 'choho' ? chohoTelegramConfig : shelterTelegramConfig;
  const setCurrentTelegramConfig = activeTab === 'choho' ? setChohoTelegramConfig : setShelterTelegramConfig;
  const currentAutoSendConfig = activeTab === 'choho' ? chohoAutoSendConfig : shelterAutoSendConfig;
  const setCurrentAutoSendConfig = activeTab === 'choho' ? setChohoAutoSendConfig : setShelterAutoSendConfig;
  
  return (
    <div className="notification-settings">
      <h2>📱 알림 설정</h2>
      
      {/* 탭 네비게이션 */}
      <div className="notification-tabs">
        <button
          className={`tab-button ${activeTab === 'choho' ? 'active' : ''}`}
          onClick={() => setActiveTab('choho')}
        >
          🏠 초호펜션
        </button>
        <button
          className={`tab-button ${activeTab === 'shelter' ? 'active' : ''}`}
          onClick={() => setActiveTab('shelter')}
        >
          🏡 초호쉼터
        </button>
      </div>
      
      {/* 현재 탭 정보 */}
      <div className="tab-info">
        <h3>{ROOM_GROUPS[activeTab].name} 알림 설정</h3>
        <div className="room-list">
          <strong>대상 객실:</strong> {ROOM_GROUPS[activeTab].rooms.join(', ')}
        </div>
      </div>
      
      {/* SENS 설정 */}
      <div className="settings-section">
        <h3>📨 네이버 SENS 설정</h3>
        <div className="settings-card">
          <div className="form-group">
            <label>서비스 ID</label>
            <input
              type="text"
              value={currentSensConfig.serviceId}
              onChange={(e) => setCurrentSensConfig({...currentSensConfig, serviceId: e.target.value})}
              placeholder="ncp:sms:kr:000000000000:service-name"
            />
          </div>
          
          <div className="form-group">
            <label>액세스 키</label>
            <input
              type="text"
              value={currentSensConfig.accessKey}
              onChange={(e) => setCurrentSensConfig({...currentSensConfig, accessKey: e.target.value})}
              placeholder="네이버 클라우드 플랫폼 액세스 키"
            />
          </div>
          
          <div className="form-group">
            <label>시크릿 키</label>
            <input
              type="password"
              value={currentSensConfig.secretKey}
              onChange={(e) => setCurrentSensConfig({...currentSensConfig, secretKey: e.target.value})}
              placeholder="네이버 클라우드 플랫폼 시크릿 키"
            />
          </div>
          
          <div className="form-group">
            <label>발신번호</label>
            <input
              type="tel"
              value={currentSensConfig.from}
              onChange={(e) => setCurrentSensConfig({...currentSensConfig, from: e.target.value})}
              placeholder="010-0000-0000 (사전 등록 필요)"
            />
          </div>
          
          <div className="button-group">
            <button 
              onClick={() => testSensConnection(activeTab)} 
              className="btn btn-secondary"
              disabled={testing || !currentSensConfig.serviceId || !currentSensConfig.accessKey}
            >
              {testing ? '테스트 중...' : '연결 테스트'}
            </button>
            <button 
              onClick={() => saveSensConfig(activeTab)} 
              className="btn btn-primary"
              disabled={loading}
            >
              저장
            </button>
          </div>
        </div>
      </div>
      
      {/* 텔레그램 설정 */}
      <div className="settings-section">
        <h3>💬 텔레그램 설정</h3>
        <div className="settings-card">
          <div className="form-group">
            <label>봇 토큰</label>
            <input
              type="password"
              value={currentTelegramConfig.botToken}
              onChange={(e) => setCurrentTelegramConfig({...currentTelegramConfig, botToken: e.target.value})}
              placeholder="0000000000:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            />
          </div>
          
          <div className="form-group">
            <label>채팅 ID</label>
            <input
              type="text"
              value={currentTelegramConfig.chatId}
              onChange={(e) => setCurrentTelegramConfig({...currentTelegramConfig, chatId: e.target.value})}
              placeholder="-1000000000000"
            />
          </div>
          
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={currentTelegramConfig.useReservation}
                onChange={(e) => setCurrentTelegramConfig({...currentTelegramConfig, useReservation: e.target.checked})}
              />
              예약 알림 사용
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={currentTelegramConfig.useCancellation}
                onChange={(e) => setCurrentTelegramConfig({...currentTelegramConfig, useCancellation: e.target.checked})}
              />
              취소 알림 사용
            </label>
            
            <label style={{display: 'block', marginTop: '10px', background: '#fffbeb', padding: '8px', borderRadius: '4px', border: '1px solid #fcd34d'}}>
              <input
                type="checkbox"
                checked={currentTelegramConfig.autoSendDaily}
                onChange={(e) => setCurrentTelegramConfig({...currentTelegramConfig, autoSendDaily: e.target.checked})}
              />
              <strong>📆 일일 현황 자동 발송</strong>
              <small style={{display: 'block', marginLeft: '22px', color: '#92400e'}}>
                매일 오전 9시에 입실/퇴실/현재투숙 현황을 자동으로 발송합니다
              </small>
            </label>
          </div>
          
          <div className="button-group">
            <button 
              onClick={() => testTelegramConnection(activeTab)} 
              className="btn btn-secondary"
              disabled={testing || !currentTelegramConfig.botToken || !currentTelegramConfig.chatId}
            >
              {testing ? '테스트 중...' : '연결 테스트'}
            </button>
            <button 
              onClick={() => saveTelegramConfig(activeTab)} 
              className="btn btn-primary"
              disabled={loading}
            >
              저장
            </button>
          </div>
        </div>
      </div>
      
      {/* SMS 객실 설정 */}
      <div className="settings-section">
        <h3>📧 SMS 발송 객실 설정</h3>
        <div className="settings-card">
          <div className="checkbox-group">
            {ROOM_GROUPS[activeTab].rooms.map(room => (
              <label key={room}>
                <input
                  type="checkbox"
                  checked={activeTab === 'choho' ? chohoSmsRooms[room] : shelterSmsRooms[room]}
                  onChange={(e) => {
                    if (activeTab === 'choho') {
                      setChohoSmsRooms({ ...chohoSmsRooms, [room]: e.target.checked });
                    } else {
                      setShelterSmsRooms({ ...shelterSmsRooms, [room]: e.target.checked });
                    }
                  }}
                />
                {room}
              </label>
            ))}
          </div>
          
          <div className="button-group">
            <button 
              onClick={() => {
                const newSettings = activeTab === 'choho' ? { ...chohoSmsRooms } : { ...shelterSmsRooms };
                Object.keys(newSettings).forEach(key => newSettings[key] = true);
                if (activeTab === 'choho') {
                  setChohoSmsRooms(newSettings);
                } else {
                  setShelterSmsRooms(newSettings);
                }
              }} 
              className="btn btn-secondary"
            >
              전체 선택
            </button>
            <button 
              onClick={() => {
                const newSettings = activeTab === 'choho' ? { ...chohoSmsRooms } : { ...shelterSmsRooms };
                Object.keys(newSettings).forEach(key => newSettings[key] = false);
                if (activeTab === 'choho') {
                  setChohoSmsRooms(newSettings);
                } else {
                  setShelterSmsRooms(newSettings);
                }
              }} 
              className="btn btn-secondary"
            >
              전체 해제
            </button>
            <button 
              onClick={() => saveSmsRoomsConfig(activeTab)} 
              className="btn btn-primary"
              disabled={loading}
            >
              저장
            </button>
          </div>
        </div>
      </div>
      
      {/* 자동 발송 설정 */}
      <div className="settings-section">
        <h3>⏰ 자동 발송 설정</h3>
        <div className="settings-card">
          <div className="auto-send-item">
            <label>
              <input
                type="checkbox"
                checked={currentAutoSendConfig.checkInEnabled}
                onChange={(e) => setCurrentAutoSendConfig({...currentAutoSendConfig, checkInEnabled: e.target.checked})}
              />
              입실 안내 자동 발송
            </label>
            <div className="time-setting">
              <span>발송 시간: 입실</span>
              <input
                type="number"
                min="1"
                max="24"
                value={currentAutoSendConfig.checkInHoursBefore}
                onChange={(e) => setCurrentAutoSendConfig({...currentAutoSendConfig, checkInHoursBefore: parseInt(e.target.value)})}
                disabled={!currentAutoSendConfig.checkInEnabled}
              />
              <span>시간 전</span>
            </div>
          </div>
          
          <div className="auto-send-item">
            <label>
              <input
                type="checkbox"
                checked={currentAutoSendConfig.checkOutEnabled}
                onChange={(e) => setCurrentAutoSendConfig({...currentAutoSendConfig, checkOutEnabled: e.target.checked})}
              />
              퇴실 안내 자동 발송
            </label>
            <div className="time-setting">
              <span>발송 시간: 퇴실</span>
              <input
                type="number"
                min="1"
                max="24"
                value={currentAutoSendConfig.checkOutHoursBefore}
                onChange={(e) => setCurrentAutoSendConfig({...currentAutoSendConfig, checkOutHoursBefore: parseInt(e.target.value)})}
                disabled={!currentAutoSendConfig.checkOutEnabled}
              />
              <span>시간 전</span>
            </div>
          </div>
          
          <div className="auto-send-item">
            <label>
              <input
                type="checkbox"
                checked={currentAutoSendConfig.confirmationEnabled}
                onChange={(e) => setCurrentAutoSendConfig({...currentAutoSendConfig, confirmationEnabled: e.target.checked})}
              />
              예약 확정 문자 발송
            </label>
            <div className="time-info">
              <span>예약 확정 시 즉시 발송</span>
            </div>
          </div>
          
          <div className="auto-send-item">
            <label>
              <input
                type="checkbox"
                checked={currentAutoSendConfig.cancellationEnabled}
                onChange={(e) => setCurrentAutoSendConfig({...currentAutoSendConfig, cancellationEnabled: e.target.checked})}
              />
              예약 취소 문자 발송
            </label>
            <div className="time-info">
              <span>예약 취소 시 즉시 발송</span>
            </div>
          </div>
          
          <div className="button-group">
            <button 
              onClick={() => saveAutoSendConfig(activeTab)} 
              className="btn btn-primary"
              disabled={loading}
            >
              저장
            </button>
          </div>
        </div>
      </div>
      
      <div className="settings-info">
        <h4>📌 주의사항</h4>
        <ul>
          <li>네이버 SENS 사용을 위해서는 네이버 클라우드 플랫폼 가입이 필요합니다.</li>
          <li>발신번호는 사전에 등록된 번호만 사용 가능합니다.</li>
          <li>텔레그램 봇은 미리 생성하고 채널에 추가해야 합니다.</li>
          <li>자동 발송은 10분 간격으로 체크됩니다.</li>
          <li>레이트 체크아웃 옵션이 있는 경우 퇴실 시간이 자동 조정됩니다.</li>
          <li style={{fontWeight: 'bold', color: '#ea580c'}}>
            📆 일일 현황 자동 발송은 매일 오전 9시(한국 시간)에 수행됩니다.
          </li>
          <li style={{fontWeight: 'bold', color: '#0284c7'}}>
            🏠 초호펜션과 초호쉼터는 각각 독립적으로 알림이 발송됩니다.
          </li>
          <li style={{fontWeight: 'bold', color: '#059669'}}>
            📧 SMS는 객실별로 발송 여부를 설정할 수 있습니다. 체크된 객실만 SMS가 발송됩니다.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationSettings;
