// src/components/SmsHistoryTable.jsx - SMS 발송 이력 테이블
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getKSTToday, getKSTDateString, formatPhoneNumber } from '../utils';

// 업체별 객실 구분
// 호수뷰객실은 초호쉼터에 속함
const ROOM_GROUPS = {
  choho: ['Forest', 'Forest mini', 'Forest mini 패밀리', 'Forest 패밀리'],
  shelter: ['호수뷰객실', '1박2일워크샵', '야유회', '단체예약']
};

// 신호등 상태 컴포넌트
const StatusLight = ({ status, title }) => {
  let color = '#9CA3AF'; // 회색 (미발송)
  let label = '미발송';

  if (status === 'success') {
    color = '#10B981'; // 녹색 (발송완료)
    label = '발송완료';
  } else if (status === 'failed') {
    color = '#EF4444'; // 빨간색 (발송실패)
    label = '실패';
  }

  return (
    <div
      className="status-light"
      title={`${title}: ${label}`}
      style={{
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        backgroundColor: color,
        display: 'inline-block',
        boxShadow: status === 'success' ? '0 0 6px rgba(16, 185, 129, 0.5)' : 'none'
      }}
    />
  );
};

const SmsHistoryTable = ({ businessType = 'choho' }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // 오늘 날짜 (YYYY-MM-DD) - KST 기준
  const today = useMemo(() => {
    return getKSTToday();
  }, []);

  useEffect(() => {
    loadReservations();
  }, [businessType]);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const rooms = ROOM_GROUPS[businessType];

      // 최근 30일 + 미래 예약 조회 (KST 기준)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = getKSTDateString(thirtyDaysAgo);

      const reservationsRef = collection(db, 'reservations');
      const q = query(
        reservationsRef,
        where('checkIn', '>=', dateStr),
        orderBy('checkIn', 'asc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const allReservations = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(r => rooms.includes(r.roomName))
        .filter(r => r.status !== '예약취소'); // 취소된 예약 제외

      setReservations(allReservations);
    } catch (error) {
      console.error('예약 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 예약 분류: 예정(오늘 포함) vs 이용완료
  const { upcomingReservations, completedReservations } = useMemo(() => {
    const upcoming = [];
    const completed = [];

    reservations.forEach(r => {
      if (r.checkOut < today) {
        completed.push(r);
      } else {
        upcoming.push(r);
      }
    });

    // 예정: 가까운 날짜가 위로 (오름차순)
    upcoming.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    // 이용완료: 최근 것이 위로 (내림차순)
    completed.sort((a, b) => b.checkIn.localeCompare(a.checkIn));

    return { upcomingReservations: upcoming, completedReservations: completed };
  }, [reservations, today]);

  // SMS 상태 판단
  const getSmsStatus = (reservation, type) => {
    const smsStatus = reservation.smsStatus || {};

    if (smsStatus[`${type}Sent`] === true) {
      return 'success';
    } else if (smsStatus[`${type}Error`]) {
      return 'failed';
    }
    return 'pending'; // 미발송
  };

  // 날짜 포맷
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 테이블 행 렌더링
  const renderRow = (reservation) => (
    <tr key={reservation.id}>
      <td className="room-cell">{reservation.roomName}</td>
      <td className="date-cell">
        {formatDate(reservation.checkIn)} ~ {formatDate(reservation.checkOut)}
      </td>
      <td className="name-cell">{reservation.customerName || '-'}</td>
      <td className="guests-cell hide-mobile">{reservation.guests || reservation.guestCount || '-'}명</td>
      <td className="phone-cell hide-mobile">{formatPhoneNumber(reservation.phone) || '-'}</td>
      <td className="option-cell hide-mobile">
        {reservation.options || reservation.addons ? '✓' : '-'}
      </td>
      <td className="status-cell">
        <StatusLight status={getSmsStatus(reservation, 'confirmation')} title="예약확정" />
      </td>
      <td className="status-cell">
        <StatusLight status={getSmsStatus(reservation, 'checkIn')} title="입실안내" />
      </td>
      <td className="status-cell">
        <StatusLight status={getSmsStatus(reservation, 'checkOut')} title="퇴실안내" />
      </td>
    </tr>
  );

  if (loading) {
    return (
      <div className="sms-history-loading">
        <span>발송이력 로딩중...</span>
      </div>
    );
  }

  return (
    <div className="sms-history-section">
      <div className="sms-history-header">
        <h3>📋 문자 발송 이력</h3>
        <div className="legend">
          <span><StatusLight status="success" title="발송완료" /> 발송완료</span>
          <span><StatusLight status="pending" title="미발송" /> 미발송</span>
          <span><StatusLight status="failed" title="실패" /> 실패</span>
        </div>
      </div>

      <div className="sms-history-table-wrapper">
        <table className="sms-history-table">
          <thead>
            <tr>
              <th>객실</th>
              <th>이용일</th>
              <th>예약자</th>
              <th className="hide-mobile">인원</th>
              <th className="hide-mobile">연락처</th>
              <th className="hide-mobile">옵션</th>
              <th className="status-header">확정</th>
              <th className="status-header">입실</th>
              <th className="status-header">퇴실</th>
            </tr>
          </thead>
          <tbody>
            {upcomingReservations.length === 0 && completedReservations.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-row">최근 30일 내 예약이 없습니다</td>
              </tr>
            ) : (
              <>
                {/* 예정 예약 */}
                {upcomingReservations.map(renderRow)}

                {/* 이용완료 고객 (접이식) */}
                {completedReservations.length > 0 && (
                  <>
                    <tr
                      className="completed-toggle-row"
                      onClick={() => setShowCompleted(!showCompleted)}
                    >
                      <td colSpan="9">
                        <span className="toggle-icon">{showCompleted ? '▼' : '▶'}</span>
                        이용완료 고객 ({completedReservations.length}건)
                      </td>
                    </tr>
                    {showCompleted && completedReservations.map(renderRow)}
                  </>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .sms-history-section {
          background: #fff;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .sms-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .sms-history-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1F2937;
        }

        .legend {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: #6B7280;
        }

        .legend span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .sms-history-table-wrapper {
          overflow-x: auto;
        }

        .sms-history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .sms-history-table th {
          background: #F9FAFB;
          padding: 0.5rem 0.75rem;
          text-align: left;
          font-weight: 500;
          color: #6B7280;
          border-bottom: 1px solid #E5E7EB;
          white-space: nowrap;
        }

        .sms-history-table td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #F3F4F6;
          color: #374151;
        }

        .sms-history-table tr:hover {
          background: #F9FAFB;
        }

        .room-cell {
          font-weight: 500;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .date-cell {
          white-space: nowrap;
          color: #6B7280;
          font-size: 0.8rem;
        }

        .name-cell {
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-cell {
          text-align: center;
          width: 50px;
        }

        .guests-cell {
          text-align: center;
          width: 50px;
          color: #6B7280;
        }

        .phone-cell {
          font-size: 0.8rem;
          color: #6B7280;
          white-space: nowrap;
        }

        .option-cell {
          text-align: center;
          width: 40px;
          color: #10B981;
          font-weight: 600;
        }

        .empty-row {
          text-align: center;
          color: #9CA3AF;
          padding: 2rem !important;
        }

        .completed-toggle-row {
          cursor: pointer;
          background: #F3F4F6;
        }

        .completed-toggle-row:hover {
          background: #E5E7EB;
        }

        .completed-toggle-row td {
          padding: 0.6rem 0.75rem;
          font-size: 0.85rem;
          color: #6B7280;
          font-weight: 500;
        }

        .toggle-icon {
          margin-right: 0.5rem;
          font-size: 0.7rem;
        }

        .sms-history-loading {
          background: #fff;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          color: #6B7280;
          margin-bottom: 1.5rem;
        }

        /* 모바일 반응형 */
        @media (max-width: 768px) {
          .sms-history-section {
            padding: 0.75rem;
            margin-bottom: 1rem;
            border-radius: 8px;
          }

          .sms-history-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .sms-history-header h3 {
            font-size: 0.9rem;
          }

          .legend {
            gap: 0.75rem;
            font-size: 0.7rem;
          }

          .sms-history-table {
            font-size: 0.75rem;
          }

          .sms-history-table th,
          .sms-history-table td {
            padding: 0.4rem 0.35rem;
          }

          /* 모바일에서 숨김 */
          .hide-mobile {
            display: none !important;
          }

          .room-cell {
            max-width: 60px;
            font-size: 0.7rem;
          }

          .date-cell {
            font-size: 0.65rem;
            white-space: nowrap;
          }

          .name-cell {
            max-width: 45px;
            font-size: 0.7rem;
          }

          .status-cell {
            width: 24px;
            padding: 0.25rem 0.15rem !important;
          }

          .status-header {
            font-size: 0.6rem !important;
            padding: 0.3rem 0.15rem !important;
          }

          .status-light {
            width: 11px !important;
            height: 11px !important;
          }

          .completed-toggle-row td {
            font-size: 0.75rem;
            padding: 0.5rem;
          }

          .empty-row {
            padding: 1.5rem !important;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
};

export default SmsHistoryTable;
