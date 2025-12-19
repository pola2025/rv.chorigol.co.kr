// NotificationsPage.jsx - 알림 설정 페이지
import React, { Suspense, lazy } from 'react';
import Skeleton, { CardSkeleton } from '../components/Skeleton';

const NotificationSettingsV2 = lazy(() => import('../components/NotificationSettingsV2'));

const LazyFallback = () => (
  <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <Skeleton width="200px" height="2rem" />
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
    </div>
  </div>
);

function NotificationsPage() {
  return (
    <div className="notifications-container">
      <Suspense fallback={<LazyFallback />}>
        <NotificationSettingsV2 />
      </Suspense>
    </div>
  );
}

export default NotificationsPage;
