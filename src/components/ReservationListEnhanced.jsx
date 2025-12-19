// src/components/ReservationListEnhanced.jsx
import React, { useState, useCallback, Suspense, lazy } from 'react';
import { VirtualList } from './VirtualList';
import { useDerivedState, useDerivedCollection, cacheManager } from '../application/hooks/useReactiveState';
// import { withPerformance } from './PerformanceMonitor';
import CancelReservationModal from './CancelReservationModal';
import CustomerBadge from './CustomerBadge';
import './ReservationListEnhanced.css';
import './ReservationListEnhanced-color-fix.css'; // 색상 수정 패치
import './ReservationListEnhanced-alignment-fix.css'; // 정렬 개선 패치
import './ReservationListEnhanced-grid-compact.css'; // 3행2열 컴팩트 그리드
import './ReservationListEnhanced-compact-stats.css'; // 컴팩트 통계 카드

// 레이지 로드 컴포넌트
const BookingModal = lazy(() => import('./BookingModal'));

const ReservationListEnhancedComponent = ({ 
  reservations = [], 
  onUpdateReservation, 
  onCancelReservation, 
  onSelectReservation,
  rooms = []
}) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // 모바일 감지 (선언형)
  const isMobile = useDerivedState(
    [window.innerWidth],
    () => window.innerWidth < 768,
    'is-mobile'
  );

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

  // 필터링 및 정렬 (선언형, useEffect 없음)
  const processedReservations = useDerivedCollection(
    reservations,
    [
      // 상태 필터
      {
        type: 'filter',
        predicate: useCallback((res) => {
          if (filterStatus === 'all') return true;
          return res.status === filterStatus;
        }, [filterStatus])
      },
      // 출처 필터
      {
        type: 'filter',
        predicate: useCallback((res) => {
          if (filterSource === 'all') return true;
          return res.source === filterSource;
        }, [filterSource])
      },
      // 검색 필터
      {
        type: 'filter',
        predicate: useCallback((res) => {
          if (!searchTerm) return true;
          const term = searchTerm.toLowerCase();
          return (
            res.customerName?.toLowerCase().includes(term) ||
            res.guestName?.toLowerCase().includes(term) ||
            res.phone?.includes(term) ||
            res.roomName?.toLowerCase().includes(term) ||
            res.room?.toLowerCase().includes(term)
          );
        }, [searchTerm])
      },
      // 정렬
      {
        type: 'sort',
        compareFn: useCallback((a, b) => {
          let aVal, bVal;
          
          switch (sortBy) {
            case 'checkIn':
              aVal = new Date(a.checkIn || a.checkInDate);
              bVal = new Date(b.checkIn || b.checkInDate);
              break;
            case 'guestName':
              aVal = a.customerName || a.guestName || '';
              bVal = b.customerName || b.guestName || '';
              break;
            case 'totalPrice':
              aVal = a.totalPrice || 0;
              bVal = b.totalPrice || 0;
              break;
            default:
              aVal = new Date(a.createdAt || a.reservationDate);
              bVal = new Date(b.createdAt || b.reservationDate);
          }

          if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
          }
          return aVal < bVal ? 1 : -1;
        }, [sortBy, sortOrder])
      }
    ]
  );

  // 통계 (선언형)
  const statistics = useDerivedState(
    [processedReservations],
    () => {
      const stats = {
        total: processedReservations.length,
        byStatus: {},
        bySource: {},
        totalRevenue: 0
      };

      processedReservations.forEach(res => {
        // 상태별 집계
        stats.byStatus[res.status] = (stats.byStatus[res.status] || 0) + 1;
        
        // 출처별 집계
        stats.bySource[res.source] = (stats.bySource[res.source] || 0) + 1;
        
        // 매출 집계
        if (res.status === '예약확정' || res.status === '확정') {
          stats.totalRevenue += res.totalPrice || 0;
        }
      });

      return stats;
    },
    `statistics:${processedReservations.length}`
  );

  // 정렬 변경 핸들러
  const handleSortChange = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  }, [sortBy]);

  // 행 확장 토글
  const toggleRowExpansion = useCallback((reservationId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reservationId)) {
        newSet.delete(reservationId);
      } else {
        newSet.add(reservationId);
      }
      return newSet;
    });
  }, []);

  // 취소 핸들러
  const handleCancelClick = useCallback((e, reservation) => {
    e.stopPropagation();
    setCancelTarget(reservation);
  }, []);

  // 예약 선택 핸들러
  const handleSelectReservation = useCallback((reservation) => {
    if (onSelectReservation) {
      onSelectReservation(reservation);
    } else {
      setSelectedReservation(reservation);
    }
  }, [onSelectReservation]);

  // 가상 리스트 아이템 렌더러 (데스크톱)
  const renderDesktopItem = useCallback((reservation) => {
    const source = BOOKING_SOURCES[reservation.source] || BOOKING_SOURCES.etc;
    const isExpanded = expandedRows.has(reservation.id);
    
    return (
      <tr 
        key={reservation.id}
        className={`reservation-row ${isExpanded ? 'expanded' : ''}`}
        onClick={() => handleSelectReservation(reservation)}
      >
        <td className="cell-date">
          {new Date(reservation.createdAt || reservation.reservationDate).toLocaleDateString()}
        </td>
        <td className="cell-customer">
          <div className="customer-info">
            <span>{reservation.customerName || reservation.guestName}</span>
            <CustomerBadge 
              guestName={reservation.customerName || reservation.guestName}
              phone={reservation.phone}
              reservations={reservations}
            />
          </div>
        </td>
        <td className="cell-phone">{reservation.phone}</td>
        <td className="cell-room">{reservation.roomName || reservation.room}</td>
        <td className="cell-checkin">
          {new Date(reservation.checkIn || reservation.checkInDate).toLocaleDateString()}
        </td>
        <td className="cell-checkout">
          {new Date(reservation.checkOut || reservation.checkOutDate).toLocaleDateString()}
        </td>
        <td className="cell-guests">{reservation.guests || reservation.numberOfGuests || '-'}</td>
        <td className="cell-options">
          {reservation.options?.length > 0 ? reservation.options.join(', ') : '-'}
        </td>
        <td className="cell-price">
          {(reservation.totalPrice || 0).toLocaleString()}원
        </td>
        <td className="cell-source">
          <span 
            className="source-badge"
            style={{ backgroundColor: source.color + '20', color: source.color }}
          >
            {source.icon} {source.name}
          </span>
        </td>
        <td className="cell-status">
          <span className={`status-badge status-${reservation.status}`}>
            {reservation.status}
          </span>
        </td>
        <td className="cell-actions">
          {(reservation.status === '예약확정' || reservation.status === '입금대기') && (
            <button
              className="cancel-btn"
              onClick={(e) => handleCancelClick(e, reservation)}
            >
              취소
            </button>
          )}
        </td>
      </tr>
    );
  }, [expandedRows, reservations, handleSelectReservation, handleCancelClick]);

  // 모바일 카드 렌더러 - 기존 배포 버전 디자인
  const renderMobileItem = useCallback((reservation) => {
    // 디버깅용 - 실제 데이터 구조 확인
    if (reservation.options) {
      console.log('Options data for', reservation.customerName || reservation.guestName, ':', {
        options: reservation.options,
        optionsType: typeof reservation.options,
        isArray: Array.isArray(reservation.options),
        firstOption: reservation.options[0],
        firstOptionType: typeof reservation.options[0]
      });
    }
    
    const source = BOOKING_SOURCES[reservation.source] || BOOKING_SOURCES.etc;
    
    // 날짜 처리 - 다양한 필드명 대응
    const checkInDate = new Date(reservation.checkIn || reservation.checkInDate || reservation.startDate || reservation.check_in);
    const checkOutDate = new Date(reservation.checkOut || reservation.checkOutDate || reservation.endDate || reservation.check_out);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    // 날짜 포맷팅
    const formatDate = (date) => {
      if (!date || isNaN(date)) return '-';
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekDay = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
      return `${month}/${day}(${weekDay})`;
    };

    // 필드명 변형 대응 - customerName을 먼저 확인
    // UTF-8 인코딩 문제 해결을 위한 처리
    const getRawName = () => {
      const nameValue = reservation.customerName || 
                       reservation.guestName || 
                       reservation.guest_name || 
                       reservation.customer_name || 
                       reservation.name || 
                       '이름없음';
      
      // 간혹 깨진 문자로 저장된 경우 디코딩 시도
      try {
        // 이미 정상적인 한글이면 그대로 사용
        if (/[가-힯]/.test(nameValue)) {
          return nameValue;
        }
        // 깨진 문자인 경우 원본 반환
        return nameValue;
      } catch (e) {
        return nameValue;
      }
    };
    
    const guestName = getRawName();
    
    // 전화번호 포맷팅 함수 개선
    const formatPhone = (phoneStr) => {
      if (!phoneStr) return '';
      // 숫자만 추출
      const numbers = phoneStr.replace(/[^0-9]/g, '');
      // 11자리 휴대폰 번호 포맷 (010-1234-5678)
      if (numbers.length === 11) {
        return numbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      }
      // 10자리 휴대폰 번호 포맷 (010-123-4567)
      if (numbers.length === 10) {
        return numbers.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      }
      // 서울 전화번호 (02-1234-5678)
      if (numbers.length === 9 && numbers.startsWith('2')) {
        return '0' + numbers.replace(/(\d{1})(\d{4})(\d{4})/, '$1-$2-$3');
      }
      return phoneStr; // 포맷팅 불가능한 경우 원본 반환
    };
    
    const phone = formatPhone(
      reservation.phone || 
      reservation.phoneNumber || 
      reservation.phone_number || 
      reservation.tel || 
      ''
    );
    
    const roomName = reservation.roomName || 
                    reservation.room || 
                    reservation.room_name || 
                    reservation.roomType || 
                    '-';
    
    const totalPrice = reservation.totalPrice || 
                      reservation.total_price || 
                      reservation.price || 
                      reservation.amount || 
                      0;
    
    const guests = reservation.guests || 
                  reservation.numberOfGuests || 
                  reservation.number_of_guests || 
                  reservation.personCount || 
                  reservation.person_count || 
                  reservation.people || 
                  0;
    
    const status = reservation.status || 
                  reservation.reservationStatus || 
                  reservation.reservation_status || 
                  '상태없음';
    
    // 막기 예약인 경우 특별 처리
    const isBlocked = reservation.source === '막기' || guestName?.includes('관리자 막기');

    // 재방문 고객 확인 (동일 전화번호 기준)
    const visitCount = phone ? reservations.filter(r => 
      (r.phone === phone || r.phoneNumber === phone || r.phone_number === phone) && 
      (r.status === '예약확정' || r.status === '확정')
    ).length : 0;
    
    // 상태에 따른 클래스
    const statusClass = status === '입금대기' ? 'status-pending' : 
                       status === '예약취소' ? 'status-cancelled' : '';
    
    // 기존 배포 버전 카드 디자인
    return (
      <div 
        key={reservation.id}
        className="reservation-card"
        onClick={() => handleSelectReservation(reservation)}
      >
        {/* 카드 헤더 */}
        <div className="card-header">
          <div className="card-date-room">
            <span className="card-room">{roomName}</span>
            <span className="card-check-date">
              {formatDate(checkInDate)} ~ {formatDate(checkOutDate)}
            </span>
          </div>
          <span className={`status-badge status-${status}`}>
            {status}
          </span>
        </div>

        {/* 카드 바디 */}
        <div className="card-body">
          <div className="card-customer">
            <div className="customer-info">
              <span className="customer-name">{guestName}</span>
              <span className="customer-phone">{phone}</span>
            </div>
            {source && (
              <span 
                className="source-badge-mobile" 
                style={{color: source.color}}
              >
                {source.icon}
              </span>
            )}
          </div>

          <div className="card-details">
            <div className="detail-item">
              <span className="detail-label">인원</span>
              <span className="detail-value">{guests || '-'}명</span>
            </div>
            {reservation.options && reservation.options.length > 0 && (
              <div className="detail-item options-item">
                <span className="detail-label">옵션</span>
                <span className="detail-value">
                  {reservation.options.map(opt => {
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
            <span className="price-value">₩{totalPrice.toLocaleString()}</span>
          </div>

          {reservation.cancellationFee > 0 && (
            <div className="cancellation-fee-mobile">
              취소수수료: ₩{reservation.cancellationFee.toLocaleString()}
            </div>
          )}
        </div>

        {/* 카드 푸터 (액션 버튼) */}
        <div className="card-footer">
          <div className="card-meta">
            <span className="meta-label">예약일</span>
            <span className="meta-value">{formatDate(new Date(reservation.createdAt))}</span>
          </div>
          <div className="card-actions">
            {status === '입금대기' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  // 확정 처리
                }}
                className="btn-confirm"
              >
                확정
              </button>
            )}
            {status !== '예약취소' && (
              <button 
                onClick={(e) => handleCancelClick(e, reservation)}
                className="btn-cancel"
              >
                취소
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }, [reservations, handleSelectReservation, handleCancelClick]);

  return (
    <div className="reservation-list-enhanced">
      {/* 헤더 및 필터 */}
      <div className="list-header">
        <div className="search-section">
          <input
            type="text"
            placeholder={isMobile ? "검색하기 (고객명, 전화번호)" : "고객명, 전화번호, 객실 검색..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
        
        <div className="filter-section">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">모든 상태</option>
            <option value="예약확정">예약확정</option>
            <option value="입금대기">입금대기</option>
            <option value="예약취소">예약취소</option>
          </select>
          
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="filter-select"
          >
            <option value="all">모든 출처</option>
            {Object.entries(BOOKING_SOURCES).map(([key, value]) => (
              <option key={key} value={key}>
                {value.icon} {value.name}
              </option>
            ))}
          </select>
        </div>

        {!isMobile && (
          <div className="sort-controls">
            <button
              className={`sort-btn ${sortBy === 'createdAt' ? 'active' : ''}`}
              onClick={() => handleSortChange('createdAt')}
            >
              예약일 {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`sort-btn ${sortBy === 'checkIn' ? 'active' : ''}`}
              onClick={() => handleSortChange('checkIn')}
            >
              체크인 {sortBy === 'checkIn' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`sort-btn ${sortBy === 'totalPrice' ? 'active' : ''}`}
              onClick={() => handleSortChange('totalPrice')}
            >
              금액 {sortBy === 'totalPrice' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        )}
      </div>

      {/* 통계 바 - 컴팩트 디자인 */}
      {isMobile ? (
        <div className="statistics-bar-compact">
          <div className="stat-date-header">
            <span className="date-icon">📅</span>
            <span className="date-text">전체 예약 현황</span>
          </div>
          <div className="stat-compact-grid">
            <div className="stat-item-compact">
              <span className="stat-compact-value">{statistics.total}</span>
              <span className="stat-compact-label">전체</span>
            </div>
            <div className="stat-divider">|</div>
            <div className="stat-item-compact">
              <span className="stat-compact-value">
                {statistics.byStatus['입금대기'] || 0}
              </span>
              <span className="stat-compact-label">대기</span>
            </div>
            <div className="stat-divider">|</div>
            <div className="stat-item-compact">
              <span className="stat-compact-value">
                {(statistics.byStatus['예약확정'] || 0) + (statistics.byStatus['확정'] || 0)}
              </span>
              <span className="stat-compact-label">확정</span>
            </div>
            <div className="stat-divider">|</div>
            <div className="stat-item-compact revenue">
              <span className="stat-compact-value">
                {Math.floor(statistics.totalRevenue / 10000)}
              </span>
              <span className="stat-compact-label">만원</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="statistics-bar desktop">
          <div className="stat-item">
            <span className="stat-label">전체:</span>
            <span className="stat-value">{statistics.total}건</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">확정:</span>
            <span className="stat-value">
              {(statistics.byStatus['예약확정'] || 0) + (statistics.byStatus['확정'] || 0)}건
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">총 매출:</span>
            <span className="stat-value">{statistics.totalRevenue.toLocaleString()}원</span>
          </div>
        </div>
      )}

      {/* 예약 목록 */}
      <div className="list-container">
        {processedReservations.length > 0 ? (
          isMobile ? (
            // 모바일 카드 리스트
            <div className="reservation-cards">
              {processedReservations.map((reservation) => renderMobileItem(reservation))}
            </div>
          ) : (
            <div className="desktop-table-wrapper">
              <table className="reservation-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSortChange('createdAt')}>
                      예약일 {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSortChange('guestName')}>
                      고객명 {sortBy === 'guestName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>전화번호</th>
                    <th>객실</th>
                    <th onClick={() => handleSortChange('checkIn')}>
                      체크인 {sortBy === 'checkIn' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>체크아웃</th>
                    <th>인원</th>
                    <th>옵션</th>
                    <th onClick={() => handleSortChange('totalPrice')}>
                      금액 {sortBy === 'totalPrice' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>출처</th>
                    <th>상태</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {processedReservations.map(reservation => renderDesktopItem(reservation))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">검색 결과가 없습니다</div>
            <div className="empty-desc">
              다른 검색어나 필터를 사용해보세요
            </div>
          </div>
        )}
      </div>

      {/* 취소 모달 */}
      {cancelTarget && (
        <CancelReservationModal
          reservation={cancelTarget}
          onCancel={async (refundAmount) => {
            await onCancelReservation(cancelTarget.id, refundAmount);
            setCancelTarget(null);
            // 캐시 무효화
            cacheManager.invalidate('reservations:');
          }}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {/* 예약 상세 모달 (레이지 로드) */}
      {selectedReservation && !onSelectReservation && (
        <Suspense fallback={<div className="modal-loading">로딩중...</div>}>
          <BookingModal
            booking={selectedReservation}
            onClose={() => setSelectedReservation(null)}
            onUpdate={(updated) => {
              if (onUpdateReservation) {
                onUpdateReservation(updated);
              }
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

// 성능 모니터링 HOC 비활성화
// const ReservationListEnhanced = withPerformance(
//   ReservationListEnhancedComponent,
//   'ReservationListEnhanced'
// );

const ReservationListEnhanced = ReservationListEnhancedComponent;

export default ReservationListEnhanced;
