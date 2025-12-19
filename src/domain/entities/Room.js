/**
 * Room Entity
 * 객실 도메인 엔티티
 */

export class Room {
  constructor({
    id,
    name,
    basePrice,
    maxGuests,
    defaultGuests,
    inventory,
    description,
    order,
    isActive = true
  }) {
    this.id = id;
    this.name = name;
    this.basePrice = basePrice;
    this.maxGuests = maxGuests;
    this.defaultGuests = defaultGuests;
    this.inventory = inventory;
    this.description = description;
    this.order = order;
    this.isActive = isActive;
  }

  // 비즈니스 로직
  canAccommodate(guests) {
    return guests <= this.maxGuests;
  }

  getWeekendPrice() {
    return Math.round(this.basePrice * 1.2); // 주말 20% 할증
  }

  getPeakSeasonPrice() {
    return Math.round(this.basePrice * 1.5); // 성수기 50% 할증
  }

  // 불변성 유지를 위한 업데이트
  updatePrice(newPrice) {
    return new Room({
      ...this,
      basePrice: newPrice
    });
  }

  updateInventory(newInventory) {
    return new Room({
      ...this,
      inventory: newInventory
    });
  }
}

// Value Object
export class RoomInventory {
  constructor(total) {
    if (total < 0) {
      throw new Error('재고는 음수가 될 수 없습니다.');
    }
    this.total = total;
  }

  isAvailable(requested = 1) {
    return this.total >= requested;
  }

  reduce(amount = 1) {
    return new RoomInventory(this.total - amount);
  }

  increase(amount = 1) {
    return new RoomInventory(this.total + amount);
  }
}
