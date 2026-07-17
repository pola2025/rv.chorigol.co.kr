// src/components/CancelReservationModal.jsx
import React, { useState, useEffect } from 'react';
import {
  getRefundRate,
  calculateRefundAmount,
  calculateCancellationFee,
  getRefundPolicyText,
  REFUND_POLICY
} from '../constants/refundPolicy';
import './CancelReservationModal.css';

function CancelReservationModal({ reservation, onConfirm, onClose }) {
  const [cancelReason, setCancelReason] = useState('');
  const [isManualRefund, setIsManualRefund] = useState(false);
  const [manualRefundAmount, setManualRefundAmount] = useState('');
  const [refundInfo, setRefundInfo] = useState({
    refundRate: 0,
    refundAmount: 0,
    cancellationFee: 0,
    policyText: ''
  });

  useEffect(() => {
    if (reservation) {
      const refundRate = getRefundRate(reservation.checkIn);
      const refundAmount = calculateRefundAmount(reservation.totalPrice, reservation.checkIn);
      const cancellationFee = calculateCancellationFee(reservation.totalPrice, reservation.checkIn);
      const policyText = getRefundPolicyText(reservation.checkIn);

      setRefundInfo({
        refundRate,
        refundAmount,
        cancellationFee,
        policyText
      });
      setManualRefundAmount(refundAmount.toString());
    }
  }, [reservation]);

  // 수동 환불금액 변경 시 수수료 재계산
  const handleManualRefundChange = (value) => {
    const numValue = value.replace(/[^0-9]/g, '');
    setManualRefundAmount(numValue);
  };

  // 실제 환불금액 (수동 입력 or 자동 계산)
  const getFinalRefundAmount = () => {
    if (isManualRefund && manualRefundAmount !== '') {
      return parseInt(manualRefundAmount) || 0;
    }
    return refundInfo.refundAmount;
  };

  // 실제 취소수수료 계산
  const getFinalCancellationFee = () => {
    const totalPrice = reservation?.totalPrice || 0;
    return totalPrice - getFinalRefundAmount();
  };

  const handleConfirm = () => {
    const finalRefundAmount = getFinalRefundAmount();
    const finalCancellationFee = getFinalCancellationFee();

    onConfirm({
      cancelReason,
      refundAmount: finalRefundAmount,
      cancellationFee: finalCancellationFee,
      refundRate: isManualRefund ? Math.round((finalRefundAmount / (reservation?.totalPrice || 1)) * 100) : refundInfo.refundRate,
      isManualRefund
    });
  };

  if (!reservation) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="cancel-modal">
        <div className="cancel-modal-header">
          <h3>예약 취소 확인</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="cancel-modal-body">
          {/* 예약 정보 */}
          <div className="reservation-info-section">
            <h4>예약 정보</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">예약자</span>
                <span className="value">{reservation.customerName}</span>
              </div>
              <div className="info-item">
                <span className="label">객실</span>
                <span className="value">{reservation.roomName}</span>
              </div>
              <div className="info-item">
                <span className="label">체크인</span>
                <span className="value">{reservation.checkIn}</span>
              </div>
              <div className="info-item">
                <span className="label">체크아웃</span>
                <span className="value">{reservation.checkOut}</span>
              </div>
            </div>
          </div>

          {/* 환불 정책 안내 */}
          <div className="refund-policy-section">
            <h4>환불 정책 안내</h4>
            <div className="policy-alert">
              <span className="alert-icon">ℹ️</span>
              <span>{refundInfo.policyText}</span>
            </div>
            
            <div className="policy-table">
              <table>
                <thead>
                  <tr>
                    <th>취소 시점</th>
                    <th>환불율</th>
                  </tr>
                </thead>
                <tbody>
                  {REFUND_POLICY.map((policy, index) => {
                    const isCurrentPolicy = policy.refundRate === refundInfo.refundRate;
                    return (
                      <tr key={index} className={isCurrentPolicy ? 'current' : ''}>
                        <td>
                          {policy.daysBeforeCheckIn === 0 
                            ? '당일' 
                            : `${policy.daysBeforeCheckIn}일 전`}
                        </td>
                        <td>{policy.refundRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 환불 금액 계산 */}
          <div className="refund-calculation">
            <div className="refund-header">
              <h4>환불 금액 계산</h4>
              <label className="manual-toggle">
                <input
                  type="checkbox"
                  checked={isManualRefund}
                  onChange={(e) => setIsManualRefund(e.target.checked)}
                />
                <span>수동 지정</span>
              </label>
            </div>
            <div className="calculation-details">
              <div className="calc-row">
                <span>결제 금액</span>
                <span className="amount">₩{reservation.totalPrice.toLocaleString()}</span>
              </div>

              {!isManualRefund ? (
                <>
                  <div className="calc-row">
                    <span>환불율 (정책 기준)</span>
                    <span className="rate">{refundInfo.refundRate}%</span>
                  </div>
                  <div className="calc-row cancellation-fee">
                    <span>취소 수수료</span>
                    <span className="amount negative">-₩{refundInfo.cancellationFee.toLocaleString()}</span>
                  </div>
                  <div className="calc-row total">
                    <span>환불 예정 금액</span>
                    <span className="amount highlight">₩{refundInfo.refundAmount.toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="calc-row manual-input-row">
                    <span>환불 금액 (직접 입력)</span>
                    <div className="manual-input-wrapper">
                      <span className="currency">₩</span>
                      <input
                        type="text"
                        value={manualRefundAmount}
                        onChange={(e) => handleManualRefundChange(e.target.value)}
                        placeholder="환불금액 입력"
                        className="manual-refund-input"
                      />
                    </div>
                  </div>
                  <div className="calc-row cancellation-fee">
                    <span>취소 수수료</span>
                    <span className="amount negative">-₩{getFinalCancellationFee().toLocaleString()}</span>
                  </div>
                  <div className="calc-row total">
                    <span>최종 환불 금액</span>
                    <span className="amount highlight">₩{getFinalRefundAmount().toLocaleString()}</span>
                  </div>
                  <div className="manual-note">
                    환불율: {Math.round((getFinalRefundAmount() / (reservation.totalPrice || 1)) * 100)}%
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 취소 사유 */}
          <div className="cancel-reason-section">
            <h4>취소 사유</h4>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="취소 사유를 입력해주세요 (선택사항)"
              rows={3}
            />
          </div>

          {/* 경고 메시지 */}
          {refundInfo.refundRate === 0 && (
            <div className="warning-message">
              <span className="warning-icon">⚠️</span>
              <span>당일 취소 또는 1일 전 취소는 환불이 불가능합니다.</span>
            </div>
          )}
        </div>

        <div className="cancel-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            돌아가기
          </button>
          <button 
            className="btn-danger" 
            onClick={handleConfirm}
            disabled={!reservation}
          >
            예약 취소 확인
          </button>
        </div>
      </div>
    </>
  );
}

export default CancelReservationModal;
