/**
 * 예약 캘린더 컴포넌트
 * FullCalendar를 사용한 드래그&드롭 예약 관리
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useReservations } from '../hooks/useReservations';
import { useRooms } from '../hooks/useRooms';
import { globalErrorHandler, useErrorHandler } from '../core/ErrorSystem';
import './ReservationCalendar.css';

// 객실 타입별 색상 매핑
const ROOM_COLORS = {
  'A동': '#4CAF50',  // 초록
  'B동': '#2196F3',  // 파랑
  'C동': '#FF9800',  // 주황
  'D동': '#9C27B0',  // 보라
  'E동': '#F44336',  // 빨강
  'F동': '#00BCD4',  // 청록
  'G동': '#795548',  // 갈색
  'H동': '#607D8B',  // 회색
  'default': '#9E9E9E'
};

// 예약 상태별 스타일
const STATUS_STYLES = {
  '입금대기': {
    opacity: 0.6,
    pattern: 'striped'
  },
  '예약확정': {
    opacity: 1,
    pattern: 'solid'
  },
  '예약취소': {
    opacity: 0.3,
    pattern: 'crossed'
  }
};

const ReservationCalendar = () => {
  const { reservations, updateReservation, isLoading: reservationsLoading } = useReservations();
  const { rooms, isLoading: roomsLoading } = useRooms();
  const { error, executeAsync, clearError } = useErrorHandler();
  
  const [selectedFilters, setSelectedFilters] = useState({
    rooms: [],
    status: ['예약확정', '입금대기'],
    dateRange: null
  });
  
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 예약 데이터를 캘린더 이벤트로 변환
  const calendarEvents = useMemo(() => {
    if (!reservations || !rooms) return [];
    
    return reservations
      .filter(reservation => {
        // 필터링 로직
        if (selectedFilters.status.length > 0 && 
            !selectedFilters.status.includes(reservation.status)) {
          return false;
        }
        
        if (selectedFilters.rooms.length > 0 && 
            !selectedFilters.rooms.includes(reservation.roomId)) {
          return false;
        }
        
        return true;
      })
      .map(reservation => {
        const room = rooms.find(r => r.id === reservation.roomId);
        const roomType = room?.name?.split(' ')[0] || 'default';
        const color = ROOM_COLORS[roomType] || ROOM_COLORS.default;
        const statusStyle = STATUS_STYLES[reservation.status];
        
        return {
          id: reservation.id,
          title: `${reservation.customerName} - ${room?.name || reservation.roomId}`,
          start: reservation.checkIn,
          end: reservation.checkOut,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          extendedProps: {
            reservation,
            room,
            customerPhone: reservation.phone,
            status: reservation.status,
            totalPrice: reservation.totalPrice,
            options: reservation.options || [],
            notes: reservation.notes
          },
          className: `reservation-status-${reservation.status.replace(/\s/g, '-')}`,
          display: 'block',
          editable: reservation.status !== '예약취소', // 취소된 예약은 드래그 불가
          opacity: statusStyle?.opacity || 1
        };
      });
  }, [reservations, rooms, selectedFilters]);

  // 드래그&드롭 이벤트 처리
  const handleEventDrop = useCallback(async (info) => {
    const { event, oldEvent, revert } = info;
    
    // 드래그 시작
    setIsDragging(true);
    
    try {
      // 비즈니스 로직 검증
      const newCheckIn = event.start;
      const newCheckOut = event.end || event.start;
      const reservation = event.extendedProps.reservation;
      
      // 과거 날짜로 이동 방지
      if (newCheckIn < new Date()) {
        alert('과거 날짜로는 예약을 이동할 수 없습니다.');
        revert();
        return;
      }
      
      // 중복 예약 체크
      const isConflict = reservations.some(r => 
        r.id !== reservation.id &&
        r.roomId === reservation.roomId &&
        r.status !== '예약취소' &&
        ((newCheckIn >= r.checkIn && newCheckIn < r.checkOut) ||
         (newCheckOut > r.checkIn && newCheckOut <= r.checkOut))
      );
      
      if (isConflict) {
        alert('해당 날짜에 이미 예약이 있습니다.');
        revert();
        return;
      }
      
      // 사용자 확인
      const confirmMessage = `${reservation.customerName}님의 예약을\n` +
        `${formatDate(oldEvent.start)} → ${formatDate(newCheckIn)}로 변경하시겠습니까?`;
      
      if (!confirm(confirmMessage)) {
        revert();
        return;
      }
      
      // 업데이트 실행
      await executeAsync(
        async () => {
          await updateReservation(reservation.id, {
            checkIn: newCheckIn,
            checkOut: newCheckOut
          });
        },
        {
          retry: true,
          circuitBreakerId: 'reservation-update'
        }
      );
      
      // 성공 알림
      showNotification('예약이 성공적으로 변경되었습니다.', 'success');
      
    } catch (error) {
      console.error('예약 변경 실패:', error);
      revert();
      showNotification('예약 변경에 실패했습니다.', 'error');
    } finally {
      setIsDragging(false);
    }
  }, [reservations, updateReservation, executeAsync]);

  // 이벤트 리사이즈 처리 (체크아웃 날짜 변경)
  const handleEventResize = useCallback(async (info) => {
    const { event, revert } = info;
    
    try {
      const reservation = event.extendedProps.reservation;
      const newCheckOut = event.end;
      
      // 최소 1박 체크
      const nights = Math.ceil((newCheckOut - event.start) / (1000 * 60 * 60 * 24));
      if (nights < 1) {
        alert('최소 1박 이상이어야 합니다.');
        revert();
        return;
      }
      
      // 사용자 확인
      if (!confirm(`체크아웃을 ${formatDate(newCheckOut)}로 변경하시겠습니까?`)) {
        revert();
        return;
      }
      
      // 업데이트 실행
      await executeAsync(
        async () => {
          await updateReservation(reservation.id, {
            checkOut: newCheckOut
          });
        },
        {
          retry: true,
          circuitBreakerId: 'reservation-resize'
        }
      );
      
      showNotification('체크아웃 날짜가 변경되었습니다.', 'success');
      
    } catch (error) {
      console.error('체크아웃 변경 실패:', error);
      revert();
      showNotification('체크아웃 변경에 실패했습니다.', 'error');
    }
  }, [updateReservation, executeAsync]);

  // 이벤트 클릭 처리 (상세 정보 표시)
  const handleEventClick = useCallback((info) => {
    setSelectedEvent(info.event);
    setIsDetailModalOpen(true);
  }, []);

  // 날짜 클릭 처리 (새 예약 생성)
  const handleDateClick = useCallback((info) => {
    // 새 예약 모달 열기
    console.log('새 예약 생성:', info.dateStr);
    // TODO: 새 예약 모달 구현
  }, []);

  // 날짜 포맷팅
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  // 알림 표시
  const showNotification = (message, type = 'info') => {
    // TODO: 토스트 알림 구현
    console.log(`[${type}] ${message}`);
  };

  // 필터 변경 처리
  const handleFilterChange = (filterType, value) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // 로딩 상태
  if (reservationsLoading || roomsLoading) {
    return (
      <div className="reservation-calendar-loading">
        <div className="spinner"></div>
        <p>캘린더를 불러오는 중...</p>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="reservation-calendar-error">
        <h3>⚠️ 오류가 발생했습니다</h3>
        <p>{error.userMessage || error.message}</p>
        <button onClick={clearError}>다시 시도</button>
      </div>
    );
  }

  return (
    <div className="reservation-calendar-container">
      {/* 필터 섹션 */}
      <div className="calendar-filters">
        <div className="filter-group">
          <label>객실 필터</label>
          <select 
            multiple 
            value={selectedFilters.rooms}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, option => option.value);
              handleFilterChange('rooms', selected);
            }}
          >
            {rooms?.map(room => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>상태 필터</label>
          <div className="status-checkboxes">
            {['입금대기', '예약확정', '예약취소'].map(status => (
              <label key={status}>
                <input
                  type="checkbox"
                  checked={selectedFilters.status.includes(status)}
                  onChange={(e) => {
                    const newStatus = e.target.checked
                      ? [...selectedFilters.status, status]
                      : selectedFilters.status.filter(s => s !== status);
                    handleFilterChange('status', newStatus);
                  }}
                />
                {status}
              </label>
            ))}
          </div>
        </div>
        
        <div className="filter-actions">
          <button 
            onClick={() => setSelectedFilters({
              rooms: [],
              status: ['예약확정', '입금대기'],
              dateRange: null
            })}
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 캘린더 */}
      <div className={`calendar-wrapper ${isDragging ? 'dragging' : ''}`}>
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          locale="ko"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,listWeek'
          }}
          events={calendarEvents}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          eventResizableFromStart={true}
          dayMaxEvents={3}
          moreLinkClick="popover"
          eventDisplay="block"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false
          }}
          businessHours={{
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            startTime: '00:00',
            endTime: '24:00'
          }}
          height="auto"
          eventDidMount={(info) => {
            // 툴팁 추가
            const status = info.event.extendedProps.status;
            const price = info.event.extendedProps.totalPrice;
            
            info.el.setAttribute('data-tooltip', 
              `상태: ${status}\n금액: ${price?.toLocaleString()}원`
            );
            
            // 상태별 스타일 적용
            if (status === '입금대기') {
              info.el.style.opacity = '0.7';
              info.el.classList.add('pending-payment');
            } else if (status === '예약취소') {
              info.el.style.opacity = '0.3';
              info.el.classList.add('cancelled');
            }
          }}
        />
      </div>

      {/* 예약 상세 모달 */}
      {isDetailModalOpen && selectedEvent && (
        <ReservationDetailModal
          event={selectedEvent}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedEvent(null);
          }}
          onUpdate={async (updates) => {
            await updateReservation(selectedEvent.id, updates);
            setIsDetailModalOpen(false);
          }}
        />
      )}

      {/* 범례 */}
      <div className="calendar-legend">
        <h4>객실 색상</h4>
        <div className="legend-items">
          {Object.entries(ROOM_COLORS).filter(([key]) => key !== 'default').map(([room, color]) => (
            <div key={room} className="legend-item">
              <span 
                className="legend-color" 
                style={{ backgroundColor: color }}
              ></span>
              <span>{room}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 예약 상세 모달 컴포넌트
const ReservationDetailModal = ({ event, onClose, onUpdate }) => {
  const reservation = event.extendedProps.reservation;
  const room = event.extendedProps.room;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>예약 상세 정보</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="detail-section">
            <h4>고객 정보</h4>
            <p><strong>이름:</strong> {reservation.customerName}</p>
            <p><strong>연락처:</strong> {reservation.phone}</p>
            <p><strong>상태:</strong> 
              <span className={`status-badge status-${reservation.status}`}>
                {reservation.status}
              </span>
            </p>
          </div>
          
          <div className="detail-section">
            <h4>예약 정보</h4>
            <p><strong>객실:</strong> {room?.name}</p>
            <p><strong>체크인:</strong> {new Date(reservation.checkIn).toLocaleDateString('ko-KR')}</p>
            <p><strong>체크아웃:</strong> {new Date(reservation.checkOut).toLocaleDateString('ko-KR')}</p>
            <p><strong>금액:</strong> {reservation.totalPrice?.toLocaleString()}원</p>
          </div>
          
          {reservation.options && reservation.options.length > 0 && (
            <div className="detail-section">
              <h4>추가 옵션</h4>
              <ul>
                {reservation.options.map((option, idx) => (
                  <li key={idx}>{option}</li>
                ))}
              </ul>
            </div>
          )}
          
          {reservation.notes && (
            <div className="detail-section">
              <h4>메모</h4>
              <p>{reservation.notes}</p>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={() => onUpdate({ status: '예약확정' })}>
            예약 확정
          </button>
          <button onClick={() => onUpdate({ status: '예약취소' })} className="cancel-btn">
            예약 취소
          </button>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
};

export default ReservationCalendar;