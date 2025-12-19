/**
 * @fileoverview Repository Interfaces 통합 Export
 * @description 도메인 레이어의 모든 Repository 인터페이스를 중앙에서 관리
 */

// 기본 Repository 인터페이스
export {
  Repository,
  PaginatedRepository,
  TransactionalRepository,
  CachedRepository,
  RepositoryFactory,
  QueryOptions,
  FilterOptions,
  FilterOperator,
  RepositoryResult,
  PaginatedResult,
  RepositoryError,
  RepositoryErrorCode
} from './Repository';

// MarketingRepository 인터페이스
export {
  MarketingRepository,
  MarketingAggregation,
  MarketingSummary,
  MarketingFilter,
  MarketingSortField,
  BatchOperationResult,
  MarketingStatistics
} from './MarketingRepository';

// Repository 유틸리티 타입
export type AnyRepository = Repository<any, any>;

// Repository 메타데이터 타입
export interface RepositoryMetadata {
  name: string;
  entityType: string;
  features: {
    pagination: boolean;
    transaction: boolean;
    cache: boolean;
    batch: boolean;
  };
}

// Repository 설정 타입
export interface RepositoryConfig {
  enableCache?: boolean;
  cacheTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  connectionTimeout?: number;
}

// Repository 헬퍼 클래스
export class RepositoryHelper {
  /**
   * 필터 조건을 쿼리 문자열로 변환
   * @param {FilterOptions[]} filters - 필터 조건
   * @returns {string} 쿼리 문자열
   */
  static filtersToQueryString(filters: FilterOptions[]): string {
    return filters
      .map(f => `${f.field}${f.operator}${f.value}`)
      .join('&');
  }

  /**
   * 페이지네이션 메타데이터 계산
   * @param {number} total - 전체 개수
   * @param {number} page - 현재 페이지
   * @param {number} pageSize - 페이지 크기
   * @returns {object} 페이지네이션 메타데이터
   */
  static calculatePaginationMeta(
    total: number,
    page: number,
    pageSize: number
  ): {
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    startIndex: number;
    endIndex: number;
  } {
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize - 1, total - 1);

    return {
      totalPages,
      hasNext,
      hasPrevious,
      startIndex,
      endIndex
    };
  }

  /**
   * 에러 코드를 메시지로 변환
   * @param {RepositoryErrorCode} code - 에러 코드
   * @returns {string} 에러 메시지
   */
  static getErrorMessage(code: RepositoryErrorCode): string {
    const messages: Record<RepositoryErrorCode, string> = {
      [RepositoryErrorCode.NOT_FOUND]: '요청한 데이터를 찾을 수 없습니다.',
      [RepositoryErrorCode.ALREADY_EXISTS]: '이미 존재하는 데이터입니다.',
      [RepositoryErrorCode.VALIDATION_ERROR]: '데이터 유효성 검증에 실패했습니다.',
      [RepositoryErrorCode.CONSTRAINT_VIOLATION]: '제약 조건을 위반했습니다.',
      [RepositoryErrorCode.CONNECTION_ERROR]: '데이터베이스 연결에 실패했습니다.',
      [RepositoryErrorCode.PERMISSION_DENIED]: '권한이 없습니다.',
      [RepositoryErrorCode.QUOTA_EXCEEDED]: '할당량을 초과했습니다.',
      [RepositoryErrorCode.UNKNOWN_ERROR]: '알 수 없는 오류가 발생했습니다.'
    };

    return messages[code] || '오류가 발생했습니다.';
  }
}