// src/common/NewReservationModal.jsx
import React, { useState, useMemo } from 'react';
import { serverTimestamp } from "firebase/firestore";
import { useWindowWidth, getNextDateStr } from '../utils';
import { usePricingRules } from '../hooks/useOptions';
import { useLateCheckoutSettings } from '../hooks/useOptionSettings';
import { calculatePriceForDate } from '../utils/priceCalculator';
import reservationDebugger from '../utils/reservationDebugger';
import './NewReservationModal.css';

// 디버깅을 위한 로그
console.log('[NewReservationModal] getNextDateStr type:', typeof getNextDateStr);
console.log('[NewReservationModal] getNextDateStr:', getNextDateStr);

const NewReservationModal = ({ 
  isOpen, 
  onClose, 
  dateStr, 
  rooms = [], 
  options = [], 
  onSubmit, 
  getAvailableStock,
  initialData = {} // 초기 데이터 추가
}) => {
  const { data: pricingRules } = usePricingRules();
  const { isAvailableForRoom } = useLateCheckoutSettings(); // 레이트 체크아웃 설정 가져오기
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  // 예약출처 옵션
  const BOOKING_SOURCES = [
    { 
      id: 'naver_place', 
      name: '네이버 플레이스', 
      icon: '📍',
      color: '#03C75A',
      isPaid: true // 바로 예약확정
    },
    { 
      id: 'naver_booking', 
      name: '네이버 펜션예약', 
      icon: '🏠',
      color: '#03C75A',
      isPaid: true
    },
    { 
      id: 'naver_map', 
      name: '네이버 지도', 
      icon: '🗺️',
      color: '#9CA3AF',
      isPaid: true
    },
    { 
      id: 'transfer', 
      name: '이체예약', 
      icon: '💸',
      color: '#F59E0B',
      isPaid: false // 입금대기
    },
    { 
      id: 'group', 
      name: '단체예약', 
      icon: '👥',
      color: '#8B5CF6',
      isPaid: true
    },
    { 
      id: 'etc', 
      name: '기타', 
      icon: '📝',
      color: '#6B7280',
      isPaid: true
    }
  ];

  // initialData가 null인 경우 빈 객체로 처리 (기본값은 undefined일 때만 적용됨)
  const safeInitialData = initialData || {};

  // 초기 날짜 설정 - initialData가 있으면 사용, 없으면 dateStr 사용
  console.log('[NewReservationModal] Initializing dates...');
  console.log('[NewReservationModal] dateStr:', dateStr);
  console.log('[NewReservationModal] initialData:', safeInitialData);

  const initialCheckIn = safeInitialData.checkIn || dateStr || '';
  let initialCheckOut = '';

  try {
    if (safeInitialData.checkOut) {
      initialCheckOut = safeInitialData.checkOut;
    } else if (dateStr) {
      console.log('[NewReservationModal] Calling getNextDateStr with:', dateStr);
      initialCheckOut = getNextDateStr(dateStr);
      console.log('[NewReservationModal] getNextDateStr result:', initialCheckOut);
    }
  } catch (error) {
    console.error('[NewReservationModal] Error calling getNextDateStr:', error);
    initialCheckOut = '';
  }
  
  // 선택된 객실에 따른 기본 인원 설정
  const getDefaultGuests = (roomName) => {
    const room = rooms.find(r => r.객실명 === roomName);
    
    // 객실명에 따른 기본 인원 설정
    // Forest 패밀리는 기준 4명 (최대 5명, 추가비용 없음)
    if (roomName === 'Forest 패밀리') {
      return 4;
    }
    // 호수뷰객실은 기준 4명 (최대 6명)
    else if (roomName.includes('호수뷰')) {
      return 4;
    }
    // Forest mini 패밀리는 기준 2명 (최대 3명, 추가비용 없음)
    else if (roomName === 'Forest mini 패밀리') {
      return 2;
    }
    // Forest mini는 기준/최대 2명
    else if (roomName === 'Forest mini') {
      return 2;
    }
    // Forest는 기준 2명 (최대 4명)
    else if (roomName === 'Forest') {
      return 2;
    }
    
    // room 데이터가 있으면 기준인원 사용, 없으면 2명
    if (room && room.기준인원) {
      return room.기준인원;
    }
    
    return 2; // 기본값
  };
  
  const [formData, setFormData] = useState({
    customerName: safeInitialData.customerName || '',
    phone: safeInitialData.phone || '',
    roomName: safeInitialData.roomName || '',
    checkIn: initialCheckIn,
    checkOut: initialCheckOut,
    guests: safeInitialData.guests || (safeInitialData.roomName ? getDefaultGuests(safeInitialData.roomName) : 2),
    selectedOptions: safeInitialData.selectedOptions || [],
    totalPrice: 0,
    roomPrice: 0,
    optionPrice: 0,
    onsitePrice: 0,
    memo: safeInitialData.memo || '',
    source: safeInitialData.source || '',
    depositorName: safeInitialData.depositorName || ''
  });

  // initialData가 변경될 때 formData 업데이트
  React.useEffect(() => {
    if (isOpen && safeInitialData.roomName) {
      setFormData(prev => ({
        ...prev,
        roomName: safeInitialData.roomName,
        checkIn: safeInitialData.checkIn || prev.checkIn,
        checkOut: safeInitialData.checkOut || prev.checkOut,
        source: safeInitialData.source || prev.source
      }));
    }
  }, [isOpen, safeInitialData]);

  // 현재 선택된 예약출처 정보
  const selectedSource = useMemo(() => {
    return BOOKING_SOURCES.find(source => source.id === formData.source);
  }, [formData.source]);

  // 선택된 객실 정보
  const selectedRoom = useMemo(() => {
    return rooms.find(room => room.객실명 === formData.roomName);
  }, [rooms, formData.roomName]);

  // 체크인 날짜 변경 핸들러
  const handleCheckInChange = (value) => {
    const newFormData = { ...formData, checkIn: value };
    
    // 체크아웃이 없거나 체크인 이전이면 자동으로 1박 설정
    if (!formData.checkOut || new Date(value) >= new Date(formData.checkOut)) {
      newFormData.checkOut = getNextDateStr(value);
    }
    
    setFormData(newFormData);
  };

  // 가격 계산 (선언형)
  const calculatedPrices = useMemo(() => {
    if (!selectedRoom || !formData.checkIn || !formData.checkOut) {
      return {
        roomPrice: 0,
        optionPrice: 0,
        onsitePrice: 0,
        totalPrice: 0,
        dailyPrices: []
      };
    }

    const checkIn = new Date(formData.checkIn);
    const checkOut = new Date(formData.checkOut);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) {
      return {
        roomPrice: 0,
        optionPrice: 0,
        onsitePrice: 0,
        totalPrice: 0,
        dailyPrices: []
      };
    }

    // 날짜별 가격 계산
    let totalBasePrice = 0;
    const dailyPrices = [];
    
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(checkIn);
      currentDate.setDate(currentDate.getDate() + i);
      const dayPrice = calculatePriceForDate(currentDate, selectedRoom, pricingRules);
      totalBasePrice += dayPrice;
      dailyPrices.push({
        date: currentDate.toISOString().split('T')[0],
        price: dayPrice
      });
    }
    
    // 추가 인원 요금
    const extraGuests = Math.max(0, formData.guests - (selectedRoom.기준인원 || 2));
    const extraGuestPrice = extraGuests * (selectedRoom.추가인원요금 || 0) * nights;
    
    // 옵션 요금 계산
    let includedOptionPrice = 0;
    let onsiteOptionPrice = 0;
    
    formData.selectedOptions.forEach(optionId => {
      const option = options.find(opt => opt.id === optionId);
      if (!option) return;
      
      if (option.id === 'camping_burner' && selectedRoom.객실명 !== '호수뷰객실') {
        includedOptionPrice += (option.price || 0);
      }
      
      if (option.id === 'charcoal_bbq') {
        onsiteOptionPrice += (option.price || 0);
      }
    });
    
    const roomPrice = totalBasePrice + extraGuestPrice + includedOptionPrice;
    const totalPrice = roomPrice;
    
    return {
      roomPrice,
      optionPrice: includedOptionPrice,
      onsitePrice: onsiteOptionPrice,
      totalPrice,
      dailyPrices,
      basePrice: totalBasePrice,
      extraGuestPrice
    };
  }, [selectedRoom, formData.checkIn, formData.checkOut, formData.guests, formData.selectedOptions, options, pricingRules]);

  // 폼 검증
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.customerName.trim()) {
      newErrors.customerName = '예약자명을 입력해주세요.';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = '연락처를 입력해주세요.';
    } else if (!/^[0-9-]+$/.test(formData.phone)) {
      newErrors.phone = '올바른 연락처 형식이 아닙니다.';
    }
    
    if (!formData.roomName) {
      newErrors.roomName = '객실을 선택해주세요.';
    }
    
    if (!formData.source) {
      newErrors.source = '예약출처를 선택해주세요.';
    }
    
    // 이체예약이고 입금자명이 없는 경우
    if (formData.source === 'transfer' && !formData.depositorName.trim()) {
      newErrors.depositorName = '입금자명을 입력해주세요.';
    }
    
    if (!formData.checkIn) {
      newErrors.checkIn = '체크인 날짜를 선택해주세요.';
    }
    
    if (!formData.checkOut) {
      newErrors.checkOut = '체크아웃 날짜를 선택해주세요.';
    }
    
    if (formData.checkIn && formData.checkOut) {
      const checkIn = new Date(formData.checkIn);
      const checkOut = new Date(formData.checkOut);
      
      if (checkOut <= checkIn) {
        newErrors.checkOut = '체크아웃은 체크인 이후여야 합니다.';
      }
      
      // 재고 확인
      let currentDate = new Date(formData.checkIn);
      const endDate = new Date(formData.checkOut);
      let unavailableDates = [];
      
      while (currentDate < endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const stock = getAvailableStock(dateStr, formData.roomName);
        if (stock <= 0) {
          unavailableDates.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      if (unavailableDates.length > 0) {
        newErrors.checkIn = `선택한 날짜에 예약이 불가능합니다: ${unavailableDates.join(', ')}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    reservationDebugger.logAddReservation('폼 제출 시작', formData);
    
    if (!validateForm()) {
      reservationDebugger.logAddReservation('폼 검증 실패', errors, true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 예약출처에 따라 상태 결정
      const status = selectedSource?.isPaid ? '예약확정' : '입금대기';
      
      // 선택된 옵션들의 객체 배열 생성
      const selectedOptionObjects = formData.selectedOptions.map(optionId => {
        // 하드코딩된 옵션 매핑 (옵션 데이터가 없을 경우를 위해)
        const optionMapping = {
          'camping_burner': { name: '캠핑버너&그릴', price: 20000 },
          'charcoal_bbq': { name: '숯불바베큐', price: 30000 },
          'late_checkout': { name: '레이트 체크아웃', price: 0 }
        };
        const mappedOption = optionMapping[optionId];
        return mappedOption || { name: optionId, price: 0 };
      });
      
      const reservationData = {
        ...formData,
        ...calculatedPrices,
        options: selectedOptionObjects, // 객체 배열로 저장
        status,
        createdAt: serverTimestamp()
      };
      
      reservationDebugger.logAddReservation('예약 데이터 준비 완료', reservationData);
      
      // 데이터 검증
      const validation = reservationDebugger.validateReservationData(reservationData);
      if (!validation.isValid) {
        throw new Error(`데이터 검증 실패: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        console.warn('경고:', validation.warnings);
      }
      
      await onSubmit(reservationData);
      
      reservationDebugger.logAddReservation('예약 추가 성공', { id: 'success' });
      
      // 예약 성공 시 항상 모달 닫기
      handleClose();
      // alert 제거 - Dashboard에서 처리함
    } catch (error) {
      reservationDebugger.logAddReservation('예약 추가 실패', error, true);
      
      // 오류 분석
      const errorAnalysis = reservationDebugger.analyzeError(error);
      console.error('오류 분석:', errorAnalysis);
      
      let errorMessage = '예약 추가 중 오류가 발생했습니다.\n\n';
      errorMessage += `오류: ${error.message || '알 수 없는 오류'}\n\n`;
      
      if (errorAnalysis.suggestions.length > 0) {
        errorMessage += '해결 방법:\n';
        errorAnalysis.suggestions.forEach((suggestion, index) => {
          errorMessage += `${index + 1}. ${suggestion}\n`;
        });
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    setFormData({
      customerName: '',
      phone: '',
      roomName: '',
      checkIn: '',
      checkOut: '',
      guests: 2,
      selectedOptions: [],
      totalPrice: 0,
      memo: '',
      source: '',
      depositorName: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className={`new-reservation-modal ${isMobile ? 'mobile' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>새 예약 추가</h2>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* 고객 정보 */}
          <div className="form-section">
            <h3>고객 정보</h3>
            
            <div className="form-group">
              <label htmlFor="customerName">예약자명 *</label>
              <input
                id="customerName"
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                className={errors.customerName ? 'error' : ''}
                disabled={isSubmitting}
              />
              {errors.customerName && (
                <span className="error-message">{errors.customerName}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="phone">연락처 *</label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="010-0000-0000"
                className={errors.phone ? 'error' : ''}
                disabled={isSubmitting}
              />
              {errors.phone && (
                <span className="error-message">{errors.phone}</span>
              )}
            </div>
          </div>

          {/* 예약 정보 */}
          <div className="form-section">
            <h3>예약 정보</h3>
            
            <div className="form-group">
              <label htmlFor="roomName">객실 선택 *</label>
              <select
                id="roomName"
                value={formData.roomName}
                onChange={(e) => {
                  const newRoomName = e.target.value;
                  const defaultGuests = getDefaultGuests(newRoomName);
                  setFormData({
                    ...formData, 
                    roomName: newRoomName,
                    guests: defaultGuests // 객실 변경 시 인원수도 자동 업데이트
                  });
                }}
                className={errors.roomName ? 'error' : ''}
                disabled={isSubmitting}
              >
                <option value="">객실을 선택하세요</option>
                {rooms.map(room => {
                  // 선택된 날짜 범위의 재고 확인
                  let minStock = room.재고 || 0;
                  let hasUnavailableDates = false;
                  
                  if (formData.checkIn && formData.checkOut) {
                    const currentDate = new Date(formData.checkIn);
                    const endDate = new Date(formData.checkOut);
                    
                    while (currentDate < endDate) {
                      const dateStr = currentDate.toISOString().split('T')[0];
                      const stock = getAvailableStock(dateStr, room.객실명);
                      minStock = Math.min(minStock, stock);
                      if (stock <= 0) hasUnavailableDates = true;
                      currentDate.setDate(currentDate.getDate() + 1);
                    }
                  }
                  
                  return (
                    <option 
                      key={room.id} 
                      value={room.객실명}
                      disabled={hasUnavailableDates}
                    >
                      {room.객실명} ({room.기준인원}~{room.최대인원}인)
                      {formData.checkIn && formData.checkOut && (
                        hasUnavailableDates ? ' - 예약불가' : ` - 재고: ${minStock}개`
                      )}
                    </option>
                  );
                })}
              </select>
              {errors.roomName && (
                <span className="error-message">{errors.roomName}</span>
              )}
            </div>

            <div className="form-group">
              <label>예약출처 *</label>
              <div className="booking-source-grid">
                {BOOKING_SOURCES.map(source => (
                  <label 
                    key={source.id} 
                    className={`booking-source-item ${formData.source === source.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={source.id}
                      checked={formData.source === source.id}
                      onChange={(e) => setFormData({...formData, source: e.target.value})}
                      disabled={isSubmitting}
                    />
                    <div className="source-content">
                      <span className="source-icon" style={{color: source.color}}>
                        {source.icon}
                      </span>
                      <span className="source-name">{source.name}</span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.source && (
                <span className="error-message">{errors.source}</span>
              )}
            </div>

            {/* 입금자명 - 이체예약일 때만 표시 */}
            {formData.source === 'transfer' && (
              <div className="form-group">
                <label htmlFor="depositorName">입금자명 *</label>
                <input
                  id="depositorName"
                  type="text"
                  value={formData.depositorName}
                  onChange={(e) => setFormData({...formData, depositorName: e.target.value})}
                  placeholder="입금자명을 입력하세요"
                  className={errors.depositorName ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.depositorName && (
                  <span className="error-message">{errors.depositorName}</span>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="checkIn">체크인 *</label>
                <input
                  id="checkIn"
                  type="date"
                  value={formData.checkIn}
                  onChange={(e) => handleCheckInChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={errors.checkIn ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.checkIn && (
                  <span className="error-message">{errors.checkIn}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="checkOut">체크아웃 *</label>
                <input
                  id="checkOut"
                  type="date"
                  value={formData.checkOut}
                  onChange={(e) => setFormData({...formData, checkOut: e.target.value})}
                  min={formData.checkIn || new Date().toISOString().split('T')[0]}
                  className={errors.checkOut ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.checkOut && (
                  <span className="error-message">{errors.checkOut}</span>
                )}
              </div>
            </div>

            {/* 날짜별 재고 표시 */}
            {formData.checkIn && formData.checkOut && formData.roomName && (
              <div className="stock-info-section">
                <label>날짜별 재고 현황</label>
                <div className="daily-stock-list">
                  {(() => {
                    const stockInfo = [];
                    const currentDate = new Date(formData.checkIn);
                    const endDate = new Date(formData.checkOut);
                    
                    while (currentDate < endDate) {
                      const dateStr = currentDate.toISOString().split('T')[0];
                      const stock = getAvailableStock(dateStr, formData.roomName);
                      stockInfo.push({
                        date: dateStr,
                        stock: stock
                      });
                      currentDate.setDate(currentDate.getDate() + 1);
                    }
                    
                    return stockInfo.map(info => (
                      <div key={info.date} className={`daily-stock-item ${info.stock <= 0 ? 'unavailable' : ''}`}>
                        <span className="stock-date">{info.date}</span>
                        <span className={`stock-count ${info.stock <= 0 ? 'no-stock' : ''}`}>
                          재고: {info.stock}개
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="guests">인원</label>
              <select
                id="guests"
                value={formData.guests}
                onChange={(e) => setFormData({...formData, guests: parseInt(e.target.value)})}
                disabled={!selectedRoom || isSubmitting}
              >
                {selectedRoom ? (
                  Array.from(
                    { length: selectedRoom.최대인원 - (selectedRoom.기준인원 || 2) + 1 }, 
                    (_, i) => (selectedRoom.기준인원 || 2) + i
                  ).map(num => (
                    <option key={num} value={num}>
                      {num}명 {num > selectedRoom.기준인원 && `(추가 ${num - selectedRoom.기준인원}명)`}
                    </option>
                  ))
                ) : (
                  <option value={2}>객실을 먼저 선택하세요</option>
                )}
              </select>
            </div>
          </div>

          {/* 추가 옵션 */}
          <div className="form-section">
            <h3>추가 옵션</h3>
            <div className="options-list">
              {/* 캠핑버너&그릴 - 호수뷰객실 제외 */}
              {selectedRoom && selectedRoom.객실명 !== '호수뷰객실' && (
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={formData.selectedOptions.includes('camping_burner')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          selectedOptions: [...formData.selectedOptions, 'camping_burner']
                        });
                      } else {
                        setFormData({
                          ...formData,
                          selectedOptions: formData.selectedOptions.filter(id => id !== 'camping_burner')
                        });
                      }
                    }}
                    disabled={isSubmitting}
                  />
                  <span>캠핑버너&그릴 (+20,000원)</span>
                  <small className="option-note">객실 요금에 포함</small>
                </label>
              )}
              
              {/* 숯불바베큐 */}
              <label className="option-item">
                <input
                  type="checkbox"
                  checked={formData.selectedOptions.includes('charcoal_bbq')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        selectedOptions: [...formData.selectedOptions, 'charcoal_bbq']
                      });
                    } else {
                      setFormData({
                        ...formData,
                        selectedOptions: formData.selectedOptions.filter(id => id !== 'charcoal_bbq')
                      });
                    }
                  }}
                  disabled={isSubmitting}
                />
                <span>숯불바베큐 (+30,000원)</span>
                <small className="option-note onsite">현장 결제</small>
              </label>
              
              {/* 레이트 체크아웃 - 설정된 객실만 표시 */}
              {selectedRoom && isAvailableForRoom(selectedRoom.객실명) && (
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={formData.selectedOptions.includes('late_checkout')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          selectedOptions: [...formData.selectedOptions, 'late_checkout']
                        });
                      } else {
                        setFormData({
                          ...formData,
                          selectedOptions: formData.selectedOptions.filter(id => id !== 'late_checkout')
                        });
                      }
                    }}
                    disabled={isSubmitting}
                  />
                  <span>레이트 체크아웃 (14:00)</span>
                  <small className="option-note">재고 확인 필요</small>
                </label>
              )}
            </div>
          </div>

          {/* 메모 */}
          <div className="form-section">
            <h3>메모</h3>
            <div className="form-group">
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData({...formData, memo: e.target.value})}
                placeholder="특별 요청사항이나 메모를 입력하세요"
                rows="3"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 요금 정보 */}
          <div className="price-section">
            <h3>요금 정보</h3>
            <div className="price-details">
              {selectedRoom && formData.checkIn && formData.checkOut && (
                <>
                  <div className="price-row">
                    <span>숙박 요금</span>
                    <span>{calculatedPrices.basePrice?.toLocaleString()}원</span>
                  </div>
                  {calculatedPrices.dailyPrices.length > 0 && (
                    <div className="daily-prices">
                      {calculatedPrices.dailyPrices.map(day => (
                        <div key={day.date} className="daily-price-item">
                          <span>{day.date}</span>
                          <span>{day.price.toLocaleString()}원</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {calculatedPrices.extraGuestPrice > 0 && (
                    <div className="price-row">
                      <span>추가 인원 ({formData.guests - selectedRoom.기준인원}명)</span>
                      <span>+{calculatedPrices.extraGuestPrice?.toLocaleString()}원</span>
                    </div>
                  )}
                  {calculatedPrices.optionPrice > 0 && (
                    <div className="price-row">
                      <span>추가 옵션</span>
                      <span>+{calculatedPrices.optionPrice.toLocaleString()}원</span>
                    </div>
                  )}
                  <div className="price-row total">
                    <span>객실 요금 총액</span>
                    <span className="total-price">{calculatedPrices.totalPrice?.toLocaleString()}원</span>
                  </div>
                  {calculatedPrices.onsitePrice > 0 && (
                    <div className="price-row onsite">
                      <span>현장 결제 금액</span>
                      <span className="onsite-price">{calculatedPrices.onsitePrice.toLocaleString()}원</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </form>

        <div className="modal-footer">
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? '처리 중...' : '예약 추가'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewReservationModal;
