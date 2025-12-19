/**
 * @fileoverview Domain Entities 통합 Export
 * @description 도메인 레이어의 모든 엔티티를 중앙에서 관리
 */

// Entity exports
export { 
  MarketingData, 
  createMarketingData,
  type IMarketingData,
  type MarketingMetadata 
} from './MarketingData';

export { 
  Revenue, 
  createRevenue,
  type IRevenue 
} from './Revenue';

export { 
  Room, 
  createRoom,
  RoomType,
  type IRoom,
  type RoomCapacity 
} from './Room';

export { 
  Advertisement, 
  createAdvertisement,
  ChannelType,
  type IAdvertisement 
} from './Advertisement';

// Entity 컬렉션 타입
export type MarketingEntities = {
  marketingData: MarketingData;
  revenue: Revenue;
  rooms: Room[];
  advertisements: Advertisement[];
};

// 도메인 이벤트 타입 (향후 이벤트 소싱 적용 시 사용)
export enum DomainEventType {
  MARKETING_DATA_CREATED = 'MARKETING_DATA_CREATED',
  MARKETING_DATA_UPDATED = 'MARKETING_DATA_UPDATED',
  MARKETING_DATA_DELETED = 'MARKETING_DATA_DELETED',
  REVENUE_UPDATED = 'REVENUE_UPDATED',
  ROOM_ADDED = 'ROOM_ADDED',
  ROOM_UPDATED = 'ROOM_UPDATED',
  ROOM_REMOVED = 'ROOM_REMOVED',
  ADVERTISEMENT_ADDED = 'ADVERTISEMENT_ADDED',
  ADVERTISEMENT_UPDATED = 'ADVERTISEMENT_UPDATED',
  ADVERTISEMENT_REMOVED = 'ADVERTISEMENT_REMOVED'
}

// 도메인 이벤트 인터페이스
export interface DomainEvent {
  type: DomainEventType;
  aggregateId: string;
  payload: any;
  occurredAt: Date;
  version: number;
}