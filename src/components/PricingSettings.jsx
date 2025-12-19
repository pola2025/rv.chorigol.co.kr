// src/components/PricingSettings.jsx
import React, { useState, useEffect } from 'react';
import useFirebaseStore from '../stores/useFirebaseStore';
import { 
  collection, 
  doc, 
  updateDoc,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import './PricingSettings.css';

const PricingSettings = () => {
  const { rooms, pricingRules, loading } = useFirebaseStore();
  const [activeTab, setActiveTab] = useState('basic');
  const [roomPrices, setRoomPrices] = useState({});
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // 객실 가격 데이터 초기화 (실제 필드명 사용)
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      const prices = {};
      rooms.forEach(room => {
        prices[room.id] = {
          주중요금: room.주중요금 || room.기본요금 || 0,
          주말요금: room.주말요금 || room.기본요금 || 0,
          추가인원요금: room.추가인원요금 || 0
        };
      });
      setRoomPrices(prices);
    }
  }, [rooms]);

  // 가격 저장
  const saveRoomPrices = async () => {
    try {
      const promises = rooms.map(room => {
        const roomRef = doc(db, 'rooms', room.id);
        return updateDoc(roomRef, {
          주중요금: roomPrices[room.id]?.주중요금 || 0,
          주말요금: roomPrices[room.id]?.주말요금 || 0,
          추가인원요금: roomPrices[room.id]?.추가인원요금 || 0,
          updated: new Date()
        });
      });

      await Promise.all(promises);
      alert('가격이 저장되었습니다.');
    } catch (error) {
      console.error('가격 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 가격 규칙 추가
  const addPricingRule = async (ruleData) => {
    try {
      await addDoc(collection(db, 'pricing_rules'), {
        ...ruleData,
        created: new Date(),
        updated: new Date(),
        isActive: true
      });
      
      setIsAddingRule(false);
      alert('가격 규칙이 추가되었습니다.');
    } catch (error) {
      console.error('규칙 추가 오류:', error);
      alert('추가 중 오류가 발생했습니다.');
    }
  };

  // 가격 규칙 삭제
  const deletePricingRule = async (ruleId) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'pricing_rules', ruleId));
        alert('가격 규칙이 삭제되었습니다.');
      } catch (error) {
        console.error('규칙 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  if (loading.rooms) {
    return (
      <div className="pricing-settings">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>가격 설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="pricing-settings">
        <div className="empty-state">
          <h3>객실 정보가 없습니다</h3>
          <p>먼저 객실을 등록해주세요.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-retry"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-settings">
      <div className="settings-header">
        <h2>가격 설정</h2>
        <div className="price-info">
          <span className="info-badge weekday">주중: 일~금</span>
          <span className="info-badge weekend">주말: 토요일, 공휴일/전날</span>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="pricing-tabs">
        <button 
          className={activeTab === 'basic' ? 'active' : ''}
          onClick={() => setActiveTab('basic')}
        >
          기본 가격
        </button>
        <button 
          className={activeTab === 'rules' ? 'active' : ''}
          onClick={() => setActiveTab('rules')}
        >
          시즌 가격 규칙
        </button>
      </div>

      {/* 기본 가격 설정 */}
      {activeTab === 'basic' && (
        <div className="price-setting-section">
          <div className="section-header">
            <h3>객실별 기본 가격 설정</h3>
            <button onClick={saveRoomPrices} className="btn-save">
              저장
            </button>
          </div>
          
          <div className="room-price-grid">
            {rooms.map(room => (
              <div key={room.id} className="room-price-card">
                <div className="room-info">
                  <h4>{room.객실명}</h4>
                  <div className="room-specs">
                    <span className="room-capacity">
                      {room.기준인원}~{room.최대인원}인
                    </span>
                    <span className="room-inventory">재고: {room.재고}개</span>
                  </div>
                </div>
                
                <div className="price-inputs">
                  <div className="price-input-group">
                    <label>주중 요금 (일~금)</label>
                    <div className="input-with-currency">
                      <input
                        type="number"
                        value={roomPrices[room.id]?.주중요금 || 0}
                        onChange={(e) => setRoomPrices(prev => ({
                          ...prev,
                          [room.id]: {
                            ...prev[room.id],
                            주중요금: parseInt(e.target.value) || 0
                          }
                        }))}
                        placeholder="0"
                      />
                      <span className="currency">원</span>
                    </div>
                  </div>
                  
                  <div className="price-input-group">
                    <label>주말 요금 (토, 공휴일/전날)</label>
                    <div className="input-with-currency">
                      <input
                        type="number"
                        value={roomPrices[room.id]?.주말요금 || 0}
                        onChange={(e) => setRoomPrices(prev => ({
                          ...prev,
                          [room.id]: {
                            ...prev[room.id],
                            주말요금: parseInt(e.target.value) || 0
                          }
                        }))}
                        placeholder="0"
                      />
                      <span className="currency">원</span>
                    </div>
                  </div>

                  <div className="price-input-group">
                    <label>추가인원 요금 (1박 기준)</label>
                    <div className="input-with-currency">
                      <input
                        type="number"
                        value={roomPrices[room.id]?.추가인원요금 || 0}
                        onChange={(e) => setRoomPrices(prev => ({
                          ...prev,
                          [room.id]: {
                            ...prev[room.id],
                            추가인원요금: parseInt(e.target.value) || 0
                          }
                        }))}
                        placeholder="0"
                      />
                      <span className="currency">원</span>
                    </div>
                  </div>
                </div>

                {/* 현재 가격 미리보기 */}
                <div className="price-preview">
                  <div className="preview-item">
                    <span className="preview-label">주중:</span>
                    <span className="preview-price">
                      {(roomPrices[room.id]?.주중요금 || 0).toLocaleString()}원
                    </span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">주말:</span>
                    <span className="preview-price">
                      {(roomPrices[room.id]?.주말요금 || 0).toLocaleString()}원
                    </span>
                  </div>
                  {roomPrices[room.id]?.추가인원요금 > 0 && (
                    <div className="preview-item extra">
                      <span className="preview-label">추가인원:</span>
                      <span className="preview-price">
                        +{(roomPrices[room.id]?.추가인원요금 || 0).toLocaleString()}원/박
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시즌 가격 규칙 */}
      {activeTab === 'rules' && (
        <div className="rules-section">
          <div className="section-header">
            <h3>시즌 가격 규칙</h3>
            <button onClick={() => setIsAddingRule(true)} className="btn-add">
              + 시즌 규칙 추가
            </button>
          </div>
          
          <div className="rules-list">
            {pricingRules && pricingRules.length > 0 ? (
              pricingRules
                .filter(rule => rule.type === 'season')
                .map(rule => (
                  <div key={rule.id} className="rule-card">
                    <div className="rule-header">
                      <div className="rule-info">
                        <h4>{rule.name}</h4>
                        <span className="rule-period">
                          {rule.startDate} ~ {rule.endDate}
                        </span>
                      </div>
                      <div className="rule-actions">
                        <button 
                          onClick={() => setEditingRule(rule)} 
                          className="btn-edit"
                        >
                          수정
                        </button>
                        <button 
                          onClick={() => deletePricingRule(rule.id)} 
                          className="btn-delete"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    
                    <div className="rule-details">
                      <div className="season-prices">
                        {rooms.map(room => (
                          <div key={room.id} className="room-season-price">
                            <h5>{room.객실명}</h5>
                            <div className="season-price-row">
                              <span className="price-label">주중:</span>
                              <span className="price-value">
                                {(rule.weekdayPrices?.[room.id] || room.주중요금 || 0).toLocaleString()}원
                              </span>
                            </div>
                            <div className="season-price-row">
                              <span className="price-label">주말:</span>
                              <span className="price-value">
                                {(rule.weekendPrices?.[room.id] || room.주말요금 || 0).toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="empty-rules">
                <p>설정된 시즌 가격 규칙이 없습니다.</p>
                <p className="empty-description">
                  성수기, 비수기 등 특별한 기간의 가격을 설정할 수 있습니다.
                </p>
                <button onClick={() => setIsAddingRule(true)} className="btn-add-first">
                  첫 번째 시즌 규칙 추가하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 시즌 규칙 추가/수정 모달 */}
      {(isAddingRule || editingRule) && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingRule ? '시즌 가격 규칙 수정' : '새 시즌 가격 규칙 추가'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              
              const ruleData = {
                name: formData.get('name'),
                type: 'season',
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate'),
                weekdayPrices: {},
                weekendPrices: {}
              };
              
              // 객실별 가격 수집
              rooms.forEach(room => {
                const weekdayPrice = formData.get(`weekday_${room.id}`);
                const weekendPrice = formData.get(`weekend_${room.id}`);
                if (weekdayPrice) {
                  ruleData.weekdayPrices[room.id] = parseInt(weekdayPrice);
                }
                if (weekendPrice) {
                  ruleData.weekendPrices[room.id] = parseInt(weekendPrice);
                }
              });
              
              if (editingRule) {
                updateDoc(doc(db, 'pricing_rules', editingRule.id), {
                  ...ruleData,
                  updated: new Date()
                });
                setEditingRule(null);
              } else {
                addPricingRule(ruleData);
              }
            }}>
              <div className="form-group">
                <label>시즌명</label>
                <input 
                  type="text" 
                  name="name" 
                  defaultValue={editingRule?.name || ''}
                  placeholder="예: 여름 성수기, 겨울 비수기"
                  required 
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>시작일</label>
                  <input 
                    type="date" 
                    name="startDate" 
                    defaultValue={editingRule?.startDate || ''}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>종료일</label>
                  <input 
                    type="date" 
                    name="endDate" 
                    defaultValue={editingRule?.endDate || ''}
                    required 
                  />
                </div>
              </div>
              
              <div className="season-price-inputs">
                <h4>객실별 시즌 가격 설정</h4>
                {rooms.map(room => (
                  <div key={room.id} className="room-season-input">
                    <h5>{room.객실명}</h5>
                    <div className="season-input-row">
                      <div className="price-input-group">
                        <label>주중 가격</label>
                        <input
                          type="number"
                          name={`weekday_${room.id}`}
                          defaultValue={
                            editingRule?.weekdayPrices?.[room.id] || 
                            room.주중요금 || 
                            room.기본요금 || 
                            0
                          }
                          placeholder="주중 가격"
                        />
                      </div>
                      <div className="price-input-group">
                        <label>주말 가격</label>
                        <input
                          type="number"
                          name={`weekend_${room.id}`}
                          defaultValue={
                            editingRule?.weekendPrices?.[room.id] || 
                            room.주말요금 || 
                            room.기본요금 || 
                            0
                          }
                          placeholder="주말 가격"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="form-actions">
                <button type="submit" className="btn-save">
                  {editingRule ? '수정' : '추가'}
                </button>
                <button type="button" onClick={() => {
                  setIsAddingRule(false);
                  setEditingRule(null);
                }} className="btn-cancel">
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingSettings;