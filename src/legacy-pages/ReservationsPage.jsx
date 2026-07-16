// ReservationsPage.jsx - 예약 목록 페이지
import React, { Suspense, lazy, useState } from 'react';
import useFirebaseStore from '../stores/useFirebaseStore';
import {
  useUpdateReservation,
  useCancelReservation,
  useConfirmReservation
} from '../hooks/useReservations';
import BookingModal from '../components/BookingModal';
import Skeleton, { CardSkeleton } from '../components/Skeleton';

const ReservationList = lazy(() => import('../components/ReservationList'));

// 로딩 폴백
const LazyFallback = () => (
  <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <Skeleton width="200px" height="2rem" />
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
    </div>
  </div>
);

function ReservationsPage() {
  const { reservations = [] } = useFirebaseStore();
  const [selectedBooking, setSelectedBooking] = useState(null);

  const { mutateAsync: updateReservation } = useUpdateReservation();
  const { mutateAsync: cancelReservation } = useCancelReservation();
  const { mutateAsync: confirmReservation } = useConfirmReservation();

  const handleUpdateReservation = async (id, data) => {
    try {
      // useUpdateReservation 은 (id, data) 두 인자를 받는다.
      // 객체 하나로 넘기면 스토어가 reservationId={객체}, updates=undefined 를 받아
      // 수정이 항상 실패한다. 캘린더(CalendarPage)는 처음부터 두 인자로 부르고 있었다.
      await updateReservation(id, data);
    } catch (error) {
      console.error('예약 수정 실패:', error);
      alert('예약 수정에 실패했습니다.');
    }
  };

  // 예약 확정 (알림 발송 포함)
  const handleConfirmReservation = async (reservationId, depositorName = '') => {
    console.log('🟢 [ReservationsPage] 예약 확정 시작:', reservationId);
    try {
      await confirmReservation(reservationId, depositorName);
      console.log('🟢 [ReservationsPage] 예약 확정 완료 (알림 발송 포함)');
    } catch (error) {
      console.error('예약 확정 실패:', error);
      alert('예약 확정에 실패했습니다.');
    }
  };

  const handleCancelReservation = async (reservation, cancelData) => {
    console.log('🔴 [ReservationsPage] 예약 취소 시작:', reservation.id, cancelData);
    try {
      await cancelReservation(reservation.id, cancelData);
      setSelectedBooking(null); // 모달 닫기
      console.log('🔴 [ReservationsPage] 예약 취소 완료');
    } catch (error) {
      console.error('예약 취소 실패:', error);
      alert('예약 취소에 실패했습니다.');
    }
  };

  return (
    <>
      <Suspense fallback={<LazyFallback />}>
        <ReservationList
          reservations={reservations}
          onUpdateReservation={handleUpdateReservation}
          onConfirmReservation={handleConfirmReservation}
          onCancelReservation={handleCancelReservation}
          onSelectReservation={setSelectedBooking}
        />
      </Suspense>

      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onCancel={handleCancelReservation}
          onUpdate={handleUpdateReservation}
        />
      )}
    </>
  );
}

export default ReservationsPage;
