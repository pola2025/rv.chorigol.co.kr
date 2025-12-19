// useCustomers.js
import { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CustomerGrades } from '../models/Customer';
import useFirebaseStore from '../stores/useFirebaseStore';

// 전화번호 정규화 (하이픈 제거)
const normalizePhone = (phone) => {
  return phone.replace(/[^0-9]/g, '');
};

// 고객 등급 계산
const calculateCustomerGrade = (visitCount, totalSpent) => {
  if (visitCount >= CustomerGrades.VVIP.minVisits && totalSpent >= CustomerGrades.VVIP.minSpent) {
    return 'VVIP';
  }
  if (visitCount >= CustomerGrades.VIP.minVisits && totalSpent >= CustomerGrades.VIP.minSpent) {
    return 'VIP';
  }
  return 'NORMAL';
};

// 고객 조회 또는 생성
export const useCustomer = (phone, customerName = '') => {
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const customerId = phone ? normalizePhone(phone) : null;

  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      return;
    }

    const fetchCustomer = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const customerRef = doc(db, 'customers', customerId);
        const customerDoc = await getDoc(customerRef);
        
        if (customerDoc.exists()) {
          setCustomer({ id: customerDoc.id, ...customerDoc.data() });
        } else {
          // 고객이 없으면 null 반환 (자동 생성은 예약 생성 시에만)
          setCustomer(null);
        }
      } catch (err) {
        console.error('고객 정보 조회 오류:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, [customerId]);

  return { data: customer, isLoading, error };
};

// 고객 정보 업데이트
export const updateCustomer = async ({ customerId, updates }) => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    
    // 등급 자동 계산
    if (updates.visitCount !== undefined || updates.totalSpent !== undefined) {
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        const currentData = customerDoc.data();
        const newVisitCount = updates.visitCount ?? currentData.visitCount;
        const newTotalSpent = updates.totalSpent ?? currentData.totalSpent;
        updates.customerGrade = calculateCustomerGrade(newVisitCount, newTotalSpent);
      }
    }
    
    await updateDoc(customerRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('고객 정보 업데이트 오류:', error);
    return { success: false, error: error.message };
  }
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
