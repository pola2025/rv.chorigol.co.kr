/**
 * @fileoverview DataValidator Service
 * @description 데이터 유효성 검증 서비스
 */

import { 
  ValidationError, 
  ValidationWarning,
  DataQualityIssue 
} from '../use-cases/ValidateMarketingDataUseCase';

/**
 * 검증 규칙 인터페이스
 */
export interface ValidationRule<T = any> {
  name: string;
  field: string;
  validate: (value: T, context?: any) => boolean;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

/**
 * 검증 컨텍스트
 */
export interface ValidationContext {
  entity: string;
  operation: 'create' | 'update' | 'delete';
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  passedRules: string[];
  failedRules: string[];
  context: ValidationContext;
}

/**
 * DataValidator 서비스
 * @class
 */
export class DataValidator {
  private rules: Map<string, ValidationRule[]> = new Map();
  private customValidators: Map<string, Function> = new Map();

  /**
   * 생성자
   */
  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * 기본 검증 규칙 초기화
   * @private
   */
  private initializeDefaultRules(): void {
    // 필수 필드 규칙
    this.addRule('required', {
      name: 'required',
      field: '*',
      validate: (value: any) => value !== null && value !== undefined && value !== '',
      message: '필수 입력 항목입니다.',
      severity: 'error',
      code: 'REQUIRED_FIELD'
    });

    // 문자열 길이 규칙
    this.addRule('string-length', {
      name: 'string-length',
      field: '*',
      validate: (value: string, context: { min?: number; max?: number }) => {
        if (typeof value !== 'string') return false;
        const length = value.length;
        if (context?.min && length < context.min) return false;
        if (context?.max && length > context.max) return false;
        return true;
      },
      message: '문자열 길이가 유효하지 않습니다.',
      severity: 'error',
      code: 'INVALID_STRING_LENGTH'
    });

    // 숫자 범위 규칙
    this.addRule('number-range', {
      name: 'number-range',
      field: '*',
      validate: (value: number, context: { min?: number; max?: number }) => {
        if (typeof value !== 'number' || isNaN(value)) return false;
        if (context?.min !== undefined && value < context.min) return false;
        if (context?.max !== undefined && value > context.max) return false;
        return true;
      },
      message: '숫자가 유효한 범위를 벗어났습니다.',
      severity: 'error',
      code: 'INVALID_NUMBER_RANGE'
    });

    // 날짜 형식 규칙
    this.addRule('date-format', {
      name: 'date-format',
      field: '*',
      validate: (value: any) => {
        if (!value) return false;
        const date = new Date(value);
        return !isNaN(date.getTime());
      },
      message: '유효한 날짜 형식이 아닙니다.',
      severity: 'error',
      code: 'INVALID_DATE_FORMAT'
    });

    // 이메일 형식 규칙
    this.addRule('email', {
      name: 'email',
      field: '*',
      validate: (value: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
      },
      message: '유효한 이메일 형식이 아닙니다.',
      severity: 'error',
      code: 'INVALID_EMAIL'
    });

    // 전화번호 형식 규칙
    this.addRule('phone', {
      name: 'phone',
      field: '*',
      validate: (value: string) => {
        const phoneRegex = /^(\d{2,3})-?(\d{3,4})-?(\d{4})$/;
        return phoneRegex.test(value.replace(/\s/g, ''));
      },
      message: '유효한 전화번호 형식이 아닙니다.',
      severity: 'error',
      code: 'INVALID_PHONE'
    });

    // URL 형식 규칙
    this.addRule('url', {
      name: 'url',
      field: '*',
      validate: (value: string) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      message: '유효한 URL 형식이 아닙니다.',
      severity: 'error',
      code: 'INVALID_URL'
    });

    // 배열 크기 규칙
    this.addRule('array-size', {
      name: 'array-size',
      field: '*',
      validate: (value: any[], context: { min?: number; max?: number }) => {
        if (!Array.isArray(value)) return false;
        const size = value.length;
        if (context?.min !== undefined && size < context.min) return false;
        if (context?.max !== undefined && size > context.max) return false;
        return true;
      },
      message: '배열 크기가 유효하지 않습니다.',
      severity: 'error',
      code: 'INVALID_ARRAY_SIZE'
    });
  }

  /**
   * 검증 규칙 추가
   * @param {string} type - 규칙 타입
   * @param {ValidationRule} rule - 검증 규칙
   */
  addRule(type: string, rule: ValidationRule): void {
    if (!this.rules.has(type)) {
      this.rules.set(type, []);
    }
    this.rules.get(type)!.push(rule);
  }

  /**
   * 커스텀 검증자 추가
   * @param {string} name - 검증자 이름
   * @param {Function} validator - 검증 함수
   */
  addCustomValidator(name: string, validator: Function): void {
    this.customValidators.set(name, validator);
  }

  /**
   * 단일 필드 검증
   * @param {any} value - 검증할 값
   * @param {string} field - 필드명
   * @param {string[]} ruleTypes - 적용할 규칙 타입들
   * @param {any} context - 검증 컨텍스트
   * @returns {ValidationResult} 검증 결과
   */
  validateField(
    value: any,
    field: string,
    ruleTypes: string[],
    context?: any
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const passedRules: string[] = [];
    const failedRules: string[] = [];

    for (const ruleType of ruleTypes) {
      const rules = this.rules.get(ruleType) || [];
      
      for (const rule of rules) {
        if (rule.field !== '*' && rule.field !== field) continue;

        const isValid = rule.validate(value, context);
        
        if (isValid) {
          passedRules.push(rule.name);
        } else {
          failedRules.push(rule.name);
          
          const item = {
            field,
            message: rule.message,
            code: rule.code,
            severity: rule.severity
          };

          if (rule.severity === 'error') {
            errors.push(item as ValidationError);
          } else {
            warnings.push(item as ValidationWarning);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      passedRules,
      failedRules,
      context: {
        entity: field,
        operation: 'create',
        timestamp: new Date()
      }
    };
  }

  /**
   * 객체 검증
   * @param {any} object - 검증할 객체
   * @param {Record<string, string[]>} fieldRules - 필드별 규칙
   * @param {ValidationContext} context - 검증 컨텍스트
   * @returns {ValidationResult} 검증 결과
   */
  validateObject(
    object: any,
    fieldRules: Record<string, string[]>,
    context: ValidationContext
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const passedRules: string[] = [];
    const failedRules: string[] = [];

    for (const [field, ruleTypes] of Object.entries(fieldRules)) {
      const value = this.getNestedValue(object, field);
      const result = this.validateField(value, field, ruleTypes, context.metadata);

      errors.push(...result.errors);
      warnings.push(...result.warnings);
      passedRules.push(...result.passedRules);
      failedRules.push(...result.failedRules);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      passedRules,
      failedRules,
      context
    };
  }

  /**
   * 마케팅 데이터 전용 검증
   * @param {any} data - 마케팅 데이터
   * @returns {ValidationResult} 검증 결과
   */
  validateMarketingData(data: any): ValidationResult {
    const fieldRules: Record<string, string[]> = {
      'pensionName': ['required', 'string-length'],
      'monthYear': ['required', 'date-format'],
      'revenue.totalRevenue': ['required', 'number-range'],
      'revenue.roomRevenue': ['required', 'number-range'],
      'revenue.additionalRevenue': ['required', 'number-range'],
      'rooms': ['array-size'],
      'advertisements': ['array-size']
    };

    const context: ValidationContext = {
      entity: 'MarketingData',
      operation: data.id ? 'update' : 'create',
      timestamp: new Date(),
      metadata: {
        stringLength: { min: 1, max: 100 },
        numberRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
        arraySize: { min: 0, max: 50 }
      }
    };

    const result = this.validateObject(data, fieldRules, context);

    // 추가 비즈니스 규칙 검증
    this.validateMarketingBusinessRules(data, result);

    return result;
  }

  /**
   * 마케팅 비즈니스 규칙 검증
   * @private
   * @param {any} data - 마케팅 데이터
   * @param {ValidationResult} result - 검증 결과
   */
  private validateMarketingBusinessRules(data: any, result: ValidationResult): void {
    // 매출 일관성 검증
    if (data.revenue) {
      const totalCalc = (data.revenue.roomRevenue || 0) + (data.revenue.additionalRevenue || 0);
      if (Math.abs((data.revenue.totalRevenue || 0) - totalCalc) > 0.01) {
        result.warnings.push({
          field: 'revenue',
          message: '총 매출이 객실 매출 + 부가 매출과 일치하지 않습니다.',
          code: 'REVENUE_INCONSISTENCY',
          severity: 'warning'
        });
      }
    }

    // 객실 데이터 검증
    if (Array.isArray(data.rooms)) {
      data.rooms.forEach((room: any, index: number) => {
        if (room.occupancyRate > 100) {
          result.errors.push({
            field: `rooms[${index}].occupancyRate`,
            message: '점유율은 100%를 초과할 수 없습니다.',
            code: 'INVALID_OCCUPANCY_RATE',
            severity: 'error'
          });
        }

        if (room.capacity?.maximum < room.capacity?.standard) {
          result.errors.push({
            field: `rooms[${index}].capacity`,
            message: '최대 인원은 기준 인원보다 적을 수 없습니다.',
            code: 'INVALID_CAPACITY',
            severity: 'error'
          });
        }
      });
    }

    // 광고 데이터 검증
    if (Array.isArray(data.advertisements)) {
      data.advertisements.forEach((ad: any, index: number) => {
        if (ad.clicks > ad.impressions) {
          result.errors.push({
            field: `advertisements[${index}]`,
            message: '클릭수는 노출수를 초과할 수 없습니다.',
            code: 'INVALID_AD_METRICS',
            severity: 'error'
          });
        }

        if (ad.conversions > ad.clicks) {
          result.errors.push({
            field: `advertisements[${index}]`,
            message: '전환수는 클릭수를 초과할 수 없습니다.',
            code: 'INVALID_AD_METRICS',
            severity: 'error'
          });
        }
      });
    }
  }

  /**
   * 중첩된 객체 값 가져오기
   * @private
   * @param {any} obj - 객체
   * @param {string} path - 경로 (예: 'revenue.totalRevenue')
   * @returns {any} 값
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (key.includes('[') && key.includes(']')) {
        const arrayKey = key.substring(0, key.indexOf('['));
        const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
        return current?.[arrayKey]?.[index];
      }
      return current?.[key];
    }, obj);
  }

  /**
   * 검증 결과 요약
   * @param {ValidationResult} result - 검증 결과
   * @returns {string} 요약 문자열
   */
  summarizeResult(result: ValidationResult): string {
    const lines: string[] = [];
    
    lines.push(`검증 결과: ${result.isValid ? '✅ 유효' : '❌ 무효'}`);
    lines.push(`- 오류: ${result.errors.length}개`);
    lines.push(`- 경고: ${result.warnings.length}개`);
    lines.push(`- 통과: ${result.passedRules.length}개 규칙`);
    lines.push(`- 실패: ${result.failedRules.length}개 규칙`);

    if (result.errors.length > 0) {
      lines.push('\n오류 목록:');
      result.errors.forEach(error => {
        lines.push(`  - [${error.field}] ${error.message}`);
      });
    }

    if (result.warnings.length > 0) {
      lines.push('\n경고 목록:');
      result.warnings.forEach(warning => {
        lines.push(`  - [${warning.field}] ${warning.message}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 검증 규칙 목록 조회
   * @returns {string[]} 규칙 타입 목록
   */
  getRuleTypes(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * 특정 타입의 규칙 조회
   * @param {string} type - 규칙 타입
   * @returns {ValidationRule[]} 규칙 배열
   */
  getRules(type: string): ValidationRule[] {
    return this.rules.get(type) || [];
  }

  /**
   * 모든 규칙 초기화
   */
  clearRules(): void {
    this.rules.clear();
    this.initializeDefaultRules();
  }

  /**
   * 커스텀 검증자 실행
   * @param {string} name - 검증자 이름
   * @param {any} data - 검증할 데이터
   * @returns {boolean} 검증 결과
   */
  runCustomValidator(name: string, data: any): boolean {
    const validator = this.customValidators.get(name);
    if (!validator) {
      throw new Error(`Custom validator '${name}' not found`);
    }
    return validator(data);
  }
}

// 싱글톤 인스턴스
export const dataValidator = new DataValidator();