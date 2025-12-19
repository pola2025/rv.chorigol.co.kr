/**
 * @fileoverview MarketingData DTO (Data Transfer Object)
 * @description 레이어 간 데이터 전송을 위한 DTO 정의
 */

/**
 * 기본 DTO 인터페이스
 */
export interface BaseDTO {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

/**
 * Revenue DTO
 */
export interface RevenueDTO {
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
 * Room Capacity DTO
 */
export interface RoomCapacityDTO {
  standard: number;
  maximum: number;
  extraCharge: number;
}

/**
 * Room DTO
 */
export interface RoomDTO {
  roomName: string;
  roomType: string;
  basePrice: number;
  weekendPrice: number;
  peakSeasonPrice: number;
  capacity: RoomCapacityDTO;
  amenities: string[];
  occupancyRate: number;
  averagePrice: number;
  totalRevenue: number;
  bookingCount: number;
}

/**
 * Advertisement DTO
 */
export interface AdvertisementDTO {
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
  // 계산된 지표
  roi?: number;
  roas?: number;
  ctr?: number;
  cvr?: number;
  cpc?: number;
  cpm?: number;
  cpa?: number;
}

/**
 * MarketingData Metadata DTO
 */
export interface MarketingMetadataDTO {
  createdAt: string;
  updatedAt: string;
  version: number;
  isValid: boolean;
  lastValidatedAt?: string;
  validationScore?: number;
}

/**
 * MarketingData Statistics DTO
 */
export interface MarketingStatisticsDTO {
  totalFields: number;
  roomCount: number;
  advertisementCount: number;
  averageOccupancyRate: number;
  totalAdvertisementSpend: number;
  totalROI: number;
  totalROAS: number;
  dataCompleteness: number;
  dataQualityScore: number;
}

/**
 * MarketingData DTO (전체)
 */
export interface MarketingDataDTO extends BaseDTO {
  pensionName: string;
  monthYear: string;
  revenue: RevenueDTO;
  rooms: RoomDTO[];
  advertisements: AdvertisementDTO[];
  metadata: MarketingMetadataDTO;
  statistics?: MarketingStatisticsDTO;
}

/**
 * MarketingData 생성 요청 DTO
 */
export interface CreateMarketingDataDTO {
  pensionName: string;
  monthYear: string;
  revenue: RevenueDTO;
  rooms: RoomDTO[];
  advertisements: AdvertisementDTO[];
}

/**
 * MarketingData 수정 요청 DTO
 */
export interface UpdateMarketingDataDTO extends Partial<CreateMarketingDataDTO> {
  id: string;
  version?: number;
}

/**
 * MarketingData 요약 DTO
 */
export interface MarketingDataSummaryDTO {
  id: string;
  pensionName: string;
  monthYear: string;
  totalRevenue: number;
  roomCount: number;
  advertisementCount: number;
  averageOccupancyRate: number;
  totalAdvertisementSpend: number;
  roi: number;
  dataQualityScore: number;
  lastUpdated: string;
}

/**
 * MarketingData 리스트 응답 DTO
 */
export interface MarketingDataListDTO {
  items: MarketingDataSummaryDTO[];
  total: number;
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * MarketingData 필터 DTO
 */
export interface MarketingDataFilterDTO {
  pensionName?: string;
  monthYear?: string;
  startDate?: string;
  endDate?: string;
  minRevenue?: number;
  maxRevenue?: number;
  minOccupancyRate?: number;
  maxOccupancyRate?: number;
  hasRooms?: boolean;
  hasAdvertisements?: boolean;
  isValid?: boolean;
}

/**
 * MarketingData 정렬 DTO
 */
export interface MarketingDataSortDTO {
  field: 'createdAt' | 'updatedAt' | 'monthYear' | 'totalRevenue' | 'occupancyRate' | 'roi' | 'dataQualityScore';
  direction: 'asc' | 'desc';
}

/**
 * MarketingData 검색 요청 DTO
 */
export interface SearchMarketingDataDTO {
  filter?: MarketingDataFilterDTO;
  sort?: MarketingDataSortDTO;
  page?: number;
  pageSize?: number;
}

/**
 * MarketingData 집계 DTO
 */
export interface MarketingDataAggregationDTO {
  period: {
    start: string;
    end: string;
  };
  pensionName?: string;
  metrics: {
    totalRevenue: number;
    averageRevenue: number;
    maxRevenue: number;
    minRevenue: number;
    totalRooms: number;
    averageOccupancyRate: number;
    totalAdvertisements: number;
    totalAdvertisementSpend: number;
    averageROI: number;
    averageROAS: number;
  };
  trends?: {
    revenueGrowth: number;
    occupancyGrowth: number;
    roiGrowth: number;
  };
}

/**
 * MarketingData 내보내기 DTO
 */
export interface ExportMarketingDataDTO {
  format: 'json' | 'csv' | 'excel';
  filter?: MarketingDataFilterDTO;
  fields?: string[];
  includeStatistics?: boolean;
  includeMetadata?: boolean;
}

/**
 * MarketingData 가져오기 DTO
 */
export interface ImportMarketingDataDTO {
  format: 'json' | 'csv' | 'excel';
  data: string | ArrayBuffer;
  overwrite?: boolean;
  validateBeforeImport?: boolean;
}

/**
 * DTO 변환 유틸리티 클래스
 */
export class MarketingDataDTOMapper {
  /**
   * Entity를 DTO로 변환
   * @param {any} entity - 엔티티
   * @returns {MarketingDataDTO} DTO
   */
  static toDTO(entity: any): MarketingDataDTO {
    return {
      id: entity.id,
      pensionName: entity.pensionName,
      monthYear: entity.monthYear,
      revenue: this.toRevenueDTO(entity.revenue),
      rooms: entity.rooms.map((room: any) => this.toRoomDTO(room)),
      advertisements: entity.advertisements.map((ad: any) => this.toAdvertisementDTO(ad)),
      metadata: this.toMetadataDTO(entity.metadata),
      statistics: this.calculateStatistics(entity)
    };
  }

  /**
   * DTO를 Entity로 변환
   * @param {MarketingDataDTO} dto - DTO
   * @returns {any} 엔티티
   */
  static toEntity(dto: MarketingDataDTO): any {
    return {
      id: dto.id,
      pensionName: dto.pensionName,
      monthYear: dto.monthYear,
      revenue: this.toRevenueEntity(dto.revenue),
      rooms: dto.rooms.map(room => this.toRoomEntity(room)),
      advertisements: dto.advertisements.map(ad => this.toAdvertisementEntity(ad)),
      metadata: this.toMetadataEntity(dto.metadata)
    };
  }

  /**
   * Revenue Entity를 DTO로 변환
   * @private
   */
  private static toRevenueDTO(revenue: any): RevenueDTO {
    return {
      totalRevenue: revenue.totalRevenue || 0,
      roomRevenue: revenue.roomRevenue || 0,
      additionalRevenue: revenue.additionalRevenue || 0,
      onlineRevenue: revenue.onlineRevenue || 0,
      offlineRevenue: revenue.offlineRevenue || 0,
      cashRevenue: revenue.cashRevenue || 0,
      cardRevenue: revenue.cardRevenue || 0,
      transferRevenue: revenue.transferRevenue || 0,
      advanceBookingRevenue: revenue.advanceBookingRevenue || 0,
      onsiteBookingRevenue: revenue.onsiteBookingRevenue || 0
    };
  }

  /**
   * Revenue DTO를 Entity로 변환
   * @private
   */
  private static toRevenueEntity(dto: RevenueDTO): any {
    return { ...dto };
  }

  /**
   * Room Entity를 DTO로 변환
   * @private
   */
  private static toRoomDTO(room: any): RoomDTO {
    return {
      roomName: room.roomName,
      roomType: room.roomType,
      basePrice: room.basePrice,
      weekendPrice: room.weekendPrice,
      peakSeasonPrice: room.peakSeasonPrice,
      capacity: {
        standard: room.capacity.standard,
        maximum: room.capacity.maximum,
        extraCharge: room.capacity.extraCharge
      },
      amenities: [...room.amenities],
      occupancyRate: room.occupancyRate,
      averagePrice: room.averagePrice,
      totalRevenue: room.totalRevenue,
      bookingCount: room.bookingCount
    };
  }

  /**
   * Room DTO를 Entity로 변환
   * @private
   */
  private static toRoomEntity(dto: RoomDTO): any {
    return { ...dto };
  }

  /**
   * Advertisement Entity를 DTO로 변환
   * @private
   */
  private static toAdvertisementDTO(ad: any): AdvertisementDTO {
    const dto: AdvertisementDTO = {
      channelName: ad.channelName,
      channelType: ad.channelType,
      budget: ad.budget,
      spend: ad.spend,
      impressions: ad.impressions,
      clicks: ad.clicks,
      conversions: ad.conversions,
      revenue: ad.revenue,
      startDate: typeof ad.startDate === 'string' ? ad.startDate : ad.startDate.toISOString(),
      endDate: typeof ad.endDate === 'string' ? ad.endDate : ad.endDate.toISOString(),
      isActive: ad.isActive
    };

    // 계산된 지표 추가
    if (ad.calculateROI) dto.roi = ad.calculateROI();
    if (ad.calculateROAS) dto.roas = ad.calculateROAS();
    if (ad.ctr !== undefined) dto.ctr = ad.ctr;
    if (ad.cvr !== undefined) dto.cvr = ad.cvr;
    if (ad.calculateCPC) dto.cpc = ad.calculateCPC();
    if (ad.calculateCPM) dto.cpm = ad.calculateCPM();
    if (ad.calculateCPA) dto.cpa = ad.calculateCPA();

    return dto;
  }

  /**
   * Advertisement DTO를 Entity로 변환
   * @private
   */
  private static toAdvertisementEntity(dto: AdvertisementDTO): any {
    return {
      channelName: dto.channelName,
      channelType: dto.channelType,
      budget: dto.budget,
      spend: dto.spend,
      impressions: dto.impressions,
      clicks: dto.clicks,
      conversions: dto.conversions,
      revenue: dto.revenue,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      isActive: dto.isActive
    };
  }

  /**
   * Metadata Entity를 DTO로 변환
   * @private
   */
  private static toMetadataDTO(metadata: any): MarketingMetadataDTO {
    return {
      createdAt: typeof metadata.createdAt === 'string' 
        ? metadata.createdAt 
        : metadata.createdAt.toISOString(),
      updatedAt: typeof metadata.updatedAt === 'string'
        ? metadata.updatedAt
        : metadata.updatedAt.toISOString(),
      version: metadata.version || 1,
      isValid: metadata.isValid !== undefined ? metadata.isValid : true,
      lastValidatedAt: metadata.lastValidatedAt 
        ? (typeof metadata.lastValidatedAt === 'string' 
          ? metadata.lastValidatedAt 
          : metadata.lastValidatedAt.toISOString())
        : undefined,
      validationScore: metadata.validationScore
    };
  }

  /**
   * Metadata DTO를 Entity로 변환
   * @private
   */
  private static toMetadataEntity(dto: MarketingMetadataDTO): any {
    return {
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt),
      version: dto.version,
      isValid: dto.isValid,
      lastValidatedAt: dto.lastValidatedAt ? new Date(dto.lastValidatedAt) : undefined,
      validationScore: dto.validationScore
    };
  }

  /**
   * 통계 계산
   * @private
   */
  private static calculateStatistics(entity: any): MarketingStatisticsDTO {
    const roomCount = entity.rooms?.length || 0;
    const advertisementCount = entity.advertisements?.length || 0;
    
    // 평균 점유율
    const averageOccupancyRate = roomCount > 0
      ? entity.rooms.reduce((sum: number, room: any) => sum + room.occupancyRate, 0) / roomCount
      : 0;
    
    // 총 광고 지출
    const totalAdvertisementSpend = entity.advertisements?.reduce(
      (sum: number, ad: any) => sum + ad.spend, 0
    ) || 0;
    
    // 총 광고 수익
    const totalAdvertisementRevenue = entity.advertisements?.reduce(
      (sum: number, ad: any) => sum + ad.revenue, 0
    ) || 0;
    
    // ROI & ROAS
    const totalROI = totalAdvertisementSpend > 0
      ? ((totalAdvertisementRevenue - totalAdvertisementSpend) / totalAdvertisementSpend) * 100
      : 0;
    
    const totalROAS = totalAdvertisementSpend > 0
      ? totalAdvertisementRevenue / totalAdvertisementSpend
      : 0;
    
    // 데이터 완성도 (0-100)
    let dataCompleteness = 100;
    if (!entity.revenue) dataCompleteness -= 20;
    if (roomCount === 0) dataCompleteness -= 20;
    if (advertisementCount === 0) dataCompleteness -= 10;
    if (!entity.monthYear) dataCompleteness -= 10;
    if (!entity.pensionName) dataCompleteness -= 10;
    
    // 데이터 품질 점수 (0-100)
    const dataQualityScore = Math.min(100, Math.max(0, 
      dataCompleteness * 0.5 + 
      (100 - Math.abs(totalROI)) * 0.3 +
      averageOccupancyRate * 0.2
    ));

    return {
      totalFields: entity.totalFields || this.estimateFieldCount(entity),
      roomCount,
      advertisementCount,
      averageOccupancyRate,
      totalAdvertisementSpend,
      totalROI,
      totalROAS,
      dataCompleteness,
      dataQualityScore
    };
  }

  /**
   * 필드 수 추정
   * @private
   */
  private static estimateFieldCount(entity: any): number {
    let count = 0;
    
    // 기본 필드
    count += 3; // id, pensionName, monthYear
    
    // Revenue 필드
    if (entity.revenue) count += 10;
    
    // Rooms 필드
    if (entity.rooms) {
      entity.rooms.forEach((room: any) => {
        count += 14; // 각 room의 필드
      });
    }
    
    // Advertisements 필드
    if (entity.advertisements) {
      entity.advertisements.forEach((ad: any) => {
        count += 15; // 각 advertisement의 필드
      });
    }
    
    // Metadata 필드
    if (entity.metadata) count += 6;
    
    return count;
  }

  /**
   * 요약 DTO 생성
   * @param {MarketingDataDTO} dto - 전체 DTO
   * @returns {MarketingDataSummaryDTO} 요약 DTO
   */
  static toSummaryDTO(dto: MarketingDataDTO): MarketingDataSummaryDTO {
    const statistics = dto.statistics || this.calculateStatistics(dto);
    
    return {
      id: dto.id!,
      pensionName: dto.pensionName,
      monthYear: dto.monthYear,
      totalRevenue: dto.revenue.totalRevenue,
      roomCount: statistics.roomCount,
      advertisementCount: statistics.advertisementCount,
      averageOccupancyRate: statistics.averageOccupancyRate,
      totalAdvertisementSpend: statistics.totalAdvertisementSpend,
      roi: statistics.totalROI,
      dataQualityScore: statistics.dataQualityScore,
      lastUpdated: dto.metadata.updatedAt
    };
  }
}