/**
 * Optimized Reservation Service
 * 성능 최적화된 예약 서비스 - 배치 처리, 디바운싱, 가상화 지원
 */

import { Reservation, DateRange } from '../../domain/entities/Reservation';
import { Room } from '../../domain/entities/Room';

export class OptimizedReservationService {
  constructor(repository, cache) {
    this.repository = repository;
    this.cache = cache;
    this.batchQueue = [];
    this.batchTimer = null;
    this.batchDelay = 100; // 100ms 배치 지연
  }

  /**
   * 가상 스크롤을 위한 페이지네이션
   */
  async getReservationsPage(page = 1, pageSize = 50, filters = {}) {
    const cacheKey = `reservations:page:${page}:${pageSize}:${JSON.stringify(filters)}`;
    
    // 캐시 확인
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // 데이터 조회
    const allReservations = await this.repository.findAll();
    
    // 필터링
    let filtered = allReservations;
    if (filters.status) {
      filtered = filtered.filter(r => r.status === filters.status);
    }
    if (filters.room) {
      filtered = filtered.filter(r => r.room === filters.room);
    }
    if (filters.dateRange) {
      const range = new DateRange(filters.dateRange.start, filters.dateRange.end);
      filtered = filtered.filter(r => 
        range.contains(r.checkIn) || range.contains(r.checkOut)
      );
    }

    // 정렬
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 페이지네이션
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = filtered.slice(start, end);

    const result = {
      items: items.map(r => new Reservation(r)),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize)
    };

    // 캐시 저장
    this.cache.set(cacheKey, result, 60000); // 1분 캐시

    return result;
  }

  /**
   * 배치 업데이트 - 여러 예약을 한번에 처리
   */
  async batchUpdate(updates) {
    return new Promise((resolve, reject) => {
      // 큐에 추가
      this.batchQueue.push({ updates, resolve, reject });

      // 타이머 재설정
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.batchDelay);
    });
  }

  async processBatch() {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      // 모든 업데이트를 단일 트랜잭션으로 처리
      const allUpdates = batch.flatMap(item => item.updates);
      const results = await this.repository.batchUpdate(allUpdates);

      // 캐시 무효화
      this.cache.invalidatePattern('reservations:');

      // 각 프로미스 해결
      batch.forEach((item, index) => {
        item.resolve(results.slice(
          index * item.updates.length,
          (index + 1) * item.updates.length
        ));
      });
    } catch (error) {
      // 에러 처리
      batch.forEach(item => item.reject(error));
    }
  }

  /**
   * 재고 계산 최적화 - 메모이제이션 + 증분 계산
   */
  async calculateInventory(roomName, dateRange, skipCache = false) {
    const cacheKey = `inventory:${roomName}:${dateRange.startDate}:${dateRange.endDate}`;
    
    if (!skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    // 기본 재고 조회
    const room = await this.repository.findRoomByName(roomName);
    if (!room) throw new Error('Room not found');

    const days = dateRange.getDays();
    const inventory = {};

    // 날짜별 예약 조회 (배치)
    const reservations = await this.repository.findByRoomAndDateRange(
      roomName,
      dateRange.startDate,
      dateRange.endDate
    );

    // 날짜별 재고 계산
    days.forEach(day => {
      const dayReservations = reservations.filter(r => {
        const reservation = new Reservation(r);
        const resRange = new DateRange(reservation.checkIn, reservation.checkOut);
        return resRange.contains(day) && reservation.isActive();
      });

      inventory[day] = {
        total: room.inventory,
        used: dayReservations.length,
        available: room.inventory - dayReservations.length,
        reservations: dayReservations.map(r => ({
          id: r.id,
          guestName: r.guestName,
          status: r.status
        }))
      };
    });

    // 캐시 저장
    this.cache.set(cacheKey, inventory, 120000); // 2분 캐시

    return inventory;
  }

  /**
   * 검색 최적화 - 인덱싱 + 전문 검색
   */
  async searchReservations(query, options = {}) {
    const { 
      fields = ['guestName', 'phone', 'memo'],
      limit = 20,
      fuzzy = true 
    } = options;

    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const allReservations = await this.repository.findAll();
    
    // 검색 로직
    const results = allReservations.filter(reservation => {
      const searchText = query.toLowerCase();
      
      return fields.some(field => {
        const value = reservation[field];
        if (!value) return false;
        
        const valueText = value.toString().toLowerCase();
        
        if (fuzzy) {
          // 퍼지 매칭 (레벤슈타인 거리)
          return this.fuzzyMatch(searchText, valueText);
        } else {
          // 정확한 매칭
          return valueText.includes(searchText);
        }
      });
    });

    // 관련도 순 정렬
    results.sort((a, b) => {
      const aScore = this.calculateRelevance(query, a, fields);
      const bScore = this.calculateRelevance(query, b, fields);
      return bScore - aScore;
    });

    const limitedResults = results.slice(0, limit);
    
    // 캐시 저장
    this.cache.set(cacheKey, limitedResults, 30000); // 30초 캐시

    return limitedResults;
  }

  /**
   * 퍼지 매칭 알고리즘
   */
  fuzzyMatch(pattern, text) {
    const distance = this.levenshteinDistance(pattern, text);
    const threshold = Math.floor(pattern.length * 0.3); // 30% 오차 허용
    return distance <= threshold;
  }

  /**
   * 레벤슈타인 거리 계산
   */
  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // 삭제
            dp[i][j - 1] + 1,    // 삽입
            dp[i - 1][j - 1] + 1 // 교체
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 검색 관련도 계산
   */
  calculateRelevance(query, reservation, fields) {
    let score = 0;
    const queryLower = query.toLowerCase();

    fields.forEach(field => {
      const value = reservation[field];
      if (!value) return;
      
      const valueLower = value.toString().toLowerCase();
      
      // 정확한 매칭
      if (valueLower === queryLower) {
        score += 100;
      }
      // 시작 부분 매칭
      else if (valueLower.startsWith(queryLower)) {
        score += 50;
      }
      // 포함
      else if (valueLower.includes(queryLower)) {
        score += 20;
      }
    });

    // 최근 예약일수록 높은 점수
    const daysSinceCreation = (Date.now() - new Date(reservation.createdAt)) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceCreation);

    return score;
  }

  /**
   * 프리페칭 - 다음 데이터 미리 로드
   */
  async prefetchNextPage(currentPage, pageSize, filters) {
    const nextPage = currentPage + 1;
    const cacheKey = `reservations:page:${nextPage}:${pageSize}:${JSON.stringify(filters)}`;
    
    // 이미 캐시에 있으면 스킵
    if (this.cache.has(cacheKey)) return;

    // 백그라운드에서 다음 페이지 로드
    setTimeout(() => {
      this.getReservationsPage(nextPage, pageSize, filters);
    }, 0);
  }

  /**
   * 데이터 압축 - 전송 크기 최소화
   */
  compressReservation(reservation) {
    return {
      i: reservation.id,
      g: reservation.guestName,
      p: reservation.phone,
      r: reservation.room,
      ci: reservation.checkIn,
      co: reservation.checkOut,
      s: reservation.status,
      t: reservation.totalPrice
    };
  }

  decompressReservation(compressed) {
    return new Reservation({
      id: compressed.i,
      guestName: compressed.g,
      phone: compressed.p,
      room: compressed.r,
      checkIn: compressed.ci,
      checkOut: compressed.co,
      status: compressed.s,
      totalPrice: compressed.t
    });
  }
}
