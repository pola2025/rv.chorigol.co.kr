// 예약 시스템 디버깅 유틸리티
export const reservationDebugger = {
  // 예약 추가 프로세스 디버깅
  logAddReservation: (step, data, error = null) => {
    const timestamp = new Date().toISOString();
    const logStyle = error ? "color: red; font-weight: bold;" : "color: blue;";

    console.log(`%c[예약 추가 - ${step}] ${timestamp}`, logStyle);

    if (data) {
      console.log("📊 데이터:", data);
    }

    if (error) {
      console.error("❌ 오류:", error);
      console.trace();
    }
  },

  // 예약 데이터 검증
  validateReservationData: (data) => {
    const errors = [];
    const warnings = [];

    // 필수 필드 확인
    const requiredFields = [
      "customerName",
      "phone",
      "roomName",
      "checkIn",
      "checkOut",
    ];

    requiredFields.forEach((field) => {
      if (!data[field]) {
        errors.push(`필수 필드 누락: ${field}`);
      }
    });

    // 날짜 유효성 확인
    if (data.checkIn && data.checkOut) {
      const checkIn = new Date(data.checkIn);
      const checkOut = new Date(data.checkOut);

      if (checkOut <= checkIn) {
        errors.push("체크아웃 날짜는 체크인 날짜 이후여야 합니다");
      }

      if (checkIn < new Date().setHours(0, 0, 0, 0)) {
        warnings.push("체크인 날짜가 과거입니다");
      }
    }

    // 전화번호 형식 확인
    if (data.phone && !/^[0-9-]+$/.test(data.phone)) {
      warnings.push("전화번호 형식이 올바르지 않을 수 있습니다");
    }

    // 가격 정보 확인
    if (typeof data.totalPrice !== "number" || data.totalPrice < 0) {
      errors.push("총 가격이 유효하지 않습니다");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  // 재고 확인 로깅
  logStockCheck: (dateStr, roomName, available, booked) => {
    console.log(`📦 재고 확인 - ${dateStr} | ${roomName}`);
    console.log(`   가용: ${available} | 예약됨: ${booked}`);
  },

  // 오류 분석 및 솔루션 제안
  analyzeError: (error) => {
    const analysis = {
      type: "UNKNOWN",
      message: error.message || "알 수 없는 오류",
      suggestions: [],
    };

    // Firebase 권한 오류
    if (error.code === "permission-denied") {
      analysis.type = "PERMISSION_ERROR";
      analysis.suggestions = [
        "Firebase 보안 규칙을 확인하세요",
        "사용자 인증 상태를 확인하세요",
        "Firestore 규칙에서 reservations 컬렉션에 대한 쓰기 권한을 확인하세요",
      ];
    }

    // 네트워크 오류
    else if (
      error.code === "unavailable" ||
      error.message?.includes("network")
    ) {
      analysis.type = "NETWORK_ERROR";
      analysis.suggestions = [
        "인터넷 연결을 확인하세요",
        "Firebase 프로젝트가 활성화되어 있는지 확인하세요",
        "VPN이나 방화벽 설정을 확인하세요",
      ];
    }

    // 데이터 유효성 오류
    else if (
      error.message?.includes("재고") ||
      error.message?.includes("예약 가능")
    ) {
      analysis.type = "STOCK_ERROR";
      analysis.suggestions = [
        "선택한 날짜의 재고를 확인하세요",
        "다른 날짜를 선택해 보세요",
        "객실 설정에서 재고 수량을 확인하세요",
      ];
    }

    // Timestamp 관련 오류
    else if (
      error.message?.includes("Timestamp") ||
      error.message?.includes("serverTimestamp")
    ) {
      analysis.type = "TIMESTAMP_ERROR";
      analysis.suggestions = [
        "Firebase import 구문을 확인하세요",
        "serverTimestamp() 함수 사용법을 확인하세요",
        "Timestamp.now() 대신 serverTimestamp()를 사용하세요",
      ];
    }

    return analysis;
  },
};

// 전역 에러 핸들러 등록
if (typeof window !== "undefined") {
  window.reservationDebugger = reservationDebugger;

  // 페이지 로드 시 알림 (개발 환경에서만)
  // import.meta.env 는 Vite 전용이다 — Next(webpack)에선 undefined 라 .DEV 에서 터진다.
  // process.env.NODE_ENV 는 Vite·Next 양쪽 다 정적 치환한다 (두 스택 공존 기간용).
  if (process.env.NODE_ENV !== "production") {
    window.addEventListener("load", () => {
      console.log("🚀 예약 시스템 디버거 활성화됨");
    });
  }
}

export default reservationDebugger;
