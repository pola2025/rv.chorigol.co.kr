/**
 * @fileoverview Domain Value Objects 통합 Export
 * @description 도메인 레이어의 모든 Value Objects를 중앙에서 관리
 */

// Money Value Object
export { 
  Money, 
  Currency,
  createMoney,
  won,
  dollar
} from './Money';

// Period Value Object
export { 
  Period,
  PeriodUnit,
  createPeriod
} from './Period';

// Percentage Value Object
export { 
  Percentage,
  PercentageFormat,
  createPercentage,
  percent,
  decimal,
  basisPoints
} from './Percentage';

// Value Object 유틸리티 타입
export type ValueObjectType = Money | Period | Percentage;

// Value Object 검증 인터페이스
export interface ValueObjectValidator<T> {
  validate(value: T): boolean;
  getErrorMessage(): string;
}

// 공통 Value Object 유틸리티
export class ValueObjectUtils {
  /**
   * Value Object인지 확인
   * @param {any} obj - 확인할 객체
   * @returns {boolean} Value Object 여부
   */
  static isValueObject(obj: any): obj is ValueObjectType {
    return obj instanceof Money || 
           obj instanceof Period || 
           obj instanceof Percentage;
  }

  /**
   * Value Object 타입 확인
   * @param {any} obj - 확인할 객체
   * @returns {string | null} Value Object 타입명
   */
  static getValueObjectType(obj: any): string | null {
    if (obj instanceof Money) return 'Money';
    if (obj instanceof Period) return 'Period';
    if (obj instanceof Percentage) return 'Percentage';
    return null;
  }

  /**
   * JSON에서 Value Object 복원
   * @param {any} json - JSON 객체
   * @param {string} type - Value Object 타입
   * @returns {ValueObjectType | null} 복원된 Value Object
   */
  static fromJSON(json: any, type: string): ValueObjectType | null {
    try {
      switch (type) {
        case 'Money':
          return new Money(json.amount, json.currency);
        case 'Period':
          return new Period(json.startDate, json.endDate);
        case 'Percentage':
          return new Percentage(json.value, PercentageFormat.DECIMAL);
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to restore ${type} from JSON:`, error);
      return null;
    }
  }
}

// 비즈니스 규칙에서 자주 사용되는 상수 Value Objects
export const ZERO_WON = won(0);
export const HUNDRED_PERCENT = percent(100);
export const ZERO_PERCENT = percent(0);
export const THIS_MONTH = Period.currentMonth();
export const THIS_YEAR = Period.currentYear();

// 유용한 팩토리 함수들
export const ValueObjectFactories = {
  /**
   * 년월에서 Period 생성
   * @param {string} yearMonth - YYYY-MM 형식
   * @returns {Period} Period 객체
   */
  periodFromYearMonth(yearMonth: string): Period {
    const [year, month] = yearMonth.split('-').map(Number);
    return Period.fromYearMonth(year, month);
  },

  /**
   * 금액 문자열에서 Money 생성
   * @param {string} amountStr - 금액 문자열
   * @returns {Money} Money 객체
   */
  moneyFromString(amountStr: string): Money {
    return Money.parse(amountStr, Currency.KRW);
  },

  /**
   * 비율에서 Percentage 생성
   * @param {number} numerator - 분자
   * @param {number} denominator - 분모
   * @returns {Percentage} Percentage 객체
   */
  percentageFromRatio(numerator: number, denominator: number): Percentage {
    return Percentage.ratio(numerator, denominator);
  }
};