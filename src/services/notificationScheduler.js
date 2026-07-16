// src/services/notificationScheduler.js
//
// 브라우저에서 도는 스케줄러다 — 관리자 탭이 열려 있어야만 동작한다.
// 남은 역할은 **오전 9시 일일현황 텔레그램 하나뿐**이다.
//
// 입실/퇴실 안내(문자)는 여기서 걷어냈다. Cloud Function `autoSendSMSScheduler`
// (functions/src/smsScheduler.js, 매일 10시·13시)가 실제 발송자이고, 그쪽은
// `smsStatus.{type}Sent` 로 중복을 막는다. 여기 있던 경로는 `checkInNotificationSent`
// 라는 **다른 필드**로 조회·표시해서 서로의 발송을 못 봤다.
// 다만 Firestore 의 `!=` 쿼리는 **필드가 없는 문서를 제외**하므로 그 쿼리는 영원히
// 빈 집합이었다(필드를 채우는 건 자기 자신뿐인데 채우려면 먼저 조회돼야 하는 순환).
// 실측: 예약 540건 중 마커 보유 0건 · smsStatus 보유 255건 → 한 번도 발송된 적이 없다.
// 터지지 않은 지뢰라 유실 없이 제거했다.
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "../config/firebase";
import telegramService from "./telegramService";

// 발송 이력 문서. 탭마다 인스턴스가 따로 돌기 때문에 "하루 1회"는
// 인메모리 플래그로 보장할 수 없다 (탭 2개 = 2번, 새로고침 = 재발송).
const DAILY_STATE_DOC = "daily_summary_state";

class NotificationScheduler {
  constructor() {
    this.dailyIntervalId = null;
    this.settingsV2 = { choho: null, shelter: null };
  }

  // KST 기준 현재 날짜 문자열 반환 (YYYY-MM-DD)
  getKSTDateString(date = new Date()) {
    const kstOffset = 9 * 60; // KST는 UTC+9
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const kstDate = new Date(utc + kstOffset * 60000);
    return kstDate.toISOString().split("T")[0];
  }

  // KST 기준 현재 시간 반환
  getKSTHour(date = new Date()) {
    const kstOffset = 9 * 60;
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const kstDate = new Date(utc + kstOffset * 60000);
    return kstDate.getHours();
  }

  // KST 기준 현재 분 반환
  getKSTMinute(date = new Date()) {
    const kstOffset = 9 * 60;
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const kstDate = new Date(utc + kstOffset * 60000);
    return kstDate.getMinutes();
  }

  // 스케줄러 시작
  async start() {
    // 이미 돌고 있으면 인터벌을 또 만들지 않는다 (같은 탭 내 중복 방지)
    if (this.dailyIntervalId) {
      console.log("📅 [SCHEDULER] 이미 실행 중 — 중복 시작 무시");
      return;
    }

    console.log("📅 [SCHEDULER] 일일현황 스케줄러 시작");
    await this.loadSettingsV2();

    // 1분마다 일일현황 발송 시간 체크 (오전 9시)
    this.dailyIntervalId = setInterval(() => {
      this.checkDailySummary();
    }, 60 * 1000);

    // 즉시 한 번 실행
    this.checkDailySummary();

    console.log("📅 [SCHEDULER] 일일현황 스케줄러 시작 완료");
  }

  // 스케줄러 중지
  stop() {
    if (this.dailyIntervalId) {
      clearInterval(this.dailyIntervalId);
      this.dailyIntervalId = null;
    }
  }

  // V2 설정 로드
  async loadSettingsV2() {
    try {
      // 초호펜션 설정
      const chohoDoc = await getDoc(
        doc(db, "settings", "notifications_v2_choho"),
      );
      if (chohoDoc.exists()) {
        this.settingsV2.choho = chohoDoc.data();
        console.log("📅 [SCHEDULER] 초호펜션 V2 설정 로드됨");
      }

      // 초호쉼터 설정
      const shelterDoc = await getDoc(
        doc(db, "settings", "notifications_v2_shelter"),
      );
      if (shelterDoc.exists()) {
        this.settingsV2.shelter = shelterDoc.data();
        console.log("📅 [SCHEDULER] 초호쉼터 V2 설정 로드됨");
      }
    } catch (error) {
      console.error("📅 [SCHEDULER] V2 설정 로드 실패:", error);
    }
  }

  // 일일현황 발송 체크
  async checkDailySummary() {
    const now = new Date();
    const currentHour = this.getKSTHour(now);
    const currentMinute = this.getKSTMinute(now);

    // 오전 9시 0분 ~ 9시 5분 사이에 발송
    // (하루 1회 보장은 claimDailySummary 가 한다 — 인메모리 플래그 아님)
    if (currentHour !== 9 || currentMinute >= 5) return;

    console.log("📅 [SCHEDULER] 일일현황 발송 시간 도달");
    await this.sendDailySummaries();
  }

  // 오늘치 발송을 선점한다. 이미 누가 보냈으면 false.
  // **발송 전에** 선점해야 한다 — 보내고 나서 기록하면 그 사이 다른 탭이 또 보낸다.
  async claimDailySummary(type, todayStr) {
    const ref = doc(db, "settings", DAILY_STATE_DOC);
    try {
      return await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists() && snap.data()?.[type] === todayStr) return false;
        tx.set(ref, { [type]: todayStr }, { merge: true });
        return true;
      });
    } catch (error) {
      // 선점에 실패하면 보내지 않는다 — 중복 발송보다 누락이 낫다
      console.error(`📊 [DAILY] ${type} 발송 선점 실패:`, error);
      return false;
    }
  }

  // 일일현황 발송
  async sendDailySummaries() {
    console.log("📊 [DAILY] 일일현황 발송 시작");

    const todayStr = this.getKSTDateString();

    // 설정은 하루가 지나 낡았을 수 있다 (start 이후 계속 도는 인터벌이다)
    await this.loadSettingsV2();

    for (const type of ["choho", "shelter"]) {
      const telegramConfig = this.settingsV2[type]?.globalSettings?.telegram;
      if (!telegramConfig?.autoSendDaily) continue;
      if (!telegramConfig.botToken || !telegramConfig.chatId) continue;

      const claimed = await this.claimDailySummary(type, todayStr);
      if (!claimed) {
        console.log(`📊 [DAILY] ${type} ${todayStr} 이미 발송됨 — 스킵`);
        continue;
      }

      try {
        telegramService.initialize(telegramConfig);
        const data = await this.getDailySummaryData(type);
        await telegramService.sendDailySummary(data);
        console.log(`📊 [DAILY] ${type} 일일현황 발송 완료`);
      } catch (error) {
        console.error(`📊 [DAILY] ${type} 일일현황 발송 실패:`, error);
      }
    }
  }

  // 일일현황 데이터 조회
  async getDailySummaryData(type) {
    const today = this.getKSTDateString();
    const rooms =
      type === "choho"
        ? ["Forest", "Forest mini", "Forest mini 패밀리", "Forest 패밀리"]
        : ["호수뷰객실"];

    try {
      // 오늘 입실 예약
      const checkInQuery = query(
        collection(db, "reservations"),
        where("checkIn", "==", today),
        where("status", "==", "예약확정"),
      );
      const checkInSnapshot = await getDocs(checkInQuery);
      const checkInList = checkInSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((r) => rooms.some((room) => r.roomName?.includes(room)));

      // 오늘 퇴실 예약
      const checkOutQuery = query(
        collection(db, "reservations"),
        where("checkOut", "==", today),
        where("status", "==", "예약확정"),
      );
      const checkOutSnapshot = await getDocs(checkOutQuery);
      const checkOutList = checkOutSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((r) => rooms.some((room) => r.roomName?.includes(room)));

      // 현재 투숙 중 (체크인 <= 오늘 < 체크아웃)
      const stayingQuery = query(
        collection(db, "reservations"),
        where("checkIn", "<=", today),
        where("status", "==", "예약확정"),
      );
      const stayingSnapshot = await getDocs(stayingQuery);
      const currentStayList = stayingSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (r) =>
            r.checkOut > today &&
            rooms.some((room) => r.roomName?.includes(room)),
        );

      // 이번달 매출
      const monthStart = today.slice(0, 7) + "-01";
      const monthEnd = today.slice(0, 7) + "-31";
      const monthReservations = [
        ...checkInSnapshot.docs,
        ...stayingSnapshot.docs,
      ]
        .map((doc) => doc.data())
        .filter((r) => r.checkIn >= monthStart && r.checkIn <= monthEnd);
      const monthRevenue = monthReservations.reduce(
        (sum, r) => sum + (r.totalPrice || 0),
        0,
      );

      // 오늘 매출
      const todayRevenue = checkInList.reduce(
        (sum, r) => sum + (r.totalPrice || 0),
        0,
      );

      return {
        checkInCount: checkInList.length,
        checkInList,
        checkOutCount: checkOutList.length,
        checkOutList,
        currentStayCount: currentStayList.length,
        totalRooms: rooms.length,
        todayRevenue,
        monthRevenue,
      };
    } catch (error) {
      console.error("일일현황 데이터 조회 실패:", error);
      return {
        checkInCount: 0,
        checkInList: [],
        checkOutCount: 0,
        checkOutList: [],
        currentStayCount: 0,
        totalRooms: rooms.length,
        todayRevenue: 0,
        monthRevenue: 0,
      };
    }
  }
}

// 싱글톤 인스턴스
const notificationScheduler = new NotificationScheduler();
export default notificationScheduler;
