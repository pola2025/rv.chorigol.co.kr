// src/components/MobileCalendarEnhanced.jsx
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { toYYYYMMDD, formatPhoneNumber } from '../utils';
import { useReservations } from '../hooks/useReservations';
import { renderOptionsAsText, calculateOptionPrice, normalizeOptions } from '../utils/optionHelpers';
import { useDerivedState, useDerivedCollection } from '../application/hooks/useReactiveState';
import { withPerformance } from './PerformanceMonitor';
import { VirtualList } from './VirtualList';
import './MobileCalendarEnhanced.css';
import './MobileCalendar.css'; // 주간/월간 뷰 스타일도 사용

const VIEW_MODES = {
  LIST: 'list',
  WEEK: 'week',
  MONTH: 'month'
};

const MobileCalendarEnhanced = ({ 
  rooms = [], 
  bookings = [], 
  overrides = {}, 
  onDateClick,
  onBookingClick,
  getAvailableStock
}) => {
  // 전체 예약 데이터를 가져와서 고객별 예약 횟수 계산
  const { data: allReservations = [] } = useReservations();
  
  // 고객별 예약 횟수 계산
  const customerBookingCounts = useMemo(() => {
    const counts = {};
    allReservations.forEach(res => {
      // 취소된 예약과 막기 예약은 제외
      if (res.status === '예약취소' || res.source === '막기') {
        return;
      }
      
      if (res.customerName) {
        const key = res.phone ? `${res.customerName}_${res.phone}` : res.customerName;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [allReservations]);
  // 항상 오늘 날짜로 초기화
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 시간 정보 초기화
  
  const [viewMode, setViewMode] = useState(VIEW_MODES.WEEK); // 기본을 주간 뷰로 변경
  const [currentDate, setCurrentDate] = useState(today);
  const [currentWeek, setCurrentWeek] = useState(today);
  
  // 오늘 날짜가 주의 어디에 위치하는지 계산하여 초기 인덱스 설정
  const dayOfWeek = today.getDay();
  const initialIndex = dayOfWeek <= 3 ? 0 : 3; // 일~수 또는 목~토 중 오늘이 포함된 부분 표시
  const [weekStartIndex, setWeekStartIndex] = useState(initialIndex);
  
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

  // 옵션 정보 파싱
  const parseOptions = (options) => {
    if (!options || !Array.isArray(options)) return [];
    
    try {
      if (options.length > 0) {
        // 첫 번째 요소로 타입 체크
        const firstOption = options[0];
        
        // 문자열 배열인 경우
        if (typeof firstOption === 'string') {
          const optionMapping = {
            'camping_burner': { name: '캠핑버너', price: 20000 },
            'charcoal_bbq': { name: '숯불BBQ', price: 30000 },
            'late_checkout': { name: '늦은체크아웃', price: 0 },
            '캠핑버너&그릴': { name: '캠핑버너', price: 20000 },
            '숯불바베큐': { name: '숯불BBQ', price: 30000 },
            '레이트 체크아웃': { name: '늦은체크아웃', price: 0 }
          };
          
          return options.map(opt => {
            const mapped = optionMapping[opt];
            if (mapped) return mapped;
            // 매핑되지 않은 문자열은 이름만 있는 객체로 변환
            return { name: opt, price: 0 };
          });
        }
        // 이미 객체 배열인 경우 - 유효성 검증
        else if (typeof firstOption === 'object' && firstOption !== null) {
          return options.map(opt => {
            // 객체가 아니거나 null인 경우 빈 객체 반환
            if (!opt || typeof opt !== 'object') {
              return { name: '', price: 0 };
            }
            // name 속성이 없는 경우 빈 문자열로 설정
            return {
              name: opt.name || '',
              price: opt.price || 0
            };
          });
        }
      }
    } catch (error) {
      console.error('옵션 파싱 에러:', error, options);
    }
    
    return [];
  };

  // 예약출처 정보
  const BOOKING_SOURCES = {
    'naver_place': { name: 'N플', icon: '📍', color: '#03C75A', bg: '#ecfdf5' },
    'naver_booking': { name: 'N예약', icon: '🏠', color: '#03C75A', bg: '#ecfdf5' },
    'naver_map': { name: 'N지도', icon: '🗺️', color: '#6b7280', bg: '#f3f4f6' },
    'transfer': { name: '이체', icon: '💸', color: '#d97706', bg: '#fef3c7' },
    'group': { name: '단체', icon: '👥', color: '#7c3aed', bg: '#f3e8ff' },
    '막기': { name: '막기', icon: '🚫', color: '#DC2626', bg: '#fee2e2' },
    'etc': { name: '기타', icon: '📝', color: '#6B7280', bg: '#f9fafb' }
  };

  // 컴팩트한 리스트 뷰 렌더링 - 항상 펼쳐진 상태
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

    const today = toYYYYMMDD(new Date());
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    return (
      <div className="mobile-list-view-enhanced">
        {dates.map(date => {
          const dateStr = toYYYYMMDD(date);
          const dayBookings = bookingsByDate[dateStr] || [];
          const hasBookings = dayBookings.length > 0;
          const isToday = dateStr === today;
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          if (!hasBookings && viewMode === VIEW_MODES.LIST) return null;
          
          // 날짜별 통계 계산
          const stats = {
            total: dayBookings.length,
            confirmed: dayBookings.filter(b => b.status === '예약확정').length,
            pending: dayBookings.filter(b => b.status === '입금대기').length,
            blocked: dayBookings.filter(b => b.source === '막기').length
          };
          
          return (
            <div 
              key={dateStr} 
              className={`date-section-enhanced ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
            >
              {/* 날짜 헤더 - 항상 고정 */}
              <div className="date-header-enhanced" onClick={() => handleDateClick(dateStr)}>
                <div className="date-info">
                  <span className="date-day">{date.getDate()}</span>
                  <span className={`date-weekday ${dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : ''}`}>
                    {dayNames[dayOfWeek]}
                  </span>
                </div>
                <div className="date-stats">
                  {stats.confirmed > 0 && (
                    <span className="stat-chip confirmed">확정 {stats.confirmed}</span>
                  )}
                  {stats.pending > 0 && (
                    <span className="stat-chip pending">대기 {stats.pending}</span>
                  )}
                  {stats.blocked > 0 && (
                    <span className="stat-chip blocked">막기 {stats.blocked}</span>
                  )}
                  <span className="total-count">{stats.total}건</span>
                </div>
              </div>
              
              {/* 예약 리스트 - 객실별 정렬 추가 */}
              <div className="bookings-container">
                {dayBookings
                  .sort((a, b) => {
                    // 객실명으로 정렬
                    const roomOrder = ['Forest', 'Forest mini', 'Forest 패밀리', 'Forest mini 패밀리', '호수뷰객실'];
                    const aIndex = roomOrder.indexOf(a.roomName);
                    const bIndex = roomOrder.indexOf(b.roomName);
                    
                    if (aIndex !== -1 && bIndex !== -1) {
                      return aIndex - bIndex;
                    } else if (aIndex !== -1) {
                      return -1;
                    } else if (bIndex !== -1) {
                      return 1;
                    }
                    
                    // 기본 정렬 (알파벳 순)
                    return a.roomName.localeCompare(b.roomName);
                  })
                  .map(booking => {
                  const options = parseOptions(booking.options);
                  const source = BOOKING_SOURCES[booking.source] || { icon: '📝', color: '#6B7280' };
                  const totalPrice = booking.totalPrice || 0;
                  
                  // 고객별 예약 횟수 가져오기
                  const customerKey = booking.phone ? `${booking.customerName}_${booking.phone}` : booking.customerName;
                  const bookingCount = customerBookingCounts[customerKey] || 1;
                  
                  if (booking.source === '막기') {
                    // 막기 예약은 간단하게 표시
                    return (
                      <div 
                        key={booking.id}
                        className="booking-item-flat blocked"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookingClick(booking);
                        }}
                      >
                        <div className="booking-row">
                          <div className="left-info">
                            <div className="room-info">
                              <span className="room-badge blocked">{booking.roomName}</span>
                              <div className="customer-name-line">
                                <span className="customer-name">관리자 막기</span>
                              </div>
                            </div>
                          </div>
                          <div className="right-info">
                            <span className="blocked-label">🚫 닫힘</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // 금액 계산
                  const basePrice = booking.basePrice || booking.roomPrice || 0;
                  const extraGuestPrice = booking.extraGuestPrice || 0;
                  const optionPrice = options.reduce((sum, opt) => sum + (opt.price || 0), 0);
                  const depositAmount = booking.depositAmount || 0;
                  const remainingAmount = booking.remainingAmount || 0;
                  
                  return (
                    <div 
                      key={booking.id}
                      className="booking-item-flat"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(booking);
                      }}
                    >
                      {/* 첫째 줄: 객실, 출처, 금액 */}
                      <div className="booking-row main">
                        <div className="left-info">
                          <div className="room-info">
                            <span className={`room-badge ${booking.status}`}>
                              {booking.roomName}
                            </span>
                            <div className="customer-name-line">
                              <span className="customer-name">
                                {booking.customerName || '예약자'}
                              </span>
                              {bookingCount >= 1 && (
                                <span className={`booking-count-badge ${bookingCount >= 5 ? 'vip' : bookingCount >= 3 ? 'regular' : 'new'}`}>
                                  {bookingCount}회
                                </span>
                              )}
                            </div>
                            {booking.phone && (
                              <span className="phone">{formatPhoneNumber(booking.phone)}</span>
                            )}
                          </div>
                          <span className="source-badge" style={{background: source.bg, color: source.color}}>
                            <span className="source-icon">{source.icon}</span>
                            <span className="source-text">{source.name}</span>
                          </span>
                        </div>
                        <div className="right-info">
                          <div className="price-info">
                            <span className="total-price">
                              {totalPrice.toLocaleString()}
                            </span>
                            {booking.status === '입금대기' && remainingAmount > 0 && (
                              <span className="remaining-price">
                                현장 {remainingAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <span className={`status-dot ${booking.status}`}>●</span>
                        </div>
                      </div>
                      
                      {/* 둘째 줄: 인원, 옵션, 입금자, 메모 등 추가 정보 */}
                      {(booking.guests || options.length > 0 || booking.depositorName || booking.memo || extraGuestPrice > 0 || optionPrice > 0) && (
                        <div className="booking-row sub">
                          <div className="sub-info-items">
                            {/* 인원 및 추가인원 금액 */}
                            <span className="sub-info-item">
                              <span className="sub-icon">👥</span>
                              {booking.guests || 2}명
                              {booking.guestDetails && (
                                <span className="detail-text">
                                  ({booking.guestDetails.adults || 0}
                                  {booking.guestDetails.children ? `/${booking.guestDetails.children}` : ''}
                                  {booking.guestDetails.infants ? `/${booking.guestDetails.infants}` : ''})
                                </span>
                              )}
                              {extraGuestPrice > 0 && (
                                <span className="price-tag">+{extraGuestPrice.toLocaleString()}</span>
                              )}
                            </span>
                            
                            {/* 옵션 및 옵션 꺈액 */}
                            {options && options.length > 0 && (() => {
                              const optionText = options.map(opt => {
                                if (typeof opt === 'object' && opt !== null && opt.name) {
                                  return String(opt.name);
                                } else if (typeof opt === 'string') {
                                  return opt;
                                } else {
                                  console.error('잘못된 옵션 형식:', opt);
                                  return '';
                                }
                              }).filter(Boolean).join(', ');
                              
                              return optionText ? (
                                <span className="sub-info-item">
                                  <span className="sub-icon">✨</span>
                                  {optionText}
                                  {optionPrice > 0 && (
                                    <span className="price-tag">+{optionPrice.toLocaleString()}</span>
                                  )}
                                </span>
                              ) : null;
                            })()}
                            
                            {/* 입금자명 */}
                            {booking.depositorName && booking.depositorName !== booking.customerName && (
                              <span className="sub-info-item">
                                <span className="sub-icon">💳</span>
                                {booking.depositorName}
                              </span>
                            )}
                            
                            {/* 메모 */}
                            {booking.memo && (
                              <span className="sub-info-item memo">
                                <span className="sub-icon">📝</span>
                                {booking.memo.length > 30 ? booking.memo.substring(0, 30) + '...' : booking.memo}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
                              booking.customerName || '예약자'
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
        <div className="month-grid" style={{ gridAutoRows: 'auto', overflow: 'visible' }}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="month-week" style={{ height: 'auto', minHeight: '100px' }}>
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
                
                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`month-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasBookings ? 'has-bookings' : ''} ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''}`}
                    style={{ height: 'auto', maxHeight: 'none', minHeight: '100px', overflow: 'visible' }}
                    onClick={() => handleDateClick(dateStr)}
                  >
                    <div className="month-day-number">{date.getDate()}</div>
                    {isCurrentMonth && (
                      <>
                        <div className="month-day-content" style={{ overflow: 'visible', maxHeight: 'none' }}>
                          {(() => {
                            // 모든 예약이 막기인지 확인
                            const blockedBookings = dayBookings.filter(b => b.source === '막기');
                            const isFullyBlocked = blockedBookings.length > 0 && blockedBookings.length === dayBookings.length;
                            
                            if (isFullyBlocked) {
                              // 전체 막기일 경우 한 줄로 표시
                              return (
                                <div className="booking-item blocked">
                                  <div className="room-name">관리자</div>
                                  <div className="guest-info">닫기</div>
                                </div>
                              );
                            } else {
                              // 일반 예약 표시
                              return dayBookings.map((booking, idx) => (
                                <div 
                                  key={booking.id} 
                                  className={`booking-item ${booking.source === '막기' ? 'blocked' : roomColors[booking.roomName] || 'type-1'}`}
                                >
                                  <div className="room-name">
                                    {booking.roomName === 'Forest 패밀리' ? 'F.패' : 
                                     booking.roomName === 'Forest mini 패밀리' ? 'Fm.패' : 
                                     booking.roomName === 'Forest mini' ? 'F.mini' : 
                                     booking.roomName === '호수뷰객실' ? '호수뷰' : 
                                     booking.roomName === '단체예약' ? '단체' : 
                                     booking.roomName === 'Forest' ? 'Forest' :
                                     booking.roomName.substring(0, 4)}
                                  </div>
                                  <div className="guest-info">
                                    {booking.source === '막기' ? 
                                      '🔒' : 
                                      `${booking.customerName && booking.customerName.length > 3 ? booking.customerName.substring(0, 3) : (booking.customerName || '예약')}`
                                    }
                                  </div>
                                </div>
                              ));
                            }
                          })()}
                        </div>
                        {occupancyRate > 0 && (
                          <div className={`occupancy-rate ${occupancyRate >= 80 ? 'high' : occupancyRate >= 50 ? 'medium' : 'low'}`}>
                            {occupancyRate}%
                          </div>
                        )}
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
    onDateClick(dateStr);
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
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        handleHeaderNavigation(1);
      } else {
        handleHeaderNavigation(-1);
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="mobile-calendar-enhanced">
      {/* 헤더 */}
      <div className="mobile-calendar-header">
        <button onClick={() => handleHeaderNavigation(-1)}>‹</button>
        <h2>{getHeaderText()}</h2>
        <button onClick={() => handleHeaderNavigation(1)}>›</button>
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

export default MobileCalendarEnhanced;
