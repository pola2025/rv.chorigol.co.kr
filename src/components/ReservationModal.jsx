// src/components/ReservationModal.jsx
import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, getDoc, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendSMS, resendSMS } from '../utils/sms';
import { formatDateTime } from '../utils';
import './ReservationModal.css';

const ReservationModal = ({ reservation, onClose, onUpdate, onDelete }) => {
  const [editMode, setEditMode] = useState(false);
  // 초기 데이터에 필드 일관성 보장
  const [editedData, setEditedData] = useState({
    ...reservation,
    guests: reservation.guests || reservation.guestCount || 2,
    guestCount: reservation.guests || reservation.guestCount || 2,
    phone: reservation.phone || reservation.customerPhone,
    customerPhone: reservation.customerPhone || reservation.phone,
    options: reservation.options || []
  });
  const [loading, setLoading] = useState(false);
  const [smsStatus, setSmsStatus] = useState(reservation.smsStatus || {});
  const [sendingSMS, setSendingSMS] = useState(false);
  const [availableOptions, setAvailableOptions] = useState([]);
  const [rooms, setRooms] = useState([]);

  // 옵션과 객실 데이터 로드
  useEffect(() => {
    loadOptionsAndRooms();
  }, []);

  const loadOptionsAndRooms = async () => {
    try {
      // 옵션 데이터 로드
      const optionsSnapshot = await getDocs(collection(db, 'options'));
      const optionsData = optionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableOptions(optionsData);

      // 객실 데이터 로드
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      const roomsData = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRooms(roomsData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  // 가격 계산 함수 (현재 editedData 사용)
  const calculatePrices = () => {
    return calculatePricesWithData(editedData);
  };

  // 옵션 추가/제거 함수
  const handleOptionToggle = (option) => {
    const currentOptions = editedData.options || [];
    const existingIndex = currentOptions.findIndex(opt => 
      (typeof opt === 'object' && opt.name === option.명칭) ||
      (typeof opt === 'string' && opt === option.명칭)
    );

    let newOptions;
    if (existingIndex !== -1) {
      // 옵션 제거
      newOptions = currentOptions.filter((_, index) => index !== existingIndex);
    } else {
      // 옵션 추가
      const newOption = {
        name: option.명칭 || option.name,
        price: option.가격 || option.price || 0,
        onsite: option.현장결제 || option.onsite || false
      };
      newOptions = [...currentOptions, newOption];
    }

    // 옵션 변경 후 가격 재계산
    const updatedData = { ...editedData, options: newOptions };
    const prices = calculatePricesWithData(updatedData);
    
    setEditedData({ 
      ...updatedData, 
      totalPrice: prices.totalPrice,
      basePrice: prices.basePrice,
      extraGuestPrice: prices.extraGuestPrice,
      optionPrice: prices.optionPrice,
      roomPrice: prices.basePrice + prices.extraGuestPrice + prices.optionPrice
    });
  };

  // 데이터를 받아서 가격 계산하는 함수
  const calculatePricesWithData = (data) => {
    const room = rooms.find(r => r.객실명 === data.roomName || r.name === data.roomName);
    if (!room) return { basePrice: 0, extraGuestPrice: 0, optionPrice: 0, totalPrice: 0 };

    // 기본 가격
    const basePrice = room.기본가격 || room.basePrice || 0;

    // 인원 추가 비용 계산
    const standardGuests = room.기준인원 || room.standardGuests || 2;
    const guestCount = data.guests || data.guestCount || 2;
    const extraGuests = Math.max(0, guestCount - standardGuests);
    const extraGuestPrice = extraGuests * (room.인원추가가격 || room.extraGuestPrice || 0);

    // 옵션 가격 계산 (현장결제 제외)
    let optionPrice = 0;
    if (data.options && Array.isArray(data.options)) {
      data.options.forEach(opt => {
        if (typeof opt === 'object' && opt.price && !opt.onsite) {
          optionPrice += opt.price;
        }
      });
    }

    const totalPrice = basePrice + extraGuestPrice + optionPrice;

    return { basePrice, extraGuestPrice, optionPrice, totalPrice };
  };

  // 옵션이 선택되어 있는지 확인
  const isOptionSelected = (option) => {
    const currentOptions = editedData.options || [];
    return currentOptions.some(opt => 
      (typeof opt === 'object' && opt.name === option.명칭) ||
      (typeof opt === 'string' && opt === option.명칭)
    );
  };

  // SMS 상태 색상 및 아이콘 설정
  const getSMSStatusBadge = (type) => {
    const status = smsStatus[`${type}Sent`];
    const sentAt = smsStatus[`${type}SentAt`];
    const error = smsStatus[`${type}Error`];
    
    if (status === true) {
      // sentAt이 있고 유효한 경우에만 시간 표시
      let timeStr = '';
      if (sentAt) {
        try {
          let dateObj = null;
          
          // 다양한 형식의 날짜 처리
          if (sentAt && typeof sentAt === 'object') {
            // toDate 메서드가 있는 경우 (Firebase Timestamp)
            if (typeof sentAt.toDate === 'function') {
              dateObj = sentAt.toDate();
            }
            // seconds 필드가 있는 경우 (Firestore Timestamp 구조)
            else if (typeof sentAt.seconds === 'number') {
              dateObj = new Date(sentAt.seconds * 1000);
            }
            // _seconds 필드가 있는 경우 (다른 형식의 Timestamp)
            else if (typeof sentAt._seconds === 'number') {
              dateObj = new Date(sentAt._seconds * 1000);
            }
            // Date 객체인 경우
            else if (sentAt instanceof Date) {
              dateObj = sentAt;
            }
          }
          // 문자열인 경우
          else if (typeof sentAt === 'string') {
            dateObj = new Date(sentAt);
          }
          // 숫자(timestamp)인 경우
          else if (typeof sentAt === 'number') {
            dateObj = new Date(sentAt);
          }
          
          // 유효한 날짜인지 확인하고 formatDateTime 사용
          if (dateObj && !isNaN(dateObj.getTime())) {
            // utils의 formatDateTime 함수 사용
            timeStr = formatDateTime(dateObj);
          }
        } catch (e) {
          console.error('SMS 시간 파싱 오류:', e, 'sentAt 값:', sentAt);
        }
      }
      
      return (
        <span className="sms-badge success">
          ✅ 발송완료
          {timeStr && <span className="sms-time"> ({timeStr})</span>}
        </span>
      );
    } else if (error) {
      return (
        <span className="sms-badge error" title={error}>
          ❌ 발송실패: {error}
        </span>
      );
    } else {
      return null; // 대기중 표시 제거 (버튼으로 대체)
    }
  };

  // SMS 재발송
  const handleResendSMS = async (type) => {
    if (!confirm(`${type === 'confirmation' ? '확정' : type === 'checkIn' ? '입실안내' : '퇴실안내'} 문자를 재발송하시겠습니까?`)) {
      return;
    }

    setSendingSMS(true);
    try {
      // API 호출로 SMS 발송
      const result = await resendSMS(reservation.id, type);

      if (result.success) {
        alert('문자가 재발송되었습니다.');
        
        // Firestore 업데이트 (serverTimestamp 사용)
        const updates = {
          [`smsStatus.${type}Sent`]: true,
          [`smsStatus.${type}SentAt`]: serverTimestamp(),
          [`smsStatus.${type}Error`]: null,
          [`smsStatus.${type}RequestId`]: result.requestId
        };
        
        await updateDoc(doc(db, 'reservations', reservation.id), updates);
        
        // 로컬 상태는 Firestore에서 다시 읽어오기
        const updatedDoc = await getDoc(doc(db, 'reservations', reservation.id));
        if (updatedDoc.exists()) {
          const updatedData = updatedDoc.data();
          setSmsStatus(updatedData.smsStatus || {});
        }
      } else {
        alert('문자 발송에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('SMS 재발송 실패:', error);
      alert('문자 발송 중 오류가 발생했습니다.');
    } finally {
      setSendingSMS(false);
    }
  };

  // 저장 - 인원 필드 일관성 보장
  const handleSave = async () => {
    console.log('💾 [ReservationModal] 저장 시작:', editedData);
    setLoading(true);
    try {
      // 가격 재계산
      const { basePrice, extraGuestPrice, optionPrice, totalPrice } = calculatePrices();
      
      // 인원 필드 일관성 보장
      const dataToSave = {
        ...editedData,
        // guests와 guestCount 모두 업데이트
        guests: editedData.guests || editedData.guestCount || 2,
        guestCount: editedData.guests || editedData.guestCount || 2,
        // phone 필드도 일관성 보장
        phone: editedData.phone || editedData.customerPhone,
        customerPhone: editedData.customerPhone || editedData.phone,
        // 가격 정보 업데이트
        basePrice,
        extraGuestPrice,
        optionPrice,
        roomPrice: basePrice + extraGuestPrice + optionPrice,
        totalPrice,
        updatedAt: serverTimestamp()
      };

      console.log('💾 [ReservationModal] Firestore에 저장할 데이터:', dataToSave);

      // Firestore에 직접 업데이트
      await updateDoc(doc(db, 'reservations', reservation.id), dataToSave);
      console.log('✅ [ReservationModal] Firestore 업데이트 성공');
      
      // onUpdate 콜백 호출 (전체 데이터 전달)
      if (onUpdate) {
        console.log('📞 [ReservationModal] onUpdate 콜백 호출');
        await onUpdate({ ...dataToSave, id: reservation.id });
      }
      
      setEditMode(false);
      alert('예약 정보가 수정되었습니다.');
    } catch (error) {
      console.error('❌ [ReservationModal] 예약 수정 실패:', error);
      alert('예약 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!confirm('정말로 이 예약을 삭제하시겠습니까?')) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'reservations', reservation.id));
      
      if (onDelete) {
        onDelete(reservation.id);
      }
      
      alert('예약이 삭제되었습니다.');
      onClose();
    } catch (error) {
      console.error('예약 삭제 실패:', error);
      alert('예약 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 예약 상태 변경
  const handleStatusChange = async (newStatus) => {
    setLoading(true);
    try {
      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      // 예약 확정시 확정 문자 발송
      if (newStatus === '예약확정' && !smsStatus.confirmationSent) {
        try {
          // 예약 데이터 준비 (phone 필드 확인)
          const reservationData = {
            ...editedData,
            phone: editedData.phone || editedData.customerPhone  // phone이 표준
          };
          
          console.log('📱 예약 확정 SMS 발송:', {
            customerName: reservationData.customerName,
            phone: reservationData.phone
          });
          
          const result = await sendSMS(reservationData, 'confirmation');
          
          if (result.success) {
            updateData.smsStatus = {
              ...smsStatus,
              confirmationSent: true,
              confirmationSentAt: serverTimestamp(),
              confirmationRequestId: result.requestId
            };
            setSmsStatus(updateData.smsStatus);
          }
        } catch (smsError) {
          console.error('SMS 발송 실패:', smsError);
          alert(`SMS 발송 실패: ${smsError.message}`);
          // SMS 실패해도 상태 변경은 진행
        }
      }

      await updateDoc(doc(db, 'reservations', reservation.id), updateData);
      
      setEditedData({ ...editedData, status: newStatus });
      
      if (onUpdate) {
        onUpdate({ ...editedData, status: newStatus, id: reservation.id });
      }
      
      alert(`예약 상태가 ${newStatus}로 변경되었습니다.`);
    } catch (error) {
      console.error('상태 변경 실패:', error);
      alert('상태 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>예약 정보</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 기본 정보 */}
          <div className="info-section">
            <h3>고객 정보</h3>
            {editMode ? (
              <>
                <div className="form-group">
                  <label>고객명</label>
                  <input
                    type="text"
                    value={editedData.customerName}
                    onChange={(e) => setEditedData({ ...editedData, customerName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>연락처</label>
                  <input
                    type="tel"
                    value={editedData.customerPhone || editedData.phone || ''}
                    onChange={(e) => setEditedData({ 
                      ...editedData, 
                      customerPhone: e.target.value,
                      phone: e.target.value  // 두 필드 모두 업데이트
                    })}
                  />
                </div>
              </>
            ) : (
              <>
                <p><strong>고객명:</strong> {editedData.customerName}</p>
                <p><strong>연락처:</strong> {editedData.customerPhone || editedData.phone || '연락처 없음'}</p>
              </>
            )}
          </div>

          {/* 예약 정보 */}
          <div className="info-section">
            <h3>예약 정보</h3>
            {editMode ? (
              <>
                <div className="form-group">
                  <label>객실</label>
                  <select
                    value={editedData.roomName}
                    onChange={(e) => {
                      const newRoomName = e.target.value;
                      // 객실별 기본 인원 설정
                      let defaultGuests = 2;
                      if (newRoomName === 'Forest 패밀리' || newRoomName.includes('호수뷰')) {
                        defaultGuests = 4;  // Forest 패밀리와 호수뷰는 기준 4명
                      } else {
                        defaultGuests = 2;  // 나머지는 모두 기준 2명
                      }
                      const updatedData = { 
                        ...editedData, 
                        roomName: newRoomName,
                        guests: defaultGuests,
                        guestCount: defaultGuests
                      };
                      const prices = calculatePricesWithData(updatedData);
                      setEditedData({ 
                        ...updatedData,
                        totalPrice: prices.totalPrice,
                        basePrice: prices.basePrice,
                        extraGuestPrice: prices.extraGuestPrice,
                        optionPrice: prices.optionPrice,
                        roomPrice: prices.basePrice + prices.extraGuestPrice + prices.optionPrice
                      });
                    }}
                  >
                    <option value="Forest">Forest</option>
                    <option value="Forest mini">Forest mini</option>
                    <option value="Forest mini 패밀리">Forest mini 패밀리</option>
                    <option value="Forest 패밀리">Forest 패밀리</option>
                    <option value="호수뷰객실">호수뷰객실</option>
                    <option value="1박2일워크샵">1박2일워크샵</option>
                    <option value="야유회">야유회</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>체크인</label>
                  <input
                    type="date"
                    value={editedData.checkIn}
                    onChange={(e) => setEditedData({ ...editedData, checkIn: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>체크아웃</label>
                  <input
                    type="date"
                    value={editedData.checkOut}
                    onChange={(e) => setEditedData({ ...editedData, checkOut: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>인원</label>
                  <input
                    type="number"
                    value={editedData.guests || editedData.guestCount || 2}
                    onChange={(e) => {
                      const newCount = parseInt(e.target.value) || 2;
                      const updatedData = { 
                        ...editedData, 
                        guests: newCount,
                        guestCount: newCount  // 두 필드 모두 업데이트
                      };
                      const prices = calculatePricesWithData(updatedData);
                      setEditedData({ 
                        ...updatedData,
                        totalPrice: prices.totalPrice,
                        basePrice: prices.basePrice,
                        extraGuestPrice: prices.extraGuestPrice,
                        optionPrice: prices.optionPrice,
                        roomPrice: prices.basePrice + prices.extraGuestPrice + prices.optionPrice
                      });
                    }}
                    min="1"
                    max="20"
                  />
                </div>
                <div className="form-group">
                  <label>금액 (자동계산)</label>
                  <div className="price-calculation">
                    {(() => {
                      const prices = calculatePrices();
                      return (
                        <>
                          <div>객실요금: {prices.basePrice.toLocaleString()}원</div>
                          {prices.extraGuestPrice > 0 && (
                            <div>인원추가: +{prices.extraGuestPrice.toLocaleString()}원</div>
                          )}
                          {prices.optionPrice > 0 && (
                            <div>옵션: +{prices.optionPrice.toLocaleString()}원</div>
                          )}
                          <div style={{fontWeight: 'bold', marginTop: '5px'}}>
                            총합계: {prices.totalPrice.toLocaleString()}원
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <input
                    type="number"
                    value={editedData.totalPrice}
                    onChange={(e) => setEditedData({ ...editedData, totalPrice: parseInt(e.target.value) })}
                    placeholder="수동 입력 가능"
                  />
                </div>
                <div className="form-group">
                  <label>추가옵션</label>
                  <div className="options-selection">
                    {availableOptions.map(option => (
                      <label key={option.id} className="option-checkbox">
                        <input
                          type="checkbox"
                          checked={isOptionSelected(option)}
                          onChange={() => handleOptionToggle(option)}
                        />
                        <span className="option-label">
                          {option.명칭 || option.name}
                          {(option.가격 || option.price) > 0 && (
                            <span className="option-price">
                              (+{(option.가격 || option.price).toLocaleString()}원
                              {(option.현장결제 || option.onsite) && ' - 현장결제'})
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <p><strong>객실:</strong> {editedData.roomName}</p>
                <p><strong>체크인:</strong> {editedData.checkIn}</p>
                <p><strong>체크아웃:</strong> {editedData.checkOut}</p>
                <p><strong>인원:</strong> {editedData.guests || editedData.guestCount || 2}명</p>
                <p><strong>금액:</strong> {editedData.totalPrice?.toLocaleString()}원</p>
                {editedData.options && editedData.options.length > 0 && (
                  <div>
                    <strong>추가옵션:</strong>
                    <div className="option-list-vertical">
                      {editedData.options.map((opt, idx) => (
                        <div key={idx} className="option-item">
                          {typeof opt === 'object' ? 
                            (opt.name ? `${opt.name}${opt.price ? ` (+${opt.price.toLocaleString()}원)` : ''}${opt.onsite ? ' (현장결제)' : ''}` : JSON.stringify(opt)) 
                            : opt}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p><strong>상태:</strong> 
                  <span className={`status-badge status-${editedData.status}`}>
                    {editedData.status}
                  </span>
                </p>
              </>
            )}
          </div>

          {/* SMS 발송 상태 섹션 */}
          <div className="info-section sms-status-section">
            <h3>📱 SMS 발송 상태</h3>
            <div className="sms-status-grid">
              <div className="sms-status-item">
                <div className="sms-status-header">
                  <span className="sms-type">예약 확정</span>
                  {getSMSStatusBadge('confirmation')}
                </div>
                <button
                  className="btn-resend"
                  onClick={() => handleResendSMS('confirmation')}
                  disabled={sendingSMS}
                >
                  {sendingSMS ? '발송중...' : (smsStatus.confirmationSent ? '재발송' : '수동발송')}
                </button>
              </div>

              <div className="sms-status-item">
                <div className="sms-status-header">
                  <span className="sms-type">
                    입실 안내
                    <span className="sms-date">({editedData.checkIn})</span>
                  </span>
                  {getSMSStatusBadge('checkIn')}
                </div>
                <button
                  className="btn-resend"
                  onClick={() => handleResendSMS('checkIn')}
                  disabled={sendingSMS}
                >
                  {sendingSMS ? '발송중...' : (smsStatus.checkInSent ? '재발송' : '수동발송')}
                </button>
              </div>

              <div className="sms-status-item">
                <div className="sms-status-header">
                  <span className="sms-type">
                    퇴실 안내
                    <span className="sms-date">({editedData.checkOut})</span>
                  </span>
                  {getSMSStatusBadge('checkOut')}
                </div>
                <button
                  className="btn-resend"
                  onClick={() => handleResendSMS('checkOut')}
                  disabled={sendingSMS}
                >
                  {sendingSMS ? '발송중...' : (smsStatus.checkOutSent ? '재발송' : '수동발송')}
                </button>
              </div>
            </div>

            {/* SMS 발송 로그 */}
            {(smsStatus.confirmationRequestId || smsStatus.checkInRequestId || smsStatus.checkOutRequestId) && (
              <div className="sms-log-info">
                <p className="sms-log-title">📋 발송 ID:</p>
                {smsStatus.confirmationRequestId && (
                  <p className="sms-log-item">확정: {smsStatus.confirmationRequestId}</p>
                )}
                {smsStatus.checkInRequestId && (
                  <p className="sms-log-item">입실: {smsStatus.checkInRequestId}</p>
                )}
                {smsStatus.checkOutRequestId && (
                  <p className="sms-log-item">퇴실: {smsStatus.checkOutRequestId}</p>
                )}
              </div>
            )}
          </div>

          {/* 메모 */}
          <div className="info-section">
            <h3>메모</h3>
            {editMode ? (
              <textarea
                value={editedData.memo || ''}
                onChange={(e) => setEditedData({ ...editedData, memo: e.target.value })}
                placeholder="메모를 입력하세요..."
                rows="3"
              />
            ) : (
              <p>{editedData.memo || '메모 없음'}</p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="status-buttons">
            {!editMode && (
              <>
                <button
                  className="btn-status btn-confirm"
                  onClick={() => handleStatusChange('예약확정')}
                  disabled={loading || editedData.status === '예약확정'}
                >
                  예약확정
                </button>
                <button
                  className="btn-status btn-cancel"
                  onClick={() => handleStatusChange('예약취소')}
                  disabled={loading || editedData.status === '예약취소'}
                >
                  예약취소
                </button>
              </>
            )}
          </div>

          <div className="action-buttons">
            {editMode ? (
              <>
                <button
                  className="btn-save"
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? '저장중...' : '저장'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setEditMode(false);
                    // 취소 시 원래 데이터로 복원 (필드 일관성 보장)
                    setEditedData({
                      ...reservation,
                      guests: reservation.guests || reservation.guestCount || 2,
                      guestCount: reservation.guests || reservation.guestCount || 2,
                      phone: reservation.phone || reservation.customerPhone,
                      customerPhone: reservation.customerPhone || reservation.phone
                    });
                  }}
                  disabled={loading}
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-edit"
                  onClick={() => setEditMode(true)}
                  disabled={loading}
                >
                  수정
                </button>
                <button
                  className="btn-delete"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  삭제
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationModal;
