// src/components/OptionRenderer.jsx
import React from 'react';

/**
 * 안전한 옵션 렌더링 컴포넌트
 * options가 어떤 형태로 와도 안전하게 렌더링
 */
const OptionRenderer = ({ options, showPrice = false }) => {
  if (!options) return null;
  
  // 옵션 데이터 정규화
  const normalizeOptions = (opts) => {
    // null이나 undefined인 경우
    if (!opts) return [];
    
    // 배열이 아닌 경우
    if (!Array.isArray(opts)) {
      console.warn('Options is not an array:', opts);
      // 단일 객체인 경우 배열로 변환
      if (typeof opts === 'object') {
        return [opts];
      }
      // 문자열인 경우
      if (typeof opts === 'string') {
        return [{ name: opts, price: 0 }];
      }
      return [];
    }
    
    // 배열인 경우 각 요소 정규화
    return opts.map(opt => {
      // 문자열인 경우
      if (typeof opt === 'string') {
        const optionMapping = {
          'camping_burner': { name: '캠핑버너', price: 20000 },
          'charcoal_bbq': { name: '숯불BBQ', price: 30000 },
          'late_checkout': { name: '늦은체크아웃', price: 0 },
          '캠핑버너&그릴': { name: '캠핑버너', price: 20000 },
          '숯불바베큐': { name: '숯불BBQ', price: 30000 },
          '레이트 체크아웃': { name: '늦은체크아웃', price: 0 }
        };
        return optionMapping[opt] || { name: opt, price: 0 };
      }
      
      // 객체인 경우
      if (typeof opt === 'object' && opt !== null) {
        return {
          name: String(opt.name || ''),
          price: Number(opt.price) || 0
        };
      }
      
      // 기타 경우
      return { name: String(opt), price: 0 };
    }).filter(opt => opt.name); // 빈 이름 제거
  };
  
  const normalizedOptions = normalizeOptions(options);
  
  if (normalizedOptions.length === 0) return null;
  
  const optionNames = normalizedOptions.map(opt => opt.name).join(', ');
  const totalPrice = normalizedOptions.reduce((sum, opt) => sum + opt.price, 0);
  
  return (
    <span className="option-renderer">
      {optionNames}
      {showPrice && totalPrice > 0 && (
        <span className="option-price"> (+{totalPrice.toLocaleString()}원)</span>
      )}
    </span>
  );
};

export default OptionRenderer;
