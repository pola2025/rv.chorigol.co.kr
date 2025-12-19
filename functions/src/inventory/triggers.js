// functions/src/inventory/triggers.js
import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { publishInventoryEvent, InventoryEventTypes, getDatesBetween } from './events.js';

const db = getFirestore();

/**
 * 예약 생성 시 이벤트 발행
 */
export const onReservationCreated = functions.firestore
    .document('reservations/{reservationId}')
    .onCreate(async (snapshot, context) => {
        const reservation = snapshot.data();
        
        // 예약 취소 상태로 생성된 경우 무시
        if (reservation.status === '예약취소') return;
        
        console.log(`Processing new reservation: ${context.params.reservationId}`);
        
        // 체크인~체크아웃 기간의 모든 날짜에 대해 이벤트 발행
        const dates = getDatesBetween(reservation.checkIn, reservation.checkOut);
        
        for (const date of dates) {
            const eventType = reservation.source === '막기' 
                ? InventoryEventTypes.ROOM_BLOCKED 
                : InventoryEventTypes.ROOM_BOOKED;
                
            await publishInventoryEvent(db, eventType, {
                reservationId: context.params.reservationId,
                date,
                roomName: reservation.roomName,
                quantity: 1
            });
        }
        
        console.log(`Published ${dates.length} inventory events for reservation ${context.params.reservationId}`);
    });

/**
 * 예약 수정 시 이벤트 발행
 */
export const onReservationUpdated = functions.firestore
    .document('reservations/{reservationId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        
        console.log(`Processing reservation update: ${context.params.reservationId}`);
        
        // 상태가 '예약취소'로 변경된 경우
        if (before.status !== '예약취소' && after.status === '예약취소') {
            const dates = getDatesBetween(after.checkIn, after.checkOut);
            
            for (const date of dates) {
                const eventType = after.source === '막기'
                    ? InventoryEventTypes.ROOM_UNBLOCKED
                    : InventoryEventTypes.ROOM_CANCELLED;
                    
                await publishInventoryEvent(db, eventType, {
                    reservationId: context.params.reservationId,
                    date,
                    roomName: after.roomName,
                    quantity: 1
                });
            }
            
            console.log(`Published ${dates.length} cancellation events for reservation ${context.params.reservationId}`);
        }
        
        // 날짜나 객실이 변경된 경우 (복잡한 케이스 - 추후 구현)
        if (before.checkIn !== after.checkIn || 
            before.checkOut !== after.checkOut || 
            before.roomName !== after.roomName) {
            console.warn('Reservation date/room change detected. Complex update not yet implemented.');
            // TODO: 기존 날짜 취소 이벤트 + 새 날짜 예약 이벤트 발행
        }
    });

/**
 * 재고 Override 생성/수정 시 이벤트 발행
 */
export const onOverrideChanged = functions.firestore
    .document('inventory_overrides/{overrideId}')
    .onWrite(async (change, context) => {
        const overrideId = context.params.overrideId;
        const [date, roomName] = overrideId.split('_');
        
        console.log(`Processing override change: ${overrideId}`);
        
        if (!change.after.exists) {
            // Override 삭제
            await publishInventoryEvent(db, InventoryEventTypes.OVERRIDE_REMOVED, {
                date,
                roomName
            });
            console.log(`Override removed for ${date} - ${roomName}`);
        } else {
            // Override 생성/수정
            const data = change.after.data();
            await publishInventoryEvent(db, InventoryEventTypes.OVERRIDE_SET, {
                date,
                roomName,
                available: data.available
            });
            console.log(`Override set for ${date} - ${roomName}: ${data.available} rooms`);
        }
    });