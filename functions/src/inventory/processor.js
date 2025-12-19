// functions/src/inventory/processor.js
import * as functions from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { InventoryEventTypes } from './events.js';

const db = getFirestore();

/**
 * 재고 이벤트 처리기
 * 이벤트를 받아서 daily_inventory 컬렉션을 업데이트합니다.
 */
export const processInventoryEvents = functions.firestore
    .document('inventory_events/{eventId}')
    .onCreate(async (snapshot, context) => {
        const event = snapshot.data();
        
        // 이미 처리된 이벤트는 무시
        if (event.processed) {
            console.log(`Event ${context.params.eventId} already processed`);
            return;
        }
        
        const dailyInventoryId = `${event.payload.date}_${event.payload.roomName}`;
        const dailyInventoryRef = db.collection('daily_inventory').doc(dailyInventoryId);
        
        console.log(`Processing inventory event: ${event.type} for ${dailyInventoryId}`);
        
        try {
            await db.runTransaction(async (transaction) => {
                const dailyDoc = await transaction.get(dailyInventoryRef);
                
                let currentData;
                if (!dailyDoc.exists) {
                    // 초기 데이터 생성 - 객실 정보 조회
                    const roomsSnapshot = await transaction.get(
                        db.collection('rooms')
                            .where('객실명', '==', event.payload.roomName)
                            .limit(1)
                    );
                    
                    if (roomsSnapshot.empty) {
                        throw new Error(`Room not found: ${event.payload.roomName}`);
                    }
                    
                    const room = roomsSnapshot.docs[0].data();
                    
                    currentData = {
                        inventoryDate: event.payload.date,
                        roomName: event.payload.roomName,
                        totalRooms: room.재고 || 0,
                        bookedRooms: 0,
                        availableRooms: room.재고 || 0,
                        overrideStock: null,
                        lastUpdatedAt: new Date().toISOString(), // UTC ISO 8601
                        version: 0
                    };
                } else {
                    currentData = dailyDoc.data();
                }
                
                // 이벤트 타입에 따라 처리
                switch (event.type) {
                    case InventoryEventTypes.ROOM_BOOKED:
                    case InventoryEventTypes.ROOM_BLOCKED:
                        currentData.bookedRooms += event.payload.quantity || 1;
                        // Override가 없는 경우에만 availableRooms 재계산
                        if (currentData.overrideStock === null) {
                            currentData.availableRooms = Math.max(0, 
                                currentData.totalRooms - currentData.bookedRooms
                            );
                        }
                        break;
                        
                    case InventoryEventTypes.ROOM_CANCELLED:
                    case InventoryEventTypes.ROOM_UNBLOCKED:
                        currentData.bookedRooms = Math.max(0, 
                            currentData.bookedRooms - (event.payload.quantity || 1)
                        );
                        // Override가 없는 경우에만 availableRooms 재계산
                        if (currentData.overrideStock === null) {
                            currentData.availableRooms = currentData.totalRooms - currentData.bookedRooms;
                        }
                        break;
                        
                    case InventoryEventTypes.OVERRIDE_SET:
                        currentData.overrideStock = event.payload.available;
                        currentData.availableRooms = event.payload.available;
                        break;
                        
                    case InventoryEventTypes.OVERRIDE_REMOVED:
                        currentData.overrideStock = null;
                        // Override 제거 시 실제 재고로 재계산
                        currentData.availableRooms = Math.max(0,
                            currentData.totalRooms - currentData.bookedRooms
                        );
                        break;
                        
                    default:
                        console.warn(`Unknown event type: ${event.type}`);
                        return;
                }
                
                // 버전 증가 및 타임스탬프 업데이트
                currentData.version = (currentData.version || 0) + 1;
                currentData.lastUpdatedAt = new Date().toISOString(); // UTC ISO 8601
                
                // 재고 요약본 업데이트
                transaction.set(dailyInventoryRef, currentData);
                
                // 이벤트를 처리됨으로 표시
                transaction.update(snapshot.ref, {
                    processed: true,
                    processedAt: FieldValue.serverTimestamp()
                });
                
                console.log(`Successfully updated inventory: ${dailyInventoryId}`, {
                    availableRooms: currentData.availableRooms,
                    bookedRooms: currentData.bookedRooms,
                    overrideStock: currentData.overrideStock
                });
            });
            
        } catch (error) {
            console.error('Error processing inventory event:', error);
            
            // 재시도 카운트 증가
            await snapshot.ref.update({
                processingAttempts: FieldValue.increment(1),
                lastError: error.message,
                lastErrorAt: FieldValue.serverTimestamp()
            });
            
            // 재시도 횟수가 3회를 초과하면 DLQ로 이동 (추후 구현)
            if ((event.processingAttempts || 0) >= 3) {
                console.error(`Event ${context.params.eventId} failed after 3 attempts`);
                // TODO: Dead Letter Queue 처리
            }
        }
    });

/**
 * 배치 처리기 - 여러 이벤트를 한번에 처리 (선택사항)
 */
export const batchProcessInventoryEvents = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
        const unprocessedEvents = await db.collection('inventory_events')
            .where('processed', '==', false)
            .where('processingAttempts', '<', 3)
            .orderBy('timestamp')
            .limit(100)
            .get();
        
        if (unprocessedEvents.empty) {
            console.log('No unprocessed events found');
            return;
        }
        
        console.log(`Found ${unprocessedEvents.size} unprocessed events`);
        
        // 날짜/객실별로 이벤트 그룹화
        const eventGroups = {};
        unprocessedEvents.forEach(doc => {
            const event = { id: doc.id, ...doc.data() };
            const key = `${event.payload.date}_${event.payload.roomName}`;
            if (!eventGroups[key]) eventGroups[key] = [];
            eventGroups[key].push(event);
        });
        
        // 그룹별로 배치 처리
        const promises = Object.entries(eventGroups).map(([key, events]) => 
            processEventGroup(key, events).catch(err => 
                console.error(`Failed to process group ${key}:`, err)
            )
        );
        
        await Promise.all(promises);
        
        console.log('Batch processing completed');
    });

/**
 * 이벤트 그룹 처리 헬퍼
 */
async function processEventGroup(inventoryKey, events) {
    // 동일한 날짜/객실의 이벤트들을 한번에 처리
    // 구현 생략 (개별 처리와 유사)
    console.log(`Processing group ${inventoryKey} with ${events.length} events`);
}