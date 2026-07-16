// SecurityPage.jsx - 보안 관리 페이지
import React, { Suspense, lazy } from 'react';
import Skeleton, { CardSkeleton } from '../components/Skeleton';

const BlockedIPManager = lazy(() => import('../components/BlockedIPManager'));

const LazyFallback = () => (
  <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <Skeleton width="200px" height="2rem" />
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
    </div>
  </div>
);

function SecurityPage() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <BlockedIPManager />
    </Suspense>
  );
}

export default SecurityPage;
