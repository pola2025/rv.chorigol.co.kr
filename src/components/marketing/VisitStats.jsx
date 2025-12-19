// src/components/marketing/VisitStats.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import './VisitStats.css';

const VisitStats = ({ selectedMonth, businessType = 'pension' }) => {
  const [channels, setChannels] = useState([]);
  const [visitData, setVisitData] = useState({});
  const [newChannel, setNewChannel] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tempData, setTempData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // 초기 로드 여부 추적
  const initialLoadRef = useRef(false);
  const monthKeyRef = useRef('');

  // 초기 채널 목록 로드 (컴포넌트 마운트 시 한 번만)
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadInitialData();
    }
  }, []);

  // 월 변경 시 방문 데이터만 다시 로드
  useEffect(() => {
    const newMonthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`;
    if (monthKeyRef.current !== newMonthKey && channels.length > 0) {
      monthKeyRef.current = newMonthKey;
      loadVisitDataForMonth(newMonthKey);
    }
  }, [selectedMonth]);

  // 초기 데이터 로드 (채널 + 방문 데이터)
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. 채널 목록 로드 (사업장별)
      const channelDocId = businessType === 'pension' ? 'channels_pension' : 'channels_shelter';
      const channelsDoc = await getDoc(doc(db, 'visit_channels', channelDocId));
      
      const defaultChannels = businessType === 'pension' 
        ? ['홈페이지', '네이버 플레이스', '인스타그램', '직접 방문']
        : ['네이버 플레이스', '단체 문의', '직접 방문', '기타'];
      
      const loadedChannels = channelsDoc.exists() 
        ? channelsDoc.data().channels 
        : defaultChannels;
      
      setChannels(loadedChannels);
      
      // 2. 현재 월의 방문 데이터 로드
      const monthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}_${businessType}`;
      monthKeyRef.current = monthKey;
      
      const visitDoc = await getDoc(doc(db, 'monthly_visits', monthKey));
      
      if (visitDoc.exists()) {
        const data = visitDoc.data();
        // 실제 채널 데이터만 필터링
        const filteredData = {};
        loadedChannels.forEach(channel => {
          if (data[channel]) {
            filteredData[channel] = data[channel];
          } else {
            filteredData[channel] = { visitors: 0, pageviews: 0 };
          }
        });
        setVisitData(filteredData);
      } else {
        // 초기 데이터 설정
        const initialData = {};
        loadedChannels.forEach(channel => {
          initialData[channel] = { visitors: 0, pageviews: 0 };
        });
        setVisitData(initialData);
      }
    } catch (error) {
      console.error('초기 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 월별 방문 데이터만 로드
  const loadVisitDataForMonth = async (monthKey) => {
    try {
      const visitDocId = `${monthKey}_${businessType}`;
      const visitDoc = await getDoc(doc(db, 'monthly_visits', visitDocId));
      
      if (visitDoc.exists()) {
        const data = visitDoc.data();
        const filteredData = {};
        channels.forEach(channel => {
          if (data[channel]) {
            filteredData[channel] = data[channel];
          } else {
            filteredData[channel] = { visitors: 0, pageviews: 0 };
          }
        });
        setVisitData(filteredData);
      } else {
        const initialData = {};
        channels.forEach(channel => {
          initialData[channel] = { visitors: 0, pageviews: 0 };
        });
        setVisitData(initialData);
      }
    } catch (error) {
      console.error('방문 데이터 로드 오류:', error);
    }
  };

  // 채널 추가
  const handleAddChannel = async () => {
    if (!newChannel.trim()) return;
    if (channels.includes(newChannel.trim())) {
      alert('이미 존재하는 채널입니다.');
      return;
    }

    const updatedChannels = [...channels, newChannel.trim()];
    
    try {
      // Firestore 업데이트 (사업장별)
      const channelDocId = businessType === 'pension' ? 'channels_pension' : 'channels_shelter';
      await setDoc(doc(db, 'visit_channels', channelDocId), {
        channels: updatedChannels,
        updatedAt: new Date().toISOString()
      });
      
      // 로컬 상태 업데이트 (선언형)
      setChannels(updatedChannels);
      setVisitData(prevData => ({
        ...prevData,
        [newChannel.trim()]: { visitors: 0, pageviews: 0 }
      }));
      setNewChannel('');
      setShowAddChannel(false);
    } catch (error) {
      console.error('채널 추가 오류:', error);
      alert('채널 추가 중 오류가 발생했습니다.');
    }
  };

  // 채널 삭제
  const handleDeleteChannel = async (channel) => {
    if (!window.confirm(`"${channel}" 채널을 삭제하시겠습니까?`)) return;
    
    const updatedChannels = channels.filter(c => c !== channel);
    
    try {
      // 1. 채널 목록 업데이트 (사업장별)
      const channelDocId = businessType === 'pension' ? 'channels_pension' : 'channels_shelter';
      await setDoc(doc(db, 'visit_channels', channelDocId), {
        channels: updatedChannels,
        updatedAt: new Date().toISOString()
      });
      
      // 2. 현재 월의 방문 데이터에서도 해당 채널 제거
      const monthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}_${businessType}`;
      const { [channel]: removed, ...newVisitData } = visitData;
      
      // 남은 데이터가 있을 경우만 업데이트
      if (Object.keys(newVisitData).length > 0) {
        await setDoc(doc(db, 'monthly_visits', monthKey), {
          ...newVisitData,
          updatedAt: new Date().toISOString()
        });
      }
      
      // 3. 로컬 상태 업데이트 (선언형)
      setChannels(updatedChannels);
      setVisitData(newVisitData);
      
      console.log(`채널 '${channel}' 삭제 완료`);
    } catch (error) {
      console.error('채널 삭제 오류:', error);
      alert('채널 삭제 중 오류가 발생했습니다.');
    }
  };

  // 편집 모드 시작
  const handleEdit = () => {
    setIsEditing(true);
    setTempData({ ...visitData });
  };

  // 데이터 변경
  const handleDataChange = (channel, field, value) => {
    const numValue = value.replace(/[^0-9]/g, '');
    setTempData(prevData => ({
      ...prevData,
      [channel]: {
        ...prevData[channel],
        [field]: numValue ? parseInt(numValue) : 0
      }
    }));
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const monthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}_${businessType}`;
      await setDoc(doc(db, 'monthly_visits', monthKey), {
        ...tempData,
        updatedAt: new Date().toISOString()
      });
      
      setVisitData(tempData);
      setIsEditing(false);
    } catch (error) {
      console.error('방문 데이터 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 취소
  const handleCancel = () => {
    setTempData({});
    setIsEditing(false);
  };

  // 총 방문자 계산
  const calculateTotalVisitors = () => {
    return Object.values(visitData).reduce((sum, data) => {
      return sum + (data.visitors || 0);
    }, 0);
  };

  // 채널별 비중 계산
  const calculateChannelPercentage = (channel) => {
    const total = calculateTotalVisitors();
    if (total === 0) return 0;
    return ((visitData[channel]?.visitors || 0) / total * 100).toFixed(1);
  };

  const formatMonth = (year, month) => {
    return `${year}년 ${month}월`;
  };

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="visit-stats">
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="visit-stats">
      <div className="visit-stats-header">
        <h3>📈 방문 통계 - {formatMonth(selectedMonth.year, selectedMonth.month)} ({businessType === 'pension' ? '초호펜션' : '초호쉬터'})</h3>
        <div className="header-actions">
          {!isEditing ? (
            <>
              <button onClick={() => setShowAddChannel(true)} className="btn-add">
                + 채널 추가
              </button>
              <button onClick={handleEdit} className="btn-edit">
                데이터 입력
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleSave}
                className="btn-save"
                disabled={isSaving}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
              <button 
                onClick={handleCancel}
                className="btn-cancel"
                disabled={isSaving}
              >
                취소
              </button>
            </>
          )}
        </div>
      </div>

      {/* 전체 요약 */}
      <div className="visit-summary">
        <div className="summary-card">
          <h4>총 방문자</h4>
          <div className="summary-value">
            {calculateTotalVisitors().toLocaleString()}명
          </div>
        </div>
        <div className="summary-card">
          <h4>주요 유입 채널</h4>
          <div className="summary-value">
            {(() => {
              const maxChannel = Object.entries(visitData).reduce((max, [channel, data]) => {
                return (data.visitors || 0) > (max.visitors || 0) 
                  ? { channel, visitors: data.visitors } 
                  : max;
              }, { channel: '-', visitors: 0 });
              return maxChannel.channel;
            })()}
          </div>
        </div>
      </div>

      {/* 채널별 방문자 */}
      <div className="channel-list">
        <h4>채널별 방문자</h4>
        {channels.map(channel => (
          <div key={channel} className="channel-item">
            <div className="channel-info">
              <span className="channel-name">{channel}</span>
              {!isEditing && (
                <button 
                  onClick={() => handleDeleteChannel(channel)}
                  className="btn-delete-channel"
                  title="채널 삭제"
                >
                  ✕
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="channel-edit">
                <input
                  type="text"
                  value={tempData[channel]?.visitors || ''}
                  onChange={(e) => handleDataChange(channel, 'visitors', e.target.value)}
                  placeholder="방문자 수"
                />
                <span className="unit">명</span>
              </div>
            ) : (
              <div className="channel-stats">
                <span className="visitors">
                  {(visitData[channel]?.visitors || 0).toLocaleString()}명
                </span>
                <span className="percentage">
                  ({calculateChannelPercentage(channel)}%)
                </span>
              </div>
            )}
          </div>
        ))}

        {/* 채널 추가 입력 */}
        {showAddChannel && (
          <div className="add-channel-form">
            <input
              type="text"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              placeholder="새 채널명 입력"
              onKeyPress={(e) => e.key === 'Enter' && handleAddChannel()}
              autoFocus
            />
            <button onClick={handleAddChannel} className="btn-confirm">
              추가
            </button>
            <button 
              onClick={() => {
                setNewChannel('');
                setShowAddChannel(false);
              }}
              className="btn-cancel"
            >
              취소
            </button>
          </div>
        )}
      </div>

      {/* 시각화 */}
      <div className="visualization">
        <h4>채널별 방문 비중</h4>
        <div className="chart-container">
          {/* 간단한 막대 차트 */}
          <div className="bar-chart">
            {channels.map(channel => {
              const percentage = calculateChannelPercentage(channel);
              return (
                <div key={channel} className="bar-item">
                  <div className="bar-label">{channel}</div>
                  <div className="bar-wrapper">
                    <div 
                      className="bar-fill"
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 10 && `${percentage}%`}
                    </div>
                    {percentage <= 10 && (
                      <span className="bar-value">{percentage}%</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitStats;
