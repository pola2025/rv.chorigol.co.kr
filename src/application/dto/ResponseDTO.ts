/**
 * @fileoverview Response DTO (Data Transfer Object)
 * @description API 응답을 위한 표준화된 DTO 정의
 */

/**
 * API 응답 상태 코드
 */
export enum ResponseStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  PENDING = 'PENDING',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS'
}

/**
 * API 응답 코드
 */
export enum ResponseCode {
  // Success codes (2xx)
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  
  // Client error codes (4xx)
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  
  // Server error codes (5xx)
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504
}

/**
 * 에러 세부 정보
 */
export interface ErrorDetail {
  field?: string;
  code: string;
  message: string;
  details?: any;
}

/**
 * 페이지네이션 메타데이터
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * 응답 메타데이터
 */
export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  version?: string;
  executionTime?: number;
  pagination?: PaginationMeta;
  warnings?: string[];
}

/**
 * 기본 응답 DTO
 * @template T - 데이터 타입
 */
export interface ResponseDTO<T = any> {
  status: ResponseStatus;
  code: ResponseCode;
  message: string;
  data?: T;
  errors?: ErrorDetail[];
  meta: ResponseMeta;
}

/**
 * 성공 응답 DTO
 * @template T - 데이터 타입
 */
export interface SuccessResponseDTO<T = any> extends ResponseDTO<T> {
  status: ResponseStatus.SUCCESS;
  code: ResponseCode.OK | ResponseCode.CREATED | ResponseCode.ACCEPTED | ResponseCode.NO_CONTENT;
  data: T;
}

/**
 * 에러 응답 DTO
 */
export interface ErrorResponseDTO extends ResponseDTO<null> {
  status: ResponseStatus.ERROR;
  code: ResponseCode;
  errors: ErrorDetail[];
}

/**
 * 페이지네이션 응답 DTO
 * @template T - 아이템 타입
 */
export interface PaginatedResponseDTO<T = any> extends SuccessResponseDTO<T[]> {
  meta: ResponseMeta & {
    pagination: PaginationMeta;
  };
}

/**
 * 일괄 작업 응답 DTO
 * @template T - 성공 아이템 타입
 */
export interface BatchResponseDTO<T = any> extends ResponseDTO<T[]> {
  status: ResponseStatus.SUCCESS | ResponseStatus.PARTIAL_SUCCESS | ResponseStatus.ERROR;
  succeeded: number;
  failed: number;
  total: number;
  successItems?: T[];
  failedItems?: Array<{
    item: any;
    error: ErrorDetail;
  }>;
}

/**
 * 검증 응답 DTO
 */
export interface ValidationResponseDTO extends ResponseDTO<null> {
  isValid: boolean;
  errors: ErrorDetail[];
  warnings: string[];
  score?: number;
  suggestions?: string[];
}

/**
 * 파일 업로드 응답 DTO
 */
export interface FileUploadResponseDTO extends SuccessResponseDTO<{
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url?: string;
}> {}

/**
 * 파일 다운로드 응답 DTO
 */
export interface FileDownloadResponseDTO extends SuccessResponseDTO<{
  fileName: string;
  fileSize: number;
  mimeType: string;
  content: string | ArrayBuffer;
  encoding?: string;
}> {}

/**
 * 통계 응답 DTO
 */
export interface StatisticsResponseDTO<T = any> extends SuccessResponseDTO<{
  statistics: T;
  period?: {
    start: string;
    end: string;
  };
  groupBy?: string;
  aggregations?: Record<string, any>;
}> {}

/**
 * 작업 상태 응답 DTO
 */
export interface JobStatusResponseDTO extends ResponseDTO<{
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress?: number;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  error?: ErrorDetail;
}> {}

/**
 * 헬스 체크 응답 DTO
 */
export interface HealthCheckResponseDTO extends SuccessResponseDTO<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Array<{
    name: string;
    status: 'up' | 'down';
    responseTime?: number;
    error?: string;
  }>;
  uptime: number;
  timestamp: string;
}> {}

/**
 * Response Builder 클래스
 */
export class ResponseBuilder {
  /**
   * 성공 응답 생성
   * @template T
   * @param {T} data - 응답 데이터
   * @param {string} message - 메시지
   * @param {Partial<ResponseMeta>} meta - 메타데이터
   * @returns {SuccessResponseDTO<T>} 성공 응답
   */
  static success<T>(
    data: T,
    message: string = 'Success',
    meta: Partial<ResponseMeta> = {}
  ): SuccessResponseDTO<T> {
    return {
      status: ResponseStatus.SUCCESS,
      code: ResponseCode.OK,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * 생성 응답 생성
   * @template T
   * @param {T} data - 생성된 데이터
   * @param {string} message - 메시지
   * @param {Partial<ResponseMeta>} meta - 메타데이터
   * @returns {SuccessResponseDTO<T>} 생성 응답
   */
  static created<T>(
    data: T,
    message: string = 'Created successfully',
    meta: Partial<ResponseMeta> = {}
  ): SuccessResponseDTO<T> {
    return {
      status: ResponseStatus.SUCCESS,
      code: ResponseCode.CREATED,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * 에러 응답 생성
   * @param {ResponseCode} code - 응답 코드
   * @param {string} message - 메시지
   * @param {ErrorDetail[]} errors - 에러 상세
   * @param {Partial<ResponseMeta>} meta - 메타데이터
   * @returns {ErrorResponseDTO} 에러 응답
   */
  static error(
    code: ResponseCode,
    message: string,
    errors: ErrorDetail[] = [],
    meta: Partial<ResponseMeta> = {}
  ): ErrorResponseDTO {
    return {
      status: ResponseStatus.ERROR,
      code,
      message,
      data: null,
      errors,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * 페이지네이션 응답 생성
   * @template T
   * @param {T[]} items - 아이템 배열
   * @param {PaginationMeta} pagination - 페이지네이션 메타데이터
   * @param {string} message - 메시지
   * @param {Partial<ResponseMeta>} meta - 추가 메타데이터
   * @returns {PaginatedResponseDTO<T>} 페이지네이션 응답
   */
  static paginated<T>(
    items: T[],
    pagination: PaginationMeta,
    message: string = 'Success',
    meta: Partial<ResponseMeta> = {}
  ): PaginatedResponseDTO<T> {
    return {
      status: ResponseStatus.SUCCESS,
      code: ResponseCode.OK,
      message,
      data: items,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
        pagination
      }
    };
  }

  /**
   * 일괄 작업 응답 생성
   * @template T
   * @param {T[]} successItems - 성공 아이템
   * @param {Array} failedItems - 실패 아이템
   * @param {string} message - 메시지
   * @returns {BatchResponseDTO<T>} 일괄 작업 응답
   */
  static batch<T>(
    successItems: T[],
    failedItems: Array<{ item: any; error: ErrorDetail }> = [],
    message?: string
  ): BatchResponseDTO<T> {
    const succeeded = successItems.length;
    const failed = failedItems.length;
    const total = succeeded + failed;
    
    let status: ResponseStatus;
    let code: ResponseCode;
    
    if (failed === 0) {
      status = ResponseStatus.SUCCESS;
      code = ResponseCode.OK;
      message = message || `All ${total} items processed successfully`;
    } else if (succeeded === 0) {
      status = ResponseStatus.ERROR;
      code = ResponseCode.UNPROCESSABLE_ENTITY;
      message = message || `All ${total} items failed`;
    } else {
      status = ResponseStatus.PARTIAL_SUCCESS;
      code = ResponseCode.OK;
      message = message || `${succeeded} succeeded, ${failed} failed`;
    }

    return {
      status,
      code,
      message,
      data: successItems,
      succeeded,
      failed,
      total,
      successItems,
      failedItems: failedItems.length > 0 ? failedItems : undefined,
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 검증 응답 생성
   * @param {boolean} isValid - 유효성 여부
   * @param {ErrorDetail[]} errors - 에러 목록
   * @param {string[]} warnings - 경고 목록
   * @param {number} score - 검증 점수
   * @param {string[]} suggestions - 제안 사항
   * @returns {ValidationResponseDTO} 검증 응답
   */
  static validation(
    isValid: boolean,
    errors: ErrorDetail[] = [],
    warnings: string[] = [],
    score?: number,
    suggestions?: string[]
  ): ValidationResponseDTO {
    return {
      status: isValid ? ResponseStatus.SUCCESS : ResponseStatus.ERROR,
      code: isValid ? ResponseCode.OK : ResponseCode.UNPROCESSABLE_ENTITY,
      message: isValid ? 'Validation passed' : 'Validation failed',
      data: null,
      isValid,
      errors,
      warnings,
      score,
      suggestions,
      meta: {
        timestamp: new Date().toISOString(),
        warnings: warnings.length > 0 ? warnings : undefined
      }
    };
  }

  /**
   * 빈 성공 응답 생성 (204 No Content)
   * @param {string} message - 메시지
   * @returns {SuccessResponseDTO<null>} 빈 응답
   */
  static noContent(message: string = 'Success'): SuccessResponseDTO<null> {
    return {
      status: ResponseStatus.SUCCESS,
      code: ResponseCode.NO_CONTENT,
      message,
      data: null,
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 경고 포함 성공 응답 생성
   * @template T
   * @param {T} data - 응답 데이터
   * @param {string[]} warnings - 경고 메시지
   * @param {string} message - 메시지
   * @returns {ResponseDTO<T>} 경고 포함 응답
   */
  static successWithWarnings<T>(
    data: T,
    warnings: string[],
    message: string = 'Success with warnings'
  ): ResponseDTO<T> {
    return {
      status: ResponseStatus.WARNING,
      code: ResponseCode.OK,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        warnings
      }
    };
  }
}

/**
 * 에러 코드 매핑
 */
export class ErrorCodeMapper {
  private static readonly errorMap: Record<string, ResponseCode> = {
    'VALIDATION_ERROR': ResponseCode.BAD_REQUEST,
    'BUSINESS_RULE_VIOLATION': ResponseCode.UNPROCESSABLE_ENTITY,
    'RESOURCE_NOT_FOUND': ResponseCode.NOT_FOUND,
    'RESOURCE_ALREADY_EXISTS': ResponseCode.CONFLICT,
    'UNAUTHORIZED': ResponseCode.UNAUTHORIZED,
    'FORBIDDEN': ResponseCode.FORBIDDEN,
    'DEPENDENCY_ERROR': ResponseCode.BAD_GATEWAY,
    'EXTERNAL_SERVICE_ERROR': ResponseCode.BAD_GATEWAY,
    'TIMEOUT_ERROR': ResponseCode.GATEWAY_TIMEOUT,
    'UNKNOWN_ERROR': ResponseCode.INTERNAL_SERVER_ERROR,
    'NOT_IMPLEMENTED': ResponseCode.NOT_IMPLEMENTED,
    'RATE_LIMIT_EXCEEDED': ResponseCode.TOO_MANY_REQUESTS
  };

  /**
   * 에러 코드를 HTTP 응답 코드로 변환
   * @param {string} errorCode - 에러 코드
   * @returns {ResponseCode} HTTP 응답 코드
   */
  static toResponseCode(errorCode: string): ResponseCode {
    return this.errorMap[errorCode] || ResponseCode.INTERNAL_SERVER_ERROR;
  }

  /**
   * 에러 객체를 ErrorDetail로 변환
   * @param {any} error - 에러 객체
   * @returns {ErrorDetail} 에러 상세
   */
  static toErrorDetail(error: any): ErrorDetail {
    if (error instanceof Error) {
      return {
        code: error.name || 'ERROR',
        message: error.message,
        details: error.stack
      };
    }

    if (typeof error === 'object' && error !== null) {
      return {
        field: error.field,
        code: error.code || 'ERROR',
        message: error.message || String(error),
        details: error.details
      };
    }

    return {
      code: 'ERROR',
      message: String(error)
    };
  }
}