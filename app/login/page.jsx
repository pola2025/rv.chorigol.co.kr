"use client";
// 관리자 로그인 — 레거시 LoginScreen(Firebase Auth) 대체.
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "로그인 실패");

      // 미들웨어가 붙여준 next 파라미터로 복귀 (내부 경로만 허용 — 오픈 리다이렉트 방지)
      const next = new URLSearchParams(window.location.search).get("next");
      const dest =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/calendar";
      window.location.replace(dest);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
      }}
    >
      <form onSubmit={submit} style={card}>
        <div style={{ fontWeight: 800, color: "#2f6b4f", fontSize: "1.15rem" }}>
          초호펜션
        </div>
        <div
          style={{
            color: "#6a7a71",
            fontSize: ".8rem",
            margin: ".2rem 0 1.1rem",
          }}
        >
          예약관리 시스템 · 관리자
        </div>

        <label style={lbl}>
          이메일
          <input
            style={inp}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label style={{ ...lbl, marginTop: ".6rem" }}>
          비밀번호
          <input
            style={inp}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {err && <div style={errBox}>{err}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "확인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}

const card = {
  width: "min(360px, 100%)",
  background: "#fff",
  border: "1px solid #dde3de",
  borderRadius: 10,
  padding: "1.5rem 1.4rem",
  boxShadow: "0 4px 20px rgba(0,0,0,.05)",
};
const lbl = {
  display: "flex",
  flexDirection: "column",
  fontSize: ".72rem",
  color: "#6a7a71",
  gap: ".25rem",
};
const inp = {
  padding: ".5rem .6rem",
  border: "1px solid #dde3de",
  borderRadius: 5,
  fontSize: ".9rem",
  fontFamily: "inherit",
};
const primaryBtn = {
  width: "100%",
  marginTop: "1.1rem",
  background: "#2f6b4f",
  color: "#fff",
  border: "none",
  borderRadius: 5,
  padding: ".55rem .8rem",
  fontSize: ".88rem",
  cursor: "pointer",
  fontFamily: "inherit",
};
const errBox = { color: "#a8422f", fontSize: ".78rem", marginTop: ".7rem" };
