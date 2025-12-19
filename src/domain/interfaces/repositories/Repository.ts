/**
 * @fileoverview Repository 기본 인터페이스
 * @description 모든 Repository가 구현해야 하는 기본 인터페이스
 */

/**
 * Repository 쿼리 옵션
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

/**
 * Repository 필터 옵션
 */
export interface FilterOptions {
  field: string;
  operator: FilterOperator;
  value: any;
}

/**
 * 필터 연산자
 */
export enum FilterOperator {
  EQUALS = '==',
  NOT_EQUALS = '!=',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUALS = '>=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUALS = '<=',
  IN = 'in',
  NOT_IN = 'not-in',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts-with',
  ENDS_WITH = 'ends-with'
}

/**
 * Repository 결과
 */
export interface RepositoryResult<T> {
  data: T;
  metadata?: {
    createdAt?: Date;
    updatedAt?: Date;
    version?: number;
  };
}

/**
 * 페이지네이션 결과
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Repository 에러
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * Repository 에러 코드
 */
export enum RepositoryErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 기본 Repository 인터페이스
 * @interface
 * @template T - 엔티티 타입
 * @template ID - ID 타입
 */
export interface Repository<T, ID = string> {
  /**
   * ID로 엔티티 조회
   * @param {ID} id - 엔티티 ID
   * @returns {Promise<T | null>} 엔티티 또는 null
   */
  findById(id: ID): Promise<T | null>;

  /**
   * 여러 ID로 엔티티 조회
   * @param {ID[]} ids - 엔티티 ID 배열
   * @returns {Promise<T[]>} 엔티티 배열
   */
  findByIds(ids: ID[]): Promise<T[]>;

  /**
   * 모든 엔티티 조회
   * @param {QueryOptions} options - 쿼리 옵션
   * @returns {Promise<T[]>} 엔티티 배열
   */
  findAll(options?: QueryOptions): Promise<T[]>;

  /**
   * 조건에 맞는 엔티티 조회
   * @param {FilterOptions[]} filters - 필터 조건
   * @param {QueryOptions} options - 쿼리 옵션
   * @returns {Promise<T[]>} 엔티티 배열
   */
  findByFilters(filters: FilterOptions[], options?: QueryOptions): Promise<T[]>;

  /**
   * 조건에 맞는 첫 번째 엔티티 조회
   * @param {FilterOptions[]} filters - 필터 조건
   * @returns {Promise<T | null>} 엔티티 또는 null
   */
  findOne(filters: FilterOptions[]): Promise<T | null>;

  /**
   * 엔티티 존재 여부 확인
   * @param {ID} id - 엔티티 ID
   * @returns {Promise<boolean>} 존재 여부
   */
  exists(id: ID): Promise<boolean>;

  /**
   * 엔티티 개수 조회
   * @param {FilterOptions[]} filters - 필터 조건
   * @returns {Promise<number>} 엔티티 개수
   */
  count(filters?: FilterOptions[]): Promise<number>;

  /**
   * 엔티티 저장 (생성 또는 수정)
   * @param {T} entity - 저장할 엔티티
   * @returns {Promise<T>} 저장된 엔티티
   */
  save(entity: T): Promise<T>;

  /**
   * 여러 엔티티 저장
   * @param {T[]} entities - 저장할 엔티티 배열
   * @returns {Promise<T[]>} 저장된 엔티티 배열
   */
  saveAll(entities: T[]): Promise<T[]>;

  /**
   * 엔티티 수정
   * @param {ID} id - 엔티티 ID
   * @param {Partial<T>} updates - 수정할 필드
   * @returns {Promise<T>} 수정된 엔티티
   */
  update(id: ID, updates: Partial<T>): Promise<T>;

  /**
   * 엔티티 삭제
   * @param {ID} id - 엔티티 ID
   * @returns {Promise<void>}
   */
  delete(id: ID): Promise<void>;

  /**
   * 여러 엔티티 삭제
   * @param {ID[]} ids - 엔티티 ID 배열
   * @returns {Promise<void>}
   */
  deleteAll(ids: ID[]): Promise<void>;

  /**
   * 조건에 맞는 엔티티 삭제
   * @param {FilterOptions[]} filters - 필터 조건
   * @returns {Promise<number>} 삭제된 엔티티 개수
   */
  deleteByFilters(filters: FilterOptions[]): Promise<number>;
}

/**
 * 페이지네이션을 지원하는 Repository 인터페이스
 * @interface
 * @template T - 엔티티 타입
 * @template ID - ID 타입
 */
export interface PaginatedRepository<T, ID = string> extends Repository<T, ID> {
  /**
   * 페이지네이션된 결과 조회
   * @param {number} page - 페이지 번호 (1부터 시작)
   * @param {number} pageSize - 페이지 크기
   * @param {FilterOptions[]} filters - 필터 조건
   * @param {QueryOptions} options - 쿼리 옵션
   * @returns {Promise<PaginatedResult<T>>} 페이지네이션된 결과
   */
  findPaginated(
    page: number,
    pageSize: number,
    filters?: FilterOptions[],
    options?: QueryOptions
  ): Promise<PaginatedResult<T>>;
}

/**
 * 트랜잭션을 지원하는 Repository 인터페이스
 * @interface
 * @template T - 엔티티 타입
 * @template ID - ID 타입
 */
export interface TransactionalRepository<T, ID = string> extends Repository<T, ID> {
  /**
   * 트랜잭션 시작
   * @returns {Promise<any>} 트랜잭션 객체
   */
  beginTransaction(): Promise<any>;

  /**
   * 트랜잭션 커밋
   * @param {any} transaction - 트랜잭션 객체
   * @returns {Promise<void>}
   */
  commit(transaction: any): Promise<void>;

  /**
   * 트랜잭션 롤백
   * @param {any} transaction - 트랜잭션 객체
   * @returns {Promise<void>}
   */
  rollback(transaction: any): Promise<void>;

  /**
   * 트랜잭션 내에서 실행
   * @param {Function} callback - 트랜잭션 내에서 실행할 함수
   * @returns {Promise<R>} 실행 결과
   */
  withTransaction<R>(callback: (transaction: any) => Promise<R>): Promise<R>;
}

/**
 * 캐싱을 지원하는 Repository 인터페이스
 * @interface
 * @template T - 엔티티 타입
 * @template ID - ID 타입
 */
export interface CachedRepository<T, ID = string> extends Repository<T, ID> {
  /**
   * 캐시 무효화
   * @param {ID} id - 엔티티 ID
   * @returns {Promise<void>}
   */
  invalidateCache(id?: ID): Promise<void>;

  /**
   * 캐시 비우기
   * @returns {Promise<void>}
   */
  clearCache(): Promise<void>;

  /**
   * 캐시 미리 로드
   * @param {ID[]} ids - 엔티티 ID 배열
   * @returns {Promise<void>}
   */
  preloadCache(ids: ID[]): Promise<void>;
}

/**
 * Repository 팩토리 인터페이스
 * @interface
 */
export interface RepositoryFactory {
  /**
   * Repository 인스턴스 생성
   * @template T - 엔티티 타입
   * @template ID - ID 타입
   * @param {string} entityName - 엔티티 이름
   * @returns {Repository<T, ID>} Repository 인스턴스
   */
  create<T, ID = string>(entityName: string): Repository<T, ID>;
}