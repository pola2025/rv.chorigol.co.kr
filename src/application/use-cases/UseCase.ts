/**
 * @fileoverview UseCase 기본 인터페이스 및 추상 클래스
 * @description 모든 Use Case가 구현해야 하는 기본 구조
 */

/**
 * UseCase 실행 결과
 */
export interface UseCaseResult<T> {
  success: boolean;
  data?: T;
  error?: UseCaseError;
  metadata?: {
    executionTime: number;
    timestamp: Date;
    version?: string;
  };
}

/**
 * UseCase 에러
 */
export class UseCaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'UseCaseError';
  }
}

/**
 * UseCase 에러 코드
 */
export enum UseCaseErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * UseCase 기본 인터페이스
 * @interface
 * @template TInput - 입력 타입
 * @template TOutput - 출력 타입
 */
export interface UseCase<TInput, TOutput> {
  /**
   * UseCase 실행
   * @param {TInput} input - 입력 데이터
   * @returns {Promise<UseCaseResult<TOutput>>} 실행 결과
   */
  execute(input: TInput): Promise<UseCaseResult<TOutput>>;
}

/**
 * 동기 UseCase 인터페이스
 * @interface
 * @template TInput - 입력 타입
 * @template TOutput - 출력 타입
 */
export interface SyncUseCase<TInput, TOutput> {
  /**
   * UseCase 동기 실행
   * @param {TInput} input - 입력 데이터
   * @returns {UseCaseResult<TOutput>} 실행 결과
   */
  execute(input: TInput): UseCaseResult<TOutput>;
}

/**
 * UseCase 추상 클래스
 * @abstract
 * @class
 * @template TInput - 입력 타입
 * @template TOutput - 출력 타입
 */
export abstract class BaseUseCase<TInput, TOutput> implements UseCase<TInput, TOutput> {
  /**
   * UseCase 이름
   */
  protected abstract readonly name: string;

  /**
   * UseCase 실행
   * @param {TInput} input - 입력 데이터
   * @returns {Promise<UseCaseResult<TOutput>>} 실행 결과
   */
  async execute(input: TInput): Promise<UseCaseResult<TOutput>> {
    const startTime = Date.now();
    
    try {
      // 입력 검증
      await this.validate(input);
      
      // 권한 체크
      await this.authorize(input);
      
      // 비즈니스 로직 실행
      const result = await this.executeImpl(input);
      
      // 실행 후 처리
      await this.afterExecute(input, result);
      
      // 성공 결과 반환
      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };
    } catch (error) {
      // 에러 처리
      const useCaseError = this.handleError(error);
      
      // 실패 결과 반환
      return {
        success: false,
        error: useCaseError,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * 입력 검증
   * @protected
   * @param {TInput} input - 검증할 입력
   * @throws {UseCaseError} 검증 실패 시
   */
  protected abstract validate(input: TInput): Promise<void>;

  /**
   * 권한 체크
   * @protected
   * @param {TInput} input - 입력 데이터
   * @throws {UseCaseError} 권한 없음
   */
  protected async authorize(input: TInput): Promise<void> {
    // 기본적으로 모든 요청 허용 (하위 클래스에서 오버라이드)
  }

  /**
   * 비즈니스 로직 실행
   * @protected
   * @abstract
   * @param {TInput} input - 입력 데이터
   * @returns {Promise<TOutput>} 실행 결과
   */
  protected abstract executeImpl(input: TInput): Promise<TOutput>;

  /**
   * 실행 후 처리
   * @protected
   * @param {TInput} input - 입력 데이터
   * @param {TOutput} output - 출력 데이터
   */
  protected async afterExecute(input: TInput, output: TOutput): Promise<void> {
    // 기본적으로 아무 작업 없음 (하위 클래스에서 오버라이드)
  }

  /**
   * 에러 처리
   * @protected
   * @param {any} error - 처리할 에러
   * @returns {UseCaseError} UseCase 에러
   */
  protected handleError(error: any): UseCaseError {
    if (error instanceof UseCaseError) {
      return error;
    }

    console.error(`[${this.name}] Unexpected error:`, error);

    return new UseCaseError(
      '처리 중 오류가 발생했습니다.',
      UseCaseErrorCode.UNKNOWN_ERROR,
      { originalError: error.message },
      error
    );
  }

  /**
   * 검증 에러 생성
   * @protected
   * @param {string} message - 에러 메시지
   * @param {any} details - 에러 상세
   * @returns {UseCaseError} 검증 에러
   */
  protected createValidationError(message: string, details?: any): UseCaseError {
    return new UseCaseError(
      message,
      UseCaseErrorCode.VALIDATION_ERROR,
      details
    );
  }

  /**
   * 비즈니스 규칙 위반 에러 생성
   * @protected
   * @param {string} message - 에러 메시지
   * @param {any} details - 에러 상세
   * @returns {UseCaseError} 비즈니스 규칙 에러
   */
  protected createBusinessError(message: string, details?: any): UseCaseError {
    return new UseCaseError(
      message,
      UseCaseErrorCode.BUSINESS_RULE_VIOLATION,
      details
    );
  }

  /**
   * Not Found 에러 생성
   * @protected
   * @param {string} resource - 리소스 이름
   * @param {any} id - 리소스 ID
   * @returns {UseCaseError} Not Found 에러
   */
  protected createNotFoundError(resource: string, id: any): UseCaseError {
    return new UseCaseError(
      `${resource}을(를) 찾을 수 없습니다.`,
      UseCaseErrorCode.RESOURCE_NOT_FOUND,
      { resource, id }
    );
  }

  /**
   * Already Exists 에러 생성
   * @protected
   * @param {string} resource - 리소스 이름
   * @param {any} details - 상세 정보
   * @returns {UseCaseError} Already Exists 에러
   */
  protected createAlreadyExistsError(resource: string, details?: any): UseCaseError {
    return new UseCaseError(
      `${resource}이(가) 이미 존재합니다.`,
      UseCaseErrorCode.RESOURCE_ALREADY_EXISTS,
      details
    );
  }
}

/**
 * UseCase 실행자
 * @class
 */
export class UseCaseExecutor {
  /**
   * UseCase 실행 with 재시도
   * @static
   * @param {UseCase<TInput, TOutput>} useCase - 실행할 UseCase
   * @param {TInput} input - 입력 데이터
   * @param {number} maxRetries - 최대 재시도 횟수
   * @param {number} retryDelay - 재시도 지연 시간 (ms)
   * @returns {Promise<UseCaseResult<TOutput>>} 실행 결과
   */
  static async executeWithRetry<TInput, TOutput>(
    useCase: UseCase<TInput, TOutput>,
    input: TInput,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<UseCaseResult<TOutput>> {
    let lastError: UseCaseError | undefined;

    for (let i = 0; i <= maxRetries; i++) {
      const result = await useCase.execute(input);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // 재시도 가능한 에러인지 확인
      if (!this.isRetryableError(lastError)) {
        return result;
      }

      // 마지막 시도가 아니면 대기
      if (i < maxRetries) {
        await this.delay(retryDelay * Math.pow(2, i)); // Exponential backoff
      }
    }

    return {
      success: false,
      error: lastError
    };
  }

  /**
   * 여러 UseCase 병렬 실행
   * @static
   * @param {Array<{useCase: UseCase<any, any>, input: any}>} tasks - 실행할 작업들
   * @returns {Promise<UseCaseResult<any>[]>} 실행 결과 배열
   */
  static async executeParallel(
    tasks: Array<{useCase: UseCase<any, any>, input: any}>
  ): Promise<UseCaseResult<any>[]> {
    return Promise.all(
      tasks.map(task => task.useCase.execute(task.input))
    );
  }

  /**
   * 여러 UseCase 순차 실행
   * @static
   * @param {Array<{useCase: UseCase<any, any>, input: any}>} tasks - 실행할 작업들
   * @returns {Promise<UseCaseResult<any>[]>} 실행 결과 배열
   */
  static async executeSequential(
    tasks: Array<{useCase: UseCase<any, any>, input: any}>
  ): Promise<UseCaseResult<any>[]> {
    const results: UseCaseResult<any>[] = [];

    for (const task of tasks) {
      const result = await task.useCase.execute(task.input);
      results.push(result);

      // 실패 시 중단
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * 재시도 가능한 에러인지 확인
   * @private
   * @static
   * @param {UseCaseError | undefined} error - 확인할 에러
   * @returns {boolean} 재시도 가능 여부
   */
  private static isRetryableError(error: UseCaseError | undefined): boolean {
    if (!error) return false;

    const retryableCodes = [
      UseCaseErrorCode.EXTERNAL_SERVICE_ERROR,
      UseCaseErrorCode.TIMEOUT_ERROR,
      UseCaseErrorCode.DEPENDENCY_ERROR
    ];

    return retryableCodes.includes(error.code as UseCaseErrorCode);
  }

  /**
   * 지연 함수
   * @private
   * @static
   * @param {number} ms - 지연 시간 (밀리초)
   * @returns {Promise<void>}
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}