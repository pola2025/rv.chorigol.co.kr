// src/components/ReservationCalendar.jsx
// 2025 리뉴얼 - 관공서 스타일, 직관적이고 가독성 중심
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { db } from '../config/firebase';
import { toYYYYMMDD } from '../utils';
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

  // 예약 취소
  const handleCancelReservation = async (reservation) => {
    console.log('🔴 [ReservationCalendar] handleCancelReservation 호출됨');
    console.log('🔴 [ReservationCalendar] reservation:', reservation);
    console.log('🔴 [ReservationCalendar] onCancelReservation 존재:', !!onCancelReservation);

    if (!confirm(`${reservation.customerName}님의 예약을 취소하시겠습니까?`)) {
      console.log('🔴 [ReservationCalendar] 사용자가 취소함');
      return;
    }

    try {
      console.log('🔴 [ReservationCalendar] onCancelReservation 호출 시작...');
      // cancelData를 빈 객체로 전달
      await onCancelReservation(reservation, {});
      console.log('🔴 [ReservationCalendar] onCancelReservation 완료');
      await loadReservations();
    } catch (error) {
      console.error('🔴 [ReservationCalendar] 예약 취소 실패:', error);
      alert('예약 취소 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 화면 캡쳐 - DOM 복제 후 body에 임시 삽입하여 캡처
  const handleCapture = async () => {
    if (!panelRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      const panel = panelRef.current;
      const originalContent = panel.querySelector('.panel-content');

      // 원본 스크롤 영역의 전체 높이 구하기
      const contentScrollHeight = originalContent ? originalContent.scrollHeight : 0;

      // 1. 패널을 완전히 복제
      const clonedPanel = panel.cloneNode(true);

      // 2. 복제된 패널에 캡처용 스타일 적용 (화면 내에 배치하되 뒤로 숨김)
      clonedPanel.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 420px;
        max-height: none;
        height: auto;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: none;
        transform: none;
        animation: none;
        opacity: 1;
        visibility: visible;
        z-index: -99999;
        display: block;
        overflow: visible;
        pointer-events: none;
      `;

      // 3. 모든 요소에 인라인 스타일 강제 적용 (rgba → solid 색상)
      // 패널 헤더
      const header = clonedPanel.querySelector('.panel-header');
      if (header) {
        header.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          background: #1f2937;
          color: #ffffff;
          border-radius: 8px 8px 0 0;
          opacity: 1;
          visibility: visible;
        `;

        // 헤더 내 h3
        const h3 = header.querySelector('h3');
        if (h3) {
          h3.style.cssText = 'margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;';
        }

        // 예약 건수 배지 (rgba → solid)
        const countBadge = header.querySelector('.reservation-count');
        if (countBadge) {
          countBadge.style.cssText = `
            font-size: 13px;
            background: #4b5563;
            color: #ffffff;
            padding: 3px 10px;
            border-radius: 12px;
          `;
        }

        // 캡처 버튼 숨김 (캡처 이미지에 불필요)
        const captureBtn = header.querySelector('.capture-btn');
        if (captureBtn) {
          captureBtn.style.display = 'none';
        }

        // 닫기 버튼 숨김
        const closeBtn = header.querySelector('.close-btn');
        if (closeBtn) {
          closeBtn.style.display = 'none';
        }
      }

      // 패널 액션 영역
      const actions = clonedPanel.querySelector('.panel-actions');
      if (actions) {
        actions.style.cssText = `
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          opacity: 1;
          visibility: visible;
        `;

        const addBtn = actions.querySelector('.add-btn');
        if (addBtn) {
          addBtn.style.cssText = `
            width: 100%;
            padding: 10px;
            background: #1f2937;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
          `;
        }
      }

      // 패널 컨텐츠 - 원본의 scrollHeight를 명시적으로 적용
      const content = clonedPanel.querySelector('.panel-content');
      if (content) {
        content.style.cssText = `
          display: block;
          max-height: none;
          min-height: ${contentScrollHeight}px;
          height: auto;
          overflow: visible;
          padding: 12px;
          background: #ffffff;
          opacity: 1;
          visibility: visible;
        `;
      }

      // 빈 메시지
      const emptyMsg = clonedPanel.querySelector('.empty-message');
      if (emptyMsg) {
        emptyMsg.style.cssText = `
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
          background: #ffffff;
        `;
      }

      // 예약 리스트
      const list = clonedPanel.querySelector('.detail-reservation-list');
      if (list) {
        list.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 12px;
        `;
      }

      // 모든 예약 카드
      clonedPanel.querySelectorAll('.detail-reservation-card').forEach(card => {
        card.style.cssText = `
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          background: #ffffff;
          opacity: 1;
          visibility: visible;
        `;
      });

      // 카드 헤더
      clonedPanel.querySelectorAll('.detail-card-header').forEach(cardHeader => {
        cardHeader.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: #f3f4f6;
          border-bottom: 1px solid #e5e7eb;
          opacity: 1;
          visibility: visible;
        `;

        const roomName = cardHeader.querySelector('.room-name');
        if (roomName) {
          roomName.style.cssText = 'font-size: 14px; font-weight: 700; color: #111827;';
        }

        const statusBadge = cardHeader.querySelector('.status-badge');
        if (statusBadge) {
          const isWaiting = statusBadge.classList.contains('waiting');
          statusBadge.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 4px;
            background: ${isWaiting ? '#fef3c7' : '#d1fae5'};
            color: ${isWaiting ? '#b45309' : '#047857'};
          `;
        }
      });

      // 테이블
      clonedPanel.querySelectorAll('.info-table').forEach(table => {
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 13px; background: #ffffff;';
      });

      clonedPanel.querySelectorAll('.info-table th').forEach(th => {
        th.style.cssText = `
          padding: 8px 10px;
          background: #f9fafb;
          color: #374151;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
          vertical-align: middle;
        `;
      });

      clonedPanel.querySelectorAll('.info-table td').forEach(td => {
        td.style.cssText = `
          padding: 8px 10px;
          color: #111827;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
          vertical-align: middle;
        `;
      });

      // 박 수 배지
      clonedPanel.querySelectorAll('.nights').forEach(nights => {
        nights.style.cssText = `
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 8px;
          padding: 2px 10px;
          background: #3b82f6;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          border-radius: 12px;
        `;
      });

      // 방문 횟수 배지
      clonedPanel.querySelectorAll('.visit-badge').forEach(badge => {
        const isVip = badge.classList.contains('vip');
        const isRegular = badge.classList.contains('regular');
        badge.style.cssText = `
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          margin-left: 6px;
          padding: 0 6px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 10px;
          background: ${isVip ? '#fef3c7' : isRegular ? '#dbeafe' : '#f3f4f6'};
          color: ${isVip ? '#b45309' : isRegular ? '#1d4ed8' : '#6b7280'};
          border: 1px solid ${isVip ? '#fcd34d' : isRegular ? '#93c5fd' : '#d1d5db'};
        `;
      });

      // 옵션 태그
      clonedPanel.querySelectorAll('.option-tag').forEach(tag => {
        tag.style.cssText = `
          display: inline-block;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #6ee7b7;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          margin-right: 4px;
          margin-bottom: 2px;
        `;
      });

      // 가격
      clonedPanel.querySelectorAll('.price').forEach(price => {
        price.style.cssText = 'font-weight: 700; color: #059669;';
      });

      clonedPanel.querySelectorAll('.price-onsite').forEach(price => {
        price.style.cssText = 'font-weight: 700; color: #f59e0b;';
      });

      // 메모
      clonedPanel.querySelectorAll('.memo').forEach(memo => {
        memo.style.cssText = 'color: #6b7280; font-size: 12px; line-height: 1.4;';
      });

      // 이력
      clonedPanel.querySelectorAll('.history-item').forEach(item => {
        item.style.cssText = `
          display: inline-block;
          margin-right: 8px;
          padding: 2px 8px;
          background: #e5e7eb;
          color: #111827;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        `;
      });

      // 카드 액션 버튼
      clonedPanel.querySelectorAll('.detail-card-actions').forEach(cardActions => {
        cardActions.style.cssText = `
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
        `;
      });

      clonedPanel.querySelectorAll('.btn-edit').forEach(btn => {
        btn.style.cssText = `
          flex: 1;
          padding: 8px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        `;
      });

      clonedPanel.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.style.cssText = `
          flex: 1;
          padding: 8px;
          background: #ffffff;
          border: 1px solid #fca5a5;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          color: #dc2626;
        `;
      });

      // 4. body에 임시로 추가
      document.body.appendChild(clonedPanel);

      // 5. 렌더링 대기 (충분한 시간)
      await new Promise(resolve => setTimeout(resolve, 300));

      // 6. 실제 렌더링된 크기 구하기
      const clonedContent = clonedPanel.querySelector('.panel-content');
      const totalHeight = clonedPanel.scrollHeight;
      const totalWidth = clonedPanel.scrollWidth;

      // 7. 캡처 실행 (전체 크기 명시)
      const canvas = await html2canvas(clonedPanel, {
        backgroundColor: '#ffffff',
        scale: 8,  // 고해상도 캡쳐 (8배)
        useCORS: true,
        logging: false,
        allowTaint: true,
        width: totalWidth,
        height: totalHeight,
        windowWidth: totalWidth,
        windowHeight: totalHeight,
        scrollX: 0,
        scrollY: 0,
      });

      // 7. 임시 요소 제거
      document.body.removeChild(clonedPanel);

      // 8. 이미지 다운로드
      const link = document.createElement('a');
      const dateStr = formatDate(selectedDate).replace(/\s/g, '').replace(/[()]/g, '');
      link.download = `예약현황_${dateStr}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

    } catch (error) {
      console.error('캡쳐 실패:', error);
      alert('화면 캡쳐에 실패했습니다.');

      // 에러 시에도 임시 요소 정리
      const tempPanel = document.querySelector('.detail-panel[style*="z-index: -99999"]');
      if (tempPanel) {
        document.body.removeChild(tempPanel);
      }
    } finally {
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
