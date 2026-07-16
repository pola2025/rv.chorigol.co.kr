// PricingPage.jsx - 가격 설정 페이지
import React, { Suspense, lazy } from 'react';
import Skeleton, { CardSkeleton } from '../components/Skeleton';

const PricingSettings = lazy(() => import('../components/PricingSettings'));

const LazyFallback = () => (
  <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <Skeleton width="200px" height="2rem" />
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
    </div>
  </div>
);

function PricingPage() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <PricingSettings />
    </Suspense>
  );
}

export default PricingPage;
