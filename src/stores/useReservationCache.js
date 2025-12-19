// useReservationCache.js
import { create } from 'zustand';

const useReservationCache = create((set, get) => ({
    // 재고 캐시 (키: "날짜_객실명", 값: 재고수)
    stockCache: new Map(),
    
    // 캐시 만료 시간 (5분)
    CACHE_TTL: 5 * 60 * 1000,
    
    // 캐시 데이터 구조: { value: number, timestamp: number }
    
    // 캐시 조회
    getCachedStock: (dateStr, roomName) => {
        const key = `${dateStr}_${roomName}`;
        const cached = get().stockCache.get(key);
        
        if (!cached) return null;
        
        // 캐시 만료 확인
        const now = Date.now();
        if (now - cached.timestamp > get().CACHE_TTL) {
            // 만료된 캐시 삭제
            get().removeCachedStock(key);
            return null;
        }
        
        return cached.value;
    },
    
    // 캐시 저장
    setCachedStock: (dateStr, roomName, stock) => {
        const key = `${dateStr}_${roomName}`;
        set((state) => {
            const newCache = new Map(state.stockCache);
            newCache.set(key, {
                value: stock,
                timestamp: Date.now()
            });
            return { stockCache: newCache };
        });
    },
    
    // 캐시 삭제
    removeCachedStock: (key) => {
        set((state) => {
            const newCache = new Map(state.stockCache);
            newCache.delete(key);
            return { stockCache: newCache };
        });
    },
    
    // 특정 날짜의 모든 캐시 무효화
    invalidateDateCache: (dateStr) => {
        set((state) => {
            const newCache = new Map(state.stockCache);
            // 해당 날짜를 포함하는 모든 키 삭제
            for (const key of newCache.keys()) {
                if (key.startsWith(dateStr)) {
                    newCache.delete(key);
                }
            }
            return { stockCache: newCache };
        });
    },
    
    // 특정 객실의 모든 캐시 무효화
    invalidateRoomCache: (roomName) => {
        set((state) => {
            const newCache = new Map(state.stockCache);
            // 해당 객실을 포함하는 모든 키 삭제
            for (const key of newCache.keys()) {
                if (key.endsWith(roomName)) {
                    newCache.delete(key);
                }
            }
            return { stockCache: newCache };
        });
    },
    
    // 전체 캐시 무효화
    invalidateAllCache: () => {
        set({ stockCache: new Map() });
    },
    
    // 예약 변경 시 관련 날짜 범위의 캐시 무효화
    invalidateReservationDateRange: (checkIn, checkOut, roomName) => {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        
        set((state) => {
            const newCache = new Map(state.stockCache);
            
            while (start < end) {
                const dateStr = start.toISOString().split('T')[0];
                const key = `${dateStr}_${roomName}`;
                newCache.delete(key);
                start.setDate(start.getDate() + 1);
            }
            
            return { stockCache: newCache };
        });
    }
}));

export default useReservationCache;
