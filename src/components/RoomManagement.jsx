// src/components/RoomManagement.jsx
import React, { useState, useEffect } from 'react';
import { useRooms } from '../hooks/useRooms';
import { useReservations } from '../hooks/useReservations';
import { 
  doc, 
  updateDoc, 
  addDoc, 
  collection, 
  deleteDoc,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import DataInitializer from './DataInitializer';
import './RoomManagement.css';

const RoomManagement = () => {
  const { data: rooms, isLoading } = useRooms();
  const { data: reservations } = useReservations();
  const [editingRoom, setEditingRoom] = useState(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingRoom, setIsDeletingRoom] = useState(null);
  const [originalRoomName, setOriginalRoomName] = useState('');

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

  // 객실명 변경 시 관련 예약 업데이트
  const updateRelatedReservations = async (oldRoomName, newRoomName) => {
    try {
      // 해당 객실명을 가진 예약들 찾기
      const reservationsRef = collection(db, 'reservations');
      const q = query(reservationsRef, where('room', '==', oldRoomName));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log('업데이트할 예약이 없습니다.');
        return;
      }

      // Batch 작업으로 모든 예약 업데이트
      const batch = writeBatch(db);
      let updateCount = 0;

      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, { 
          room: newRoomName,
          updatedAt: new Date().toISOString()
        });
        updateCount++;
      });

      await batch.commit();
      console.log(`${updateCount}개의 예약이 업데이트되었습니다.`);
      return updateCount;
    } catch (error) {
      console.error('예약 업데이트 중 오류:', error);
      throw error;
    }
  };

  // 객실명 변경 시 인벤토리 오버라이드 업데이트
  const updateInventoryOverrides = async (oldRoomName, newRoomName) => {
    try {
      const overridesRef = collection(db, 'inventory_overrides');
      const querySnapshot = await getDocs(overridesRef);
      
      const batch = writeBatch(db);
      let updateCount = 0;

      querySnapshot.forEach((docSnapshot) => {
        const docId = docSnapshot.id;
        // inventory_overrides의 ID 형식: "YYYY-MM-DD_객실명"
        if (docId.includes(`_${oldRoomName}`)) {
          const [date] = docId.split('_');
          const newDocId = `${date}_${newRoomName}`;
          
          // 기존 문서 삭제하고 새 문서 생성
          batch.delete(docSnapshot.ref);
          batch.set(doc(db, 'inventory_overrides', newDocId), {
            ...docSnapshot.data(),
            updatedAt: new Date().toISOString()
          });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`${updateCount}개의 인벤토리 오버라이드가 업데이트되었습니다.`);
      }
      
      return updateCount;
    } catch (error) {
      console.error('인벤토리 오버라이드 업데이트 중 오류:', error);
      throw error;
    }
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

    // 객실명이 변경되었는지 확인
    const isRoomNameChanged = originalRoomName !== formData.객실명.trim();
    
    if (isRoomNameChanged) {
      // 관련 예약이 있는지 확인
      const relatedReservations = reservations.filter(r => 
        r.room === originalRoomName && r.status !== '예약취소'
      );
      
      if (relatedReservations.length > 0) {
        const confirmMsg = `"${originalRoomName}"으로 등록된 ${relatedReservations.length}개의 예약이 있습니다.\n` +
                          `객실명을 "${formData.객실명.trim()}"으로 변경하면 모든 예약도 함께 업데이트됩니다.\n\n` +
                          `계속하시겠습니까?`;
        
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      // 객실 정보 업데이트
      const roomRef = doc(db, 'rooms', editingRoom);
      await updateDoc(roomRef, {
        ...formData,
        객실명: formData.객실명.trim(),
        재고: formData.기본재고,
        updatedAt: new Date().toISOString()
      });

      // 객실명이 변경된 경우 관련 데이터 업데이트
      if (isRoomNameChanged) {
        console.log(`객실명 변경: ${originalRoomName} → ${formData.객실명.trim()}`);
        
        // 예약 업데이트
        const updatedReservations = await updateRelatedReservations(
          originalRoomName, 
          formData.객실명.trim()
        );
        
        // 인벤토리 오버라이드 업데이트
        const updatedOverrides = await updateInventoryOverrides(
          originalRoomName,
          formData.객실명.trim()
        );

        if (updatedReservations > 0 || updatedOverrides > 0) {
          alert(`객실 정보가 수정되었습니다.\n` +
                `- 업데이트된 예약: ${updatedReservations || 0}개\n` +
                `- 업데이트된 재고 설정: ${updatedOverrides || 0}개`);
        } else {
          alert('객실 정보가 수정되었습니다.');
        }
      } else {
        alert('객실 정보가 수정되었습니다.');
      }
      
      setEditingRoom(null);
      setFormData({});
      setOriginalRoomName('');
    } catch (error) {
      console.error('객실 정보 수정 오류:', error);
      alert('수정 중 오류가 발생했습니다.');
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
      const roomData = {
        ...formData,
        객실명: formData.객실명.trim(),
        재고: formData.기본재고,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'rooms'), roomData);
      
      alert('새 객실이 추가되었습니다.');
      setIsAddingRoom(false);
      setFormData({});
    } catch (error) {
      console.error('객실 추가 오류:', error);
      alert('객실 추가 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId, roomName) => {
    // 관련 예약이 있는지 확인
    const relatedReservations = reservations.filter(r => 
      r.room === roomName && r.status !== '예약취소'
    );
    
    if (relatedReservations.length > 0) {
      alert(`"${roomName}" 객실에 ${relatedReservations.length}개의 활성 예약이 있어 삭제할 수 없습니다.\n` +
            `먼저 해당 예약들을 취소하거나 다른 객실로 변경해주세요.`);
      return;
    }

    if (!window.confirm(`정말로 "${roomName}" 객실을 삭제하시겠습니까?\n\n⚠️ 주의: 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setIsDeletingRoom(roomId);
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
      alert('객실이 삭제되었습니다.');
    } catch (error) {
      console.error('객실 삭제 오류:', error);
      alert('객실 삭제 중 오류가 발생했습니다.');
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

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  // 객실이 없는 경우 초기화 화면 표시
  if (!rooms || rooms.length === 0) {
    return (
      <div className="room-management">
        <DataInitializer onComplete={() => window.location.reload()} />
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
                      onChange={(e) => setFormData({...formData, 객실명: e.target.value})}
                      placeholder="예: 스탠다드룸"
                    />
                    {originalRoomName !== formData.객실명.trim() && formData.객실명.trim() && (
                      <small className="warning-text">
                        ⚠️ 객실명 변경 시 관련된 모든 예약이 자동으로 업데이트됩니다.
                      </small>
                    )}
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
              <div className="view-mode">
                <h3>{room.객실명}</h3>
                
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">기본요금</span>
                    <span className="value">{(room.기본요금 || 0).toLocaleString()}원</span>
                  </div>
                  <div className="info-item">
                    <span className="label">주중요금</span>
                    <span className="value">{(room.주중요금 || room.기본요금 || 0).toLocaleString()}원</span>
                  </div>
                  <div className="info-item">
                    <span className="label">주말요금</span>
                    <span className="value">{(room.주말요금 || room.기본요금 || 0).toLocaleString()}원</span>
                  </div>
                  <div className="info-item">
                    <span className="label">기준/최대인원</span>
                    <span className="value">{room.기준인원 || 2}명 / {room.최대인원 || 4}명</span>
                  </div>
                  <div className="info-item">
                    <span className="label">추가인원요금</span>
                    <span className="value">{(room.추가인원요금 || 0).toLocaleString()}원</span>
                  </div>
                  <div className="info-item">
                    <span className="label">기본재고</span>
                    <span className="value">{room.기본재고 || room.재고 || 1}개</span>
                  </div>
                </div>

                {room.설명 && (
                  <div className="room-description">
                    <p>{room.설명}</p>
                  </div>
                )}

                <div className="card-actions">
                  <button onClick={() => handleEdit(room)} className="btn btn-edit">
                    수정
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
    </div>
  );
};

export default RoomManagement;