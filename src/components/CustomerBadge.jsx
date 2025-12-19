import React from 'react';
import { useReservations } from '../hooks/useReservations';
import './CustomerBadge.css';

/**
 * 고객명 옆에 예약 횟수를 표시하는 배지 컴포넌트
 * @param {Object} props
 * @param {string} props.customerName - 고객명
 * @param {string} props.phone - 전화번호
 * @param {boolean} props.showName - 이름 표시 여부 (기본: true)
 * @param {string} props.className - 추가 클래스명
 */
const CustomerBadge = ({ customerName, phone, showName = true, className = '' }) => {
  const { data: reservations = [] } = useReservations();
  
  if (!customerName) return null;
  
  // 고객별 예약 횟수 계산 (직접 계산)
  const count = React.useMemo(() => {
    if (!customerName) return 0;  // phone이 없어도 이름으로만 계산
    
    // 이름으로만 필터링 (전화번호는 선택적)
    const customerReservations = reservations.filter(res => {
      // 취소된 예약과 막기 예약은 제외
      if (res.status === '예약취소' || res.source === '막기') {
        return false;
      }
      
      // 이름이 일치하는 경우
      if (res.customerName === customerName) {
        // 전화번호가 있으면 전화번호도 체크, 없으면 이름만으로 매칭
        if (phone && res.phone) {
          return res.phone === phone;
        }
        return true;  // 전화번호가 없으면 이름만으로 매칭
      }
      
      return false;
    });
    
    
    return customerReservations.length;
  }, [reservations, customerName, phone]);
  
  const isVip = count >= 3;
  
  // 모든 예약에 대해 배지 표시 (테스트를 위해 1회도 표시)
  if (count === 0) {
    return showName ? <span className={className}>{customerName}</span> : null;
  }
  
  return (
    <span className={`customer-badge-wrapper ${className}`}>
      {showName && <span className="customer-name">{customerName}</span>}
      <span 
        className={`reservation-count-badge ${isVip ? 'vip' : ''}`}
        title={`총 ${count}회 예약${isVip ? ' (VIP)' : ''}`}
      >
        {count}
      </span>
    </span>
  );
};

export default CustomerBadge;
