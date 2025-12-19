/**
 * components/index.js
 * 모든 AI_FIRST 컴포넌트 내보내기
 */

// 연간 통계 카드
export { default as YearlyStatsCard } from './AI_FIRST_YearlyStatsCard';

// 시설 비교
export { default as FacilityComparison } from './AI_FIRST_FacilityComparison';

// 월별 통합 테이블
export { default as IntegratedMonthlyTable } from './AI_FIRST_IntegratedMonthlyTable';

// 목표 설정 바
export { default as GoalBar } from './AI_FIRST_GoalBar';

// 차트 컴포넌트
export { default as YearlyTrendChart } from './AI_FIRST_YearlyTrendChart';
export { default as EfficiencyMatrix } from './AI_FIRST_EfficiencyMatrix';
export { default as FunnelChart } from './AI_FIRST_FunnelChart';

// 컴포넌트 그룹으로 내보내기
export const Components = {
  YearlyStatsCard: require('./AI_FIRST_YearlyStatsCard').default,
  FacilityComparison: require('./AI_FIRST_FacilityComparison').default,
  IntegratedMonthlyTable: require('./AI_FIRST_IntegratedMonthlyTable').default,
  GoalBar: require('./AI_FIRST_GoalBar').default,
  YearlyTrendChart: require('./AI_FIRST_YearlyTrendChart').default,
  EfficiencyMatrix: require('./AI_FIRST_EfficiencyMatrix').default,
  FunnelChart: require('./AI_FIRST_FunnelChart').default
};

export default Components;
