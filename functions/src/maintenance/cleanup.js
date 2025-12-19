// functions/src/maintenance/cleanup.js
import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * 오래된 처리 완료 이벤트 정리
 * 매일 새벽 3시에 실행되어 30일 이상 된 처리 완료 이벤트를 삭제
 */
export const cleanupOldEvents = functions.pubsub
    .schedule('0 3 * * *') // 매일 새벽 3시
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        console.log('Starting cleanup of old inventory events...');
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        try {
            // 30일 이상 된 처리 완료 이벤트 조회
            const oldEventsQuery = db.collection('inventory_events')
                .where('processed', '==', true)
                .where('timestamp', '<', thirtyDaysAgo)
                .limit(500); // 한 번에 최대 500개씩 처리
            
            const oldEvents = await oldEventsQuery.get();
            
            if (oldEvents.empty) {
                console.log('No old events to clean up');
                return;
            }
            
            console.log(`Found ${oldEvents.size} old events to delete`);
            
            // 배치로 삭제
            const batch = db.batch();
            let deleteCount = 0;
            
            oldEvents.forEach(doc => {
                batch.delete(doc.ref);
                deleteCount++;
                
                // Firestore 배치는 최대 500개까지
                if (deleteCount % 500 === 0) {
                    batch.commit();
                    batch = db.batch();
                }
            });
            
            // 남은 배치 커밋
            if (deleteCount % 500 !== 0) {
                await batch.commit();
            }
            
            console.log(`Successfully deleted ${deleteCount} old events`);
            
            // 통계 기록 (선택사항)
            await db.collection('maintenance_logs').add({
                type: 'inventory_events_cleanup',
                deletedCount: deleteCount,
                executedAt: new Date().toISOString(), // UTC ISO 8601
                success: true
            });
            
        } catch (error) {
            console.error('Error during cleanup:', error);
            
            // 에러 로그 기록
            await db.collection('maintenance_logs').add({
                type: 'inventory_events_cleanup',
                error: error.message,
                executedAt: new Date().toISOString(), // UTC ISO 8601
                success: false
            });
        }
    });

/**
 * 오래된 재고 요약본 정리
 * 90일 이상 지난 과거 데이터 삭제
 */
export const cleanupOldInventory = functions.pubsub
    .schedule('0 4 * * 1') // 매주 월요일 새벽 4시
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        console.log('Starting cleanup of old inventory summaries...');
        
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];
        
        try {
            const oldInventoryQuery = db.collection('daily_inventory')
                .where('inventoryDate', '<', cutoffDate)
                .limit(500);
            
            const oldInventory = await oldInventoryQuery.get();
            
            if (oldInventory.empty) {
                console.log('No old inventory summaries to clean up');
                return;
            }
            
            console.log(`Found ${oldInventory.size} old inventory summaries to delete`);
            
            const batch = db.batch();
            oldInventory.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            
            console.log(`Successfully deleted ${oldInventory.size} old inventory summaries`);
            
        } catch (error) {
            console.error('Error during inventory cleanup:', error);
        }
    });