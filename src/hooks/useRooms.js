// src/hooks/useRooms.js
import useFirebaseStore from '../stores/useFirebaseStore';
import useReservationStore from '../stores/useReservationStore';

// 객실 데이터 훅
export const useRooms = () => {
    const rooms = useFirebaseStore((state) => state.rooms);
    const loading = useFirebaseStore((state) => state.loading.rooms);
    const error = useFirebaseStore((state) => state.errors.rooms);
    
    return {
        data: rooms,
        isLoading: loading,
        error: error,
        isError: !!error
    };
};

// 특정 객실 찾기 훅
export const useRoom = (roomId) => {
    const rooms = useFirebaseStore((state) => state.rooms);
    const room = rooms.find(r => r.id === roomId);
    
    return {
        data: room,
        isLoading: !room && rooms.length === 0,
        error: !room && rooms.length > 0 ? '객실을 찾을 수 없습니다.' : null,
        isError: !room && rooms.length > 0
    };
};

// 객실별 현재 재고 훅
export const useRoomInventory = (roomName, date) => {
    const getAvailableStock = useReservationStore((state) => state.getAvailableStock);
    const stock = getAvailableStock(date || new Date().toISOString().split('T')[0], roomName);
    
    return {
        availableStock: stock,
        isAvailable: stock > 0
    };
};
