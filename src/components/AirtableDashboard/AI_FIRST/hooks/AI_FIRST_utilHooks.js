/**
 * AI_FIRST_utilHooks.js
 * 추가 유틸리티 훅 모음
 * 애니메이션, 인터섹션 옵저버, 미디어 쿼리 등
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * 인터섹션 옵저버 훅 (선언형)
 * 요소가 뷰포트에 들어왔는지 감지
 */
export const useIntersectionObserver = (
  options = {
    threshold: 0.1,
    rootMargin: '0px'
  }
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef(null);
  const observerRef = useRef(null);
  
  // Observer 설정 (React Query 방식)
  useQuery({
    queryKey: ['intersectionObserver', options.threshold, options.rootMargin],
    queryFn: () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          setIsIntersecting(entry.isIntersecting);
        },
        options
      );
      
      if (targetRef.current) {
        observerRef.current.observe(targetRef.current);
      }
      
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    },
    staleTime: Infinity,
    enabled: typeof window !== 'undefined' && 'IntersectionObserver' in window
  });
  
  return { targetRef, isIntersecting };
};

/**
 * 미디어 쿼리 훅 (선언형)
 */
export const useMediaQuery = (query) => {
  const getMatches = (query) => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };
  
  const [matches, setMatches] = useState(getMatches(query));
  
  // 미디어 쿼리 변경 감지 (React Query 방식)
  useQuery({
    queryKey: ['mediaQuery', query],
    queryFn: () => {
      const mediaQuery = window.matchMedia(query);
      
      const handleChange = (e) => {
        setMatches(e.matches);
      };
      
      // 이벤트 리스너 추가
      mediaQuery.addEventListener('change', handleChange);
      
      // 초기값 설정
      setMatches(mediaQuery.matches);
      
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    },
    staleTime: Infinity,
    enabled: typeof window !== 'undefined'
  });
  
  return matches;
};

/**
 * 반응형 브레이크포인트 훅
 */
export const useBreakpoints = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const isLargeDesktop = useMediaQuery('(min-width: 1440px)');
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    currentBreakpoint: useMemo(() => {
      if (isMobile) return 'mobile';
      if (isTablet) return 'tablet';
      if (isLargeDesktop) return 'largeDesktop';
      if (isDesktop) return 'desktop';
      return 'unknown';
    }, [isMobile, isTablet, isDesktop, isLargeDesktop])
  };
};

/**
 * 애니메이션 프레임 훅 (선언형)
 */
export const useAnimationFrame = (callback, isRunning = true) => {
  const requestRef = useRef(null);
  const previousTimeRef = useRef(null);
  const callbackRef = useRef(callback);
  
  // 콜백 업데이트
  callbackRef.current = callback;
  
  // 애니메이션 루프 (React Query 방식)
  useQuery({
    queryKey: ['animationFrame', isRunning],
    queryFn: () => {
      const animate = (time) => {
        if (previousTimeRef.current !== undefined) {
          const deltaTime = time - previousTimeRef.current;
          callbackRef.current(deltaTime);
        }
        previousTimeRef.current = time;
        
        if (isRunning) {
          requestRef.current = requestAnimationFrame(animate);
        }
      };
      
      if (isRunning) {
        requestRef.current = requestAnimationFrame(animate);
      }
      
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
      };
    },
    staleTime: Infinity,
    enabled: isRunning
  });
};

/**
 * 카운트업 애니메이션 훅
 */
export const useCountUp = (end, duration = 1000, start = 0) => {
  const [count, setCount] = useState(start);
  const startTimeRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const startAnimation = useCallback(() => {
    setIsAnimating(true);
    startTimeRef.current = null;
  }, []);
  
  useAnimationFrame((deltaTime) => {
    if (!startTimeRef.current) {
      startTimeRef.current = performance.now();
    }
    
    const elapsed = performance.now() - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    
    // 이징 함수 (easeOutQuart)
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const currentCount = start + (end - start) * easeOutQuart;
    
    setCount(currentCount);
    
    if (progress >= 1) {
      setIsAnimating(false);
      setCount(end);
    }
  }, isAnimating);
  
  return {
    count: Math.round(count),
    startAnimation,
    isAnimating
  };
};

/**
 * 스크롤 위치 훅
 */
export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState({
    x: 0,
    y: 0,
    direction: 'none'
  });
  
  const prevScrollY = useRef(0);
  
  // 스크롤 이벤트 처리 (React Query 방식)
  useQuery({
    queryKey: ['scrollPosition'],
    queryFn: () => {
      const handleScroll = () => {
        const currentScrollY = window.scrollY;
        const currentScrollX = window.scrollX;
        
        let direction = 'none';
        if (currentScrollY > prevScrollY.current) {
          direction = 'down';
        } else if (currentScrollY < prevScrollY.current) {
          direction = 'up';
        }
        
        setScrollPosition({
          x: currentScrollX,
          y: currentScrollY,
          direction
        });
        
        prevScrollY.current = currentScrollY;
      };
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    },
    staleTime: Infinity,
    enabled: typeof window !== 'undefined'
  });
  
  return scrollPosition;
};

/**
 * 클립보드 복사 훅
 */
export const useClipboard = () => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);
  
  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      
      // 이전 타임아웃 클리어
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // 2초 후 리셋
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
      
      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopied(false);
      return false;
    }
  }, []);
  
  return { copyToClipboard, copied };
};

/**
 * 온라인/오프라인 상태 훅
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  
  // 네트워크 상태 감지 (React Query 방식)
  useQuery({
    queryKey: ['onlineStatus'],
    queryFn: () => {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    },
    staleTime: Infinity,
    enabled: typeof window !== 'undefined'
  });
  
  return isOnline;
};

/**
 * 다크모드 훅
 */
export const useDarkMode = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) {
      return stored === 'true';
    }
    return prefersDarkMode;
  });
  
  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('darkMode', String(newValue));
      
      // 루트 요소에 클래스 토글
      if (newValue) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      return newValue;
    });
  }, []);
  
  // 초기 설정
  useMemo(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  return { darkMode, toggleDarkMode, prefersDarkMode };
};

/**
 * 키보드 단축키 훅
 */
export const useKeyPress = (targetKey, handler, options = {}) => {
  const { ctrlKey = false, shiftKey = false, altKey = false } = options;
  const handlerRef = useRef(handler);
  
  // 핸들러 업데이트
  handlerRef.current = handler;
  
  // 키보드 이벤트 처리 (React Query 방식)
  useQuery({
    queryKey: ['keyPress', targetKey, ctrlKey, shiftKey, altKey],
    queryFn: () => {
      const handleKeyDown = (event) => {
        if (event.key === targetKey &&
            event.ctrlKey === ctrlKey &&
            event.shiftKey === shiftKey &&
            event.altKey === altKey) {
          event.preventDefault();
          handlerRef.current(event);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    },
    staleTime: Infinity,
    enabled: typeof window !== 'undefined'
  });
};

export default {
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
};
