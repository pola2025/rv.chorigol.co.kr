// AnalyticsPage.jsx - 광고 효율 분석 페이지
import React, { Suspense, lazy } from 'react';
import Skeleton, { CardSkeleton } from '../components/Skeleton';

const AirtableDashboard = lazy(() => import('../components/AirtableDashboard/AirtableDashboard'));

const LazyFallback = () => (
  <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#1a1a2e', minHeight: '50vh' }}>
    <Skeleton width="200px" height="2rem" />
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
    </div>
  </div>
);

function AnalyticsPage() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <AirtableDashboard />
    </Suspense>
  );
}

export default AnalyticsPage;
