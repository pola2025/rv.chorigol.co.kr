/**
 * @fileoverview Use Cases 통합 Export
 * @description Application Layer의 모든 Use Cases를 중앙에서 관리
 */

// Base UseCase
export {
  UseCase,
  SyncUseCase,
  BaseUseCase,
  UseCaseResult,
  UseCaseError,
  UseCaseErrorCode,
  UseCaseExecutor
} from './UseCase';

// Marketing Use Cases
export {
  SaveMarketingDataUseCase,
  type SaveMarketingDataInput,
  type SaveMarketingDataOutput
} from './SaveMarketingDataUseCase';

export {
  LoadMarketingDataUseCase,
  type LoadMarketingDataInput,
  type LoadMarketingDataOutput,
  type MarketingDataDTO,
  type MarketingSummaryDTO
} from './LoadMarketingDataUseCase';

export {
  ValidateMarketingDataUseCase,
  type ValidateMarketingDataInput,
  type ValidateMarketingDataOutput,
  type ValidationError,
  type ValidationWarning,
  type DataQualityIssue
} from './ValidateMarketingDataUseCase';

// Use Case Factory
export class UseCaseFactory {
  /**
   * SaveMarketingDataUseCase 생성
   * @param {any} repository - MarketingRepository
   * @returns {SaveMarketingDataUseCase} UseCase 인스턴스
   */
  static createSaveMarketingDataUseCase(repository: any): SaveMarketingDataUseCase {
    return new SaveMarketingDataUseCase(repository);
  }

  /**
   * LoadMarketingDataUseCase 생성
   * @param {any} repository - MarketingRepository
   * @returns {LoadMarketingDataUseCase} UseCase 인스턴스
   */
  static createLoadMarketingDataUseCase(repository: any): LoadMarketingDataUseCase {
    return new LoadMarketingDataUseCase(repository);
  }

  /**
   * ValidateMarketingDataUseCase 생성
   * @param {any} repository - MarketingRepository
   * @returns {ValidateMarketingDataUseCase} UseCase 인스턴스
   */
  static createValidateMarketingDataUseCase(repository: any): ValidateMarketingDataUseCase {
    return new ValidateMarketingDataUseCase(repository);
  }
}

// Use Case 조합 헬퍼
export class UseCaseOrchestrator {
  /**
   * 저장 전 검증 실행
   * @param {ValidateMarketingDataUseCase} validateUseCase - 검증 UseCase
   * @param {SaveMarketingDataUseCase} saveUseCase - 저장 UseCase
   * @param {any} data - 저장할 데이터
   * @returns {Promise<any>} 실행 결과
   */
  static async validateAndSave(
    validateUseCase: ValidateMarketingDataUseCase,
    saveUseCase: SaveMarketingDataUseCase,
    data: any
  ): Promise<any> {
    // 검증 실행
    const validationResult = await validateUseCase.execute(data);
    
    if (!validationResult.success || !validationResult.data?.isValid) {
      return {
        success: false,
        error: new UseCaseError(
          '데이터 검증 실패',
          UseCaseErrorCode.VALIDATION_ERROR,
          validationResult.data
        )
      };
    }

    // 저장 실행
    return saveUseCase.execute(data);
  }

  /**
   * 데이터 로드 후 검증
   * @param {LoadMarketingDataUseCase} loadUseCase - 로드 UseCase
   * @param {ValidateMarketingDataUseCase} validateUseCase - 검증 UseCase
   * @param {string} id - 데이터 ID
   * @returns {Promise<any>} 실행 결과
   */
  static async loadAndValidate(
    loadUseCase: LoadMarketingDataUseCase,
    validateUseCase: ValidateMarketingDataUseCase,
    id: string
  ): Promise<any> {
    // 데이터 로드
    const loadResult = await loadUseCase.execute({
      mode: 'single',
      id
    });

    if (!loadResult.success || !loadResult.data?.data) {
      return loadResult;
    }

    // 검증 실행
    const data = loadResult.data.data;
    const validationResult = await validateUseCase.execute({
      pensionName: data.pensionName,
      monthYear: data.monthYear,
      revenue: data.revenue,
      rooms: data.rooms,
      advertisements: data.advertisements,
      excludeId: data.id
    });

    return {
      success: true,
      data: {
        ...data,
        validation: validationResult.data
      }
    };
  }
}

// Use Case 메타데이터
export interface UseCaseMetadata {
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  dependencies: string[];
}

// Use Case 레지스트리
export class UseCaseRegistry {
  private static useCases: Map<string, UseCaseMetadata> = new Map([
    ['SaveMarketingDataUseCase', {
      name: 'SaveMarketingDataUseCase',
      description: '마케팅 데이터 저장',
      inputType: 'SaveMarketingDataInput',
      outputType: 'SaveMarketingDataOutput',
      dependencies: ['MarketingRepository']
    }],
    ['LoadMarketingDataUseCase', {
      name: 'LoadMarketingDataUseCase',
      description: '마케팅 데이터 조회',
      inputType: 'LoadMarketingDataInput',
      outputType: 'LoadMarketingDataOutput',
      dependencies: ['MarketingRepository']
    }],
    ['ValidateMarketingDataUseCase', {
      name: 'ValidateMarketingDataUseCase',
      description: '마케팅 데이터 검증',
      inputType: 'ValidateMarketingDataInput',
      outputType: 'ValidateMarketingDataOutput',
      dependencies: ['MarketingRepository']
    }]
  ]);

  /**
   * UseCase 메타데이터 조회
   * @param {string} name - UseCase 이름
   * @returns {UseCaseMetadata | undefined} 메타데이터
   */
  static getMetadata(name: string): UseCaseMetadata | undefined {
    return this.useCases.get(name);
  }

  /**
   * 모든 UseCase 메타데이터 조회
   * @returns {UseCaseMetadata[]} 메타데이터 배열
   */
  static getAllMetadata(): UseCaseMetadata[] {
    return Array.from(this.useCases.values());
  }
}