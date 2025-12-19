/**
 * @fileoverview MarketingRepository 인터페이스
 * @description 마케팅 데이터 저장소 인터페이스
 */

import { 
  Repository, 
  PaginatedRepository, 
  TransactionalRepository,
  FilterOptions,
  QueryOptions,
  PaginatedResult
} from './Repository';
import { 
  MarketingData, 
  Revenue, 
  Room, 
  Advertisement 
} from '../../entities';
import { Period, Money, Percentage } from '../../value-objects';

/**
 * 마케팅 데이터 집계 결과
 */
export interface MarketingAggregation {
  period: Period;
  totalRevenue: Money;
  averageOccupancyRate: Percentage;
  totalAdvertisementSpend: Money;
  roi: Percentage;
  roomCount: number;
  advertisementCount: number;
}

/**
 * 마케팅 데이터 요약
 */
export interface MarketingSummary {
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
 * 마케팅 데이터 필터
 */
export interface MarketingFilter {
  pensionName?: string;
  monthYear?: string;
  startDate?: Date;
  endDate?: Date;
  minRevenue?: number;
  maxRevenue?: number;
  hasRooms?: boolean;
  hasAdvertisements?: boolean;
}

/**
 * 마케팅 데이터 정렬 옵션
 */
export enum MarketingSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  MONTH_YEAR = 'monthYear',
  TOTAL_REVENUE = 'totalRevenue',
  ROOM_COUNT = 'roomCount',
  ADVERTISEMENT_COUNT = 'advertisementCount',
  OCCUPANCY_RATE = 'occupancyRate',
  ROI = 'roi'
}

/**
 * 일괄 작업 결과
 */
export interface BatchOperationResult {
  success: number;
  failed: number;
  errors: Array<{
    id?: string;
    error: string;
  }>;
}

/**
 * MarketingRepository 인터페이스
 * @interface
 * @extends {PaginatedRepository<MarketingData, string>}
 * @extends {TransactionalRepository<MarketingData, string>}
 */
export interface MarketingRepository 
  extends PaginatedRepository<MarketingData, string>,
          TransactionalRepository<MarketingData, string> {
  
  /**
   * 펜션명과 년월로 마케팅 데이터 조회
   * @param {string} pensionName - 펜션명
   * @param {string} monthYear - 년월 (YYYY-MM)
   * @returns {Promise<MarketingData | null>} 마케팅 데이터 또는 null
   */
  findByPensionAndMonth(
    pensionName: string, 
    monthYear: string
  ): Promise<MarketingData | null>;

  /**
   * 기간별 마케팅 데이터 조회
   * @param {Period} period - 조회 기간
   * @param {string} pensionName - 펜션명 (선택)
   * @returns {Promise<MarketingData[]>} 마케팅 데이터 배열
   */
  findByPeriod(
    period: Period, 
    pensionName?: string
  ): Promise<MarketingData[]>;

  /**
   * 마케팅 데이터 요약 조회
   * @param {MarketingFilter} filter - 필터 조건
   * @returns {Promise<MarketingSummary[]>} 요약 데이터 배열
   */
  findSummaries(filter: MarketingFilter): Promise<MarketingSummary[]>;

  /**
   * 페이지네이션된 마케팅 데이터 조회
   * @param {number} page - 페이지 번호
   * @param {number} pageSize - 페이지 크기
   * @param {MarketingFilter} filter - 필터 조건
   * @param {MarketingSortField} sortField - 정렬 필드
   * @param {'asc' | 'desc'} sortDirection - 정렬 방향
   * @returns {Promise<PaginatedResult<MarketingData>>} 페이지네이션된 결과
   */
  findPaginatedWithFilter(
    page: number,
    pageSize: number,
    filter?: MarketingFilter,
    sortField?: MarketingSortField,
    sortDirection?: 'asc' | 'desc'
  ): Promise<PaginatedResult<MarketingData>>;

  /**
   * 마케팅 데이터 집계
   * @param {Period} period - 집계 기간
   * @param {string} pensionName - 펜션명 (선택)
   * @returns {Promise<MarketingAggregation>} 집계 결과
   */
  aggregate(
    period: Period, 
    pensionName?: string
  ): Promise<MarketingAggregation>;

  /**
   * 월별 집계 데이터 조회
   * @param {number} year - 년도
   * @param {string} pensionName - 펜션명 (선택)
   * @returns {Promise<MarketingAggregation[]>} 월별 집계 데이터
   */
  aggregateByMonth(
    year: number, 
    pensionName?: string
  ): Promise<MarketingAggregation[]>;

  /**
   * 분기별 집계 데이터 조회
   * @param {number} year - 년도
   * @param {string} pensionName - 펜션명 (선택)
   * @returns {Promise<MarketingAggregation[]>} 분기별 집계 데이터
   */
  aggregateByQuarter(
    year: number, 
    pensionName?: string
  ): Promise<MarketingAggregation[]>;

  /**
   * 매출 업데이트
   * @param {string} id - 마케팅 데이터 ID
   * @param {Revenue} revenue - 새로운 매출 데이터
   * @returns {Promise<MarketingData>} 업데이트된 마케팅 데이터
   */
  updateRevenue(id: string, revenue: Revenue): Promise<MarketingData>;

  /**
   * 객실 추가
   * @param {string} id - 마케팅 데이터 ID
   * @param {Room} room - 추가할 객실
   * @returns {Promise<MarketingData>} 업데이트된 마케팅 데이터
   */
  addRoom(id: string, room: Room): Promise<MarketingData>;

  /**
   * 객실 업데이트
   * @param {string} id - 마케팅 데이터 ID
   * @param {string} roomName - 객실명
   * @param {Partial<Room>} updates - 업데이트 내용
   * @returns {Promise<MarketingData>} 업데이트된 마케팅 데이터
   */
  updateRoom(
    id: string, 
    roomName: string, 
    updates: Partial<Room>
  ): Promise<MarketingData>;

  /**
   * 객실 삭제
   * @param {string} id - 마케팅 데이터 ID
   * @param {string} roomName - 객실명
   * @returns {Promise<MarketingData>} 업데이트된 마케팅 데이터
   */
  removeRoom(id: string, roomName: string): Promise<MarketingData>;

  /**
   * 광고 추가
   * @param {string} id - 마케팅 데이터 ID
   * @param {Advertisement} advertisement - 추가할 광고
   * @returns {Promise<MarketingData>} 업데이트된 마케팅 데이터
   */
  addAdvertisement(
    id: string, 
    advertisement: Advertisement
  ): Promise<MarketingData>;

  /**
   * 광고 업데이트
   * @param {string} id - 마케팅 데이터 ID
   * @param {string} channelName - 채널명
   * @param {Partial<Advertisement>} updates - 업데이트 내용
   * @returns {Promise<MarketingData>} 업데이트된 마케팅 데이터
   */
  updateAdvertisement(
    id: string, 
    channelName: string, 
    updates: Partial<Advertisement>
  ): Promise<MarketingData>;

  /**
   * 광고 삭제
   * @param {string} id - 마케팅 데이터 ID
   * @param {string} channelName - 채널명
   * @returns {Promise<MarketingData>} 업데이트된 마케팅 데이터
   */
  removeAdvertisement(
    id: string, 
    channelName: string
  ): Promise<MarketingData>;

  /**
   * 일괄 저장
   * @param {MarketingData[]} dataList - 저장할 마케팅 데이터 배열
   * @returns {Promise<BatchOperationResult>} 일괄 작업 결과
   */
  batchSave(dataList: MarketingData[]): Promise<BatchOperationResult>;

  /**
   * 일괄 삭제
   * @param {string[]} ids - 삭제할 ID 배열
   * @returns {Promise<BatchOperationResult>} 일괄 작업 결과
   */
  batchDelete(ids: string[]): Promise<BatchOperationResult>;

  /**
   * 데이터 검증
   * @param {MarketingData} data - 검증할 데이터
   * @returns {Promise<boolean>} 유효성 여부
   */
  validate(data: MarketingData): Promise<boolean>;

  /**
   * Firebase 필드 수 체크
   * @param {MarketingData} data - 체크할 데이터
   * @returns {Promise<number>} 총 필드 수
   */
  checkFieldCount(data: MarketingData): Promise<number>;

  /**
   * 중복 데이터 체크
   * @param {string} pensionName - 펜션명
   * @param {string} monthYear - 년월
   * @param {string} excludeId - 제외할 ID (수정 시)
   * @returns {Promise<boolean>} 중복 여부
   */
  checkDuplicate(
    pensionName: string, 
    monthYear: string, 
    excludeId?: string
  ): Promise<boolean>;

  /**
   * 데이터 백업
   * @param {Period} period - 백업 기간
   * @returns {Promise<string>} 백업 파일 경로 또는 ID
   */
  backup(period: Period): Promise<string>;

  /**
   * 데이터 복원
   * @param {string} backupId - 백업 ID
   * @returns {Promise<void>}
   */
  restore(backupId: string): Promise<void>;

  /**
   * 데이터 내보내기
   * @param {MarketingFilter} filter - 필터 조건
   * @param {string} format - 내보내기 형식 (json, csv, excel)
   * @returns {Promise<Blob>} 내보낸 데이터
   */
  export(filter: MarketingFilter, format: string): Promise<Blob>;

  /**
   * 데이터 가져오기
   * @param {File} file - 가져올 파일
   * @param {boolean} overwrite - 덮어쓰기 여부
   * @returns {Promise<BatchOperationResult>} 가져오기 결과
   */
  import(file: File, overwrite: boolean): Promise<BatchOperationResult>;

  /**
   * 통계 조회
   * @param {Period} period - 조회 기간
   * @param {string} pensionName - 펜션명 (선택)
   * @returns {Promise<MarketingStatistics>} 통계 데이터
   */
  getStatistics(
    period: Period, 
    pensionName?: string
  ): Promise<MarketingStatistics>;

  /**
   * 캐시 무효화
   * @param {string} pensionName - 펜션명 (선택)
   * @param {string} monthYear - 년월 (선택)
   * @returns {Promise<void>}
   */
  invalidateCache(pensionName?: string, monthYear?: string): Promise<void>;
}

/**
 * 마케팅 통계 데이터
 */
export interface MarketingStatistics {
  period: Period;
  totalRevenue: Money;
  averageRevenue: Money;
  maxRevenue: Money;
  minRevenue: Money;
  totalRooms: number;
  averageOccupancyRate: Percentage;
  totalAdvertisements: number;
  totalAdvertisementSpend: Money;
  averageROI: Percentage;
  bestPerformingChannel: string;
  worstPerformingChannel: string;
  revenueGrowthRate: Percentage;
  dataQualityScore: Percentage;
}