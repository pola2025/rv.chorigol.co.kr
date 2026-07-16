// 옵션 설정 — D1 서버 컴포넌트. 레거시 OptionsPage 대체.
import { listOptions } from "../../lib/rooms.js";

export const dynamic = "force-dynamic";

const won = (n) => (n == null ? "-" : n.toLocaleString() + "원");

export default async function OptionsPage() {
  const options = await listOptions({ activeOnly: false });

  return (
    <main
      style={{ maxWidth: 900, margin: "0 auto", padding: "1.75rem 1.25rem" }}
    >
      <h1 style={{ fontSize: "1.4rem", marginBottom: ".25rem" }}>옵션 설정</h1>
      <p
        style={{ color: "#6a7a71", fontSize: ".85rem", margin: "0 0 1.25rem" }}
      >
        총 {options.length}개 옵션 · Cloudflare D1
      </p>

      <div style={{ display: "grid", gap: ".75rem" }}>
        {options.map((o) => (
          <div
            key={o.id}
            style={{
              background: "#fff",
              border: "1px solid #dde3de",
              borderRadius: 8,
              padding: "1rem 1.1rem",
              opacity: o.is_active ? 1 : 0.5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>
                {o.name}
                {!o.is_active && (
                  <span
                    style={{
                      color: "#a8422f",
                      fontSize: ".72rem",
                      marginLeft: ".5rem",
                    }}
                  >
                    비활성
                  </span>
                )}
              </div>
              {o.description && (
                <div
                  style={{
                    color: "#6a7a71",
                    fontSize: ".8rem",
                    marginTop: ".25rem",
                  }}
                >
                  {o.description}
                </div>
              )}
              {o.applicableRooms?.length > 0 && (
                <div
                  style={{
                    color: "#6a7a71",
                    fontSize: ".72rem",
                    marginTop: ".35rem",
                  }}
                >
                  적용 객실: {o.applicableRooms.join(", ")}
                </div>
              )}
            </div>
            <div
              style={{
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {won(o.price)}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
