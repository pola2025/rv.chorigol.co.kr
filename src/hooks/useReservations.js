// src/hooks/useReservations.js
import useFirebaseStore from '../stores/useFirebaseStore';
import useReservationStore from '../stores/useReservationStore';

// Firebase 실시간 동기화와 React Query 패턴을 결합
export const useReservations = () => {
    const reservations = useFirebaseStore((state) => state.reservations);
    const loading = useFirebaseStore((state) => state.loading.reservations);
    const error = useFirebaseStore((state) => state.errors.reservations);
    
    return {
        data: reservations,
        isLoading: loading,
        error: error,
        isError: !!error
    };
};

// 예약 추가 훅
export const useAddReservation = () => {
    const addReservation = useReservationStore((state) => state.addReservation);
    const operationLoading = useReservationStore((state) => state.operationLoading);
    const operationError = useReservationStore((state) => state.operationError);
    
    return {
        mutate: async (data) => {
            console.log('useAddReservation mutate called with:', data);
            const result = await addReservation(data);
            console.log('useAddReservation result:', result);
            return result;
        },
        mutateAsync: async (data) => {
            console.log('useAddReservation mutateAsync called with:', data);
            const result = await addReservation(data);
            console.log('useAddReservation result:', result);
            return result;
        },
        isLoading: operationLoading,
        error: operationError,
        isError: !!operationError
    };
};

// 예약 수정 훅
export const useUpdateReservation = () => {
    const updateReservation = useReservationStore((state) => state.updateReservation);
    const operationLoading = useReservationStore((state) => state.operationLoading);
    const operationError = useReservationStore((state) => state.operationError);
    
    return {
        mutate: (id, data) => updateReservation(id, data),
        mutateAsync: (id, data) => updateReservation(id, data),
        isLoading: operationLoading,
        error: operationError,
        isError: !!operationError
    };
};

// 예약 취소 훅
export const useCancelReservation = () => {
    const cancelReservation = useReservationStore((state) => state.cancelReservation);
    const operationLoading = useReservationStore((state) => state.operationLoading);
    const operationError = useReservationStore((state) => state.operationError);
    
    return {
        mutate: async (reservationId, cancelData) => {
            console.log('useCancelReservation mutate called:', reservationId, cancelData);
            const result = await cancelReservation(reservationId, cancelData);
            console.log('useCancelReservation result:', result);
            return result;
        },
        mutateAsync: async (reservationId, cancelData) => {
            console.log('useCancelReservation mutateAsync called:', reservationId, cancelData);
            const result = await cancelReservation(reservationId, cancelData);
            console.log('useCancelReservation result:', result);
            return result;
        },
        isLoading: operationLoading,
        error: operationError,
        isError: !!operationError
    };
};

// 예약 확정 훅
export const useConfirmReservation = () => {
    const confirmReservation = useReservationStore((state) => state.confirmReservation);
    const operationLoading = useReservationStore((state) => state.operationLoading);
    const operationError = useReservationStore((state) => state.operationError);
    
    return {
        mutate: (id, depositorName) => confirmReservation(id, depositorName),
        mutateAsync: (id, depositorName) => confirmReservation(id, depositorName),
        isLoading: operationLoading,
        error: operationError,
        isError: !!operationError
    };
};

// 재고 계산 훅
export const useAvailableStock = () => {
    const getAvailableStock = useReservationStore((state) => state.getAvailableStock);
    const checkAvailabilityForRange = useReservationStore((state) => state.checkAvailabilityForRange);
    
    return {
        getAvailableStock,
        checkAvailabilityForRange
    };
};

// 예약 통계 훅
export const useReservationStatistics = () => {
    const getStatistics = useReservationStore((state) => state.getStatistics);
    return getStatistics();
};
