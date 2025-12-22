/**
 * Reservation Entity
 * 도메인 엔티티 - 비즈니스 로직의 핵심
 * KST 기준 날짜 처리
 */
import { getKSTDateString } from '../../utils';

export class Reservation {
  constructor({
    id,
    guestName,
    phone,
    room,
    checkIn,
    checkOut,
    guests,
    totalPrice,
    depositPrice,
    status,
    options = [],
    createdAt,
    updatedAt,
    isBlocked = false,
    memo = ''
  }) {
    this.id = id;
    this.guestName = guestName;
    this.phone = phone;
    this.room = room;
    this.checkIn = checkIn;
    this.checkOut = checkOut;
    this.guests = guests;
    this.totalPrice = totalPrice;
    this.depositPrice = depositPrice;
    this.status = status;
    this.options = options;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.isBlocked = isBlocked;
    this.memo = memo;
  }

  // 비즈니스 로직 메서드들
  isActive() {
    return this.status === '예약확정' || this.status === '입금대기';
  }

  isCanceled() {
    return this.status === '예약취소';
  }

  canCancel() {
    return this.isActive() && !this.isBlocked;
  }

  getDuration() {
    const start = new Date(this.checkIn);
    const end = new Date(this.checkOut);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }

  isOverlapping(startDate, endDate) {
    const resStart = new Date(this.checkIn);
    const resEnd = new Date(this.checkOut);
    const checkStart = new Date(startDate);
    const checkEnd = new Date(endDate);
    
    return resStart < checkEnd && resEnd > checkStart;
  }

  // 불변성 유지를 위한 업데이트 메서드
  updateStatus(newStatus) {
    return new Reservation({
      ...this,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
  }

  updateMemo(newMemo) {
    return new Reservation({
      ...this,
      memo: newMemo,
      updatedAt: new Date().toISOString()
    });
  }
}

// Value Objects
export class DateRange {
  constructor(startDate, endDate) {
    if (new Date(startDate) >= new Date(endDate)) {
      throw new Error('시작일이 종료일보다 이전이어야 합니다.');
    }
    this.startDate = startDate;
    this.endDate = endDate;
  }

  contains(date) {
    const checkDate = new Date(date);
    return checkDate >= new Date(this.startDate) && checkDate <= new Date(this.endDate);
  }

  getDays() {
    const days = [];
    const current = new Date(this.startDate);
    const end = new Date(this.endDate);

    while (current < end) {
      days.push(getKSTDateString(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }
}
