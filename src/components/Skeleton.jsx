// Skeleton.jsx - 로딩 스켈레톤 컴포넌트
// 콘텐츠 로딩 중 플레이스홀더 UI

import React, { memo } from 'react';
import './Skeleton.css';

// 기본 스켈레톤
const Skeleton = memo(function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  className = '',
  variant = 'default', // 'default' | 'text' | 'circular' | 'rectangular'
  animation = 'pulse', // 'pulse' | 'wave' | 'none'
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return { borderRadius: '50%', width: height, height };
      case 'rectangular':
        return { borderRadius: '0' };
      case 'text':
        return { borderRadius: '4px', height: '1em' };
      default:
        return {};
    }
  };

  return (
    <div
      className={`skeleton skeleton--${animation} ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...getVariantStyles(),
      }}
      aria-hidden="true"
    />
  );
});

// 텍스트 스켈레톤 (여러 줄)
export const TextSkeleton = memo(function TextSkeleton({
  lines = 3,
  gap = '0.5rem',
  lastLineWidth = '60%',
  className = '',
}) {
  return (
    <div className={`skeleton-text ${className}`} style={{ gap }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height="1rem"
        />
      ))}
    </div>
  );
});

// 카드 스켈레톤
export const CardSkeleton = memo(function CardSkeleton({
  hasImage = true,
  imageHeight = '200px',
  className = '',
}) {
  return (
    <div className={`skeleton-card ${className}`}>
      {hasImage && (
        <Skeleton
          width="100%"
          height={imageHeight}
          borderRadius="8px 8px 0 0"
          variant="rectangular"
        />
      )}
      <div className="skeleton-card-content">
        <Skeleton width="70%" height="1.25rem" />
        <TextSkeleton lines={2} />
        <div className="skeleton-card-footer">
          <Skeleton width="80px" height="2rem" borderRadius="4px" />
          <Skeleton width="60px" height="1rem" />
        </div>
      </div>
    </div>
  );
});

// 테이블 행 스켈레톤
export const TableRowSkeleton = memo(function TableRowSkeleton({
  columns = 4,
  rows = 5,
  className = '',
}) {
  return (
    <div className={`skeleton-table ${className}`}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              width={colIndex === 0 ? '40%' : '80%'}
              height="1rem"
            />
          ))}
        </div>
      ))}
    </div>
  );
});

// 아바타 스켈레톤
export const AvatarSkeleton = memo(function AvatarSkeleton({
  size = 40,
  className = '',
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      variant="circular"
      className={className}
    />
  );
});

// 통계 카드 스켈레톤
export const StatCardSkeleton = memo(function StatCardSkeleton({
  className = '',
}) {
  return (
    <div className={`skeleton-stat-card ${className}`}>
      <Skeleton width="40px" height="40px" variant="circular" />
      <div className="skeleton-stat-content">
        <Skeleton width="60%" height="0.875rem" />
        <Skeleton width="80%" height="1.5rem" />
      </div>
    </div>
  );
});

// 예약 카드 스켈레톤
export const ReservationCardSkeleton = memo(function ReservationCardSkeleton({
  className = '',
}) {
  return (
    <div className={`skeleton-reservation-card ${className}`}>
      <div className="skeleton-reservation-header">
        <Skeleton width="120px" height="1.25rem" />
        <Skeleton width="60px" height="1.5rem" borderRadius="12px" />
      </div>
      <div className="skeleton-reservation-body">
        <Skeleton width="80%" height="1rem" />
        <Skeleton width="60%" height="1rem" />
        <Skeleton width="70%" height="1rem" />
      </div>
      <div className="skeleton-reservation-footer">
        <Skeleton width="100px" height="2rem" borderRadius="6px" />
        <Skeleton width="80px" height="2rem" borderRadius="6px" />
      </div>
    </div>
  );
});

export default Skeleton;
