// src/components/OptionsSettings.jsx
// ⚠️ Firebase → D1 이관 (2026-07-17).
//    읽기는 이미 D1(useOptions/useRooms)이었는데 **쓰기만 옛 Firestore** 로 가고 있었다
//    → 저장해도 화면에 안 나타나는 split-brain.
//
//    로드 경로도 죽어 있었다: `fetch('/api/getDoc?path=settings/option_settings')` 인데
//    그런 엔드포인트가 이 저장소에 없다(루트 api/ 엔 naver-keyword.js 뿐) → 항상 404 →
//    `.catch(()=>null)` 로 삼켜져 **저장된 기본옵션 설정을 한 번도 못 불러왔다**
//    (레이트체크아웃 재고가 늘 빈 값으로 보였다). `/api/option-settings` 로 고쳤다.
//
//    기본옵션(isDefault)은 `option_settings`, 사용자옵션은 `options` — 레거시와 같은 분리다.
//    둘은 id 가 겹쳐서(late_checkout) 한 테이블에 못 합친다.
import React, { useState, useEffect } from 'react';
import { useOptions } from '../hooks/useOptions';
import { useRooms } from '../hooks/useRooms';
import { toOptionWriteBody } from '../../lib/legacy-write-shape';
import useFirebaseStore from '../stores/useFirebaseStore';
import './OptionsSettings.css';

/** 쓰기 API — 실패하면 서버 문구를 그대로 던진다 */
async function api(path, { method = 'PATCH', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `요청 실패 (${res.status})`);
  return json;
}

/** 쓰기 후 화면 갱신 (D1 엔 push 가 없다) */
const refresh = () => useFirebaseStore.getState().refresh();

const OptionsSettings = () => {
  const { data: options, isLoading: optionsLoading } = useOptions();
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  const [editingOption, setEditingOption] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [savedSettings, setSavedSettings] = useState({});

  // 옵션 타입 정의
  const OPTION_TYPES = {
    INCLUDED: 'included',      // 객실 요금에 포함
    ONSITE: 'onsite',         // 현장 결제
    LATE_CHECKOUT: 'late_checkout',  // 레이트 체크아웃
    CUSTOM: 'custom'          // 사용자 정의
  };

  // 기본 옵션 템플릿
  const [defaultOptions, setDefaultOptions] = useState([
    {
      id: 'extra_person',
      name: '인원 추가',
      type: OPTION_TYPES.INCLUDED,
      priceType: 'per_person',
      applicableRooms: 'all',
      roomPrices: {},
      description: '기준인원 초과 시 1인당 추가 요금',
      isDefault: true
    },
    {
      id: 'camping_burner',
      name: '캠핑버너&그릴',
      type: OPTION_TYPES.INCLUDED,
      price: 20000,
      applicableRooms: 'selected',
      selectedRooms: ['Forest', 'Forest mini', 'Forest 미니패밀리', 'Forest 패밀리'],
      description: '캠핑용 버너와 그릴 세트',
      isDefault: true
    },
    {
      id: 'charcoal_bbq',
      name: '숯불바베큐',
      type: OPTION_TYPES.ONSITE,
      price: 30000,
      applicableRooms: 'shared',
      sharedRooms: {
        group: 'forest_group',
        rooms: ['Forest', 'Forest mini', 'Forest 미니패밀리', 'Forest 패밀리'],
        totalStock: 5
      },
      description: '현장 결제, Forest 계열 객실 공동 이용',
      isDefault: true
    },
    {
      id: 'late_checkout',
      name: '레이트 체크아웃',
      type: OPTION_TYPES.LATE_CHECKOUT,
      applicableRooms: 'individual',
      roomStocks: {},  // 초기값 빈 객체
      description: '낮 12시 체크아웃',
      isDefault: true
    }
  ]);

  // 설정 불러오기
  useEffect(() => {
    loadSavedSettings();
  }, []);

  // Firebase에서 저장된 설정 불러오기
  const loadSavedSettings = async () => {
    try {
      // 레거시는 `/api/getDoc?path=settings/option_settings` 를 불렀는데 그런 엔드포인트가
      // 없어서(404) 저장값을 한 번도 못 불러왔다. 적용 로직은 그대로 두고 출처만 고쳤다.
      const res = await fetch('/api/option-settings', { credentials: 'same-origin' });

      if (res.ok) {
        const { settings: data } = await res.json();
        if (data) {
          setSavedSettings(data);

          // 레이트 체크아웃 설정 적용
          if (data.late_checkout) {
            setDefaultOptions(prev => prev.map(opt =>
              opt.id === 'late_checkout'
                ? { ...opt, ...data.late_checkout }
                : opt
            ));
          }

          // 다른 기본 옵션 설정도 적용
          Object.keys(data).forEach(key => {
            if (key !== 'late_checkout') {
              setDefaultOptions(prev => prev.map(opt =>
                opt.id === key
                  ? { ...opt, ...data[key] }
                  : opt
              ));
            }
          });
        }
      }
    } catch (error) {
      console.log('설정 불러오기 실패:', error);
    }
  };

  // 옵션 저장
  const saveOption = async (optionData) => {
    try {
      if (optionData.isDefault) {
        // 기본 옵션 → option_settings (레거시도 settings 문서에 저장했다)
        await api('/api/option-settings', { body: { id: optionData.id, data: optionData } });

        // 상태 업데이트
        const currentSettings = { ...savedSettings, [optionData.id]: optionData };
        setSavedSettings(currentSettings);
        setDefaultOptions(prev => prev.map(opt =>
          opt.id === optionData.id ? optionData : opt
        ));

        alert('저장되었습니다.');
      } else if (optionData.id && !optionData.isDefault) {
        // 기존 사용자 정의 옵션 수정
        await api('/api/options', { body: { id: optionData.id, ...toOptionWriteBody(optionData) } });
        await refresh();
        alert('저장되었습니다.');
      } else if (!optionData.isDefault) {
        // 새 사용자 정의 옵션 추가
        await api('/api/options', { method: 'POST', body: toOptionWriteBody(optionData) });
        await refresh();
        alert('저장되었습니다.');
      }

      setEditingOption(null);
      setIsAddingNew(false);
    } catch (error) {
      console.error('옵션 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 옵션 삭제
  const deleteOption = async (optionId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      await api(`/api/options?id=${encodeURIComponent(optionId)}`, { method: 'DELETE' });
      await refresh();
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('옵션 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 옵션 편집 폼
  const OptionForm = ({ option, onSave, onCancel }) => {
    const [formData, setFormData] = useState(option || {
      name: '',
      type: OPTION_TYPES.INCLUDED,
      price: 0,
      description: '',
      applicableRooms: 'all',
      selectedRooms: [],
      roomPrices: {},
      roomStocks: {},
      sharedRooms: {
        group: '',
        rooms: [],
        totalStock: 0
      }
    });

    // 객실별 가격 설정 핸들러
    const handleRoomPriceChange = (roomId, price) => {
      setFormData({
        ...formData,
        roomPrices: {
          ...formData.roomPrices,
          [roomId]: parseInt(price) || 0
        }
      });
    };

    // 객실별 재고 설정 핸들러
    const handleRoomStockChange = (roomId, stock) => {
      const newStocks = { ...formData.roomStocks };
      const stockValue = parseInt(stock);
      
      if (stockValue > 0) {
        newStocks[roomId] = stockValue;
      } else {
        delete newStocks[roomId];  // 0이면 제거
      }
      
      setFormData({
        ...formData,
        roomStocks: newStocks
      });
    };

    // 객실 선택 핸들러
    const handleRoomSelection = (roomId) => {
      const selected = formData.selectedRooms || [];
      if (selected.includes(roomId)) {
        setFormData({
          ...formData,
          selectedRooms: selected.filter(r => r !== roomId)
        });
      } else {
        setFormData({
          ...formData,
          selectedRooms: [...selected, roomId]
        });
      }
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      
      // 레이트 체크아웃의 경우 빈 값 제거
      if (formData.type === OPTION_TYPES.LATE_CHECKOUT) {
        const cleanedStocks = {};
        Object.entries(formData.roomStocks || {}).forEach(([room, stock]) => {
          if (stock > 0) {
            cleanedStocks[room] = stock;
          }
        });
        formData.roomStocks = cleanedStocks;
      }
      
      onSave(formData);
    };

    return (
      <div className="option-form">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>옵션명</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>옵션 타입</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              disabled={option?.isDefault}
            >
              <option value={OPTION_TYPES.INCLUDED}>객실 요금 포함</option>
              <option value={OPTION_TYPES.ONSITE}>현장 결제</option>
              <option value={OPTION_TYPES.LATE_CHECKOUT}>레이트 체크아웃</option>
              <option value={OPTION_TYPES.CUSTOM}>사용자 정의</option>
            </select>
          </div>

          <div className="form-group">
            <label>적용 객실 설정</label>
            <select
              value={formData.applicableRooms}
              onChange={(e) => setFormData({...formData, applicableRooms: e.target.value})}
            >
              <option value="all">모든 객실</option>
              <option value="selected">선택한 객실</option>
              <option value="individual">객실별 개별 설정</option>
              <option value="shared">공동 재고 관리</option>
            </select>
          </div>

          {/* 선택한 객실 */}
          {formData.applicableRooms === 'selected' && (
            <div className="form-group">
              <label>적용할 객실 선택</label>
              <div className="room-checkboxes">
                {rooms.map(room => (
                  <label key={room.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.selectedRooms?.includes(room.객실명) || false}
                      onChange={() => handleRoomSelection(room.객실명)}
                    />
                    {room.객실명}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 객실별 개별 설정 - 레이트 체크아웃용 */}
          {formData.applicableRooms === 'individual' && formData.type === OPTION_TYPES.LATE_CHECKOUT && (
            <div className="form-group">
              <label>객실별 레이트 체크아웃 가능 개수</label>
              <div className="individual-settings">
                {rooms.map(room => (
                  <div key={room.id} className="room-setting">
                    <span className="room-name">{room.객실명}</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      placeholder="0"
                      value={formData.roomStocks?.[room.객실명] || 0}
                      onChange={(e) => handleRoomStockChange(room.객실명, e.target.value)}
                    />
                    <span className="unit">개</span>
                  </div>
                ))}
              </div>
              <p className="help-text">
                * 0개로 설정하면 해당 객실은 레이트 체크아웃 옵션이 표시되지 않습니다.
              </p>
            </div>
          )}

          {/* 객실별 개별 설정 - 가격 */}
          {formData.applicableRooms === 'individual' && formData.type !== OPTION_TYPES.LATE_CHECKOUT && (
            <div className="form-group">
              <label>객실별 가격 설정</label>
              <div className="individual-settings">
                {rooms.map(room => (
                  <div key={room.id} className="room-setting">
                    <span className="room-name">{room.객실명}</span>
                    <input
                      type="number"
                      placeholder="가격"
                      value={formData.roomPrices?.[room.객실명] || ''}
                      onChange={(e) => handleRoomPriceChange(room.객실명, e.target.value)}
                    />
                    <span className="unit">원</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 공동 재고 관리 */}
          {formData.applicableRooms === 'shared' && (
            <div className="form-group">
              <label>공동 재고 그룹</label>
              <input
                type="text"
                placeholder="그룹명 (예: forest_group)"
                value={formData.sharedRooms?.group || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  sharedRooms: {
                    ...formData.sharedRooms,
                    group: e.target.value
                  }
                })}
              />
              
              <label className="mt-3">포함 객실</label>
              <div className="room-checkboxes">
                {rooms.map(room => (
                  <label key={room.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.sharedRooms?.rooms?.includes(room.객실명) || false}
                      onChange={(e) => {
                        const sharedRooms = formData.sharedRooms?.rooms || [];
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            sharedRooms: {
                              ...formData.sharedRooms,
                              rooms: [...sharedRooms, room.객실명]
                            }
                          });
                        } else {
                          setFormData({
                            ...formData,
                            sharedRooms: {
                              ...formData.sharedRooms,
                              rooms: sharedRooms.filter(r => r !== room.객실명)
                            }
                          });
                        }
                      }}
                    />
                    {room.객실명}
                  </label>
                ))}
              </div>
              
              <label className="mt-3">총 재고 수량</label>
              <input
                type="number"
                value={formData.sharedRooms?.totalStock || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  sharedRooms: {
                    ...formData.sharedRooms,
                    totalStock: parseInt(e.target.value) || 0
                  }
                })}
              />
            </div>
          )}

          {/* 기본 가격 (모든 객실 동일, 선택한 객실, 공동 재고) */}
          {(formData.applicableRooms === 'all' || formData.applicableRooms === 'selected' || formData.applicableRooms === 'shared') && formData.type !== OPTION_TYPES.LATE_CHECKOUT && (
            <div className="form-group">
              <label>요금</label>
              <input
                type="number"
                value={formData.price || ''}
                onChange={(e) => setFormData({...formData, price: parseInt(e.target.value) || 0})}
              />
            </div>
          )}

          <div className="form-group">
            <label>설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-save">저장</button>
            <button type="button" onClick={onCancel} className="btn-cancel">취소</button>
          </div>
        </form>
      </div>
    );
  };

  if (optionsLoading || roomsLoading) {
    return <div>로딩 중...</div>;
  }

  // 현재 레이트 체크아웃 설정
  const currentLateCheckout = defaultOptions.find(opt => opt.id === 'late_checkout');
  const lateCheckoutRooms = Object.entries(currentLateCheckout?.roomStocks || {})
    .filter(([room, stock]) => stock > 0)
    .map(([room, stock]) => ({ room, stock }));

  return (
    <div className="options-settings">
      <div className="settings-header">
        <h2>옵션 설정</h2>
        <button onClick={() => setIsAddingNew(true)} className="btn-add">
          <span className="btn-add-text-full">+ 새 옵션 추가</span>
          <span className="btn-add-text-short">+ 추가</span>
        </button>
      </div>

      {/* 탭 메뉴 */}
      <div className="option-tabs">
        <button 
          className={activeTab === 'basic' ? 'active' : ''}
          onClick={() => setActiveTab('basic')}
        >
          기본 옵션
        </button>
        <button 
          className={activeTab === 'custom' ? 'active' : ''}
          onClick={() => setActiveTab('custom')}
        >
          추가 옵션
        </button>
        <button 
          className={activeTab === 'room_mapping' ? 'active' : ''}
          onClick={() => setActiveTab('room_mapping')}
        >
          객실별 적용 현황
        </button>
      </div>

      {/* 기본 옵션 */}
      {activeTab === 'basic' && (
        <div className="options-section">
          <div className="options-list">
            {defaultOptions.map(option => (
              <div key={option.id} className="option-card">
                <div className="option-header">
                  <h4>{option.name}</h4>
                  <div className="option-badges">
                    <span className={`option-type ${option.type}`}>
                      {option.type === OPTION_TYPES.INCLUDED ? '객실요금 포함' :
                       option.type === OPTION_TYPES.ONSITE ? '현장결제' :
                       option.type === OPTION_TYPES.LATE_CHECKOUT ? '레이트체크아웃' :
                       '사용자정의'}
                    </span>
                    <span className="room-badge">
                      {option.applicableRooms === 'all' ? '전체 객실' :
                       option.applicableRooms === 'selected' ? `${option.selectedRooms?.length || 0}개 객실` :
                       option.applicableRooms === 'individual' ? 
                         (option.id === 'late_checkout' ? 
                           `${Object.keys(option.roomStocks || {}).filter(room => option.roomStocks[room] > 0).length}개 객실` : 
                           '개별 설정') :
                       '공동 재고'}
                    </span>
                  </div>
                  <button 
                    onClick={() => setEditingOption(option)}
                    className="btn-edit"
                  >
                    설정
                  </button>
                </div>
                
                <div className="option-details">
                  <p className="description">{option.description}</p>
                  
                  {/* 레이트 체크아웃 정보 표시 */}
                  {option.id === 'late_checkout' && lateCheckoutRooms.length > 0 && (
                    <div className="room-info">
                      <strong>설정된 객실:</strong>
                      <div className="room-settings-grid">
                        {lateCheckoutRooms.map(({ room, stock }) => (
                          <span key={room} className="room-setting-item">
                            {room}: {stock}개
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 다른 옵션들의 정보 표시 */}
                  {option.applicableRooms === 'selected' && option.id !== 'late_checkout' && (
                    <div className="selected-rooms">
                      <strong>적용 객실:</strong> {option.selectedRooms?.join(', ')}
                    </div>
                  )}
                  
                  {option.applicableRooms === 'shared' && option.sharedRooms && (
                    <div className="shared-info">
                      <strong>공동 재고:</strong> 총 {option.sharedRooms.totalStock}개
                      <br />
                      <small>대상: {option.sharedRooms.rooms?.join(', ')}</small>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 추가 옵션 */}
      {activeTab === 'custom' && (
        <div className="options-section">
          <div className="options-list">
            {options.filter(opt => !opt.isDefault).map(option => (
              <div key={option.id} className="option-card">
                <div className="option-header">
                  <h4>{option.name}</h4>
                  <div className="option-badges">
                    <span className={`option-type ${option.type}`}>
                      {option.type === OPTION_TYPES.INCLUDED ? '객실요금 포함' :
                       option.type === OPTION_TYPES.ONSITE ? '현장결제' :
                       option.type === OPTION_TYPES.LATE_CHECKOUT ? '레이트체크아웃' :
                       '사용자정의'}
                    </span>
                  </div>
                  <div className="option-actions">
                    <button onClick={() => setEditingOption(option)}>수정</button>
                    <button onClick={() => deleteOption(option.id)} className="btn-delete">삭제</button>
                  </div>
                </div>
                <div className="option-details">
                  {option.description && <p>{option.description}</p>}
                  {option.price && <p>요금: {option.price.toLocaleString()}원</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 객실별 적용 현황 */}
      {activeTab === 'room_mapping' && (
        <div className="room-mapping-section">
          <div className="room-mapping-grid">
            {rooms.map(room => (
              <div key={room.id} className="room-mapping-card">
                <h4>{room.객실명}</h4>
                <div className="applied-options">
                  {[...defaultOptions, ...options.filter(opt => !opt.isDefault)].filter(option => {
                    if (option.applicableRooms === 'all') return true;
                    if (option.applicableRooms === 'selected') {
                      return option.selectedRooms?.includes(room.객실명);
                    }
                    if (option.applicableRooms === 'individual') {
                      if (option.type === OPTION_TYPES.LATE_CHECKOUT) {
                        return option.roomStocks?.[room.객실명] > 0;
                      }
                      return option.roomPrices?.[room.객실명] > 0;
                    }
                    if (option.applicableRooms === 'shared') {
                      return option.sharedRooms?.rooms?.includes(room.객실명);
                    }
                    return false;
                  }).map(option => (
                    <div key={option.id} className="applied-option">
                      <span className="option-name">{option.name}</span>
                      <span className="option-value">
                        {option.applicableRooms === 'individual' && option.roomPrices?.[room.객실명] && 
                          `${option.roomPrices[room.객실명].toLocaleString()}원`}
                        {option.applicableRooms === 'individual' && option.roomStocks?.[room.객실명] && 
                          `${option.roomStocks[room.객실명]}개`}
                        {option.applicableRooms === 'all' && option.price && 
                          `${option.price.toLocaleString()}원`}
                        {option.applicableRooms === 'shared' && 
                          `공동재고`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 편집/추가 모달 */}
      {(editingOption || isAddingNew) && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingOption ? '옵션 설정' : '새 옵션 추가'}</h3>
            <OptionForm
              option={editingOption}
              onSave={saveOption}
              onCancel={() => {
                setEditingOption(null);
                setIsAddingNew(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionsSettings;