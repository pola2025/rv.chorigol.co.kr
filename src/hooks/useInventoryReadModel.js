// src/hooks/useInventoryReadModel.js - 권한 에러 처리 개선
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { auth } from '../config/firebase';
import { getKSTDateString } from '../utils';

export const useInventoryReadModel = () => {
  const [inventoryData, setInventoryData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 인증 상태 확인
    if (!auth.currentUser) {
      console.log('No authenticated user, skipping inventory read model');
      setLoading(false);
      return;
    }

    let unsubscribe = null;

    const setupListener = async () => {
      try {
        setLoading(true);
        setError(null);

        // 오늘부터 30일간의 데이터만 가져오기 (성능 최적화)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

        const q = query(
          collection(db, 'inventory_overrides'),
          where('date', '>=', Timestamp.fromDate(today)),
          where('date', '<=', Timestamp.fromDate(thirtyDaysLater))
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const data = {};
            snapshot.forEach((doc) => {
              const docData = doc.data();
              const dateStr = getKSTDateString(docData.date.toDate());
              if (!data[dateStr]) {
                data[dateStr] = {};
              }
              data[dateStr][docData.roomName] = docData.available;
            });
            setInventoryData(data);
            setLoading(false);
          },
          (error) => {
            console.error('Inventory read model error:', error);
            
            // 권한 에러 처리
            if (error.code === 'permission-denied') {
              console.log('Permission denied - user may not have admin access');
              setError('관리자 권한이 필요합니다.');
            } else {
              setError(error.message);
            }
            
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error setting up inventory listener:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    // 약간의 지연 후 리스너 설정 (인증 상태 안정화)
    const timer = setTimeout(setupListener, 100);

    return () => {
      clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [auth.currentUser]);

  return { inventoryData, loading, error };
};

export default useInventoryReadModel;
