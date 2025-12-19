// src/components/NotificationSettingsV2.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import sensService from '../services/sensService';
import telegramService from '../services/telegramService';
import RoomNotificationCardSafe from './RoomNotificationCardSafe';
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

const NotificationSettingsV2 = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('choho');
  
  // 전역 설정 (SENS, 텔레그램)
  const [globalSettings, setGlobalSettings] = useState({
    choho: {
      sens: {
        serviceId: '',
        accessKey: '',
        secretKey: '',
        from: ''
      },
      telegram: {
        botToken: import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '',
        chatId: import.meta.env.VITE_TELEGRAM_CHAT_ID || '',
        useReservation: true,
        useCancellation: true,
        autoSendDaily: true
      }
    },
    shelter: {
      sens: {
        serviceId: '',
        accessKey: '',
        secretKey: '',
        from: ''
      },
      telegram: {
        botToken: '',
        chatId: '',
        useReservation: true,
        useCancellation: true,
        autoSendDaily: true
      }
    }
  });

  // 객실별 설정
  const [roomSettings, setRoomSettings] = useState({
    choho: {},
    shelter: {}
  });

  // 설정 불러오기
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // V2 설정 먼저 확인
      const chohoV2DocRef = doc(db, 'settings', 'notifications_v2_choho');
      const shelterV2DocRef = doc(db, 'settings', 'notifications_v2_shelter');
      
      let chohoLoaded = false;
      let shelterLoaded = false;

      // 초호펜션 V2 설정 로드
      const chohoV2DocSnap = await getDoc(chohoV2DocRef);
      if (chohoV2DocSnap.exists()) {
        const data = chohoV2DocSnap.data();
        setGlobalSettings(prev => ({
          ...prev,
          choho: data.globalSettings || prev.choho
        }));
        setRoomSettings(prev => ({
          ...prev,
          choho: data.roomSettings || {}
        }));
        chohoLoaded = true;
      }

      // 초호쉼터 V2 설정 로드
      const shelterV2DocSnap = await getDoc(shelterV2DocRef);
      if (shelterV2DocSnap.exists()) {
        const data = shelterV2DocSnap.data();
        setGlobalSettings(prev => ({
          ...prev,
          shelter: data.globalSettings || prev.shelter
        }));
        setRoomSettings(prev => ({
          ...prev,
          shelter: data.roomSettings || {}
        }));
        shelterLoaded = true;
      }

      // V2 설정이 없으면 기존 설정에서 마이그레이션
      if (!chohoLoaded) {
        const oldChohoDocRef = doc(db, 'settings', 'notifications_choho');
        const oldChohoDocSnap = await getDoc(oldChohoDocRef);
        
        if (oldChohoDocSnap.exists()) {
          const data = oldChohoDocSnap.data();
          
          // 전역 설정 마이그레이션
          setGlobalSettings(prev => ({
            ...prev,
            choho: {
              sens: data.sens || prev.choho.sens,
              telegram: data.telegram || prev.choho.telegram
            }
          }));
          
          // 객실별 설정 초기화 (기존 설정을 기반으로)
          const newRoomSettings = {};
          ROOM_GROUPS.choho.rooms.forEach(room => {
            newRoomSettings[room] = {
              enabled: data.smsRooms?.[room] !== false,
              templates: null, // 나중에 기본값 사용
              autoSend: data.autoSend || {
                checkInEnabled: true,
                checkInHoursBefore: 3,
                checkOutEnabled: true,
                checkOutHoursBefore: 1,
                confirmationEnabled: false,
                cancellationEnabled: false
              }
            };
          });
          
          setRoomSettings(prev => ({
            ...prev,
            choho: newRoomSettings
          }));
        }
      }

      if (!shelterLoaded) {
        const oldShelterDocRef = doc(db, 'settings', 'notifications_shelter');
        const oldShelterDocSnap = await getDoc(oldShelterDocRef);
        
        if (oldShelterDocSnap.exists()) {
          const data = oldShelterDocSnap.data();
          
          setGlobalSettings(prev => ({
            ...prev,
            shelter: {
              sens: data.sens || prev.shelter.sens,
              telegram: data.telegram || prev.shelter.telegram
            }
          }));
          
          const newRoomSettings = {};
          ROOM_GROUPS.shelter.rooms.forEach(room => {
            newRoomSettings[room] = {
              enabled: data.smsRooms?.[room] !== false,
              templates: null,
              autoSend: data.autoSend || {
                checkInEnabled: true,
                checkInHoursBefore: 3,
                checkOutEnabled: true,
                checkOutHoursBefore: 1,
                confirmationEnabled: false,
                cancellationEnabled: false
              }
            };
          });
          
          setRoomSettings(prev => ({
            ...prev,
            shelter: newRoomSettings
          }));
        }
      }

    } catch (error) {
      console.error('설정 로드 실패:', error);
      alert('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 전역 설정 저장
  const saveGlobalSettings = async (type) => {
    setLoading(true);
    try {
      const docName = `notifications_v2_${type}`;
      const currentDoc = await getDoc(doc(db, 'settings', docName));
      
      // 현재 문서가 있으면 업데이트, 없으면 생성
      if (currentDoc.exists()) {
        await updateDoc(doc(db, 'settings', docName), {
          globalSettings: globalSettings[type],
          roomSettings: roomSettings[type],
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, 'settings', docName), {
          globalSettings: globalSettings[type],
          roomSettings: roomSettings[type],
          updatedAt: new Date().toISOString()
        });
      }
      
      alert(`${ROOM_GROUPS[type].name} 전역 설정이 저장되었습니다.`);
    } catch (error) {
      console.error('전역 설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // SENS 설정 저장
  const saveSensConfig = async (type) => {
    await saveGlobalSettings(type);
  };

  // 텔레그램 설정 저장
  const saveTelegramConfig = async (type) => {
    await saveGlobalSettings(type);
  };

  // 객실별 설정 업데이트 및 저장
  const updateAndSaveRoomSettings = useCallback(async (room, settings) => {
    console.log('Updating and saving room settings:', room, settings);
    
    // 먼저 state 업데이트
    const newRoomSettings = {
      ...roomSettings[activeTab],
      [room]: settings
    };
    
    setRoomSettings(prev => ({
      ...prev,
      [activeTab]: newRoomSettings
    }));
    
    // 저장을 위한 데이터 준비
    setLoading(true);
    try {
      const docName = `notifications_v2_${activeTab}`;
      
      // 업데이트된 설정으로 저장
      const updatedData = {
        globalSettings: globalSettings[activeTab],
        roomSettings: newRoomSettings,  // 새로 업데이트된 설정 사용
        updatedAt: new Date().toISOString()
      };
      
      console.log('Saving to Firebase:', docName, updatedData);
      
      // Firebase에 저장
      await setDoc(doc(db, 'settings', docName), updatedData);
      
      console.log('Room settings saved successfully:', room);
      alert(`${room} 객실 설정이 저장되었습니다.`);
      
    } catch (error) {
      console.error('객실 설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, globalSettings, roomSettings]);

  // 모든 객실 설정 한번에 저장
  const saveAllRoomSettings = useCallback(async () => {
    setLoading(true);
    try {
      const docName = `notifications_v2_${activeTab}`;
      
      // 현재 메모리의 설정을 그대로 저장
      const updatedData = {
        globalSettings: globalSettings[activeTab],
        roomSettings: roomSettings[activeTab],
        updatedAt: new Date().toISOString()
      };
      
      console.log('Saving all room settings:', docName, updatedData);
      
      // Firebase에 저장
      await setDoc(doc(db, 'settings', docName), updatedData);
      
      console.log('All room settings saved successfully');
      alert(`${ROOM_GROUPS[activeTab].name}의 모든 객실 설정이 저장되었습니다.`);
      
      // loadSettings()를 호출하지 않음 - 현재 메모리 상태 유지
      
    } catch (error) {
      console.error('객실 설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, roomSettings, globalSettings]);

  // SENS 연결 테스트
  const testSensConnection = async (type) => {
    setTesting(true);
    const config = globalSettings[type].sens;
    
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
    const config = globalSettings[type].telegram;
    
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

  const currentGlobalSettings = globalSettings[activeTab];
  const currentRoomSettings = roomSettings[activeTab];

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
      
      {/* 전역 설정 섹션 */}
      <div className="global-settings-section">
        <h3>🌐 전역 설정</h3>
        
        {/* SENS 설정 */}
        <div className="settings-section">
          <h4>📨 네이버 SENS 설정</h4>
          <div className="settings-card">
            <div className="form-group">
              <label>서비스 ID</label>
              <input
                type="text"
                value={currentGlobalSettings.sens.serviceId}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  [activeTab]: {
                    ...prev[activeTab],
                    sens: { ...prev[activeTab].sens, serviceId: e.target.value }
                  }
                }))}
                placeholder="ncp:sms:kr:000000000000:service-name"
              />
            </div>
            
            <div className="form-group">
              <label>액세스 키</label>
              <input
                type="text"
                value={currentGlobalSettings.sens.accessKey}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  [activeTab]: {
                    ...prev[activeTab],
                    sens: { ...prev[activeTab].sens, accessKey: e.target.value }
                  }
                }))}
                placeholder="네이버 클라우드 플랫폼 액세스 키"
              />
            </div>
            
            <div className="form-group">
              <label>시크릿 키</label>
              <input
                type="password"
                value={currentGlobalSettings.sens.secretKey}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  [activeTab]: {
                    ...prev[activeTab],
                    sens: { ...prev[activeTab].sens, secretKey: e.target.value }
                  }
                }))}
                placeholder="네이버 클라우드 플랫폼 시크릿 키"
              />
            </div>
            
            <div className="form-group">
              <label>발신번호</label>
              <input
                type="tel"
                value={currentGlobalSettings.sens.from}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  [activeTab]: {
                    ...prev[activeTab],
                    sens: { ...prev[activeTab].sens, from: e.target.value }
                  }
                }))}
                placeholder="010-0000-0000 (사전 등록 필요)"
              />
            </div>
            
            <div className="button-group">
              <button 
                onClick={() => testSensConnection(activeTab)} 
                className="btn btn-secondary"
                disabled={testing || !currentGlobalSettings.sens.serviceId}
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
          <h4>💬 텔레그램 설정</h4>
          <div className="settings-card">
            <div className="form-group">
              <label>봇 토큰</label>
              <input
                type="password"
                value={currentGlobalSettings.telegram.botToken}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  [activeTab]: {
                    ...prev[activeTab],
                    telegram: { ...prev[activeTab].telegram, botToken: e.target.value }
                  }
                }))}
                placeholder="0000000000:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              />
            </div>
            
            <div className="form-group">
              <label>채팅 ID</label>
              <input
                type="text"
                value={currentGlobalSettings.telegram.chatId}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  [activeTab]: {
                    ...prev[activeTab],
                    telegram: { ...prev[activeTab].telegram, chatId: e.target.value }
                  }
                }))}
                placeholder="-1000000000000"
              />
            </div>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={currentGlobalSettings.telegram.useReservation}
                  onChange={(e) => setGlobalSettings(prev => ({
                    ...prev,
                    [activeTab]: {
                      ...prev[activeTab],
                      telegram: { ...prev[activeTab].telegram, useReservation: e.target.checked }
                    }
                  }))}
                />
                예약 알림 사용
              </label>
              
              <label>
                <input
                  type="checkbox"
                  checked={currentGlobalSettings.telegram.useCancellation}
                  onChange={(e) => setGlobalSettings(prev => ({
                    ...prev,
                    [activeTab]: {
                      ...prev[activeTab],
                      telegram: { ...prev[activeTab].telegram, useCancellation: e.target.checked }
                    }
                  }))}
                />
                취소 알림 사용
              </label>
              
              <label style={{display: 'block', marginTop: '10px', background: '#fffbeb', padding: '8px', borderRadius: '4px', border: '1px solid #fcd34d'}}>
                <input
                  type="checkbox"
                  checked={currentGlobalSettings.telegram.autoSendDaily}
                  onChange={(e) => setGlobalSettings(prev => ({
                    ...prev,
                    [activeTab]: {
                      ...prev[activeTab],
                      telegram: { ...prev[activeTab].telegram, autoSendDaily: e.target.checked }
                    }
                  }))}
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
                disabled={testing || !currentGlobalSettings.telegram.botToken}
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
      </div>

      {/* 객실별 설정 섹션 */}
      <div className="room-settings-section">
        <div className="section-header">
          <h3>🏠 객실별 알림 설정</h3>
          <button
            className="btn btn-primary"
            onClick={saveAllRoomSettings}
            disabled={loading}
          >
            모든 객실 설정 저장
          </button>
        </div>
        
        <div className="room-cards-container">
          {ROOM_GROUPS[activeTab].rooms.map(room => (
            <RoomNotificationCardSafe
              key={room}
              roomName={room}
              settings={currentRoomSettings ? currentRoomSettings[room] : null}
              onSave={updateAndSaveRoomSettings}
              loading={loading}
            />
          ))}
        </div>
      </div>
      
      {/* 안내 사항 */}
      <div className="settings-info">
        <h4>📌 주의사항</h4>
        <ul>
          <li>네이버 SENS 사용을 위해서는 네이버 클라우드 플랫폼 가입이 필요합니다.</li>
          <li>발신번호는 사전에 등록된 번호만 사용 가능합니다.</li>
          <li>텔레그램 봇은 미리 생성하고 채널에 추가해야 합니다.</li>
          <li>자동 발송은 10분 간격으로 체크됩니다.</li>
          <li style={{fontWeight: 'bold', color: '#059669'}}>
            🎯 각 객실별로 다른 메시지 템플릿과 발송 시간을 설정할 수 있습니다.
          </li>
          <li style={{fontWeight: 'bold', color: '#dc2626'}}>
            ⚡ 객실별 설정은 펼쳐서 상세 설정을 확인하고 수정할 수 있습니다.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationSettingsV2;
