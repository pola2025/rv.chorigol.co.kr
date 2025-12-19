/**
 * @fileoverview Money Value Object
 * @description 금액을 표현하는 불변 값 객체
 */

/**
 * 통화 타입 열거형
 */
export enum Currency {
  KRW = 'KRW',
  USD = 'USD',
  EUR = 'EUR',
  JPY = 'JPY',
  CNY = 'CNY'
}

/**
 * 통화별 정보
 */
const CURRENCY_INFO = {
  KRW: { symbol: '₩', decimals: 0, locale: 'ko-KR' },
  USD: { symbol: '$', decimals: 2, locale: 'en-US' },
  EUR: { symbol: '€', decimals: 2, locale: 'de-DE' },
  JPY: { symbol: '¥', decimals: 0, locale: 'ja-JP' },
  CNY: { symbol: '¥', decimals: 2, locale: 'zh-CN' }
};

/**
 * Money Value Object
 * @class
 * @description 금액과 통화를 캡슐화하는 불변 값 객체
 */
export class Money {
  private readonly _amount: number;
  private readonly _currency: Currency;

  /**
   * Money 생성자
   * @param {number} amount - 금액
   * @param {Currency} currency - 통화 (기본값: KRW)
   */
  constructor(amount: number, currency: Currency = Currency.KRW) {
    this.validate(amount, currency);
    
    // 통화별 소수점 처리
    const info = CURRENCY_INFO[currency];
    this._amount = Math.round(amount * Math.pow(10, info.decimals)) / Math.pow(10, info.decimals);
    this._currency = currency;
  }

  /**
   * 유효성 검증
   * @private
   * @param {number} amount - 검증할 금액
   * @param {Currency} currency - 검증할 통화
   * @throws {Error} 유효성 검증 실패 시
   */
  private validate(amount: number, currency: Currency): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('금액은 유효한 숫자여야 합니다.');
    }

    if (!currency || !Object.values(Currency).includes(currency)) {
      throw new Error('유효한 통화 타입이 아닙니다.');
    }

    // 금액 범위 검증 (부채는 음수 허용)
    if (amount < -999999999999 || amount > 999999999999) {
      throw new Error('금액이 유효한 범위를 벗어났습니다.');
    }
  }

  /**
   * 덧셈 연산
   * @param {Money} other - 더할 Money 객체
   * @returns {Money} 새로운 Money 인스턴스
   * @throws {Error} 통화가 다른 경우
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  /**
   * 뺄셈 연산
   * @param {Money} other - 뺄 Money 객체
   * @returns {Money} 새로운 Money 인스턴스
   * @throws {Error} 통화가 다른 경우
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  /**
   * 곱셈 연산
   * @param {number} multiplier - 곱할 수
   * @returns {Money} 새로운 Money 인스턴스
   */
  multiply(multiplier: number): Money {
    if (typeof multiplier !== 'number' || isNaN(multiplier)) {
      throw new Error('곱셈 인자는 유효한 숫자여야 합니다.');
    }
    return new Money(this._amount * multiplier, this._currency);
  }

  /**
   * 나눗셈 연산
   * @param {number} divisor - 나눌 수
   * @returns {Money} 새로운 Money 인스턴스
   * @throws {Error} 0으로 나누는 경우
   */
  divide(divisor: number): Money {
    if (typeof divisor !== 'number' || isNaN(divisor)) {
      throw new Error('나눗셈 인자는 유효한 숫자여야 합니다.');
    }
    if (divisor === 0) {
      throw new Error('0으로 나눌 수 없습니다.');
    }
    return new Money(this._amount / divisor, this._currency);
  }

  /**
   * 퍼센트 계산
   * @param {number} percentage - 퍼센트 (예: 10 = 10%)
   * @returns {Money} 새로운 Money 인스턴스
   */
  percentage(percentage: number): Money {
    if (typeof percentage !== 'number' || isNaN(percentage)) {
      throw new Error('퍼센트는 유효한 숫자여야 합니다.');
    }
    return new Money(this._amount * (percentage / 100), this._currency);
  }

  /**
   * 반올림
   * @param {number} decimals - 소수점 자리수
   * @returns {Money} 새로운 Money 인스턴스
   */
  round(decimals: number = 0): Money {
    const factor = Math.pow(10, decimals);
    return new Money(Math.round(this._amount * factor) / factor, this._currency);
  }

  /**
   * 올림
   * @returns {Money} 새로운 Money 인스턴스
   */
  ceil(): Money {
    return new Money(Math.ceil(this._amount), this._currency);
  }

  /**
   * 내림
   * @returns {Money} 새로운 Money 인스턴스
   */
  floor(): Money {
    return new Money(Math.floor(this._amount), this._currency);
  }

  /**
   * 절대값
   * @returns {Money} 새로운 Money 인스턴스
   */
  abs(): Money {
    return new Money(Math.abs(this._amount), this._currency);
  }

  /**
   * 음수로 변환
   * @returns {Money} 새로운 Money 인스턴스
   */
  negate(): Money {
    return new Money(-this._amount, this._currency);
  }

  /**
   * 같은 통화인지 확인
   * @private
   * @param {Money} other - 비교할 Money 객체
   * @throws {Error} 통화가 다른 경우
   */
  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(`통화가 일치하지 않습니다: ${this._currency} !== ${other._currency}`);
    }
  }

  /**
   * 비교: 같음
   * @param {Money} other - 비교할 Money 객체
   * @returns {boolean} 같은지 여부
   */
  equals(other: Money): boolean {
    if (!other || !(other instanceof Money)) return false;
    return this._amount === other._amount && this._currency === other._currency;
  }

  /**
   * 비교: 큼
   * @param {Money} other - 비교할 Money 객체
   * @returns {boolean} 큰지 여부
   * @throws {Error} 통화가 다른 경우
   */
  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  /**
   * 비교: 크거나 같음
   * @param {Money} other - 비교할 Money 객체
   * @returns {boolean} 크거나 같은지 여부
   * @throws {Error} 통화가 다른 경우
   */
  greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount >= other._amount;
  }

  /**
   * 비교: 작음
   * @param {Money} other - 비교할 Money 객체
   * @returns {boolean} 작은지 여부
   * @throws {Error} 통화가 다른 경우
   */
  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount < other._amount;
  }

  /**
   * 비교: 작거나 같음
   * @param {Money} other - 비교할 Money 객체
   * @returns {boolean} 작거나 같은지 여부
   * @throws {Error} 통화가 다른 경우
   */
  lessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount <= other._amount;
  }

  /**
   * 0인지 확인
   * @returns {boolean} 0인지 여부
   */
  isZero(): boolean {
    return this._amount === 0;
  }

  /**
   * 양수인지 확인
   * @returns {boolean} 양수인지 여부
   */
  isPositive(): boolean {
    return this._amount > 0;
  }

  /**
   * 음수인지 확인
   * @returns {boolean} 음수인지 여부
   */
  isNegative(): boolean {
    return this._amount < 0;
  }

  /**
   * 포맷팅된 문자열 반환
   * @param {object} options - 포맷 옵션
   * @returns {string} 포맷팅된 금액 문자열
   */
  format(options: Intl.NumberFormatOptions = {}): string {
    const info = CURRENCY_INFO[this._currency];
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: this._currency,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
      ...options
    }).format(this._amount);
  }

  /**
   * 간단한 포맷 (천 단위 구분)
   * @returns {string} 포맷팅된 금액 문자열
   */
  toFormattedString(): string {
    const info = CURRENCY_INFO[this._currency];
    return `${info.symbol}${this._amount.toLocaleString(info.locale)}`;
  }

  /**
   * 숫자 값 반환
   * @returns {number} 금액
   */
  toNumber(): number {
    return this._amount;
  }

  /**
   * 문자열 표현
   * @returns {string} 금액과 통화
   */
  toString(): string {
    return `${this._amount} ${this._currency}`;
  }

  /**
   * JSON 직렬화
   * @returns {object} JSON 객체
   */
  toJSON(): { amount: number; currency: Currency } {
    return {
      amount: this._amount,
      currency: this._currency
    };
  }

  // Getters
  get amount(): number {
    return this._amount;
  }

  get currency(): Currency {
    return this._currency;
  }

  /**
   * 통화 기호 반환
   * @returns {string} 통화 기호
   */
  get symbol(): string {
    return CURRENCY_INFO[this._currency].symbol;
  }

  /**
   * 여러 Money 객체의 합계
   * @static
   * @param {Money[]} moneys - Money 객체 배열
   * @param {Currency} currency - 기본 통화
   * @returns {Money} 합계 Money 객체
   */
  static sum(moneys: Money[], currency: Currency = Currency.KRW): Money {
    if (!moneys || moneys.length === 0) {
      return new Money(0, currency);
    }

    return moneys.reduce((acc, money) => acc.add(money), new Money(0, moneys[0].currency));
  }

  /**
   * 여러 Money 객체의 평균
   * @static
   * @param {Money[]} moneys - Money 객체 배열
   * @returns {Money} 평균 Money 객체
   */
  static average(moneys: Money[]): Money {
    if (!moneys || moneys.length === 0) {
      return new Money(0, Currency.KRW);
    }

    const sum = Money.sum(moneys);
    return sum.divide(moneys.length);
  }

  /**
   * 최대값
   * @static
   * @param {Money[]} moneys - Money 객체 배열
   * @returns {Money} 최대 Money 객체
   */
  static max(moneys: Money[]): Money {
    if (!moneys || moneys.length === 0) {
      throw new Error('Money 배열이 비어있습니다.');
    }

    return moneys.reduce((max, money) => 
      money.greaterThan(max) ? money : max
    );
  }

  /**
   * 최소값
   * @static
   * @param {Money[]} moneys - Money 객체 배열
   * @returns {Money} 최소 Money 객체
   */
  static min(moneys: Money[]): Money {
    if (!moneys || moneys.length === 0) {
      throw new Error('Money 배열이 비어있습니다.');
    }

    return moneys.reduce((min, money) => 
      money.lessThan(min) ? money : min
    );
  }

  /**
   * 문자열에서 Money 객체 생성
   * @static
   * @param {string} str - 금액 문자열 (예: "1,000,000", "$1,234.56")
   * @param {Currency} currency - 통화
   * @returns {Money} Money 객체
   */
  static parse(str: string, currency: Currency = Currency.KRW): Money {
    // 숫자가 아닌 문자 제거 (소수점과 음수 부호 제외)
    const cleanStr = str.replace(/[^0-9.-]/g, '');
    const amount = parseFloat(cleanStr);
    
    if (isNaN(amount)) {
      throw new Error(`유효하지 않은 금액 문자열: ${str}`);
    }

    return new Money(amount, currency);
  }
}

/**
 * Money 팩토리 함수
 * @param {number} amount - 금액
 * @param {Currency} currency - 통화
 * @returns {Money} Money 인스턴스
 */
export function createMoney(amount: number = 0, currency: Currency = Currency.KRW): Money {
  return new Money(amount, currency);
}

/**
 * 원화 Money 생성 헬퍼
 * @param {number} amount - 금액
 * @returns {Money} KRW Money 인스턴스
 */
export function won(amount: number): Money {
  return new Money(amount, Currency.KRW);
}

/**
 * 달러 Money 생성 헬퍼
 * @param {number} amount - 금액
 * @returns {Money} USD Money 인스턴스
 */
export function dollar(amount: number): Money {
  return new Money(amount, Currency.USD);
}