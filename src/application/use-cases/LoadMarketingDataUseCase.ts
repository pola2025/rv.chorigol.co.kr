/**
 * @fileoverview LoadMarketingDataUseCase
 * @description 마케팅 데이터 조회 Use Case
 */

import { BaseUseCase, UseCaseError, UseCaseErrorCode } from './UseCase';
import { MarketingRepository, MarketingFilter, MarketingSortField } from '../../domain/interfaces/repositories';
import { MarketingData } from '../../domain/entities';
import { Period, createPeriod } from '../../domain/value-objects';

/**
 * LoadMarketingData 입력 DTO
 */
export interface LoadMarketingDataInput {
  mode: 'single' | 'list' | 'paginated' | 'summary';
  
  // Single mode
  id?: string;
  pensionName?: string;
  monthYear?: string;
  
  // List/Paginated mode
  filter?: {
    pensionName?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    minRevenue?: number;
    maxRevenue?: number;
    hasRooms?: boolean;
    hasAdvertisements?: boolean;
  };
  
  // Paginated mode
  page?: number;
  pageSize?: number;
  sortField?: MarketingSortField;
  sortDirection?: 'asc' | 'desc';
}

/**
 * LoadMarketingData 출력 DTO
 */
export interface LoadMarketingDataOutput {
  mode: 'single' | 'list' | 'paginated' | 'summary';
  
  // Single mode
  data?: MarketingDataDTO;
  
  // List mode
  items?: MarketingDataDTO[];
  
  // Paginated mode
  pagination?: {
    items: MarketingDataDTO[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  
  // Summary mode
  summaries?: MarketingSummaryDTO[];
  
  // 공통
  count: number;
  loadedAt: Date;
}

/**
 * MarketingData DTO
 */
export interface MarketingDataDTO {
  id: string;
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
    startDate: string;
    endDate: string;
    isActive: boolean;
    roi: number;
    roas: number;
  }>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    isValid: boolean;
  };
  statistics: {
    totalFields: number;
    roomCount: number;
    advertisementCount: number;
    averageOccupancyRate: number;
    totalAdvertisementSpend: number;
    totalROI: number;
  };
}

/**
 * MarketingSummary DTO
 */
export interface MarketingSummaryDTO {
  pensionName: string;
  monthYear: string;
  totalRevenue: number;
  roomCount: number;
  advertisementCount: number;
  averageOccupancyRate: number;
  totalAdvertisementSpend: number;
  roi: number;
}

/**
 * LoadMarketingDataUseCase
 * @class
 * @extends {BaseUseCase<LoadMarketingDataInput, LoadMarketingDataOutput>}
 */
export class LoadMarketingDataUseCase extends BaseUseCase<
  LoadMarketingDataInput,
  LoadMarketingDataOutput
> {
  protected readonly name = 'LoadMarketingDataUseCase';

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
   * @param {LoadMarketingDataInput} input - 검증할 입력
   * @throws {UseCaseError} 검증 실패 시
   */
  protected async validate(input: LoadMarketingDataInput): Promise<void> {
    // 모드 검증
    if (!['single', 'list', 'paginated', 'summary'].includes(input.mode)) {
      throw this.createValidationError('유효하지 않은 조회 모드입니다.');
    }

    // Single mode 검증
    if (input.mode === 'single') {
      if (!input.id && (!input.pensionName || !input.monthYear)) {
        throw this.createValidationError(
          'Single 모드에서는 ID 또는 펜션명과 년월이 필요합니다.'
        );
      }

      if (input.monthYear && !this.isValidMonthYear(input.monthYear)) {
        throw this.createValidationError('유효한 년월 형식이 아닙니다. (YYYY-MM)');
      }
    }

    // Paginated mode 검증
    if (input.mode === 'paginated') {
      if (!input.page || input.page < 1) {
        throw this.createValidationError('페이지 번호는 1 이상이어야 합니다.');
      }

      if (!input.pageSize || input.pageSize < 1 || input.pageSize > 100) {
        throw this.createValidationError('페이지 크기는 1~100 사이여야 합니다.');
      }
    }

    // Filter 검증
    if (input.filter) {
      if (input.filter.minRevenue !== undefined && input.filter.minRevenue < 0) {
        throw this.createValidationError('최소 매출은 0 이상이어야 합니다.');
      }

      if (input.filter.maxRevenue !== undefined && input.filter.maxRevenue < 0) {
        throw this.createValidationError('최대 매출은 0 이상이어야 합니다.');
      }

      if (
        input.filter.minRevenue !== undefined &&
        input.filter.maxRevenue !== undefined &&
        input.filter.minRevenue > input.filter.maxRevenue
      ) {
        throw this.createValidationError('최소 매출이 최대 매출보다 클 수 없습니다.');
      }

      if (input.filter.startDate && input.filter.endDate) {
        const startDate = new Date(input.filter.startDate);
        const endDate = new Date(input.filter.endDate);
        
        if (endDate < startDate) {
          throw this.createValidationError('종료일이 시작일보다 빠를 수 없습니다.');
        }
      }
    }
  }

  /**
   * 비즈니스 로직 실행
   * @protected
   * @param {LoadMarketingDataInput} input - 입력 데이터
   * @returns {Promise<LoadMarketingDataOutput>} 실행 결과
   */
  protected async executeImpl(
    input: LoadMarketingDataInput
  ): Promise<LoadMarketingDataOutput> {
    switch (input.mode) {
      case 'single':
        return this.loadSingle(input);
      case 'list':
        return this.loadList(input);
      case 'paginated':
        return this.loadPaginated(input);
      case 'summary':
        return this.loadSummary(input);
      default:
        throw this.createValidationError('지원하지 않는 조회 모드입니다.');
    }
  }

  /**
   * 단일 데이터 조회
   * @private
   * @param {LoadMarketingDataInput} input - 입력 데이터
   * @returns {Promise<LoadMarketingDataOutput>} 조회 결과
   */
  private async loadSingle(
    input: LoadMarketingDataInput
  ): Promise<LoadMarketingDataOutput> {
    let data: MarketingData | null = null;

    if (input.id) {
      data = await this.marketingRepository.findById(input.id);
    } else if (input.pensionName && input.monthYear) {
      data = await this.marketingRepository.findByPensionAndMonth(
        input.pensionName,
        input.monthYear
      );
    }

    if (!data) {
      throw this.createNotFoundError('마케팅 데이터', input.id || `${input.pensionName}-${input.monthYear}`);
    }

    return {
      mode: 'single',
      data: this.toDTO(data),
      count: 1,
      loadedAt: new Date()
    };
  }

  /**
   * 리스트 조회
   * @private
   * @param {LoadMarketingDataInput} input - 입력 데이터
   * @returns {Promise<LoadMarketingDataOutput>} 조회 결과
   */
  private async loadList(
    input: LoadMarketingDataInput
  ): Promise<LoadMarketingDataOutput> {
    let items: MarketingData[] = [];

    if (input.filter?.startDate && input.filter?.endDate) {
      const period = createPeriod(
        new Date(input.filter.startDate),
        new Date(input.filter.endDate)
      );
      items = await this.marketingRepository.findByPeriod(
        period,
        input.filter.pensionName
      );
    } else {
      const filter = this.buildFilter(input.filter);
      const summaries = await this.marketingRepository.findSummaries(filter);
      
      // Summary를 기반으로 전체 데이터 조회
      const ids = summaries.map(s => `${s.pensionName}-${s.monthYear}`);
      items = await Promise.all(
        ids.map(async id => {
          const [pensionName, monthYear] = id.split('-');
          return await this.marketingRepository.findByPensionAndMonth(pensionName, monthYear);
        })
      ).then(results => results.filter(r => r !== null) as MarketingData[]);
    }

    return {
      mode: 'list',
      items: items.map(item => this.toDTO(item)),
      count: items.length,
      loadedAt: new Date()
    };
  }

  /**
   * 페이지네이션 조회
   * @private
   * @param {LoadMarketingDataInput} input - 입력 데이터
   * @returns {Promise<LoadMarketingDataOutput>} 조회 결과
   */
  private async loadPaginated(
    input: LoadMarketingDataInput
  ): Promise<LoadMarketingDataOutput> {
    const filter = this.buildFilter(input.filter);
    const result = await this.marketingRepository.findPaginatedWithFilter(
      input.page!,
      input.pageSize!,
      filter,
      input.sortField,
      input.sortDirection
    );

    return {
      mode: 'paginated',
      pagination: {
        items: result.items.map(item => this.toDTO(item)),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
        hasNext: result.hasNext,
        hasPrevious: result.hasPrevious
      },
      count: result.items.length,
      loadedAt: new Date()
    };
  }

  /**
   * 요약 조회
   * @private
   * @param {LoadMarketingDataInput} input - 입력 데이터
   * @returns {Promise<LoadMarketingDataOutput>} 조회 결과
   */
  private async loadSummary(
    input: LoadMarketingDataInput
  ): Promise<LoadMarketingDataOutput> {
    const filter = this.buildFilter(input.filter);
    const summaries = await this.marketingRepository.findSummaries(filter);

    return {
      mode: 'summary',
      summaries: summaries,
      count: summaries.length,
      loadedAt: new Date()
    };
  }

  /**
   * 필터 빌드
   * @private
   * @param {LoadMarketingDataInput['filter']} filter - 입력 필터
   * @returns {MarketingFilter} 마케팅 필터
   */
  private buildFilter(filter?: LoadMarketingDataInput['filter']): MarketingFilter {
    if (!filter) return {};

    return {
      pensionName: filter.pensionName,
      startDate: filter.startDate ? new Date(filter.startDate) : undefined,
      endDate: filter.endDate ? new Date(filter.endDate) : undefined,
      minRevenue: filter.minRevenue,
      maxRevenue: filter.maxRevenue,
      hasRooms: filter.hasRooms,
      hasAdvertisements: filter.hasAdvertisements
    };
  }

  /**
   * Entity를 DTO로 변환
   * @private
   * @param {MarketingData} entity - MarketingData 엔티티
   * @returns {MarketingDataDTO} DTO
   */
  private toDTO(entity: MarketingData): MarketingDataDTO {
    const roomCount = entity.rooms.length;
    const advertisementCount = entity.advertisements.length;
    
    // 평균 점유율 계산
    const averageOccupancyRate = roomCount > 0
      ? entity.rooms.reduce((sum, room) => sum + room.occupancyRate, 0) / roomCount
      : 0;
    
    // 총 광고 지출 계산
    const totalAdvertisementSpend = entity.advertisements.reduce(
      (sum, ad) => sum + ad.spend,
      0
    );
    
    // 총 ROI 계산
    const totalAdRevenue = entity.advertisements.reduce(
      (sum, ad) => sum + ad.revenue,
      0
    );
    const totalROI = totalAdvertisementSpend > 0
      ? ((totalAdRevenue - totalAdvertisementSpend) / totalAdvertisementSpend) * 100
      : 0;

    return {
      id: entity.id!,
      pensionName: entity.pensionName,
      monthYear: entity.monthYear,
      revenue: entity.revenue.toObject(),
      rooms: entity.rooms.map(room => ({
        ...room.toObject(),
        roomType: room.roomType,
        amenities: [...room.amenities]
      })),
      advertisements: entity.advertisements.map(ad => ({
        ...ad.toObject(),
        startDate: ad.startDate.toISOString(),
        endDate: ad.endDate.toISOString(),
        roi: ad.calculateROI(),
        roas: ad.calculateROAS()
      })),
      metadata: {
        createdAt: entity.metadata.createdAt.toISOString(),
        updatedAt: entity.metadata.updatedAt.toISOString(),
        version: entity.metadata.version,
        isValid: entity.metadata.isValid
      },
      statistics: {
        totalFields: entity.totalFields,
        roomCount,
        advertisementCount,
        averageOccupancyRate,
        totalAdvertisementSpend,
        totalROI
      }
    };
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
}