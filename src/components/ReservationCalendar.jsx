// src/components/ReservationCalendar.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import CustomCalendar from './CustomCalendar';
import ReservationModal from './ReservationModal';
import NewReservationModal from '../common/NewReservationModal';
import './ReservationCalendar.css';

const ReservationCalendar = ({ onConfirmReservation, onCancelReservation, onUpdateReservation, onAddReservation }) => {
  const [reservations, setReservations] = useState([]);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [options, setOptions] = useState([]); // 옵션 데이터 추가
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateReservations, setSelectedDateReservations] = useState([]);
  const [isNewReservationOpen, setIsNewReservationOpen] = useState(false);

  // 객실 데이터 로드
  useEffect(() => {
    loadRooms();
    loadOptions(); // 옵션 데이터도 로드
    loadReservations();
  }, []);

  const loadRooms = async () => {
    try {
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      const roomsData = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRooms(roomsData);
    } catch (error) {
      console.error('객실 데이터 로드 실패:', error);
    }
  };

  const loadOptions = async () => {
    try {
      const optionsSnapshot = await getDocs(collection(db, 'options'));
      const optionsData = optionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOptions(optionsData);
    } catch (error) {
      console.error('옵션 데이터 로드 실패:', error);
    }
  };

  const loadReservations = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'reservations'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReservations(data);
    } catch (error) {
      console.error('예약 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (dateStr) => {
    console.log('부모 컴포넌트 - 날짜 클릭:', dateStr, '현재 선택:', selectedDate);
    
    // 같은 날짜를 클릭하면 선택 해제
    if (selectedDate === dateStr) {
      console.log('같은 날짜 클릭 - 선택 해제');
      setSelectedDate(null);
      setSelectedDateReservations([]);
      return;
    }
    
    console.log('새로운 날짜 선택:', dateStr);
    setSelectedDate(dateStr);
    
    // 해당 날짜의 예약 필터링
    const dateReservations = reservations.filter(res => {
      const checkIn = new Date(res.checkIn);
      const checkOut = new Date(res.checkOut);
      const clickedDate = new Date(dateStr);
      
      return clickedDate >= checkIn && clickedDate < checkOut && res.status !== '예약취소';
    });
    
    setSelectedDateReservations(dateReservations);
  };

  // 예약 클릭 핸들러
  const handleReservationClick = (reservation) => {
    setSelectedReservation(reservation);
  };

  // 재고 확인 함수 추가
  const getAvailableStock = (dateStr, roomName) => {
    if (!dateStr || !roomName) return 0;
    
    // 해당 날짜의 객실 예약 현황 확인
    const room = rooms.find(r => r.객실명 === roomName || r.name === roomName);
    if (!room) return 0;
    
    const maxStock = room.재고 || room.stock || 1;
    
    // 해당 날짜의 예약 수 계산
    const bookedCount = reservations.filter(res => {
      if (res.status === '예약취소') return false;
      if (res.roomName !== roomName) return false;
      
      const checkIn = new Date(res.checkIn);
      const checkOut = new Date(res.checkOut);
      const targetDate = new Date(dateStr);
      
      return targetDate >= checkIn && targetDate < checkOut;
    }).length;
    
    return Math.max(0, maxStock - bookedCount);
  };

  // 새 예약 추가
  const handleAddReservation = () => {
    setIsNewReservationOpen(true);
  };

  // 예약 추가 완료
  const handleNewReservationSubmit = async (reservationData) => {
    console.log('🆕 [ReservationCalendar] 예약 추가 시작:', reservationData);
    
    try {
      // Dashboard의 handleAddNewReservation 호출
      if (onAddReservation) {
        console.log('🆕 [ReservationCalendar] onAddReservation 호출');
        await onAddReservation(reservationData);
      } else {
        console.error('❌ [ReservationCalendar] onAddReservation prop이 없습니다!');
        alert('예약 추가 기능이 연결되지 않았습니다.');
        return;
      }
      
      // 예약 목록 새로고침
      await loadReservations();
      setIsNewReservationOpen(false);
      console.log('✅ [ReservationCalendar] 예약 추가 완료');
    } catch (error) {
      console.error('❌ [ReservationCalendar] 예약 추가 실패:', error);
      alert('예약 추가 중 오류가 발생했습니다.');
    }
  };


  // 예약 업데이트 - Dashboard의 onUpdateReservation 호출
  const handleReservationUpdate = async (updatedReservation) => {
    console.log('📝 [ReservationCalendar] 예약 업데이트 시작:', updatedReservation);
    
    try {
      // Dashboard의 handleUpdateReservation 호출
      if (onUpdateReservation) {
        console.log('📝 [ReservationCalendar] onUpdateReservation 호출');
        // id와 업데이트할 데이터를 분리해서 전달
        const { id, ...updateData } = updatedReservation;
        await onUpdateReservation(id, updateData);
      } else {
        console.error('❌ [ReservationCalendar] onUpdateReservation prop이 없습니다!');
        alert('예약 수정 기능이 연결되지 않았습니다.');
        return;
      }
      
      // 예약 목록 새로고침
      await loadReservations();
      console.log('✅ [ReservationCalendar] 예약 업데이트 완료');
    } catch (error) {
      console.error('❌ [ReservationCalendar] 예약 업데이트 실패:', error);
      alert('예약 수정 중 오류가 발생했습니다.');
    }
  };

  // 예약 삭제
  const handleReservationDelete = (deletedId) => {
    setReservations(prev => prev.filter(r => r.id !== deletedId));
    loadReservations();
  };

  // 옵션 가격 계산
  const calculateOptionPrice = (options, type) => {
    if (!options || !Array.isArray(options)) return 0;
    
    return options.reduce((sum, opt) => {
      if (typeof opt === 'object' && opt.price) {
        if (type === 'included' && !opt.onsite) {
          return sum + opt.price;
        } else if (type === 'onsite' && opt.onsite) {
          return sum + opt.price;
        }
      }
      return sum;
    }, 0);
  };

  // SMS 상태 아이콘 표시
  const getSMSStatusIcon = (reservation) => {
    const smsStatus = reservation.smsStatus || {};
    const icons = [];
    
    if (smsStatus.confirmationSent) {
      icons.push(<span key="conf" className="sms-icon success" title="확정문자 발송완료">✉️</span>);
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    if (reservation.checkIn === today) {
      if (smsStatus.checkInSent) {
        icons.push(<span key="in" className="sms-icon success" title="입실안내 발송완료">📥</span>);
      } else {
        icons.push(<span key="in-pending" className="sms-icon pending" title="입실안내 대기중">⏳</span>);
      }
    }
    
    if (reservation.checkOut === today) {
      if (smsStatus.checkOutSent) {
        icons.push(<span key="out" className="sms-icon success" title="퇴실안내 발송완료">📤</span>);
      } else {
        icons.push(<span key="out-pending" className="sms-icon pending" title="퇴실안내 대기중">⏳</span>);
      }
    }
    
    return icons.length > 0 ? <div className="sms-status-icons">{icons}</div> : null;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="reservation-calendar-container">
      <div className="calendar-layout">
        {/* 메인 캘린더 영역 */}
        <div className="calendar-main">
          <div className="calendar-header">
            <h2>📅 예약 캘린더</h2>
          </div>

          <div className="calendar-content">
            <CustomCalendar
              rooms={rooms}
              bookings={reservations}
              onDateClick={handleDateClick}
              onBookingClick={handleReservationClick}
              selectedDate={selectedDate}
            />
          </div>
        </div>

        {/* 예약현황 패널 - PC: 사이드바, 모바일: 하단 */}
        {selectedDate && (
          <div className="reservation-panel">
            <div className="panel-header">
              <h3>예약 현황</h3>
              <span className="selected-date">{selectedDate}</span>
              <button 
                className="close-panel"
                onClick={() => {
                  setSelectedDate(null);
                  setSelectedDateReservations([]);
                }}
              >
                ✕
              </button>
            </div>
            
            {/* 예약 추가 버튼 */}
            <div className="panel-actions">
              <button 
                className="btn-add-reservation"
                onClick={handleAddReservation}
              >
                + 예약 추가
              </button>
            </div>
            
            <div className="reservation-list">
              {selectedDateReservations.length === 0 ? (
                <div className="no-reservations">
                  <p>예약이 없습니다</p>
                </div>
              ) : (
                // 객실명으로 정렬
                selectedDateReservations
                  .sort((a, b) => {
                    // 객실명 정렬 순서 정의
                    const roomOrder = [
                      'Forest',
                      'Forest mini',
                      'Forest 패밀리',
                      'Forest mini 패밀리',
                      '호수뷰객실',
                      '단체예약'
                    ];
                    const aIndex = roomOrder.indexOf(a.roomName);
                    const bIndex = roomOrder.indexOf(b.roomName);
                    
                    // 정의된 순서대로 정렬
                    if (aIndex !== -1 && bIndex !== -1) {
                      return aIndex - bIndex;
                    }
                    // 정의되지 않은 객실은 뒤로
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    // 둘 다 정의되지 않은 경우 알파벳 순
                    return a.roomName.localeCompare(b.roomName);
                  })
                  .map(reservation => {
                  // 예약 데이터의 가격 구조 확인
                  console.log('💰 예약 가격 데이터:', {
                    customerName: reservation.customerName,
                    roomPrice: reservation.roomPrice,
                    basePrice: reservation.basePrice,
                    extraGuestPrice: reservation.extraGuestPrice,
                    optionPrice: reservation.optionPrice,
                    totalPrice: reservation.totalPrice
                  });
                  
                  // basePrice가 있으면 새 데이터 구조, 없으면 기존 데이터 구조
                  const hasDetailedPricing = reservation.basePrice !== undefined;
                  
                  let displayRoomPrice, displayExtraGuestPrice, displayIncludedOptionsPrice, totalIncludedPrice;
                  
                  if (hasDetailedPricing) {
                    // 새로운 데이터 구조 (NewReservationModal에서 저장한 경우)
                    // roomPrice = basePrice + extraGuestPrice + optionPrice로 저장됨
                    displayRoomPrice = reservation.basePrice || 0;  // 순수 객실 요금
                    displayExtraGuestPrice = reservation.extraGuestPrice || 0;
                    displayIncludedOptionsPrice = reservation.optionPrice || 0;
                    totalIncludedPrice = reservation.roomPrice || reservation.totalPrice || 0;  // 이미 합계가 계산된 값
                  } else {
                    // 기존 데이터 구조 (수동으로 입력한 경우)
                    displayRoomPrice = reservation.roomPrice || reservation.totalPrice || 0;
                    displayExtraGuestPrice = 0;  // 기존 데이터는 분리되어 있지 않음
                    displayIncludedOptionsPrice = 0;
                    totalIncludedPrice = displayRoomPrice;  // roomPrice를 그대로 사용
                  }
                  
                  const onsiteOptionsPrice = calculateOptionPrice(reservation.options, 'onsite');
                  
                  console.log('📊 계산 결과:', {
                    customerName: reservation.customerName,
                    displayRoomPrice,
                    displayExtraGuestPrice,
                    displayIncludedOptionsPrice,
                    totalIncludedPrice,
                    onsiteOptionsPrice
                  });
                  
                  return (
                    <div 
                      key={reservation.id} 
                      className="reservation-card"
                      data-room={reservation.roomName}
                      onClick={() => handleReservationClick(reservation)}
                    >
                      {/* 객실명을 제일 위에 크게 표시 */}
                      <div className="room-section">
                        <span className="room-name-large">{reservation.roomName}</span>
                        {getSMSStatusIcon(reservation)}
                      </div>

                      {/* 고객 정보 - 한 줄로 */}
                      <div className="customer-section">
                        <span className="customer-name">{reservation.customerName}</span>
                        <span className="divider">•</span>
                        <span className="customer-phone">{reservation.customerPhone || reservation.phone}</span>
                      </div>

                      {/* 예약 상세 정보 */}
                      <div className="booking-info">
                        <div className="booking-main-line">
                          <span className="guest-count-text">{reservation.guests || reservation.guestCount || 2}명</span>
                          <span className="date-text">
                            {reservation.checkIn.slice(2).replace(/-/g, '.')}~{reservation.checkOut.slice(2).replace(/-/g, '.')}
                          </span>
                        </div>
                        {reservation.memo && (
                          <div className="memo-line">
                            메모: {reservation.memo}
                          </div>
                        )}
                      </div>

                      {/* 옵션 */}
                      {reservation.options && reservation.options.length > 0 && (
                        <div className="options-section">
                          <span className="label">옵션:</span>
                          <div className="options-list">
                            {reservation.options.map((opt, idx) => {
                              const isObject = typeof opt === 'object';
                              const optName = isObject ? opt.name : opt;
                              const optPrice = isObject ? opt.price : 0;
                              const isOnsite = isObject ? opt.onsite : false;
                              
                              return (
                                <span 
                                  key={idx} 
                                  className={`option-tag ${isOnsite ? 'onsite' : 'included'}`}
                                >
                                  {optName}
                                  {optPrice > 0 && ` +${optPrice.toLocaleString()}원`}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 요금 정보 */}
                      <div className="price-section">
                        {/* 요금 상세 내역 */}
                        <div className="price-breakdown">
                          <div className="price-item">
                            <span className="label">객실요금:</span>
                            <span className="value">{displayRoomPrice.toLocaleString()}원</span>
                          </div>
                          {displayExtraGuestPrice > 0 && (
                            <div className="price-item">
                              <span className="label">인원추가:</span>
                              <span className="value">+{displayExtraGuestPrice.toLocaleString()}원</span>
                            </div>
                          )}
                          {displayIncludedOptionsPrice > 0 && (
                            <div className="price-item">
                              <span className="label">옵션:</span>
                              <span className="value">+{displayIncludedOptionsPrice.toLocaleString()}원</span>
                            </div>
                          )}
                        </div>
                        
                        {/* 총합계 */}
                        <div className="price-row total">
                          <span className="label">요금합계:</span>
                          <span className="value">{totalIncludedPrice.toLocaleString()}원</span>
                        </div>
                        
                        {onsiteOptionsPrice > 0 && (
                          <div className="price-row onsite">
                            <span className="label">현장결제:</span>
                            <span className="value">{onsiteOptionsPrice.toLocaleString()}원</span>
                          </div>
                        )}
                      </div>

                      {/* 상태 표시만 (버튼 제거) */}
                      <div className="action-section">
                        <span className={`status-badge ${reservation.status}`}>
                          {reservation.status}
                        </span>
                        <div className="action-buttons">
                          {reservation.status !== '예약취소' && (
                            <button 
                              className="btn-cancel"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancelReservation && onCancelReservation(reservation);
                              }}
                            >
                              예약취소
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 예약 상세 모달 */}
      {selectedReservation && (
        <ReservationModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onUpdate={handleReservationUpdate}
          onDelete={handleReservationDelete}
        />
      )}

      {/* 새 예약 추가 모달 */}
      {isNewReservationOpen && (
        <NewReservationModal
          isOpen={isNewReservationOpen}
          onClose={() => setIsNewReservationOpen(false)}
          dateStr={selectedDate}
          rooms={rooms}
          options={options}  // 옵션 데이터 추가
          getAvailableStock={getAvailableStock}  // 재고 확인 함수 추가
          onSubmit={handleNewReservationSubmit}
        />
      )}
    </div>
  );
};

export default ReservationCalendar;