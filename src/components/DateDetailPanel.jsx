// DateDetailPanel.jsx - 마이그레이션 버전
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useReservationStore from '../stores/useReservationStore';
import useFirebaseStore from '../stores/useFirebaseStore';
import { useAvailableStock } from '../hooks/useReservations';
import BookingModal from './BookingModal';
import CustomerBadge from './CustomerBadge';
import migrationDebugger, { DEBUG_LEVELS } from '../utils/migrationDebugger';
import './DateDetailPanel.css';

function DateDetailPanel({ selectedDate, onClose, onNewReservation, onConfirmReservation, onCancelReservation, onUpdateReservation }) {
  // 디버그 시작
  migrationDebugger.startPerformance('DateDetailPanel');
  migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'DateDetailPanel', 'Component rendered', { selectedDate });

  const { rooms = [], options = [] } = useFirebaseStore();
  const { reservations = [] } = useFirebaseStore();
  const { getAvailableStock } = useAvailableStock();
  // 직접 호출하던 훅 제거
  // const { mutateAsync: cancelReservation } = useCancelReservation();
  // const { mutateAsync: confirmReservation } = useConfirmReservation();
  // const { mutateAsync: updateReservation } = useUpdateReservation();
  const [expandedReservation, setExpandedReservation] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  
  // 🔄 MIGRATION: useEffect 제거, React Query로 교체
  const queryClient = useQueryClient();
  
  const { data: isMobile } = useQuery({
    queryKey: ['isMobile-dateDetail'],
    queryFn: () => window.innerWidth < 768,
    staleTime: Infinity,
    initialData: window.innerWidth < 768
  });

  // Window resize 이벤트 리스너 (선언형)
  React.useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      queryClient.setQueryData(['isMobile-dateDetail'], newIsMobile);
      migrationDebugger.log(DEBUG_LEVELS.TRACE, 'DateDetailPanel', 'Window resized', { 
        isMobile: newIsMobile,
        width: window.innerWidth 
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [queryClient]);

  // 선택된 날짜의 예약 정보 가져오기 (취소된 예약 제외)
  const dateReservations = React.useMemo(() => {
    const filtered = reservations.filter(reservation => {
      // 예약 취소 상태 제외
      if (reservation.status === '예약취소') return false;
      
      const checkIn = new Date(reservation.checkIn);
      const checkOut = new Date(reservation.checkOut);
      const selected = new Date(selectedDate);
      
      checkIn.setHours(0, 0, 0, 0);
      checkOut.setHours(0, 0, 0, 0);
      selected.setHours(0, 0, 0, 0);
      
      return selected >= checkIn && selected < checkOut;
    });

    migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'DateDetailPanel', 'Date reservations filtered', {
      total: reservations.length,
      filtered: filtered.length,
      date: selectedDate
    });

    return filtered;
  }, [reservations, selectedDate]);

  // 객실별 예약 정보 그룹화
  const roomReservations = React.useMemo(() => {
    const grouped = {};
    rooms.forEach(room => {
      grouped[room.객실명] = {
        room,
        reservations: dateReservations.filter(r => r.roomName === room.객실명)
      };
    });
    return grouped;
  }, [rooms, dateReservations]);

  // 전체 통계 계산
  const statistics = React.useMemo(() => {
    const totalRooms = rooms.reduce((sum, room) => sum + room.재고, 0);
    const totalReservations = dateReservations.length;
    
    // 실제 사용된 객실 수 계산 (막기 포함)
    let totalUsedRooms = 0;
    rooms.forEach(room => {
      const availableStock = getAvailableStock(selectedDate, room.객실명);
      totalUsedRooms += (room.재고 - availableStock);
    });
    
    const occupancyRate = totalRooms > 0 ? Math.round((totalUsedRooms / totalRooms) * 100) : 0;
    const totalRevenue = dateReservations
      .filter(res => res.source !== '막기' && res.status !== '예약취소')
      .reduce((sum, res) => sum + (res.totalPrice || 0), 0);

    const stats = {
      totalRooms,
      totalReservations,
      totalUsedRooms,
      occupancyRate,
      totalRevenue
    };

    migrationDebugger.log(DEBUG_LEVELS.INFO, 'DateDetailPanel', 'Statistics calculated', stats);
    
    return stats;
  }, [rooms, dateReservations, selectedDate, getAvailableStock]);

  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  const handleNewReservation = (roomName) => {
    console.log('[DateDetailPanel] handleNewReservation called');
    console.log('[DateDetailPanel] roomName:', roomName);
    console.log('[DateDetailPanel] selectedDate:', selectedDate);
    console.log('[DateDetailPanel] onNewReservation type:', typeof onNewReservation);
    console.log('[DateDetailPanel] onNewReservation:', onNewReservation);
    
    if (!onNewReservation) {
      console.error('[DateDetailPanel] onNewReservation is not defined!');
      alert('예약 추가 기능이 정의되지 않았습니다.');
      return;
    }
    
    const checkInDate = new Date(selectedDate);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 1);
    
    const reservationData = {
      roomName,
      checkIn: selectedDate,
      checkOut: checkOutDate.toISOString().split('T')[0] // 1박2일 기본
    };

    migrationDebugger.log(DEBUG_LEVELS.INFO, 'DateDetailPanel', 'New reservation initiated', reservationData);
    
    try {
      onNewReservation(reservationData);
    } catch (error) {
      console.error('[DateDetailPanel] Error calling onNewReservation:', error);
      alert('예약 추가 중 오류가 발생했습니다.');
    }
  };

  const getSourceIcon = (source) => {
    const icons = {
      '이체예약': '💳',
      '단체예약': '👥',
      '막기': '🚫',
      '캘린더': '📅',
      '폼': '📝',
      '목록': '📋',
      '기타': '📌'
    };
    return icons[source] || '📌';
  };

  const getStatusColor = (status) => {
    const colors = {
      '예약확정': '#4CAF50',
      '이체대기': '#FF9800',
      '예약취소': '#f44336'
    };
    return colors[status] || '#999';
  };

  const getOptionIcon = (optionName) => {
    const option = options.find(opt => opt.name === optionName);
    return option?.icon || '🔧';
  };

  // 옵션의 결제 방식 확인 (현장결제 vs 요금포함)
  const getOptionPaymentType = (optionName) => {
    const option = options.find(opt => opt.name === optionName);
    return option?.paymentMethod || 'unknown';
  };

  const toggleReservation = (reservationId) => {
    setExpandedReservation(expandedReservation === reservationId ? null : reservationId);
    migrationDebugger.log(DEBUG_LEVELS.TRACE, 'DateDetailPanel', 'Reservation toggled', { 
      reservationId,
      expanded: expandedReservation !== reservationId 
    });
  };

  const handleReservationClick = (reservation) => {
    setSelectedReservation(reservation);
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'DateDetailPanel', 'Reservation selected', { 
      reservationId: reservation.id 
    });
  };

  // 성능 모니터링 종료
  migrationDebugger.endPerformance('DateDetailPanel');

  return (
    <>
      {/* 백드롭 */}
      <div 
        className="date-detail-backdrop" 
        onClick={onClose}
      />
      
      <div className={`date-detail-panel ${isMobile ? 'mobile' : 'desktop'}`}>
        <div className="date-detail-header">
          <h3>{formatDate(selectedDate)}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        {isMobile && (
          <div className="mobile-summary">
            <div className="summary-stat">
              <span className="stat-label">객실</span>
              <span className="stat-value">{statistics.totalUsedRooms}/{statistics.totalRooms}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">점유율</span>
              <span className="stat-value">{statistics.occupancyRate}%</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">매출</span>
              <span className="stat-value">₩{statistics.totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        )}
        
        <div className="date-detail-body">
          {!isMobile && (
            <div className="date-summary">
              <h4>📊 예약 요약</h4>
              <div className="summary-content">
                <div className="summary-item">
                  <span className="summary-label">전체</span>
                  <span className="summary-value">{statistics.totalUsedRooms}/{statistics.totalRooms}</span>
                </div>
                {Object.entries(roomReservations).map(([roomName, data]) => {
                  const availableStock = getAvailableStock(selectedDate, roomName);
                  return (
                    <div key={roomName} className="summary-item room-summary">
                      <span className="summary-label">{roomName}</span>
                      <span className="summary-value">
                        {data.room.재고 - availableStock}/{data.room.재고}
                      </span>
                    </div>
                  );
                })}
                <div className="summary-divider"></div>
                <div className="summary-item">
                  <span className="summary-label">💰 매출</span>
                  <span className="summary-value">₩{statistics.totalRevenue.toLocaleString()}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">📈 점유율</span>
                  <span className="summary-value">{statistics.occupancyRate}%</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="room-details">
            {Object.entries(roomReservations).map(([roomName, data]) => {
              const { room, reservations: roomReservations } = data;
              // getAvailableStock을 사용하여 실제 재고 계산
              const availableStock = getAvailableStock(selectedDate, roomName);
              const isFullyBooked = availableStock <= 0;
              
              return (
                <div key={roomName} className="room-card">
                  <div className="room-card-header">
                    <div className="room-title">
                      <span className="room-icon">🏠</span>
                      <h4>{roomName}</h4>
                    </div>
                    {!isMobile && (
                      <span className="room-price">₩{room.가격?.toLocaleString() || 0}</span>
                    )}
                  </div>
                  
                  <div className="room-inventory">
                    <span>객실 {availableStock}/{room.재고}</span>
                  </div>
                  
                  {/* 예약자 리스트 */}
                  {roomReservations.length > 0 ? (
                    <div className="reservations-list">
                      {isMobile && (
                        <div className="reservation-list-header">
                          <span>👥 예약자 {roomReservations.length}명</span>
                        </div>
                      )}
                      {roomReservations.map(reservation => (
                        <div key={reservation.id} className="reservation-item">
                          <div 
                            className="reservation-header"
                            onClick={() => isMobile ? toggleReservation(reservation.id) : handleReservationClick(reservation)}
                          >
                            <div className="reservation-main-info">
                              <span className="guest-name">
                                <CustomerBadge customerName={reservation.customerName} phone={reservation.phone} />
                              </span>
                              <span 
                                className="status-dot" 
                                style={{ backgroundColor: getStatusColor(reservation.status) }}
                                title={reservation.status}
                              />
                              {isMobile && (
                                <span className="expand-icon">
                                  {expandedReservation === reservation.id ? '▲' : '▼'}
                                </span>
                              )}
                            </div>
                            {!isMobile && (
                              <div className="reservation-info-wrapper">
                                <div className="reservation-quick-info">
                                  <span className="source-icon" title={reservation.source}>
                                    {getSourceIcon(reservation.source)}
                                  </span>
                                  {reservation.options?.length > 0 && (
                                    <div className="reservation-options">
                                      {reservation.options.map((opt, idx) => {
                                        const paymentType = getOptionPaymentType(opt);
                                        // 결제 방식별 클래스 설정
                                        const paymentClass = paymentType === 'onSite' ? 'onsite' : 
                                                           paymentType === 'included' ? 'included' : '';
                                        return (
                                          <span 
                                            key={idx} 
                                            className={`option-item ${paymentClass}`}
                                            title={`${opt} (${paymentType === 'onSite' ? '현장결제' : paymentType === 'included' ? '요금포함' : ''})`}
                                          >
                                            <span className="option-icon">{getOptionIcon(opt)}</span>
                                            <span className="option-label">{opt}</span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <span className="guest-count">{reservation.guests || '-'}명</span>
                                  <span className="phone-info">{reservation.phone}</span>
                                </div>
                                {reservation.memo && (
                                  <div className="memo-preview" title={reservation.memo}>
                                    📝 {reservation.memo.length > 30 ? reservation.memo.substring(0, 30) + '...' : reservation.memo}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {(isMobile && expandedReservation === reservation.id) && (
                            <div className="reservation-details">
                              <div className="detail-row">
                                <span className="detail-icon">👥</span>
                                <span>{reservation.guests || '-'}명</span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-icon">📞</span>
                                <span>{reservation.phone}</span>
                              </div>
                              {reservation.options?.length > 0 && (
                                <div className="detail-row">
                                  <span className="detail-icon">🎯</span>
                                  <div className="reservation-options">
                                    {reservation.options.map((opt, idx) => {
                                      const paymentType = getOptionPaymentType(opt);
                                      const paymentClass = paymentType === 'onSite' ? 'onsite' : 
                                                         paymentType === 'included' ? 'included' : '';
                                      return (
                                        <span 
                                          key={idx} 
                                          className={`option-item ${paymentClass}`}
                                        >
                                          <span className="option-label">{opt}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {reservation.memo && (
                                <div className="detail-row">
                                  <span className="detail-icon">📝</span>
                                  <span className="memo-text">{reservation.memo}</span>
                                </div>
                              )}
                              <div className="detail-row">
                                <span className="detail-icon">💰</span>
                                <span>₩{reservation.totalPrice?.toLocaleString() || 0}</span>
                              </div>
                              <div className="mobile-actions">
                                <button 
                                  className="action-btn detail-btn"
                                  onClick={() => handleReservationClick(reservation)}
                                >
                                  상세
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-reservations">
                      <span>예약 없음</span>
                    </div>
                  )}
                  
                  <div className="room-actions">
                    {!isFullyBooked && (
                      <button 
                        className="action-btn reserve-btn"
                        onClick={() => handleNewReservation(roomName)}
                        title="예약하기"
                      >
                        ➕
                      </button>
                    )}
                    {!isFullyBooked && (
                      <button 
                        className="action-btn block-btn"
                        onClick={() => {
                          // checkOut 날짜를 문자열 형식으로 생성
                          const checkInDate = new Date(selectedDate);
                          const checkOutDate = new Date(checkInDate);
                          checkOutDate.setDate(checkOutDate.getDate() + 1);
                          
                          const blockData = {
                            roomName,
                            checkIn: selectedDate,
                            checkOut: checkOutDate.toISOString().split('T')[0],
                            source: '막기'
                          };

                          migrationDebugger.log(DEBUG_LEVELS.INFO, 'DateDetailPanel', 'Block initiated', blockData);
                          onNewReservation(blockData);
                        }}
                        title="막기"
                      >
                        🚫
                      </button>
                    )}
                    {isFullyBooked && (
                      <div className="fully-booked-message">
                        <span>🚫 예약 마감</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedReservation && (
        <BookingModal
          booking={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onConfirm={async (id, depositorName) => {
            // 예약 확정 처리 - Dashboard의 핸들러 사용
            console.log('🟢 [DateDetailPanel] 예약 확정 - onConfirmReservation 호출');
            migrationDebugger.log(DEBUG_LEVELS.INFO, 'DateDetailPanel', 'Confirm reservation', { id, depositorName });
            
            // Props로 전달받은 핸들러 사용
            if (onConfirmReservation) {
              await onConfirmReservation(id, depositorName);
              setSelectedReservation(null); // BookingModal 닫기
            } else {
              console.error('🔴 [DateDetailPanel] onConfirmReservation이 전달되지 않음!');
              alert('onConfirmReservation 핸들러가 없습니다.');
            }
          }}
          onCancel={async (reservation, cancelData) => {
            // 예약 취소 처리 - Dashboard의 핸들러 사용
            console.log('🔴 [DateDetailPanel] 예약 취소 - onCancelReservation 호출');
            console.log('🔴 [DateDetailPanel] reservation:', reservation);
            console.log('🔴 [DateDetailPanel] cancelData:', cancelData);
            migrationDebugger.log(DEBUG_LEVELS.INFO, 'DateDetailPanel', 'Cancel reservation', { 
              reservationId: reservation.id,
              cancelData 
            });
            
            // Props로 전달받은 핸들러 사용
            if (onCancelReservation) {
              await onCancelReservation(reservation, cancelData);
              setSelectedReservation(null); // BookingModal 닫기
            } else {
              console.error('🔴 [DateDetailPanel] onCancelReservation이 전달되지 않음!');
              alert('onCancelReservation 핸들러가 없습니다.');
            }
          }}
          onUpdate={async (id, data) => {
            // 예약 수정 처리 - Dashboard의 핸들러 사용
            console.log('🔵 [DateDetailPanel] 예약 수정 - onUpdateReservation 호출');
            migrationDebugger.log(DEBUG_LEVELS.INFO, 'DateDetailPanel', 'Update reservation', { id, data });
            
            // Props로 전달받은 핸들러 사용
            if (onUpdateReservation) {
              await onUpdateReservation(id, data);
              setSelectedReservation(null); // BookingModal 닫기
            } else {
              console.error('🔴 [DateDetailPanel] onUpdateReservation이 전달되지 않음!');
              alert('onUpdateReservation 핸들러가 없습니다.');
            }
          }}
        />
      )}
    </>
  );
}

export default DateDetailPanel;
