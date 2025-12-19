/**
 * Reservation Repository Interface
 * 도메인 레이어의 Repository 인터페이스
 * 실제 구현은 Infrastructure 레이어에서 수행
 */

export class IReservationRepository {
  async findById(id) {
    throw new Error('Method not implemented');
  }

  async findAll() {
    throw new Error('Method not implemented');
  }

  async findByDateRange(startDate, endDate) {
    throw new Error('Method not implemented');
  }

  async findByRoom(roomName) {
    throw new Error('Method not implemented');
  }

  async findByCustomer(phone) {
    throw new Error('Method not implemented');
  }

  async save(reservation) {
    throw new Error('Method not implemented');
  }

  async update(id, reservation) {
    throw new Error('Method not implemented');
  }

  async delete(id) {
    throw new Error('Method not implemented');
  }

  async getActiveReservationsByDate(date) {
    throw new Error('Method not implemented');
  }

  async getInventoryStatus(roomName, startDate, endDate) {
    throw new Error('Method not implemented');
  }
}
