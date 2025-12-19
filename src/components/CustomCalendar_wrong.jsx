// src/components/CustomCalendar.jsx
// 선언형 프로그래밍으로 완전히 재작성
import React, { useState, useMemo } from 'react';
import { toYYYYMMDD } from '../utils';
import useReservationStore from '../stores/useReservationStore';
import CustomerBadge from './CustomerBadge';
import './CustomCalendar.css';

const CustomCalendar = ({ 
  rooms = [], 
  bookings = [], 
  overrides = {}, 
  onDateClick = () => {},
  onBookingClick = () => {},
  selectedDate = null
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { getAvailableStock } = useReservationStore();
  
  // 모바일 감지 - 선언형으로 처리
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  }, []);
  
  // 객실별 색상 매핑
  const roomColors = {
    'Forest': 'room-forest',
    'Forest mini': 'room-forest-mini',
    'Forest 패밀리': 'room-forest-family',
    'Forest mini 패밀리': 'room-forest-mini-family',
    '호수뷰객실': 'room-lakeview',
    '단체예약': 'room-group'
  };
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayOfMonth = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  // 예약 데이터 처리
  const processedBookings = useMemo(() => {
    const bookingMap = {};
    
    bookings.forEach(res => {
      if (res.status === '예약취소' || !res.checkIn || !res.checkOut) return;
      
      let currentDate = new Date(res.checkIn);
      const endDate = new Date(res.checkOut);
      
      while (currentDate < endDate) {
        const dateStr = toYYYYMMDD(currentDate);
        const key = `${dateStr}_${res.roomName}`;
        
        if (!bookingMap[key]) bookingMap[key] = [];
        bookingMap[key].push(res);
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return bookingMap;
  }, [bookings]);

  // 월 변경 핸들러
  const changeMonth = (increment) => {
    setCurrentDate(new Date(year, month + increment, 1));
  };

  // 오늘로 이동
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 예약 클릭 핸들러
  const handleBookingClick = (e, booking, dateStr) => {
    e.stopPropagation();
    
    if (isMobile) {
      onDateClick(dateStr);
    } else {
      onBookingClick(booking);
    }
  };

  // 날짜 클릭 핸들러 - 한 곳에서만 처리
  const handleDateClick = (dateStr) => {
    // 이벤트 전파 방지
    if (onDateClick) {
      onDateClick(dateStr);
    }
  };

  // 옵션 파싱 헬퍼 함수
  const parseOptions = (options) => {
    if (!options || !Array.isArray(options)) return [];
    
    if (options.length > 0 && typeof options[0] === 'string') {
      const optionMapping = {
        'camping_burner': { name: '캠핑버너&그릴', price: 20000, onsite: false },
        'charcoal_bbq': { name: '숯불바베큐', price: 30000, onsite: true },
        'late_checkout': { name: '레이트 체크아웃', price: 0, onsite: false },
        '캠핑버너&그릴': { name: '캠핑버너&그릴', price: 20000, onsite: false },
        '숯불바베큐': { name: '숯불바베큐', price: 30000, onsite: true },
        '레이트 체크아웃': { name: '레이트 체크아웃', price: 0, onsite: false }
      };
      
      return options.map(opt => optionMapping[opt] || { name: opt, price: 0, onsite: false });
    }
    
    return options;
  };

  // 날짜 셀 렌더링 - 완전히 선언형으로
  const renderDateCell = (day) => {
    const cellDate = new Date(year, month, day);
    const dateStr = toYYYYMMDD(cellDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    cellDate.setHours(0, 0, 0, 0);
    
    const isPast = cellDate < today;
    const isToday = cellDate.getTime() === today.getTime();
    const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
    const isSelected = selectedDate === dateStr;
    
    // 전체 예약 현황 계산
    let totalAvailable = 0;
    let totalBooked = 0;
    
    rooms.forEach(room => {
      const stock = getAvailableStock(dateStr, room.객실명);
      totalAvailable += stock;
      totalBooked += (room.재고 || 0) - stock;
    });
    
    const occupancyRate = rooms.length > 0 
      ? Math.round((totalBooked / rooms.reduce((sum, r) => sum + (r.재고 || 0), 0)) * 100)
      : 0;

    // 클래스명을 선언형으로 결정
    const cellClassName = [
      'calendar-cell',
      isPast && 'past',
      isToday && 'today',
      isWeekend && 'weekend',
      isSelected && 'selected'
    ].filter(Boolean).join(' ');

    const occupancyClassName = [
      'occupancy-badge',
      occupancyRate >= 80 && 'high',
      occupancyRate >= 50 && !occupancyRate >= 80 && 'medium',
      occupancyRate > 0 && occupancyRate < 50 && 'low',
      occupancyRate === 0 && 'zero'
    ].filter(Boolean).join(' ');

    return (
      <div
        key={day}
        className={cellClassName}
        onClick={() => handleDateClick(dateStr)}
        role="gridcell"
        aria-selected={isSelected}
        data-date={dateStr}
      >
        <div className="cell-header">
          <span className="cell-day">{day}</span>
          <span className={occupancyClassName}>
            {occupancyRate}%
          </span>
        </div>
        
        <div className="cell-content">
          {rooms.map(room => {
            const key = `${dateStr}_${room.객실명}`;
            const bookingsForRoom = processedBookings[key] || [];
            const bookingCount = bookingsForRoom.length;
            const hasBooking = bookingCount > 0;
            
            return (
              <div key={room.id} className={`room-info ${hasBooking ? 'has-booking' : ''}`}>
                <div className={`room-status ${hasBooking ? 'has-booking' : 'available'}`}>
                  <span className="room-name">{room.객실명}</span>
                  <span className="booking-count-badge">{bookingCount}</span>
                </div>
                
                {/* 모바일: 예약이 있으면 간단히 표시 */}
                {isMobile && bookingsForRoom.length > 0 && (
                  <div className="mobile-booking-indicator">
                    <span className="booking-count">예약 {bookingsForRoom.length}건</span>
                  </div>
                )}
                
                {/* PC: 상세 표시 */}
                {!isMobile && bookingsForRoom.map(booking => {
                  const options = parseOptions(booking.options);
                  const extraGuestPrice = booking.extraGuestPrice || 0;
                  
                  const sourceIcons = {
                    'naver_place': '📍',
                    'naver_booking': '🏠',
                    'naver_map': '🗺️',
                    'transfer': '💸',
                    'group': '👥',
                    '막기': '🚫',
                    'etc': '📝'
                  };
                  
                  const sourceIcon = sourceIcons[booking.source] || '📝';
                  const roomColorClass = roomColors[booking.roomName] || 'room-default';
                  
                  return (
                    <div
                      key={booking.id}
                      className={`booking-detail-chip status-${booking.status} ${roomColorClass}`}
                      onClick={(e) => handleBookingClick(e, booking, dateStr)}
                    >
                      <div className="booking-main-info">
                        <span className="source-icon">{sourceIcon}</span>
                        <span className="customer-name">
                          <CustomerBadge customerName={booking.customerName} phone={booking.phone} />
                        </span>
                        {booking.status === '입금대기' && (
                          <span className="status-indicator">₩</span>
                        )}
                      </div>
                      <div className="booking-sub-info">
                        <span className="guest-count">
                          👥 {booking.guests || 2}명
                        </span>
                        <span className="total-price">
                          💰 {(booking.totalPrice || 0).toLocaleString()}
                        </span>
                        {extraGuestPrice > 0 && (
                          <span className="addon-info">
                            인원추가 +{extraGuestPrice.toLocaleString()}
                          </span>
                        )}
                        {options.map((option, idx) => {
                          if (option.price > 0) {
                            const className = option.onsite ? 'addon-info onsite' : 'addon-info';
                            const text = option.onsite 
                              ? `${option.name} 현장결제 +${option.price.toLocaleString()}`
                              : `${option.name} +${option.price.toLocaleString()}`;
                            
                            return (
                              <span key={idx} className={className}>
                                {text}
                              </span>
                            );
                          } else if (option.name === '레이트 체크아웃') {
                            return (
                              <span key={idx} className="addon-info">
                                {option.name}
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 캘린더 그리드 렌더링
  const renderCalendarGrid = () => {
    const cells = [];
    
    // 빈 셀 (이전 달)
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(
        <div key={`empty-start-${i}`} className="calendar-cell empty" role="gridcell"></div>
      );
    }
    
    // 날짜 셀
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(renderDateCell(day));
    }
    
    // 빈 셀 (다음 달)
    const totalCells = cells.length;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remainingCells; i++) {
      cells.push(
        <div key={`empty-end-${i}`} className="calendar-cell empty" role="gridcell"></div>
      );
    }
    
    return cells;
  };

  return (
    <div className="custom-calendar">
      {/* 캘린더 헤더 */}
      <div className="calendar-header">
        <button 
          onClick={() => changeMonth(-1)}
          className="month-nav-btn"
          aria-label="이전 달"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        <div className="month-display">
          <h2>{year}년 {month + 1}월</h2>
          <button onClick={goToToday} className="today-btn">오늘</button>
        </div>
        
        <button 
          onClick={() => changeMonth(1)}
          className="month-nav-btn"
          aria-label="다음 달"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="weekdays" role="row">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
          <div 
            key={day} 
            className={`weekday ${index === 0 || index === 6 ? 'weekend' : ''}`}
            role="columnheader"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="calendar-grid" role="grid">
        {renderCalendarGrid()}
      </div>

      {/* 범례 */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-color available"></span>
          <span>예약 가능</span>
        </div>
        <div className="legend-item">
          <span className="legend-color full"></span>
          <span>만실</span>
        </div>
        <div className="legend-item">
          <span className="legend-color status-입금대기"></span>
          <span>입금대기</span>
        </div>
        <div className="legend-item">
          <span className="legend-color status-예약확정"></span>
          <span>예약확정</span>
        </div>
      </div>
    </div>
  );
};

export default CustomCalendar;