// src/stores/useFirebaseStore.js
//
// ⚠️ Firebase → D1 이관 (2026-07-16). **스토어 바깥 API 는 한 글자도 바꾸지 않았다.**
//    상태 키(rooms/reservations/overrides/blockedDates/pricingRules/options/customers),
//    loading/errors 모양, initialize()/cleanup()/isLoading()/refresh() 시그니처 모두 동일.
//    → 이 스토어를 읽는 컴포넌트 23개는 수정하지 않는다 (레거시 화면 그대로 이식).
//
// 바뀐 것은 데이터 출처뿐:
//    onSnapshot 리스너 7개  →  GET /api/snapshot 1회 + 30초 heartbeat
//
// 왜 폴링으로 "번역"하지 않았나 (실측):
//    매번 전부 읽으면 1회 954 rows → 1초 폴링 시 68,688,000 rows/일 = 무료한도의 1374%.
//    그런데 이 시스템은 **변경을 만드는 사람이 관리자 본인**이라 물어볼 이유가 거의 없다.
//    로드 1회 + 쓰기 후 refresh() 로 끝나고, 다른 관리자의 변경만 heartbeat 로 잡는다.
//    heartbeat 는 COUNT+MAX(updated_at) 한 줄(1 rows_read) → 2,400 rows/일 = 0.05%.
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const POLL_MS = 30000; // heartbeat 주기 — 다른 관리자의 변경 감지용

const COLLECTIONS = ['rooms', 'reservations', 'overrides', 'blockedDates', 'pricingRules', 'options', 'customers'];
const allLoading = (v) => Object.fromEntries(COLLECTIONS.map((k) => [k, v]));
const allErrors = (v) => Object.fromEntries(COLLECTIONS.map((k) => [k, v]));

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
        loading: allLoading(true),
        errors: allErrors(null),

        // 리스너 관리 (D1: heartbeat 타이머 정리 함수를 담는다 — cleanup() 이 그대로 돈다)
        unsubscribers: {},
        isInitialized: false,
        _version: null,

        // 초기화 함수
        initialize: () => {
            const { isInitialized } = get();
            if (isInitialized) {
                console.log('Already initialized, skipping...');
                return () => {};
            }

            console.log('Initializing D1 snapshot sync...');
            get().cleanup();

            let stopped = false;

            // 전체 스냅샷 적재 — 레거시 onSnapshot 7개가 하던 일을 한 번에
            const loadAll = async () => {
                try {
                    const res = await fetch('/api/snapshot', { credentials: 'same-origin' });
                    if (!res.ok) throw new Error(`snapshot ${res.status}`);
                    const { version, data } = await res.json();
                    if (stopped) return;
                    set({ ...data, _version: version, loading: allLoading(false), errors: allErrors(null) });
                } catch (error) {
                    console.error('Error fetching snapshot:', error);
                    if (stopped) return;
                    set({ loading: allLoading(false), errors: allErrors(error.message) });
                }
            };

            // heartbeat — "바뀐 거 있나?"만 묻고, 달라졌을 때만 전체를 다시 받는다
            const tick = async () => {
                if (stopped || document.hidden) return; // 탭이 숨겨져 있으면 굳이 묻지 않는다
                try {
                    const res = await fetch('/api/version', { credentials: 'same-origin' });
                    if (!res.ok) return;
                    const { version } = await res.json();
                    if (!stopped && version !== get()._version) await loadAll();
                } catch {
                    // heartbeat 실패는 조용히 넘긴다 (다음 주기에 다시 시도)
                }
            };

            loadAll();
            const timer = setInterval(tick, POLL_MS);

            // cleanup() 이 Object.values(unsubscribers).forEach(unsub => unsub?.()) 로 도므로
            // 함수 하나만 넣어두면 레거시 정리 경로가 그대로 동작한다
            const stop = () => { stopped = true; clearInterval(timer); };

            set({
                unsubscribers: { snapshot: stop },
                isInitialized: true
            });

            // cleanup 함수 반환
            return () => {
                console.log('Cleaning up D1 snapshot sync...');
                stop();
                set({
                    unsubscribers: {},
                    isInitialized: false,
                    loading: allLoading(true)
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
                loading: allLoading(true)
            });
        },

        // 전체 로딩 상태 확인
        isLoading: () => {
            const { loading } = get();
            return Object.values(loading).some(isLoading => isLoading);
        },

        /**
         * 새로고침.
         * 레거시는 Firestore 가 알아서 밀어줬으므로 loading 만 켜는 시늉이었지만,
         * D1 엔 push 가 없으므로 실제로 다시 받아온다.
         * 쓰기 직후(useReservationStore) 이걸 불러야 화면이 갱신된다.
         * @param {string} [collectionName] 레거시 시그니처 유지용 — D1 은 스냅샷이 통짜라 전체를 받는다
         */
        refresh: async (collectionName) => {
            set((state) => ({
                loading: collectionName
                    ? { ...state.loading, [collectionName]: true }
                    : allLoading(true),
            }));
            try {
                const res = await fetch('/api/snapshot', { credentials: 'same-origin' });
                if (!res.ok) throw new Error(`snapshot ${res.status}`);
                const { version, data } = await res.json();
                set({ ...data, _version: version, loading: allLoading(false), errors: allErrors(null) });
            } catch (error) {
                console.error('Error refreshing snapshot:', error);
                set({ loading: allLoading(false) });
            }
        }
    }))
);

export default useFirebaseStore;
