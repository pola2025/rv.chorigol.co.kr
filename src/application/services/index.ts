/**
 * @fileoverview Application Services 통합 Export
 * @description Application Layer의 모든 서비스를 중앙에서 관리
 */

// DataValidator Service
export {
  DataValidator,
  dataValidator,
  type ValidationRule,
  type ValidationContext,
  type ValidationResult
} from './DataValidator';

// BusinessRuleChecker Service
export {
  BusinessRuleChecker,
  businessRuleChecker,
  type BusinessRule,
  type BusinessRuleResult,
  type BusinessRuleCheckSummary,
  type BusinessRuleViolation
} from './BusinessRuleChecker';

// Service 조합 헬퍼
export class ServiceOrchestrator {
  /**
   * 데이터 검증 및 비즈니스 규칙 체크
   * @param {any} data - 검증할 데이터
   * @returns {object} 통합 검증 결과
   */
  static validateComplete(data: any): {
    dataValidation: any;
    businessRules: any;
    overallValid: boolean;
    overallScore: number;
  } {
    // 데이터 유효성 검증
    const dataValidation = dataValidator.validateMarketingData(data);
    
    // 비즈니스 규칙 검증
    const businessRules = businessRuleChecker.checkMarketingData(data);
    
    // 종합 결과
    const overallValid = dataValidation.isValid && businessRules.criticalFailures === 0;
    const overallScore = (businessRules.score + (dataValidation.isValid ? 100 : 50)) / 2;
    
    return {
      dataValidation,
      businessRules,
      overallValid,
      overallScore
    };
  }

  /**
   * 검증 결과 요약 생성
   * @param {object} result - 검증 결과
   * @returns {string} 요약 문자열
   */
  static generateSummary(result: any): string {
    const lines: string[] = [];
    
    lines.push('=== 데이터 검증 결과 ===');
    lines.push(`전체 유효성: ${result.overallValid ? '✅ 통과' : '❌ 실패'}`);
    lines.push(`종합 점수: ${result.overallScore.toFixed(1)}/100`);
    
    lines.push('\n--- 데이터 유효성 ---');
    lines.push(`- 오류: ${result.dataValidation.errors.length}개`);
    lines.push(`- 경고: ${result.dataValidation.warnings.length}개`);
    
    lines.push('\n--- 비즈니스 규칙 ---');
    lines.push(`- 통과: ${result.businessRules.passedRules}/${result.businessRules.totalRules}`);
    lines.push(`- 위반: ${result.businessRules.failedRules}개`);
    lines.push(`- 심각: ${result.businessRules.criticalFailures}개`);
    
    if (result.businessRules.recommendations.length > 0) {
      lines.push('\n--- 개선 제안 ---');
      result.businessRules.recommendations.forEach((rec: string) => {
        lines.push(`• ${rec}`);
      });
    }
    
    return lines.join('\n');
  }
}

// Service 메타데이터
export interface ServiceMetadata {
  name: string;
  description: string;
  version: string;
  dependencies: string[];
}

// Service 레지스트리
export class ServiceRegistry {
  private static services: Map<string, ServiceMetadata> = new Map([
    ['DataValidator', {
      name: 'DataValidator',
      description: '데이터 유효성 검증 서비스',
      version: '1.0.0',
      dependencies: []
    }],
    ['BusinessRuleChecker', {
      name: 'BusinessRuleChecker',
      description: '비즈니스 규칙 검증 서비스',
      version: '1.0.0',
      dependencies: ['DataValidator']
    }]
  ]);

  /**
   * 서비스 메타데이터 조회
   * @param {string} name - 서비스 이름
   * @returns {ServiceMetadata | undefined} 메타데이터
   */
  static getMetadata(name: string): ServiceMetadata | undefined {
    return this.services.get(name);
  }

  /**
   * 모든 서비스 메타데이터 조회
   * @returns {ServiceMetadata[]} 메타데이터 배열
   */
  static getAllMetadata(): ServiceMetadata[] {
    return Array.from(this.services.values());
  }
}