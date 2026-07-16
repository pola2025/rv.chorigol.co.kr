"use client";
// 예약 캘린더 (클라이언트) — 월 그리드 + 날짜별 상세 + 신규예약 생성.
// 쓰기는 fetch('/api/reservations') → 서버가 D1 저장 + 알림.
import { useState } from "react";
import { useRouter } from "next/navigation";

const won = (n) => (n || 0).toLocaleString();
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_COLOR = { 예약확정: "#2f6b4f", 입금대기: "#8a6318", 예약취소: "#a8422f" };

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildGrid(ym) {
  const [y, m] = ym.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${ym}-${String(d).padStart(2, "0")}`);
  return cells;
}

export default function CalendarClient({ ym, reservations, rooms }) {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const byDate = {};
  for (const r of reservations) (byDate[r.check_in] ||= []).push(r);

  const cells = buildGrid(ym);
  const dayList = selected ? byDate[selected] || [] : [];

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>예약 캘린더</h1>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center", marginLeft: "auto" }}>
          <a href={`/calendar?month=${shiftMonth(ym, -1)}`} style={navBtn}>◀</a>
          <strong style={{ minWidth: 90, textAlign: "center" }}>{ym}</strong>
          <a href={`/calendar?month=${shiftMonth(ym, 1)}`} style={navBtn}>▶</a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
        {/* 월 그리드 */}
        <div style={{ background: "#fff", border: "1px solid #dde3de", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} style={{ ...dowCell, color: i === 0 ? "#a8422f" : i === 6 ? "#2f6b4f" : "#6a7a71" }}>
                {w}
              </div>
            ))}
            {cells.map((date, i) => {
              const items = date ? byDate[date] || [] : [];
              const dow = i % 7;
              return (
                <div
                  key={i}
                  onClick={() => date && setSelected(date)}
                  style={{
                    minHeight: 84,
                    borderTop: "1px solid #ebefeb",
                    borderLeft: dow === 0 ? "none" : "1px solid #ebefeb",
                    padding: ".3rem .35rem",
                    cursor: date ? "pointer" : "default",
                    background: date === selected ? "#eef2ee" : "#fff",
                  }}
                >
                  {date && (
                    <>
                      <div style={{ fontSize: ".72rem", color: dow === 0 ? "#a8422f" : dow === 6 ? "#2f6b4f" : "#3d4f46" }}>
                        {Number(date.slice(-2))}
                      </div>
                      {items.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          style={{
                            fontSize: ".68rem",
                            marginTop: 2,
                            padding: "1px 4px",
                            borderRadius: 3,
                            background: "#f5f6f4",
                            borderLeft: `3px solid ${STATUS_COLOR[r.status] || "#999"}`,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {r.customer_name} · {r.room_name}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div style={{ fontSize: ".62rem", color: "#6a7a71", marginTop: 1 }}>외 {items.length - 3}건</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 선택 날짜 상세 */}
        {selected && (
          <div style={{ background: "#fff", border: "1px solid #dde3de", borderRadius: 8, padding: "1rem 1.1rem" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: ".75rem" }}>
              <strong>{selected} 체크인 {dayList.length}건</strong>
              <button onClick={() => setShowForm((v) => !v)} style={{ ...primaryBtn, marginLeft: "auto" }}>
                {showForm ? "닫기" : "＋ 새 예약"}
              </button>
            </div>

            {showForm && (
              <BookingForm
                date={selected}
                rooms={rooms}
                onDone={() => {
                  setShowForm(false);
                  router.refresh();
                }}
              />
            )}

            <div style={{ display: "grid", gap: ".5rem", marginTop: showForm ? "1rem" : 0 }}>
              {dayList.map((r) => (
                <div key={r.id} style={{ border: "1px solid #ebefeb", borderRadius: 6, padding: ".6rem .75rem" }}>
                  <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{r.customer_name}</span>
                    <span style={{ fontSize: ".75rem", color: STATUS_COLOR[r.status] }}>{r.status}</span>
                    <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{won(r.total_price)}원</span>
                  </div>
                  <div style={{ fontSize: ".78rem", color: "#6a7a71", marginTop: ".2rem" }}>
                    {r.room_name} · {r.check_in}~{r.check_out} · {r.guests}명 · {r.phone}
                    {r.options.length > 0 && ` · ${r.options.map((o) => o.name).join(",")}`}
                  </div>
                </div>
              ))}
              {dayList.length === 0 && !showForm && (
                <div style={{ color: "#6a7a71", fontSize: ".85rem" }}>예약 없음</div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function BookingForm({ date, rooms, onDone }) {
  const nextDay = (d) => {
    const [y, m, day] = d.split("-").map(Number);
    const n = new Date(y, m - 1, day + 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  };
  const [f, setF] = useState({
    customer_name: "",
    phone: "",
    room_name: rooms[0]?.name || "",
    check_in: date,
    check_out: nextDay(date),
    guests: 2,
    source: "naver_booking",
    status: "입금대기",
    total_price: rooms[0]?.base_price || 0,
    memo: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setErr("");
    if (!f.customer_name || !f.phone) return setErr("고객명·연락처는 필수입니다");
    setBusy(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, guests: Number(f.guests), total_price: Number(f.total_price), base_price: Number(f.total_price) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "생성 실패");
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#f9faf8", border: "1px solid #dde3de", borderRadius: 6, padding: ".9rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem" }}>
        <label style={lbl}>고객명<input style={inp} value={f.customer_name} onChange={set("customer_name")} /></label>
        <label style={lbl}>연락처<input style={inp} value={f.phone} onChange={set("phone")} placeholder="010..." /></label>
        <label style={lbl}>객실
          <select style={inp} value={f.room_name} onChange={(e) => {
            const room = rooms.find((r) => r.name === e.target.value);
            setF({ ...f, room_name: e.target.value, total_price: room?.base_price || f.total_price });
          }}>
            {rooms.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
        </label>
        <label style={lbl}>인원<input style={inp} type="number" value={f.guests} onChange={set("guests")} /></label>
        <label style={lbl}>체크인<input style={inp} type="date" value={f.check_in} onChange={set("check_in")} /></label>
        <label style={lbl}>체크아웃<input style={inp} type="date" value={f.check_out} onChange={set("check_out")} /></label>
        <label style={lbl}>금액<input style={inp} type="number" value={f.total_price} onChange={set("total_price")} /></label>
        <label style={lbl}>상태
          <select style={inp} value={f.status} onChange={set("status")}>
            <option>입금대기</option>
            <option>예약확정</option>
          </select>
        </label>
        <label style={lbl}>출처
          <select style={inp} value={f.source} onChange={set("source")}>
            <option value="naver_booking">네이버 펜션예약</option>
            <option value="naver_place">네이버 플레이스</option>
            <option value="transfer">이체예약</option>
            <option value="group">단체예약</option>
            <option value="etc">기타</option>
            <option value="막기">막기</option>
          </select>
        </label>
        <label style={{ ...lbl, gridColumn: "1 / -1" }}>메모<input style={inp} value={f.memo} onChange={set("memo")} /></label>
      </div>
      {err && <div style={{ color: "#a8422f", fontSize: ".78rem", marginTop: ".5rem" }}>{err}</div>}
      <div style={{ display: "flex", gap: ".5rem", marginTop: ".75rem" }}>
        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
          {busy ? "저장 중..." : "예약 생성"}
        </button>
        <span style={{ fontSize: ".72rem", color: "#6a7a71", alignSelf: "center" }}>
          확정 시 문자·텔레그램 발송 (막기는 알림 없음)
        </span>
      </div>
    </div>
  );
}

const navBtn = { textDecoration: "none", color: "#3d4f46", padding: ".25rem .5rem", border: "1px solid #dde3de", borderRadius: 5, background: "#fff" };
const dowCell = { padding: ".4rem", textAlign: "center", fontSize: ".72rem", fontWeight: 700, background: "#eef2ee" };
const primaryBtn = { background: "#2f6b4f", color: "#fff", border: "none", borderRadius: 5, padding: ".4rem .8rem", fontSize: ".82rem", cursor: "pointer" };
const lbl = { display: "flex", flexDirection: "column", fontSize: ".72rem", color: "#6a7a71", gap: ".2rem" };
const inp = { padding: ".4rem .5rem", border: "1px solid #dde3de", borderRadius: 5, fontSize: ".85rem", fontFamily: "inherit" };
