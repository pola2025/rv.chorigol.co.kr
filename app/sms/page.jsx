// 광고주·운영자에게 문자 문구를 보여주는 열람 전용 페이지 (/sms).
// 관리자 로그인 없이 4자리 코드로 열리며, 보이는 건 room_templates 문구뿐이다.
// 예약·고객 데이터는 쿼리하지 않는다.
import { cookies } from "next/headers";
import { query } from "../../lib/d1.js";
import { VIEW_COOKIE, isUnlocked } from "./token.js";

export const metadata = {
  title: "초호펜션 안내문자",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const KINDS = [
  { kind: "confirmation", label: "예약확정", note: "예약이 확정될 때" },
  { kind: "checkIn", label: "입실안내", note: "입실 당일 오후 1시" },
  { kind: "checkOut", label: "퇴실안내", note: "퇴실 당일 오전 10시" },
];

const ROOM_ORDER = [
  "Forest",
  "Forest mini",
  "Forest 패밀리",
  "Forest mini 패밀리",
  "호수뷰객실",
  "야유회",
  "1박2일워크샵",
];

// 2026-07-29 추가된 문구 (하이라이트용) — 저장값과 글자 단위로 같아야 잡힌다
const ADDED = {
  "Forest 패밀리": `포레스트 패밀리
- 36개월 미만 아동 인원에는 포함(요금은 미부과)

어른5명 이용불가
어른4명 + 36개월 미만 1명 까지만 가능
`,
  "Forest mini 패밀리": `포레스트 미니패밀리

- 36개월 미만 아동 인원에는 포함(요금은 미부과)

어른3명 이용불가
어른2명 까지 사용 가능

어른2명 + 36개월 미만 1명 까지만 가능
`,
};

// lib/sms.js 가 발송 직전 지우는 이모지 (같은 정규식)
const EMOJI =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu;

/** {변수}만 배지로 감싼다 */
function withVars(text) {
  return text.split(/(\{[^}]+\})/g).map((p, i) =>
    /^\{[^}]+\}$/.test(p) ? (
      <span className="v" key={i}>
        {p}
      </span>
    ) : (
      p
    ),
  );
}

export default async function SmsPage({ searchParams }) {
  const jar = await cookies();
  if (!isUnlocked(jar.get(VIEW_COOKIE)?.value)) {
    const sp = await searchParams;
    return <Gate error={sp?.e} />;
  }

  const { results } = await query(
    `SELECT business, room_name, kind, content FROM room_templates
      WHERE kind IN ('confirmation','checkIn','checkOut')`,
  );

  const rooms = ROOM_ORDER.map((name) =>
    results.filter((r) => r.room_name === name),
  ).filter((set) => set.length);

  return (
    <div className="sv">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="wrap">
        <header className="hd">
          <p className="eyebrow">초호펜션 · 초호쉼터</p>
          <h1>고객에게 나가는 안내문자</h1>
          <p className="lede">
            객실 {rooms.length}곳에 자동 발송되는 문자 전문입니다. 노란 부분은
            이번에 추가된 인원 규정입니다.
          </p>
        </header>

        <div className="tabs">
          {KINDS.map((k, i) => (
            <input
              key={k.kind}
              type="radio"
              name="kind"
              id={`t-${k.kind}`}
              className="tabin"
              defaultChecked={i === 0}
            />
          ))}
          <nav className="tabbar" aria-label="문자 종류">
            {KINDS.map((k) => (
              <label
                key={k.kind}
                htmlFor={`t-${k.kind}`}
                className={`tab tab-${k.kind}`}
              >
                <b>{k.label}</b>
                <em>{k.note}</em>
              </label>
            ))}
          </nav>

          {KINDS.map((k) => (
            <section key={k.kind} className={`panel panel-${k.kind}`}>
              <div className="grid">
                {rooms.map((set) => {
                  const r = set.find((x) => x.kind === k.kind);
                  if (!r) return null;
                  const shelter = r.business !== "choho";
                  const added = ADDED[r.room_name];
                  const at = added ? r.content.indexOf(added) : -1;
                  EMOJI.lastIndex = 0;
                  const hasEmoji = EMOJI.test(r.content);

                  return (
                    <article
                      key={r.room_name}
                      className={`card${shelter ? " lake" : ""}`}
                    >
                      <div className="chd">
                        <h2>{r.room_name}</h2>
                        <span>{shelter ? "초호쉼터" : "초호펜션"}</span>
                      </div>
                      <div className="thread">
                        <p className="from">
                          {shelter ? "010-5871-0038" : "010-7932-0029"}
                        </p>
                        <div className="msg">
                          {at === -1 ? (
                            <span className="seg">{withVars(r.content)}</span>
                          ) : (
                            <>
                              <span className="seg">
                                {withVars(
                                  r.content.slice(0, at).replace(/\n$/, ""),
                                )}
                              </span>
                              <span className="seg add">
                                {withVars(added.replace(/\n$/, ""))}
                              </span>
                              <span className="seg">
                                {withVars(r.content.slice(at + added.length))}
                              </span>
                            </>
                          )}
                        </div>
                        {hasEmoji ? (
                          <p className="tip">
                            이모지는 발송 직전 제거되어 그 자리가 빈칸으로
                            나갑니다
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="ft">
          <p>
            <span className="v">{"{ }"}</span> 안은 예약 정보로 자동 채워집니다
            — 고객명, 일정, 인원, 금액.
          </p>
          <p>
            문구를 고치려면 예약관리 → 알림설정에서 수정하면 즉시 반영됩니다.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Gate({ error }) {
  const msg =
    error === "bad"
      ? "코드가 맞지 않습니다."
      : error === "rate"
        ? "시도가 많습니다. 15분 후 다시 시도해 주세요."
        : error === "cfg"
          ? "열람 코드가 서버에 설정되지 않았습니다."
          : null;

  return (
    <div className="sv gate">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <form className="gatebox" action="/api/sms-unlock" method="post">
        <p className="eyebrow">초호펜션 · 초호쉼터</p>
        <h1>안내문자 보기</h1>
        <p className="lede">발신번호 뒤 4자리를 입력해 주세요.</p>
        <input
          className="code"
          name="code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="0000"
          aria-label="열람 코드"
          autoFocus
        />
        {msg ? (
          <p className="err" role="alert">
            {msg}
          </p>
        ) : null}
        <button type="submit">열기</button>
      </form>
    </div>
  );
}

const CSS = `
.sv{
  --paper:#f3f6f3; --card:#ffffff; --ink:#16211c; --dim:#5e6d64; --line:#dde4de;
  --forest:#33604b; --lake:#2c5769; --mark:#b8791f; --markbg:#fbf1dc;
  min-height:100vh; background:var(--paper); color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif;
  -webkit-font-smoothing:antialiased;
}
@media (prefers-color-scheme:dark){
  .sv{ --paper:#111815; --card:#1a221e; --ink:#e7ede8; --dim:#93a29a; --line:#2a332e;
       --forest:#7cb495; --lake:#79aabe; --mark:#e2ab52; --markbg:#33291a; }
}
.sv *{box-sizing:border-box}
.sv .wrap{max-width:1240px;margin:0 auto;padding:26px 16px 56px}
.sv .eyebrow{margin:0 0 6px;font-size:11.5px;letter-spacing:.09em;color:var(--forest);font-weight:700}
.sv h1{margin:0 0 8px;font-size:25px;line-height:1.25;letter-spacing:-.02em;font-weight:800;text-wrap:balance}
.sv .lede{margin:0;font-size:13.5px;line-height:1.6;color:var(--dim);max-width:62ch}
.sv .hd{padding-bottom:18px}

.sv .tabin{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.sv .tabbar{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:repeat(3,1fr);
  gap:4px;padding:5px;margin:0 0 18px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.sv .tab{display:flex;flex-direction:column;gap:1px;align-items:center;justify-content:center;
  padding:9px 4px;border-radius:8px;cursor:pointer;text-align:center;transition:background .15s,color .15s}
.sv .tab b{font-size:13.5px;font-weight:700}
.sv .tab em{font-size:10.5px;font-style:normal;color:var(--dim)}
.sv .tab:hover{background:var(--paper)}
.sv .tabin:focus-visible + .tabbar .tab{outline:2px solid var(--forest);outline-offset:-2px}
.sv .panel{display:none}
.sv #t-confirmation:checked ~ .panel-confirmation,
.sv #t-checkIn:checked ~ .panel-checkIn,
.sv #t-checkOut:checked ~ .panel-checkOut{display:block}
.sv #t-confirmation:checked ~ .tabbar .tab-confirmation,
.sv #t-checkIn:checked ~ .tabbar .tab-checkIn,
.sv #t-checkOut:checked ~ .tabbar .tab-checkOut{background:var(--forest);color:#fff}
.sv #t-confirmation:checked ~ .tabbar .tab-confirmation em,
.sv #t-checkIn:checked ~ .tabbar .tab-checkIn em,
.sv #t-checkOut:checked ~ .tabbar .tab-checkOut em{color:rgba(255,255,255,.78)}

.sv .grid{display:grid;gap:14px}
@media (min-width:760px){ .sv .grid{grid-template-columns:repeat(2,1fr);align-items:start} }
@media (min-width:1120px){ .sv .grid{grid-template-columns:repeat(3,1fr)} }

.sv .card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.sv .chd{display:flex;align-items:baseline;justify-content:space-between;gap:8px;
  padding:11px 14px;background:var(--forest);color:#fff}
.sv .card.lake .chd{background:var(--lake)}
.sv .chd h2{margin:0;font-size:14.5px;font-weight:700;letter-spacing:-.01em}
.sv .chd span{font-size:10.5px;opacity:.8}
.sv .thread{padding:12px}
.sv .from{margin:0 0 8px;text-align:center;font-size:10.5px;color:var(--dim);
  font-variant-numeric:tabular-nums;letter-spacing:.02em}
.sv .msg{background:var(--paper);border:1px solid var(--line);border-radius:13px 13px 13px 4px;
  padding:12px 13px;font-size:13px;line-height:1.62;word-break:keep-all;overflow-wrap:anywhere}
.sv .seg{display:block;white-space:pre-wrap}
.sv .seg.add{background:var(--markbg);box-shadow:0 0 0 5px var(--markbg);border-radius:2px;
  margin:5px 0;position:relative}
.sv .v{background:var(--line);border-radius:3px;padding:0 3px;color:var(--dim);
  font-size:12px;white-space:nowrap}
.sv .tip{margin:9px 0 0;padding:6px 9px;border-left:2px solid var(--mark);
  background:var(--markbg);color:var(--mark);font-size:11px;line-height:1.45;border-radius:0 5px 5px 0}

.sv .ft{margin-top:26px;padding-top:16px;border-top:1px solid var(--line);
  color:var(--dim);font-size:12.5px;line-height:1.7}
.sv .ft p{margin:0}

.sv.gate{display:flex;align-items:center;justify-content:center;padding:24px}
.sv .gatebox{width:100%;max-width:340px;background:var(--card);border:1px solid var(--line);
  border-radius:16px;padding:26px 22px;display:flex;flex-direction:column;gap:10px}
.sv .gatebox h1{font-size:21px;margin:0}
.sv .code{margin-top:6px;padding:13px;font-size:22px;text-align:center;letter-spacing:.32em;
  font-variant-numeric:tabular-nums;border:1px solid var(--line);border-radius:10px;
  background:var(--paper);color:var(--ink)}
.sv .code:focus{outline:2px solid var(--forest);outline-offset:1px}
.sv .gatebox button{padding:12px;border:0;border-radius:10px;background:var(--forest);color:#fff;
  font-size:14.5px;font-weight:700;cursor:pointer}
.sv .gatebox button:hover{filter:brightness(1.08)}
.sv .err{margin:0;color:#c0392b;font-size:12.5px}
@media (prefers-color-scheme:dark){ .sv .err{color:#f08b7d} }
@media (prefers-reduced-motion:reduce){ .sv *{transition:none!important} }
`;
