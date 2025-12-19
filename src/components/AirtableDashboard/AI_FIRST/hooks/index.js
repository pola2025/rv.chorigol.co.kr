/**
 * hooks/index.js
 * 모든 커스텀 훅 내보내기
 */

// 메인 데이터 훅
export {
  useAirtableConnection,
  useMonthlyStats,
  useYearlyStats,
  useDashboardData,
  useWindowSize,
  useWindowEvent,
  useDebounce,
  useLocalStorage,
  useGoals,
  useTabs,
  useNotification,
  useChartData
} from './AI_FIRST_hooks';

// 유틸리티 훅
export {
  useIntersectionObserver,
  useMediaQuery,
  useBreakpoints,
  useAnimationFrame,
  useCountUp,
  useScrollPosition,
  useClipboard,
  useOnlineStatus,
  useDarkMode,
  useKeyPress
} from './AI_FIRST_utilHooks';

// 기본 내보내기
import * as mainHooks from './AI_FIRST_hooks';
import * as utilHooks from './AI_FIRST_utilHooks';

export default {
  ...mainHooks,
  ...utilHooks
};
