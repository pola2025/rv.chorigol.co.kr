/**
 * @fileoverview SaveMarketingDataUseCase
 * @description 마케팅 데이터 저장 Use Case
 */

import { BaseUseCase, UseCaseError, UseCaseErrorCode } from './UseCase';
import { MarketingRepository } from '../../domain/interfaces/repositories';
import { 
  MarketingData, 
  createMarketingData,
  Revenue,
  Room,
  Advertisement
} from '../../domain/entities';
import { Period, Money } from '../../domain/value-objects';

/**
 * SaveMarketingData 입력 DTO
 */
export interface SaveMarketingDataInput {
  id?: string;
  pensionName: string;
  monthYear: string;
  revenue: {
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
  };
  rooms: Array<{
    roomName: string;
    roomType: string;
    basePrice: number;
    weekendPrice: number;
    peakSeasonPrice: number;
    capacity: {
      standard: number;
      maximum: number;
      extraCharge: number;
    };
    amenities: string[];
    occupancyRate: number;
    averagePrice: number;
    totalRevenue: number;
    bookingCount: number;
  }>;
  advertisements: Array<{
    channelName: string;
    channelType: string;
    budget: number;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    startDate: string | Date;
    endDate: string | Date;
    isActive: boolean;
  }>;
  metadata?: {
    version?: number;
    isValid?: boolean;
  };
}

/**
 * SaveMarketingData 출력 DTO
 */
export interface SaveMarketingDataOutput {
  id: string;
  pensionName: string;
  monthYear: string;
  totalFields: number;
  savedAt: Date;
  version: number;
}

/**
 * SaveMarketingDataUseCase
 * @class
 * @extends {BaseUseCase<SaveMarketingDataInput, SaveMarketingDataOutput>}
 */
export class SaveMarketingDataUseCase extends BaseUseCase<
  SaveMarketingDataInput, 
  SaveMarketingDataOutput
> {
  protected readonly name = 'SaveMarketingDataUseCase';

  /**
   * 생성자
   * @param {MarketingRepository} marketingRepository - 마케팅 저장소
   */
  constructor(
    private readonly marketingRepository: MarketingRepository
  ) {
    super();
  }

  /**
   * 입력 검증
   * @protected
   * @param {SaveMarketingDataInput} input - 검증할 입력
   * @throws {UseCaseError} 검증 실패 시
   */
  protected async validate(input: SaveMarketingDataInput): Promise<void> {
    // 필수 필드 검증
    if (!input.pensionName || input.pensionName.trim() === '') {
      throw this.createValidationError('펜션 이름은 필수 입력 항목입니다.');
    }

    if (!input.monthYear || !this.isValidMonthYear(input.monthYear)) {
      throw this.createValidationError('유효한 년월 형식이 아닙니다. (YYYY-MM)');
    }

    if (!input.revenue) {
      throw this.createValidationError('매출 정보는 필수 입력 항목입니다.');
    }

    if (!Array.isArray(input.rooms)) {
      throw this.createValidationError('객실 정보는 배열 형태여야 합니다.');
    }

    if (!Array.isArray(input.advertisements)) {
      throw this.createValidationError('광고 정보는 배열 형태여야 합니다.');
    }

    // 객실 수 제한
    if (input.rooms.length > 50) {
      throw this.createValidationError(
        '객실 수는 최대 50개까지 등록 가능합니다.',
        { roomCount: input.rooms.length }
      );
    }

    // 광고 수 제한
    if (input.advertisements.length > 20) {
      throw this.createValidationError(
        '광고 항목은 최대 20개까지 등록 가능합니다.',
        { advertisementCount: input.advertisements.length }
      );
    }

    // 중복 체크 (신규 저장인 경우)
    if (!input.id) {
      const isDuplicate = await this.marketingRepository.checkDuplicate(
        input.pensionName,
        input.monthYear
      );

      if (isDuplicate) {
        throw this.createAlreadyExistsError(
          '해당 펜션의 해당 월 데이터',
          { pensionName: input.pensionName, monthYear: input.monthYear }
        );
      }
    }

    // Firebase 필드 수 체크
    const estimatedFields = this.estimateFieldCount(input);
    if (estimatedFields > 450) { // 500 제한에 여유를 둠
      throw this.createBusinessError(
        `예상 필드 수(${estimatedFields})가 Firebase 제한(500)에 근접합니다. 데이터를 줄여주세요.`,
        { estimatedFields }
      );
    }

    // 매출 일관성 검증
    this.validateRevenueConsistency(input.revenue);

    // 각 객실 검증
    for (const room of input.rooms) {
      this.validateRoom(room);
    }

    // 각 광고 검증
    for (const ad of input.advertisements) {
      this.validateAdvertisement(ad);
    }
  }

  /**
   * 비즈니스 로직 실행
   * @protected
   * @param {SaveMarketingDataInput} input - 입력 데이터
   * @returns {Promise<SaveMarketingDataOutput>} 실행 결과
   */
  protected async executeImpl(
    input: SaveMarketingDataInput
  ): Promise<SaveMarketingDataOutput> {
    // 엔티티 생성
    const marketingData = this.createMarketingDataEntity(input);

    // Firebase 필드 수 최종 체크
    const actualFields = await this.marketingRepository.checkFieldCount(marketingData);
    if (actualFields > 500) {
      throw this.createBusinessError(
        `실제 필드 수(${actualFields})가 Firebase 제한(500)을 초과합니다.`,
        { actualFields }
      );
    }

    // 저장
    const savedData = await this.marketingRepository.save(marketingData);

    // 캐시 무효화
    await this.marketingRepository.invalidateCache(
      savedData.pensionName,
      savedData.monthYear
    );

    // 결과 반환
    return {
      id: savedData.id!,
      pensionName: savedData.pensionName,
      monthYear: savedData.monthYear,
      totalFields: savedData.totalFields,
      savedAt: new Date(),
      version: savedData.metadata.version
    };
  }

  /**
   * 실행 후 처리
   * @protected
   * @param {SaveMarketingDataInput} input - 입력 데이터
   * @param {SaveMarketingDataOutput} output - 출력 데이터
   */
  protected async afterExecute(
    input: SaveMarketingDataInput,
    output: SaveMarketingDataOutput
  ): Promise<void> {
    console.log(
      `[${this.name}] Marketing data saved successfully:`,
      {
        id: output.id,
        pensionName: output.pensionName,
        monthYear: output.monthYear,
        totalFields: output.totalFields
      }
    );
  }

  /**
   * MarketingData 엔티티 생성
   * @private
   * @param {SaveMarketingDataInput} input - 입력 데이터
   * @returns {MarketingData} 생성된 엔티티
   */
  private createMarketingDataEntity(input: SaveMarketingDataInput): MarketingData {
    // Revenue 엔티티 생성
    const revenue = new Revenue(input.revenue);

    // Room 엔티티 배열 생성
    const rooms = input.rooms.map(roomData => new Room({
      ...roomData,
      roomType: roomData.roomType as any // Type assertion for enum
    }));

    // Advertisement 엔티티 배열 생성
    const advertisements = input.advertisements.map(adData => new Advertisement({
      ...adData,
      channelType: adData.channelType as any, // Type assertion for enum
      startDate: new Date(adData.startDate),
      endDate: new Date(adData.endDate)
    }));

    // MarketingData 생성
    return createMarketingData({
      id: input.id,
      pensionName: input.pensionName,
      monthYear: input.monthYear,
      revenue,
      rooms,
      advertisements,
      metadata: {
        createdAt: input.id ? new Date() : new Date(),
        updatedAt: new Date(),
        version: input.metadata?.version || 1,
        isValid: input.metadata?.isValid ?? true
      }
    });
  }

  /**
   * 년월 형식 검증
   * @private
   * @param {string} monthYear - YYYY-MM 형식의 문자열
   * @returns {boolean} 유효성 여부
   */
  private isValidMonthYear(monthYear: string): boolean {
    const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
    return regex.test(monthYear);
  }

  /**
   * 필드 수 추정
   * @private
   * @param {SaveMarketingDataInput} input - 입력 데이터
   * @returns {number} 추정 필드 수
   */
  private estimateFieldCount(input: SaveMarketingDataInput): number {
    let count = 0;

    // 기본 필드
    count += 3; // id, pensionName, monthYear

    // Revenue 필드
    count += Object.keys(input.revenue).length;

    // Rooms 필드
    input.rooms.forEach(room => {
      count += 13; // 기본 room 필드들
      count += room.amenities.length; // amenities 배열
    });

    // Advertisements 필드
    input.advertisements.forEach(ad => {
      count += 14; // 기본 advertisement 필드들
    });

    // Metadata 필드
    count += 4; // createdAt, updatedAt, version, isValid

    return count;
  }

  /**
   * 매출 일관성 검증
   * @private
   * @param {SaveMarketingDataInput['revenue']} revenue - 매출 데이터
   */
  private validateRevenueConsistency(revenue: SaveMarketingDataInput['revenue']): void {
    // 총 매출 = 객실 매출 + 부가 매출
    const calculatedTotal = revenue.roomRevenue + revenue.additionalRevenue;
    if (Math.abs(revenue.totalRevenue - calculatedTotal) > 0.01) {
      console.warn(
        `매출 불일치: 총 매출(${revenue.totalRevenue}) != 객실(${revenue.roomRevenue}) + 부가(${revenue.additionalRevenue})`
      );
    }

    // 온라인 + 오프라인 = 총 매출
    const channelTotal = revenue.onlineRevenue + revenue.offlineRevenue;
    if (Math.abs(revenue.totalRevenue - channelTotal) > 0.01) {
      console.warn(
        `채널별 매출 불일치: 총 매출(${revenue.totalRevenue}) != 온라인(${revenue.onlineRevenue}) + 오프라인(${revenue.offlineRevenue})`
      );
    }
  }

  /**
   * 객실 검증
   * @private
   * @param {SaveMarketingDataInput['rooms'][0]} room - 객실 데이터
   */
  private validateRoom(room: SaveMarketingDataInput['rooms'][0]): void {
    if (!room.roomName || room.roomName.trim() === '') {
      throw this.createValidationError('객실 이름은 필수 입력 항목입니다.');
    }

    if (room.basePrice < 0) {
      throw this.createValidationError(`객실 ${room.roomName}의 기본 가격은 음수일 수 없습니다.`);
    }

    if (room.occupancyRate < 0 || room.occupancyRate > 100) {
      throw this.createValidationError(
        `객실 ${room.roomName}의 점유율은 0~100 사이여야 합니다.`
      );
    }

    if (room.capacity.standard <= 0) {
      throw this.createValidationError(
        `객실 ${room.roomName}의 기준 인원은 1명 이상이어야 합니다.`
      );
    }

    if (room.capacity.maximum < room.capacity.standard) {
      throw this.createValidationError(
        `객실 ${room.roomName}의 최대 인원은 기준 인원 이상이어야 합니다.`
      );
    }
  }

  /**
   * 광고 검증
   * @private
   * @param {SaveMarketingDataInput['advertisements'][0]} ad - 광고 데이터
   */
  private validateAdvertisement(ad: SaveMarketingDataInput['advertisements'][0]): void {
    if (!ad.channelName || ad.channelName.trim() === '') {
      throw this.createValidationError('광고 채널 이름은 필수 입력 항목입니다.');
    }

    if (ad.budget < 0) {
      throw this.createValidationError(
        `광고 ${ad.channelName}의 예산은 음수일 수 없습니다.`
      );
    }

    if (ad.spend < 0) {
      throw this.createValidationError(
        `광고 ${ad.channelName}의 지출액은 음수일 수 없습니다.`
      );
    }

    if (ad.clicks > ad.impressions) {
      throw this.createValidationError(
        `광고 ${ad.channelName}의 클릭수는 노출수를 초과할 수 없습니다.`
      );
    }

    if (ad.conversions > ad.clicks) {
      throw this.createValidationError(
        `광고 ${ad.channelName}의 전환수는 클릭수를 초과할 수 없습니다.`
      );
    }

    const startDate = new Date(ad.startDate);
    const endDate = new Date(ad.endDate);

    if (endDate < startDate) {
      throw this.createValidationError(
        `광고 ${ad.channelName}의 종료일은 시작일 이후여야 합니다.`
      );
    }
  }
}