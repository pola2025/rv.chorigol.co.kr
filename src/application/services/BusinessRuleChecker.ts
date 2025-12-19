/**
 * @fileoverview BusinessRuleChecker Service
 * @description 비즈니스 규칙 검증 서비스
 */

import { 
  MarketingData,
  Revenue,
  Room,
  Advertisement
} from '../../domain/entities';
import { Money, Period, Percentage } from '../../domain/value-objects';

/**
 * 비즈니스 규칙 인터페이스
 */
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  category: 'revenue' | 'room' | 'advertisement' | 'general';
  severity: 'critical' | 'high' | 'medium' | 'low';
  check: (data: any) => BusinessRuleResult;
}

/**
 * 비즈니스 규칙 검증 결과
 */
export interface BusinessRuleResult {
  passed: boolean;
  message?: string;
  details?: any;
  suggestions?: string[];
}

/**
 * 비즈니스 규칙 검증 요약
 */
export interface BusinessRuleCheckSummary {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  criticalFailures: number;
  violations: BusinessRuleViolation[];
  score: number; // 0-100
  recommendations: string[];
}

/**
 * 비즈니스 규칙 위반
 */
export interface BusinessRuleViolation {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: string;
  message: string;
  details?: any;
}

/**
 * BusinessRuleChecker 서비스
 * @class
 */
export class BusinessRuleChecker {
  private rules: Map<string, BusinessRule> = new Map();
  private ruleHistory: Map<string, BusinessRuleResult[]> = new Map();

  /**
   * 생성자
   */
  constructor() {
    this.initializeBusinessRules();
  }

  /**
   * 비즈니스 규칙 초기화
   * @private
   */
  private initializeBusinessRules(): void {
    // 매출 관련 규칙
    this.addRule({
      id: 'REV-001',
      name: '매출 일관성',
      description: '총 매출 = 객실 매출 + 부가 매출',
      category: 'revenue',
      severity: 'critical',
      check: (revenue: any) => {
        const total = revenue.totalRevenue || 0;
        const calculated = (revenue.roomRevenue || 0) + (revenue.additionalRevenue || 0);
        const diff = Math.abs(total - calculated);
        
        return {
          passed: diff < 0.01,
          message: diff >= 0.01 
            ? `매출 불일치: 차이 ${diff.toFixed(2)}원`
            : '매출 일관성 확인됨',
          details: { total, calculated, difference: diff }
        };
      }
    });

    this.addRule({
      id: 'REV-002',
      name: '채널별 매출 일관성',
      description: '총 매출 = 온라인 매출 + 오프라인 매출',
      category: 'revenue',
      severity: 'high',
      check: (revenue: any) => {
        const total = revenue.totalRevenue || 0;
        const channelTotal = (revenue.onlineRevenue || 0) + (revenue.offlineRevenue || 0);
        const diff = Math.abs(total - channelTotal);
        
        return {
          passed: diff < 0.01 || channelTotal === 0,
          message: diff >= 0.01 && channelTotal > 0
            ? `채널별 매출 불일치: 차이 ${diff.toFixed(2)}원`
            : '채널별 매출 일관성 확인됨',
          details: { total, channelTotal, difference: diff }
        };
      }
    });

    this.addRule({
      id: 'REV-003',
      name: '결제 수단별 매출 일관성',
      description: '총 매출 = 현금 + 카드 + 계좌이체',
      category: 'revenue',
      severity: 'medium',
      check: (revenue: any) => {
        const total = revenue.totalRevenue || 0;
        const paymentTotal = (revenue.cashRevenue || 0) + 
                           (revenue.cardRevenue || 0) + 
                           (revenue.transferRevenue || 0);
        const diff = Math.abs(total - paymentTotal);
        
        return {
          passed: diff < 0.01 || paymentTotal === 0,
          message: diff >= 0.01 && paymentTotal > 0
            ? `결제 수단별 매출 불일치: 차이 ${diff.toFixed(2)}원`
            : '결제 수단별 매출 일관성 확인됨',
          details: { total, paymentTotal, difference: diff }
        };
      }
    });

    this.addRule({
      id: 'REV-004',
      name: '매출 범위 검증',
      description: '매출이 합리적인 범위 내에 있는지 확인',
      category: 'revenue',
      severity: 'medium',
      check: (revenue: any) => {
        const total = revenue.totalRevenue || 0;
        const maxReasonableRevenue = 1000000000; // 10억원
        
        return {
          passed: total >= 0 && total <= maxReasonableRevenue,
          message: total < 0 
            ? '매출이 음수입니다'
            : total > maxReasonableRevenue
            ? `매출이 비정상적으로 높습니다 (${total.toLocaleString()}원)`
            : '매출 범위 정상',
          details: { total, maxReasonableRevenue }
        };
      }
    });

    // 객실 관련 규칙
    this.addRule({
      id: 'ROOM-001',
      name: '객실 점유율 범위',
      description: '점유율은 0-100% 사이여야 함',
      category: 'room',
      severity: 'critical',
      check: (room: any) => {
        const occupancyRate = room.occupancyRate || 0;
        
        return {
          passed: occupancyRate >= 0 && occupancyRate <= 100,
          message: occupancyRate < 0 || occupancyRate > 100
            ? `잘못된 점유율: ${occupancyRate}%`
            : '점유율 범위 정상',
          details: { occupancyRate }
        };
      }
    });

    this.addRule({
      id: 'ROOM-002',
      name: '객실 가격 논리',
      description: '주말/성수기 가격이 기본 가격보다 높아야 함',
      category: 'room',
      severity: 'low',
      check: (room: any) => {
        const base = room.basePrice || 0;
        const weekend = room.weekendPrice || 0;
        const peak = room.peakSeasonPrice || 0;
        
        const weekendOk = weekend === 0 || weekend >= base;
        const peakOk = peak === 0 || peak >= base;
        
        return {
          passed: weekendOk && peakOk,
          message: !weekendOk
            ? '주말 가격이 기본 가격보다 낮습니다'
            : !peakOk
            ? '성수기 가격이 기본 가격보다 낮습니다'
            : '가격 설정 정상',
          details: { base, weekend, peak },
          suggestions: !weekendOk || !peakOk
            ? ['가격 정책을 재검토하세요']
            : []
        };
      }
    });

    this.addRule({
      id: 'ROOM-003',
      name: '객실 수용 인원',
      description: '최대 인원 >= 기준 인원',
      category: 'room',
      severity: 'high',
      check: (room: any) => {
        const standard = room.capacity?.standard || 0;
        const maximum = room.capacity?.maximum || 0;
        
        return {
          passed: maximum >= standard && standard > 0,
          message: standard <= 0
            ? '기준 인원은 1명 이상이어야 합니다'
            : maximum < standard
            ? '최대 인원이 기준 인원보다 적습니다'
            : '수용 인원 설정 정상',
          details: { standard, maximum }
        };
      }
    });

    this.addRule({
      id: 'ROOM-004',
      name: '객실 매출 vs 예약',
      description: '매출이 있으면 예약도 있어야 함',
      category: 'room',
      severity: 'medium',
      check: (room: any) => {
        const revenue = room.totalRevenue || 0;
        const bookings = room.bookingCount || 0;
        
        const hasRevenueNoBookings = revenue > 0 && bookings === 0;
        const hasBookingsNoRevenue = bookings > 0 && revenue === 0;
        
        return {
          passed: !hasRevenueNoBookings && !hasBookingsNoRevenue,
          message: hasRevenueNoBookings
            ? '매출은 있지만 예약 건수가 0입니다'
            : hasBookingsNoRevenue
            ? '예약은 있지만 매출이 0입니다'
            : '매출과 예약 일관성 확인됨',
          details: { revenue, bookings }
        };
      }
    });

    // 광고 관련 규칙
    this.addRule({
      id: 'AD-001',
      name: '광고 지표 논리',
      description: '클릭 <= 노출, 전환 <= 클릭',
      category: 'advertisement',
      severity: 'critical',
      check: (ad: any) => {
        const impressions = ad.impressions || 0;
        const clicks = ad.clicks || 0;
        const conversions = ad.conversions || 0;
        
        const clicksOk = clicks <= impressions;
        const conversionsOk = conversions <= clicks;
        
        return {
          passed: clicksOk && conversionsOk,
          message: !clicksOk
            ? '클릭수가 노출수를 초과합니다'
            : !conversionsOk
            ? '전환수가 클릭수를 초과합니다'
            : '광고 지표 정상',
          details: { impressions, clicks, conversions }
        };
      }
    });

    this.addRule({
      id: 'AD-002',
      name: '광고 예산 관리',
      description: '지출이 예산을 초과하지 않아야 함',
      category: 'advertisement',
      severity: 'high',
      check: (ad: any) => {
        const budget = ad.budget || 0;
        const spend = ad.spend || 0;
        
        if (budget === 0) return { passed: true, message: '예산 미설정' };
        
        const overBudgetPercent = ((spend - budget) / budget) * 100;
        
        return {
          passed: spend <= budget,
          message: spend > budget
            ? `예산 초과: ${overBudgetPercent.toFixed(1)}%`
            : '예산 내 지출',
          details: { budget, spend, overBudgetPercent },
          suggestions: spend > budget
            ? ['예산 증액 검토', '광고 일시 중지 고려']
            : []
        };
      }
    });

    this.addRule({
      id: 'AD-003',
      name: 'ROI 기준',
      description: 'ROI가 최소 기준을 충족해야 함',
      category: 'advertisement',
      severity: 'medium',
      check: (ad: any) => {
        const spend = ad.spend || 0;
        const revenue = ad.revenue || 0;
        
        if (spend === 0) return { passed: true, message: '지출 없음' };
        
        const roi = ((revenue - spend) / spend) * 100;
        const minROI = -50; // 최소 -50%
        
        return {
          passed: roi >= minROI,
          message: roi < minROI
            ? `ROI가 매우 낮습니다: ${roi.toFixed(1)}%`
            : `ROI: ${roi.toFixed(1)}%`,
          details: { roi, minROI },
          suggestions: roi < 0
            ? ['광고 전략 재검토', '타겟팅 개선', '광고 소재 변경']
            : roi < 100
            ? ['광고 최적화 필요']
            : []
        };
      }
    });

    this.addRule({
      id: 'AD-004',
      name: 'CTR 이상치',
      description: 'CTR이 비정상적으로 높지 않아야 함',
      category: 'advertisement',
      severity: 'low',
      check: (ad: any) => {
        const impressions = ad.impressions || 0;
        const clicks = ad.clicks || 0;
        
        if (impressions === 0) return { passed: true, message: '노출 없음' };
        
        const ctr = (clicks / impressions) * 100;
        const maxReasonableCTR = 50; // 50%
        
        return {
          passed: ctr <= maxReasonableCTR,
          message: ctr > maxReasonableCTR
            ? `CTR이 비정상적으로 높습니다: ${ctr.toFixed(1)}%`
            : `CTR 정상: ${ctr.toFixed(1)}%`,
          details: { ctr, maxReasonableCTR },
          suggestions: ctr > maxReasonableCTR
            ? ['데이터 정확성 확인', '봇 트래픽 점검']
            : []
        };
      }
    });

    // 일반 규칙
    this.addRule({
      id: 'GEN-001',
      name: 'Firebase 필드 제한',
      description: '총 필드 수가 Firebase 제한 내에 있어야 함',
      category: 'general',
      severity: 'critical',
      check: (data: any) => {
        const fieldCount = this.estimateFieldCount(data);
        const maxFields = 500;
        const warningThreshold = 450;
        
        return {
          passed: fieldCount <= warningThreshold,
          message: fieldCount > maxFields
            ? `필드 수 초과: ${fieldCount}/${maxFields}`
            : fieldCount > warningThreshold
            ? `필드 수 경고: ${fieldCount}/${maxFields}`
            : `필드 수 정상: ${fieldCount}/${maxFields}`,
          details: { fieldCount, maxFields, warningThreshold },
          suggestions: fieldCount > warningThreshold
            ? ['데이터 구조 최적화', '불필요한 필드 제거', '데이터 분할 고려']
            : []
        };
      }
    });

    this.addRule({
      id: 'GEN-002',
      name: '데이터 완성도',
      description: '필수 데이터가 모두 입력되어 있어야 함',
      category: 'general',
      severity: 'high',
      check: (data: any) => {
        const missingFields: string[] = [];
        
        if (!data.pensionName) missingFields.push('펜션명');
        if (!data.monthYear) missingFields.push('년월');
        if (!data.revenue) missingFields.push('매출 정보');
        if (!data.rooms || data.rooms.length === 0) missingFields.push('객실 정보');
        
        return {
          passed: missingFields.length === 0,
          message: missingFields.length > 0
            ? `누락된 필드: ${missingFields.join(', ')}`
            : '필수 데이터 완성',
          details: { missingFields },
          suggestions: missingFields.length > 0
            ? missingFields.map(field => `${field} 입력 필요`)
            : []
        };
      }
    });
  }

  /**
   * 비즈니스 규칙 추가
   * @param {BusinessRule} rule - 추가할 규칙
   */
  addRule(rule: BusinessRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * 비즈니스 규칙 제거
   * @param {string} ruleId - 규칙 ID
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * 마케팅 데이터 전체 검증
   * @param {any} data - 마케팅 데이터
   * @returns {BusinessRuleCheckSummary} 검증 요약
   */
  checkMarketingData(data: any): BusinessRuleCheckSummary {
    const violations: BusinessRuleViolation[] = [];
    const recommendations: Set<string> = new Set();
    let passedRules = 0;
    let criticalFailures = 0;

    // 매출 규칙 검증
    if (data.revenue) {
      this.checkRulesByCategory('revenue', data.revenue, violations, recommendations);
    }

    // 객실 규칙 검증
    if (Array.isArray(data.rooms)) {
      data.rooms.forEach((room: any, index: number) => {
        const roomViolations: BusinessRuleViolation[] = [];
        this.checkRulesByCategory('room', room, roomViolations, recommendations);
        
        // 객실별 위반 사항에 인덱스 추가
        roomViolations.forEach(v => {
          v.message = `[객실 ${index + 1}] ${v.message}`;
          violations.push(v);
        });
      });
    }

    // 광고 규칙 검증
    if (Array.isArray(data.advertisements)) {
      data.advertisements.forEach((ad: any, index: number) => {
        const adViolations: BusinessRuleViolation[] = [];
        this.checkRulesByCategory('advertisement', ad, adViolations, recommendations);
        
        // 광고별 위반 사항에 인덱스 추가
        adViolations.forEach(v => {
          v.message = `[광고 ${index + 1}] ${v.message}`;
          violations.push(v);
        });
      });
    }

    // 일반 규칙 검증
    this.checkRulesByCategory('general', data, violations, recommendations);

    // 통계 계산
    const totalRules = this.rules.size;
    const failedRules = violations.length;
    passedRules = totalRules - failedRules;
    criticalFailures = violations.filter(v => v.severity === 'critical').length;

    // 점수 계산 (critical: -20, high: -10, medium: -5, low: -2)
    let score = 100;
    violations.forEach(v => {
      switch (v.severity) {
        case 'critical': score -= 20; break;
        case 'high': score -= 10; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
      }
    });
    score = Math.max(0, score);

    return {
      totalRules,
      passedRules,
      failedRules,
      criticalFailures,
      violations,
      score,
      recommendations: Array.from(recommendations)
    };
  }

  /**
   * 카테고리별 규칙 검증
   * @private
   */
  private checkRulesByCategory(
    category: string,
    data: any,
    violations: BusinessRuleViolation[],
    recommendations: Set<string>
  ): void {
    this.rules.forEach(rule => {
      if (rule.category === category) {
        const result = rule.check(data);
        
        if (!result.passed) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            message: result.message || rule.description,
            details: result.details
          });

          if (result.suggestions) {
            result.suggestions.forEach(s => recommendations.add(s));
          }
        }

        // 히스토리 기록
        if (!this.ruleHistory.has(rule.id)) {
          this.ruleHistory.set(rule.id, []);
        }
        this.ruleHistory.get(rule.id)!.push(result);
      }
    });
  }

  /**
   * 필드 수 추정
   * @private
   */
  private estimateFieldCount(data: any): number {
    let count = 0;

    const countFields = (obj: any, depth: number = 0): void => {
      if (depth > 10) return; // 무한 재귀 방지

      Object.entries(obj || {}).forEach(([key, value]) => {
        count++;
        
        if (Array.isArray(value)) {
          value.forEach(item => {
            if (typeof item === 'object' && item !== null) {
              countFields(item, depth + 1);
            } else {
              count++;
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          countFields(value, depth + 1);
        }
      });
    };

    countFields(data);
    return count;
  }

  /**
   * 규칙 실행 히스토리 조회
   * @param {string} ruleId - 규칙 ID
   * @returns {BusinessRuleResult[]} 실행 결과 배열
   */
  getRuleHistory(ruleId: string): BusinessRuleResult[] {
    return this.ruleHistory.get(ruleId) || [];
  }

  /**
   * 히스토리 초기화
   */
  clearHistory(): void {
    this.ruleHistory.clear();
  }

  /**
   * 모든 규칙 조회
   * @returns {BusinessRule[]} 규칙 배열
   */
  getAllRules(): BusinessRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 카테고리별 규칙 조회
   * @param {string} category - 카테고리
   * @returns {BusinessRule[]} 규칙 배열
   */
  getRulesByCategory(category: string): BusinessRule[] {
    return Array.from(this.rules.values()).filter(r => r.category === category);
  }

  /**
   * 심각도별 규칙 조회
   * @param {string} severity - 심각도
   * @returns {BusinessRule[]} 규칙 배열
   */
  getRulesBySeverity(severity: string): BusinessRule[] {
    return Array.from(this.rules.values()).filter(r => r.severity === severity);
  }
}

// 싱글톤 인스턴스
export const businessRuleChecker = new BusinessRuleChecker();