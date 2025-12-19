/**
 * @fileoverview ValidateMarketingDataUseCase
 * @description 마케팅 데이터 유효성 검증 Use Case
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

/**
 * ValidateMarketingData 입력 DTO
 */
export interface ValidateMarketingDataInput {
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
  excludeId?: string; // 수정 시 현재 ID 제외
}

/**
 * ValidateMarketingData 출력 DTO
 */
export interface ValidateMarketingDataOutput {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: {
    totalFields: number;
    maxFieldsAllowed: number;
    fieldUsagePercentage: number;
    roomCount: number;
    advertisementCount: number;
  };
  dataQuality: {
    score: number; // 0-100
    issues: DataQualityIssue[];
  };
  validatedAt: Date;
}

/**
 * 검증 에러
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error';
}

/**
 * 검증 경고
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  severity: 'warning';
}

/**
 * 데이터 품질 이슈
 */
export interface DataQualityIssue {
  type: 'missing' | 'inconsistent' | 'unusual' | 'incomplete';
  field: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

/**
 * ValidateMarketingDataUseCase
 * @class
 * @extends {BaseUseCase<ValidateMarketingDataInput, ValidateMarketingDataOutput>}
 */
export class ValidateMarketingDataUseCase extends BaseUseCase<
  ValidateMarketingDataInput,
  ValidateMarketingDataOutput
> {
  protected readonly name = 'ValidateMarketingDataUseCase';

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
   * 입력 검증 (기본 검증만)
   * @protected
   * @param {ValidateMarketingDataInput} input - 검증할 입력
   */
  protected async validate(input: ValidateMarketingDataInput): Promise<void> {
    // 기본적인 입력 존재 여부만 체크
    if (!input) {
      throw this.createValidationError('입력 데이터가 없습니다.');
    }
  }

  /**
   * 비즈니스 로직 실행
   * @protected
   * @param {ValidateMarketingDataInput} input - 입력 데이터
   * @returns {Promise<ValidateMarketingDataOutput>} 검증 결과
   */
  protected async executeImpl(
    input: ValidateMarketingDataInput
  ): Promise<ValidateMarketingDataOutput> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const dataQualityIssues: DataQualityIssue[] = [];

    // 1. 필수 필드 검증
    this.validateRequiredFields(input, errors);

    // 2. 형식 검증
    this.validateFormats(input, errors);

    // 3. 비즈니스 규칙 검증
    await this.validateBusinessRules(input, errors, warnings);

    // 4. 데이터 일관성 검증
    this.validateDataConsistency(input, warnings);

    // 5. 데이터 품질 검증
    this.validateDataQuality(input, dataQualityIssues);

    // 6. Firebase 제약 검증
    const fieldCount = this.calculateFieldCount(input);
    const maxFields = 500;
    
    if (fieldCount > maxFields) {
      errors.push({
        field: 'total',
        message: `총 필드 수(${fieldCount})가 Firebase 제한(${maxFields})을 초과합니다.`,
        code: 'FIELD_COUNT_EXCEEDED',
        severity: 'error'
      });
    } else if (fieldCount > maxFields * 0.9) {
      warnings.push({
        field: 'total',
        message: `총 필드 수(${fieldCount})가 Firebase 제한(${maxFields})의 90%를 초과합니다.`,
        code: 'FIELD_COUNT_HIGH',
        severity: 'warning'
      });
    }

    // 7. 중복 체크
    if (!input.excludeId) {
      const isDuplicate = await this.marketingRepository.checkDuplicate(
        input.pensionName,
        input.monthYear
      );
      
      if (isDuplicate) {
        errors.push({
          field: 'pensionName,monthYear',
          message: '해당 펜션의 해당 월 데이터가 이미 존재합니다.',
          code: 'DUPLICATE_DATA',
          severity: 'error'
        });
      }
    }

    // 데이터 품질 점수 계산
    const dataQualityScore = this.calculateDataQualityScore(
      errors.length,
      warnings.length,
      dataQualityIssues.length
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalFields: fieldCount,
        maxFieldsAllowed: maxFields,
        fieldUsagePercentage: (fieldCount / maxFields) * 100,
        roomCount: input.rooms.length,
        advertisementCount: input.advertisements.length
      },
      dataQuality: {
        score: dataQualityScore,
        issues: dataQualityIssues
      },
      validatedAt: new Date()
    };
  }

  /**
   * 필수 필드 검증
   * @private
   */
  private validateRequiredFields(
    input: ValidateMarketingDataInput,
    errors: ValidationError[]
  ): void {
    if (!input.pensionName || input.pensionName.trim() === '') {
      errors.push({
        field: 'pensionName',
        message: '펜션 이름은 필수 입력 항목입니다.',
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error'
      });
    }

    if (!input.monthYear) {
      errors.push({
        field: 'monthYear',
        message: '년월은 필수 입력 항목입니다.',
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error'
      });
    }

    if (!input.revenue) {
      errors.push({
        field: 'revenue',
        message: '매출 정보는 필수 입력 항목입니다.',
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error'
      });
    }

    // 각 객실의 필수 필드
    input.rooms.forEach((room, index) => {
      if (!room.roomName || room.roomName.trim() === '') {
        errors.push({
          field: `rooms[${index}].roomName`,
          message: `객실 ${index + 1}의 이름은 필수 입력 항목입니다.`,
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'error'
        });
      }
    });

    // 각 광고의 필수 필드
    input.advertisements.forEach((ad, index) => {
      if (!ad.channelName || ad.channelName.trim() === '') {
        errors.push({
          field: `advertisements[${index}].channelName`,
          message: `광고 ${index + 1}의 채널명은 필수 입력 항목입니다.`,
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'error'
        });
      }
    });
  }

  /**
   * 형식 검증
   * @private
   */
  private validateFormats(
    input: ValidateMarketingDataInput,
    errors: ValidationError[]
  ): void {
    // 년월 형식 검증
    if (input.monthYear && !this.isValidMonthYear(input.monthYear)) {
      errors.push({
        field: 'monthYear',
        message: '유효한 년월 형식이 아닙니다. (YYYY-MM)',
        code: 'INVALID_FORMAT',
        severity: 'error'
      });
    }

    // 숫자 필드 검증
    if (input.revenue) {
      Object.entries(input.revenue).forEach(([key, value]) => {
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push({
            field: `revenue.${key}`,
            message: `${key}는 유효한 숫자여야 합니다.`,
            code: 'INVALID_NUMBER',
            severity: 'error'
          });
        } else if (value < 0) {
          errors.push({
            field: `revenue.${key}`,
            message: `${key}는 음수일 수 없습니다.`,
            code: 'NEGATIVE_VALUE',
            severity: 'error'
          });
        }
      });
    }

    // 날짜 형식 검증
    input.advertisements.forEach((ad, index) => {
      const startDate = new Date(ad.startDate);
      const endDate = new Date(ad.endDate);

      if (isNaN(startDate.getTime())) {
        errors.push({
          field: `advertisements[${index}].startDate`,
          message: '유효하지 않은 시작 날짜입니다.',
          code: 'INVALID_DATE',
          severity: 'error'
        });
      }

      if (isNaN(endDate.getTime())) {
        errors.push({
          field: `advertisements[${index}].endDate`,
          message: '유효하지 않은 종료 날짜입니다.',
          code: 'INVALID_DATE',
          severity: 'error'
        });
      }
    });
  }

  /**
   * 비즈니스 규칙 검증
   * @private
   */
  private async validateBusinessRules(
    input: ValidateMarketingDataInput,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // 객실 수 제한
    if (input.rooms.length > 50) {
      errors.push({
        field: 'rooms',
        message: `객실 수(${input.rooms.length})는 최대 50개까지 등록 가능합니다.`,
        code: 'ROOM_COUNT_EXCEEDED',
        severity: 'error'
      });
    }

    // 광고 수 제한
    if (input.advertisements.length > 20) {
      errors.push({
        field: 'advertisements',
        message: `광고 항목(${input.advertisements.length})은 최대 20개까지 등록 가능합니다.`,
        code: 'ADVERTISEMENT_COUNT_EXCEEDED',
        severity: 'error'
      });
    }

    // 객실별 비즈니스 규칙
    input.rooms.forEach((room, index) => {
      // 점유율 범위
      if (room.occupancyRate < 0 || room.occupancyRate > 100) {
        errors.push({
          field: `rooms[${index}].occupancyRate`,
          message: '점유율은 0~100 사이여야 합니다.',
          code: 'INVALID_RANGE',
          severity: 'error'
        });
      }

      // 수용 인원 검증
      if (room.capacity.standard <= 0) {
        errors.push({
          field: `rooms[${index}].capacity.standard`,
          message: '기준 인원은 1명 이상이어야 합니다.',
          code: 'INVALID_CAPACITY',
          severity: 'error'
        });
      }

      if (room.capacity.maximum < room.capacity.standard) {
        errors.push({
          field: `rooms[${index}].capacity.maximum`,
          message: '최대 인원은 기준 인원 이상이어야 합니다.',
          code: 'INVALID_CAPACITY',
          severity: 'error'
        });
      }

      // 가격 논리 경고
      if (room.weekendPrice > 0 && room.weekendPrice < room.basePrice) {
        warnings.push({
          field: `rooms[${index}].weekendPrice`,
          message: '주말 가격이 기본 가격보다 낮습니다.',
          code: 'UNUSUAL_PRICING',
          severity: 'warning'
        });
      }
    });

    // 광고별 비즈니스 규칙
    input.advertisements.forEach((ad, index) => {
      // 클릭수가 노출수를 초과
      if (ad.clicks > ad.impressions) {
        errors.push({
          field: `advertisements[${index}].clicks`,
          message: '클릭수는 노출수를 초과할 수 없습니다.',
          code: 'INVALID_METRICS',
          severity: 'error'
        });
      }

      // 전환수가 클릭수를 초과
      if (ad.conversions > ad.clicks) {
        errors.push({
          field: `advertisements[${index}].conversions`,
          message: '전환수는 클릭수를 초과할 수 없습니다.',
          code: 'INVALID_METRICS',
          severity: 'error'
        });
      }

      // 날짜 순서
      const startDate = new Date(ad.startDate);
      const endDate = new Date(ad.endDate);
      if (endDate < startDate) {
        errors.push({
          field: `advertisements[${index}].dates`,
          message: '종료일은 시작일 이후여야 합니다.',
          code: 'INVALID_DATE_RANGE',
          severity: 'error'
        });
      }

      // 예산 초과 경고
      if (ad.spend > ad.budget && ad.budget > 0) {
        warnings.push({
          field: `advertisements[${index}].spend`,
          message: `지출액이 예산을 ${((ad.spend / ad.budget - 1) * 100).toFixed(1)}% 초과했습니다.`,
          code: 'BUDGET_EXCEEDED',
          severity: 'warning'
        });
      }

      // 비정상적인 CTR 경고
      const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
      if (ctr > 50) {
        warnings.push({
          field: `advertisements[${index}].ctr`,
          message: `CTR(${ctr.toFixed(1)}%)이 비정상적으로 높습니다.`,
          code: 'UNUSUAL_CTR',
          severity: 'warning'
        });
      }
    });
  }

  /**
   * 데이터 일관성 검증
   * @private
   */
  private validateDataConsistency(
    input: ValidateMarketingDataInput,
    warnings: ValidationWarning[]
  ): void {
    // 매출 일관성
    const revenue = input.revenue;
    const calculatedTotal = revenue.roomRevenue + revenue.additionalRevenue;
    
    if (Math.abs(revenue.totalRevenue - calculatedTotal) > 0.01) {
      warnings.push({
        field: 'revenue.totalRevenue',
        message: `총 매출(${revenue.totalRevenue})이 객실+부가 매출(${calculatedTotal})과 일치하지 않습니다.`,
        code: 'REVENUE_INCONSISTENCY',
        severity: 'warning'
      });
    }

    const channelTotal = revenue.onlineRevenue + revenue.offlineRevenue;
    if (Math.abs(revenue.totalRevenue - channelTotal) > 0.01) {
      warnings.push({
        field: 'revenue.channels',
        message: `채널별 매출 합계(${channelTotal})가 총 매출(${revenue.totalRevenue})과 일치하지 않습니다.`,
        code: 'CHANNEL_REVENUE_INCONSISTENCY',
        severity: 'warning'
      });
    }

    const paymentTotal = revenue.cashRevenue + revenue.cardRevenue + revenue.transferRevenue;
    if (paymentTotal > 0 && Math.abs(revenue.totalRevenue - paymentTotal) > 0.01) {
      warnings.push({
        field: 'revenue.payments',
        message: `결제 수단별 매출 합계(${paymentTotal})가 총 매출(${revenue.totalRevenue})과 일치하지 않습니다.`,
        code: 'PAYMENT_REVENUE_INCONSISTENCY',
        severity: 'warning'
      });
    }

    // 객실 매출 일관성
    const totalRoomRevenue = input.rooms.reduce((sum, room) => sum + room.totalRevenue, 0);
    if (Math.abs(revenue.roomRevenue - totalRoomRevenue) > 0.01) {
      warnings.push({
        field: 'revenue.roomRevenue',
        message: `객실 매출(${revenue.roomRevenue})이 개별 객실 매출 합계(${totalRoomRevenue})와 일치하지 않습니다.`,
        code: 'ROOM_REVENUE_INCONSISTENCY',
        severity: 'warning'
      });
    }
  }

  /**
   * 데이터 품질 검증
   * @private
   */
  private validateDataQuality(
    input: ValidateMarketingDataInput,
    issues: DataQualityIssue[]
  ): void {
    // 매출 데이터 완성도
    if (input.revenue.onlineRevenue === 0 && input.revenue.offlineRevenue === 0) {
      issues.push({
        type: 'incomplete',
        field: 'revenue.channels',
        description: '온라인/오프라인 매출이 모두 0입니다.',
        impact: 'medium'
      });
    }

    if (input.revenue.cashRevenue === 0 && 
        input.revenue.cardRevenue === 0 && 
        input.revenue.transferRevenue === 0) {
      issues.push({
        type: 'incomplete',
        field: 'revenue.payments',
        description: '결제 수단별 매출이 모두 0입니다.',
        impact: 'medium'
      });
    }

    // 객실 데이터 완성도
    input.rooms.forEach((room, index) => {
      if (room.occupancyRate === 0) {
        issues.push({
          type: 'unusual',
          field: `rooms[${index}].occupancyRate`,
          description: `${room.roomName} 객실의 점유율이 0%입니다.`,
          impact: 'low'
        });
      }

      if (room.amenities.length === 0) {
        issues.push({
          type: 'missing',
          field: `rooms[${index}].amenities`,
          description: `${room.roomName} 객실의 편의시설 정보가 없습니다.`,
          impact: 'low'
        });
      }

      if (room.bookingCount === 0 && room.totalRevenue > 0) {
        issues.push({
          type: 'inconsistent',
          field: `rooms[${index}].bookingCount`,
          description: `${room.roomName} 객실의 예약 건수가 0이지만 매출이 있습니다.`,
          impact: 'medium'
        });
      }
    });

    // 광고 데이터 완성도
    input.advertisements.forEach((ad, index) => {
      if (ad.impressions === 0) {
        issues.push({
          type: 'unusual',
          field: `advertisements[${index}].impressions`,
          description: `${ad.channelName} 광고의 노출수가 0입니다.`,
          impact: 'medium'
        });
      }

      const roi = ad.spend > 0 ? ((ad.revenue - ad.spend) / ad.spend) * 100 : 0;
      if (roi < -50) {
        issues.push({
          type: 'unusual',
          field: `advertisements[${index}].roi`,
          description: `${ad.channelName} 광고의 ROI가 -50% 미만입니다.`,
          impact: 'high'
        });
      }
    });

    // 전체 데이터 완성도
    if (input.rooms.length === 0) {
      issues.push({
        type: 'missing',
        field: 'rooms',
        description: '객실 정보가 없습니다.',
        impact: 'high'
      });
    }

    if (input.advertisements.length === 0) {
      issues.push({
        type: 'missing',
        field: 'advertisements',
        description: '광고 정보가 없습니다.',
        impact: 'medium'
      });
    }
  }

  /**
   * 필드 수 계산
   * @private
   */
  private calculateFieldCount(input: ValidateMarketingDataInput): number {
    let count = 0;

    // 기본 필드
    count += 2; // pensionName, monthYear

    // Revenue 필드
    count += Object.keys(input.revenue).length;

    // Rooms 필드
    input.rooms.forEach(room => {
      count += 13; // 기본 필드들
      count += 1; // amenities를 문자열로 저장
    });

    // Advertisements 필드
    input.advertisements.forEach(ad => {
      count += 14; // 모든 필드
    });

    // Metadata 필드
    count += 4; // createdAt, updatedAt, version, isValid

    return count;
  }

  /**
   * 데이터 품질 점수 계산
   * @private
   */
  private calculateDataQualityScore(
    errorCount: number,
    warningCount: number,
    issueCount: number
  ): number {
    let score = 100;

    // 에러당 -10점
    score -= errorCount * 10;

    // 경고당 -5점
    score -= warningCount * 5;

    // 이슈당 -2점
    score -= issueCount * 2;

    // 최소 0점
    return Math.max(0, score);
  }

  /**
   * 년월 형식 검증
   * @private
   */
  private isValidMonthYear(monthYear: string): boolean {
    const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
    return regex.test(monthYear);
  }
}