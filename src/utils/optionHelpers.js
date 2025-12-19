// src/utils/optionHelpers.js

/**
 * 옵션 데이터를 안전하게 문자열로 변환
 */
export const renderOptionsAsText = (options) => {
  if (!options) return '';
  
  // 배열이 아닌 경우 처리
  if (!Array.isArray(options)) {
    console.warn('Options is not an array:', options);
    if (typeof options === 'object' && options.name) {
      return String(options.name);
    }
    return '';
  }
  
  // 배열인 경우 각 요소를 문자열로 변환
  const optionTexts = options.map(opt => {
    // null이나 undefined 체크
    if (!opt) return '';
    
    // 문자열인 경우 그대로 반환
    if (typeof opt === 'string') {
      return opt;
    }
    
    // 객체인 경우 name 속성 반환
    if (typeof opt === 'object' && opt.name) {
      return String(opt.name);
    }
    
    // 기타 경우 문자열로 변환 시도
    try {
      return String(opt);
    } catch (e) {
      console.error('Failed to convert option to string:', opt, e);
      return '';
    }
  }).filter(Boolean); // 빈 문자열 제거
  
  return optionTexts.join(', ');
};

/**
 * 옵션 가격 합계 계산
 */
export const calculateOptionPrice = (options) => {
  if (!options || !Array.isArray(options)) return 0;
  
  return options.reduce((sum, opt) => {
    if (typeof opt === 'object' && opt && opt.price) {
      return sum + (Number(opt.price) || 0);
    }
    return sum;
  }, 0);
};

/**
 * 옵션 정규화
 */
export const normalizeOptions = (options) => {
  if (!options) return [];
  
  if (!Array.isArray(options)) {
    if (typeof options === 'object') {
      return [options];
    }
    return [];
  }
  
  const optionMapping = {
    'camping_burner': { name: '캠핑버너', price: 20000 },
    'charcoal_bbq': { name: '숯불BBQ', price: 30000 },
    'late_checkout': { name: '늦은체크아웃', price: 0 },
    '캠핑버너&그릴': { name: '캠핑버너', price: 20000 },
    '숯불바베큐': { name: '숯불BBQ', price: 30000 },
    '레이트 체크아웃': { name: '늦은체크아웃', price: 0 }
  };
  
  return options.map(opt => {
    if (typeof opt === 'string') {
      return optionMapping[opt] || { name: opt, price: 0 };
    }
    
    if (typeof opt === 'object' && opt !== null) {
      return {
        name: String(opt.name || ''),
        price: Number(opt.price) || 0
      };
    }
    
    return { name: String(opt), price: 0 };
  }).filter(opt => opt.name);
};
