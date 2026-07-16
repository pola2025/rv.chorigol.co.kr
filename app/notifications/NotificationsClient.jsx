"use client";
// 알림 설정 (클라이언트) — 업체 발신설정 + 객실별 문자 템플릿 편집.
// 미리보기는 발송부와 같은 renderTemplate()을 쓴다 (template-vars.js는 D1 의존 없는 순수 모듈).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { renderTemplate, TEMPLATE_VARS } from "../../lib/template-vars.js";

const KINDS = [
  { key: "confirmation", label: "예약확정" },
  { key: "checkIn", label: "입실안내" },
  { key: "checkOut", label: "퇴실안내" },
  { key: "cancellation", label: "예약취소" },
];

const BIZ_LABEL = { choho: "초호펜션", shelter: "초호쉼터" };

// 미리보기용 예시 예약 — 실제 발송과 같은 치환 경로를 타게 한다.
const sampleReservation = (roomName) => ({
  customer_name: "홍길동",
  room_name: roomName,
  check_in: "2026-07-20",
  check_out: "2026-07-21",
  guests: 4,
  total_price: 250000,
  options: [{ name: "숯불바베큐", price: 30000 }],
});

async function patch(body) {
  const res = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "저장 실패");
  return j;
}

export default function NotificationsClient({ configs, templates }) {
  // business+room 단위로 묶는다 (kind 4행 → 객실 1장)
  const rooms = [];
  for (const t of templates) {
    const key = `${t.business}/${t.room_name}`;
    let room = rooms.find((r) => r.key === key);
    if (!room) {
      room = { key, business: t.business, room_name: t.room_name, rows: {} };
      rooms.push(room);
    }
    room.rows[t.kind] = t;
  }
  // 플래그는 발송부가 실제로 읽는 행(confirmation)을 기준으로 표시한다.
  for (const r of rooms) {
    const c = r.rows.confirmation ?? Object.values(r.rows)[0];
    r.flags = {
      enabled: c.enabled,
      confirmation_enabled: c.confirmation_enabled,
      checkin_enabled: c.checkin_enabled,
      checkout_enabled: c.checkout_enabled,
    };
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: ".25rem" }}>알림 설정</h1>
      <p style={{ color: "#6a7a71", fontSize: ".85rem", margin: "0 0 1.5rem" }}>
        업체 {configs.length} · 객실 {rooms.length} · 템플릿 {templates.length} · Cloudflare D1
      </p>

      <h2 style={h2}>업체별 발신 설정</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem", marginBottom: "2rem" }}>
        {configs.map((c) => (
          <ConfigCard key={c.business} cfg={c} />
        ))}
      </div>

      <h2 style={h2}>객실별 문자 템플릿</h2>
      <p style={{ color: "#6a7a71", fontSize: ".78rem", margin: "0 0 .75rem" }}>
        입실·퇴실 안내는 스케줄러 이관 후 동작합니다 (현재 신규 스택은 예약확정 문자만 발송)
      </p>
      <div style={{ display: "grid", gap: ".75rem" }}>
        {rooms.map((room) => (
          <RoomCard key={room.key} room={room} />
        ))}
      </div>
    </main>
  );
}

function ConfigCard({ cfg }) {
  const router = useRouter();
  const [f, setF] = useState(cfg);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const dirty =
    f.sms_from !== cfg.sms_from ||
    f.telegram_chat_id !== cfg.telegram_chat_id ||
    f.use_reservation !== cfg.use_reservation ||
    f.use_cancellation !== cfg.use_cancellation;

  async function save() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await patch({ action: "smsConfig", ...f });
      // 서버가 하이픈을 지워 저장하므로 로컬도 맞춘다 (안 맞추면 저장 후에도 계속 미저장으로 보임)
      setF({ ...f, sms_from: String(f.sms_from ?? "").replace(/-/g, "") });
      setMsg("저장됨");
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: ".75rem" }}>
        {BIZ_LABEL[cfg.business]}
        <span style={{ color: "#6a7a71", fontSize: ".72rem", fontWeight: 400, marginLeft: ".4rem" }}>
          {cfg.business}
        </span>
      </div>

      <div style={{ display: "grid", gap: ".5rem" }}>
        <label style={lbl}>
          발신번호 (SENS 등록번호)
          <input style={inp} value={f.sms_from ?? ""} onChange={(e) => setF({ ...f, sms_from: e.target.value })} />
        </label>
        <label style={lbl}>
          텔레그램 채널 ID
          <input
            style={inp}
            value={f.telegram_chat_id ?? ""}
            onChange={(e) => setF({ ...f, telegram_chat_id: e.target.value })}
          />
          <span style={hint}>슈퍼그룹은 -100 프리픽스 포함 (예: -1002484830636)</span>
        </label>
        <Check
          label="예약 알림 발송 (신규·확정 텔레그램)"
          on={f.use_reservation === 1}
          onChange={(v) => setF({ ...f, use_reservation: v ? 1 : 0 })}
        />
        <Check
          label="취소 알림 발송 (텔레그램만 — 고객 문자 미발송)"
          on={f.use_cancellation === 1}
          onChange={(v) => setF({ ...f, use_cancellation: v ? 1 : 0 })}
        />
      </div>

      {err && <div style={errBox}>{err}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: ".75rem" }}>
        <button onClick={save} disabled={busy || !dirty} style={{ ...primaryBtn, opacity: busy || !dirty ? 0.5 : 1 }}>
          {busy ? "저장 중..." : "저장"}
        </button>
        {msg && <span style={{ color: "#2f6b4f", fontSize: ".75rem" }}>{msg}</span>}
      </div>
      <div style={{ ...hint, marginTop: ".5rem" }}>
        SENS 키·봇토큰은 서버 환경변수에서만 관리합니다 (DB 미저장)
      </div>
    </div>
  );
}

function RoomCard({ room }) {
  const router = useRouter();
  const [kind, setKind] = useState("confirmation");
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(KINDS.map((k) => [k.key, room.rows[k.key]?.content ?? ""])),
  );
  const [flags, setFlags] = useState(room.flags);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const ref = useRef(null);

  const row = room.rows[kind];
  const content = drafts[kind] ?? "";
  const dirty = row && content !== row.content;
  const preview = renderTemplate(content, sampleReservation(room.room_name));

  // 변수를 커서 위치에 삽입 — 손으로 타이핑하다 생기는 오타를 줄인다.
  function insertVar(v) {
    const el = ref.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const next = content.slice(0, start) + v + content.slice(end);
    setDrafts({ ...drafts, [kind]: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + v.length, start + v.length);
    });
  }

  async function toggle(key) {
    const next = { ...flags, [key]: flags[key] ? 0 : 1 };
    const prev = flags;
    setFlags(next);
    setErr("");
    try {
      await patch({
        action: "roomFlags",
        business: room.business,
        room_name: room.room_name,
        flags: next,
      });
      router.refresh();
    } catch (e) {
      setFlags(prev);
      setErr(e.message);
    }
  }

  async function save() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await patch({ action: "template", id: row.id, content });
      setMsg("저장됨");
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const off = flags.enabled !== 1;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: ".75rem" }}>
        <strong>{room.room_name}</strong>
        <span style={{ color: "#6a7a71", fontSize: ".72rem" }}>{BIZ_LABEL[room.business]}</span>
        {off && <span style={{ color: "#a8422f", fontSize: ".72rem" }}>발송 중지</span>}
      </div>

      {/* 발송 플래그 — 객실의 4개 kind 행에 함께 적용된다 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: ".85rem" }}>
        <Check label="전체 발송" on={flags.enabled === 1} onChange={() => toggle("enabled")} />
        <Check
          label="예약확정 문자"
          on={flags.confirmation_enabled === 1}
          dim={off}
          onChange={() => toggle("confirmation_enabled")}
        />
        <Check label="입실안내" on={flags.checkin_enabled === 1} dim={off} onChange={() => toggle("checkin_enabled")} />
        <Check label="퇴실안내" on={flags.checkout_enabled === 1} dim={off} onChange={() => toggle("checkout_enabled")} />
      </div>

      {/* 종류 탭 */}
      <div style={{ display: "flex", gap: ".25rem", marginBottom: ".6rem" }}>
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            style={{
              ...tabBtn,
              background: kind === k.key ? "#2f6b4f" : "#fff",
              color: kind === k.key ? "#fff" : "#3d4f46",
            }}
          >
            {k.label}
            {drafts[k.key] !== room.rows[k.key]?.content && " •"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
        <div>
          <textarea
            ref={ref}
            value={content}
            onChange={(e) => setDrafts({ ...drafts, [kind]: e.target.value })}
            rows={12}
            style={ta}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".25rem", marginTop: ".4rem" }}>
            {TEMPLATE_VARS.map((v) => (
              <button key={v} onClick={() => insertVar(v)} style={chip}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={hint}>미리보기 (예시 예약 · 실제 발송과 같은 치환)</div>
          <pre style={pre}>{preview.text || " "}</pre>
          <div style={{ fontSize: ".72rem", marginTop: ".35rem", color: "#6a7a71" }}>
            {preview.text.length}자
            {preview.missing.length > 0 && (
              <span style={{ color: "#a8422f", marginLeft: ".4rem" }}>
                미지원 변수 {preview.missing.join(" ")} — 저장이 차단됩니다
              </span>
            )}
          </div>
        </div>
      </div>

      {err && <div style={errBox}>{err}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: ".6rem" }}>
        <button onClick={save} disabled={busy || !dirty} style={{ ...primaryBtn, opacity: busy || !dirty ? 0.5 : 1 }}>
          {busy ? "저장 중..." : "템플릿 저장"}
        </button>
        {msg && <span style={{ color: "#2f6b4f", fontSize: ".75rem" }}>{msg}</span>}
      </div>
    </div>
  );
}

function Check({ label, on, onChange, dim }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: ".35rem",
        fontSize: ".8rem",
        color: "#3d4f46",
        cursor: "pointer",
        opacity: dim ? 0.45 : 1,
      }}
    >
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const card = {
  background: "#fff",
  border: "1px solid #dde3de",
  borderRadius: 8,
  padding: "1rem 1.1rem",
};
const h2 = { fontSize: "1rem", margin: "0 0 .6rem", color: "#3d4f46" };
const primaryBtn = {
  background: "#2f6b4f",
  color: "#fff",
  border: "none",
  borderRadius: 5,
  padding: ".4rem .8rem",
  fontSize: ".82rem",
  cursor: "pointer",
};
const tabBtn = {
  border: "1px solid #dde3de",
  borderRadius: 5,
  padding: ".3rem .7rem",
  fontSize: ".78rem",
  cursor: "pointer",
};
const chip = {
  border: "1px solid #dde3de",
  background: "#f9faf8",
  borderRadius: 4,
  padding: ".15rem .4rem",
  fontSize: ".7rem",
  color: "#3d4f46",
  cursor: "pointer",
  fontFamily: "inherit",
};
const lbl = { display: "flex", flexDirection: "column", fontSize: ".72rem", color: "#6a7a71", gap: ".2rem" };
const inp = {
  padding: ".4rem .5rem",
  border: "1px solid #dde3de",
  borderRadius: 5,
  fontSize: ".85rem",
  fontFamily: "inherit",
};
const ta = {
  width: "100%",
  padding: ".5rem",
  border: "1px solid #dde3de",
  borderRadius: 5,
  fontSize: ".8rem",
  fontFamily: "inherit",
  lineHeight: 1.5,
  resize: "vertical",
  boxSizing: "border-box",
};
const pre = {
  background: "#f9faf8",
  border: "1px solid #ebefeb",
  borderRadius: 5,
  padding: ".5rem",
  fontSize: ".78rem",
  fontFamily: "inherit",
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: ".25rem 0 0",
  minHeight: 190,
};
const hint = { fontSize: ".7rem", color: "#6a7a71" };
const errBox = { color: "#a8422f", fontSize: ".78rem", marginTop: ".5rem" };
