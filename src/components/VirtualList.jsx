/**
 * Virtual List Component
 * 가상화를 통한 대량 데이터 렌더링 최적화
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useDerivedState } from '../application/hooks/useReactiveState';

/**
 * 가상 스크롤 리스트 컴포넌트
 * 수천 개의 아이템도 부드럽게 렌더링
 */
export const VirtualList = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  getItemKey = (item, index) => index,
  onScroll,
  className = ''
}) => {
  const scrollContainerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // 가시 영역 계산 (선언형)
  const visibleRange = useDerivedState(
    [scrollTop, containerHeight, itemHeight, items.length],
    () => {
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
      );
      
      return { startIndex, endIndex };
    },
    `visible-range:${scrollTop}:${containerHeight}`
  );

  // 가시 영역 아이템 (선언형)
  const visibleItems = useDerivedState(
    [items, visibleRange.startIndex, visibleRange.endIndex],
    () => {
      return items.slice(visibleRange.startIndex, visibleRange.endIndex);
    },
    `visible-items:${visibleRange.startIndex}:${visibleRange.endIndex}`
  );

  // 스크롤 핸들러 (디바운싱)
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);
    
    if (onScroll) {
      onScroll(e, {
        scrollTop: newScrollTop,
        visibleRange
      });
    }
  }, [onScroll, visibleRange]);

  // 전체 높이
  const totalHeight = items.length * itemHeight;

  // 상단 패딩 (가상화 오프셋)
  const offsetY = visibleRange.startIndex * itemHeight;

  return (
    <div
      ref={scrollContainerRef}
      className={`virtual-list-container ${className}`}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
        WebkitOverflowScrolling: 'touch'
      }}
      onScroll={handleScroll}
    >
      <div
        className="virtual-list-content"
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {visibleItems.map((item, index) => {
          const actualIndex = visibleRange.startIndex + index;
          const key = getItemKey(item, actualIndex);
          const itemOffset = actualIndex * itemHeight;
          
          return (
            <div
              key={key}
              className="virtual-list-item"
              style={{ 
                position: 'absolute',
                top: itemOffset,
                left: 0,
                right: 0,
                height: itemHeight,
                width: '100%'
              }}
            >
              {renderItem(item, actualIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 가변 높이 가상 리스트
 * 아이템마다 다른 높이를 가질 수 있음
 */
export const VariableVirtualList = ({
  items,
  getItemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  getItemKey = (item, index) => index,
  estimatedItemHeight = 50,
  className = ''
}) => {
  const scrollContainerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const itemHeightCache = useRef(new Map());

  // 아이템 위치 계산 (선언형)
  const itemPositions = useDerivedState(
    [items, getItemHeight],
    () => {
      const positions = [];
      let offset = 0;

      items.forEach((item, index) => {
        const cachedHeight = itemHeightCache.current.get(index);
        const height = cachedHeight || getItemHeight(item, index) || estimatedItemHeight;
        
        if (!cachedHeight) {
          itemHeightCache.current.set(index, height);
        }

        positions.push({
          index,
          offset,
          height
        });

        offset += height;
      });

      return positions;
    },
    `item-positions:${items.length}`
  );

  // 가시 영역 계산 (선언형)
  const visibleRange = useDerivedState(
    [scrollTop, containerHeight, itemPositions],
    () => {
      let startIndex = 0;
      let endIndex = items.length;

      // 이진 탐색으로 시작 인덱스 찾기
      let left = 0;
      let right = itemPositions.length - 1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const position = itemPositions[mid];

        if (position.offset + position.height < scrollTop) {
          left = mid + 1;
        } else if (position.offset > scrollTop) {
          right = mid - 1;
        } else {
          startIndex = mid;
          break;
        }
      }

      startIndex = Math.max(0, Math.min(left, right) - overscan);

      // 끝 인덱스 찾기
      for (let i = startIndex; i < itemPositions.length; i++) {
        const position = itemPositions[i];
        if (position.offset > scrollTop + containerHeight) {
          endIndex = Math.min(items.length, i + overscan);
          break;
        }
      }

      return { startIndex, endIndex };
    },
    `visible-range-var:${scrollTop}:${containerHeight}`
  );

  // 가시 영역 아이템
  const visibleItems = useDerivedState(
    [items, visibleRange.startIndex, visibleRange.endIndex, itemPositions],
    () => {
      return items.slice(visibleRange.startIndex, visibleRange.endIndex).map((item, index) => {
        const actualIndex = visibleRange.startIndex + index;
        const position = itemPositions[actualIndex];
        
        return {
          item,
          index: actualIndex,
          offset: position.offset,
          height: position.height
        };
      });
    },
    `visible-items-var:${visibleRange.startIndex}:${visibleRange.endIndex}`
  );

  // 전체 높이
  const totalHeight = itemPositions.length > 0
    ? itemPositions[itemPositions.length - 1].offset + itemPositions[itemPositions.length - 1].height
    : 0;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className={`variable-virtual-list-container ${className}`}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <div
        className="variable-virtual-list-content"
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {visibleItems.map(({ item, index, offset, height }) => {
          const key = getItemKey(item, index);
          
          return (
            <div
              key={key}
              className="variable-virtual-list-item"
              style={{
                position: 'absolute',
                top: offset,
                left: 0,
                right: 0,
                height
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 무한 스크롤 래퍼
 */
export const InfiniteScrollWrapper = ({
  loadMore,
  hasMore,
  loader,
  threshold = 100,
  children
}) => {
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleScroll = useCallback(async (e) => {
    if (isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    if (scrollHeight - scrollTop - clientHeight < threshold) {
      setIsLoading(true);
      await loadMore();
      setIsLoading(false);
    }
  }, [isLoading, hasMore, loadMore, threshold]);

  return (
    <div
      ref={containerRef}
      className="infinite-scroll-wrapper"
      onScroll={handleScroll}
      style={{ height: '100%', overflow: 'auto' }}
    >
      {children}
      {isLoading && loader}
    </div>
  );
};
