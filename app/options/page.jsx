// 옵션 설정 — D1 서버 컴포넌트. 레거시 OptionsPage 대체.
import { listOptions } from "../../lib/rooms.js";

export const dynamic = "force-dynamic";

const won = (n) => (n == null ? "-" : n.toLocaleString() + "원");

// applicableRooms = 적용 모드 (객실 배열이 아니다)
const APPLY_MODE = {
  all: "모든 객실",
  selected: "선택한 객실",
  individual: "객실별 개별 설정",
  shared: "공동 재고 관리",
};

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
              {/* applicableRooms 는 모드 문자열, 실제 목록은 selectedRooms */}
              {(o.applicableRooms || o.selectedRooms?.length > 0) && (
                <div
                  style={{
                    color: "#6a7a71",
                    fontSize: ".72rem",
                    marginTop: ".35rem",
                  }}
                >
                  적용 객실: {APPLY_MODE[o.applicableRooms] ?? "전체"}
                  {o.selectedRooms?.length > 0 &&
                    ` · ${o.selectedRooms.join(", ")}`}
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
