// 예약 목록 — D1 서버 컴포넌트. Firestore ReservationsPage 대체(수직 슬라이스 검증).
import { listByStatus, statusSummary } from "../../lib/reservations.js";

export const dynamic = "force-dynamic"; // 항상 최신 D1 데이터

const won = (n) => (n || 0).toLocaleString() + "원";

export default async function ReservationsPage() {
  const [summary, confirmed] = await Promise.all([
    statusSummary(),
    listByStatus("예약확정", 50),
  ]);

  const total = summary.reduce((s, r) => s + r.c, 0);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: ".25rem" }}>예약 관리</h1>
      <p style={{ color: "#6a7a71", fontSize: ".85rem", margin: 0 }}>
        Cloudflare D1 · 총 {total}건
      </p>

      <div style={{ display: "flex", gap: ".75rem", margin: "1.25rem 0" }}>
        {summary.map((s) => (
          <div
            key={s.status}
            style={{
              background: "#fff",
              border: "1px solid #dde3de",
              borderRadius: 8,
              padding: ".75rem 1rem",
              minWidth: 130,
            }}
          >
            <div style={{ fontSize: ".72rem", color: "#6a7a71" }}>
              {s.status}
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{s.c}건</div>
            <div style={{ fontSize: ".72rem", color: "#2f6b4f" }}>
              {won(s.total)}
            </div>
          </div>
        ))}
      </div>

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
                "고객명",
                "객실",
                "체크인",
                "체크아웃",
                "인원",
                "금액",
                "옵션",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: ".6rem .75rem",
                    fontSize: ".72rem",
                    color: "#6a7a71",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {confirmed.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #ebefeb" }}>
                <td style={{ padding: ".55rem .75rem", fontWeight: 600 }}>
                  {r.customer_name}
                </td>
                <td style={{ padding: ".55rem .75rem" }}>{r.room_name}</td>
                <td style={{ padding: ".55rem .75rem" }}>{r.check_in}</td>
                <td style={{ padding: ".55rem .75rem" }}>{r.check_out}</td>
                <td style={{ padding: ".55rem .75rem" }}>{r.guests}명</td>
                <td
                  style={{
                    padding: ".55rem .75rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {won(r.total_price)}
                </td>
                <td style={{ padding: ".55rem .75rem", color: "#6a7a71" }}>
                  {r.options.length
                    ? r.options.map((o) => o.name).join(", ")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
