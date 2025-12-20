// CalendarPage.jsx - 예약 캘린더 페이지
import React from 'react';
import ReservationCalendar from '../components/ReservationCalendar';
import {
  useUpdateReservation,
  useCancelReservation,
  useConfirmReservation,
  useAddReservation
} from '../hooks/useReservations';

function CalendarPage() {
  const { mutateAsync: updateReservation } = useUpdateReservation();
  const { mutateAsync: cancelReservation } = useCancelReservation();
  const { mutateAsync: confirmReservation } = useConfirmReservation();
  const { mutateAsync: addReservation } = useAddReservation();

  const handleConfirmReservation = async (id, depositorName) => {
    try {
      await confirmReservation(id, depositorName);
    } catch (error) {
      console.error('예약 확정 실패:', error);
      alert('예약 확정에 실패했습니다.');
    }
  };

  const handleCancelReservation = async (reservation, cancelData) => {
    try {
      await cancelReservation(reservation.id, cancelData);
    } catch (error) {
      console.error('예약 취소 실패:', error);
      alert('예약 취소에 실패했습니다.');
    }
  };

  const handleUpdateReservation = async (id, data) => {
    try {
      await updateReservation({ id, ...data });
    } catch (error) {
      console.error('예약 수정 실패:', error);
      alert('예약 수정에 실패했습니다.');
    }
  };

  const handleAddReservation = async (data) => {
    try {
      await addReservation(data);
    } catch (error) {
      console.error('예약 추가 실패:', error);
      alert('예약 추가에 실패했습니다.');
    }
  };

  return (
    <ReservationCalendar
      onConfirmReservation={handleConfirmReservation}
      onCancelReservation={handleCancelReservation}
      onUpdateReservation={handleUpdateReservation}
      onAddReservation={handleAddReservation}
    />
  );
}

export default CalendarPage;
