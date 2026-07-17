// src/components/RoomManagement.jsx
//
// ⚠️ Firebase → D1 이관 (2026-07-17).
//    읽기는 이미 D1(useRooms/useReservations/useFirebaseStore)이었는데 **쓰기만 옛 Firestore** 로
//    가고 있었다 → 저장해도 화면에 안 나타나는 split-brain. 쓰기를 전부 /api/* 로 옮겼다.
//
// **객실명 변경은 막혔다** (사용자 결정 2026-07-17). 이름이 7곳에 사실상 FK 로 박혀 있고
// (예약 133 · 고객 선호객실 90 · override · 템플릿 · 요금규칙 · 옵션설정),
// 레거시의 rename 연쇄는 두 군데 다 깨져 있었다:
//   · `where('room','==',old)` — 예약 필드는 `roomName` 이라 항상 0건 → 예약이 고아가 됐다
//   · `docId.includes('_'+old)` — 부분일치라 "Forest" 를 바꾸면 "Forest mini" 까지 파괴됐다
// → 연쇄 함수 2개를 지우고 수정 폼에서 객실명을 읽기전용으로 바꿨다. 서버도 400 으로 거부한다.
import React, { useState, useEffect } from 'react';
import { useRooms } from '../hooks/useRooms';
import { useReservations } from '../hooks/useReservations';
import useFirebaseStore from '../stores/useFirebaseStore';
import { toRoomWriteBody } from '../../lib/legacy-write-shape';
import './RoomManagement.css';

/** 쓰기 API — 실패하면 서버 문구를 그대로 던진다 (레거시가 Firestore 에러를 그대로 썼듯이) */
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

/** 쓰기 후 화면 갱신 — 레거시는 Firestore 가 밀어줬지만 D1 엔 push 가 없다 */
const refresh = () => useFirebaseStore.getState().refresh();

const RoomManagement = () => {
  const { data: rooms, isLoading } = useRooms();
  const { data: reservations } = useReservations();
  const { pricingRules } = useFirebaseStore();
  const [editingRoom, setEditingRoom] = useState(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingRoom, setIsDeletingRoom] = useState(null);
  const [originalRoomName, setOriginalRoomName] = useState('');

  // 인라인 편집 상태: { roomId, field, value }
  const [inlineEdit, setInlineEdit] = useState(null);

  // 시즌 가격 규칙 상태
  const [showSeasonRules, setShowSeasonRules] = useState(false);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // 새 객실 추가를 위한 초기 폼 데이터
  const getInitialFormData = () => ({
    객실명: '',
    기본요금: 100000,
    주중요금: 100000,
    주말요금: 150000,
    기준인원: 2,
    최대인원: 4,
    추가인원요금: 20000,
    기본재고: 1,
    설명: '',
    order: rooms ? Math.max(...rooms.map(r => r.order || 0)) + 1 : 1
  });

  const handleEdit = (room) => {
    setEditingRoom(room.id);
    setOriginalRoomName(room.객실명); // 원래 객실명 저장
    setFormData({
      객실명: room.객실명,
      기본요금: room.기본요금 || 0,
      주중요금: room.주중요금 || room.기본요금 || 0,
      주말요금: room.주말요금 || room.기본요금 || 0,
      기준인원: room.기준인원 || 2,
      최대인원: room.최대인원 || 4,
      추가인원요금: room.추가인원요금 || 0,
      기본재고: room.기본재고 || room.재고 || 1,
      설명: room.설명 || '',
      order: room.order || 0
    });
  };

  const handleAddRoom = () => {
    setIsAddingRoom(true);
    setFormData(getInitialFormData());
  };

  const handleSave = async () => {
    if (!editingRoom) return;
    
    // 필수 필드 검증
    if (!formData.객실명?.trim()) {
      alert('객실명을 입력해주세요.');
      return;
    }

    // 다른 객실과 중복되는 이름인지 확인 (자기 자신 제외)
    const isDuplicate = rooms.some(room => 
      room.id !== editingRoom && 
      room.객실명 === formData.객실명.trim()
    );
    
    if (isDuplicate) {
      alert('이미 존재하는 객실명입니다.');
      return;
    }

    setIsSaving(true);
    try {
      // 객실명은 서버가 400 으로 거부한다 — 폼에서도 읽기전용이라 여기 올 일이 없다
      const { 객실명, ...editable } = formData;
      await api('/api/rooms', { body: { id: editingRoom, ...toRoomWriteBody(editable) } });
      await refresh();

      alert('객실 정보가 수정되었습니다.');

      setEditingRoom(null);
      setFormData({});
      setOriginalRoomName('');
    } catch (error) {
      console.error('객실 정보 수정 오류:', error);
      alert(error.message || '수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRoom = async () => {
    // 필수 필드 검증
    if (!formData.객실명?.trim()) {
      alert('객실명을 입력해주세요.');
      return;
    }

    // 중복 객실명 확인
    if (rooms.some(room => room.객실명 === formData.객실명.trim())) {
      alert('이미 존재하는 객실명입니다.');
      return;
    }

    setIsSaving(true);
    try {
      // 재고 = 기본재고 는 서버(createRoom)가 레거시 규약대로 처리한다
      await api('/api/rooms', {
        method: 'POST',
        body: toRoomWriteBody({ ...formData, 객실명: formData.객실명.trim() })
      });
      await refresh();

      alert('새 객실이 추가되었습니다.');
      setIsAddingRoom(false);
      setFormData({});
    } catch (error) {
      console.error('객실 추가 오류:', error);
      alert(error.message || '객실 추가 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId, roomName) => {
    // 활성 예약 검사는 **서버**가 한다.
    // 레거시는 여기서 `r.room === roomName` 으로 걸렀는데 예약 필드는 `roomName` 이라
    // 항상 빈 배열 → 가드가 한 번도 안 걸렸다 (예약 84건짜리 객실도 그냥 지워졌다).
    if (!window.confirm(`정말로 "${roomName}" 객실을 삭제하시겠습니까?

⚠️ 주의: 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setIsDeletingRoom(roomId);
    try {
      await api(`/api/rooms?id=${encodeURIComponent(roomId)}`, { method: 'DELETE' });
      await refresh();
      alert('객실이 삭제되었습니다.');
    } catch (error) {
      console.error('객실 삭제 오류:', error);
      // 활성 예약이 있으면 서버가 레거시와 같은 문구로 막는다
      alert(error.message || '객실 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingRoom(null);
    }
  };

  const handleCancel = () => {
    setEditingRoom(null);
    setIsAddingRoom(false);
    setFormData({});
    setOriginalRoomName('');
  };

  // 인라인 편집 시작
  const startInlineEdit = (roomId, field, currentValue) => {
    setInlineEdit({ roomId, field, value: currentValue });
  };

  // 인라인 편집 취소
  const cancelInlineEdit = () => {
    setInlineEdit(null);
  };

  // 인라인 편집 저장
  const saveInlineEdit = async () => {
    if (!inlineEdit) return;

    const { roomId, field, value } = inlineEdit;

    setIsSaving(true);
    try {
      // 기본재고 → 재고 동기화는 서버(updateRoom)가 레거시 규약대로 처리한다
      await api('/api/rooms', { body: { id: roomId, ...toRoomWriteBody({ [field]: value }) } });
      await refresh();

      setInlineEdit(null);
    } catch (error) {
      console.error('인라인 편집 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 인라인 편집 input 키 이벤트 처리
  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveInlineEdit();
    } else if (e.key === 'Escape') {
      cancelInlineEdit();
    }
  };

  // 객실 활성화/비활성화 토글
  const toggleRoomActive = async (roomId, currentStatus) => {
    try {
      await api('/api/rooms', { body: { id: roomId, ...toRoomWriteBody({ isActive: !currentStatus }) } });
      await refresh();
    } catch (error) {
      console.error('객실 상태 변경 오류:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 시즌 가격 규칙 추가
  const addPricingRule = async (ruleData) => {
    try {
      // 규칙 객체는 서버가 data JSON 에 통째로 보존한다 (이관 규약)
      await api('/api/pricing-rules', { method: 'POST', body: { ...ruleData, isActive: true } });
      await refresh();
      setIsAddingRule(false);
      alert('시즌 가격 규칙이 추가되었습니다.');
    } catch (error) {
      console.error('규칙 추가 오류:', error);
      alert('추가 중 오류가 발생했습니다.');
    }
  };

  // 시즌 가격 규칙 삭제
  const deletePricingRule = async (ruleId) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        await api(`/api/pricing-rules?id=${encodeURIComponent(ruleId)}`, { method: 'DELETE' });
        await refresh();
        alert('시즌 가격 규칙이 삭제되었습니다.');
      } catch (error) {
        console.error('규칙 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  // 객실이 없으면 — 데이터가 안 온 것이지, 초기화할 상황이 아니다.
  //
  // 레거시는 여기서 <DataInitializer/> 를 띄웠는데, 그 버튼은 하드코딩된 2025년 값으로
  // rooms/options/pricing_rules 를 merge 없이 **덮어썼다**(batch.set). 시드값이 이미 낡아
  // Forest 기본요금을 180,000 → 150,000 으로 되돌리고 지금은 없는 '단체예약' 객실을 만든다.
  // 게다가 신규 스택에선 /api/snapshot 이 한 번 실패하면 rooms=[] 라 이 화면이 뜬다
  // → 일시적 오류에 운영 데이터를 날릴 수 있는 경로였다. 컴포넌트째로 삭제했다.
  if (!rooms || rooms.length === 0) {
    return (
      <div className="room-management">
        <div className="empty-state">
          <h3>객실 정보를 불러오지 못했습니다</h3>
          <p>일시적인 오류일 수 있습니다. 새로고침해 주세요.</p>
          <button className="btn-primary" onClick={() => refresh()}>다시 불러오기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-management">
      <div className="management-header">
        <h2>객실 기본정보 관리</h2>
        <p className="info-text">객실별 기본정보와 기본재고를 설정합니다.</p>
        <button onClick={handleAddRoom} className="btn btn-primary add-room-btn">
          + 새 객실 추가
        </button>
      </div>

      {/* 인라인 편집 안내 */}
      <div className="inline-edit-hint">
        <span className="hint-icon">💡</span>
        <span>각 값을 클릭하면 바로 수정할 수 있습니다</span>
      </div>

      <div className="rooms-grid">
        {/* 새 객실 추가 카드 */}
        {isAddingRoom && (
          <div className="room-card add-room-card">
            <div className="edit-mode">
              <h3>새 객실 추가</h3>
              
              <div className="form-section">
                <h4>객실 정보</h4>
                <div className="form-group">
                  <label>객실명 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={formData.객실명}
                    onChange={(e) => setFormData({...formData, 객실명: e.target.value})}
                    placeholder="예: 스탠다드룸"
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="form-section">
                <h4>요금 정보</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>기본요금</label>
                    <input
                      type="number"
                      value={formData.기본요금}
                      onChange={(e) => setFormData({...formData, 기본요금: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="form-group">
                    <label>주중요금</label>
                    <input
                      type="number"
                      value={formData.주중요금}
                      onChange={(e) => setFormData({...formData, 주중요금: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="form-group">
                    <label>주말요금</label>
                    <input
                      type="number"
                      value={formData.주말요금}
                      onChange={(e) => setFormData({...formData, 주말요금: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>인원 정보</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>기준인원</label>
                    <input
                      type="number"
                      value={formData.기준인원}
                      onChange={(e) => setFormData({...formData, 기준인원: parseInt(e.target.value) || 2})}
                      min="1"
                      max="10"
                    />
                  </div>
                  <div className="form-group">
                    <label>최대인원</label>
                    <input
                      type="number"
                      value={formData.최대인원}
                      onChange={(e) => setFormData({...formData, 최대인원: parseInt(e.target.value) || 4})}
                      min={formData.기준인원}
                      max="10"
                    />
                  </div>
                  <div className="form-group">
                    <label>추가인원요금</label>
                    <input
                      type="number"
                      value={formData.추가인원요금}
                      onChange={(e) => setFormData({...formData, 추가인원요금: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>재고 정보</h4>
                <div className="form-group">
                  <label>기본재고</label>
                  <input
                    type="number"
                    value={formData.기본재고}
                    onChange={(e) => setFormData({...formData, 기본재고: parseInt(e.target.value) || 1})}
                    min="1"
                    max="10"
                  />
                  <small>날짜별 재고는 간단예약관리에서 개별 설정 가능합니다.</small>
                </div>
              </div>

              <div className="form-section">
                <h4>객실 설명</h4>
                <div className="form-group">
                  <textarea
                    value={formData.설명}
                    onChange={(e) => setFormData({...formData, 설명: e.target.value})}
                    rows="3"
                    placeholder="객실 특징이나 설명을 입력하세요"
                  />
                </div>
              </div>

              <div className="card-actions">
                <button 
                  onClick={handleCreateRoom} 
                  className="btn btn-save"
                  disabled={isSaving || !formData.객실명?.trim()}
                >
                  {isSaving ? '추가 중...' : '객실 추가'}
                </button>
                <button 
                  onClick={handleCancel} 
                  className="btn btn-cancel"
                  disabled={isSaving}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 기존 객실 카드들 */}
        {rooms.map(room => (
          <div key={room.id} className="room-card">
            {editingRoom === room.id ? (
              // 수정 모드
              <div className="edit-mode">
                <h3>객실 정보 수정</h3>
                
                <div className="form-section">
                  <h4>객실 정보</h4>
                  <div className="form-group">
                    <label>객실명 <span className="required">*</span></label>
                    <input
                      type="text"
                      value={formData.객실명}
                      readOnly
                      disabled
                      title="객실명은 변경할 수 없습니다. 이름이 예약·재고·템플릿 등에 그대로 쓰여 바꾸면 데이터가 어긋납니다."
                      />
                    <small className="warning-text">
                      객실명은 변경할 수 없습니다. 이름이 예약·재고·문자템플릿에 그대로 쓰여서
                      바꾸면 기존 예약이 어긋납니다. 이름을 바꾸려면 새 객실을 만들어 주세요.
                    </small>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4>요금 정보</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>기본요금</label>
                      <input
                        type="number"
                        value={formData.기본요금}
                        onChange={(e) => setFormData({...formData, 기본요금: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="form-group">
                      <label>주중요금</label>
                      <input
                        type="number"
                        value={formData.주중요금}
                        onChange={(e) => setFormData({...formData, 주중요금: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="form-group">
                      <label>주말요금</label>
                      <input
                        type="number"
                        value={formData.주말요금}
                        onChange={(e) => setFormData({...formData, 주말요금: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>인원 정보</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>기준인원</label>
                      <input
                        type="number"
                        value={formData.기준인원}
                        onChange={(e) => setFormData({...formData, 기준인원: parseInt(e.target.value) || 2})}
                        min="1"
                        max="10"
                      />
                    </div>
                    <div className="form-group">
                      <label>최대인원</label>
                      <input
                        type="number"
                        value={formData.최대인원}
                        onChange={(e) => setFormData({...formData, 최대인원: parseInt(e.target.value) || 4})}
                        min={formData.기준인원}
                        max="10"
                      />
                    </div>
                    <div className="form-group">
                      <label>추가인원요금</label>
                      <input
                        type="number"
                        value={formData.추가인원요금}
                        onChange={(e) => setFormData({...formData, 추가인원요금: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>재고 정보</h4>
                  <div className="form-group">
                    <label>기본재고</label>
                    <input
                      type="number"
                      value={formData.기본재고}
                      onChange={(e) => setFormData({...formData, 기본재고: parseInt(e.target.value) || 1})}
                      min="1"
                      max="10"
                    />
                    <small>날짜별 재고는 간단예약관리에서 개별 설정 가능합니다.</small>
                  </div>
                </div>

                <div className="form-section">
                  <h4>객실 설명</h4>
                  <div className="form-group">
                    <textarea
                      value={formData.설명}
                      onChange={(e) => setFormData({...formData, 설명: e.target.value})}
                      rows="3"
                      placeholder="객실 특징이나 설명을 입력하세요"
                    />
                  </div>
                </div>

                <div className="card-actions">
                  <button 
                    onClick={handleSave} 
                    className="btn btn-save"
                    disabled={isSaving}
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                  <button 
                    onClick={handleCancel} 
                    className="btn btn-cancel"
                    disabled={isSaving}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              // 보기 모드
              <div className={`view-mode ${room.isActive === false ? 'inactive' : ''}`}>
                <div className="room-header">
                  <h3>{room.객실명}</h3>
                  <label className="toggle-switch" title={room.isActive === false ? '비활성화됨 (예약 캘린더에서 숨김)' : '활성화됨'}>
                    <input
                      type="checkbox"
                      checked={room.isActive !== false}
                      onChange={() => toggleRoomActive(room.id, room.isActive !== false)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                {room.isActive === false && (
                  <div className="inactive-badge">🚫 비활성화 - 예약 캘린더에서 숨김</div>
                )}

                <div className="info-grid">
                  {/* 기본요금 */}
                  <div className="info-item">
                    <span className="label">기본요금</span>
                    {inlineEdit?.roomId === room.id && inlineEdit?.field === '기본요금' ? (
                      <div className="inline-edit-wrapper">
                        <input
                          type="number"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit({...inlineEdit, value: parseInt(e.target.value) || 0})}
                          onKeyDown={handleInlineKeyDown}
                          autoFocus
                          className="inline-edit-input"
                        />
                        <button onClick={saveInlineEdit} className="inline-btn save" disabled={isSaving}>✓</button>
                        <button onClick={cancelInlineEdit} className="inline-btn cancel">✕</button>
                      </div>
                    ) : (
                      <span className="value editable" onClick={() => startInlineEdit(room.id, '기본요금', room.기본요금 || 0)}>
                        {(room.기본요금 || 0).toLocaleString()}원
                        <span className="edit-icon">✏️</span>
                      </span>
                    )}
                  </div>

                  {/* 주중요금 */}
                  <div className="info-item">
                    <span className="label">주중요금</span>
                    {inlineEdit?.roomId === room.id && inlineEdit?.field === '주중요금' ? (
                      <div className="inline-edit-wrapper">
                        <input
                          type="number"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit({...inlineEdit, value: parseInt(e.target.value) || 0})}
                          onKeyDown={handleInlineKeyDown}
                          autoFocus
                          className="inline-edit-input"
                        />
                        <button onClick={saveInlineEdit} className="inline-btn save" disabled={isSaving}>✓</button>
                        <button onClick={cancelInlineEdit} className="inline-btn cancel">✕</button>
                      </div>
                    ) : (
                      <span className="value editable" onClick={() => startInlineEdit(room.id, '주중요금', room.주중요금 || room.기본요금 || 0)}>
                        {(room.주중요금 || room.기본요금 || 0).toLocaleString()}원
                        <span className="edit-icon">✏️</span>
                      </span>
                    )}
                  </div>

                  {/* 주말요금 */}
                  <div className="info-item">
                    <span className="label">주말요금</span>
                    {inlineEdit?.roomId === room.id && inlineEdit?.field === '주말요금' ? (
                      <div className="inline-edit-wrapper">
                        <input
                          type="number"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit({...inlineEdit, value: parseInt(e.target.value) || 0})}
                          onKeyDown={handleInlineKeyDown}
                          autoFocus
                          className="inline-edit-input"
                        />
                        <button onClick={saveInlineEdit} className="inline-btn save" disabled={isSaving}>✓</button>
                        <button onClick={cancelInlineEdit} className="inline-btn cancel">✕</button>
                      </div>
                    ) : (
                      <span className="value editable" onClick={() => startInlineEdit(room.id, '주말요금', room.주말요금 || room.기본요금 || 0)}>
                        {(room.주말요금 || room.기본요금 || 0).toLocaleString()}원
                        <span className="edit-icon">✏️</span>
                      </span>
                    )}
                  </div>

                  {/* 기준/최대인원 - 기존 수정 버튼으로만 변경 */}
                  <div className="info-item">
                    <span className="label">기준/최대인원</span>
                    <span className="value">{room.기준인원 || 2}명 / {room.최대인원 || 4}명</span>
                  </div>

                  {/* 추가인원요금 */}
                  <div className="info-item">
                    <span className="label">추가인원요금</span>
                    {inlineEdit?.roomId === room.id && inlineEdit?.field === '추가인원요금' ? (
                      <div className="inline-edit-wrapper">
                        <input
                          type="number"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit({...inlineEdit, value: parseInt(e.target.value) || 0})}
                          onKeyDown={handleInlineKeyDown}
                          autoFocus
                          className="inline-edit-input"
                        />
                        <button onClick={saveInlineEdit} className="inline-btn save" disabled={isSaving}>✓</button>
                        <button onClick={cancelInlineEdit} className="inline-btn cancel">✕</button>
                      </div>
                    ) : (
                      <span className="value editable" onClick={() => startInlineEdit(room.id, '추가인원요금', room.추가인원요금 || 0)}>
                        {(room.추가인원요금 || 0).toLocaleString()}원
                        <span className="edit-icon">✏️</span>
                      </span>
                    )}
                  </div>

                  {/* 기본재고 */}
                  <div className="info-item">
                    <span className="label">기본재고</span>
                    {inlineEdit?.roomId === room.id && inlineEdit?.field === '기본재고' ? (
                      <div className="inline-edit-wrapper">
                        <input
                          type="number"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit({...inlineEdit, value: parseInt(e.target.value) || 1})}
                          onKeyDown={handleInlineKeyDown}
                          autoFocus
                          min="1"
                          max="10"
                          className="inline-edit-input"
                        />
                        <button onClick={saveInlineEdit} className="inline-btn save" disabled={isSaving}>✓</button>
                        <button onClick={cancelInlineEdit} className="inline-btn cancel">✕</button>
                      </div>
                    ) : (
                      <span className="value editable" onClick={() => startInlineEdit(room.id, '기본재고', room.기본재고 || room.재고 || 1)}>
                        {room.기본재고 || room.재고 || 1}개
                        <span className="edit-icon">✏️</span>
                      </span>
                    )}
                  </div>
                </div>

                {room.설명 && (
                  <div className="room-description">
                    <p>{room.설명}</p>
                  </div>
                )}

                <div className="card-actions">
                  <button onClick={() => handleEdit(room)} className="btn btn-edit">
                    전체 수정
                  </button>
                  <button
                    onClick={() => handleDeleteRoom(room.id, room.객실명)}
                    className="btn btn-delete"
                    disabled={isDeletingRoom === room.id}
                  >
                    {isDeletingRoom === room.id ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 시즌 가격 규칙 섹션 */}
      <div className="season-rules-section">
        <div className="section-header-toggle" onClick={() => setShowSeasonRules(!showSeasonRules)}>
          <h3>📅 시즌 가격 규칙</h3>
          <span className="toggle-arrow">{showSeasonRules ? '▲' : '▼'}</span>
        </div>

        {showSeasonRules && (
          <div className="season-rules-content">
            <div className="section-actions">
              <button onClick={() => setIsAddingRule(true)} className="btn btn-primary">
                + 시즌 규칙 추가
              </button>
            </div>

            <div className="rules-list">
              {pricingRules && pricingRules.filter(rule => rule.type === 'season').length > 0 ? (
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
                          <button onClick={() => setEditingRule(rule)} className="btn btn-edit">
                            수정
                          </button>
                          <button onClick={() => deletePricingRule(rule.id)} className="btn btn-delete">
                            삭제
                          </button>
                        </div>
                      </div>

                      <div className="rule-details">
                        <div className="season-prices-grid">
                          {rooms.map(room => (
                            <div key={room.id} className="room-season-price">
                              <span className="room-name">{room.객실명}</span>
                              <div className="price-row">
                                <span className="price-label">주중:</span>
                                <span className="price-value">
                                  {(rule.weekdayPrices?.[room.id] || room.주중요금 || 0).toLocaleString()}원
                                </span>
                              </div>
                              <div className="price-row">
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
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 시즌 규칙 추가/수정 모달 */}
      {(isAddingRule || editingRule) && (
        <div className="modal-overlay">
          <div className="modal-content season-modal">
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

              rooms.forEach(room => {
                const weekdayPrice = formData.get(`weekday_${room.id}`);
                const weekendPrice = formData.get(`weekend_${room.id}`);
                if (weekdayPrice) ruleData.weekdayPrices[room.id] = parseInt(weekdayPrice);
                if (weekendPrice) ruleData.weekendPrices[room.id] = parseInt(weekendPrice);
              });

              if (editingRule) {
                // 부분 수정은 서버가 기존 data 에 **머지**한다 (통째 교체하면 안 보낸 필드가 사라진다)
                api('/api/pricing-rules', { body: { id: editingRule.id, ...ruleData } })
                  .then(async () => {
                    await refresh();
                    setEditingRule(null);
                    alert('시즌 규칙이 수정되었습니다.');
                  })
                  .catch((e) => alert(e.message || '수정 중 오류가 발생했습니다.'));
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
                  <input type="date" name="startDate" defaultValue={editingRule?.startDate || ''} required />
                </div>
                <div className="form-group">
                  <label>종료일</label>
                  <input type="date" name="endDate" defaultValue={editingRule?.endDate || ''} required />
                </div>
              </div>

              <div className="season-price-inputs">
                <h4>객실별 시즌 가격</h4>
                {rooms.filter(r => r.isActive !== false).map(room => (
                  <div key={room.id} className="room-season-input">
                    <span className="room-name">{room.객실명}</span>
                    <div className="price-inputs-row">
                      <div className="price-input-group">
                        <label>주중</label>
                        <input
                          type="number"
                          name={`weekday_${room.id}`}
                          defaultValue={editingRule?.weekdayPrices?.[room.id] || room.주중요금 || 0}
                        />
                      </div>
                      <div className="price-input-group">
                        <label>주말</label>
                        <input
                          type="number"
                          name={`weekend_${room.id}`}
                          defaultValue={editingRule?.weekendPrices?.[room.id] || room.주말요금 || 0}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card-actions">
                <button type="submit" className="btn btn-save">
                  {editingRule ? '수정' : '추가'}
                </button>
                <button type="button" onClick={() => { setIsAddingRule(false); setEditingRule(null); }} className="btn btn-cancel">
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

export default RoomManagement;