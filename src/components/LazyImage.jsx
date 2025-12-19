/**
 * Lazy Image Component
 * 이미지 레이지 로딩 및 최적화
 */

import React, { useState, useRef, useCallback } from 'react';
import { useDerivedState } from '../application/hooks/useReactiveState';

/**
 * Intersection Observer를 활용한 레이지 이미지
 */
export const LazyImage = ({
  src,
  alt,
  placeholder = '/placeholder.svg',
  className = '',
  style = {},
  threshold = 0.1,
  rootMargin = '100px',
  onLoad,
  onError,
  loading = 'lazy',
  decoding = 'async',
  sizes,
  srcSet
}) => {
  const imgRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Intersection Observer 설정 (선언형)
  const observerCallback = useCallback((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    });
  }, []);

  // Observer 초기화 (ref 콜백 패턴으로 useEffect 대체)
  const setRef = useCallback((node) => {
    if (!node) return;

    const observer = new IntersectionObserver(observerCallback, {
      threshold,
      rootMargin
    });

    observer.observe(node);
    imgRef.current = node;

    return () => {
      if (node) observer.unobserve(node);
    };
  }, [observerCallback, threshold, rootMargin]);

  // 이미지 소스 (선언형)
  const imageSrc = useDerivedState(
    [isInView, src, placeholder, hasError],
    () => {
      if (hasError) return placeholder;
      if (!isInView) return placeholder;
      return src;
    }
  );

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    if (onError) onError();
  }, [onError]);

  return (
    <div
      ref={setRef}
      className={`lazy-image-container ${className}`}
      style={{
        ...style,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <img
        src={imageSrc}
        alt={alt}
        className={`lazy-image ${isLoaded ? 'loaded' : 'loading'}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'opacity 0.3s ease-in-out',
          opacity: isLoaded || !isInView ? 1 : 0.5
        }}
        loading={loading}
        decoding={decoding}
        sizes={sizes}
        srcSet={isInView ? srcSet : undefined}
        onLoad={handleLoad}
        onError={handleError}
      />
      
      {!isLoaded && isInView && !hasError && (
        <div
          className="lazy-image-loader"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="spinner" />
        </div>
      )}
    </div>
  );
};

/**
 * Progressive Image Component
 * 점진적 이미지 로딩 (썸네일 → 고화질)
 */
export const ProgressiveImage = ({
  thumbnail,
  src,
  alt,
  className = '',
  style = {},
  blurRadius = 20
}) => {
  const [currentSrc, setCurrentSrc] = useState(thumbnail);
  const [isLoading, setIsLoading] = useState(true);
  const [blur, setBlur] = useState(blurRadius);

  // 고화질 이미지 프리로드 (ref 콜백 패턴)
  const setRef = useCallback((node) => {
    if (!node || !src) return;

    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setCurrentSrc(src);
      setBlur(0);
      setIsLoading(false);
    };

    img.onerror = () => {
      setIsLoading(false);
    };
  }, [src]);

  return (
    <div
      ref={setRef}
      className={`progressive-image-container ${className}`}
      style={{
        ...style,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <img
        src={currentSrc}
        alt={alt}
        className={`progressive-image ${isLoading ? 'loading' : 'loaded'}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: `blur(${blur}px)`,
          transition: 'filter 0.5s ease-in-out',
          transform: 'scale(1.1)' // 블러 엣지 숨기기
        }}
      />
    </div>
  );
};

/**
 * Image Preloader Hook
 * 이미지 미리 로드
 */
export const useImagePreloader = (urls = []) => {
  const [loaded, setLoaded] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const preload = useCallback((url) => {
    if (loaded[url] || loading[url]) return;

    setLoading(prev => ({ ...prev, [url]: true }));

    const img = new Image();
    img.src = url;

    img.onload = () => {
      setLoaded(prev => ({ ...prev, [url]: true }));
      setLoading(prev => ({ ...prev, [url]: false }));
    };

    img.onerror = () => {
      setErrors(prev => ({ ...prev, [url]: true }));
      setLoading(prev => ({ ...prev, [url]: false }));
    };
  }, [loaded, loading]);

  const preloadAll = useCallback(() => {
    urls.forEach(url => preload(url));
  }, [urls, preload]);

  return {
    loaded,
    loading,
    errors,
    preload,
    preloadAll
  };
};

/**
 * Responsive Image Component
 * 반응형 이미지 최적화
 */
export const ResponsiveImage = ({
  src,
  alt,
  sizes = '100vw',
  breakpoints = [640, 768, 1024, 1280],
  className = '',
  style = {}
}) => {
  // srcSet 생성 (선언형)
  const srcSet = useDerivedState(
    [src, breakpoints],
    () => {
      if (!src) return '';
      
      const extension = src.split('.').pop();
      const baseName = src.replace(`.${extension}`, '');
      
      return breakpoints
        .map(bp => `${baseName}-${bp}w.${extension} ${bp}w`)
        .join(', ');
    }
  );

  return (
    <LazyImage
      src={src}
      alt={alt}
      srcSet={srcSet}
      sizes={sizes}
      className={className}
      style={style}
    />
  );
};
