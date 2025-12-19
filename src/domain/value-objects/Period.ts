/**
 * @fileoverview Period Value Object
 * @description 기간을 표현하는 불변 값 객체
 */

/**
 * 기간 단위 열거형
 */
export enum PeriodUnit {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR'
}

/**
 * Period Value Object
 * @class
 * @description 시작일과 종료일로 구성된 기간을 캡슐화하는 불변 값 객체
 */
export class Period {
  private readonly _startDate: Date;
  private readonly _endDate: Date;

  /**
   * Period 생성자
   * @param {Date | string} startDate - 시작 날짜
   * @param {Date | string} endDate - 종료 날짜
   */
  constructor(startDate: Date | string, endDate: Date | string) {
    this._startDate = this.parseDate(startDate);
    this._endDate = this.parseDate(endDate);
    
    this.validate();
  }

  /**
   * 날짜 파싱
   * @private
   * @param {Date | string} date - 파싱할 날짜
   * @returns {Date} Date 객체
   */
  private parseDate(date: Date | string): Date {
    if (date instanceof Date) {
      return new Date(date.getTime());
    }
    
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`유효하지 않은 날짜: ${date}`);
    }
    
    return parsed;
  }

  /**
   * 유효성 검증
   * @private
   * @throws {Error} 유효성 검증 실패 시
   */
  private validate(): void {
    if (this._endDate < this._startDate) {
      throw new Error('종료 날짜는 시작 날짜 이후여야 합니다.');
    }

    // 비현실적인 기간 체크 (100년 이상)
    const yearsDiff = this.getYears();
    if (yearsDiff > 100) {
      throw new Error('기간이 너무 깁니다 (최대 100년).');
    }
  }

  /**
   * 기간에 특정 날짜가 포함되는지 확인
   * @param {Date | string} date - 확인할 날짜
   * @returns {boolean} 포함 여부
   */
  contains(date: Date | string): boolean {
    const checkDate = this.parseDate(date);
    return checkDate >= this._startDate && checkDate <= this._endDate;
  }

  /**
   * 다른 기간과 겹치는지 확인
   * @param {Period} other - 비교할 Period
   * @returns {boolean} 겹침 여부
   */
  overlaps(other: Period): boolean {
    return this._startDate <= other._endDate && this._endDate >= other._startDate;
  }

  /**
   * 다른 기간을 포함하는지 확인
   * @param {Period} other - 비교할 Period
   * @returns {boolean} 포함 여부
   */
  includes(other: Period): boolean {
    return this._startDate <= other._startDate && this._endDate >= other._endDate;
  }

  /**
   * 두 기간의 교집합
   * @param {Period} other - 비교할 Period
   * @returns {Period | null} 교집합 Period 또는 null
   */
  intersection(other: Period): Period | null {
    if (!this.overlaps(other)) {
      return null;
    }

    const start = new Date(Math.max(this._startDate.getTime(), other._startDate.getTime()));
    const end = new Date(Math.min(this._endDate.getTime(), other._endDate.getTime()));
    
    return new Period(start, end);
  }

  /**
   * 두 기간의 합집합
   * @param {Period} other - 비교할 Period
   * @returns {Period} 합집합 Period
   * @throws {Error} 기간이 연속되지 않은 경우
   */
  union(other: Period): Period {
    if (!this.overlaps(other) && !this.isAdjacent(other)) {
      throw new Error('기간이 연속되지 않아 합칠 수 없습니다.');
    }

    const start = new Date(Math.min(this._startDate.getTime(), other._startDate.getTime()));
    const end = new Date(Math.max(this._endDate.getTime(), other._endDate.getTime()));
    
    return new Period(start, end);
  }

  /**
   * 인접한 기간인지 확인
   * @param {Period} other - 비교할 Period
   * @returns {boolean} 인접 여부
   */
  isAdjacent(other: Period): boolean {
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Math.abs(this._endDate.getTime() - other._startDate.getTime()) <= oneDayMs ||
           Math.abs(this._startDate.getTime() - other._endDate.getTime()) <= oneDayMs;
  }

  /**
   * 기간 확장
   * @param {number} days - 확장할 일수
   * @param {boolean} expandStart - true면 시작일 확장, false면 종료일 확장
   * @returns {Period} 새로운 Period
   */
  extend(days: number, expandStart: boolean = false): Period {
    const msPerDay = 24 * 60 * 60 * 1000;
    
    if (expandStart) {
      const newStart = new Date(this._startDate.getTime() - (days * msPerDay));
      return new Period(newStart, this._endDate);
    } else {
      const newEnd = new Date(this._endDate.getTime() + (days * msPerDay));
      return new Period(this._startDate, newEnd);
    }
  }

  /**
   * 기간 축소
   * @param {number} days - 축소할 일수
   * @param {boolean} shrinkStart - true면 시작일 축소, false면 종료일 축소
   * @returns {Period} 새로운 Period
   */
  shrink(days: number, shrinkStart: boolean = false): Period {
    const msPerDay = 24 * 60 * 60 * 1000;
    
    if (shrinkStart) {
      const newStart = new Date(this._startDate.getTime() + (days * msPerDay));
      if (newStart > this._endDate) {
        throw new Error('축소 후 시작일이 종료일보다 늦습니다.');
      }
      return new Period(newStart, this._endDate);
    } else {
      const newEnd = new Date(this._endDate.getTime() - (days * msPerDay));
      if (newEnd < this._startDate) {
        throw new Error('축소 후 종료일이 시작일보다 빠릅니다.');
      }
      return new Period(this._startDate, newEnd);
    }
  }

  /**
   * 기간 이동
   * @param {number} days - 이동할 일수 (양수: 미래로, 음수: 과거로)
   * @returns {Period} 새로운 Period
   */
  shift(days: number): Period {
    const msPerDay = 24 * 60 * 60 * 1000;
    const newStart = new Date(this._startDate.getTime() + (days * msPerDay));
    const newEnd = new Date(this._endDate.getTime() + (days * msPerDay));
    
    return new Period(newStart, newEnd);
  }

  /**
   * 일 단위 기간 계산
   * @returns {number} 일수
   */
  getDays(): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((this._endDate.getTime() - this._startDate.getTime()) / msPerDay) + 1;
  }

  /**
   * 주 단위 기간 계산
   * @returns {number} 주수
   */
  getWeeks(): number {
    return Math.floor(this.getDays() / 7);
  }

  /**
   * 월 단위 기간 계산
   * @returns {number} 개월수
   */
  getMonths(): number {
    const yearDiff = this._endDate.getFullYear() - this._startDate.getFullYear();
    const monthDiff = this._endDate.getMonth() - this._startDate.getMonth();
    return yearDiff * 12 + monthDiff;
  }

  /**
   * 분기 단위 기간 계산
   * @returns {number} 분기수
   */
  getQuarters(): number {
    return Math.floor(this.getMonths() / 3);
  }

  /**
   * 년 단위 기간 계산
   * @returns {number} 년수
   */
  getYears(): number {
    return this._endDate.getFullYear() - this._startDate.getFullYear();
  }

  /**
   * 영업일 계산 (주말 제외)
   * @returns {number} 영업일수
   */
  getBusinessDays(): number {
    let count = 0;
    const current = new Date(this._startDate);
    
    while (current <= this._endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0: 일요일, 6: 토요일
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  /**
   * 기간을 일별로 분할
   * @returns {Date[]} 날짜 배열
   */
  toDayArray(): Date[] {
    const days: Date[] = [];
    const current = new Date(this._startDate);
    
    while (current <= this._endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }

  /**
   * 기간을 월별로 분할
   * @returns {Period[]} Period 배열
   */
  toMonthlyPeriods(): Period[] {
    const periods: Period[] = [];
    const current = new Date(this._startDate);
    
    while (current <= this._endDate) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      
      const periodStart = monthStart < this._startDate ? this._startDate : monthStart;
      const periodEnd = monthEnd > this._endDate ? this._endDate : monthEnd;
      
      periods.push(new Period(periodStart, periodEnd));
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return periods;
  }

  /**
   * 포맷팅된 문자열 반환
   * @param {string} format - 날짜 포맷 (기본: YYYY-MM-DD)
   * @returns {string} 포맷팅된 기간 문자열
   */
  format(format: string = 'YYYY-MM-DD'): string {
    const formatDate = (date: Date): string => {
      return format
        .replace('YYYY', date.getFullYear().toString())
        .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(date.getDate()).padStart(2, '0'));
    };

    return `${formatDate(this._startDate)} ~ ${formatDate(this._endDate)}`;
  }

  /**
   * ISO 문자열 반환
   * @returns {string} ISO 형식 기간 문자열
   */
  toISOString(): string {
    return `${this._startDate.toISOString()}/${this._endDate.toISOString()}`;
  }

  /**
   * 문자열 표현
   * @returns {string} 기간 문자열
   */
  toString(): string {
    return this.format();
  }

  /**
   * JSON 직렬화
   * @returns {object} JSON 객체
   */
  toJSON(): { startDate: string; endDate: string; days: number } {
    return {
      startDate: this._startDate.toISOString(),
      endDate: this._endDate.toISOString(),
      days: this.getDays()
    };
  }

  /**
   * 같은 기간인지 비교
   * @param {Period} other - 비교할 Period
   * @returns {boolean} 같은지 여부
   */
  equals(other: Period): boolean {
    if (!other || !(other instanceof Period)) return false;
    return this._startDate.getTime() === other._startDate.getTime() &&
           this._endDate.getTime() === other._endDate.getTime();
  }

  /**
   * 현재 날짜가 기간에 포함되는지 확인
   * @returns {boolean} 포함 여부
   */
  isCurrent(): boolean {
    return this.contains(new Date());
  }

  /**
   * 과거 기간인지 확인
   * @returns {boolean} 과거 여부
   */
  isPast(): boolean {
    return this._endDate < new Date();
  }

  /**
   * 미래 기간인지 확인
   * @returns {boolean} 미래 여부
   */
  isFuture(): boolean {
    return this._startDate > new Date();
  }

  // Getters
  get startDate(): Date {
    return new Date(this._startDate.getTime());
  }

  get endDate(): Date {
    return new Date(this._endDate.getTime());
  }

  /**
   * 이번 달 Period 생성
   * @static
   * @returns {Period} 이번 달 Period
   */
  static currentMonth(): Period {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return new Period(start, end);
  }

  /**
   * 이번 분기 Period 생성
   * @static
   * @returns {Period} 이번 분기 Period
   */
  static currentQuarter(): Period {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), quarter * 3, 1);
    const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    return new Period(start, end);
  }

  /**
   * 이번 년도 Period 생성
   * @static
   * @returns {Period} 이번 년도 Period
   */
  static currentYear(): Period {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return new Period(start, end);
  }

  /**
   * 특정 년월의 Period 생성
   * @static
   * @param {number} year - 년도
   * @param {number} month - 월 (1-12)
   * @returns {Period} 해당 년월 Period
   */
  static fromYearMonth(year: number, month: number): Period {
    if (month < 1 || month > 12) {
      throw new Error('월은 1-12 사이여야 합니다.');
    }
    
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return new Period(start, end);
  }

  /**
   * 문자열에서 Period 생성
   * @static
   * @param {string} str - 기간 문자열 (예: "2024-01-01~2024-12-31")
   * @returns {Period} Period 객체
   */
  static parse(str: string): Period {
    const parts = str.split(/[~-]/);
    if (parts.length !== 2) {
      throw new Error(`유효하지 않은 기간 문자열: ${str}`);
    }
    
    return new Period(parts[0].trim(), parts[1].trim());
  }
}

/**
 * Period 팩토리 함수
 * @param {Date | string} startDate - 시작 날짜
 * @param {Date | string} endDate - 종료 날짜
 * @returns {Period} Period 인스턴스
 */
export function createPeriod(startDate: Date | string, endDate: Date | string): Period {
  return new Period(startDate, endDate);
}