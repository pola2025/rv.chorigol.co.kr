"use client";
// 예약 편집 모달 — 수정 / 확정 / 취소. 쓰기는 전부 /api/reservations PATCH (서버가 알림 처리).
// 확정·취소는 고객에게 실제 문자·텔레그램이 나가므로 한 번 더 확인받는다.
import { useState } from "react";
import {
  REFUND_POLICY,
  daysUntilCheckIn,
  getRefundRate,
  calculateRefundAmount,
  getRefundPolicyText,
} from "../../lib/refund-policy.js";

const won = (n) => (n || 0).toLocaleString();

// 수정 가능한 필드 (status는 확정/취소 버튼으로만 바뀐다 — 실수로 알림 나가는 걸 막기 위해)
const FIELDS = [
  "customer_name",
  "phone",
  "room_name",
  "check_in",
  "check_out",
  "guests",
  "total_price",
  "source",
  "depositor_name",
  "memo",
];

async function patchReservation(body) {
  const res = await fetch("/api/reservations", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "요청 실패");
  return j;
}

export default function EditReservationModal({
  reservation: r,
  rooms,
  onClose,
  onDone,
}) {
  const [mode, setMode] = useState("edit"); // edit | confirm | cancel
  const [f, setF] = useState(() =>
    Object.fromEntries(FIELDS.map((k) => [k, r[k] ?? ""])),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = FIELDS.some((k) => String(f[k] ?? "") !== String(r[k] ?? ""));
  const isBlocked = r.source === "막기"; // 막기 예약은 서버가 알림을 스킵한다
  const canceled = r.status === "예약취소";
  const confirmed = r.status === "예약확정";
  const roomChanged = f.room_name !== r.room_name;

  async function run(body, fn) {
    setBusy(true);
    setErr("");
    try {
      await patchReservation(body);
      (fn || onDone)();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  const save = () =>
    run({
      id: r.id,
      ...f,
      guests: Number(f.guests) || 0,
      total_price: Number(f.total_price) || 0,
    });

  return (
    <>
      <div onClick={onClose} style={backdrop} />
      <div style={modal}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: ".85rem",
          }}
        >
          <strong style={{ fontSize: "1.05rem" }}>예약 상세</strong>
          <span
            style={{
              ...badge,
              marginLeft: ".5rem",
              color: STATUS_COLOR[r.status],
            }}
          >
            {r.status}
          </span>
          {isBlocked && (
            <span style={{ ...badge, marginLeft: ".35rem", color: "#6a7a71" }}>
              막기 · 알림없음
            </span>
          )}
          <button onClick={onClose} style={{ ...ghostBtn, marginLeft: "auto" }}>
            ✕
          </button>
        </div>

        {mode === "edit" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: ".5rem",
              }}
            >
              <label style={lbl}>
                고객명
                <input
                  style={inp}
                  value={f.customer_name}
                  onChange={set("customer_name")}
                />
              </label>
              <label style={lbl}>
                연락처
                <input style={inp} value={f.phone} onChange={set("phone")} />
              </label>
              <label style={lbl}>
                객실
                <select
                  style={inp}
                  value={f.room_name}
                  onChange={set("room_name")}
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.name}>
                      {room.name}
                    </option>
                  ))}
                  {!rooms.some((room) => room.name === f.room_name) && (
                    <option value={f.room_name}>{f.room_name}</option>
                  )}
                </select>
              </label>
              <label style={lbl}>
                인원
                <input
                  style={inp}
                  type="number"
                  value={f.guests}
                  onChange={set("guests")}
                />
              </label>
              <label style={lbl}>
                체크인
                <input
                  style={inp}
                  type="date"
                  value={f.check_in}
                  onChange={set("check_in")}
                />
              </label>
              <label style={lbl}>
                체크아웃
                <input
                  style={inp}
                  type="date"
                  value={f.check_out}
                  onChange={set("check_out")}
                />
              </label>
              <label style={lbl}>
                금액
                <input
                  style={inp}
                  type="number"
                  value={f.total_price}
                  onChange={set("total_price")}
                />
              </label>
              <label style={lbl}>
                입금자명
                <input
                  style={inp}
                  value={f.depositor_name}
                  onChange={set("depositor_name")}
                />
              </label>
              <label style={lbl}>
                출처
                <select style={inp} value={f.source} onChange={set("source")}>
                  <option value="naver_booking">네이버 펜션예약</option>
                  <option value="naver_place">네이버 플레이스</option>
                  <option value="transfer">이체예약</option>
                  <option value="group">단체예약</option>
                  <option value="etc">기타</option>
                  <option value="막기">막기</option>
                </select>
              </label>
              <label style={lbl}>
                메모
                <input style={inp} value={f.memo} onChange={set("memo")} />
              </label>
            </div>

            {r.options?.length > 0 && (
              <div style={{ ...hint, marginTop: ".5rem" }}>
                옵션:{" "}
                {r.options
                  .map((o) => `${o.name}${o.price ? ` ${won(o.price)}원` : ""}`)
                  .join(" · ")}
              </div>
            )}

            {roomChanged && !isBlocked && (
              <div style={warnBox}>
                객실을 바꿔 저장하면 텔레그램으로 객실변경 알림이 전송됩니다.
              </div>
            )}
            {err && <div style={errBox}>{err}</div>}

            <div
              style={{
                display: "flex",
                gap: ".4rem",
                marginTop: ".9rem",
                alignItems: "center",
              }}
            >
              <button
                onClick={save}
                disabled={busy || !dirty}
                style={{ ...primaryBtn, opacity: busy || !dirty ? 0.5 : 1 }}
              >
                {busy ? "저장 중..." : "저장"}
              </button>
              {!confirmed && !canceled && (
                <button
                  onClick={() => setMode("confirm")}
                  disabled={busy || dirty}
                  style={{ ...okBtn, opacity: busy || dirty ? 0.5 : 1 }}
                >
                  예약확정
                </button>
              )}
              {!canceled && (
                <button
                  onClick={() => setMode("cancel")}
                  disabled={busy || dirty}
                  style={{ ...dangerBtn, opacity: busy || dirty ? 0.5 : 1 }}
                >
                  예약취소
                </button>
              )}
              {dirty && !canceled && (
                <span style={hint}>
                  확정·취소하려면 변경사항을 먼저 저장하세요
                </span>
              )}
            </div>
          </>
        )}

        {mode === "confirm" && (
          <div>
            <div style={{ fontWeight: 700, marginBottom: ".5rem" }}>
              예약을 확정할까요?
            </div>
            <div style={infoBox}>
              {r.customer_name} · {r.room_name} · {r.check_in}~{r.check_out} ·{" "}
              {won(r.total_price)}원
            </div>
            {isBlocked ? (
              <div style={{ ...hint, marginTop: ".6rem" }}>
                막기 예약이라 알림은 발송되지 않습니다.
              </div>
            ) : (
              <div style={warnBox}>
                확정하면 예약확정 문자가 <strong>{r.phone}</strong> 번호로
                발송되고, 텔레그램 알림이 전송됩니다.
                <div style={{ ...hint, marginTop: ".25rem" }}>
                  알림 설정에서 꺼둔 항목은 발송되지 않습니다.
                </div>
              </div>
            )}
            {err && <div style={errBox}>{err}</div>}
            <div style={{ display: "flex", gap: ".4rem", marginTop: ".9rem" }}>
              <button
                onClick={() => run({ id: r.id, status: "예약확정" })}
                disabled={busy}
                style={{ ...okBtn, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "처리 중..." : isBlocked ? "확정" : "확정하고 발송"}
              </button>
              <button
                onClick={() => setMode("edit")}
                disabled={busy}
                style={ghostBtn}
              >
                돌아가기
              </button>
            </div>
          </div>
        )}

        {mode === "cancel" && (
          <CancelPanel
            r={r}
            busy={busy}
            err={err}
            isBlocked={isBlocked}
            onBack={() => setMode("edit")}
            onCancel={(payload) => run({ id: r.id, cancel: true, ...payload })}
          />
        )}
      </div>
    </>
  );
}

function CancelPanel({ r, busy, err, isBlocked, onBack, onCancel }) {
  const rate = getRefundRate(r.check_in);
  const autoRefund = calculateRefundAmount(r.total_price, r.check_in);
  const [manual, setManual] = useState(false);
  const [amount, setAmount] = useState(String(autoRefund));
  const [reason, setReason] = useState("");

  const refund = manual
    ? Number(String(amount).replace(/[^0-9]/g, "")) || 0
    : autoRefund;
  const fee = (r.total_price || 0) - refund;
  const finalRate = manual
    ? Math.round((refund / (r.total_price || 1)) * 100)
    : rate;

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: ".5rem" }}>예약 취소</div>
      <div style={infoBox}>
        {r.customer_name} · {r.room_name} · {r.check_in}~{r.check_out}
      </div>

      <div style={{ ...hint, margin: ".6rem 0 .35rem" }}>
        {getRefundPolicyText(r.check_in)}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: ".75rem",
          alignItems: "start",
        }}
      >
        <div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: ".72rem",
            }}
          >
            <thead>
              <tr>
                <th style={th}>취소 시점</th>
                <th style={th}>환불율</th>
              </tr>
            </thead>
            <tbody>
              {REFUND_POLICY.map((p) => {
                const cur =
                  !manual &&
                  p.daysBeforeCheckIn === daysUntilCheckIn(r.check_in);
                return (
                  <tr
                    key={p.daysBeforeCheckIn}
                    style={
                      cur
                        ? { background: "#eef2ee", fontWeight: 700 }
                        : undefined
                    }
                  >
                    <td style={td}>
                      {p.daysBeforeCheckIn === 0
                        ? "당일"
                        : `${p.daysBeforeCheckIn}일 전`}
                    </td>
                    <td style={td}>{p.refundRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <label
            style={{
              ...lbl,
              flexDirection: "row",
              alignItems: "center",
              gap: ".35rem",
              marginBottom: ".4rem",
            }}
          >
            <input
              type="checkbox"
              checked={manual}
              onChange={(e) => setManual(e.target.checked)}
            />
            환불금액 수동 지정
          </label>
          <div style={calcRow}>
            <span>결제 금액</span>
            <strong>{won(r.total_price)}원</strong>
          </div>
          <div style={calcRow}>
            <span>환불율</span>
            <strong>{finalRate}%</strong>
          </div>
          {manual && (
            <label style={{ ...lbl, marginTop: ".3rem" }}>
              환불 금액
              <input
                style={inp}
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9]/g, ""))
                }
              />
            </label>
          )}
          <div style={calcRow}>
            <span>취소 수수료</span>
            <strong style={{ color: "#a8422f" }}>-{won(fee)}원</strong>
          </div>
          <div
            style={{
              ...calcRow,
              borderTop: "1px solid #dde3de",
              paddingTop: ".3rem",
              marginTop: ".3rem",
            }}
          >
            <span>환불 예정</span>
            <strong style={{ color: "#2f6b4f" }}>{won(refund)}원</strong>
          </div>
        </div>
      </div>

      <label style={{ ...lbl, marginTop: ".6rem" }}>
        취소 사유 (선택)
        <input
          style={inp}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      {rate === 0 && !manual && (
        <div style={warnBox}>
          당일·1일 전 취소로 환불이 불가능합니다 (환불액 0원).
        </div>
      )}
      <div style={{ ...hint, marginTop: ".5rem" }}>
        {isBlocked
          ? "막기 예약이라 알림은 발송되지 않습니다."
          : "취소 문자는 발송하지 않습니다 (정책). 텔레그램 알림만 전송됩니다."}
      </div>
      {err && <div style={errBox}>{err}</div>}

      <div style={{ display: "flex", gap: ".4rem", marginTop: ".9rem" }}>
        <button
          onClick={() =>
            onCancel({
              cancel_reason: reason || null,
              refund_amount: refund,
              refund_rate: finalRate,
              cancellation_fee: fee,
            })
          }
          disabled={busy}
          style={{ ...dangerBtn, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "처리 중..." : "예약 취소 확인"}
        </button>
        <button onClick={onBack} disabled={busy} style={ghostBtn}>
          돌아가기
        </button>
      </div>
    </div>
  );
}

const STATUS_COLOR = {
  예약확정: "#2f6b4f",
  입금대기: "#8a6318",
  예약취소: "#a8422f",
};
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(30,40,35,.45)",
  zIndex: 20,
};
const modal = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%,-50%)",
  width: "min(680px, calc(100vw - 2rem))",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#fff",
  border: "1px solid #dde3de",
  borderRadius: 10,
  padding: "1.1rem 1.2rem",
  zIndex: 21,
  boxShadow: "0 10px 40px rgba(0,0,0,.18)",
};
const badge = { fontSize: ".72rem", fontWeight: 700 };
const infoBox = {
  background: "#f9faf8",
  border: "1px solid #ebefeb",
  borderRadius: 6,
  padding: ".5rem .6rem",
  fontSize: ".8rem",
};
const warnBox = {
  background: "#fdf6ee",
  border: "1px solid #e8d7bd",
  borderRadius: 6,
  padding: ".5rem .6rem",
  fontSize: ".78rem",
  color: "#7a5a1e",
  marginTop: ".6rem",
};
const calcRow = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: ".78rem",
  padding: ".15rem 0",
};
const th = {
  textAlign: "left",
  padding: ".2rem .3rem",
  background: "#eef2ee",
  fontWeight: 700,
};
const td = { padding: ".2rem .3rem", borderTop: "1px solid #ebefeb" };
const primaryBtn = {
  background: "#2f6b4f",
  color: "#fff",
  border: "none",
  borderRadius: 5,
  padding: ".4rem .8rem",
  fontSize: ".82rem",
  cursor: "pointer",
};
const okBtn = { ...primaryBtn, background: "#2f6b4f" };
const dangerBtn = { ...primaryBtn, background: "#a8422f" };
const ghostBtn = {
  background: "#fff",
  color: "#3d4f46",
  border: "1px solid #dde3de",
  borderRadius: 5,
  padding: ".4rem .8rem",
  fontSize: ".82rem",
  cursor: "pointer",
};
const lbl = {
  display: "flex",
  flexDirection: "column",
  fontSize: ".72rem",
  color: "#6a7a71",
  gap: ".2rem",
};
const inp = {
  padding: ".4rem .5rem",
  border: "1px solid #dde3de",
  borderRadius: 5,
  fontSize: ".85rem",
  fontFamily: "inherit",
};
const hint = { fontSize: ".72rem", color: "#6a7a71" };
const errBox = { color: "#a8422f", fontSize: ".78rem", marginTop: ".5rem" };
