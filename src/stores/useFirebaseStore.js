// src/stores/useFirebaseStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
    collection, 
    query, 
    onSnapshot, 
    orderBy,
    where,
    Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Firebase 실시간 동기화를 위한 스토어
const useFirebaseStore = create(
    subscribeWithSelector((set, get) => ({
        // 상태
        rooms: [],
        reservations: [],
        overrides: {},
        blockedDates: [],
        pricingRules: [],
        options: [],
        customers: [],
        
        // 로딩 및 에러 상태
        loading: {
            rooms: true,
            reservations: true,
            overrides: true,
            blockedDates: true,
            pricingRules: true,
            options: true,
            customers: true,
        },
        errors: {
            rooms: null,
            reservations: null,
            overrides: null,
            blockedDates: null,
            pricingRules: null,
            options: null,
            customers: null,
        },
        
        // 리스너 관리
        unsubscribers: {},
        isInitialized: false,
        
        // 초기화 함수
        initialize: () => {
            const { isInitialized } = get();
            if (isInitialized) {
                console.log('Already initialized, skipping...');
                return () => {};
            }
            
            console.log('Initializing Firebase listeners...');
            
            // cleanup 함수를 미리 호출하여 기존 리스너 정리
            get().cleanup();
            
            const collections = [
                {
                    name: 'rooms',
                    query: query(collection(db, 'rooms'), orderBy('order', 'asc')),
                    transform: (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() }))
                },
                {
                    name: 'reservations',
                    query: query(collection(db, 'reservations'), orderBy('checkIn', 'desc')),
                    transform: (docs) => docs.map(doc => {
                        const data = doc.data();
                        // Timestamp 객체를 평범한 JavaScript 객체로 변환
                        const transformed = { id: doc.id, ...data };
                        
                        // Timestamp 필드들을 처리
                        if (data.createdAt && data.createdAt.seconds) {
                            transformed.createdAt = {
                                seconds: data.createdAt.seconds,
                                nanoseconds: data.createdAt.nanoseconds
                            };
                        }
                        if (data.updatedAt && data.updatedAt.seconds) {
                            transformed.updatedAt = {
                                seconds: data.updatedAt.seconds,
                                nanoseconds: data.updatedAt.nanoseconds
                            };
                        }
                        
                        return transformed;
                    })
                },
                {
                    name: 'overrides',
                    collectionName: 'inventory_overrides',
                    query: query(collection(db, 'inventory_overrides')),
                    transform: (docs) => {
                        const overrides = {};
                        docs.forEach(doc => {
                            overrides[doc.id] = doc.data().available;
                        });
                        return overrides;
                    }
                },
                {
                    name: 'blockedDates',
                    collectionName: 'blocked_dates',
                    query: query(collection(db, 'blocked_dates')),
                    transform: (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() }))
                },
                {
                    name: 'pricingRules',
                    collectionName: 'pricing_rules',
                    query: query(collection(db, 'pricing_rules')),
                    transform: (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() }))
                },
                {
                    name: 'options',
                    query: query(collection(db, 'options')),
                    transform: (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() }))
                },
                {
                    name: 'customers',
                    query: query(collection(db, 'customers'), orderBy('lastVisitDate', 'desc')),
                    transform: (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() }))
                }
            ];
            
            const newUnsubscribers = {};
            
            collections.forEach(({ name, collectionName, query: collectionQuery, transform }) => {
                // 로딩 상태 설정
                set((state) => ({
                    loading: { ...state.loading, [name]: true }
                }));
                
                // 리스너 설정
                newUnsubscribers[name] = onSnapshot(
                    collectionQuery,
                    (snapshot) => {
                        const data = transform(snapshot.docs);
                        set((state) => ({
                            [name]: data,
                            loading: { ...state.loading, [name]: false },
                            errors: { ...state.errors, [name]: null }
                        }));
                    },
                    (error) => {
                        console.error(`Error fetching ${collectionName || name}:`, error);
                        set((state) => ({
                            loading: { ...state.loading, [name]: false },
                            errors: { ...state.errors, [name]: error.message }
                        }));
                    }
                );
            });
            
            set({ 
                unsubscribers: newUnsubscribers, 
                isInitialized: true 
            });
            
            // cleanup 함수 반환
            return () => {
                console.log('Cleaning up Firebase listeners...');
                Object.values(newUnsubscribers).forEach(unsub => unsub?.());
                set({ 
                    unsubscribers: {}, 
                    isInitialized: false,
                    loading: {
                        rooms: true,
                        reservations: true,
                        overrides: true,
                        blockedDates: true,
                        pricingRules: true,
                        options: true,
                        customers: true,
                    }
                });
            };
        },
        
        // 정리 함수
        cleanup: () => {
            const { unsubscribers } = get();
            Object.values(unsubscribers).forEach(unsub => unsub?.());
            set({ 
                unsubscribers: {}, 
                isInitialized: false,
                loading: {
                    rooms: true,
                    reservations: true,
                    overrides: true,
                    blockedDates: true,
                    pricingRules: true,
                    options: true,
                    customers: true,
                }
            });
        },
        
        // 전체 로딩 상태 확인
        isLoading: () => {
            const { loading } = get();
            return Object.values(loading).some(isLoading => isLoading);
        },
        
        // 특정 컬렉션 새로고침
        refresh: (collectionName) => {
            const { unsubscribers } = get();
            if (unsubscribers[collectionName]) {
                // 기존 리스너 재실행을 트리거하기 위해 
                // 로딩 상태만 변경 (실제로는 Firebase가 자동으로 최신 데이터 전송)
                set((state) => ({
                    loading: { ...state.loading, [collectionName]: true }
                }));
            }
        }
    }))
);

export default useFirebaseStore;
