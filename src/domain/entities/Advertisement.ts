/**
 * @fileoverview Advertisement 도메인 엔티티
 * @description 광고/마케팅 채널 관련 비즈니스 로직을 캡슐화하는 엔티티
 */

/**
 * Advertisement 엔티티 인터페이스
 */
export interface IAdvertisement {
  channelName: string;
  channelType: ChannelType;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

/**
 * 광고 채널 타입 열거형
 */
export enum ChannelType {
  SEARCH = 'SEARCH',           // 검색 광고 (네이버, 구글 등)
  DISPLAY = 'DISPLAY',         // 디스플레이 광고
  SOCIAL = 'SOCIAL',           // 소셜 미디어 (인스타그램, 페이스북 등)
  VIDEO = 'VIDEO',             // 비디오 광고 (유튜브 등)
  AFFILIATE = 'AFFILIATE',     // 제휴 마케팅
  EMAIL = 'EMAIL',             // 이메일 마케팅
  DIRECT = 'DIRECT',           // 직접 마케팅
  ORGANIC = 'ORGANIC',         // 자연 유입
  OFFLINE = 'OFFLINE',         // 오프라인 광고
  OTHER = 'OTHER'              // 기타
}

/**
 * Advertisement 도메인 엔티티
 * @class
 * @description 광고/마케팅 채널 데이터의 핵심 비즈니스 로직을 캡슐화
 */
export class Advertisement {
  private _channelName: string;
  private _channelType: ChannelType;
  private _budget: number;
  private _spend: number;
  private _impressions: number;
  private _clicks: number;
  private _conversions: number;
  private _revenue: number;
  private _startDate: Date;
  private _endDate: Date;
  private _isActive: boolean;

  /**
   * Advertisement 생성자
   * @param {IAdvertisement} data - 초기화 데이터
   */
  constructor(data: IAdvertisement) {
    this.validate(data);
    
    this._channelName = data.channelName;
    this._channelType = data.channelType;
    this._budget = data.budget;
    this._spend = data.spend;
    this._impressions = data.impressions;
    this._clicks = data.clicks;
    this._conversions = data.conversions;
    this._revenue = data.revenue;
    this._startDate = new Date(data.startDate);
    this._endDate = new Date(data.endDate);
    this._isActive = data.isActive;
  }

  /**
   * 데이터 유효성 검증
   * @private
   * @param {IAdvertisement} data - 검증할 데이터
   * @throws {Error} 유효성 검증 실패 시
   */
  private validate(data: IAdvertisement): void {
    // 필수 필드 검증
    if (!data.channelName || data.channelName.trim() === '') {
      throw new Error('채널 이름은 필수 입력 항목입니다.');
    }

    if (!data.channelType) {
      throw new Error('채널 타입은 필수 입력 항목입니다.');
    }

    // 금액 검증
    if (data.budget < 0) {
      throw new Error('예산은 음수일 수 없습니다.');
    }

    if (data.spend < 0) {
      throw new Error('지출액은 음수일 수 없습니다.');
    }

    if (data.revenue < 0) {
      throw new Error('매출은 음수일 수 없습니다.');
    }

    // 지표 검증
    if (data.impressions < 0) {
      throw new Error('노출수는 음수일 수 없습니다.');
    }

    if (data.clicks < 0) {
      throw new Error('클릭수는 음수일 수 없습니다.');
    }

    if (data.conversions < 0) {
      throw new Error('전환수는 음수일 수 없습니다.');
    }

    // 날짜 검증
    if (!data.startDate) {
      throw new Error('시작 날짜는 필수 입력 항목입니다.');
    }

    if (!data.endDate) {
      throw new Error('종료 날짜는 필수 입력 항목입니다.');
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime())) {
      throw new Error('유효하지 않은 시작 날짜입니다.');
    }

    if (isNaN(endDate.getTime())) {
      throw new Error('유효하지 않은 종료 날짜입니다.');
    }

    if (endDate < startDate) {
      throw new Error('종료 날짜는 시작 날짜 이후여야 합니다.');
    }

    // 비즈니스 규칙 검증
    this.validateBusinessRules(data);
  }

  /**
   * 비즈니스 규칙 검증
   * @private
   * @param {IAdvertisement} data - 검증할 데이터
   */
  private validateBusinessRules(data: IAdvertisement): void {
    // 지출이 예산을 초과하는지 확인
    if (data.spend > data.budget && data.budget > 0) {
      console.warn(`지출액(${data.spend})이 예산(${data.budget})을 초과했습니다.`);
    }

    // 클릭수가 노출수를 초과할 수 없음
    if (data.clicks > data.impressions) {
      throw new Error('클릭수는 노출수를 초과할 수 없습니다.');
    }

    // 전환수가 클릭수를 초과할 수 없음
    if (data.conversions > data.clicks) {
      throw new Error('전환수는 클릭수를 초과할 수 없습니다.');
    }

    // CTR이 비정상적으로 높은 경우 경고
    const ctr = this.calculateCTR(data.clicks, data.impressions);
    if (ctr > 50) {
      console.warn(`CTR(${ctr}%)이 비정상적으로 높습니다. 데이터를 확인해주세요.`);
    }

    // CVR이 비정상적으로 높은 경우 경고
    const cvr = this.calculateCVR(data.conversions, data.clicks);
    if (cvr > 50) {
      console.warn(`CVR(${cvr}%)이 비정상적으로 높습니다. 데이터를 확인해주세요.`);
    }
  }

  /**
   * CTR (Click-Through Rate) 계산
   * @private
   * @param {number} clicks - 클릭수
   * @param {number} impressions - 노출수
   * @returns {number} CTR (%)
   */
  private calculateCTR(clicks: number, impressions: number): number {
    if (impressions === 0) return 0;
    return (clicks / impressions) * 100;
  }

  /**
   * CVR (Conversion Rate) 계산
   * @private
   * @param {number} conversions - 전환수
   * @param {number} clicks - 클릭수
   * @returns {number} CVR (%)
   */
  private calculateCVR(conversions: number, clicks: number): number {
    if (clicks === 0) return 0;
    return (conversions / clicks) * 100;
  }

  /**
   * 광고 정보 업데이트
   * @param {Partial<IAdvertisement>} updates - 업데이트할 필드
   * @returns {Advertisement} 새로운 Advertisement 인스턴스
   */
  update(updates: Partial<IAdvertisement>): Advertisement {
    const newData: IAdvertisement = {
      channelName: updates.channelName ?? this._channelName,
      channelType: updates.channelType ?? this._channelType,
      budget: updates.budget ?? this._budget,
      spend: updates.spend ?? this._spend,
      impressions: updates.impressions ?? this._impressions,
      clicks: updates.clicks ?? this._clicks,
      conversions: updates.conversions ?? this._conversions,
      revenue: updates.revenue ?? this._revenue,
      startDate: updates.startDate ?? this._startDate,
      endDate: updates.endDate ?? this._endDate,
      isActive: updates.isActive ?? this._isActive
    };

    return new Advertisement(newData);
  }

  /**
   * ROI (Return on Investment) 계산
   * @returns {number} ROI (%)
   */
  calculateROI(): number {
    if (this._spend === 0) return 0;
    return ((this._revenue - this._spend) / this._spend) * 100;
  }

  /**
   * ROAS (Return on Ad Spend) 계산
   * @returns {number} ROAS 배수
   */
  calculateROAS(): number {
    if (this._spend === 0) return 0;
    return this._revenue / this._spend;
  }

  /**
   * CPC (Cost Per Click) 계산
   * @returns {number} CPC
   */
  calculateCPC(): number {
    if (this._clicks === 0) return 0;
    return this._spend / this._clicks;
  }

  /**
   * CPM (Cost Per Mille - 1000 노출당 비용) 계산
   * @returns {number} CPM
   */
  calculateCPM(): number {
    if (this._impressions === 0) return 0;
    return (this._spend / this._impressions) * 1000;
  }

  /**
   * CPA (Cost Per Acquisition) 계산
   * @returns {number} CPA
   */
  calculateCPA(): number {
    if (this._conversions === 0) return 0;
    return this._spend / this._conversions;
  }

  /**
   * 예산 소진율 계산
   * @returns {number} 예산 소진율 (%)
   */
  getBudgetUtilization(): number {
    if (this._budget === 0) return 0;
    return (this._spend / this._budget) * 100;
  }

  /**
   * 캠페인 기간 계산
   * @returns {number} 캠페인 기간 (일)
   */
  getCampaignDuration(): number {
    const diffTime = Math.abs(this._endDate.getTime() - this._startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * 일평균 지출 계산
   * @returns {number} 일평균 지출액
   */
  getDailySpend(): number {
    const duration = this.getCampaignDuration();
    if (duration === 0) return 0;
    return this._spend / duration;
  }

  /**
   * 성과 등급 계산
   * @returns {string} 성과 등급 (S, A, B, C, D, F)
   */
  getPerformanceGrade(): string {
    const roi = this.calculateROI();
    
    if (roi >= 300) return 'S';
    if (roi >= 200) return 'A';
    if (roi >= 100) return 'B';
    if (roi >= 50) return 'C';
    if (roi >= 0) return 'D';
    return 'F';
  }

  /**
   * 데이터를 일반 객체로 변환
   * @returns {IAdvertisement} 일반 객체 형태의 데이터
   */
  toObject(): IAdvertisement {
    return {
      channelName: this._channelName,
      channelType: this._channelType,
      budget: this._budget,
      spend: this._spend,
      impressions: this._impressions,
      clicks: this._clicks,
      conversions: this._conversions,
      revenue: this._revenue,
      startDate: new Date(this._startDate),
      endDate: new Date(this._endDate),
      isActive: this._isActive
    };
  }

  /**
   * Firebase 저장용 평면화된 데이터 생성
   * @returns {Record<string, any>} 평면화된 데이터
   */
  toFirebaseFormat(): Record<string, any> {
    return {
      name: this._channelName,
      type: this._channelType,
      budget: this._budget,
      spend: this._spend,
      impressions: this._impressions,
      clicks: this._clicks,
      conversions: this._conversions,
      revenue: this._revenue,
      startDate: this._startDate.toISOString(),
      endDate: this._endDate.toISOString(),
      isActive: this._isActive,
      // 계산된 지표들도 저장 (빠른 조회를 위해)
      roi: this.calculateROI(),
      roas: this.calculateROAS(),
      ctr: this.calculateCTR(this._clicks, this._impressions),
      cvr: this.calculateCVR(this._conversions, this._clicks)
    };
  }

  /**
   * 문자열 표현
   * @returns {string} 광고 요약 정보
   */
  toString(): string {
    return `${this._channelName} (${this._channelType}): ROI ${this.calculateROI().toFixed(2)}%, ROAS ${this.calculateROAS().toFixed(2)}x`;
  }

  /**
   * 통화 포맷팅
   * @private
   * @param {number} amount - 금액
   * @returns {string} 포맷팅된 금액
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  }

  // Getters
  get channelName(): string {
    return this._channelName;
  }

  get channelType(): ChannelType {
    return this._channelType;
  }

  get budget(): number {
    return this._budget;
  }

  get spend(): number {
    return this._spend;
  }

  get impressions(): number {
    return this._impressions;
  }

  get clicks(): number {
    return this._clicks;
  }

  get conversions(): number {
    return this._conversions;
  }

  get revenue(): number {
    return this._revenue;
  }

  get startDate(): Date {
    return new Date(this._startDate);
  }

  get endDate(): Date {
    return new Date(this._endDate);
  }

  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * CTR 게터
   * @returns {number} CTR (%)
   */
  get ctr(): number {
    return this.calculateCTR(this._clicks, this._impressions);
  }

  /**
   * CVR 게터
   * @returns {number} CVR (%)
   */
  get cvr(): number {
    return this.calculateCVR(this._conversions, this._clicks);
  }

  /**
   * 불변성을 보장하는 복사본 생성
   * @returns {Advertisement} 복사된 Advertisement 인스턴스
   */
  clone(): Advertisement {
    return new Advertisement(this.toObject());
  }

  /**
   * 두 Advertisement 인스턴스가 같은지 비교
   * @param {Advertisement} other - 비교할 Advertisement 인스턴스
   * @returns {boolean} 동일 여부
   */
  equals(other: Advertisement): boolean {
    if (!other) return false;
    
    return (
      this._channelName === other._channelName &&
      this._channelType === other._channelType &&
      this._budget === other._budget &&
      this._spend === other._spend &&
      this._impressions === other._impressions &&
      this._clicks === other._clicks &&
      this._conversions === other._conversions &&
      this._revenue === other._revenue &&
      this._startDate.getTime() === other._startDate.getTime() &&
      this._endDate.getTime() === other._endDate.getTime() &&
      this._isActive === other._isActive
    );
  }

  /**
   * 캠페인 활성화
   * @returns {Advertisement} 활성화된 새 Advertisement 인스턴스
   */
  activate(): Advertisement {
    return this.update({ isActive: true });
  }

  /**
   * 캠페인 비활성화
   * @returns {Advertisement} 비활성화된 새 Advertisement 인스턴스
   */
  deactivate(): Advertisement {
    return this.update({ isActive: false });
  }

  /**
   * 캠페인이 현재 실행 중인지 확인
   * @returns {boolean} 실행 중 여부
   */
  isRunning(): boolean {
    const now = new Date();
    return this._isActive && now >= this._startDate && now <= this._endDate;
  }

  /**
   * 캠페인이 종료되었는지 확인
   * @returns {boolean} 종료 여부
   */
  isExpired(): boolean {
    const now = new Date();
    return now > this._endDate;
  }

  /**
   * 캠페인이 아직 시작되지 않았는지 확인
   * @returns {boolean} 대기 중 여부
   */
  isPending(): boolean {
    const now = new Date();
    return now < this._startDate;
  }
}

/**
 * Advertisement 팩토리 함수
 * @param {Partial<IAdvertisement>} data - 부분적인 초기화 데이터
 * @returns {Advertisement} 생성된 Advertisement 인스턴스
 */
export function createAdvertisement(data: Partial<IAdvertisement>): Advertisement {
  const now = new Date();
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const completeData: IAdvertisement = {
    channelName: data.channelName || '',
    channelType: data.channelType || ChannelType.OTHER,
    budget: data.budget || 0,
    spend: data.spend || 0,
    impressions: data.impressions || 0,
    clicks: data.clicks || 0,
    conversions: data.conversions || 0,
    revenue: data.revenue || 0,
    startDate: data.startDate || now,
    endDate: data.endDate || oneMonthLater,
    isActive: data.isActive ?? true
  };

  return new Advertisement(completeData);
}