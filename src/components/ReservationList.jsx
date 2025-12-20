// src/components/ReservationList.jsx - 마이그레이션 버전
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CancelReservationModal from './CancelReservationModal';
import migrationDebugger, { DEBUG_LEVELS } from '../utils/migrationDebugger';
import './ReservationList.css';

const ReservationList = ({ reservations, onUpdateReservation, onCancelReservation, onSelectReservation }) => {
  // 프로퍼티 확인
  console.log('🆗 [ReservationList Props]', {
    hasReservations: !!reservations,
    hasOnCancelReservation: !!onCancelReservation,
    onCancelReservationType: typeof onCancelReservation
  });

  // 디버그 시작
  migrationDebugger.startPerformance('ReservationList');
  migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'ReservationList', 'Component rendered', {
    reservationCount: reservations?.length || 0
  });

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);

  // 기간 필터
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 월별 접기/펼치기 상태 (기본: 접힘)
  const [collapsedMonths, setCollapsedMonths] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 🔄 MIGRATION: useEffect 제거, React Query로 교체
  // Before: useEffect로 window resize 감지
  // After: React Query로 선언형 처리
  const queryClient = useQueryClient();
  
  const { data: isMobile } = useQuery({
    queryKey: ['isMobile'],
    queryFn: () => window.innerWidth < 768,
    staleTime: Infinity,
    initialData: window.innerWidth < 768
  });

  // Window resize 이벤트 리스너 (선언형)
  React.useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      // React Query 캐시 업데이트
      queryClient.setQueryData(['isMobile'], newIsMobile);
      migrationDebugger.log(DEBUG_LEVELS.TRACE, 'ReservationList', 'Window resized', { 
        isMobile: newIsMobile,
        width: window.innerWidth 
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [queryClient]);

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

  const filteredReservations = useMemo(() => {
    migrationDebugger.startPerformance('ReservationList-Filter');
    
    const filtered = reservations.filter(res => {
      const matchesStatus = filterStatus === 'all' || res.status === filterStatus;
      const matchesSource = filterSource === 'all' || res.source === filterSource;
      const matchesSearch = 
        res.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.phone?.includes(searchTerm) ||
        res.roomName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 날짜 필터링
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const resDate = new Date(res.checkIn);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch(dateFilter) {
          case 'today':
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            matchesDate = resDate >= today && resDate < tomorrow;
            break;
          case 'week':
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);
            matchesDate = resDate >= today && resDate < weekEnd;
            break;
          case 'month':
            const monthEnd = new Date(today);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            matchesDate = resDate >= today && resDate < monthEnd;
            break;
          case 'custom':
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              matchesDate = resDate >= start && resDate <= end;
            }
            break;
        }
      }
      
      return matchesStatus && matchesSource && matchesSearch && matchesDate;
    });

    migrationDebugger.endPerformance('ReservationList-Filter');
    migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'ReservationList', 'Filtered reservations', {
      total: reservations.length,
      filtered: filtered.length,
      filters: { status: filterStatus, source: filterSource, search: searchTerm, date: dateFilter }
    });

    return filtered;
  }, [reservations, filterStatus, filterSource, searchTerm, dateFilter, startDate, endDate]);

  // 날짜를 Date 객체로 변환하는 헬퍼 함수
  const toDateObject = (date) => {
    if (!date) return null;
    if (date && typeof date === 'object' && date.seconds) {
      return new Date(date.seconds * 1000);
    }
    if (typeof date === 'string') {
      return new Date(date);
    }
    if (date instanceof Date) {
      return date;
    }
    return null;
  };

  // 과거 예약인지 체크 (체크아웃 날짜가 오늘 이전)
  const isPastReservation = (reservation) => {
    const checkOut = toDateObject(reservation.checkOut);
    if (!checkOut) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkOut < today;
  };

  // 월별로 그룹화된 예약
  const groupedReservations = useMemo(() => {
    const groups = {};

    filteredReservations.forEach(res => {
      const checkIn = toDateObject(res.checkIn);
      if (!checkIn) return;

      const year = checkIn.getFullYear();
      const month = checkIn.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const label = `${year}년 ${month}월`;

      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          year,
          month,
          reservations: [],
          isPast: false
        };
      }
      groups[key].reservations.push(res);
    });

    // 현재 월 체크
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 과거 월인지 표시
    Object.keys(groups).forEach(key => {
      groups[key].isPast = key < currentKey;
    });

    // 키를 기준으로 정렬 (최신순)
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map(key => groups[key]);
  }, [filteredReservations]);

  // 초기 로드 시 모든 월을 접힌 상태로 설정
  React.useEffect(() => {
    if (!isInitialized && groupedReservations.length > 0) {
      const allCollapsed = {};
      groupedReservations.forEach(group => {
        allCollapsed[group.key] = true;
      });
      setCollapsedMonths(allCollapsed);
      setIsInitialized(true);
    }
  }, [groupedReservations, isInitialized]);

  // 월별 접기/펼치기 토글
  const toggleMonth = (monthKey) => {
    setCollapsedMonths(prev => ({
      ...(prev || {}),
      [monthKey]: !(prev?.[monthKey] ?? true)
    }));
  };

  // 접힌 상태 체크 (기본값: 접힘)
  const isCollapsed = (monthKey) => {
    if (!collapsedMonths) return true;
    return collapsedMonths[monthKey] ?? true;
  };

  // 전체 접기/펼치기
  const collapseAll = () => {
    const allCollapsed = {};
    groupedReservations.forEach(group => {
      allCollapsed[group.key] = true;
    });
    setCollapsedMonths(allCollapsed);
  };

  const expandAll = () => {
    setCollapsedMonths({});
  };

  const handleCancelClick = (e, reservation) => {
    e.stopPropagation();
    setCancelTarget(reservation);
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'ReservationList', 'Cancel clicked', { 
      reservationId: reservation.id 
    });
  };

  const handleCancelConfirm = (cancelData) => {
    console.log('🎯 [ReservationList] handleCancelConfirm 호출됨');
    console.log('🎯 [ReservationList] cancelTarget:', cancelTarget);
    console.log('🎯 [ReservationList] cancelData:', cancelData);
    console.log('🎯 [ReservationList] onCancelReservation 타입:', typeof onCancelReservation);
    
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'ReservationList', 'Cancel confirmed', { 
      reservationId: cancelTarget.id,
      cancelData 
    });
    
    if (onCancelReservation) {
      console.log('🎯 [ReservationList] onCancelReservation 호출');
      onCancelReservation(cancelTarget, cancelData);
    } else {
      console.error('🎯 [ReservationList] onCancelReservation이 없음!');
    }
    
    setCancelTarget(null);
  };

  const handleStatusChange = (e, reservationId) => {
    e.stopPropagation();
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'ReservationList', 'Status change', { 
      reservationId,
      newStatus: '예약확정' 
    });
    onUpdateReservation(reservationId, { status: '예약확정' });
  };

  const formatDate = (date) => {
    if (!date) return '-';
    
    // Firebase Timestamp 객체 처리
    if (date && typeof date === 'object' && date.seconds) {
      const d = new Date(date.seconds * 1000);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }
    
    // 문자열인 경우
    if (typeof date === 'string') {
      if (date.includes('-')) {
        return date.replace(/-/g, '.');
      }
      return date;
    }
    
    // Date 객체 처리
    if (date instanceof Date) {
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    }
    
    return '-';
  };

  const getRefundStatus = (reservation) => {
    if (reservation.status !== '예약취소' || !reservation.refundAmount) return null;
    
    return (
      <div className="refund-info">
        <span className="refund-label">환불:</span>
        <span className="refund-amount">₩{reservation.refundAmount.toLocaleString()}</span>
        <span className="refund-rate">({reservation.refundRate}%)</span>
      </div>
    );
  };

  // 성능 모니터링 종료
  migrationDebugger.endPerformance('ReservationList');

  return (
    <div className="reservation-list">
      <div className="list-controls">
        <input
          type="text"
          placeholder="검색 (이름, 전화번호, 객실)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        {isMobile ? (
          // 모바일: 필터들을 하나의 컨테이너로 감싸기
          <>
            <div className="filter-container">
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="all">전체 상태</option>
                <option value="입금대기">입금대기</option>
                <option value="예약확정">예약확정</option>
                <option value="예약취소">예약취소</option>
              </select>
              <select 
                value={filterSource} 
                onChange={(e) => setFilterSource(e.target.value)}
                className="filter-select"
              >
                <option value="all">전체 출처</option>
                <option value="naver_place">네이버 플레이스</option>
                <option value="naver_booking">네이버 펜션예약</option>
                <option value="naver_map">네이버 지도</option>
                <option value="transfer">이체예약</option>
                <option value="group">단체예약</option>
                <option value="막기">관리자 막기</option>
                <option value="etc">기타</option>
              </select>
            </div>
            <div className="date-filter-container">
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  if (e.target.value !== 'custom') {
                    setStartDate('');
                    setEndDate('');
                  }
                }}
                className="filter-select date-filter"
              >
                <option value="all">전체 기간</option>
                <option value="today">오늘</option>
                <option value="week">이번 주</option>
                <option value="month">이번 달</option>
                <option value="custom">직접 설정</option>
              </select>
              {dateFilter === 'custom' && (
                <div className="custom-date-inputs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="date-input"
                    placeholder="시작일"
                  />
                  <span className="date-separator">~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="date-input"
                    placeholder="종료일"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          // 데스크톱: 기존 레이아웃 유지
          <>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">전체 상태</option>
              <option value="입금대기">입금대기</option>
              <option value="예약확정">예약확정</option>
              <option value="예약취소">예약취소</option>
            </select>
            <select 
              value={filterSource} 
              onChange={(e) => setFilterSource(e.target.value)}
              className="filter-select"
            >
              <option value="all">전체 출처</option>
              <option value="naver_place">네이버 플레이스</option>
              <option value="naver_booking">네이버 펜션예약</option>
              <option value="naver_map">네이버 지도</option>
              <option value="transfer">이체예약</option>
              <option value="group">단체예약</option>
              <option value="막기">관리자 막기</option>
              <option value="etc">기타</option>
            </select>
            {/* 데스크톱 기간 필터 */}
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                if (e.target.value !== 'custom') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              className="filter-select"
            >
              <option value="all">전체 기간</option>
              <option value="today">오늘</option>
              <option value="week">이번 주</option>
              <option value="month">이번 달</option>
              <option value="custom">직접 설정</option>
            </select>
            {dateFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                />
                <span style={{ margin: '0 0.5rem' }}>~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="date-input"
                />
              </>
            )}
          </>
        )}
      </div>

      {/* 접기/펼치기 버튼 */}
      {groupedReservations.length > 0 && (
        <div className="collapse-controls">
          <button onClick={expandAll} className="collapse-btn">
            <span className="collapse-icon">▼</span> 모두 펼치기
          </button>
          <button onClick={collapseAll} className="collapse-btn">
            <span className="collapse-icon">▲</span> 모두 접기
          </button>
          <span className="total-count">총 {filteredReservations.length}건</span>
        </div>
      )}

      {isMobile ? (
        // 모바일 카드 뷰 (월별 그룹화)
        <div className="reservation-cards">
          {groupedReservations.map(group => (
            <div key={group.key} className={`month-group ${group.isPast ? 'past-month' : ''}`}>
              {/* 월별 헤더 */}
              <div
                className="month-header"
                onClick={() => toggleMonth(group.key)}
              >
                <div className="month-header-left">
                  <span className={`collapse-arrow ${isCollapsed(group.key) ? 'collapsed' : ''}`}>▼</span>
                  <span className="month-label">{group.label}</span>
                  <span className="month-count">{group.reservations.length}건</span>
                </div>
                {group.isPast && <span className="past-badge">지난 예약</span>}
              </div>

              {/* 월별 예약 목록 */}
              {!isCollapsed(group.key) && (
                <div className="month-reservations">
                  {group.reservations.map(res => (
                    <div
                      key={res.id}
                      className={`reservation-card ${isPastReservation(res) ? 'past-reservation' : ''}`}
                      onClick={() => onSelectReservation(res)}
                    >
                      {/* 카드 헤더 */}
                      <div className="card-header">
                        <div className="card-date-room">
                          <span className="card-room">{res.roomName}</span>
                          <span className="card-check-date">
                            {formatDate(res.checkIn)} ~ {formatDate(res.checkOut)}
                          </span>
                        </div>
                        <span className={`status-badge status-${res.status}`}>
                          {res.status}
                        </span>
                      </div>

                      {/* 카드 바디 */}
                      <div className="card-body">
                        <div className="card-customer">
                          <div className="customer-info">
                            <span className="customer-name">{res.customerName}</span>
                            <span className="customer-phone">{res.phone}</span>
                          </div>
                          {res.source && BOOKING_SOURCES[res.source] && (
                            <span
                              className="source-badge-mobile"
                              style={{color: BOOKING_SOURCES[res.source].color}}
                            >
                              {BOOKING_SOURCES[res.source].icon}
                            </span>
                          )}
                        </div>

                        <div className="card-details">
                          <div className="detail-item">
                            <span className="detail-label">인원</span>
                            <span className="detail-value">{res.guests || '-'}명</span>
                          </div>
                          {res.options && res.options.length > 0 && (
                            <div className="detail-item options-item">
                              <span className="detail-label">옵션</span>
                              <span className="detail-value">
                                {res.options.map(opt => {
                                  if (typeof opt === 'string') {
                                    return opt;
                                  } else if (typeof opt === 'object' && opt.name) {
                                    return opt.name;
                                  }
                                  return '';
                                }).filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="card-price">
                          <span className="price-label">총 금액</span>
                          <span className="price-value">₩{res.totalPrice?.toLocaleString()}</span>
                        </div>

                        {getRefundStatus(res)}
                        {res.cancellationFee > 0 && (
                          <div className="cancellation-fee-mobile">
                            취소수수료: ₩{res.cancellationFee.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* 카드 푸터 (액션 버튼) */}
                      <div className="card-footer">
                        <div className="card-meta">
                          <span className="meta-label">예약일</span>
                          <span className="meta-value">{formatDate(res.createdAt)}</span>
                        </div>
                        <div className="card-actions">
                          {res.status === '입금대기' && (
                            <button
                              onClick={(e) => handleStatusChange(e, res.id)}
                              className="btn-confirm"
                            >
                              확정
                            </button>
                          )}
                          {res.status !== '예약취소' && (
                            <button
                              onClick={(e) => handleCancelClick(e, res)}
                              className="btn-cancel"
                            >
                              취소
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {groupedReservations.length === 0 && (
            <div className="empty-reservations">
              <span className="empty-icon">📄</span>
              <p className="empty-text">예약 내역이 없습니다.</p>
            </div>
          )}
        </div>
      ) : (
        // 데스크톱 테이블 뷰 (월별 그룹화)
        <div className="reservation-table-wrapper">
          {groupedReservations.map(group => (
            <div key={group.key} className={`month-group ${group.isPast ? 'past-month' : ''}`}>
              {/* 월별 헤더 */}
              <div
                className="month-header"
                onClick={() => toggleMonth(group.key)}
              >
                <div className="month-header-left">
                  <span className={`collapse-arrow ${isCollapsed(group.key) ? 'collapsed' : ''}`}>▼</span>
                  <span className="month-label">{group.label}</span>
                  <span className="month-count">{group.reservations.length}건</span>
                </div>
                {group.isPast && <span className="past-badge">지난 예약</span>}
              </div>

              {/* 월별 예약 테이블 */}
              {!isCollapsed(group.key) && (
                <div className="reservation-table">
                  <table>
                    <thead>
                      <tr>
                        <th>예약일</th>
                        <th>고객명</th>
                        <th>연락처</th>
                        <th>출처</th>
                        <th>객실</th>
                        <th>인원</th>
                        <th>체크인</th>
                        <th>체크아웃</th>
                        <th>옵션</th>
                        <th>상태</th>
                        <th>금액</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.reservations.map(res => (
                        <tr
                          key={res.id}
                          onClick={() => onSelectReservation(res)}
                          className={isPastReservation(res) ? 'past-reservation' : ''}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>{formatDate(res.createdAt)}</td>
                          <td>{res.customerName}</td>
                          <td>{res.phone}</td>
                          <td>
                            {res.source && BOOKING_SOURCES[res.source] ? (
                              <span
                                className="source-badge"
                                style={{color: BOOKING_SOURCES[res.source].color}}
                                title={BOOKING_SOURCES[res.source].name}
                              >
                                {BOOKING_SOURCES[res.source].icon}
                              </span>
                            ) : '-'}
                          </td>
                          <td>{res.roomName}</td>
                          <td>
                            <div className="guests-info">
                              <span>{res.guests || '-'}명</span>
                            </div>
                          </td>
                          <td>{formatDate(res.checkIn)}</td>
                          <td>{formatDate(res.checkOut)}</td>
                          <td>
                            <div className="options-info">
                              {res.options && res.options.length > 0 ? (
                                <span className="options-list">
                                  {res.options.map(opt => {
                                    if (typeof opt === 'string') {
                                      return opt;
                                    } else if (typeof opt === 'object' && opt.name) {
                                      return opt.name;
                                    }
                                    return '';
                                  }).filter(Boolean).join(', ')}
                                </span>
                              ) : (
                                <span>-</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="status-cell">
                              <span className={`status-badge status-${res.status}`}>
                                {res.status}
                              </span>
                              {getRefundStatus(res)}
                            </div>
                          </td>
                          <td>
                            <div className="price-cell">
                              <span className="total-price">₩{res.totalPrice?.toLocaleString()}</span>
                              {res.cancellationFee > 0 && (
                                <span className="cancellation-fee">
                                  (취소수수료: ₩{res.cancellationFee.toLocaleString()})
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              {res.status === '입금대기' && (
                                <button
                                  onClick={(e) => handleStatusChange(e, res.id)}
                                  className="btn-confirm"
                                >
                                  확정
                                </button>
                              )}
                              {res.status !== '예약취소' && (
                                <button
                                  onClick={(e) => handleCancelClick(e, res)}
                                  className="btn-cancel"
                                >
                                  취소
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {groupedReservations.length === 0 && (
            <div className="empty-reservations">
              <span className="empty-icon">📄</span>
              <p className="empty-text">예약 내역이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {cancelTarget && (
        <CancelReservationModal
          reservation={cancelTarget}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
};

export default ReservationList;
