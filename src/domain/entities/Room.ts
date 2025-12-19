/**
 * @fileoverview Room 도메인 엔티티
 * @description 객실 관련 비즈니스 로직을 캡슐화하는 엔티티
 */

/**
 * Room 엔티티 인터페이스
 */
export interface IRoom {
  roomName: string;
  roomType: RoomType;
  basePrice: number;
  weekendPrice: number;
  peakSeasonPrice: number;
  capacity: RoomCapacity;
  amenities: string[];
  occupancyRate: number;
  averagePrice: number;
  totalRevenue: number;
  bookingCount: number;
}

/**
 * 객실 타입 열거형
 */
export enum RoomType {
  STANDARD = 'STANDARD',
  DELUXE = 'DELUXE',
  SUITE = 'SUITE',
  FAMILY = 'FAMILY',
  PENSION = 'PENSION',
  VILLA = 'VILLA'
}

/**
 * 객실 수용 인원 인터페이스
 */
export interface RoomCapacity {
  standard: number;
  maximum: number;
  extraCharge: number; // 추가 인원당 요금
}

/**
 * Room 도메인 엔티티
 * @class
 * @description 객실 데이터의 핵심 비즈니스 로직을 캡슐화
 */
export class Room {
  private _roomName: string;
  private _roomType: RoomType;
  private _basePrice: number;
  private _weekendPrice: number;
  private _peakSeasonPrice: number;
  private _capacity: RoomCapacity;
  private _amenities: string[];
  private _occupancyRate: number;
  private _averagePrice: number;
  private _totalRevenue: number;
  private _bookingCount: number;

  /**
   * Room 생성자
   * @param {IRoom} data - 초기화 데이터
   */
  constructor(data: IRoom) {
    this.validate(data);
    
    this._roomName = data.roomName;
    this._roomType = data.roomType;
    this._basePrice = data.basePrice;
    this._weekendPrice = data.weekendPrice;
    this._peakSeasonPrice = data.peakSeasonPrice;
    this._capacity = { ...data.capacity };
    this._amenities = [...data.amenities];
    this._occupancyRate = data.occupancyRate;
    this._averagePrice = data.averagePrice;
    this._totalRevenue = data.totalRevenue;
    this._bookingCount = data.bookingCount;
  }

  /**
   * 데이터 유효성 검증
   * @private
   * @param {IRoom} data - 검증할 데이터
   * @throws {Error} 유효성 검증 실패 시
   */
  private validate(data: IRoom): void {
    // 필수 필드 검증
    if (!data.roomName || data.roomName.trim() === '') {
      throw new Error('객실 이름은 필수 입력 항목입니다.');
    }

    if (!data.roomType) {
      throw new Error('객실 타입은 필수 입력 항목입니다.');
    }

    // 가격 검증
    if (data.basePrice < 0) {
      throw new Error('기본 가격은 음수일 수 없습니다.');
    }

    if (data.weekendPrice < 0) {
      throw new Error('주말 가격은 음수일 수 없습니다.');
    }

    if (data.peakSeasonPrice < 0) {
      throw new Error('성수기 가격은 음수일 수 없습니다.');
    }

    // 수용 인원 검증
    if (!data.capacity) {
      throw new Error('수용 인원 정보는 필수 입력 항목입니다.');
    }

    if (data.capacity.standard <= 0) {
      throw new Error('기준 인원은 1명 이상이어야 합니다.');
    }

    if (data.capacity.maximum < data.capacity.standard) {
      throw new Error('최대 인원은 기준 인원 이상이어야 합니다.');
    }

    if (data.capacity.extraCharge < 0) {
      throw new Error('추가 인원 요금은 음수일 수 없습니다.');
    }

    // 점유율 검증
    if (data.occupancyRate < 0 || data.occupancyRate > 100) {
      throw new Error('점유율은 0~100 사이의 값이어야 합니다.');
    }

    // 예약 관련 검증
    if (data.bookingCount < 0) {
      throw new Error('예약 건수는 음수일 수 없습니다.');
    }

    if (data.totalRevenue < 0) {
      throw new Error('총 매출은 음수일 수 없습니다.');
    }

    if (data.averagePrice < 0) {
      throw new Error('평균 가격은 음수일 수 없습니다.');
    }

    // 비즈니스 규칙 검증
    this.validateBusinessRules(data);
  }

  /**
   * 비즈니스 규칙 검증
   * @private
   * @param {IRoom} data - 검증할 데이터
   */
  private validateBusinessRules(data: IRoom): void {
    // 편의시설 개수 제한
    if (data.amenities.length > 20) {
      throw new Error('편의시설은 최대 20개까지 등록 가능합니다.');
    }

    // 가격 논리 검증
    if (data.weekendPrice > 0 && data.weekendPrice < data.basePrice) {
      console.warn('주말 가격이 기본 가격보다 낮습니다.');
    }

    if (data.peakSeasonPrice > 0 && data.peakSeasonPrice < data.basePrice) {
      console.warn('성수기 가격이 기본 가격보다 낮습니다.');
    }

    // 평균 가격과 매출의 일관성 검증
    if (data.bookingCount > 0 && data.totalRevenue > 0) {
      const calculatedAverage = data.totalRevenue / data.bookingCount;
      if (Math.abs(calculatedAverage - data.averagePrice) > 1000) {
        console.warn(
          `계산된 평균 가격(${calculatedAverage})과 입력된 평균 가격(${data.averagePrice})의 차이가 큽니다.`
        );
      }
    }
  }

  /**
   * 객실 정보 업데이트
   * @param {Partial<IRoom>} updates - 업데이트할 필드
   * @returns {Room} 새로운 Room 인스턴스
   */
  update(updates: Partial<IRoom>): Room {
    const newData: IRoom = {
      roomName: updates.roomName ?? this._roomName,
      roomType: updates.roomType ?? this._roomType,
      basePrice: updates.basePrice ?? this._basePrice,
      weekendPrice: updates.weekendPrice ?? this._weekendPrice,
      peakSeasonPrice: updates.peakSeasonPrice ?? this._peakSeasonPrice,
      capacity: updates.capacity ?? this._capacity,
      amenities: updates.amenities ?? this._amenities,
      occupancyRate: updates.occupancyRate ?? this._occupancyRate,
      averagePrice: updates.averagePrice ?? this._averagePrice,
      totalRevenue: updates.totalRevenue ?? this._totalRevenue,
      bookingCount: updates.bookingCount ?? this._bookingCount
    };

    return new Room(newData);
  }

  /**
   * 편의시설 추가
   * @param {string} amenity - 추가할 편의시설
   * @returns {Room} 새로운 Room 인스턴스
   */
  addAmenity(amenity: string): Room {
    if (this._amenities.length >= 20) {
      throw new Error('편의시설은 최대 20개까지 등록 가능합니다.');
    }

    if (this._amenities.includes(amenity)) {
      throw new Error('이미 등록된 편의시설입니다.');
    }

    return this.update({
      amenities: [...this._amenities, amenity]
    });
  }

  /**
   * 편의시설 제거
   * @param {string} amenity - 제거할 편의시설
   * @returns {Room} 새로운 Room 인스턴스
   */
  removeAmenity(amenity: string): Room {
    const newAmenities = this._amenities.filter(a => a !== amenity);
    
    if (newAmenities.length === this._amenities.length) {
      throw new Error('해당 편의시설이 존재하지 않습니다.');
    }

    return this.update({
      amenities: newAmenities
    });
  }

  /**
   * RevPAR (Revenue Per Available Room) 계산
   * @returns {number} RevPAR 값
   */
  calculateRevPAR(): number {
    return (this._totalRevenue * this._occupancyRate) / 100;
  }

  /**
   * ADR (Average Daily Rate) 계산
   * @param {number} days - 운영 일수
   * @returns {number} ADR 값
   */
  calculateADR(days: number): number {
    if (days <= 0 || this._bookingCount === 0) return 0;
    return this._totalRevenue / this._bookingCount;
  }

  /**
   * 데이터를 일반 객체로 변환
   * @returns {IRoom} 일반 객체 형태의 데이터
   */
  toObject(): IRoom {
    return {
      roomName: this._roomName,
      roomType: this._roomType,
      basePrice: this._basePrice,
      weekendPrice: this._weekendPrice,
      peakSeasonPrice: this._peakSeasonPrice,
      capacity: { ...this._capacity },
      amenities: [...this._amenities],
      occupancyRate: this._occupancyRate,
      averagePrice: this._averagePrice,
      totalRevenue: this._totalRevenue,
      bookingCount: this._bookingCount
    };
  }

  /**
   * Firebase 저장용 평면화된 데이터 생성
   * @returns {Record<string, any>} 평면화된 데이터
   */
  toFirebaseFormat(): Record<string, any> {
    return {
      name: this._roomName,
      type: this._roomType,
      basePrice: this._basePrice,
      weekendPrice: this._weekendPrice,
      peakSeasonPrice: this._peakSeasonPrice,
      'capacity.standard': this._capacity.standard,
      'capacity.maximum': this._capacity.maximum,
      'capacity.extraCharge': this._capacity.extraCharge,
      amenities: this._amenities.join(','), // 문자열로 변환하여 필드 수 감소
      occupancyRate: this._occupancyRate,
      averagePrice: this._averagePrice,
      totalRevenue: this._totalRevenue,
      bookingCount: this._bookingCount
    };
  }

  /**
   * 문자열 표현
   * @returns {string} 객실 요약 정보
   */
  toString(): string {
    return `${this._roomName} (${this._roomType}): 점유율 ${this._occupancyRate}%, 매출 ${this.formatCurrency(this._totalRevenue)}`;
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
  get roomName(): string {
    return this._roomName;
  }

  get roomType(): RoomType {
    return this._roomType;
  }

  get basePrice(): number {
    return this._basePrice;
  }

  get weekendPrice(): number {
    return this._weekendPrice;
  }

  get peakSeasonPrice(): number {
    return this._peakSeasonPrice;
  }

  get capacity(): Readonly<RoomCapacity> {
    return Object.freeze({ ...this._capacity });
  }

  get amenities(): ReadonlyArray<string> {
    return Object.freeze([...this._amenities]);
  }

  get occupancyRate(): number {
    return this._occupancyRate;
  }

  get averagePrice(): number {
    return this._averagePrice;
  }

  get totalRevenue(): number {
    return this._totalRevenue;
  }

  get bookingCount(): number {
    return this._bookingCount;
  }

  /**
   * 불변성을 보장하는 복사본 생성
   * @returns {Room} 복사된 Room 인스턴스
   */
  clone(): Room {
    return new Room(this.toObject());
  }

  /**
   * 두 Room 인스턴스가 같은지 비교
   * @param {Room} other - 비교할 Room 인스턴스
   * @returns {boolean} 동일 여부
   */
  equals(other: Room): boolean {
    if (!other) return false;
    
    return (
      this._roomName === other._roomName &&
      this._roomType === other._roomType &&
      this._basePrice === other._basePrice &&
      this._weekendPrice === other._weekendPrice &&
      this._peakSeasonPrice === other._peakSeasonPrice &&
      this._capacity.standard === other._capacity.standard &&
      this._capacity.maximum === other._capacity.maximum &&
      this._capacity.extraCharge === other._capacity.extraCharge &&
      JSON.stringify(this._amenities) === JSON.stringify(other._amenities) &&
      this._occupancyRate === other._occupancyRate &&
      this._averagePrice === other._averagePrice &&
      this._totalRevenue === other._totalRevenue &&
      this._bookingCount === other._bookingCount
    );
  }
}

/**
 * Room 팩토리 함수
 * @param {Partial<IRoom>} data - 부분적인 초기화 데이터
 * @returns {Room} 생성된 Room 인스턴스
 */
export function createRoom(data: Partial<IRoom>): Room {
  const defaultCapacity: RoomCapacity = {
    standard: 2,
    maximum: 4,
    extraCharge: 10000
  };

  const completeData: IRoom = {
    roomName: data.roomName || '',
    roomType: data.roomType || RoomType.STANDARD,
    basePrice: data.basePrice || 0,
    weekendPrice: data.weekendPrice || 0,
    peakSeasonPrice: data.peakSeasonPrice || 0,
    capacity: data.capacity || defaultCapacity,
    amenities: data.amenities || [],
    occupancyRate: data.occupancyRate || 0,
    averagePrice: data.averagePrice || 0,
    totalRevenue: data.totalRevenue || 0,
    bookingCount: data.bookingCount || 0
  };

  return new Room(completeData);
}