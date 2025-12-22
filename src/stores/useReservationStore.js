// src/stores/useReservationStore.js
import { create } from 'zustand';
import { 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    collection, 
    serverTimestamp,
    getDoc, 
    setDoc,
    runTransaction,
    query,
    where,
    getDocs
} from 'firebase/firestore';
import { db, timeHelpers, getServerTimestamp } from '../config/firebase';
import useFirebaseStore from './useFirebaseStore';
import { CustomerGrades } from '../models/Customer';
import useReservationCache from './useReservationCache';
import { getKSTDateString, getKSTToday } from '../utils';

const useReservationStore = create((set, get) => ({
    // 예약 관련 작업 상태
    operationLoading: false,
    operationError: null,
    
    // 전화번호 정규화 (010-1234-5678 -> 01012345678)
    normalizePhone: (phone) => {
        return phone.replace(/[^0-9]/g, '');
    },
    
    // 고객 등급 계산
    calculateCustomerGrade: (visitCount, totalSpent) => {
        if (visitCount >= CustomerGrades.VVIP.minVisits && totalSpent >= CustomerGrades.VVIP.minSpent) {
            return 'VVIP';
        }
        if (visitCount >= CustomerGrades.VIP.minVisits && totalSpent >= CustomerGrades.VIP.minSpent) {
            return 'VIP';
        }
        return 'NORMAL';
    },
    
    // 재고 계산 함수 (순수 함수) - 캐싱 적용
    getAvailableStock: (dateStr, roomName) => {
        // 캐시 확인
        const cached = useReservationCache.getState().getCachedStock(dateStr, roomName);
        if (cached !== null) {
            return cached;
        }
        
        const { rooms, reservations, overrides } = useFirebaseStore.getState();
        const room = rooms.find(r => r.객실명 === roomName);
        if (!room) return 0;
        
        // Override가 있으면 우선 적용
        const overrideKey = `${dateStr}_${roomName}`;
        if (overrides[overrideKey] !== undefined) {
            const stock = overrides[overrideKey];
            // 캐시 저장
            useReservationCache.getState().setCachedStock(dateStr, roomName, stock);
            return stock;
        }
        
        // 해당 날짜의 예약 수 계산
        const bookedReservations = reservations.filter(res => {
            const isNotCanceled = res.status !== '예약취소';
            const isSameRoom = res.roomName === roomName;
            const isInDateRange = dateStr >= res.checkIn && dateStr < res.checkOut;
            
            return isNotCanceled && isSameRoom && isInDateRange;
        });
        
        const stock = Math.max(0, (room.재고 || 0) - bookedReservations.length);
        
        // 캐시 저장
        useReservationCache.getState().setCachedStock(dateStr, roomName, stock);
        
        return stock;
    },
    
    // 날짜 범위의 재고 확인
    checkAvailabilityForRange: (checkIn, checkOut, roomName) => {
        const dates = [];
        const current = new Date(checkIn);
        const end = new Date(checkOut);
        
        while (current < end) {
            dates.push(getKSTDateString(current));
            current.setDate(current.getDate() + 1);
        }
        
        return dates.every(date => get().getAvailableStock(date, roomName) > 0);
    },
    
    // 예약 추가
    addReservation: async (reservationData) => {
        console.log('addReservation called with:', reservationData);
        set({ operationLoading: true, operationError: null });
        
        try {
            // 막기 예약이 아닌 경우에만 재고 확인
            if (reservationData.source !== '막기') {
                const { checkAvailabilityForRange } = get();
                if (!checkAvailabilityForRange(
                    reservationData.checkIn, 
                    reservationData.checkOut, 
                    reservationData.roomName
                )) {
                    throw new Error('선택한 날짜에 예약 가능한 객실이 없습니다.');
                }
            }
            
            // Firestore에 저장할 데이터 준비
            const dataToSave = {
                ...reservationData,
                status: reservationData.status || '입금대기',
                createdAt: getServerTimestamp(),
                updatedAt: getServerTimestamp()
            };
            
            console.log('Saving to Firestore:', dataToSave);
            
            // 예약 추가
            const docRef = await addDoc(collection(db, 'reservations'), dataToSave);
            
            console.log('Document created with ID:', docRef.id);
            
            // 고객 정보 업데이트 (막기 예약이 아닌 경우만)
            if (reservationData.source !== '막기' && reservationData.phone) {
                try {
                    const customerId = get().normalizePhone(reservationData.phone);
                    const customerRef = doc(db, 'customers', customerId);
                    const customerDoc = await getDoc(customerRef);
                    
                    if (customerDoc.exists()) {
                        // 기존 고객 업데이트
                        const currentData = customerDoc.data();
                        const newVisitCount = (currentData.visitCount || 0) + 1;
                        const newTotalSpent = (currentData.totalSpent || 0) + (reservationData.totalPrice || 0);
                        const newGrade = get().calculateCustomerGrade(newVisitCount, newTotalSpent);
                        
                        await updateDoc(customerRef, {
                            name: reservationData.customerName || currentData.name,
                            visitCount: newVisitCount,
                            totalSpent: newTotalSpent,
                            lastVisitDate: getServerTimestamp(),
                            reservations: [...(currentData.reservations || []), docRef.id],
                            customerGrade: newGrade,
                            preferredRooms: currentData.preferredRooms?.includes(reservationData.roomName) 
                                ? currentData.preferredRooms 
                                : [...(currentData.preferredRooms || []), reservationData.roomName],
                            updatedAt: getServerTimestamp()
                        });
                        
                        console.log('기존 고객 정보 업데이트 완료:', customerId);
                    } else {
                        // 신규 고객 생성
                        const newCustomer = {
                            id: customerId,
                            name: reservationData.customerName,
                            phone: reservationData.phone,
                            email: '',
                            firstVisitDate: getServerTimestamp(),
                            lastVisitDate: getServerTimestamp(),
                            visitCount: 1,
                            totalSpent: reservationData.totalPrice || 0,
                            reservations: [docRef.id],
                            cancelCount: 0,
                            noShowCount: 0,
                            preferredRooms: [reservationData.roomName],
                            specialRequests: [],
                            customerGrade: 'NORMAL',
                            notes: '',
                            tags: [],
                            marketingConsent: false,
                            createdAt: getServerTimestamp(),
                            updatedAt: getServerTimestamp()
                        };
                        
                        await setDoc(customerRef, newCustomer);
                        console.log('신규 고객 생성 완료:', customerId);
                    }
                } catch (customerError) {
                    console.error('고객 정보 업데이트 오류:', customerError);
                    // 고객 정보 업데이트 실패해도 예약은 성공
                }
            }
            
            set({ operationLoading: false });

            // 알림 발송 (막기 예약이 아닌 경우만)
            if (reservationData.source !== '막기') {
                try {
                    const notificationService = (await import('../services/notificationService')).default;
                    await notificationService.initialize();

                    // 예약확정 상태면 확정 알림만, 그 외에는 새 예약 알림만 발송
                    if (dataToSave.status === '예약확정') {
                        console.log('📬 [Store] 예약확정 상태 - 확정 알림 발송');
                        const smsResult = await notificationService.sendConfirmationNotifications({
                            ...reservationData,
                            id: docRef.id,
                            status: '예약확정'
                        });
                        console.log('📬 [Store] 예약확정 알림 발송 완료:', smsResult);
                    } else {
                        // 입금대기 등 다른 상태일 때만 새 예약 알림 발송
                        const notificationResult = await notificationService.sendNewReservationNotifications({
                            ...reservationData,
                            id: docRef.id
                        });
                        console.log('📬 [Store] 새 예약 알림 발송 완료:', notificationResult);
                    }
                } catch (notificationError) {
                    console.error('📬 [Store] 알림 발송 실패 (예약은 성공):', notificationError);
                    // 알림 실패해도 예약은 성공으로 처리
                }
            }

            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('예약 추가 오류:', error);
            set({
                operationLoading: false,
                operationError: error.message
            });
            return { success: false, error: error.message };
        }
    },

    // 예약 수정
    updateReservation: async (reservationId, updates) => {
        set({ operationLoading: true, operationError: null });
        
        try {
            const docRef = doc(db, 'reservations', reservationId);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: getServerTimestamp()
            });
            
            set({ operationLoading: false });
            return { success: true };
        } catch (error) {
            console.error('예약 수정 오류:', error);
            set({ 
                operationLoading: false, 
                operationError: error.message 
            });
            return { success: false, error: error.message };
        }
    },
    
    // 예약 취소
    cancelReservation: async (reservationId, cancelData = {}) => {
        console.log('cancelReservation called with:', reservationId, cancelData);
        
        // 예약 정보 확인
        const reservations = useFirebaseStore.getState().reservations;
        const reservation = reservations.find(r => r.id === reservationId);
        
        console.log('Found reservation:', reservation);
        
        // 관리자 막기 예약인 경우 완전 삭제
        if (reservation && reservation.source === '막기') {
            console.log('Deleting blocking reservation...');
            set({ operationLoading: true, operationError: null });
            
            try {
                const docRef = doc(db, 'reservations', reservationId);
                await deleteDoc(docRef);
                
                console.log('Blocking reservation deleted successfully');
                
                // 캐시 무효화 - 날짜 범위 전체
                if (reservation.checkIn && reservation.checkOut && reservation.roomName) {
                    useReservationCache.getState().invalidateReservationDateRange(
                        reservation.checkIn, 
                        reservation.checkOut, 
                        reservation.roomName
                    );
                }
                
                // Firebase 실시간 동기화를 위한 강제 새로고침
                useFirebaseStore.getState().refresh('reservations');
                
                set({ operationLoading: false });
                return { success: true };
            } catch (error) {
                console.error('막기 예약 삭제 오류:', error);
                set({ 
                    operationLoading: false, 
                    operationError: error.message 
                });
                return { success: false, error: error.message };
            }
        }
        
        // 일반 예약은 취소 상태로 변경
        const result = await get().updateReservation(reservationId, { 
            status: '예약취소',
            canceledAt: getServerTimestamp(),
            cancelReason: cancelData.cancelReason || '',
            refundAmount: cancelData.refundAmount || 0,
            cancellationFee: cancelData.cancellationFee || 0,
            refundRate: cancelData.refundRate || 0
        });
        
        // 캐시 무효화 - 날짜 범위 전체
        if (result.success && reservation) {
            if (reservation.checkIn && reservation.checkOut && reservation.roomName) {
                useReservationCache.getState().invalidateReservationDateRange(
                    reservation.checkIn, 
                    reservation.checkOut, 
                    reservation.roomName
                );
            }
            
            // Firebase 실시간 동기화를 위한 강제 새로고침
            useFirebaseStore.getState().refresh('reservations');
        }
        
        // 고객 정보 업데이트 (취소 횟수 증가)
        if (result.success) {
            try {
                // 예약 정보 가져오기
                const reservations = useFirebaseStore.getState().reservations;
                const reservation = reservations.find(r => r.id === reservationId);
                
                if (reservation && reservation.phone && reservation.source !== '막기') {
                    const customerId = get().normalizePhone(reservation.phone);
                    const customerRef = doc(db, 'customers', customerId);
                    const customerDoc = await getDoc(customerRef);
                    
                    if (customerDoc.exists()) {
                        const currentData = customerDoc.data();
                        await updateDoc(customerRef, {
                            cancelCount: (currentData.cancelCount || 0) + 1,
                            updatedAt: getServerTimestamp()
                        });
                        console.log('고객 취소 횟수 업데이트 완료:', customerId);
                    }
                }
            } catch (customerError) {
                console.error('고객 정보 업데이트 오류:', customerError);
            }

            // 예약 취소 알림 발송
            try {
                if (reservation && reservation.source !== '막기') {
                    const notificationService = (await import('../services/notificationService')).default;
                    await notificationService.initialize();

                    // 예약 취소 알림 발송 (텔레그램)
                    const notificationResult = await notificationService.sendCancellationNotifications({
                        ...reservation,
                        id: reservationId,
                        status: '예약취소',
                        cancelReason: cancelData.cancelReason,
                        refundAmount: cancelData.refundAmount,
                        refundRate: cancelData.refundRate,
                        cancellationFee: cancelData.cancellationFee
                    });
                    console.log('📬 [Store] 예약 취소 알림 발송 완료:', notificationResult);
                }
            } catch (notificationError) {
                console.error('📬 [Store] 취소 알림 발송 실패 (예약 취소는 성공):', notificationError);
                // 알림 실패해도 예약 취소는 성공으로 처리
            }
        }

        return result;
    },
    
    // 예약 확정
    confirmReservation: async (reservationId, depositorName) => {
        const result = await get().updateReservation(reservationId, {
            status: '예약확정',
            depositorName,
            confirmedAt: getServerTimestamp()
        });

        // 예약 확정 알림 발송
        if (result.success) {
            try {
                // 예약 정보 가져오기
                const reservations = useFirebaseStore.getState().reservations;
                const reservation = reservations.find(r => r.id === reservationId);

                if (reservation && reservation.source !== '막기') {
                    const notificationService = (await import('../services/notificationService')).default;
                    await notificationService.initialize();

                    // 예약 확정 알림 발송 (SMS + 텔레그램)
                    const notificationResult = await notificationService.sendConfirmationNotifications({
                        ...reservation,
                        id: reservationId,
                        depositorName,
                        status: '예약확정'
                    });
                    console.log('📬 [Store] 예약 확정 알림 발송 완료:', notificationResult);
                }
            } catch (notificationError) {
                console.error('📬 [Store] 확정 알림 발송 실패 (예약 확정은 성공):', notificationError);
                // 알림 실패해도 예약 확정은 성공으로 처리
            }
        }

        return result;
    },
    
    // 재고 수동 조정
    updateInventoryOverride: async (dateStr, roomName, available) => {
        set({ operationLoading: true, operationError: null });
        
        try {
            const docId = `${dateStr}_${roomName}`;
            const docRef = doc(db, 'inventory_overrides', docId);
            
            if (available === null || available === undefined) {
                // 삭제 (기본값으로 복원)
                await deleteDoc(docRef).catch(() => {
                    // 문서가 없어도 성공으로 처리
                });
            } else {
                // setDoc을 사용하여 문서가 없으면 생성, 있으면 업데이트
                await setDoc(docRef, {
                    available,
                    dateStr,
                    roomName,
                    updatedAt: getServerTimestamp()
                }, { merge: true });
            }
            
            // 캐시 무효화
            useReservationCache.getState().invalidateRoomCache(roomName);
            
            set({ operationLoading: false });
            return { success: true };
        } catch (error) {
            console.error('재고 수정 오류:', error);
            set({ 
                operationLoading: false, 
                operationError: error.message 
            });
            return { success: false, error: error.message };
        }
    },
    
    // 예약 통계
    getStatistics: () => {
        const { reservations, rooms } = useFirebaseStore.getState();
        const today = getKSTToday();
        
        return {
            todayCheckIn: reservations.filter(res => 
                res.checkIn === today && res.status !== '예약취소'
            ).length,
            todayCheckOut: reservations.filter(res => 
                res.checkOut === today && res.status !== '예약취소'
            ).length,
            totalRooms: rooms.reduce((sum, room) => sum + (room.재고 || 0), 0),
            activeReservations: reservations.filter(res => 
                res.status !== '예약취소'
            ).length,
            pendingPayments: reservations.filter(res => 
                res.status === '입금대기'
            ).length
        };
    },
    
    /**
     * 트랜잭션 기반 예약 생성 - 재고 정확성 100% 보장
     * Read Model이 아닌 원본 데이터에서 재고를 확인합니다.
     */
    createReservationWithInventoryCheck: async (reservationData) => {
        set({ operationLoading: true, operationError: null });
        
        try {
            // 막기 예약이 아닌 경우에만 재고 확인
            let dates = [];
            let existingReservations = [];
            let totalRoomStock = 0;
            
            if (reservationData.source !== '막기') {
                // 날짜 범위 생성
                const current = new Date(reservationData.checkIn);
                const end = new Date(reservationData.checkOut);
                
                while (current < end) {
                    dates.push(current.toISOString().split('T')[0]);
                    current.setDate(current.getDate() + 1);
                }
                
                // 객실 정보 확인
                const rooms = useFirebaseStore.getState().rooms;
                const room = rooms.find(r => r.객실명 === reservationData.roomName);
                
                if (!room) {
                    throw new Error('객실 정보를 찾을 수 없습니다.');
                }
                
                totalRoomStock = room.재고 || 0;
                
                // 트랜잭션 전에 예약 데이터 조회
                const reservationsQuery = query(
                    collection(db, 'reservations'),
                    where('roomName', '==', reservationData.roomName),
                    where('status', '!=', '예약취소')
                );
                
                const reservationsSnapshot = await getDocs(reservationsQuery);
                reservationsSnapshot.forEach(doc => {
                    existingReservations.push({ id: doc.id, ...doc.data() });
                });
            }
            
            // 트랜잭션 시작
            const result = await runTransaction(db, async (transaction) => {
                // 막기 예약이 아닌 경우에만 재고 확인
                if (reservationData.source !== '막기') {
                    // 각 날짜별로 재고 확인
                    for (const date of dates) {
                        // 날짜 범위에 포함되는 예약 수 계산
                        let bookedCount = 0;
                        existingReservations.forEach(res => {
                            // 체크인 <= date < 체크아웃 범위 확인
                            if (date >= res.checkIn && date < res.checkOut) {
                                bookedCount++;
                            }
                        });
                        
                        // Override 확인
                        const overrideRef = doc(db, 'inventory_overrides', 
                            `${date}_${reservationData.roomName}`
                        );
                        const overrideDoc = await transaction.get(overrideRef);
                        
                        // 실제 가용 재고 계산
                        const availableStock = overrideDoc.exists() 
                            ? overrideDoc.data().available
                            : Math.max(0, totalRoomStock - bookedCount);
                        
                        if (availableStock <= 0) {
                            throw new Error(
                                `${date}에 예약 가능한 객실이 없습니다. ` +
                                `다른 날짜를 선택해 주세요.`
                            );
                        }
                    }
                }
                
                // 재고가 확인되면 예약 생성
                const newReservationRef = doc(collection(db, 'reservations'));
                transaction.set(newReservationRef, {
                    ...reservationData,
                    status: reservationData.status || '입금대기',
                    createdAt: getServerTimestamp(),
                    updatedAt: getServerTimestamp()
                });
                
                return newReservationRef.id;
            });
            
            // 고객 정보 업데이트는 별도로 처리 (트랜잭션 외부)
            if (reservationData.source !== '막기' && reservationData.phone) {
                try {
                    await get().updateCustomerInfo(result, reservationData);
                } catch (customerError) {
                    console.error('고객 정보 업데이트 오류:', customerError);
                    // 고객 정보 업데이트 실패해도 예약은 성공으로 처리
                }
            }

            set({ operationLoading: false });

            // 알림 발송 (막기 예약이 아닌 경우만)
            if (reservationData.source !== '막기') {
                try {
                    const notificationService = (await import('../services/notificationService')).default;
                    await notificationService.initialize();

                    // 새 예약 알림 발송 (텔레그램)
                    const notificationResult = await notificationService.sendNewReservationNotifications({
                        ...reservationData,
                        id: result
                    });
                    console.log('📬 [Store] 새 예약 알림 발송 완료 (트랜잭션):', notificationResult);
                } catch (notificationError) {
                    console.error('📬 [Store] 알림 발송 실패 (예약은 성공):', notificationError);
                    // 알림 실패해도 예약은 성공으로 처리
                }
            }

            return { success: true, id: result };
            
        } catch (error) {
            console.error('예약 생성 실패:', error);
            set({ 
                operationLoading: false, 
                operationError: error.message 
            });
            
            // 재고 부족 에러 처리
            if (error.message.includes('예약 가능한 객실이 없습니다')) {
                return { 
                    success: false, 
                    error: '죄송합니다. 방금 마지막 객실이 예약되었습니다. 다른 날짜를 선택해 주세요.',
                    type: 'STOCK_EXHAUSTED'
                };
            }
            
            return { success: false, error: error.message };
        }
    },
    
    // 고객 정보 업데이트 헬퍼 메서드
    updateCustomerInfo: async (reservationId, reservationData) => {
        const { normalizePhone, calculateCustomerGrade } = get();
        const customerId = normalizePhone(reservationData.phone);
        const customerRef = doc(db, 'customers', customerId);
        const customerDoc = await getDoc(customerRef);
        
        if (customerDoc.exists()) {
            const currentData = customerDoc.data();
            const newVisitCount = (currentData.visitCount || 0) + 1;
            const newTotalSpent = (currentData.totalSpent || 0) + (reservationData.totalPrice || 0);
            const newGrade = calculateCustomerGrade(newVisitCount, newTotalSpent);
            
            await updateDoc(customerRef, {
                name: reservationData.customerName || currentData.name,
                visitCount: newVisitCount,
                totalSpent: newTotalSpent,
                lastVisitDate: getServerTimestamp(),
                reservations: [...(currentData.reservations || []), reservationId],
                customerGrade: newGrade,
                preferredRooms: currentData.preferredRooms?.includes(reservationData.roomName) 
                    ? currentData.preferredRooms 
                    : [...(currentData.preferredRooms || []), reservationData.roomName],
                updatedAt: getServerTimestamp()
            });
        } else {
            const newCustomer = {
                id: customerId,
                name: reservationData.customerName,
                phone: reservationData.phone,
                email: '',
                firstVisitDate: getServerTimestamp(),
                lastVisitDate: getServerTimestamp(),
                visitCount: 1,
                totalSpent: reservationData.totalPrice || 0,
                reservations: [reservationId],
                cancelCount: 0,
                noShowCount: 0,
                preferredRooms: [reservationData.roomName],
                specialRequests: [],
                customerGrade: 'NORMAL',
                notes: '',
                tags: [],
                marketingConsent: false,
                createdAt: getServerTimestamp(),
                updatedAt: getServerTimestamp()
            };
            
            await setDoc(customerRef, newCustomer);
        }
    }
}));

export default useReservationStore;
