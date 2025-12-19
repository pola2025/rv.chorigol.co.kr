// src/components/CustomCalendar.jsx
// 2025 리뉴얼 - 심플 & 정보 중심 디자인
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { toYYYYMMDD } from '../utils';
import { getHoliday } from '../utils/koreanHolidays';
import useReservationStore from '../stores/useReservationStore';
import './CustomCalendar.css';

// 캘린더에서 제외할 객실명
const EXCLUDED_ROOMS = ['단체-야유회', '단체-워크샵'];

const CustomCalendar = ({
  rooms = [],
  bookings = [],
  onDateClick = () => {},
  onBookingClick = () => {},
  selectedDate = null
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { getAvailableStock } = useReservationStore();

  // 드래그 스크롤 관련
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const scrollPos = useRef({ x: 0, y: 0 });

  // 마우스/터치 드래그 스크롤 핸들러
  const handleDragStart = useCallback((e) => {
    const element = scrollRef.current;
    if (!element) return;

    isDragging.current = true;
    element.style.cursor = 'grabbing';
    element.style.userSelect = 'none';

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    startPos.current = { x: clientX, y: clientY };
    scrollPos.current = { x: element.scrollLeft, y: element.scrollTop };
  }, []);

  const handleDragMove = useCallback((e) => {
    if (!isDragging.current) return;

    const element = scrollRef.current;
    if (!element) return;

    e.preventDefault();

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startPos.current.x;
    const deltaY = clientY - startPos.current.y;

    element.scrollLeft = scrollPos.current.x - deltaX;
    element.scrollTop = scrollPos.current.y - deltaY;
  }, []);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
    const element = scrollRef.current;
    if (element) {
      element.style.cursor = 'grab';
      element.style.userSelect = '';
    }
  }, []);

  // 캘린더에 표시할 객실만 필터링
  const displayRooms = useMemo(() => {
    return rooms.filter(room => !EXCLUDED_ROOMS.includes(room.객실명));
  }, [rooms]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayOfMonth = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  // 모바일에서 오늘 날짜로 자동 스크롤
  useEffect(() => {
    const isMobile = window.innerWidth <= 480;
    if (!isMobile || !scrollRef.current) return;

    // 오늘이 현재 표시된 월에 있는지 확인
    const today = new Date();
    if (today.getFullYear() !== year || today.getMonth() !== month) return;

    const todayDay = today.getDate();
    const cellWidth = 120; // 모바일 셀 너비
    const todayCellIndex = firstDayOfMonth + todayDay - 1;
    const todayCol = todayCellIndex % 7;

    // 오늘 날짜가 화면 중앙에 오도록 스크롤
    const scrollX = Math.max(0, (todayCol * cellWidth) - (window.innerWidth / 2) + (cellWidth / 2));

    // 약간의 딜레이 후 스크롤 (렌더링 완료 대기)
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          left: scrollX,
          behavior: 'smooth'
        });
      }
    }, 100);
  }, [year, month, firstDayOfMonth]);

  // 날짜별 예약 데이터 집계 (단체 객실 제외, 객실별 예약 수 포함)
  const dateBookingMap = useMemo(() => {
    const map = {};

    bookings.forEach(res => {
      if (res.status === '예약취소' || !res.checkIn || !res.checkOut) return;
      // 단체 객실 제외
      if (EXCLUDED_ROOMS.includes(res.roomName)) return;

      let currentDate = new Date(res.checkIn);
      const endDate = new Date(res.checkOut);

      while (currentDate < endDate) {
        const dateStr = toYYYYMMDD(currentDate);

        if (!map[dateStr]) {
          map[dateStr] = {
            count: 0,
            rooms: new Set(),
            roomCounts: {}, // 객실별 예약 수
            hasWaiting: false
          };
        }

        map[dateStr].count++;
        map[dateStr].rooms.add(res.roomName);
        // 객실별 예약 수 증가
        map[dateStr].roomCounts[res.roomName] = (map[dateStr].roomCounts[res.roomName] || 0) + 1;

        if (res.status === '입금대기') {
          map[dateStr].hasWaiting = true;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    return map;
  }, [bookings]);

  // 총 재고 계산 (표시 객실 기준)
  const totalStock = useMemo(() => {
    return displayRooms.reduce((sum, room) => sum + (room.재고 || 1), 0);
  }, [displayRooms]);

  // 월 변경
  const changeMonth = (increment) => {
    setCurrentDate(new Date(year, month + increment, 1));
  };

  // 오늘로 이동
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 날짜 셀 렌더링
  const renderDateCell = (day) => {
    const cellDate = new Date(year, month, day);
    const dateStr = toYYYYMMDD(cellDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    cellDate.setHours(0, 0, 0, 0);

    const isPast = cellDate < today;
    const isToday = cellDate.getTime() === today.getTime();
    const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
    const isSunday = cellDate.getDay() === 0;
    const isSaturday = cellDate.getDay() === 6;
    const isSelected = selectedDate === dateStr;

    // 공휴일 확인
    const holiday = getHoliday(dateStr);
    const isHoliday = !!holiday;
    const isSubstitute = holiday?.type === 'substitute';

    // 예약 정보
    const bookingInfo = dateBookingMap[dateStr] || { count: 0, rooms: new Set(), hasWaiting: false };
    const bookingCount = bookingInfo.count;
    const occupiedRooms = bookingInfo.rooms.size;
    const isFull = occupiedRooms >= displayRooms.length && displayRooms.length > 0;
    const hasBooking = bookingCount > 0;

    // 점유율 계산
    const occupancyPercent = totalStock > 0 ? Math.round((bookingCount / totalStock) * 100) : 0;

    // 상태 클래스 결정
    let statusClass = '';
    if (isFull) {
      statusClass = 'full';
    } else if (occupancyPercent >= 60) {
      statusClass = 'busy';
    } else if (hasBooking) {
      statusClass = 'has-booking';
    }

    return (
      <div
        key={day}
        className={`calendar-cell
          ${isPast ? 'past' : ''}
          ${isToday ? 'today' : ''}
          ${isSunday ? 'sunday' : ''}
          ${isSaturday ? 'saturday' : ''}
          ${isHoliday ? 'holiday' : ''}
          ${isSubstitute ? 'substitute' : ''}
          ${isSelected ? 'selected' : ''}
          ${statusClass}
        `}
        onClick={() => onDateClick(dateStr)}
        aria-selected={isSelected}
        role="gridcell"
        tabIndex={0}
        title={holiday?.name || ''}
      >
        <span className="cell-day">{day}</span>

        {/* 공휴일 이름 표시 */}
        {isHoliday && (
          <span className="holiday-name">{holiday.name}</span>
        )}

        {/* 객실 상태 리스트 - 예약 있는 날만 표시 */}
        {!isPast && displayRooms.length > 0 && hasBooking && (
          <div className="room-status-list">
            {displayRooms.map((room, idx) => {
              const displayName = room.객실명.replace('패밀리', 'F');
              const roomStock = room.재고 || 1;
              const roomBooked = bookingInfo.roomCounts?.[room.객실명] || 0;
              return (
                <div key={room.id || idx} className="room-status-item">
                  <span className="room-name">{displayName}</span>
                  <div className="room-gauge-bar">
                    {Array.from({ length: roomStock }).map((_, i) => (
                      <span
                        key={i}
                        className={`gauge-cell ${i < roomBooked ? 'booked' : 'available'}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // 캘린더 그리드 렌더링
  const renderCalendarGrid = () => {
    const cells = [];

    // 빈 셀 (이전 달)
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(
        <div key={`empty-start-${i}`} className="calendar-cell empty" aria-hidden="true" />
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
        <div key={`empty-end-${i}`} className="calendar-cell empty" aria-hidden="true" />
      );
    }

    return cells;
  };

  return (
    <div className="simple-calendar">
      {/* 헤더 */}
      <div className="calendar-header">
        <button
          onClick={() => changeMonth(-1)}
          className="nav-btn"
          aria-label="이전 달"
        >
          ‹
        </button>

        <div className="month-title">
          <h2>{year}년 {month + 1}월</h2>
          <button onClick={goToToday} className="today-btn">오늘</button>
        </div>

        <button
          onClick={() => changeMonth(1)}
          className="nav-btn"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      {/* 스크롤 가능한 캘린더 영역 - 드래그로 이동 */}
      <div
        className="calendar-scroll-wrapper"
        ref={scrollRef}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* 요일 헤더 */}
        <div className="weekdays" role="row">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div
              key={day}
              className={`weekday ${index === 0 ? 'sunday' : ''} ${index === 6 ? 'saturday' : ''}`}
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
      </div>

    </div>
  );
};

export default CustomCalendar;
