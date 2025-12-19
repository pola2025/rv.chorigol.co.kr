/**
 * @fileoverview Percentage Value Object
 * @description 백분율을 표현하는 불변 값 객체
 */

/**
 * 백분율 표시 형식
 */
export enum PercentageFormat {
  DECIMAL = 'DECIMAL',     // 0.15 (15%)
  PERCENTAGE = 'PERCENTAGE', // 15 (15%)
  BASIS_POINTS = 'BASIS_POINTS' // 1500 (15%)
}

/**
 * Percentage Value Object
 * @class
 * @description 백분율을 캡슐화하는 불변 값 객체
 */
export class Percentage {
  private readonly _value: number; // 내부적으로는 소수점 형태로 저장 (0.15 = 15%)

  /**
   * Percentage 생성자
   * @param {number} value - 백분율 값
   * @param {PercentageFormat} format - 입력 형식 (기본: PERCENTAGE)
   */
  constructor(value: number, format: PercentageFormat = PercentageFormat.PERCENTAGE) {
    this._value = this.normalize(value, format);
    this.validate();
  }

  /**
   * 입력값을 소수점 형태로 정규화
   * @private
   * @param {number} value - 입력 값
   * @param {PercentageFormat} format - 입력 형식
   * @returns {number} 정규화된 값
   */
  private normalize(value: number, format: PercentageFormat): number {
    switch (format) {
      case PercentageFormat.DECIMAL:
        return value;
      case PercentageFormat.PERCENTAGE:
        return value / 100;
      case PercentageFormat.BASIS_POINTS:
        return value / 10000;
      default:
        throw new Error(`알 수 없는 형식: ${format}`);
    }
  }

  /**
   * 유효성 검증
   * @private
   * @throws {Error} 유효성 검증 실패 시
   */
  private validate(): void {
    if (typeof this._value !== 'number' || isNaN(this._value)) {
      throw new Error('백분율은 유효한 숫자여야 합니다.');
    }

    // 일반적으로 -100% ~ 1000% 범위를 허용
    if (this._value < -1 || this._value > 10) {
      console.warn(`비정상적인 백분율 값: ${this._value * 100}%`);
    }
  }

  /**
   * 덧셈 연산
   * @param {Percentage} other - 더할 Percentage 객체
   * @returns {Percentage} 새로운 Percentage 인스턴스
   */
  add(other: Percentage): Percentage {
    return new Percentage(this._value + other._value, PercentageFormat.DECIMAL);
  }

  /**
   * 뺄셈 연산
   * @param {Percentage} other - 뺄 Percentage 객체
   * @returns {Percentage} 새로운 Percentage 인스턴스
   */
  subtract(other: Percentage): Percentage {
    return new Percentage(this._value - other._value, PercentageFormat.DECIMAL);
  }

  /**
   * 곱셈 연산
   * @param {number} multiplier - 곱할 수
   * @returns {Percentage} 새로운 Percentage 인스턴스
   */
  multiply(multiplier: number): Percentage {
    if (typeof multiplier !== 'number' || isNaN(multiplier)) {
      throw new Error('곱셈 인자는 유효한 숫자여야 합니다.');
    }
    return new Percentage(this._value * multiplier, PercentageFormat.DECIMAL);
  }

  /**
   * 나눗셈 연산
   * @param {number} divisor - 나눌 수
   * @returns {Percentage} 새로운 Percentage 인스턴스
   * @throws {Error} 0으로 나누는 경우
   */
  divide(divisor: number): Percentage {
    if (typeof divisor !== 'number' || isNaN(divisor)) {
      throw new Error('나눗셈 인자는 유효한 숫자여야 합니다.');
    }
    if (divisor === 0) {
      throw new Error('0으로 나눌 수 없습니다.');
    }
    return new Percentage(this._value / divisor, PercentageFormat.DECIMAL);
  }

  /**
   * 값에 백분율 적용
   * @param {number} baseValue - 기준 값
   * @returns {number} 계산된 값
   */
  of(baseValue: number): number {
    if (typeof baseValue !== 'number' || isNaN(baseValue)) {
      throw new Error('기준 값은 유효한 숫자여야 합니다.');
    }
    return baseValue * this._value;
  }

  /**
   * 증가율 계산
   * @param {number} originalValue - 원래 값
   * @param {number} newValue - 새로운 값
   * @returns {Percentage} 증가율
   */
  static growth(originalValue: number, newValue: number): Percentage {
    if (originalValue === 0) {
      if (newValue === 0) {
        return new Percentage(0, PercentageFormat.DECIMAL);
      }
      // 무한대 방지
      return new Percentage(newValue > 0 ? 1 : -1, PercentageFormat.DECIMAL);
    }
    
    const growthRate = (newValue - originalValue) / Math.abs(originalValue);
    return new Percentage(growthRate, PercentageFormat.DECIMAL);
  }

  /**
   * 비율 계산
   * @param {number} part - 부분
   * @param {number} whole - 전체
   * @returns {Percentage} 비율
   */
  static ratio(part: number, whole: number): Percentage {
    if (whole === 0) {
      throw new Error('전체 값이 0일 수 없습니다.');
    }
    
    return new Percentage(part / whole, PercentageFormat.DECIMAL);
  }

  /**
   * 여러 백분율의 평균
   * @param {Percentage[]} percentages - Percentage 배열
   * @returns {Percentage} 평균 백분율
   */
  static average(percentages: Percentage[]): Percentage {
    if (!percentages || percentages.length === 0) {
      return new Percentage(0, PercentageFormat.DECIMAL);
    }
    
    const sum = percentages.reduce((acc, p) => acc + p._value, 0);
    return new Percentage(sum / percentages.length, PercentageFormat.DECIMAL);
  }

  /**
   * 가중 평균 계산
   * @param {Array<{percentage: Percentage, weight: number}>} items - 백분율과 가중치 배열
   * @returns {Percentage} 가중 평균
   */
  static weightedAverage(items: Array<{percentage: Percentage, weight: number}>): Percentage {
    if (!items || items.length === 0) {
      return new Percentage(0, PercentageFormat.DECIMAL);
    }
    
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) {
      throw new Error('가중치 합계가 0일 수 없습니다.');
    }
    
    const weightedSum = items.reduce(
      (sum, item) => sum + (item.percentage._value * item.weight),
      0
    );
    
    return new Percentage(weightedSum / totalWeight, PercentageFormat.DECIMAL);
  }

  /**
   * 복리 계산
   * @param {number} periods - 기간 수
   * @returns {Percentage} 복리 적용된 백분율
   */
  compound(periods: number): Percentage {
    if (periods < 0) {
      throw new Error('기간은 0 이상이어야 합니다.');
    }
    
    const compounded = Math.pow(1 + this._value, periods) - 1;
    return new Percentage(compounded, PercentageFormat.DECIMAL);
  }

  /**
   * 역수 계산 (예: 20% -> 80%)
   * @returns {Percentage} 역수 백분율
   */
  complement(): Percentage {
    return new Percentage(1 - this._value, PercentageFormat.DECIMAL);
  }

  /**
   * 절대값
   * @returns {Percentage} 절대값 백분율
   */
  abs(): Percentage {
    return new Percentage(Math.abs(this._value), PercentageFormat.DECIMAL);
  }

  /**
   * 반올림
   * @param {number} decimalPlaces - 소수점 자리수 (백분율 기준)
   * @returns {Percentage} 반올림된 백분율
   */
  round(decimalPlaces: number = 2): Percentage {
    const factor = Math.pow(10, decimalPlaces + 2); // 백분율로 변환 후 반올림
    const rounded = Math.round(this._value * factor) / factor;
    return new Percentage(rounded, PercentageFormat.DECIMAL);
  }

  /**
   * 소수점 형태로 반환
   * @returns {number} 소수점 값 (0.15 = 15%)
   */
  toDecimal(): number {
    return this._value;
  }

  /**
   * 백분율 형태로 반환
   * @returns {number} 백분율 값 (15 = 15%)
   */
  toPercentage(): number {
    return this._value * 100;
  }

  /**
   * 베이시스 포인트로 반환
   * @returns {number} 베이시스 포인트 값 (1500 = 15%)
   */
  toBasisPoints(): number {
    return this._value * 10000;
  }

  /**
   * 포맷팅된 문자열 반환
   * @param {number} decimalPlaces - 소수점 자리수
   * @param {boolean} includeSign - 양수 부호 포함 여부
   * @returns {string} 포맷팅된 백분율 문자열
   */
  format(decimalPlaces: number = 2, includeSign: boolean = false): string {
    const percentage = this._value * 100;
    const formatted = percentage.toFixed(decimalPlaces);
    const sign = includeSign && percentage > 0 ? '+' : '';
    return `${sign}${formatted}%`;
  }

  /**
   * 화살표와 함께 포맷팅 (증감률 표시용)
   * @param {number} decimalPlaces - 소수점 자리수
   * @returns {string} 화살표가 포함된 백분율 문자열
   */
  formatWithArrow(decimalPlaces: number = 2): string {
    const percentage = this._value * 100;
    const formatted = Math.abs(percentage).toFixed(decimalPlaces);
    
    if (percentage > 0) {
      return `↑ ${formatted}%`;
    } else if (percentage < 0) {
      return `↓ ${formatted}%`;
    } else {
      return `→ ${formatted}%`;
    }
  }

  /**
   * 문자열 표현
   * @returns {string} 백분율 문자열
   */
  toString(): string {
    return this.format();
  }

  /**
   * JSON 직렬화
   * @returns {object} JSON 객체
   */
  toJSON(): { value: number; percentage: number; formatted: string } {
    return {
      value: this._value,
      percentage: this.toPercentage(),
      formatted: this.format()
    };
  }

  /**
   * 비교: 같음
   * @param {Percentage} other - 비교할 Percentage
   * @returns {boolean} 같은지 여부
   */
  equals(other: Percentage): boolean {
    if (!other || !(other instanceof Percentage)) return false;
    // 부동소수점 오차 고려
    return Math.abs(this._value - other._value) < 0.0000001;
  }

  /**
   * 비교: 큼
   * @param {Percentage} other - 비교할 Percentage
   * @returns {boolean} 큰지 여부
   */
  greaterThan(other: Percentage): boolean {
    return this._value > other._value;
  }

  /**
   * 비교: 크거나 같음
   * @param {Percentage} other - 비교할 Percentage
   * @returns {boolean} 크거나 같은지 여부
   */
  greaterThanOrEqual(other: Percentage): boolean {
    return this._value >= other._value;
  }

  /**
   * 비교: 작음
   * @param {Percentage} other - 비교할 Percentage
   * @returns {boolean} 작은지 여부
   */
  lessThan(other: Percentage): boolean {
    return this._value < other._value;
  }

  /**
   * 비교: 작거나 같음
   * @param {Percentage} other - 비교할 Percentage
   * @returns {boolean} 작거나 같은지 여부
   */
  lessThanOrEqual(other: Percentage): boolean {
    return this._value <= other._value;
  }

  /**
   * 0인지 확인
   * @returns {boolean} 0인지 여부
   */
  isZero(): boolean {
    return Math.abs(this._value) < 0.0000001;
  }

  /**
   * 양수인지 확인
   * @returns {boolean} 양수인지 여부
   */
  isPositive(): boolean {
    return this._value > 0;
  }

  /**
   * 음수인지 확인
   * @returns {boolean} 음수인지 여부
   */
  isNegative(): boolean {
    return this._value < 0;
  }

  // Getter
  get value(): number {
    return this._value;
  }

  /**
   * 문자열에서 Percentage 생성
   * @static
   * @param {string} str - 백분율 문자열 (예: "15%", "15.5%", "+10%")
   * @returns {Percentage} Percentage 객체
   */
  static parse(str: string): Percentage {
    const cleanStr = str.replace(/[^\d.-]/g, '');
    const value = parseFloat(cleanStr);
    
    if (isNaN(value)) {
      throw new Error(`유효하지 않은 백분율 문자열: ${str}`);
    }
    
    // 문자열에 %가 있으면 PERCENTAGE 형식으로 파싱
    const format = str.includes('%') ? PercentageFormat.PERCENTAGE : PercentageFormat.DECIMAL;
    return new Percentage(value, format);
  }

  /**
   * 최대값
   * @static
   * @param {Percentage[]} percentages - Percentage 배열
   * @returns {Percentage} 최대 Percentage
   */
  static max(...percentages: Percentage[]): Percentage {
    if (percentages.length === 0) {
      throw new Error('Percentage 배열이 비어있습니다.');
    }
    
    const maxValue = Math.max(...percentages.map(p => p._value));
    return new Percentage(maxValue, PercentageFormat.DECIMAL);
  }

  /**
   * 최소값
   * @static
   * @param {Percentage[]} percentages - Percentage 배열
   * @returns {Percentage} 최소 Percentage
   */
  static min(...percentages: Percentage[]): Percentage {
    if (percentages.length === 0) {
      throw new Error('Percentage 배열이 비어있습니다.');
    }
    
    const minValue = Math.min(...percentages.map(p => p._value));
    return new Percentage(minValue, PercentageFormat.DECIMAL);
  }
}

/**
 * Percentage 팩토리 함수
 * @param {number} value - 백분율 값
 * @param {PercentageFormat} format - 입력 형식
 * @returns {Percentage} Percentage 인스턴스
 */
export function createPercentage(
  value: number, 
  format: PercentageFormat = PercentageFormat.PERCENTAGE
): Percentage {
  return new Percentage(value, format);
}

/**
 * 퍼센트 생성 헬퍼
 * @param {number} value - 백분율 값 (15 = 15%)
 * @returns {Percentage} Percentage 인스턴스
 */
export function percent(value: number): Percentage {
  return new Percentage(value, PercentageFormat.PERCENTAGE);
}

/**
 * 소수점 생성 헬퍼
 * @param {number} value - 소수점 값 (0.15 = 15%)
 * @returns {Percentage} Percentage 인스턴스
 */
export function decimal(value: number): Percentage {
  return new Percentage(value, PercentageFormat.DECIMAL);
}

/**
 * 베이시스 포인트 생성 헬퍼
 * @param {number} value - 베이시스 포인트 값 (1500 = 15%)
 * @returns {Percentage} Percentage 인스턴스
 */
export function basisPoints(value: number): Percentage {
  return new Percentage(value, PercentageFormat.BASIS_POINTS);
}