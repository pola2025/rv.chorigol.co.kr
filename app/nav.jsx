"use client";
// 공용 상단 네비 — 레거시 MainLayout 대체.
// 로그인 화면에서는 숨긴다 (보호 페이지 링크를 눌러봐야 다시 로그인으로 튕기기만 함).
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/calendar", label: "예약 캘린더" },
  { href: "/reservations", label: "예약 목록" },
  { href: "/rooms", label: "객실 관리" },
  { href: "/options", label: "옵션 설정" },
  { href: "/notifications", label: "알림 설정" },
];

export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/login");
  }

  return (
    <header
      style={{
        borderBottom: "1px solid #dde3de",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          height: 56,
        }}
      >
        <Link
          href="/calendar"
          style={{
            fontWeight: 800,
            color: "#2f6b4f",
            textDecoration: "none",
            fontSize: "1.05rem",
          }}
        >
          초호펜션
        </Link>
        <nav style={{ display: "flex", gap: ".25rem", overflowX: "auto" }}>
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              style={{
                padding: ".5rem .8rem",
                borderRadius: 6,
                color: "#3d4f46",
                textDecoration: "none",
                fontSize: ".88rem",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          style={{
            marginLeft: "auto",
            background: "#fff",
            color: "#6a7a71",
            border: "1px solid #dde3de",
            borderRadius: 5,
            padding: ".35rem .7rem",
            fontSize: ".78rem",
            cursor: "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
