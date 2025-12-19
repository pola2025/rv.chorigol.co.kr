// src/components/ReservationCalendar.jsx
// 2025 리뉴얼 - 관공서 스타일, 직관적이고 가독성 중심
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { db } from '../config/firebase';
import CustomCalendar from './CustomCalendar';
import NewReservationModal from '../common/NewReservationModal';
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
  const [isCapturing, setIsCapturing] = useState(false);
  const panelRef = useRef(null);

  // 데이터 로드
  useEffect(() => {
    loadRooms();
    loadOptions();
    loadReservations();
  }, []);

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
        const checkIn = new Date(res.checkIn);
        const checkOut = new Date(res.checkOut);
        const target = new Date(selectedDate);
        return target >= checkIn && target < checkOut;
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

  // 예약 취소
  const handleCancelReservation = async (reservation) => {
    if (!confirm(`${reservation.customerName}님의 예약을 취소하시겠습니까?`)) return;
    try {
      await onCancelReservation(reservation);
      await loadReservations();
    } catch (error) {
      console.error('예약 취소 실패:', error);
    }
  };

  // 화면 캡쳐 (스타일 임시 변경 방식 - 전체 스크롤 캡쳐)
  const handleCapture = async () => {
    if (!panelRef.current || isCapturing) return;

    setIsCapturing(true);

    const panel = panelRef.current;
    const panelContent = panel.querySelector('.panel-content');
    const isMobile = window.innerWidth <= 768;

    // 원본 스타일 저장
    const originalStyles = {
      panel: {
        position: panel.style.position,
        bottom: panel.style.bottom,
        left: panel.style.left,
        right: panel.style.right,
        maxHeight: panel.style.maxHeight,
        height: panel.style.height,
        borderRadius: panel.style.borderRadius,
        transform: panel.style.transform
      },
      panelContent: panelContent ? {
        maxHeight: panelContent.style.maxHeight,
        overflow: panelContent.style.overflow
      } : null,
      scrollTop: panelContent?.scrollTop || 0,
      windowScrollX: window.scrollX,
      windowScrollY: window.scrollY
    };

    try {
      // 1. 스크롤 초기화
      window.scrollTo(0, 0);
      if (panelContent) {
        panelContent.scrollTop = 0;
      }

      // 2. 모바일에서 스타일 임시 변경 (전체 콘텐츠 표시)
      if (isMobile) {
        panel.style.position = 'absolute';
        panel.style.bottom = 'auto';
        panel.style.left = '0';
        panel.style.right = '0';
        panel.style.maxHeight = 'none';
        panel.style.height = 'auto';
        panel.style.borderRadius = '0';
        panel.style.transform = 'none';

        if (panelContent) {
          panelContent.style.maxHeight = 'none';
          panelContent.style.overflow = 'visible';
        }
      }

      // 3. 렌더링 안정화 대기
      await new Promise(resolve => setTimeout(resolve, 200));

      // 4. 캡쳐 실행
      const canvas = await html2canvas(panel, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: panel.scrollWidth,
        windowHeight: panel.scrollHeight
      });

      // 5. 이미지 다운로드
      const link = document.createElement('a');
      const dateStr = formatDate(selectedDate).replace(/\s/g, '').replace(/[()]/g, '');
      link.download = `예약현황_${dateStr}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

    } catch (error) {
      console.error('캡쳐 실패:', error);
      alert('화면 캡쳐에 실패했습니다.');
    } finally {
      // 6. 스타일 복원
      if (isMobile) {
        panel.style.position = originalStyles.panel.position;
        panel.style.bottom = originalStyles.panel.bottom;
        panel.style.left = originalStyles.panel.left;
        panel.style.right = originalStyles.panel.right;
        panel.style.maxHeight = originalStyles.panel.maxHeight;
        panel.style.height = originalStyles.panel.height;
        panel.style.borderRadius = originalStyles.panel.borderRadius;
        panel.style.transform = originalStyles.panel.transform;

        if (panelContent && originalStyles.panelContent) {
          panelContent.style.maxHeight = originalStyles.panelContent.maxHeight;
          panelContent.style.overflow = originalStyles.panelContent.overflow;
        }
      }

      // 7. 스크롤 위치 복원
      window.scrollTo(originalStyles.windowScrollX, originalStyles.windowScrollY);
      if (panelContent) {
        panelContent.scrollTop = originalStyles.scrollTop;
      }

      setIsCapturing(false);
    }
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
      const checkIn = new Date(res.checkIn);
      const checkOut = new Date(res.checkOut);
      const target = new Date(dateStr);
      return target >= checkIn && target < checkOut;
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
                className="capture-btn"
                onClick={handleCapture}
                disabled={isCapturing}
                title="화면 캡쳐"
              >
                {isCapturing ? '⏳' : '📷'}
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
    </div>
  );
};

export default ReservationCalendar;
