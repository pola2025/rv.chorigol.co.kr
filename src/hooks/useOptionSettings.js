// src/hooks/useOptionSettings.js
//
// ⚠️ Firebase → D1 이관 (2026-07-17). **훅 바깥 API 는 한 글자도 바꾸지 않았다.**
//    useOptionSettings() → { settings, loading, error }
//    useLateCheckoutSettings() → { settings, availableRooms, isAvailableForRoom, loading, error }
//    → NewReservationModal 은 수정하지 않는다.
//
// 바뀐 것은 출처뿐: Firestore `getDoc(settings/option_settings)` → `GET /api/option-settings`.
//
// 이 설정이 하는 일: `late_checkout.roomStocks` 가 **옵션 노출 여부**를 정한다
// (NewReservationModal:845 — 재고>0 인 객실에만 레이트 체크아웃 체크박스가 뜬다).
// 이관 때 이 문서가 통째로 빠져 있었고(D1 에 settings 테이블 자체가 없었다), 복구했다
// (`scripts/migration/load-option-settings.mjs`, 값: {Forest:1, Forest mini:2}).
import { useState, useEffect } from "react";

// 옵션 설정을 가져오는 hook
export const useOptionSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/option-settings", {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`option-settings ${res.status}`);
        const { settings: data } = await res.json();
        if (cancelled) return;
        // 레거시는 문서가 없으면 setSettings 를 부르지 않아 {} 로 남았다 — 동일하게 유지
        if (data) setSettings(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch option settings:", err);
        if (cancelled) return;
        setError(err);
        setLoading(false);
      }
    };

    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    settings,
    loading,
    error,
  };
};

// 레이트 체크아웃 설정을 가져오는 hook
export const useLateCheckoutSettings = () => {
  const { settings, loading, error } = useOptionSettings();

  const lateCheckoutSettings = settings?.late_checkout || {
    id: "late_checkout",
    name: "레이트 체크아웃",
    type: "late_checkout",
    applicableRooms: "individual",
    roomStocks: {},
    description: "낮 12시 체크아웃",
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
    error,
  };
};

export default useOptionSettings;
