// TypeScript 타입 정의로 컴파일 시점 에러 방지
export interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  roomName: string;
  checkIn: Date | string | FirebaseTimestamp;
  checkOut: Date | string | FirebaseTimestamp;
  status: ReservationStatus;
  source: BookingSource;
  totalPrice: number;
  guests: number;
  options?: ReservationOption[];
  refundAmount?: number;
  refundRate?: number;
  cancellationFee?: number;
  createdAt: Date | string | FirebaseTimestamp;
  updatedAt?: Date | string | FirebaseTimestamp;
}

export type ReservationStatus = '입금대기' | '예약확정' | '예약취소' | '체크인' | '체크아웃';
export type BookingSource = 'naver_place' | 'naver_booking' | 'naver_map' | 'transfer' | 'group' | '막기' | 'etc';

export interface ReservationOption {
  name: string;
  price?: number;
  quantity?: number;
}

export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

// Zod 스키마로 런타임 검증
import { z } from 'zod';

export const ReservationSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  phone: z.string(),
  roomName: z.string(),
  checkIn: z.union([z.date(), z.string(), z.object({
    seconds: z.number(),
    nanoseconds: z.number()
  })]),
  checkOut: z.union([z.date(), z.string(), z.object({
    seconds: z.number(),
    nanoseconds: z.number()
  })]),
  status: z.enum(['입금대기', '예약확정', '예약취소', '체크인', '체크아웃']),
  source: z.enum(['naver_place', 'naver_booking', 'naver_map', 'transfer', 'group', '막기', 'etc']),
  totalPrice: z.number(),
  guests: z.number(),
  options: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      price: z.number().optional(),
      quantity: z.number().optional()
    })
  ])).optional(),
  refundAmount: z.number().optional(),
  refundRate: z.number().optional(),
  cancellationFee: z.number().optional(),
  createdAt: z.union([z.date(), z.string(), z.object({
    seconds: z.number(),
    nanoseconds: z.number()
  })]),
  updatedAt: z.union([z.date(), z.string(), z.object({
    seconds: z.number(),
    nanoseconds: z.number()
  })]).optional()
});

// 타입 가드 함수
export function isReservation(obj: unknown): obj is Reservation {
  try {
    ReservationSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

// Result 타입 (Rust 스타일)
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Option 타입 (함수형 프로그래밍)
export type Option<T> = T | null | undefined;

export function Some<T>(value: T): T {
  return value;
}

export function None(): null {
  return null;
}

export function isSome<T>(value: Option<T>): value is T {
  return value !== null && value !== undefined;
}

export function isNone<T>(value: Option<T>): value is null | undefined {
  return value === null || value === undefined;
}