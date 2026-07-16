// src/components/ReservationCalendar.jsx
// 2025 리뉴얼 - 관공서 스타일, 직관적이고 가독성 중심
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toYYYYMMDD } from '../utils';
import telegramService from '../services/telegramService';
import CustomCalendar from './CustomCalendar';
import NewReservationModal from '../common/NewReservationModal';
import CancelReservationModal from './CancelReservationModal';
import './ReservationCalendar.css';

const ReservationCalendar = ({
  onConfirmReservation,
  onCancelReservation,
  onUpdateReservation,
  onAddReservation
}) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [options, setOptions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isNewReservationOpen, setIsNewReservationOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [cancelingReservation, setCancelingReservation] = useState(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [showTelegramConfirm, setShowTelegramConfirm] = useState(false);
  const panelRef = useRef(null);

  // 데이터 로드
  useEffect(() => {
    loadRooms();
    loadOptions();
    loadReservations();
  }, []);

  // 모바일에서 캘린더 페이지 body 스크롤 방지
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      document.body.classList.add('calendar-page-mobile');
    }
    return () => {
      document.body.classList.remove('calendar-page-mobile');
    };
  }, []);

  // 모바일에서 상세 패널 열릴 때 하단 바 숨기기
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile && selectedDate) {
      document.body.classList.add('detail-panel-open');
    } else {
      document.body.classList.remove('detail-panel-open');
    }
    return () => {
      document.body.classList.remove('detail-panel-open');
    };
  }, [selectedDate]);

  const loadRooms = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'rooms'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(data);
    } catch (error) {
      console.error('객실 로드 실패:', error);
    }
  };

  const loadOptions = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'options'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOptions(data);
    } catch (error) {
      console.error('옵션 로드 실패:', error);
    }
  };

  const loadReservations = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'reservations')));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReservations(data);
    } catch (error) {
      console.error('예약 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 선택된 날짜의 예약 필터링
  const selectedDateReservations = useMemo(() => {
    if (!selectedDate) return [];

    return reservations
      .filter(res => {
        if (res.status === '예약취소') return false;

        // Firebase Timestamp/다양한 날짜 형식 처리
        const checkInStr = toYYYYMMDD(res.checkIn);
        const checkOutStr = toYYYYMMDD(res.checkOut);

        if (!checkInStr || !checkOutStr) return false;

        // 문자열 비교로 날짜 범위 체크 (체크인 <= 선택일 < 체크아웃)
        return selectedDate >= checkInStr && selectedDate < checkOutStr;
      })
      .sort((a, b) => {
        // 객실명 순서로 정렬
        const roomOrder = ['Forest', 'Forest mini', 'Forest 패밀리', 'Forest mini 패밀리', '호수뷰객실', '단체예약'];
        const aIdx = roomOrder.indexOf(a.roomName);
        const bIdx = roomOrder.indexOf(b.roomName);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return a.roomName.localeCompare(b.roomName);
      });
  }, [selectedDate, reservations]);

  // 고객별 예약 횟수 계산 (연락처 기준)
  const getCustomerReservationCount = useMemo(() => {
    const countMap = {};
    reservations.forEach(res => {
      if (res.status === '예약취소') return;
      if (res.source === '막기') return; // 막기는 제외
      const phone = res.customerPhone || res.phone;
      if (phone) {
        countMap[phone] = (countMap[phone] || 0) + 1;
      }
    });
    return (phone) => countMap[phone] || 0;
  }, [reservations]);

  // 고객별 예약 이력 조회 (연락처 기준)
  const getCustomerHistory = useMemo(() => {
    const historyMap = {};
    reservations.forEach(res => {
      if (res.status === '예약취소') return;
      if (res.source === '막기') return;
      const phone = res.customerPhone || res.phone;
      if (phone) {
        if (!historyMap[phone]) historyMap[phone] = [];
        historyMap[phone].push({
          checkIn: res.checkIn,
          roomName: res.roomName
        });
      }
    });
    // 날짜순 정렬
    Object.keys(historyMap).forEach(phone => {
      historyMap[phone].sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
    });
    return (phone) => historyMap[phone] || [];
  }, [reservations]);

  // 날짜 클릭
  const handleDateClick = (dateStr) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(dateStr);
    }
  };

  // 패널 닫기
  const handleClosePanel = () => {
    setSelectedDate(null);
  };

  // 예약 추가
  const handleAddReservation = () => {
    setEditingReservation(null);
    setIsNewReservationOpen(true);
  };

  // 예약 수정
  const handleEditReservation = (reservation) => {
    setEditingReservation(reservation);
    setIsNewReservationOpen(true);
  };

  // 예약 저장
  const handleSaveReservation = async (data) => {
    try {
      if (editingReservation) {
        await onUpdateReservation(editingReservation.id, data);
      } else {
        await onAddReservation(data);
      }
      await loadReservations();
      setIsNewReservationOpen(false);
      setEditingReservation(null);
    } catch (error) {
      console.error('예약 저장 실패:', error);
      alert('예약 저장 중 오류가 발생했습니다.');
    }
  };

  // 예약 취소 모달 열기
  const handleCancelReservation = (reservation) => {
    console.log('🔴 [ReservationCalendar] 취소 모달 열기:', reservation);

    // 막기 예약은 바로 삭제
    if (reservation.source === '막기') {
      if (!confirm(`막기 예약을 삭제하시겠습니까?`)) {
        return;
      }
      handleConfirmCancel(reservation, {});
      return;
    }

    // 일반 예약은 취소 모달 표시
    setCancelingReservation(reservation);
  };

  // 예약 취소 확정 (모달에서 확인 버튼 클릭 시)
  const handleConfirmCancel = async (reservation, cancelData) => {
    console.log('🔴 [ReservationCalendar] 예약 취소 확정:', reservation?.id || cancelingReservation?.id, cancelData);

    const targetReservation = reservation || cancelingReservation;
    if (!targetReservation) return;

    try {
      await onCancelReservation(targetReservation, cancelData);
      console.log('🔴 [ReservationCalendar] 예약 취소 완료');
      setCancelingReservation(null);
      await loadReservations();
    } catch (error) {
      console.error('🔴 [ReservationCalendar] 예약 취소 실패:', error);
      alert('예약 취소 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 텔레그램 전송 확인 모달 열기
  const handleOpenTelegramConfirm = () => {
    if (!selectedDate) return;
    setShowTelegramConfirm(true);
  };

  // 텔레그램으로 예약 현황 전송
  const handleSendTelegram = async () => {
    if (!selectedDate || isSendingTelegram) return;

    setIsSendingTelegram(true);

    try {
      await telegramService.sendDateReservationStatus(selectedDate, selectedDateReservations);
      setShowTelegramConfirm(false);
      alert('텔레그램으로 전송했습니다.');
    } catch (error) {
      console.error('텔레그램 전송 실패:', error);
      alert('텔레그램 전송에 실패했습니다.');
    } finally {
      setIsSendingTelegram(false);
    }
  };

  // 텔레그램 메시지 미리보기 생성
  const generateTelegramPreview = () => {
    if (!selectedDate) return '';

    const date = new Date(selectedDate);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const formattedDate = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;

    if (selectedDateReservations.length === 0) {
      return `📅 ${formattedDate}\n\n예약이 없습니다.`;
    }

    let preview = `📅 ${formattedDate} 예약현황\n`;
    preview += `총 ${selectedDateReservations.length}건\n`;
    preview += `━━━━━━━━━━━━━━━━\n\n`;

    selectedDateReservations.forEach((res, index) => {
      const nights = getNights(res.checkIn, res.checkOut);
      const checkInShort = res.checkIn?.slice(5).replace('-', '/');
      const checkOutShort = res.checkOut?.slice(5).replace('-', '/');

      preview += `${index + 1}. ${res.roomName}`;
      if (res.status === '입금대기') preview += ` ⏳`;
      preview += `\n`;

      if (res.source === '막기') {
        preview += `   📌 막기\n`;
        preview += `   📆 ${checkInShort} ~ ${checkOutShort} (${nights}박)\n\n`;
        return;
      }

      preview += `   👤 ${res.customerName}`;
      if (res.customerPhone || res.phone) {
        preview += ` (${res.customerPhone || res.phone})`;
      }
      preview += `\n`;

      preview += `   📆 ${checkInShort} ~ ${checkOutShort} (${nights}박)\n`;
      preview += `   👥 ${res.guests || res.guestCount || 2}명\n`;
      preview += `   💰 ${(res.totalPrice || res.roomPrice || 0).toLocaleString()}원\n`;

      if (res.options && res.options.length > 0) {
        const optionNames = res.options.map(opt =>
          typeof opt === 'object' ? opt.name : opt
        ).join(', ');
        preview += `   📦 ${optionNames}\n`;
      }

      if (res.memo && res.memo.trim()) {
        preview += `   📝 ${res.memo}\n`;
      }

      preview += `\n`;
    });

    return preview;
  };

  // 재고 확인
  const getAvailableStock = (dateStr, roomName) => {
    if (!dateStr || !roomName) return 0;
    const room = rooms.find(r => r.객실명 === roomName);
    if (!room) return 0;

    const maxStock = room.재고 || 1;
    const booked = reservations.filter(res => {
      if (res.status === '예약취소') return false;
      if (res.roomName !== roomName) return false;

      // Firebase Timestamp/다양한 날짜 형식 처리
      const checkInStr = toYYYYMMDD(res.checkIn);
      const checkOutStr = toYYYYMMDD(res.checkOut);

      if (!checkInStr || !checkOutStr) return false;

      // 문자열 비교로 날짜 범위 체크
      return dateStr >= checkInStr && dateStr < checkOutStr;
    }).length;

    return Math.max(0, maxStock - booked);
  };

  // 날짜 포맷
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  // 박 수 계산
  const getNights = (checkIn, checkOut) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-modal">
          <div className="loading-spinner-circle"></div>
          <p>로딩중입니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reservation-calendar-wrapper">
      {/* 캘린더 */}
      <div className="calendar-section">
        <CustomCalendar
          rooms={rooms}
          bookings={reservations}
          onDateClick={handleDateClick}
          selectedDate={selectedDate}
        />
      </div>

      {/* 예약 상세 패널 */}
      {selectedDate && (
        <div className="detail-panel" ref={panelRef}>
          <div className="panel-header">
            <h3>{formatDate(selectedDate)}</h3>
            <div className="panel-header-right">
              <span className="reservation-count">예약 {selectedDateReservations.length}건</span>
              <button
                className="telegram-btn"
                onClick={handleOpenTelegramConfirm}
                disabled={isSendingTelegram}
                title="텔레그램으로 전송"
              >
                {isSendingTelegram ? '⏳' : '📨'}
              </button>
              <button className="close-btn" onClick={handleClosePanel} aria-label="닫기">✕</button>
            </div>
          </div>

          <div className="panel-actions">
            <button className="add-btn" onClick={handleAddReservation}>
              + 새 예약 등록
            </button>
          </div>

          <div className="panel-content">
            {selectedDateReservations.length === 0 ? (
              <div className="empty-message">
                <p>해당 날짜에 예약이 없습니다.</p>
              </div>
            ) : (
              <div className="detail-reservation-list">
                {selectedDateReservations.map(res => {
                  // 객실명에서 클래스명 생성
                  const roomClass = res.roomName?.replace(/\s+/g, '-').toLowerCase() || '';
                  return (
                  <div key={res.id} className={`detail-reservation-card status-${res.status?.replace(/\s/g, '')} room-${roomClass}`}>
                    {/* 헤더: 객실명 + 상태 */}
                    <div className="detail-card-header">
                      <span className="room-name">{res.roomName}</span>
                      <span className={`status-badge ${res.status === '입금대기' ? 'waiting' : 'confirmed'}`}>
                        {res.status}
                      </span>
                    </div>

                    {/* 테이블 형태 정보 */}
                    <table className="info-table">
                      <tbody>
                        <tr>
                          <th>예약자</th>
                          <td>
                            {res.customerName}
                            {res.source !== '막기' && (() => {
                              const count = getCustomerReservationCount(res.customerPhone || res.phone);
                              if (count > 0) {
                                const level = count >= 5 ? 'vip' : count >= 3 ? 'regular' : 'new';
                                return <span className={`visit-badge ${level}`}>{count}</span>;
                              }
                              return null;
                            })()}
                          </td>
                          <th>연락처</th>
                          <td>{res.customerPhone || res.phone || '-'}</td>
                        </tr>
                        <tr>
                          <th>일정</th>
                          <td colSpan="3">
                            {res.checkIn?.slice(5).replace('-', '/')} ~ {res.checkOut?.slice(5).replace('-', '/')}
                            <span className="nights">{getNights(res.checkIn, res.checkOut)}박</span>
                          </td>
                        </tr>
                        <tr>
                          <th>인원</th>
                          <td colSpan="3">{res.guests || res.guestCount || 2}명</td>
                        </tr>
                        <tr>
                          <th>결제금액</th>
                          <td colSpan="3" className="price-cell">
                            <div className="price-row">
                              <span className="price-label">선결제</span>
                              <span className="price">{(res.totalPrice || res.roomPrice || 0).toLocaleString()}원</span>
                            </div>
                            {(() => {
                              // 현장결제 옵션 금액 계산 (type === 'onsite')
                              const onSiteTotal = (res.options || []).reduce((sum, opt) => {
                                const optName = typeof opt === 'object' ? opt.name : opt;
                                const optionData = options.find(o => o.name === optName);
                                if (optionData?.type === 'onsite') {
                                  return sum + (optionData.price || 0);
                                }
                                return sum;
                              }, 0);

                              if (onSiteTotal > 0) {
                                return (
                                  <div className="price-row onsite">
                                    <span className="price-label">현장결제</span>
                                    <span className="price-onsite">{onSiteTotal.toLocaleString()}원</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </td>
                        </tr>
                        {res.options && res.options.length > 0 && (
                          <tr>
                            <th>옵션</th>
                            <td colSpan="3">
                              {res.options.map((opt, i) => {
                                const name = typeof opt === 'object' ? opt.name : opt;
                                return (
                                  <span key={i} className="option-tag">{name}</span>
                                );
                              })}
                            </td>
                          </tr>
                        )}
                        {res.memo && (
                          <tr>
                            <th>메모</th>
                            <td colSpan="3" className="memo">{res.memo}</td>
                          </tr>
                        )}
                        {res.source !== '막기' && (() => {
                          const history = getCustomerHistory(res.customerPhone || res.phone);
                          if (history.length > 1) {
                            return (
                              <tr>
                                <th>이력</th>
                                <td colSpan="3" className="reservation-history">
                                  {history.slice(0, 5).map((h, i) => (
                                    <span key={i} className="history-item">
                                      {h.checkIn?.slice(2, 10).replace(/-/g, '.')}
                                    </span>
                                  ))}
                                  {history.length > 5 && <span>외 {history.length - 5}건</span>}
                                </td>
                              </tr>
                            );
                          }
                          return null;
                        })()}
                      </tbody>
                    </table>

                    {/* 버튼 */}
                    <div className="detail-card-actions">
                      <button className="btn-edit" onClick={() => handleEditReservation(res)}>수정</button>
                      {res.status !== '예약취소' && (
                        <button className="btn-cancel" onClick={() => handleCancelReservation(res)}>취소</button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 새 예약 / 수정 모달 */}
      {isNewReservationOpen && (
        <NewReservationModal
          isOpen={isNewReservationOpen}
          onClose={() => {
            setIsNewReservationOpen(false);
            setEditingReservation(null);
          }}
          dateStr={selectedDate}
          rooms={rooms}
          options={options}
          getAvailableStock={getAvailableStock}
          onSubmit={handleSaveReservation}
          initialData={editingReservation}
        />
      )}

      {/* 예약 취소 모달 */}
      {cancelingReservation && (
        <CancelReservationModal
          reservation={cancelingReservation}
          onConfirm={(cancelData) => handleConfirmCancel(null, cancelData)}
          onClose={() => setCancelingReservation(null)}
        />
      )}

      {/* 텔레그램 전송 확인 모달 */}
      {showTelegramConfirm && (
        <div className="telegram-confirm-overlay" onClick={() => setShowTelegramConfirm(false)}>
          <div className="telegram-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="telegram-confirm-header">
              <h3>📨 텔레그램 전송</h3>
              <button className="close-btn" onClick={() => setShowTelegramConfirm(false)}>✕</button>
            </div>
            <div className="telegram-confirm-body">
              <p className="telegram-confirm-message">예약 현황을 텔레그램으로 전송하시겠습니까?</p>
              <div className="telegram-preview">
                <pre>{generateTelegramPreview()}</pre>
              </div>
            </div>
            <div className="telegram-confirm-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowTelegramConfirm(false)}
                disabled={isSendingTelegram}
              >
                취소
              </button>
              <button
                className="btn-confirm"
                onClick={handleSendTelegram}
                disabled={isSendingTelegram}
              >
                {isSendingTelegram ? '전송 중...' : '전송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationCalendar;
