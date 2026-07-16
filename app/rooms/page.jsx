// 객실 관리 — D1 서버 컴포넌트. 레거시 RoomsPage 대체.
import { listRooms } from "../../lib/rooms.js";

export const dynamic = "force-dynamic";

const won = (n) => (n == null ? "-" : n.toLocaleString() + "원");
const BIZ = { choho: "초호펜션", shelter: "초호쉼터" };

export default async function RoomsPage() {
  const rooms = await listRooms({ activeOnly: false });

  return (
    <main
      style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.25rem" }}
    >
      <h1 style={{ fontSize: "1.4rem", marginBottom: ".25rem" }}>객실 관리</h1>
      <p
        style={{ color: "#6a7a71", fontSize: ".85rem", margin: "0 0 1.25rem" }}
      >
        총 {rooms.length}개 객실 · Cloudflare D1
      </p>

      <div
        style={{
          overflowX: "auto",
          border: "1px solid #dde3de",
          borderRadius: 8,
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            fontSize: ".85rem",
            background: "#fff",
          }}
        >
          <thead>
            <tr style={{ background: "#eef2ee", textAlign: "left" }}>
              {[
                "객실명",
                "업체",
                "기본요금",
                "주중",
                "주말",
                "기준/최대",
                "추가인원",
                "재고",
                "상태",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: ".6rem .75rem",
                    fontSize: ".72rem",
                    color: "#6a7a71",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr
                key={r.id}
                style={{
                  borderTop: "1px solid #ebefeb",
                  opacity: r.is_active ? 1 : 0.5,
                }}
              >
                <td style={{ padding: ".55rem .75rem", fontWeight: 600 }}>
                  {r.name}
                </td>
                <td style={{ padding: ".55rem .75rem" }}>
                  <span
                    style={{
                      fontSize: ".72rem",
                      padding: ".1rem .45rem",
                      borderRadius: 4,
                      background:
                        r.business === "choho" ? "#e6efe9" : "#f7eedc",
                      color: r.business === "choho" ? "#2f6b4f" : "#8a6318",
                    }}
                  >
                    {BIZ[r.business] || r.business}
                  </span>
                </td>
                <td
                  style={{
                    padding: ".55rem .75rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {won(r.base_price)}
                </td>
                <td
                  style={{
                    padding: ".55rem .75rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {won(r.weekday_price)}
                </td>
                <td
                  style={{
                    padding: ".55rem .75rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {won(r.weekend_price)}
                </td>
                <td style={{ padding: ".55rem .75rem" }}>
                  {r.base_guests}/{r.max_guests}명
                </td>
                <td
                  style={{
                    padding: ".55rem .75rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {won(r.extra_guest_fee)}
                </td>
                <td style={{ padding: ".55rem .75rem" }}>{r.stock}</td>
                <td
                  style={{
                    padding: ".55rem .75rem",
                    color: r.is_active ? "#2f6b4f" : "#a8422f",
                  }}
                >
                  {r.is_active ? "운영" : "비활성"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
