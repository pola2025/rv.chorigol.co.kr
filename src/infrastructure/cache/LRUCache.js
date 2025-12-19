/**
 * LRU Cache with TTL
 * 고성능 캐시 시스템 - 메모리 효율적인 LRU + TTL 구현
 */

export class LRUCache {
  constructor(maxSize = 100, defaultTTL = 5 * 60 * 1000) { // 5분 기본 TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.cache = new Map();
    this.accessOrder = new Map();
  }

  set(key, value, ttl = this.defaultTTL) {
    // 기존 값이 있으면 삭제
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }

    // 캐시 크기 체크
    if (this.cache.size >= this.maxSize) {
      // 가장 오래된 항목 제거 (LRU)
      const firstKey = this.accessOrder.keys().next().value;
      this.cache.delete(firstKey);
      this.accessOrder.delete(firstKey);
    }

    // 새 값 추가
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
    this.accessOrder.set(key, Date.now());
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // TTL 체크
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // 접근 순서 업데이트 (LRU)
    this.accessOrder.delete(key);
    this.accessOrder.set(key, Date.now());

    return item.value;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key) {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder.clear();
  }

  // 패턴 매칭으로 캐시 무효화
  invalidatePattern(pattern) {
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string' && key.includes(pattern)) {
        keysToDelete.push(key);
      } else if (pattern instanceof RegExp && pattern.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
    return keysToDelete.length;
  }

  // 캐시 통계
  getStats() {
    let validCount = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      totalSize: this.cache.size,
      validCount,
      expiredCount,
      maxSize: this.maxSize,
      usage: (this.cache.size / this.maxSize) * 100
    };
  }
}

/**
 * Query Result Cache
 * 쿼리 결과를 캐싱하는 특화된 캐시
 */
export class QueryCache extends LRUCache {
  constructor(maxSize = 50, defaultTTL = 2 * 60 * 1000) { // 2분 기본 TTL
    super(maxSize, defaultTTL);
    this.hitCount = 0;
    this.missCount = 0;
  }

  // 쿼리 키 생성
  createKey(queryType, params) {
    return `${queryType}:${JSON.stringify(params, Object.keys(params).sort())}`;
  }

  getQuery(queryType, params) {
    const key = this.createKey(queryType, params);
    const result = this.get(key);
    
    if (result !== null) {
      this.hitCount++;
    } else {
      this.missCount++;
    }
    
    return result;
  }

  setQuery(queryType, params, value, ttl) {
    const key = this.createKey(queryType, params);
    this.set(key, value, ttl);
  }

  // 특정 쿼리 타입의 모든 캐시 무효화
  invalidateQueryType(queryType) {
    return this.invalidatePattern(queryType + ':');
  }

  getHitRate() {
    const total = this.hitCount + this.missCount;
    return total === 0 ? 0 : (this.hitCount / total) * 100;
  }

  resetStats() {
    this.hitCount = 0;
    this.missCount = 0;
  }
}
