// src/utils/debugOptions.js

/**
 * 옵션 데이터 디버깅 유틸리티
 */

// 전역 윈도우에 디버그 함수 추가
if (typeof window !== 'undefined') {
  window.debugOptions = (options) => {
    console.group('🔍 Options Debug');
    console.log('Raw options:', options);
    console.log('Type:', typeof options);
    console.log('Is Array:', Array.isArray(options));
    
    if (Array.isArray(options)) {
      console.log('Length:', options.length);
      options.forEach((opt, index) => {
        console.log(`[${index}] Type: ${typeof opt}, Value:`, opt);
        if (typeof opt === 'object' && opt !== null) {
          console.log(`  - Keys:`, Object.keys(opt));
          console.log(`  - name:`, opt.name);
          console.log(`  - price:`, opt.price);
        }
      });
    }
    
    console.groupEnd();
    return options;
  };
}

// React 컴포넌트에서 사용할 수 있는 안전한 옵션 렌더러
export const SafeOptionRenderer = ({ options }) => {
  if (!options) return null;
  
  // 디버그 모드
  if (process.env.NODE_ENV === 'development') {
    console.log('SafeOptionRenderer received:', options);
  }
  
  try {
    const text = Array.isArray(options) 
      ? options.map(opt => {
          if (!opt) return '';
          if (typeof opt === 'string') return opt;
          if (typeof opt === 'object' && opt.name) return String(opt.name);
          return '';
        }).filter(Boolean).join(', ')
      : '';
    
    return text || null;
  } catch (error) {
    console.error('SafeOptionRenderer error:', error);
    return null;
  }
};

export default { SafeOptionRenderer };
