// src/hooks/useOptions.js
import useFirebaseStore from '../stores/useFirebaseStore';

// 옵션 데이터 훅
export const useOptions = () => {
    const options = useFirebaseStore((state) => state.options);
    const loading = useFirebaseStore((state) => state.loading.options);
    const error = useFirebaseStore((state) => state.errors.options);
    
    return {
        data: options,
        isLoading: loading,
        error: error,
        isError: !!error
    };
};

// 가격 규칙 훅
export const usePricingRules = () => {
    const pricingRules = useFirebaseStore((state) => state.pricingRules);
    const loading = useFirebaseStore((state) => state.loading.pricingRules);
    const error = useFirebaseStore((state) => state.errors.pricingRules);
    
    return {
        data: pricingRules,
        isLoading: loading,
        error: error,
        isError: !!error
    };
};

// 차단된 날짜 훅
export const useBlockedDates = () => {
    const blockedDates = useFirebaseStore((state) => state.blockedDates);
    const loading = useFirebaseStore((state) => state.loading.blockedDates);
    const error = useFirebaseStore((state) => state.errors.blockedDates);
    
    return {
        data: blockedDates,
        isLoading: loading,
        error: error,
        isError: !!error
    };
};

// 특정 날짜가 차단되었는지 확인하는 훅
export const useIsDateBlocked = (dateStr) => {
    const blockedDates = useFirebaseStore((state) => state.blockedDates);
    const isBlocked = blockedDates.some(blocked => blocked.date === dateStr);
    
    return isBlocked;
};
