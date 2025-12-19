/**
 * @fileoverview Revenue 도메인 엔티티
 * @description 매출 관련 비즈니스 로직을 캡슐화하는 엔티티
 */

/**
 * Revenue 엔티티 인터페이스
 */
export interface IRevenue {
  totalRevenue: number;
  roomRevenue: number;
  additionalRevenue: number;
  onlineRevenue: number;
  offlineRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  transferRevenue: number;
  advanceBookingRevenue: number;
  onsiteBookingRevenue: number;
}

/**
 * Revenue 도메인 엔티티
 * @class
 * @description 매출 데이터의 핵심 비즈니스 로직을 캡슐화
 */
export class Revenue {
  private _totalRevenue: number;
  private _roomRevenue: number;
  private _additionalRevenue: number;
  private _onlineRevenue: number;
  private _offlineRevenue: number;
  private _cashRevenue: number;
  private _cardRevenue: number;
  private _transferRevenue: number;
  private _advanceBookingRevenue: number;
  private _onsiteBookingRevenue: number;

  /**
   * Revenue 생성자
   * @param {Partial<IRevenue>} data - 초기화 데이터
   */
  constructor(data: Partial<IRevenue> = {}) {
    this._totalRevenue = data.totalRevenue || 0;
    this._roomRevenue = data.roomRevenue || 0;
    this._additionalRevenue = data.additionalRevenue || 0;
    this._onlineRevenue = data.onlineRevenue || 0;
    this._offlineRevenue = data.offlineRevenue || 0;
    this._cashRevenue = data.cashRevenue || 0;
    this._cardRevenue = data.cardRevenue || 0;
    this._transferRevenue = data.transferRevenue || 0;
    this._advanceBookingRevenue = data.advanceBookingRevenue || 0;
    this._onsiteBookingRevenue = data.onsiteBookingRevenue || 0;

    this.validate();
  }

  /**
   * 데이터 유효성 검증
   * @private
   * @throws {Error} 유효성 검증 실패 시
   */
  private validate(): void {
    // 음수 체크
    const fields = [
      { name: '총 매출', value: this._totalRevenue },
      { name: '객실 매출', value: this._roomRevenue },
      { name: '부가 매출', value: this._additionalRevenue },
      { name: '온라인 매출', value: this._onlineRevenue },
      { name: '오프라인 매출', value: this._offlineRevenue },
      { name: '현금 매출', value: this._cashRevenue },
      { name: '카드 매출', value: this._cardRevenue },
      { name: '계좌이체 매출', value: this._transferRevenue },
      { name: '사전예약 매출', value: this._advanceBookingRevenue },
      { name: '현장예약 매출', value: this._onsiteBookingRevenue }
    ];

    fields.forEach(field => {
      if (field.value < 0) {
        throw new Error(`${field.name}은(는) 음수일 수 없습니다.`);
      }
    });

    // 비즈니스 규칙 검증
    this.validateBusinessRules();
  }

  /**
   * 비즈니스 규칙 검증
   * @private
   * @throws {Error} 비즈니스 규칙 위반 시
   */
  private validateBusinessRules(): void {
    // 총 매출 = 객실 매출 + 부가 매출
    const calculatedTotal = this._roomRevenue + this._additionalRevenue;
    if (Math.abs(this._totalRevenue - calculatedTotal) > 0.01) {
      console.warn(
        `총 매출(${this._totalRevenue})이 객실 매출(${this._roomRevenue}) + 부가 매출(${this._additionalRevenue})의 합(${calculatedTotal})과 일치하지 않습니다.`
      );
    }

    // 온라인 + 오프라인 = 총 매출
    const channelTotal = this._onlineRevenue + this._offlineRevenue;
    if (Math.abs(this._totalRevenue - channelTotal) > 0.01) {
      console.warn(
        `채널별 매출 합계(${channelTotal})가 총 매출(${this._totalRevenue})과 일치하지 않습니다.`
      );
    }

    // 결제 수단별 합계 검증
    const paymentTotal = this._cashRevenue + this._cardRevenue + this._transferRevenue;
    if (paymentTotal > 0 && Math.abs(this._totalRevenue - paymentTotal) > 0.01) {
      console.warn(
        `결제 수단별 매출 합계(${paymentTotal})가 총 매출(${this._totalRevenue})과 일치하지 않습니다.`
      );
    }

    // 예약 유형별 합계 검증
    const bookingTotal = this._advanceBookingRevenue + this._onsiteBookingRevenue;
    if (bookingTotal > 0 && Math.abs(this._totalRevenue - bookingTotal) > 0.01) {
      console.warn(
        `예약 유형별 매출 합계(${bookingTotal})가 총 매출(${this._totalRevenue})과 일치하지 않습니다.`
      );
    }
  }

  /**
   * 매출 정보 업데이트
   * @param {Partial<IRevenue>} updates - 업데이트할 필드
   * @returns {Revenue} 새로운 Revenue 인스턴스
   */
  update(updates: Partial<IRevenue>): Revenue {
    const newData: IRevenue = {
      totalRevenue: updates.totalRevenue ?? this._totalRevenue,
      roomRevenue: updates.roomRevenue ?? this._roomRevenue,
      additionalRevenue: updates.additionalRevenue ?? this._additionalRevenue,
      onlineRevenue: updates.onlineRevenue ?? this._onlineRevenue,
      offlineRevenue: updates.offlineRevenue ?? this._offlineRevenue,
      cashRevenue: updates.cashRevenue ?? this._cashRevenue,
      cardRevenue: updates.cardRevenue ?? this._cardRevenue,
      transferRevenue: updates.transferRevenue ?? this._transferRevenue,
      advanceBookingRevenue: updates.advanceBookingRevenue ?? this._advanceBookingRevenue,
      onsiteBookingRevenue: updates.onsiteBookingRevenue ?? this._onsiteBookingRevenue
    };

    return new Revenue(newData);
  }

  /**
   * 자동 계산된 총 매출 반환
   * @returns {number} 계산된 총 매출
   */
  calculateTotalRevenue(): number {
    return this._roomRevenue + this._additionalRevenue;
  }

  /**
   * 온라인 매출 비율 계산
   * @returns {number} 온라인 매출 비율 (%)
   */
  getOnlineRevenueRatio(): number {
    if (this._totalRevenue === 0) return 0;
    return (this._onlineRevenue / this._totalRevenue) * 100;
  }

  /**
   * 오프라인 매출 비율 계산
   * @returns {number} 오프라인 매출 비율 (%)
   */
  getOfflineRevenueRatio(): number {
    if (this._totalRevenue === 0) return 0;
    return (this._offlineRevenue / this._totalRevenue) * 100;
  }

  /**
   * 결제 수단별 비율 계산
   * @returns {object} 각 결제 수단의 비율
   */
  getPaymentRatios(): { cash: number; card: number; transfer: number } {
    const paymentTotal = this._cashRevenue + this._cardRevenue + this._transferRevenue;
    
    if (paymentTotal === 0) {
      return { cash: 0, card: 0, transfer: 0 };
    }

    return {
      cash: (this._cashRevenue / paymentTotal) * 100,
      card: (this._cardRevenue / paymentTotal) * 100,
      transfer: (this._transferRevenue / paymentTotal) * 100
    };
  }

  /**
   * 데이터를 일반 객체로 변환
   * @returns {IRevenue} 일반 객체 형태의 데이터
   */
  toObject(): IRevenue {
    return {
      totalRevenue: this._totalRevenue,
      roomRevenue: this._roomRevenue,
      additionalRevenue: this._additionalRevenue,
      onlineRevenue: this._onlineRevenue,
      offlineRevenue: this._offlineRevenue,
      cashRevenue: this._cashRevenue,
      cardRevenue: this._cardRevenue,
      transferRevenue: this._transferRevenue,
      advanceBookingRevenue: this._advanceBookingRevenue,
      onsiteBookingRevenue: this._onsiteBookingRevenue
    };
  }

  /**
   * Firebase 저장용 평면화된 데이터 생성
   * @returns {Record<string, number>} 평면화된 데이터
   */
  toFirebaseFormat(): Record<string, number> {
    return {
      total: this._totalRevenue,
      room: this._roomRevenue,
      additional: this._additionalRevenue,
      online: this._onlineRevenue,
      offline: this._offlineRevenue,
      cash: this._cashRevenue,
      card: this._cardRevenue,
      transfer: this._transferRevenue,
      advanceBooking: this._advanceBookingRevenue,
      onsiteBooking: this._onsiteBookingRevenue
    };
  }

  /**
   * 문자열 표현
   * @returns {string} 매출 요약 정보
   */
  toString(): string {
    return `Revenue: 총 ${this.formatCurrency(this._totalRevenue)} (객실: ${this.formatCurrency(this._roomRevenue)}, 부가: ${this.formatCurrency(this._additionalRevenue)})`;
  }

  /**
   * 통화 포맷팅
   * @private
   * @param {number} amount - 금액
   * @returns {string} 포맷팅된 금액
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  }

  // Getters
  get totalRevenue(): number {
    return this._totalRevenue;
  }

  get roomRevenue(): number {
    return this._roomRevenue;
  }

  get additionalRevenue(): number {
    return this._additionalRevenue;
  }

  get onlineRevenue(): number {
    return this._onlineRevenue;
  }

  get offlineRevenue(): number {
    return this._offlineRevenue;
  }

  get cashRevenue(): number {
    return this._cashRevenue;
  }

  get cardRevenue(): number {
    return this._cardRevenue;
  }

  get transferRevenue(): number {
    return this._transferRevenue;
  }

  get advanceBookingRevenue(): number {
    return this._advanceBookingRevenue;
  }

  get onsiteBookingRevenue(): number {
    return this._onsiteBookingRevenue;
  }

  /**
   * 불변성을 보장하는 복사본 생성
   * @returns {Revenue} 복사된 Revenue 인스턴스
   */
  clone(): Revenue {
    return new Revenue(this.toObject());
  }

  /**
   * 두 Revenue 인스턴스가 같은지 비교
   * @param {Revenue} other - 비교할 Revenue 인스턴스
   * @returns {boolean} 동일 여부
   */
  equals(other: Revenue): boolean {
    if (!other) return false;
    
    return (
      this._totalRevenue === other._totalRevenue &&
      this._roomRevenue === other._roomRevenue &&
      this._additionalRevenue === other._additionalRevenue &&
      this._onlineRevenue === other._onlineRevenue &&
      this._offlineRevenue === other._offlineRevenue &&
      this._cashRevenue === other._cashRevenue &&
      this._cardRevenue === other._cardRevenue &&
      this._transferRevenue === other._transferRevenue &&
      this._advanceBookingRevenue === other._advanceBookingRevenue &&
      this._onsiteBookingRevenue === other._onsiteBookingRevenue
    );
  }
}

/**
 * Revenue 팩토리 함수
 * @param {Partial<IRevenue>} data - 부분적인 초기화 데이터
 * @returns {Revenue} 생성된 Revenue 인스턴스
 */
export function createRevenue(data: Partial<IRevenue> = {}): Revenue {
  return new Revenue(data);
}