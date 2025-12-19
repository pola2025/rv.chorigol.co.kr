// src/components/BookingModal.jsx - 마이그레이션 버전
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CancelReservationModal from './CancelReservationModal';
import { useCustomer } from '../hooks/useCustomers';
import { CustomerGrades } from '../models/Customer';
import CustomerBadge from './CustomerBadge';
import migrationDebugger, { DEBUG_LEVELS } from '../utils/migrationDebugger';
import './BookingModal.css';

const BookingModal = ({ booking, onClose, onConfirm, onCancel, onUpdate }) => {
  // 디버그 시작
  migrationDebugger.startPerformance('BookingModal');
  migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'BookingModal', 'Component rendered', { 
    bookingId: booking?.id 
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [depositorName, setDepositorName] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // 🔄 MIGRATION: useEffect 제거, React Query로 교체
  const queryClient = useQueryClient();
  
  const { data: isMobile } = useQuery({
    queryKey: ['isMobile-bookingModal'],
    queryFn: () => window.innerWidth < 768,
    staleTime: Infinity,
    initialData: window.innerWidth < 768
  });

  // Window resize 이벤트 리스너 (선언형)
  React.useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      queryClient.setQueryData(['isMobile-bookingModal'], newIsMobile);
      migrationDebugger.log(DEBUG_LEVELS.TRACE, 'BookingModal', 'Window resized', { 
        isMobile: newIsMobile,
        width: window.innerWidth 
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [queryClient]);
  
  // 추가 옵션 리스트 (편집을 위해)
  const AVAILABLE_OPTIONS = [
    { id: '캠핑버너&그릴', name: '캠핑버너&그릴', icon: '🔥' },
    { id: '숯불바베큐', name: '숯불바베큐', icon: '🍖' },
    { id: '레이트 체크아웃', name: '레이트 체크아웃', icon: '⏰' }
  ];
  
  // 고객 정보 조회
  const { data: customer, isLoading: customerLoading } = useCustomer(
    booking?.phone, 
    booking?.customerName
  );

  // 예약출처 옵션 (동일하게 정의)
  const BOOKING_SOURCES = {
    'naver_place': { name: '네이버 플레이스', icon: '📍', color: '#03C75A' },
    'naver_booking': { name: '네이버 펜션예약', icon: '🏠', color: '#03C75A' },
    'naver_map': { name: '네이버 지도', icon: '🗺️', color: '#9CA3AF' },
    'transfer': { name: '이체예약', icon: '💸', color: '#F59E0B' },
    'group': { name: '단체예약', icon: '👥', color: '#8B5CF6' },
    '막기': { name: '관리자 막기', icon: '🚫', color: '#DC2626' },
    'etc': { name: '기타', icon: '📝', color: '#6B7280' }
  };
  
  // 옵션 정보 정의
  const OPTION_INFO = {
    '캠핑버너&그릴': { icon: '🔥', price: '20,000원' },
    '숯불바베큐': { icon: '🍖', price: '30,000원 (현장결제)' },
    '레이트 체크아웃': { icon: '⏰', price: '오후 2시' }
  };

  // 🔄 MIGRATION: useEffect를 React Query로 교체
  // booking 데이터가 변경될 때 editData 업데이트
  const { data: normalizedEditData } = useQuery({
    queryKey: ['bookingEditData', booking?.id],
    queryFn: () => {
      if (!booking) return {};
      
      // 옵션 데이터 정규화
      const normalizedOptions = (booking.options || []).map(opt => {
        if (typeof opt === 'object' && opt !== null) {
          return opt.name || '';
        }
        return String(opt || '');
      }).filter(Boolean);
      
      const data = {
        customerName: booking.customerName || '',
        phone: booking.phone || '',
        memo: booking.memo || '',
        totalPrice: booking.totalPrice || 0,
        guests: booking.guests || 2,
        options: normalizedOptions
      };

      migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'BookingModal', 'Edit data normalized', data);
      
      return data;
    },
    enabled: !!booking,
    staleTime: Infinity
  });

  // editData 초기화 (한 번만)
  React.useEffect(() => {
    if (normalizedEditData && Object.keys(normalizedEditData).length > 0) {
      setEditData(normalizedEditData);
      setDepositorName('');
    }
  }, [normalizedEditData]);

  if (!booking) return null;

  const handleConfirm = () => {
    if (!depositorName.trim()) {
      alert('입금자명을 입력해주세요.');
      return;
    }
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'BookingModal', 'Confirming booking', { 
      bookingId: booking.id,
      depositorName 
    });
    onConfirm(booking.id, depositorName);
  };

  const handleSaveEdit = () => {
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'BookingModal', 'Saving edit', { 
      bookingId: booking.id,
      editData 
    });
    onUpdate(booking.id, editData);
    setIsEditing(false);
  };

  const handleCancelClick = async () => {
    console.log('🎯 [취소 버튼 클릭]', booking);
    // 디버그 alert 제거 - 취소 프로세스가 정상 작동하도록 함
    
    // 관리자 막기 예약인 경우 바로 삭제
    if (booking.source === '막기') {
      if (window.confirm('막기 예약을 삭제하시겠습니까?\n삭제하면 해당 날짜에 다시 예약을 받을 수 있습니다.')) {
        try {
          migrationDebugger.log(DEBUG_LEVELS.INFO, 'BookingModal', 'Deleting block reservation', { 
            bookingId: booking.id 
          });
          await onCancel(booking, {});
          onClose();
        } catch (error) {
          migrationDebugger.log(DEBUG_LEVELS.ERROR, 'BookingModal', 'Block deletion failed', error);
          alert('막기 예약 삭제에 실패했습니다.');
        }
      }
    } else {
      setShowCancelModal(true);
    }
  };

  const handleCancelConfirm = (cancelData) => {
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'BookingModal', 'Canceling booking', { 
      bookingId: booking.id,
      cancelData 
    });
    onCancel(booking, cancelData);
    setShowCancelModal(false);
    onClose();
  };

  const formatDate = (date) => {
    if (!date) return '-';
    if (date.seconds) {
      return new Date(date.seconds * 1000).toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  };

  const getDuration = () => {
    if (!booking.checkIn || !booking.checkOut) return 0;
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    const diffTime = Math.abs(checkOut - checkIn);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // 성능 모니터링 종료
  migrationDebugger.endPerformance('BookingModal');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>예약 상세 정보</h2>
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* 상태 섹션 */}
            <div className="booking-status-section">
            <div className="status-info">
              <span className={`status-badge large status-${booking.status}`}>
                {booking.status}
              </span>
              {isMobile && booking.source && BOOKING_SOURCES[booking.source] && (
                <span className="source-badge" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  fontSize: '0.75rem',
                  color: BOOKING_SOURCES[booking.source].color
                }}>
                  {BOOKING_SOURCES[booking.source].icon}
                  {BOOKING_SOURCES[booking.source].name}
                </span>
              )}
            </div>
            <span className="booking-id">예약번호: {booking.id?.slice(-8)}</span>
          </div>

          {/* 고객 정보 */}
          <div className="info-section">
            <h3>고객 정보</h3>
            {isEditing ? (
              <>
                <div className="form-group">
                  <label>예약자명</label>
                  <input
                    type="text"
                    value={editData.customerName}
                    onChange={(e) => setEditData({...editData, customerName: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>연락처</label>
                  <input
                    type="tel"
                    value={editData.phone}
                    onChange={(e) => setEditData({...editData, phone: e.target.value})}
                    className="form-input"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="info-row">
                  <span className="info-label">예약자명</span>
                  <span className="info-value">
                    <CustomerBadge customerName={booking.customerName} phone={booking.phone} />
                    {customer && customer.visitCount > 0 && (
                      <span className="customer-badge" style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: isMobile ? '0.625rem' : '0.75rem',
                        fontWeight: '600',
                        backgroundColor: CustomerGrades[customer.customerGrade].color,
                        color: 'white'
                      }}>
                        {CustomerGrades[customer.customerGrade].name} 
                        {!isMobile && customer.visitCount > 1 && ` ${customer.visitCount}회`}
                      </span>
                    )}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">연락처</span>
                  <span className="info-value">{booking.phone}</span>
                </div>
                {!isMobile && booking.source && BOOKING_SOURCES[booking.source] && (
                  <div className="info-row">
                    <span className="info-label">예약출처</span>
                    <span className="info-value">
                      <span style={{color: BOOKING_SOURCES[booking.source].color}}>
                        {BOOKING_SOURCES[booking.source].icon}
                      </span>
                      {' '}
                      {BOOKING_SOURCES[booking.source].name}
                    </span>
                  </div>
                )}
                
                {/* 고객 히스토리 통합 */}
                {customer && customer.visitCount > 0 && !customerLoading && (
                  <div className="customer-history-inline">
                    <div className="customer-stats-inline">
                      <div className="stat-item">
                        <span className="stat-label">방문</span>
                        <span className="stat-value">{customer.visitCount}회</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">총액</span>
                        <span className="stat-value">
                          {(() => {
                            const manWon = Math.floor(customer.totalSpent / 10000);
                            const cheonWon = Math.floor((customer.totalSpent % 10000) / 1000);
                            
                            if (manWon > 0 && cheonWon > 0) {
                              return `${manWon}만${cheonWon}천원`;
                            } else if (manWon > 0) {
                              return `${manWon}만원`;
                            } else {
                              return `${cheonWon}천원`;
                            }
                          })()}
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">취소</span>
                        <span className="stat-value">{customer.cancelCount}회</span>
                      </div>
                    </div>
                    {(customer.preferredRooms?.length > 0 || customer.notes) && (
                      <div className="customer-extra-info">
                        {customer.preferredRooms?.length > 0 && (
                          <div className="info-row compact">
                            <span className="info-label">선호</span>
                            <span className="info-value">{customer.preferredRooms.join(', ')}</span>
                          </div>
                        )}
                        {customer.notes && (
                          <div className="info-row compact">
                            <span className="info-label">메모</span>
                            <span className="info-value">{customer.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 예약 정보 */}
          <div className="info-section">
            <h3>예약 정보</h3>
            <div className="info-row">
              <span className="info-label">객실</span>
              <span className="info-value">{booking.roomName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">체크인</span>
              <span className="info-value">{booking.checkIn}</span>
            </div>
            <div className="info-row">
              <span className="info-label">체크아웃</span>
              <span className="info-value">{booking.checkOut}</span>
            </div>
            <div className="info-row">
              <span className="info-label">숙박일수</span>
              <span className="info-value">{getDuration()}박</span>
            </div>
            {isEditing ? (
              <>
                <div className="form-group">
                  <label>인원</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editData.guests}
                    onChange={(e) => setEditData({...editData, guests: parseInt(e.target.value) || 2})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>추가 옵션</label>
                  <div className="options-edit-list">
                    {AVAILABLE_OPTIONS.map(option => {
                      // 현재 옵션이 체크되어 있는지 확인
                      const isChecked = editData.options?.some(opt => {
                        if (typeof opt === 'object' && opt !== null) {
                          return opt.name === option.name;
                        }
                        return opt === option.name;
                      });
                      
                      return (
                        <label key={option.id} className="option-checkbox">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditData({
                                  ...editData,
                                  options: [...(editData.options || []), option.name]
                                });
                              } else {
                                setEditData({
                                  ...editData,
                                  options: (editData.options || []).filter(opt => {
                                    if (typeof opt === 'object' && opt !== null) {
                                      return opt.name !== option.name;
                                    }
                                    return opt !== option.name;
                                  })
                                });
                              }
                            }}
                          />
                          <span>{option.icon} {option.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="info-row">
                  <span className="info-label">인원</span>
                  <span className="info-value">{booking.guests || '-'}명</span>
                </div>
                {booking.options && booking.options.length > 0 && (
                  <div className="info-row">
                    <span className="info-label">추가옵션</span>
                    <span className="info-value">
                      <div className="options-detail">
                        {booking.options.map((option, index) => {
                          // option이 객체인지 문자열인지 확인
                          const optionName = typeof option === 'object' && option !== null 
                            ? (option.name || '') 
                            : String(option || '');
                          const optionInfo = OPTION_INFO[optionName] || { icon: '🔹', price: '' };
                          
                          return (
                            <div key={index} className="option-item">
                              <span className="option-icon">{optionInfo.icon}</span>
                              <span className="option-name">{optionName}</span>
                              {optionInfo.price && (
                                <span className="option-price">({optionInfo.price})</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 결제 정보 */}
          <div className="info-section">
            <h3>결제 정보</h3>
            {isEditing ? (
              <div className="form-group">
                <label>총 금액</label>
                <input
                  type="number"
                  value={editData.totalPrice}
                  onChange={(e) => setEditData({...editData, totalPrice: parseInt(e.target.value) || 0})}
                  className="form-input"
                />
              </div>
            ) : (
              <>
                {/* 가격 계산 내역 추가 */}
                {booking.basePrice > 0 && (
                  <div className="info-row">
                    <span className="info-label">숙박 요금</span>
                    <span className="info-value">{booking.basePrice?.toLocaleString()}원</span>
                  </div>
                )}
                {booking.extraGuestPrice > 0 && (() => {
                  // 객실 정보를 확인하여 추가 인원 수 계산
                  const rooms = [
                    { 객실명: 'Forest', 기준인원: 2 },
                    { 객실명: 'Forest mini', 기준인원: 2 },
                    { 객실명: '호수뷰객실', 기준인원: 4 }, // 기준인원 4명으로 수정
                    { 객실명: '스파객실', 기준인원: 2 }
                  ];
                  const room = rooms.find(r => r.객실명 === booking.roomName);
                  const baseGuests = room?.기준인원 || 2;
                  const extraGuests = (booking.guests || baseGuests) - baseGuests;
                  
                  return (
                    <div className="info-row">
                      <span className="info-label">추가 인원 ({extraGuests}명)</span>
                      <span className="info-value">+{booking.extraGuestPrice?.toLocaleString()}원</span>
                    </div>
                  );
                })()}
                {booking.optionPrice > 0 && (
                  <div className="info-row">
                    <span className="info-label">추가 옵션 요금</span>
                    <span className="info-value">+{booking.optionPrice?.toLocaleString()}원</span>
                  </div>
                )}
                {(booking.basePrice || booking.extraGuestPrice || booking.optionPrice) && (
                  <div className="info-row" style={{borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px'}}>
                    <span className="info-label" style={{fontWeight: 'bold'}}>총 금액</span>
                    <span className="info-value price" style={{fontWeight: 'bold', fontSize: '1.1em'}}>
                      {booking.totalPrice?.toLocaleString()}원
                    </span>
                  </div>
                )}
                {/* 가격 내역이 없는 경우 기존 방식으로 표시 */}
                {!booking.basePrice && !booking.extraGuestPrice && !booking.optionPrice && (
                  <div className="info-row">
                    <span className="info-label">총 금액</span>
                    <span className="info-value price">{booking.totalPrice?.toLocaleString()}원</span>
                  </div>
                )}
                {/* 현장 결제 금액이 있는 경우 */}
                {booking.onsitePrice > 0 && (
                  <div className="info-row" style={{marginTop: '8px'}}>
                    <span className="info-label">현장 결제 금액</span>
                    <span className="info-value" style={{color: '#ef4444'}}>
                      {booking.onsitePrice?.toLocaleString()}원
                    </span>
                  </div>
                )}
              </>
            )}
            
            {booking.status === '입금대기' && (
              <div className="form-group">
                <label>입금자명</label>
                <input
                  type="text"
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  placeholder="입금자명을 입력하세요"
                  className="form-input"
                />
              </div>
            )}
            
            {booking.status === '예약확정' && booking.depositorName && (
              <div className="info-row">
                <span className="info-label">입금자명</span>
                <span className="info-value">{booking.depositorName}</span>
              </div>
            )}
          </div>

          {/* 메모 */}
          <div className="info-section">
            <h3>메모</h3>
            {isEditing ? (
              <div className="form-group">
                <textarea
                  value={editData.memo}
                  onChange={(e) => setEditData({...editData, memo: e.target.value})}
                  className="form-input"
                  rows="3"
                  placeholder="메모를 입력하세요"
                />
              </div>
            ) : (
              <p className="memo-text">{booking.memo || '메모가 없습니다.'}</p>
            )}
          </div>

          {/* 예약 이력 */}
          <div className="info-section">
            <h3>예약 이력</h3>
            <div className="info-row small">
              <span className="info-label">예약일시</span>
              <span className="info-value">{formatDate(booking.createdAt)}</span>
            </div>
            {booking.updatedAt && (
              <div className="info-row small">
                <span className="info-label">수정일시</span>
                <span className="info-value">{formatDate(booking.updatedAt)}</span>
              </div>
            )}
            {booking.canceledAt && (
              <div className="info-row small">
                <span className="info-label">취소일시</span>
                <span className="info-value">{formatDate(booking.canceledAt)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            {!isEditing && booking.status !== '예약취소' && booking.source !== '막기' && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn btn-secondary"
              >
                수정
              </button>
            )}
          </div>
          
          <div className="footer-right">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="btn btn-secondary"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="btn btn-primary"
                >
                  저장
                </button>
              </>
            ) : (
              <>
                {booking.status === '입금대기' && (
                  <button
                    onClick={handleConfirm}
                    className="btn btn-success"
                    disabled={!depositorName.trim()}
                  >
                    입금 확정
                  </button>
                )}
                {booking.status !== '예약취소' && (
                  <button
                    onClick={handleCancelClick}
                    className="btn btn-danger"
                  >
                    {booking.source === '막기' ? '막기 삭제' : '예약 취소'}
                  </button>
                )}
                <button onClick={onClose} className="btn btn-secondary">
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showCancelModal && (
        <CancelReservationModal
          reservation={booking}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
};

export default BookingModal;
