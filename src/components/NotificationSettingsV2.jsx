// src/components/NotificationSettingsV2.jsx
// 데이터는 /api/notifications 경유 — D1 이 단일 소스다 (Firestore 직접 접근 제거).
// SENS 키·텔레그램 봇토큰은 **브라우저로 내려오지 않는다** (서버 env 단일 소스).
// 레거시는 sensService 가 accessKey/secretKey 를 getDoc 으로 읽어 fetch 바디에 실었다
// → DevTools Network 에 원문 노출. 그게 이 이식의 목적이다.
import React, { useState, useEffect, useCallback } from "react";
import telegramService from "../services/telegramService";
import RoomNotificationCardSafe from "./RoomNotificationCardSafe";
import SmsHistoryTable from "./SmsHistoryTable";
import "./NotificationSettings.css";

// 객실 그룹 정의
// 호수뷰객실은 초호쉼터에 속함 (별도 알림 채널 사용)
const ROOM_GROUPS = {
  choho: {
    name: "초호펜션",
    rooms: ["Forest", "Forest mini", "Forest mini 패밀리", "Forest 패밀리"],
  },
  shelter: {
    name: "초호쉼터",
    rooms: ["호수뷰객실", "1박2일워크샵", "야유회", "단체예약"],
  },
};

const NotificationSettingsV2 = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState("choho");

  // 접이식 섹션 상태
  const [expandedSections, setExpandedSections] = useState({
    sens: false,
    telegram: false,
    rooms: true,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // 전역 설정 (SENS, 텔레그램)
  const [globalSettings, setGlobalSettings] = useState({
    choho: {
      sens: {
        serviceId: "",
        accessKey: "",
        secretKey: "",
        from: "",
      },
      telegram: {
        botToken: "", // Firestore에서 로드 (보안)
        chatId: "", // Firestore에서 로드
        useReservation: true,
        useCancellation: true,
        autoSendDaily: true,
      },
    },
    shelter: {
      sens: {
        serviceId: "",
        accessKey: "",
        secretKey: "",
        from: "",
      },
      telegram: {
        botToken: "",
        chatId: "",
        useReservation: true,
        useCancellation: true,
        autoSendDaily: true,
      },
    },
  });

  // 객실별 설정
  const [roomSettings, setRoomSettings] = useState({
    choho: {},
    shelter: {},
  });

  // 설정 불러오기
  useEffect(() => {
    loadSettings();
  }, []);

  // 구 문서(notifications_choho/shelter)에서 마이그레이션하던 폴백은 걷어냈다.
  // D1 이 단일 소스라 sms_config·room_templates 행은 항상 존재한다 → 발동할 수 없는 경로였다.
  const loadSettings = async () => {
    setLoading(true);
    try {
      const [choho, shelter] = await Promise.all(
        ["choho", "shelter"].map(async (business) => {
          const res = await fetch(`/api/notifications?business=${business}`, {
            credentials: "same-origin",
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(json.error || `${business} 설정 조회 실패`);
          return json;
        }),
      );

      setGlobalSettings({
        choho: choho.globalSettings,
        shelter: shelter.globalSettings,
      });
      setRoomSettings({
        choho: choho.roomSettings || {},
        shelter: shelter.roomSettings || {},
      });
    } catch (error) {
      console.error("설정 로드 실패:", error);
      alert(`설정을 불러오는데 실패했습니다.\n\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 저장 3경로(전역 / 객실 1개 / 전체)가 전부 문서를 통째로 보낸다 — 레거시 setDoc 과 같다.
  const saveDoc = async (type, rooms) => {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "settingsDoc",
        business: type,
        globalSettings: globalSettings[type],
        roomSettings: rooms ?? roomSettings[type],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "저장에 실패했습니다.");
    return json;
  };

  // 전역 설정 저장
  const saveGlobalSettings = async (type) => {
    setLoading(true);
    try {
      await saveDoc(type);
      alert(`${ROOM_GROUPS[type].name} 전역 설정이 저장되었습니다.`);
    } catch (error) {
      console.error("전역 설정 저장 실패:", error);
      // 서버가 미지원 변수·형식 오류를 400 으로 짚어준다 — 그 문구를 그대로 보여준다
      alert(`설정 저장에 실패했습니다.\n\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // SENS 설정 저장 — 제거됨 (SENS 설정 섹션이 사라졌다. saveGlobalSettings 를 부르는
  // 중복 별칭이었을 뿐이다). ⚠️ globalSettings 의 `sens` 필드는 **지우지 말 것** —
  // 저장 매퍼(lib/legacy-shape)가 그 모양을 기대한다(감사 124/124).

  // 텔레그램 설정 저장
  const saveTelegramConfig = async (type) => {
    await saveGlobalSettings(type);
  };

  // 객실별 설정 업데이트 및 저장
  const updateAndSaveRoomSettings = useCallback(
    async (room, settings) => {
      console.log("Updating and saving room settings:", room, settings);

      // 먼저 state 업데이트
      const newRoomSettings = {
        ...roomSettings[activeTab],
        [room]: settings,
      };

      setRoomSettings((prev) => ({
        ...prev,
        [activeTab]: newRoomSettings,
      }));

      setLoading(true);
      try {
        // 방금 만든 newRoomSettings 로 저장한다 — setRoomSettings 는 비동기라
        // roomSettings[activeTab] 을 읽으면 직전 값이 나간다 (레거시도 같은 이유로 이렇게 했다)
        await saveDoc(activeTab, newRoomSettings);
        alert(`${room} 객실 설정이 저장되었습니다.`);
      } catch (error) {
        console.error("객실 설정 저장 실패:", error);
        alert(`설정 저장에 실패했습니다.\n\n${error.message}`);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, globalSettings, roomSettings],
  );

  // 모든 객실 설정 한번에 저장
  const saveAllRoomSettings = useCallback(async () => {
    setLoading(true);
    try {
      // 현재 메모리의 설정을 그대로 저장
      await saveDoc(activeTab);
      alert(
        `${ROOM_GROUPS[activeTab].name}의 모든 객실 설정이 저장되었습니다.`,
      );

      // loadSettings()를 호출하지 않음 - 현재 메모리 상태 유지
    } catch (error) {
      console.error("객실 설정 저장 실패:", error);
      alert(`설정 저장에 실패했습니다.\n\n${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab, roomSettings, globalSettings]);

  // SENS 연결 테스트 — 제거됨.
  // 레거시 구현은 sensService.initialize(config) + testConnection() 이었는데,
  // testConnection() 은 **아무것도 테스트하지 않았다**: serviceId/accessKey/secretKey/from 이
  // 비어있지 않은지만 확인하고 true 를 반환하는 위약이었다 (sensService.js:259-286).
  // 키가 서버 env 로 간 지금은 그 필드가 항상 비어 있어 어차피 항상 실패로 떴을 것이다.
  // 실제 발송 확인이 필요하면 문자 발송 이력 표(SmsHistoryTable)를 본다.
  // 텔레그램 연결 테스트 (업체별)
  // 이건 그대로 둔다 — telegramService 는 봇토큰이 필요 없다.
  // Cloud Function 에 { businessType } 만 보내고 토큰은 서버가 쥔다 (initialize 는 no-op).
  const testTelegramConnection = async (type) => {
    setTesting(true);

    try {
      // type을 businessType으로 전달 ('choho' 또는 'shelter')
      const result = await telegramService.testConnection(type);

      if (result) {
        alert(
          `${ROOM_GROUPS[type].name} 텔레그램 연결 테스트 성공! 테스트 메시지를 확인해주세요.`,
        );
      } else {
        alert(
          `${ROOM_GROUPS[type].name} 텔레그램 연결 테스트 실패. 설정을 확인해주세요.`,
        );
      }
    } catch (error) {
      console.error("텔레그램 테스트 실패:", error);
      alert("연결 테스트 중 오류가 발생했습니다.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>설정을 불러오는 중...</p>
      </div>
    );
  }

  const currentGlobalSettings = globalSettings[activeTab];
  const currentRoomSettings = roomSettings[activeTab];

  return (
    <div className="notification-settings">
      {/* 헤더 + 탭 */}
      <div className="notification-header">
        <h2>📱 알림 설정</h2>
        <div className="notification-tabs">
          <button
            className={`tab-btn ${activeTab === "choho" ? "active" : ""}`}
            onClick={() => setActiveTab("choho")}
          >
            🏠 초호펜션
          </button>
          <button
            className={`tab-btn ${activeTab === "shelter" ? "active" : ""}`}
            onClick={() => setActiveTab("shelter")}
          >
            🏡 초호쉼터
          </button>
        </div>
      </div>

      {/* SMS 발송 이력 */}
      <SmsHistoryTable businessType={activeTab} />

      {/* 대상 객실 표시 */}
      <div className="target-rooms">
        <span className="label">대상 객실:</span>
        {ROOM_GROUPS[activeTab].rooms.map((room) => (
          <span key={room} className="room-chip">
            {room}
          </span>
        ))}
      </div>

      {/* 🔴 네이버 SENS 설정 섹션을 제거했다 (사용자 결정, 2026-07-17).
          **쓰기 전용 설정이었다** — 화면은 sms_config.sms_from 을 저장하고 되읽어 보여주는데
          실제 발송자는 `lib/sms.js:53` 의 `FROM[business]` = `process.env.SENS_FROM_CHOHO` 를 쓴다.
          서비스ID·액세스키·시크릿키도 전부 env 다. 즉 **고쳐도 아무 일도 안 일어나는 화면**이라
          "바꿨는데 왜 그대로냐"를 만들 뿐이었다.
          발신번호를 바꾸려면 Vercel 환경변수 SENS_FROM_CHOHO / SENS_FROM_SHELTER 를 고친다.
          발송이 실제로 됐는지는 위 **문자 발송 이력(신호기)** 로 본다. */}

      {/* 텔레그램 설정 - 접이식 */}
      <div className="collapsible-section">
        <div
          className="section-toggle"
          onClick={() => toggleSection("telegram")}
        >
          <div className="section-title">
            <span className="section-icon">💬</span>
            <span>텔레그램 설정</span>
            <span className="status-badge connected">서버 관리</span>
          </div>
          <span className="toggle-icon">
            {expandedSections.telegram ? "▲" : "▼"}
          </span>
        </div>

        {expandedSections.telegram && (
          <div className="section-content">
            {/* 보안 안내 메시지 */}
            <div
              className="security-notice"
              style={{
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "20px" }}>🔒</span>
              <div>
                <strong style={{ color: "#0369a1" }}>보안 강화됨</strong>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "13px",
                    color: "#475569",
                  }}
                >
                  봇 토큰과 채팅 ID는 서버 환경변수에서 관리됩니다.
                </p>
              </div>
            </div>

            {/* 🔴 채팅 ID 입력칸을 제거했다 (사용자 결정, 2026-07-17).
                sms_config.telegram_chat_id 에 저장은 되는데 **아무도 안 읽는다** —
                실제 발송자 `lib/telegram.js:9` 는 `process.env.TELEGRAM_CHAT_ID_CHOHO` 를 쓴다.
                바꾸려면 Vercel 환경변수에서 고친다.
                아래 예약/취소 알림은 **진짜로 동작한다** (reservation-notify.js:105/122 가 읽는다) → 남긴다. */}

            <div className="toggle-options">
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={currentGlobalSettings.telegram.useReservation}
                  onChange={(e) =>
                    setGlobalSettings((prev) => ({
                      ...prev,
                      [activeTab]: {
                        ...prev[activeTab],
                        telegram: {
                          ...prev[activeTab].telegram,
                          useReservation: e.target.checked,
                        },
                      },
                    }))
                  }
                />
                <span>예약 알림</span>
              </label>
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={currentGlobalSettings.telegram.useCancellation}
                  onChange={(e) =>
                    setGlobalSettings((prev) => ({
                      ...prev,
                      [activeTab]: {
                        ...prev[activeTab],
                        telegram: {
                          ...prev[activeTab].telegram,
                          useCancellation: e.target.checked,
                        },
                      },
                    }))
                  }
                />
                <span>취소 알림</span>
              </label>
              {/* 🔴 "일일 현황 자동 발송 (오전 9시)" 체크박스를 제거했다 (사용자 결정, 2026-07-17).
                  9시 일일현황은 폐기됐다 — 유일한 발송자가 브라우저(notificationScheduler)였고
                  그걸 지웠다. 체크박스만 남아 **켜져 있으니 보내지는 중으로 오해**하게 만들었다.
                  D1 의 autoSendDaily 값은 남지만 아무도 안 읽는다. */}
            </div>

            <div className="section-actions">
              <button
                onClick={() => testTelegramConnection(activeTab)}
                className="btn btn-outline"
                // 🔴 예전엔 `|| !…telegram.botToken` 이 붙어 **버튼이 영구히 비활성**이었다.
                //    봇토큰을 서버로 옮기면서 클라가 절대 못 받게 됐는데 조건은 안 고쳤다
                //    → 항상 회색이라 아무도 누를 수 없었다 (2026-07-17 발견).
                disabled={testing}
              >
                {testing ? "테스트 중..." : "연결 테스트"}
              </button>
              <button
                onClick={() => saveTelegramConfig(activeTab)}
                className="btn btn-primary"
                disabled={loading}
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 객실별 설정 - 접이식 */}
      <div className="collapsible-section">
        <div className="section-toggle" onClick={() => toggleSection("rooms")}>
          <div className="section-title">
            <span className="section-icon">🏠</span>
            <span>객실별 알림 설정</span>
            <span className="room-count">
              {ROOM_GROUPS[activeTab].rooms.length}개
            </span>
          </div>
          <span className="toggle-icon">
            {expandedSections.rooms ? "▲" : "▼"}
          </span>
        </div>

        {expandedSections.rooms && (
          <div className="section-content">
            <div className="rooms-header">
              <button
                className="btn btn-primary"
                onClick={saveAllRoomSettings}
                disabled={loading}
              >
                모든 객실 설정 저장
              </button>
            </div>

            <div className="room-cards-container">
              {ROOM_GROUPS[activeTab].rooms.map((room) => (
                <RoomNotificationCardSafe
                  key={room}
                  roomName={room}
                  settings={
                    currentRoomSettings ? currentRoomSettings[room] : null
                  }
                  onSave={updateAndSaveRoomSettings}
                  loading={loading}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 간단한 안내 */}
      <div className="settings-hint">
        💡 각 섹션을 클릭하여 펼치거나 접을 수 있습니다.
      </div>
    </div>
  );
};

export default NotificationSettingsV2;
