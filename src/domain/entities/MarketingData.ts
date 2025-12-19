/**
 * @fileoverview MarketingData 도메인 엔티티
 * @description 마케팅 데이터의 핵심 비즈니스 로직과 불변성을 보장하는 엔티티
 */

import { Revenue } from './Revenue';
import { Room } from './Room';
import { Advertisement } from './Advertisement';

/**
 * MarketingData 엔티티 인터페이스
 */
export interface IMarketingData {
  id?: string;
  pensionName: string;
  monthYear: string;
  revenue: Revenue;
  rooms: Room[];
  advertisements: Advertisement[];
  metadata: MarketingMetadata;
}

/**
 * 마케팅 데이터 메타데이터
 */
export interface MarketingMetadata {
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isValid: boolean;
}

/**
 * MarketingData 도메인 엔티티
 * @class
 * @description 마케팅 데이터의 핵심 비즈니스 로직을 캡슐화
 */
export class MarketingData {
  private _id?: string;
  private _pensionName: string;
  private _monthYear: string;
  private _revenue: Revenue;
  private _rooms: Room[];
  private _advertisements: Advertisement[];
  private _metadata: MarketingMetadata;

  /**
   * MarketingData 생성자
   * @param {IMarketingData} data - 초기화 데이터
   */
  constructor(data: IMarketingData) {
    this.validate(data);
    
    this._id = data.id;
    this._pensionName = data.pensionName;
    this._monthYear = data.monthYear;
    this._revenue = data.revenue;
    this._rooms = [...data.rooms]; // 불변성 보장
    this._advertisements = [...data.advertisements]; // 불변성 보장
    this._metadata = {
      ...data.metadata,
      updatedAt: new Date()
    };
  }

  /**
   * 데이터 유효성 검증
   * @private
   * @param {IMarketingData} data - 검증할 데이터
   * @throws {Error} 유효성 검증 실패 시
   */
  private validate(data: IMarketingData): void {
    // 필수 필드 검증
    if (!data.pensionName || data.pensionName.trim() === '') {
      throw new Error('펜션 이름은 필수 입력 항목입니다.');
    }

    if (!data.monthYear || !this.isValidMonthYear(data.monthYear)) {
      throw new Error('유효한 년월 형식이 아닙니다. (YYYY-MM)');
    }

    if (!data.revenue) {
      throw new Error('매출 정보는 필수 입력 항목입니다.');
    }

    if (!Array.isArray(data.rooms)) {
      throw new Error('객실 정보는 배열 형태여야 합니다.');
    }

    if (!Array.isArray(data.advertisements)) {
      throw new Error('광고 정보는 배열 형태여야 합니다.');
    }

    // 비즈니스 규칙 검증
    this.validateBusinessRules(data);
  }

  /**
   * 비즈니스 규칙 검증
   * @private
   * @param {IMarketingData} data - 검증할 데이터
   * @throws {Error} 비즈니스 규칙 위반 시
   */
  private validateBusinessRules(data: IMarketingData): void {
    // 객실 수 제한 (Firebase 필드 제한 고려)
    if (data.rooms.length > 50) {
      throw new Error('객실 수는 최대 50개까지 등록 가능합니다.');
    }

    // 광고 수 제한
    if (data.advertisements.length > 20) {
      throw new Error('광고 항목은 최대 20개까지 등록 가능합니다.');
    }

    // 총 필드 수 제한 (Firebase 400 에러 방지)
    const totalFields = this.calculateTotalFields(data);
    if (totalFields > 500) {
      throw new Error(`총 필드 수(${totalFields})가 Firebase 제한(500)을 초과합니다.`);
    }
  }

  /**
   * 년월 형식 검증
   * @private
   * @param {string} monthYear - YYYY-MM 형식의 문자열
   * @returns {boolean} 유효성 여부
   */
  private isValidMonthYear(monthYear: string): boolean {
    const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!regex.test(monthYear)) {
      return false;
    }

    const [year, month] = monthYear.split('-').map(Number);
    const currentYear = new Date().getFullYear();
    
    // 합리적인 년도 범위 체크 (현재 년도 ± 10년)
    if (year < currentYear - 10 || year > currentYear + 10) {
      return false;
    }

    return true;
  }

  /**
   * 총 필드 수 계산 (Firebase 제한 체크용)
   * @private
   * @param {IMarketingData} data - 계산할 데이터
   * @returns {number} 총 필드 수
   */
  private calculateTotalFields(data: IMarketingData): number {
    let count = 0;

    // 기본 필드
    count += 3; // id, pensionName, monthYear

    // Revenue 필드 (예상)
    count += 10; // Revenue 엔티티의 필드 수

    // Rooms 필드
    data.rooms.forEach(room => {
      count += 15; // 각 Room 엔티티의 예상 필드 수
    });

    // Advertisements 필드
    data.advertisements.forEach(ad => {
      count += 5; // 각 Advertisement 엔티티의 예상 필드 수
    });

    // Metadata 필드
    count += 4; // createdAt, updatedAt, version, isValid

    return count;
  }

  /**
   * 새로운 객실 추가
   * @param {Room} room - 추가할 객실
   * @returns {MarketingData} 새로운 MarketingData 인스턴스
   */
  addRoom(room: Room): MarketingData {
    if (this._rooms.length >= 50) {
      throw new Error('객실 수는 최대 50개까지 등록 가능합니다.');
    }

    const newData: IMarketingData = {
      id: this._id,
      pensionName: this._pensionName,
      monthYear: this._monthYear,
      revenue: this._revenue,
      rooms: [...this._rooms, room],
      advertisements: this._advertisements,
      metadata: this._metadata
    };

    return new MarketingData(newData);
  }

  /**
   * 새로운 광고 추가
   * @param {Advertisement} advertisement - 추가할 광고
   * @returns {MarketingData} 새로운 MarketingData 인스턴스
   */
  addAdvertisement(advertisement: Advertisement): MarketingData {
    if (this._advertisements.length >= 20) {
      throw new Error('광고 항목은 최대 20개까지 등록 가능합니다.');
    }

    const newData: IMarketingData = {
      id: this._id,
      pensionName: this._pensionName,
      monthYear: this._monthYear,
      revenue: this._revenue,
      rooms: this._rooms,
      advertisements: [...this._advertisements, advertisement],
      metadata: this._metadata
    };

    return new MarketingData(newData);
  }

  /**
   * 매출 정보 업데이트
   * @param {Revenue} revenue - 새로운 매출 정보
   * @returns {MarketingData} 새로운 MarketingData 인스턴스
   */
  updateRevenue(revenue: Revenue): MarketingData {
    const newData: IMarketingData = {
      id: this._id,
      pensionName: this._pensionName,
      monthYear: this._monthYear,
      revenue: revenue,
      rooms: this._rooms,
      advertisements: this._advertisements,
      metadata: this._metadata
    };

    return new MarketingData(newData);
  }

  /**
   * 데이터를 일반 객체로 변환
   * @returns {IMarketingData} 일반 객체 형태의 데이터
   */
  toObject(): IMarketingData {
    return {
      id: this._id,
      pensionName: this._pensionName,
      monthYear: this._monthYear,
      revenue: this._revenue,
      rooms: [...this._rooms],
      advertisements: [...this._advertisements],
      metadata: { ...this._metadata }
    };
  }

  /**
   * Firebase 저장용 평면화된 데이터 생성
   * @returns {Record<string, any>} 평면화된 데이터
   */
  toFirebaseFormat(): Record<string, any> {
    const flatData: Record<string, any> = {
      pensionName: this._pensionName,
      monthYear: this._monthYear,
      'metadata.createdAt': this._metadata.createdAt,
      'metadata.updatedAt': this._metadata.updatedAt,
      'metadata.version': this._metadata.version,
      'metadata.isValid': this._metadata.isValid
    };

    // Revenue 평면화
    const revenueData = this._revenue.toFirebaseFormat();
    Object.keys(revenueData).forEach(key => {
      flatData[`revenue.${key}`] = revenueData[key];
    });

    // Rooms 평면화
    this._rooms.forEach((room, index) => {
      const roomData = room.toFirebaseFormat();
      Object.keys(roomData).forEach(key => {
        flatData[`rooms.${index}.${key}`] = roomData[key];
      });
    });

    // Advertisements 평면화
    this._advertisements.forEach((ad, index) => {
      const adData = ad.toFirebaseFormat();
      Object.keys(adData).forEach(key => {
        flatData[`advertisements.${index}.${key}`] = adData[key];
      });
    });

    return flatData;
  }

  // Getters
  get id(): string | undefined {
    return this._id;
  }

  get pensionName(): string {
    return this._pensionName;
  }

  get monthYear(): string {
    return this._monthYear;
  }

  get revenue(): Revenue {
    return this._revenue;
  }

  get rooms(): ReadonlyArray<Room> {
    return Object.freeze([...this._rooms]);
  }

  get advertisements(): ReadonlyArray<Advertisement> {
    return Object.freeze([...this._advertisements]);
  }

  get metadata(): Readonly<MarketingMetadata> {
    return Object.freeze({ ...this._metadata });
  }

  get isValid(): boolean {
    return this._metadata.isValid;
  }

  get totalFields(): number {
    return this.calculateTotalFields(this.toObject());
  }
}

/**
 * MarketingData 팩토리 함수
 * @param {Partial<IMarketingData>} data - 부분적인 초기화 데이터
 * @returns {MarketingData} 생성된 MarketingData 인스턴스
 */
export function createMarketingData(data: Partial<IMarketingData>): MarketingData {
  const defaultMetadata: MarketingMetadata = {
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    isValid: true
  };

  const completeData: IMarketingData = {
    pensionName: data.pensionName || '',
    monthYear: data.monthYear || '',
    revenue: data.revenue || new Revenue({}),
    rooms: data.rooms || [],
    advertisements: data.advertisements || [],
    metadata: data.metadata || defaultMetadata,
    ...data
  };

  return new MarketingData(completeData);
}