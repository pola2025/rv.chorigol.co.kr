/**
 * @fileoverview Application DTOs 통합 Export
 * @description Application Layer의 모든 DTO를 중앙에서 관리
 */

// MarketingData DTOs
export {
  // Base DTOs
  type BaseDTO,
  type RevenueDTO,
  type RoomCapacityDTO,
  type RoomDTO,
  type AdvertisementDTO,
  type MarketingMetadataDTO,
  type MarketingStatisticsDTO,
  
  // Main DTOs
  type MarketingDataDTO,
  type CreateMarketingDataDTO,
  type UpdateMarketingDataDTO,
  type MarketingDataSummaryDTO,
  type MarketingDataListDTO,
  
  // Filter & Search DTOs
  type MarketingDataFilterDTO,
  type MarketingDataSortDTO,
  type SearchMarketingDataDTO,
  
  // Aggregation DTOs
  type MarketingDataAggregationDTO,
  
  // Import/Export DTOs
  type ExportMarketingDataDTO,
  type ImportMarketingDataDTO,
  
  // Mapper
  MarketingDataDTOMapper
} from './MarketingDataDTO';

// Response DTOs
export {
  // Enums
  ResponseStatus,
  ResponseCode,
  
  // Interfaces
  type ErrorDetail,
  type PaginationMeta,
  type ResponseMeta,
  type ResponseDTO,
  type SuccessResponseDTO,
  type ErrorResponseDTO,
  type PaginatedResponseDTO,
  type BatchResponseDTO,
  type ValidationResponseDTO,
  type FileUploadResponseDTO,
  type FileDownloadResponseDTO,
  type StatisticsResponseDTO,
  type JobStatusResponseDTO,
  type HealthCheckResponseDTO,
  
  // Builders & Mappers
  ResponseBuilder,
  ErrorCodeMapper
} from './ResponseDTO';

// DTO 유틸리티
export class DTOUtils {
  /**
   * 깊은 복사
   * @param {T} obj - 복사할 객체
   * @returns {T} 복사된 객체
   */
  static deepCopy<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (obj instanceof Array) {
      const copy: any[] = [];
      for (let i = 0; i < obj.length; i++) {
        copy[i] = this.deepCopy(obj[i]);
      }
      return copy as any;
    }

    if (obj instanceof Object) {
      const copy: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          copy[key] = this.deepCopy(obj[key]);
        }
      }
      return copy;
    }

    return obj;
  }

  /**
   * DTO 필드 필터링
   * @param {any} dto - 필터링할 DTO
   * @param {string[]} fields - 포함할 필드
   * @returns {any} 필터링된 DTO
   */
  static filterFields(dto: any, fields: string[]): any {
    if (!dto || !fields || fields.length === 0) {
      return dto;
    }

    const result: any = {};
    
    fields.forEach(field => {
      if (field.includes('.')) {
        // 중첩된 필드 처리
        const parts = field.split('.');
        let source = dto;
        let target = result;
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (source[part] !== undefined) {
            if (!target[part]) {
              target[part] = {};
            }
            source = source[part];
            target = target[part];
          } else {
            break;
          }
        }
        
        const lastPart = parts[parts.length - 1];
        if (source && source[lastPart] !== undefined) {
          target[lastPart] = source[lastPart];
        }
      } else {
        // 단순 필드
        if (dto[field] !== undefined) {
          result[field] = dto[field];
        }
      }
    });

    return result;
  }

  /**
   * DTO 병합
   * @param {any} target - 대상 DTO
   * @param {any} source - 소스 DTO
   * @param {boolean} deep - 깊은 병합 여부
   * @returns {any} 병합된 DTO
   */
  static merge(target: any, source: any, deep: boolean = false): any {
    if (!source) return target;
    if (!target) return source;

    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] === undefined) return;

      if (deep && typeof source[key] === 'object' && source[key] !== null) {
        if (source[key] instanceof Date) {
          result[key] = new Date(source[key]);
        } else if (Array.isArray(source[key])) {
          result[key] = [...source[key]];
        } else {
          result[key] = this.merge(result[key] || {}, source[key], true);
        }
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }

  /**
   * DTO 유효성 검증
   * @param {any} dto - 검증할 DTO
   * @param {any} schema - 검증 스키마
   * @returns {boolean} 유효성 여부
   */
  static validate(dto: any, schema: any): boolean {
    // 간단한 스키마 검증 (실제로는 더 복잡한 검증 라이브러리 사용)
    for (const key in schema) {
      const rule = schema[key];
      const value = dto[key];

      // 필수 필드 체크
      if (rule.required && (value === undefined || value === null)) {
        return false;
      }

      // 타입 체크
      if (value !== undefined && value !== null) {
        if (rule.type === 'string' && typeof value !== 'string') {
          return false;
        }
        if (rule.type === 'number' && typeof value !== 'number') {
          return false;
        }
        if (rule.type === 'boolean' && typeof value !== 'boolean') {
          return false;
        }
        if (rule.type === 'array' && !Array.isArray(value)) {
          return false;
        }
        if (rule.type === 'object' && typeof value !== 'object') {
          return false;
        }
      }

      // 범위 체크
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          return false;
        }
        if (rule.max !== undefined && value > rule.max) {
          return false;
        }
      }

      // 길이 체크
      if (typeof value === 'string' || Array.isArray(value)) {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          return false;
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * DTO를 JSON 문자열로 변환
   * @param {any} dto - 변환할 DTO
   * @param {boolean} pretty - 포맷팅 여부
   * @returns {string} JSON 문자열
   */
  static toJSON(dto: any, pretty: boolean = false): string {
    return pretty ? JSON.stringify(dto, null, 2) : JSON.stringify(dto);
  }

  /**
   * JSON 문자열을 DTO로 변환
   * @template T
   * @param {string} json - JSON 문자열
   * @returns {T} DTO 객체
   */
  static fromJSON<T>(json: string): T {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error}`);
    }
  }

  /**
   * DTO를 FormData로 변환
   * @param {any} dto - 변환할 DTO
   * @param {FormData} formData - FormData 객체
   * @param {string} prefix - 필드 prefix
   * @returns {FormData} FormData
   */
  static toFormData(dto: any, formData: FormData = new FormData(), prefix: string = ''): FormData {
    Object.keys(dto).forEach(key => {
      const value = dto[key];
      const fieldName = prefix ? `${prefix}[${key}]` : key;

      if (value === null || value === undefined) {
        return;
      }

      if (value instanceof File) {
        formData.append(fieldName, value);
      } else if (value instanceof Date) {
        formData.append(fieldName, value.toISOString());
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            this.toFormData(item, formData, `${fieldName}[${index}]`);
          } else {
            formData.append(`${fieldName}[${index}]`, String(item));
          }
        });
      } else if (typeof value === 'object') {
        this.toFormData(value, formData, fieldName);
      } else {
        formData.append(fieldName, String(value));
      }
    });

    return formData;
  }
}

// DTO 검증 스키마 예제
export const MarketingDataDTOSchema = {
  pensionName: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  monthYear: { type: 'string', required: true, pattern: /^\d{4}-(0[1-9]|1[0-2])$/ },
  revenue: { type: 'object', required: true },
  rooms: { type: 'array', required: true, maxLength: 50 },
  advertisements: { type: 'array', required: true, maxLength: 20 }
};