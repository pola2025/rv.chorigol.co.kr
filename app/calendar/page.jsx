// 예약 캘린더 — 서버 컴포넌트가 월별 예약·객실을 읽어 클라이언트에 전달.
import { listByRange } from "../../lib/reservations.js";
import { listRooms } from "../../lib/rooms.js";
import CalendarClient from "./CalendarClient.jsx";

export const dynamic = "force-dynamic";

// YYYY-MM (기본: searchParams 없으면 클라이언트가 현재월로 이동)
function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const first = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${ym}-${String(lastDay).padStart(2, "0")}`;
  return { first, last };
}

export default async function CalendarPage({ searchParams }) {
  const sp = await searchParams;
  // 기본월: 데이터가 있는 최신 또는 파라미터. Date.now 미사용(서버) → 파라미터 필수 아니면 2026-07
  const ym = sp?.month || "2026-07";
  const { first, last } = monthRange(ym);

  const [reservations, rooms] = await Promise.all([
    listByRange(first, last),
    listRooms({ activeOnly: true }),
  ]);

  return <CalendarClient ym={ym} reservations={reservations} rooms={rooms} />;
}
