// useCustomers.js
//
// ⚠️ Firebase → D1 이관 (2026-07-17). **훅 바깥 API 무변경.**
//    useCustomers / useCustomerStats 는 원래부터 useFirebaseStore 를 읽고 있었고,
//    남아 있던 Firestore 접점은 두 개뿐이었다:
//      · useCustomer(phone) — 단건 getDoc → 스토어가 이미 402건 전부 들고 있어 **흡수**했다
//        (같은 camelCase 모양이라 컴포넌트 무수정. BookingModal:56 이 유일한 사용처)
//      · updateCustomer — **호출부 0인 죽은 코드**. 게다가 등급 계산이 브라우저에 있었다.
//        lib/customers.js + /api/customers 가 서버에서 대체하므로 제거한다
import { useMemo } from 'react';
import useFirebaseStore from '../stores/useFirebaseStore';

// 전화번호 정규화 (하이픈 제거)
const normalizePhone = (phone) => {
  return phone.replace(/[^0-9]/g, '');
};

// 고객 조회 (없으면 null — 자동 생성은 예약 생성 시에만, 레거시 동일)
export const useCustomer = (phone, customerName = '') => {
  const customers = useFirebaseStore((state) => state.customers);
  const isLoading = useFirebaseStore((state) => state.loading.customers);
  const error = useFirebaseStore((state) => state.errors.customers);

  const customerId = phone ? normalizePhone(phone) : null;

  // 레거시는 doc(customers/{정규화전화번호}) 로 단건을 읽었다 — id 규칙이 같아 스토어에서 찾으면 된다
  const data = useMemo(
    () => (customerId ? customers.find((c) => c.id === customerId) || null : null),
    [customerId, customers],
  );

  return { data, isLoading, error };
};

// 전체 고객 목록 (Firebase Store에서 가져오기)
export const useCustomers = (searchTerm = '') => {
  const customers = useFirebaseStore((state) => state.customers);
  const loading = useFirebaseStore((state) => state.loading.customers);
  const error = useFirebaseStore((state) => state.errors.customers);
  
  // 클라이언트 사이드 필터링
  const filteredCustomers = searchTerm 
    ? customers.filter(customer => 
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
      )
    : customers;
  
  return {
    data: filteredCustomers,
    isLoading: loading,
    error
  };
};

// 고객 통계
export const useCustomerStats = () => {
  const customers = useFirebaseStore((state) => state.customers);
  
  const stats = {
    totalCustomers: 0,
    vipCustomers: 0,
    vvipCustomers: 0,
    totalRevenue: 0,
    averageVisits: 0,
    averageSpent: 0
  };
  
  if (customers && customers.length > 0) {
    stats.totalCustomers = customers.length;
    
    customers.forEach(customer => {
      if (customer.customerGrade === 'VIP') stats.vipCustomers++;
      if (customer.customerGrade === 'VVIP') stats.vvipCustomers++;
      stats.totalRevenue += customer.totalSpent || 0;
    });
    
    const totalVisits = customers.reduce((sum, customer) => 
      sum + (customer.visitCount || 0), 0);
    
    stats.averageVisits = totalVisits / stats.totalCustomers;
    stats.averageSpent = stats.totalRevenue / stats.totalCustomers;
  }
  
  return stats;
};
