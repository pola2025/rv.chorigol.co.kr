// src/hooks/useOptionSettings.js
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// 옵션 설정을 가져오는 hook
export const useOptionSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'option_settings');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch option settings:', err);
        setError(err);
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  return {
    settings,
    loading,
    error
  };
};

// 레이트 체크아웃 설정을 가져오는 hook
export const useLateCheckoutSettings = () => {
  const { settings, loading, error } = useOptionSettings();
  
  const lateCheckoutSettings = settings?.late_checkout || {
    id: 'late_checkout',
    name: '레이트 체크아웃',
    type: 'late_checkout',
    applicableRooms: 'individual',
    roomStocks: {},
    description: '오후 2시 체크아웃'
  };
  
  // 설정된 객실만 필터링
  const availableRooms = Object.entries(lateCheckoutSettings.roomStocks || {})
    .filter(([room, stock]) => stock > 0)
    .map(([room, stock]) => ({ room, stock }));
  
  // 특정 객실에 레이트 체크아웃이 가능한지 확인
  const isAvailableForRoom = (roomName) => {
    return (lateCheckoutSettings.roomStocks?.[roomName] || 0) > 0;
  };
  
  return {
    settings: lateCheckoutSettings,
    availableRooms,
    isAvailableForRoom,
    loading,
    error
  };
};

export default useOptionSettings;