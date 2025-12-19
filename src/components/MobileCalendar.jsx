// src/components/MobileCalendar.jsx
import React, { useState, useMemo, useRef } from 'react';
import { toYYYYMMDD } from '../utils';
import './MobileCalendar.css';

const VIEW_MODES = {
  LIST: 'list',
  WEEK: 'week',
  MONTH: 'month'
};

const MobileCalendar = ({ 
  rooms = [], 
  bookings = [], 
  overrides = {}, 
  onDateClick,
  onBookingClick,
  getAvailableStock
}) => {
  const [viewMode, setViewMode] = useState(VIEW_MODES.LIST);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weekStartIndex, setWeekStartIndex] = useState(0); // 주간 뷰 4일 시작 인덱스
  
  // 스와이프 처리를 위한 ref
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // 날짜별 예약 그룹핑
  const bookingsByDate = useMemo(() => {
    const grouped = {};
    bookings.forEach(booking => {
      if (booking.status === '예약취소') return;
      
      let current = new Date(booking.checkIn);
      const end = new Date(booking.checkOut);
      
      while (current < end) {
        const dateStr = toYYYYMMDD(current);
        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(booking);
        current.setDate(current.getDate() + 1);
      }
    });
    return grouped;
  }, [bookings]);

  // 리스트 뷰 렌더링 - 개선된 버전
  const renderListView = () => {
    const dates = [];
    const startDate = new Date(currentDate);
    startDate.setDate(1);
    
    for (let i = 0; i < 31; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      if (date.getMonth() !== currentDate.getMonth()) break;
      dates.push(date);
    }

    // 옵션 정보 파싱
    const parseOptions = (options) => {
      if (!options || !Array.isArray(options)) return [];
      
      // 옵션이 문자열 배열인 경우
      if (options.length > 0 && typeof options[0] === 'string') {
        const optionMapping = {
          'camping_burner': { name: '캠핑버너&그릴', price: 20000 },
          'charcoal_bbq': { name: '숯불바베큐', price: 30000 },
          'late_checkout': { name: '레이트 체크아웃', price: 0 },
          '캠핑버너&그릴': { name: '캠핑버너&그릴', price: 20000 },
          '숯불바베큐': { name: '숯불바베큐', price: 30000 },
          '레이트 체크아웃': { name: '레이트 체크아웃', price: 0 }
        };
        
        return options.map(opt => optionMapping[opt] || { name: opt, price: 0 });
      }
      
      // 옵션이 객체 배열인 경우
      return options;
    };

    // 예약출처 정보
    const BOOKING_SOURCES = {
      'naver_place': { name: 'N플', icon: '📍', color: '#03C75A' },
      'naver_booking': { name: 'N펜션', icon: '🏠', color: '#03C75A' },
      'naver_map': { name: 'N지도', icon: '🗺️', color: '#9CA3AF' },
      'transfer': { name: '이체', icon: '💸', color: '#F59E0B' },
      'group': { name: '단체', icon: '👥', color: '#8B5CF6' },
      '막기': { name: '막기', icon: '🚫', color: '#DC2626' },
      'etc': { name: '기타', icon: '📝', color: '#6B7280' }
    };

    return (
      <div className="mobile-list-view">
        {dates.map(date => {
          const dateStr = toYYYYMMDD(date);
          const dayBookings = bookingsByDate[dateStr] || [];
          const hasBookings = dayBookings.length > 0;
          
          if (!hasBookings && viewMode === VIEW_MODES.LIST) return null;
          
          return (
            <div 
              key={dateStr} 
              className="date-section"
              onClick={() => handleDateClick(dateStr)}
            >
              <div className="date-header">
                <span className="date-text">
                  {date.getMonth() + 1}월 {date.getDate()}일 ({['일','월','화','수','목','금','토'][date.getDay()]})
                </span>
                <span className="booking-count">
                  {dayBookings.length}건
                </span>
              </div>
              
              {dayBookings.map(booking => {
                const options = parseOptions(booking.options);
                const optionPrice = options.reduce((sum, opt) => sum + (opt.price || 0), 0);
                const basePrice = booking.basePrice || booking.roomPrice || 0;
                const extraGuestPrice = booking.extraGuestPrice || 0;
                const totalPrice = booking.totalPrice || 0;
                const source = BOOKING_SOURCES[booking.source] || { icon: '📝', color: '#6B7280' };
                
                return (
                  <div 
                    key={booking.id}
                    className="booking-card enhanced"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBookingClick(booking);
                    }}
                  >
                    {/* 헤더 섹션 */}
                    <div className="booking-card-header">
                      <div className="room-info">
                        <span className="room-name">🏠 {booking.roomName}</span>
                        <span 
                          className="source-badge" 
                          style={{color: source.color}}
                        >
                          {source.icon}
                        </span>
                      </div>
                      <span className={`status-badge ${booking.status} ${booking.source === '막기' ? 'blocked' : ''}`}>
                        {booking.source === '막기' ? '막기' : booking.status}
                      </span>
                    </div>
                    
                    {/* 고객 정보 */}
                    {booking.source !== '막기' && (
                      <div className="booking-card-customer">
                        <div className="customer-main">
                          <span className="customer-name">
                            👤 {booking.customerName}
                          </span>
                          <span className="customer-phone">
                            📞 {booking.phone}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* 상세 정보 */}
                    {booking.source !== '막기' && (
                      <div className="booking-card-details">
                        {/* 인원 정보 */}
                        <div className="detail-row">
                          <span className="detail-label">인원</span>
                          <span className="detail-value">
                            {booking.guests || 2}명
                            {booking.guestDetails && (
                              <span className="guest-breakdown">
                                {booking.guestDetails.adults && ` (성인 ${booking.guestDetails.adults}`}
                                {booking.guestDetails.children && `, 아동 ${booking.guestDetails.children}`}
                                {booking.guestDetails.infants && `, 유아 ${booking.guestDetails.infants}`}
                                {booking.guestDetails && ')'}
                              </span>
                            )}
                          </span>
                        </div>
                        
                        {/* 옵션 정보 */}
                        {options.length > 0 && (
                          <div className="detail-row">
                            <span className="detail-label">옵션</span>
                            <span className="detail-value">
                              {options.map((opt, idx) => (
                                <span key={idx} className="option-item">
                                  {opt.name}
                                  {opt.price > 0 && ` (+${opt.price.toLocaleString()}원)`}
                                  {idx < options.length - 1 && ', '}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                        
                        {/* 결제 정보 */}
                        <div className="detail-row payment">
                          <span className="detail-label">결제</span>
                          <div className="payment-details">
                            <div className="payment-breakdown">
                              {basePrice > 0 && (
                                <span className="payment-item">
                                  객실: {basePrice.toLocaleString()}원
                                </span>
                              )}
                              {extraGuestPrice > 0 && (
                                <span className="payment-item">
                                  추가인원: +{extraGuestPrice.toLocaleString()}원
                                </span>
                              )}
                              {optionPrice > 0 && (
                                <span className="payment-item">
                                  옵션: +{optionPrice.toLocaleString()}원
                                </span>
                              )}
                            </div>
                            <div className="payment-total">
                              <strong>총액: {totalPrice.toLocaleString()}원</strong>
                            </div>
                          </div>
                        </div>
                        
                        {/* 입금자명 */}
                        {booking.depositorName && booking.depositorName !== booking.customerName && (
                          <div className="detail-row">
                            <span className="detail-label">입금자</span>
                            <span className="detail-value">{booking.depositorName}</span>
                          </div>
                        )}
                        
                        {/* 메모 */}
                        {booking.memo && (
                          <div className="detail-row memo">
                            <span className="detail-label">메모</span>
                            <span className="detail-value">{booking.memo}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // 주간 뷰 렌더링 - 4일씩 표시
  const renderWeekView = () => {
    const daysToShow = 4; // 한 번에 보여줄 날짜 수
    
    // 현재 주의 모든 날짜 가져오기
    const startOfWeek = new Date(currentWeek);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      weekDays.push(date);
    }
    
    // 현재 보여줄 4일
    const visibleDays = weekDays.slice(weekStartIndex, weekStartIndex + daysToShow);
    
    // 네비게이션 핸들러
    const navigateDays = (direction) => {
      if (direction === 'prev' && weekStartIndex > 0) {
        setWeekStartIndex(Math.max(0, weekStartIndex - daysToShow));
      } else if (direction === 'next' && weekStartIndex < 3) {
        setWeekStartIndex(Math.min(3, weekStartIndex + daysToShow));
      } else if (direction === 'prev' && weekStartIndex === 0) {
        // 이전 주로 이동
        const newWeek = new Date(currentWeek);
        newWeek.setDate(newWeek.getDate() - 7);
        setCurrentWeek(newWeek);
        setWeekStartIndex(3); // 목~일 표시
        if (newWeek.getMonth() !== currentDate.getMonth()) {
          setCurrentDate(newWeek);
        }
      } else if (direction === 'next' && weekStartIndex === 3) {
        // 다음 주로 이동
        const newWeek = new Date(currentWeek);
        newWeek.setDate(newWeek.getDate() + 7);
        setCurrentWeek(newWeek);
        setWeekStartIndex(0); // 일~수 표시
        if (newWeek.getMonth() !== currentDate.getMonth()) {
          setCurrentDate(newWeek);
        }
      }
    };

    // 객실별 색상 매핑
    const roomColors = {
      'Forest': 'type-1',
      'Forest mini': 'type-2',
      'Forest 패밀리': 'type-3',
      'Forest mini 패밀리': 'type-4',
      '호수뷰객실': 'type-5',
      '단체예약': 'type-6'
    };

    return (
      <div className="mobile-week-view">
        <div className="week-navigation">
          <button 
            onClick={() => navigateDays('prev')} 
            className="week-nav-btn"
            disabled={false}
          >
            ‹
          </button>
          <span className="week-info">
            {visibleDays[0].getMonth() + 1}월 {visibleDays[0].getDate()}일 - {visibleDays[visibleDays.length - 1].getDate()}일
          </span>
          <button 
            onClick={() => navigateDays('next')} 
            className="week-nav-btn"
            disabled={false}
          >
            ›
          </button>
        </div>
        
        <div className="week-calendar-container">
          {visibleDays.map(date => {
            const dateStr = toYYYYMMDD(date);
            const dayBookings = bookingsByDate[dateStr] || [];
            const isToday = toYYYYMMDD(new Date()) === dateStr;
            const dayIndex = date.getDay();
            const isSunday = dayIndex === 0;
            const isSaturday = dayIndex === 6;
            
            // 객실별 예약 상태 계산
            const roomStatus = rooms.map(room => {
              const available = getAvailableStock(dateStr, room.객실명);
              return {
                name: room.객실명,
                total: room.재고,
                available,
                booked: room.재고 - available,
                bookings: dayBookings.filter(b => b.roomName === room.객실명)
              };
            });
            
            const totalAvailable = roomStatus.reduce((sum, r) => sum + r.available, 0);
            const totalCapacity = roomStatus.reduce((sum, r) => sum + r.total, 0);
            const occupancyRate = totalCapacity > 0 ? Math.round(((totalCapacity - totalAvailable) / totalCapacity) * 100) : 0;
            
            return (
              <div 
                key={dateStr}
                className={`week-day-column ${isToday ? 'today' : ''} ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''}`}
              >
                <div className="week-day-header">
                  <div className={`day-label ${isSunday ? 'sunday' : isSaturday ? 'saturday' : ''}`}>
                    {['일','월','화','수','목','금','토'][dayIndex]}
                  </div>
                  <div className="day-date">{date.getDate()}</div>
                  <div className={`day-occupancy ${occupancyRate >= 80 ? 'high' : occupancyRate >= 50 ? 'medium' : occupancyRate > 0 ? 'low' : 'zero'}`}>
                    {occupancyRate}%
                  </div>
                </div>
                
                <div className="week-day-content">
                  {dayBookings.length === 0 ? (
                    <div className="no-bookings">
                      <span>예약 없음</span>
                      <button 
                        className="add-btn"
                        onClick={() => handleDateClick(dateStr)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <div className="bookings-list">
                      {dayBookings.map(booking => (
                        <div 
                          key={booking.id}
                          className={`week-booking-item ${booking.source === '막기' ? 'blocked' : roomColors[booking.roomName] || 'type-1'}`}
                          onClick={() => onBookingClick(booking)}
                        >
                          <div className="booking-room-name">
                            {booking.roomName === 'Forest 패밀리' ? 'F.패밀리' : 
                             booking.roomName === 'Forest mini 패밀리' ? 'F.m.패밀리' : 
                             booking.roomName === 'Forest mini' ? 'F.mini' : 
                             booking.roomName === '호수뷰객실' ? '호수뷰' : 
                             booking.roomName === '단체예약' ? '단체' : 
                             booking.roomName}
                          </div>
                          <div className="booking-guest">
                            {booking.source === '막기' ? 
                              '🔒 닫힘' : 
                              booking.customerName
                            }
                          </div>
                          {booking.source !== '막기' && (
                            <div className="booking-info">
                              <span className="guest-count">{booking.guests || booking.인원 || 2}명</span>
                              <span className={`status-icon ${booking.status}`}>
                                {booking.status === '예약확정' ? '✓' : '₩'}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {roomStatus.some(r => r.available > 0) && (
                        <button 
                          className="add-more-btn"
                          onClick={() => handleDateClick(dateStr)}
                        >
                          + 추가
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 월간 뷰 렌더링
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const weeks = [];
    let days = [];
    
    // 이전 달 날짜들
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // 현재 달 날짜들
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
      
      if (days.length === 7) {
        weeks.push(days);
        days = [];
      }
    }
    
    // 다음 달 날짜들
    if (days.length > 0) {
      const remainingDays = 7 - days.length;
      for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, isCurrentMonth: false });
      }
      weeks.push(days);
    }
    
    // 객실별 색상 매핑
    const roomColors = {
      'Forest': 'type-1',
      'Forest mini': 'type-2',
      'Forest 패밀리': 'type-3',
      'Forest mini 패밀리': 'type-4',
      '호수뷰객실': 'type-5',
      '단체예약': 'type-6'
    };
    
    return (
      <div className="mobile-month-view">
        {/* 요일 헤더 */}
        <div className="month-weekdays">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div key={day} className={`month-weekday ${index === 0 ? 'sunday' : index === 6 ? 'saturday' : ''}`}>
              {day}
            </div>
          ))}
        </div>
        
        {/* 날짜 그리드 */}
        <div className="month-grid">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="month-week">
              {week.map(({ date, isCurrentMonth }, dayIndex) => {
                const dateStr = toYYYYMMDD(date);
                const dayBookings = bookingsByDate[dateStr] || [];
                const isToday = toYYYYMMDD(new Date()) === dateStr;
                const hasBookings = dayBookings.length > 0;
                const isSunday = dayIndex === 0;
                const isSaturday = dayIndex === 6;
                
                // 객실별 예약 상태 계산
                const roomStatus = rooms.map(room => {
                  const available = getAvailableStock(dateStr, room.객실명);
                  return {
                    name: room.객실명,
                    total: room.재고,
                    available,
                    booked: room.재고 - available
                  };
                });
                
                const totalAvailable = roomStatus.reduce((sum, r) => sum + r.available, 0);
                const totalCapacity = roomStatus.reduce((sum, r) => sum + r.total, 0);
                const occupancyRate = totalCapacity > 0 ? Math.round(((totalCapacity - totalAvailable) / totalCapacity) * 100) : 0;
                
                // 최대 2개의 예약만 표시
                const displayBookings = dayBookings.slice(0, 2);
                const remainingCount = dayBookings.length - 2;
                
                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`month-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasBookings ? 'has-bookings' : ''} ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''}`}
                    onClick={() => handleDateClick(dateStr)}
                  >
                    <div className="month-day-number">{date.getDate()}</div>
                    {isCurrentMonth && (
                      <>
                        <div className="month-day-content">
                          {displayBookings.map((booking, idx) => (
                            <div 
                              key={booking.id} 
                              className={`booking-item ${booking.source === '막기' ? 'blocked' : roomColors[booking.roomName] || 'type-1'}`}
                            >
                              <div className="room-name">
                                {booking.roomName === 'Forest 패밀리' ? 'F.패밀리' : 
                                 booking.roomName === 'Forest mini 패밀리' ? 'F.m.패밀리' : 
                                 booking.roomName === 'Forest mini' ? 'F.mini' : 
                                 booking.roomName === '호수뷰객실' ? '호수뷰' : 
                                 booking.roomName === '단체예약' ? '단체' : 
                                 booking.roomName}
                              </div>
                              <div className="guest-info">
                                {booking.source === '막기' ? 
                                  '🔒 닫힘' : 
                                  `${booking.customerName.length > 4 ? booking.customerName.substring(0, 3) + '..' : booking.customerName} | ${booking.guests || booking.인원 || 2}명`
                                }
                              </div>
                            </div>
                          ))}
                          {remainingCount > 0 && (
                            <div className="more-bookings">+{remainingCount}건</div>
                          )}
                        </div>
                        <div className={`occupancy-rate ${occupancyRate >= 80 ? 'high' : occupancyRate >= 50 ? 'medium' : occupancyRate > 0 ? 'low' : 'zero'}`}>
                          {occupancyRate}%
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        
        {/* 객실 범례 */}
        <div className="room-legend">
          <div className="legend-item">
            <div className="legend-color type-1"></div>
            <span>Forest</span>
          </div>
          <div className="legend-item">
            <div className="legend-color type-2"></div>
            <span>F.mini</span>
          </div>
          <div className="legend-item">
            <div className="legend-color type-3"></div>
            <span>F.패밀리</span>
          </div>
          <div className="legend-item">
            <div className="legend-color type-4"></div>
            <span>F.m.패밀리</span>
          </div>
          <div className="legend-item">
            <div className="legend-color type-5"></div>
            <span>호수뷰</span>
          </div>
          <div className="legend-item">
            <div className="legend-color type-6"></div>
            <span>단체</span>
          </div>
        </div>
      </div>
    );
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (dateStr) => {
    // 바로 onDateClick 호출하여 DateDetailPanel을 열도록 함
    onDateClick(dateStr);
  };

  // 바텀시트 렌더링
  const renderBottomSheet = () => {
    if (!showBottomSheet || !selectedDate) return null;
    
    const dayBookings = bookingsByDate[selectedDate] || [];
    const date = new Date(selectedDate);
    
    // 객실별 가용 재고 계산
    const roomStats = rooms.map(room => ({
      ...room,
      available: getAvailableStock(selectedDate, room.객실명),
      bookings: dayBookings.filter(b => b.roomName === room.객실명)
    }));

    return (
      <div className="bottom-sheet-overlay" onClick={() => setShowBottomSheet(false)}>
        <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
          <div className="bottom-sheet-handle" />
          
          <div className="bottom-sheet-header">
            <h3>{date.getMonth() + 1}월 {date.getDate()}일 ({['일','월','화','수','목','금','토'][date.getDay()]})</h3>
            <button 
              className="close-btn"
              onClick={() => setShowBottomSheet(false)}
            >
              ✕
            </button>
          </div>

          <div className="quick-stats">
            <div className="stat">
              <span className="stat-icon">🏠</span>
              <span className="stat-label">전체</span>
              <span className="stat-value">
                {dayBookings.length}/{rooms.reduce((sum, r) => sum + (r.재고 || 0), 0)}
              </span>
            </div>
            <div className="stat">
              <span className="stat-icon">✅</span>
              <span className="stat-label">확정</span>
              <span className="stat-value">
                {dayBookings.filter(b => b.status === '예약확정').length}건
              </span>
            </div>
            <div className="stat">
              <span className="stat-icon">💰</span>
              <span className="stat-label">대기</span>
              <span className="stat-value">
                {dayBookings.filter(b => b.status === '입금대기').length}건
              </span>
            </div>
          </div>

          <div className="room-list">
            {roomStats.map(room => (
              <div key={room.id} className="room-item">
                <div className="room-header">
                  <span className="room-name">{room.객실명}</span>
                  <span className={`room-availability ${room.available > 0 ? 'available' : 'full'}`}>
                    {room.available}/{room.재고}
                  </span>
                </div>
                {room.bookings.map(booking => (
                  <div 
                    key={booking.id}
                    className="room-booking"
                    onClick={() => {
                      setShowBottomSheet(false);
                      onBookingClick(booking);
                    }}
                  >
                    <span>{booking.customerName}</span>
                    <span className={`status-chip ${booking.status}`}>
                      {booking.status}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button 
            className="add-booking-btn"
            onClick={() => {
              setShowBottomSheet(false);
              onDateClick(selectedDate);
            }}
          >
            + 예약 추가
          </button>
        </div>
      </div>
    );
  };

  // 헤더 텍스트 생성
  const getHeaderText = () => {
    if (viewMode === VIEW_MODES.WEEK) {
      const startOfWeek = new Date(currentWeek);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - day);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startOfWeek.getFullYear()}년 ${startOfWeek.getMonth() + 1}월`;
      } else if (startOfWeek.getFullYear() === endOfWeek.getFullYear()) {
        return `${startOfWeek.getFullYear()}년 ${startOfWeek.getMonth() + 1}-${endOfWeek.getMonth() + 1}월`;
      } else {
        return `${startOfWeek.getFullYear()}.${startOfWeek.getMonth() + 1} - ${endOfWeek.getFullYear()}.${endOfWeek.getMonth() + 1}`;
      }
    }
    return `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;
  };

  // 헤더 네비게이션 핸들러
  const handleHeaderNavigation = (direction) => {
    if (viewMode === VIEW_MODES.WEEK) {
      const newWeek = new Date(currentWeek);
      newWeek.setDate(newWeek.getDate() + (direction * 7));
      setCurrentWeek(newWeek);
      setCurrentDate(newWeek);
    } else {
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction);
      setCurrentDate(newDate);
      setCurrentWeek(newDate);
    }
  };
  
  // 스와이프 핸들러
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  
  const handleTouchEnd = (e) => {
    if (!touchStartX.current || !touchStartY.current) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;
    
    // 수평 스와이프가 수직보다 크고, 최소 50px 이상 이동했을 때
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // 왼쪽으로 스와이프 (다음으로)
        handleHeaderNavigation(1);
      } else {
        // 오른쪽으로 스와이프 (이전으로)
        handleHeaderNavigation(-1);
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="mobile-calendar">
      {/* 헤더 */}
      <div className="mobile-calendar-header">
        <button onClick={() => handleHeaderNavigation(-1)}>
          ‹
        </button>
        <h2>{getHeaderText()}</h2>
        <button onClick={() => handleHeaderNavigation(1)}>
          ›
        </button>
      </div>

      {/* 뷰 모드 선택 */}
      <div className="view-mode-selector">
        <button 
          className={viewMode === VIEW_MODES.LIST ? 'active' : ''}
          onClick={() => setViewMode(VIEW_MODES.LIST)}
        >
          리스트
        </button>
        <button 
          className={viewMode === VIEW_MODES.WEEK ? 'active' : ''}
          onClick={() => {
            setViewMode(VIEW_MODES.WEEK);
            // 현재 날짜가 속한 주로 설정
            setCurrentWeek(currentDate);
          }}
        >
          주간
        </button>
        <button 
          className={viewMode === VIEW_MODES.MONTH ? 'active' : ''}
          onClick={() => setViewMode(VIEW_MODES.MONTH)}
        >
          월간
        </button>
      </div>

      {/* 컨텐츠 */}
      <div 
        className="mobile-calendar-content"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {viewMode === VIEW_MODES.LIST && renderListView()}
        {viewMode === VIEW_MODES.WEEK && renderWeekView()}
        {viewMode === VIEW_MODES.MONTH && renderMonthView()}
      </div>
    </div>
  );
};

export default MobileCalendar;
