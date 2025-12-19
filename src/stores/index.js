// src/stores/index.js
// 스토어 통합 export

export { default as useFirebaseStore } from './useFirebaseStore';
export { default as useReservationStore } from './useReservationStore';

// 편의를 위한 선택자들
export const useRooms = () => useFirebaseStore((state) => state.rooms);
export const useReservations = () => useFirebaseStore((state) => state.reservations);
export const useOverrides = () => useFirebaseStore((state) => state.overrides);
export const useIsLoading = () => useFirebaseStore((state) => state.isLoading());
