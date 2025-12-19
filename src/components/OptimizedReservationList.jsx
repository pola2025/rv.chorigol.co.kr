/**
 * Optimized Reservation List Component
 * 성능 최적화된 예약 목록 컴포넌트
 */

import React, { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { VirtualList } from './VirtualList';
import { LazyImage } from './LazyImage';
import { withPerformance, measureApiCall } from './PerformanceMonitor';
import { useDerivedState, useDerivedCollection, cacheManager } from '../application/hooks/useReactiveState';
import { OptimizedReservationService } from '../application/services/OptimizedReservationService';
import { QueryCache } from '../infrastructure/cache/LRUCache';
import StatisticsCard from './statistics/StatisticsCard';
import './OptimizedReservationList.css';

// 레이지 로드 컴포넌트
const BookingModal = lazy(() => import('./BookingModal'));

// 서비스 인스턴스
const cache = new QueryCache(50, 5 * 60 * 1000);
const reservationService = new OptimizedReservationService(null, cache);

/**
 * 최적화된 예약 리스트 컴포넌트
 */
const OptimizedReservationListComponent = ({ 
  reservations = [],
  rooms = [],
  onReservationUpdate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRoom, setFilterRoom] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statsPeriod, setStatsPeriod] = useState('today'); // 통계 기간 선택
  const pageSize = 50;

  // 필터링 및 정렬 (선언형, useEffect 없음)
  const processedReservations = useDerivedCollection(
    reservations,
    [
      // 검색 필터
      {
        type: 'filter',
        predicate: useCallback((reservation) => {
          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          return (
            reservation.guestName?.toLowerCase().includes(query) ||
            reservation.phone?.includes(query) ||
            reservation.memo?.toLowerCase().includes(query)
          );
        }, [searchQuery])
      },
      // 상태 필터
      {
        type: 'filter',
        predicate: useCallback((reservation) => {
          if (filterStatus === 'all') return true;
          return reservation.status === filterStatus;
        }, [filterStatus])
      },
      // 객실 필터
      {
        type: 'filter',
        predicate: useCallback((reservation) => {
          if (filterRoom === 'all') return true;
          return reservation.room === filterRoom;
        }, [filterRoom])
      },
      // 정렬
      {
        type: 'sort',
        compareFn: useCallback((a, b) => {
          let aVal, bVal;
          
          switch (sortBy) {
            case 'checkIn':
              aVal = new Date(a.checkIn);
              bVal = new Date(b.checkIn);
              break;
            case 'guestName':
              aVal = a.guestName || '';
              bVal = b.guestName || '';
              break;
            case 'totalPrice':
              aVal = a.totalPrice || 0;
              bVal = b.totalPrice || 0;
              break;
            default:
              aVal = new Date(a.createdAt);
              bVal = new Date(b.createdAt);
          }

          if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
          }
          return aVal < bVal ? 1 : -1;
        }, [sortBy, sortOrder])
      }
    ]
  );

  // 페이지네이션 데이터 (선언형)
  const paginatedData = useDerivedState(
    [processedReservations, currentPage, pageSize],
    () => {
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      return {
        items: processedReservations.slice(start, end),
        totalItems: processedReservations.length,
        totalPages: Math.ceil(processedReservations.length / pageSize),
        currentPage,
        pageSize
      };
    },
    `pagination:${currentPage}:${pageSize}:${processedReservations.length}`
  );

  // 통계 (선언형) - 기간별 데이터 집계
  const statistics = useDerivedState(
    [processedReservations],
    () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // 이번 주 범위 계산
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // 일요일부터
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      
      // 이번 달 범위
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const stats = {
        total: processedReservations.length,
        byStatus: {},
        byRoom: {},
        totalRevenue: 0,
        todayCheckIn: 0,
        todayCheckOut: 0,
        todayNew: 0,
        todayRevenue: 0,
        weekCheckIn: 0,
        weekCheckOut: 0,
        weekNew: 0,
        weekRevenue: 0,
        monthCheckIn: 0,
        monthCheckOut: 0,
        monthNew: 0,
        monthRevenue: 0
      };

      processedReservations.forEach(reservation => {
        // 상태별 집계
        stats.byStatus[reservation.status] = (stats.byStatus[reservation.status] || 0) + 1;
        
        // 객실별 집계
        stats.byRoom[reservation.room] = (stats.byRoom[reservation.room] || 0) + 1;
        
        // 매출 집계
        if (reservation.status === '예약확정') {
          stats.totalRevenue += reservation.totalPrice || 0;
        }

        // 날짜 기준 집계
        const checkInDate = new Date(reservation.checkIn);
        const checkOutDate = new Date(reservation.checkOut);
        const createdDate = new Date(reservation.createdAt);

        // 오늘 집계
        if (checkInDate >= today && checkInDate < tomorrow) {
          stats.todayCheckIn++;
          if (reservation.status === '예약확정') {
            stats.todayRevenue += reservation.totalPrice || 0;
          }
        }
        if (checkOutDate >= today && checkOutDate < tomorrow) {
          stats.todayCheckOut++;
        }
        if (createdDate >= today && createdDate < tomorrow) {
          stats.todayNew++;
        }
        
        // 이번 주 집계
        if (checkInDate >= weekStart && checkInDate < weekEnd) {
          stats.weekCheckIn++;
          if (reservation.status === '예약확정') {
            stats.weekRevenue += reservation.totalPrice || 0;
          }
        }
        if (checkOutDate >= weekStart && checkOutDate < weekEnd) {
          stats.weekCheckOut++;
        }
        if (createdDate >= weekStart && createdDate < weekEnd) {
          stats.weekNew++;
        }
        
        // 이번 달 집계
        if (checkInDate >= monthStart && checkInDate <= monthEnd) {
          stats.monthCheckIn++;
          if (reservation.status === '예약확정') {
            stats.monthRevenue += reservation.totalPrice || 0;
          }
        }
        if (checkOutDate >= monthStart && checkOutDate <= monthEnd) {
          stats.monthCheckOut++;
        }
        if (createdDate >= monthStart && createdDate <= monthEnd) {
          stats.monthNew++;
        }
      });

      return stats;
    },
    `statistics:${processedReservations.length}`
  );

  // 검색 디바운싱
  const handleSearch = useCallback((value) => {
    // 디바운싱 로직은 별도 훅으로 분리 가능
    setSearchQuery(value);
    // 검색 결과 캐시 무효화
    cacheManager.invalidate('search:');
  }, []);

  // 필터 변경 핸들러
  const handleFilterChange = useCallback((filterType, value) => {
    switch (filterType) {
      case 'status':
        setFilterStatus(value);
        break;
      case 'room':
        setFilterRoom(value);
        break;
      default:
        break;
    }
    setCurrentPage(1); // 필터 변경 시 첫 페이지로
  }, []);

  // 정렬 변경 핸들러
  const handleSortChange = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  }, [sortBy]);

  // 날짜 포맷팅 헬퍼
  const formatDate = useCallback((dateStr) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}/${day}(${weekDay})`;
  }, []);

  // 숙박일수 계산
  const getNights = useCallback((checkIn, checkOut) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return nights;
  }, []);

  // 예약 아이템 렌더러
  const renderReservationItem = useCallback((reservation, index) => {
    const nights = getNights(reservation.checkIn, reservation.checkOut);
    const isMobile = window.innerWidth <= 768;
    
    // 모바일 카드 디자인 - 기존 배포 버전과 동일하게
    if (isMobile) {
      return (
        <div 
          key={reservation.id}
          className="reservation-card-mobile"
          onClick={() => setSelectedReservation(reservation)}
        >
          {/* 카드 헤더 */}
          <div className="card-header">
            <div className="card-date-room">
              <span className="card-room">{reservation.room}</span>
              <span className="card-check-date">
                {formatDate(reservation.checkIn)} ~ {formatDate(reservation.checkOut)}
              </span>
            </div>
            <span className={`status-badge status-${reservation.status}`}>
              {reservation.status}
            </span>
          </div>

          {/* 카드 바디 */}
          <div className="card-body">
            <div className="card-customer">
              <div className="customer-info">
                <span className="customer-name">{reservation.guestName}</span>
                <span className="customer-phone">{reservation.phone}</span>
              </div>
            </div>

            <div className="card-details">
              <div className="detail-item">
                <span className="detail-label">인원</span>
                <span className="detail-value">{reservation.guests || '-'}명</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">숙박</span>
                <span className="detail-value">{nights}박</span>
              </div>
            </div>

            <div className="card-price">
              <span className="price-label">총 금액</span>
              <span className="price-value">₩{reservation.totalPrice?.toLocaleString()}</span>
            </div>

            {reservation.memo && (
              <div className="card-memo">
                <span className="memo-label">메모</span>
                <span className="memo-text">{reservation.memo}</span>
              </div>
            )}
          </div>

          {/* 카드 푸터 */}
          <div className="card-footer">
            <div className="card-meta">
              <span className="meta-label">예약일</span>
              <span className="meta-value">{formatDate(reservation.createdAt)}</span>
            </div>
            <div className="card-actions">
              {reservation.status === '입금대기' && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    // 상태 업데이트 로직
                  }}
                  className="btn-confirm"
                >
                  확정
                </button>
              )}
              {reservation.status !== '예약취소' && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    // 취소 로직
                  }}
                  className="btn-cancel"
                >
                  취소
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    // 데스크톱 기존 디자인
    return (
      <div 
        key={reservation.id}
        className="reservation-item"
        onClick={() => setSelectedReservation(reservation)}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedReservation(reservation);
          }
        }}
      >
        <div className="reservation-item-main">
          <div className="reservation-item-header">
            <span className="guest-name">{reservation.guestName}</span>
            <span className={`status-badge status-${reservation.status}`}>
              {reservation.status}
            </span>
          </div>
          <div className="reservation-item-info">
            <span className="room">{reservation.room}</span>
            <span className="dates">
              {formatDate(reservation.checkIn)} ~ {formatDate(reservation.checkOut)}
              <span style={{ 
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginLeft: '0.25rem'
              }}>
                ({nights}박)
              </span>
            </span>
            <span className="price">
              {reservation.totalPrice?.toLocaleString()}원
            </span>
          </div>
        </div>
      </div>
    );
  }, [formatDate, getNights]);

  return (
    <div className="optimized-reservation-list">
      {/* 헤더 및 필터 */}
      <div className="list-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="고객명, 전화번호, 메모 검색..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filters">
          <select 
            value={filterStatus}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="filter-select"
          >
            <option value="all">모든 상태</option>
            <option value="예약확정">예약확정</option>
            <option value="입금대기">입금대기</option>
            <option value="예약취소">예약취소</option>
          </select>
          
          <select
            value={filterRoom}
            onChange={(e) => handleFilterChange('room', e.target.value)}
            className="filter-select"
          >
            <option value="all">모든 객실</option>
            {rooms.map(room => (
              <option key={room.id} value={room.name}>{room.name}</option>
            ))}
          </select>
        </div>

        <div className="sort-controls">
          <button
            className={`sort-btn ${sortBy === 'createdAt' ? 'active' : ''}`}
            onClick={() => handleSortChange('createdAt')}
            aria-label="예약일순 정렬"
          >
            <span className="sort-btn-text">예약일</span>
            {sortBy === 'createdAt' && (
              <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
          <button
            className={`sort-btn ${sortBy === 'checkIn' ? 'active' : ''}`}
            onClick={() => handleSortChange('checkIn')}
            aria-label="체크인순 정렬"
          >
            <span className="sort-btn-text">체크인</span>
            {sortBy === 'checkIn' && (
              <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
          <button
            className={`sort-btn ${sortBy === 'totalPrice' ? 'active' : ''}`}
            onClick={() => handleSortChange('totalPrice')}
            aria-label="금액순 정렬"
          >
            <span className="sort-btn-text">금액</span>
            {sortBy === 'totalPrice' && (
              <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
          <button
            className={`sort-btn ${sortBy === 'guestName' ? 'active' : ''}`}
            onClick={() => handleSortChange('guestName')}
            aria-label="고객명순 정렬"
          >
            <span className="sort-btn-text">고객명</span>
            {sortBy === 'guestName' && (
              <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        </div>
      </div>

      {/* 통계 카드 - 기간 선택 가능 */}
      <div className="statistics-section">
        <div className="statistics-controls">
          <button 
            className={`period-btn ${statsPeriod === 'today' ? 'active' : ''}`}
            onClick={() => setStatsPeriod('today')}
          >
            오늘
          </button>
          <button 
            className={`period-btn ${statsPeriod === 'week' ? 'active' : ''}`}
            onClick={() => setStatsPeriod('week')}
          >
            이번주
          </button>
          <button 
            className={`period-btn ${statsPeriod === 'month' ? 'active' : ''}`}
            onClick={() => setStatsPeriod('month')}
          >
            이번달
          </button>
        </div>
        <StatisticsCard
          date={new Date()}
          stats={[
            { 
              label: '체크인', 
              value: statsPeriod === 'today' ? statistics.todayCheckIn : 
                     statsPeriod === 'week' ? statistics.weekCheckIn : 
                     statistics.monthCheckIn, 
              type: 'check-in' 
            },
            { 
              label: '체크아웃', 
              value: statsPeriod === 'today' ? statistics.todayCheckOut : 
                     statsPeriod === 'week' ? statistics.weekCheckOut : 
                     statistics.monthCheckOut, 
              type: 'check-out' 
            },
            { 
              label: '신규', 
              value: statsPeriod === 'today' ? statistics.todayNew : 
                     statsPeriod === 'week' ? statistics.weekNew : 
                     statistics.monthNew, 
              type: 'new' 
            },
            { 
              label: '매출', 
              value: statsPeriod === 'today' ? statistics.todayRevenue : 
                     statsPeriod === 'week' ? statistics.weekRevenue : 
                     statistics.monthRevenue, 
              unit: '원', 
              type: 'revenue' 
            }
          ]}
          period={statsPeriod}
        />
      </div>

      {/* 가상화 리스트 - 데스크톱에서만 사용 */}
      <div className="list-container">
        {paginatedData.items.length > 0 ? (
          window.innerWidth > 768 ? (
            <VirtualList
              items={paginatedData.items}
              itemHeight={56}  /* 높이를 80px에서 56px로 축소 */
              containerHeight={600}
              renderItem={renderReservationItem}
              overscan={5}
              getItemKey={(item) => item.id}
              className="reservation-virtual-list"
            />
          ) : (
            <div className="reservation-cards-mobile">
              {paginatedData.items.map((item) => renderReservationItem(item))}
            </div>
          )
        ) : (
          <div className="empty-state">
            <p>검색 결과가 없습니다.</p>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {paginatedData.totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="page-btn"
          >
            이전
          </button>
          
          <span className="page-info">
            {currentPage} / {paginatedData.totalPages}
          </span>
          
          <button
            disabled={currentPage === paginatedData.totalPages}
            onClick={() => setCurrentPage(prev => Math.min(paginatedData.totalPages, prev + 1))}
            className="page-btn"
          >
            다음
          </button>
        </div>
      )}

      {/* 예약 상세 모달 (레이지 로드) */}
      {selectedReservation && (
        <Suspense fallback={<div className="modal-loading">로딩중...</div>}>
          <BookingModal
            booking={selectedReservation}
            onClose={() => setSelectedReservation(null)}
            onUpdate={(updated) => {
              onReservationUpdate(updated);
              setSelectedReservation(null);
              // 캐시 무효화
              cacheManager.invalidate('reservations:');
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

// 성능 모니터링 HOC 적용
export const OptimizedReservationList = withPerformance(
  OptimizedReservationListComponent,
  'OptimizedReservationList'
);
