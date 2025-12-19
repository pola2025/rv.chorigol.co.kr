// functions/src/inventory/events.js
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 재고 이벤트 타입 정의
 */
export const InventoryEventTypes = {
    ROOM_BOOKED: 'ROOM_BOOKED',
    ROOM_CANCELLED: 'ROOM_CANCELLED',
    ROOM_BLOCKED: 'ROOM_BLOCKED',
    ROOM_UNBLOCKED: 'ROOM_UNBLOCKED',
    OVERRIDE_SET: 'OVERRIDE_SET',
    OVERRIDE_REMOVED: 'OVERRIDE_REMOVED'
};

/**
 * 재고 이벤트 발행
 * @param {Firestore} db - Firestore 인스턴스
 * @param {string} eventType - 이벤트 타입
 * @param {Object} payload - 이벤트 페이로드
 */
export async function publishInventoryEvent(db, eventType, payload) {
    const event = {
        type: eventType,
        payload,
        timestamp: FieldValue.serverTimestamp(),
        processed: false,
        processingAttempts: 0,
        createdAt: new Date().toISOString() // UTC ISO 8601
    };
    
    await db.collection('inventory_events').add(event);
    console.log(`Inventory event published: ${eventType}`, payload);
}

/**
 * 날짜 범위 계산 헬퍼
 * @param {string} startDate - 시작 날짜 (YYYY-MM-DD)
 * @param {string} endDate - 종료 날짜 (YYYY-MM-DD)
 * @returns {string[]} 날짜 배열
 */
export function getDatesBetween(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current < end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}