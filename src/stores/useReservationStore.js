// src/stores/useReservationStore.js
//
// ⚠️ Firebase → D1 이관 (2026-07-16). **스토어 바깥 API 는 한 글자도 바꾸지 않았다.**
//    메서드 시그니처·반환값({success,id,error,type})·operationLoading/operationError 모양 동일.
//    → 이 스토어를 쓰는 컴포넌트(Dashboard, useReservations 훅 등)는 수정하지 않는다.
//
// 바뀐 것은 쓰기 경로뿐:
//    Firestore addDoc/updateDoc/deleteDoc/runTransaction  →  fetch → /api/*
//
// 세 가지 이유로 브라우저가 DB 에 직접 붙지 않는다:
//   1. 보안 — D1 토큰이 클라이언트 번들에 들어가면 안 된다 (누구나 DB 를 읽고 쓴다)
//   2. 알림 — 문자·텔레그램은 서버가 보낸다. 브라우저를 닫아도 발송이 죽지 않는다
//      (2026-03-02 에 트리거로 옮긴 이유. API 가 그 역할을 그대로 이어받았다)
//   3. 재고 — 오버부킹 가드는 단일 SQL 문장의 원자성에 기대므로 서버에만 존재할 수 있다
//
// 순수 함수 5개(normalizePhone·calculateCustomerGrade·getAvailableStock·
// checkAvailabilityForRange·getStatistics)는 스토어 상태만 읽으므로 **손대지 않았다**.
import { create } from "zustand";
import useFirebaseStore from "./useFirebaseStore";
import { CustomerGrades } from "../models/Customer";
import useReservationCache from "./useReservationCache";
import { getKSTDateString, getKSTToday } from "../utils";
import { toWriteBody } from "../../lib/legacy-write-shape";

/**
 * API 호출 — 실패하면 서버 문구 그대로 던진다(레거시가 Firestore 에러 메시지를 그대로 썼듯이).
 * status 를 에러에 붙여 호출부가 재고부족(409)을 구분할 수 있게 한다.
 */
async function api(path, { method = "PATCH", body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `요청 실패 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** 쓰기 후 화면 갱신. 레거시는 Firestore onSnapshot 이 밀어줬지만 D1 엔 push 가 없다 */
const refresh = () => useFirebaseStore.getState().refresh();

/** 고객 정보 갱신 (백그라운드) — 레거시와 동일하게 실패해도 예약 자체는 성공 처리 */
function updateCustomerBackground(body) {
  api("/api/customers", { body }).catch((e) =>
    console.error("고객 정보 업데이트 오류:", e),
  );
}

const useReservationStore = create((set, get) => ({
  // 예약 관련 작업 상태
  operationLoading: false,
  operationError: null,

  // 전화번호 정규화 (010-1234-5678 -> 01012345678)
  normalizePhone: (phone) => {
    return phone.replace(/[^0-9]/g, "");
  },

  // 고객 등급 계산
  calculateCustomerGrade: (visitCount, totalSpent) => {
    if (
      visitCount >= CustomerGrades.VVIP.minVisits &&
      totalSpent >= CustomerGrades.VVIP.minSpent
    ) {
      return "VVIP";
    }
    if (
      visitCount >= CustomerGrades.VIP.minVisits &&
      totalSpent >= CustomerGrades.VIP.minSpent
    ) {
      return "VIP";
    }
    return "NORMAL";
  },

  // 재고 계산 함수 (순수 함수) - 캐싱 적용
  getAvailableStock: (dateStr, roomName) => {
    // 캐시 확인
    const cached = useReservationCache
      .getState()
      .getCachedStock(dateStr, roomName);
    if (cached !== null) {
      return cached;
    }

    const { rooms, reservations, overrides } = useFirebaseStore.getState();
    const room = rooms.find((r) => r.객실명 === roomName);
    if (!room) return 0;

    // Override가 있으면 우선 적용
    const overrideKey = `${dateStr}_${roomName}`;
    if (overrides[overrideKey] !== undefined) {
      const stock = overrides[overrideKey];
      // 캐시 저장
      useReservationCache.getState().setCachedStock(dateStr, roomName, stock);
      return stock;
    }

    // 해당 날짜의 예약 수 계산
    const bookedReservations = reservations.filter((res) => {
      const isNotCanceled = res.status !== "예약취소";
      const isSameRoom = res.roomName === roomName;
      const isInDateRange = dateStr >= res.checkIn && dateStr < res.checkOut;

      return isNotCanceled && isSameRoom && isInDateRange;
    });

    const stock = Math.max(0, (room.재고 || 0) - bookedReservations.length);

    // 캐시 저장
    useReservationCache.getState().setCachedStock(dateStr, roomName, stock);

    return stock;
  },

  // 날짜 범위의 재고 확인
  checkAvailabilityForRange: (checkIn, checkOut, roomName) => {
    const dates = [];
    const current = new Date(checkIn);
    const end = new Date(checkOut);

    while (current < end) {
      dates.push(getKSTDateString(current));
      current.setDate(current.getDate() + 1);
    }

    return dates.every((date) => get().getAvailableStock(date, roomName) > 0);
  },

  // 예약 추가
  //
  // ⚠️ 레거시의 **클라이언트 재고 선검사를 뺐다** (의도적 · 유일한 동작 변경).
  //    레거시는 onSnapshot 으로 항상 최신이라 브라우저에서 검사해도 맞았지만, D1 스냅샷은
  //    최대 30초 낡을 수 있어 **비어 있는 방을 거절**할 수 있다. 서버 가드는 단일 문장이라
  //    절대 낡지 않고 막힌 날짜까지 짚어준다 → 판단을 서버로 일원화했다.
  //    (거절 문구가 "선택한 날짜에…" → "{날짜}에 예약 가능한 객실이 없습니다…" 로 바뀐다.
  //     둘 다 레거시에 있던 문구다 — 후자가 트랜잭션 경로의 문구였다)
  addReservation: async (reservationData) => {
    set({ operationLoading: true, operationError: null });

    try {
      const { reservation } = await api("/api/reservations", {
        method: "POST",
        body: toWriteBody(reservationData),
      });

      // 화면 갱신까지 마친 뒤 로딩을 푼다 — 방금 넣은 예약이 안 보이면 관리자가 다시 넣는다
      await refresh();
      set({ operationLoading: false });

      // 고객 정보 업데이트 (백그라운드) — 레거시와 동일하게 막기 예약은 제외
      if (reservationData.source !== "막기" && reservationData.phone) {
        updateCustomerBackground({
          op: "visit",
          reservation_id: reservation.id,
          phone: reservationData.phone,
          name: reservationData.customerName,
          room_name: reservationData.roomName,
          total_price: reservationData.totalPrice,
        });
      }

      return { success: true, id: reservation.id };
    } catch (error) {
      console.error("예약 추가 오류:", error);
      set({
        operationLoading: false,
        operationError: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  // 예약 수정
  // options.skipLoadingUpdate: true이면 loading 상태를 외부에서 관리 (confirmReservation, cancelReservation에서 사용)
  updateReservation: async (reservationId, updates, options = {}) => {
    if (!options.skipLoadingUpdate) {
      set({ operationLoading: true, operationError: null });
    }

    try {
      // 상태·객실 변경 감지와 알림 발송은 서버(API)가 한다 — 레거시의 Firestore 트리거 역할
      await api("/api/reservations", {
        body: { id: reservationId, ...toWriteBody(updates) },
      });

      await refresh();

      // skipLoadingUpdate가 아닌 경우에만 loading 상태 업데이트
      if (!options.skipLoadingUpdate) {
        set({ operationLoading: false });
      }

      return { success: true };
    } catch (error) {
      console.error("예약 수정 오류:", error);
      set({
        operationLoading: false,
        operationError: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  // 예약 취소
  cancelReservation: async (reservationId, cancelData = {}) => {
    // 예약 정보 확인
    const reservations = useFirebaseStore.getState().reservations;
    const reservation = reservations.find((r) => r.id === reservationId);

    // 관리자 막기 예약인 경우 완전 삭제 (일반 예약은 이력이 남아야 하므로 취소 상태로만)
    if (reservation && reservation.source === "막기") {
      set({ operationLoading: true, operationError: null });

      try {
        await api(`/api/reservations?id=${encodeURIComponent(reservationId)}`, {
          method: "DELETE",
        });

        // 캐시 무효화 - 날짜 범위 전체
        if (
          reservation.checkIn &&
          reservation.checkOut &&
          reservation.roomName
        ) {
          useReservationCache
            .getState()
            .invalidateReservationDateRange(
              reservation.checkIn,
              reservation.checkOut,
              reservation.roomName,
            );
        }

        await refresh();

        set({ operationLoading: false });
        return { success: true };
      } catch (error) {
        console.error("막기 예약 삭제 오류:", error);
        set({
          operationLoading: false,
          operationError: error.message,
        });
        return { success: false, error: error.message };
      }
    }

    // 일반 예약은 취소 상태로 변경
    set({ operationLoading: true, operationError: null });

    let result;
    try {
      // cancel:true → 서버가 상태·환불정보를 기록하고 취소 텔레그램을 보낸다
      // (취소 문자는 정책상 발송하지 않는다)
      await api("/api/reservations", {
        body: {
          id: reservationId,
          cancel: true,
          ...toWriteBody({
            cancelReason: cancelData.cancelReason || "",
            refundAmount: cancelData.refundAmount || 0,
            cancellationFee: cancelData.cancellationFee || 0,
            refundRate: cancelData.refundRate || 0,
          }),
        },
      });
      result = { success: true };
    } catch (error) {
      console.error("예약 취소 오류:", error);
      set({ operationError: error.message });
      result = { success: false, error: error.message };
    }

    // 캐시 무효화 - 날짜 범위 전체
    if (result.success && reservation) {
      if (reservation.checkIn && reservation.checkOut && reservation.roomName) {
        useReservationCache
          .getState()
          .invalidateReservationDateRange(
            reservation.checkIn,
            reservation.checkOut,
            reservation.roomName,
          );
      }

      await refresh();
    }

    set({ operationLoading: false });

    // 고객 취소 횟수 업데이트 (백그라운드)
    if (
      result.success &&
      reservation &&
      reservation.phone &&
      reservation.source !== "막기"
    ) {
      updateCustomerBackground({ op: "cancel", phone: reservation.phone });
    }

    return result;
  },

  // 예약 확정
  confirmReservation: async (reservationId, depositorName) => {
    set({ operationLoading: true, operationError: null });

    // 확정 알림(텔레그램)과 확정 문자는 서버가 발송한다 — 브라우저를 닫아도 나간다
    const result = await get().updateReservation(
      reservationId,
      {
        status: "예약확정",
        depositorName,
      },
      { skipLoadingUpdate: true },
    );

    set({ operationLoading: false });

    if (!result.success) {
      console.error("[confirmReservation] DB 업데이트 실패:", result.error);
    }

    return result;
  },

  // 재고 수동 조정
  updateInventoryOverride: async (dateStr, roomName, available) => {
    set({ operationLoading: true, operationError: null });

    try {
      // available null/undefined → 삭제(기본 재고로 복원). 레거시와 같은 계약이다.
      // 서버는 undefined 를 구분할 수 없으므로 null 로 정규화해서 보낸다
      await api("/api/inventory-override", {
        body: {
          date: dateStr,
          room_name: roomName,
          available: available ?? null,
        },
      });

      // 캐시 무효화
      useReservationCache.getState().invalidateRoomCache(roomName);

      await refresh();

      set({ operationLoading: false });
      return { success: true };
    } catch (error) {
      console.error("재고 수정 오류:", error);
      set({
        operationLoading: false,
        operationError: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  // 예약 통계
  getStatistics: () => {
    const { reservations, rooms } = useFirebaseStore.getState();
    const today = getKSTToday();

    return {
      todayCheckIn: reservations.filter(
        (res) => res.checkIn === today && res.status !== "예약취소",
      ).length,
      todayCheckOut: reservations.filter(
        (res) => res.checkOut === today && res.status !== "예약취소",
      ).length,
      totalRooms: rooms.reduce((sum, room) => sum + (room.재고 || 0), 0),
      activeReservations: reservations.filter(
        (res) => res.status !== "예약취소",
      ).length,
      pendingPayments: reservations.filter((res) => res.status === "입금대기")
        .length,
    };
  },

  /**
   * 재고 검사 기반 예약 생성 - 재고 정확성 100% 보장
   *
   * 레거시는 runTransaction 으로 "보장"하려 했지만 실제로는 예약 목록을 트랜잭션 **밖**에서
   * 읽어 낡은 배열로 셌다 → 동시 예약이 둘 다 통과하는 TOCTOU. 지금은 서버 가드가
   * 재고검사를 INSERT 의 WHERE 에 넣어 단일 문장으로 처리하므로 이름값을 실제로 한다.
   * → addReservation 과 같은 경로가 됐고, 다른 건 재고부족 시 반환 모양뿐이다(STOCK_EXHAUSTED).
   */
  createReservationWithInventoryCheck: async (reservationData) => {
    set({ operationLoading: true, operationError: null });

    try {
      const { reservation } = await api("/api/reservations", {
        method: "POST",
        body: toWriteBody(reservationData),
      });

      await refresh();
      set({ operationLoading: false });

      // 고객 정보 업데이트 (백그라운드)
      if (reservationData.source !== "막기" && reservationData.phone) {
        updateCustomerBackground({
          op: "visit",
          reservation_id: reservation.id,
          phone: reservationData.phone,
          name: reservationData.customerName,
          room_name: reservationData.roomName,
          total_price: reservationData.totalPrice,
        });
      }

      return { success: true, id: reservation.id };
    } catch (error) {
      console.error("예약 생성 실패:", error);
      set({
        operationLoading: false,
        operationError: error.message,
      });

      // 재고 부족(409) 처리 — 호출부(Dashboard)가 type 으로 분기한다
      if (error.status === 409) {
        return {
          success: false,
          error:
            "죄송합니다. 방금 마지막 객실이 예약되었습니다. 다른 날짜를 선택해 주세요.",
          type: "STOCK_EXHAUSTED",
        };
      }

      return { success: false, error: error.message };
    }
  },

  /**
   * 고객 정보 업데이트 헬퍼 — 등급·방문횟수 계산은 **서버**(lib/customers.js)가 한다.
   * 레거시는 이 계산을 브라우저에서 했고 addReservation 에도 같은 코드가 복제돼 있었다.
   */
  updateCustomerInfo: async (reservationId, reservationData) => {
    return api("/api/customers", {
      body: {
        op: "visit",
        reservation_id: reservationId,
        phone: reservationData.phone,
        name: reservationData.customerName,
        room_name: reservationData.roomName,
        total_price: reservationData.totalPrice,
      },
    });
  },
}));

export default useReservationStore;
