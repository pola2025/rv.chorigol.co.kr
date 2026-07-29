// 광고주·운영자에게 문자 문구를 보여주는 열람 전용 페이지 (/sms).
// 관리자 로그인 없이 4자리 코드로 열리며, 보이는 건 room_templates 문구뿐이다.
// 예약·고객 데이터는 쿼리하지 않는다.
import { cookies } from "next/headers";
import { query } from "../../lib/d1.js";
import { VIEW_COOKIE, isUnlocked } from "./token.js";
import CopyButton from "./CopyButton.jsx";
import { marksFor, segments, NAVER_ROOMS, NAVER_OPTIONS } from "./texts.js";

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

// lib/sms.js 가 발송 직전 지우는 이모지 (같은 정규식)
const EMOJI =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu;

/** {변수}만 배지로 감싼다 */
function withVars(text) {
  return text.split(/(\{[^}]+\})/g).map((p, i) =>
    /^\{[^}]+\}$/.test(p) ? (
      <span className="sv-v" key={i}>
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
      <div className="sv-wrap">
        <header className="sv-hd">
          <p className="sv-eyebrow">초호펜션 · 초호쉼터</p>
          <h1>고객에게 나가는 안내문자</h1>
          <p className="sv-lede">
            객실 {rooms.length}곳에 자동 발송되는 문자 전문입니다. 노란 부분은
            이번에 추가된 인원 규정입니다.
          </p>
        </header>

        <div className="sv-tabs">
          {KINDS.map((k, i) => (
            <input
              key={k.kind}
              type="radio"
              name="kind"
              id={`t-${k.kind}`}
              className="sv-tabin"
              defaultChecked={i === 0}
            />
          ))}
          <nav className="sv-tabbar" aria-label="문자 종류">
            {KINDS.map((k) => (
              <label
                key={k.kind}
                htmlFor={`t-${k.kind}`}
                className={`sv-tab sv-tab-${k.kind}`}
              >
                <b>{k.label}</b>
                <em>{k.note}</em>
              </label>
            ))}
          </nav>

          {KINDS.map((k) => (
            <section key={k.kind} className={`sv-panel sv-panel-${k.kind}`}>
              <div className="sv-grid">
                {rooms.map((set) => {
                  const r = set.find((x) => x.kind === k.kind);
                  if (!r) return null;
                  const shelter = r.business !== "choho";
                  const parts = segments(
                    r.content,
                    marksFor(r.room_name, k.kind),
                  );
                  EMOJI.lastIndex = 0;
                  const hasEmoji = EMOJI.test(r.content);

                  return (
                    <article
                      key={r.room_name}
                      className={`sv-card${shelter ? " sv-lake" : ""}`}
                    >
                      <div className="sv-chd">
                        <h2>{r.room_name}</h2>
                        <span>{shelter ? "초호쉼터" : "초호펜션"}</span>
                      </div>
                      <div className="sv-thread">
                        <p className="sv-from">
                          {shelter ? "010-5871-0038" : "010-7932-0029"}
                        </p>
                        <div className="sv-msg">
                          {parts.map((p, i) => (
                            <span
                              key={i}
                              className={p.mark ? "sv-seg sv-add" : "sv-seg"}
                            >
                              {withVars(p.text.replace(/\n+$/, ""))}
                            </span>
                          ))}
                        </div>
                        {hasEmoji ? (
                          <p className="sv-tip">
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

        <section className="sv-naver">
          <h2 className="sv-h2">
            네이버 스마트플레이스
            <span>문자와 별개로, 네이버에 직접 붙여넣는 문구입니다</span>
          </h2>

          <h3 className="sv-h3">객실정보</h3>
          <div className="sv-grid2">
            {NAVER_ROOMS.map((x) => (
              <article className="sv-npcard" key={`room-${x.room}`}>
                <div className="sv-nphd">
                  <h4>{x.room}</h4>
                  <CopyButton text={x.text} />
                </div>
                <pre className="sv-pre">{x.text}</pre>
              </article>
            ))}
          </div>

          <h3 className="sv-h3">옵션설정</h3>
          <div className="sv-grid2">
            {NAVER_OPTIONS.map((x) => (
              <article className="sv-npcard" key={`opt-${x.room}`}>
                <div className="sv-nphd">
                  <h4>{x.room}</h4>
                  <CopyButton text={x.text} />
                </div>
                <pre className="sv-pre">{x.text}</pre>
              </article>
            ))}
          </div>
        </section>

        <footer className="sv-ft">
          <p>
            <span className="sv-v">{"{ }"}</span> 안은 예약 정보로 자동
            채워집니다 — 고객명, 일정, 인원, 금액.
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
    <div className="sv sv-gate">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <form className="sv-gatebox" action="/api/sms-unlock" method="post">
        <p className="sv-eyebrow">초호펜션 · 초호쉼터</p>
        <h1>안내문자 보기</h1>
        <p className="sv-lede">발신번호 뒤 4자리를 입력해 주세요.</p>
        <input
          className="sv-code"
          name="code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="0000"
          aria-label="열람 코드"
          autoFocus
        />
        {msg ? (
          <p className="sv-err" role="alert">
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
  --forest:#33604b; --lake:#2c5769; --mark:#b8791f; --markbg:#fbf1dc; --on-accent:#ffffff;
  min-height:100vh; background:var(--paper); color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif;
  -webkit-font-smoothing:antialiased;
}
@media (prefers-color-scheme:dark){
  /* 다크에선 강조색이 밝아지므로 그 위 글자는 흰색이 아니라 어두운 색이어야 읽힌다 */
  .sv{ --paper:#111815; --card:#1a221e; --ink:#e7ede8; --dim:#93a29a; --line:#2a332e;
       --forest:#7cb495; --lake:#79aabe; --mark:#e2ab52; --markbg:#33291a; --on-accent:#0e1a15; }
}
.sv *{box-sizing:border-box}
/* theme.css:177 이 h1~h6·p·span·div 에 color 를 **직접** 박아둔다.
   상속(.sv{color}) 은 어떤 명시 선언에도 지므로, 초록 헤더 위 글자가 어두운 색으로 나왔다.
   여기서 요소 색을 되돌려 부모에게서 물려받게 만든다 — 클래스가 하나 더 있어 특이도로 이긴다. */
.sv h1,.sv h2,.sv h3,.sv h4,.sv p,.sv span,.sv div,.sv b,.sv em,.sv i,.sv label,.sv nav,
.sv section,.sv article,.sv header,.sv footer,.sv form,.sv pre{color:inherit}
.sv .sv-wrap{max-width:1240px;margin:0 auto;padding:26px 16px 56px}
.sv .sv-eyebrow{margin:0 0 6px;font-size:11.5px;letter-spacing:.09em;color:var(--forest);font-weight:700}
.sv h1{margin:0 0 8px;font-size:25px;line-height:1.25;letter-spacing:-.02em;font-weight:800;text-wrap:balance}
.sv .sv-lede{margin:0;font-size:13.5px;line-height:1.6;color:var(--dim);max-width:62ch}
.sv .sv-hd{padding-bottom:18px}

.sv .sv-tabin{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.sv .sv-tabbar{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:repeat(3,1fr);
  gap:4px;padding:5px;margin:0 0 18px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.sv .sv-tab{display:flex;flex-direction:column;gap:1px;align-items:center;justify-content:center;
  padding:9px 4px;border-radius:8px;cursor:pointer;text-align:center;transition:background .15s,color .15s}
.sv .sv-tab b{font-size:13.5px;font-weight:700}
.sv .sv-tab em{font-size:10.5px;font-style:normal;color:var(--dim)}
.sv .sv-tab:hover{background:var(--paper)}
.sv .sv-tabin:focus-visible + .sv-tabbar .sv-tab{outline:2px solid var(--forest);outline-offset:-2px}
.sv .sv-panel{display:none}
.sv #t-confirmation:checked ~ .sv-panel-confirmation,
.sv #t-checkIn:checked ~ .sv-panel-checkIn,
.sv #t-checkOut:checked ~ .sv-panel-checkOut{display:block}
.sv #t-confirmation:checked ~ .sv-tabbar .sv-tab-confirmation,
.sv #t-checkIn:checked ~ .sv-tabbar .sv-tab-checkIn,
.sv #t-checkOut:checked ~ .sv-tabbar .sv-tab-checkOut{background:var(--forest);color:var(--on-accent)}
.sv #t-confirmation:checked ~ .sv-tabbar .sv-tab-confirmation em,
.sv #t-checkIn:checked ~ .sv-tabbar .sv-tab-checkIn em,
.sv #t-checkOut:checked ~ .sv-tabbar .sv-tab-checkOut em{color:var(--on-accent);opacity:.78}

.sv .sv-grid{display:grid;gap:14px}
@media (min-width:760px){ .sv .sv-grid{grid-template-columns:repeat(2,1fr);align-items:start} }
@media (min-width:1120px){ .sv .sv-grid{grid-template-columns:repeat(3,1fr)} }

.sv .sv-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
/* 헤더는 카드와 같은 밝은 바탕에 진한 글씨 — 색 위 흰 글씨는 전역 CSS 한 줄에 무너진다.
   업체 구분은 왼쪽 색 막대가 맡는다 (초호펜션=숲 / 초호쉼터=호수). */
.sv .sv-chd{display:flex;align-items:baseline;justify-content:space-between;gap:8px;
  padding:11px 14px 10px;background:var(--card);color:var(--ink);
  border-bottom:1px solid var(--line);border-left:4px solid var(--forest)}
.sv .sv-card.sv-lake .sv-chd{border-left-color:var(--lake)}
.sv .sv-chd h2{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em;color:var(--ink)}
.sv .sv-chd span{font-size:11px;font-weight:700;color:var(--forest)}
.sv .sv-card.sv-lake .sv-chd span{color:var(--lake)}
.sv .sv-thread{padding:12px}
.sv .sv-from{margin:0 0 8px;text-align:center;font-size:10.5px;color:var(--dim);
  font-variant-numeric:tabular-nums;letter-spacing:.02em}
.sv .sv-msg{background:var(--paper);border:1px solid var(--line);border-radius:13px 13px 13px 4px;
  color:var(--ink);
  padding:12px 13px;font-size:13px;line-height:1.62;word-break:keep-all;overflow-wrap:anywhere}
.sv .sv-seg{display:block;white-space:pre-wrap}
.sv .sv-seg.sv-add{background:var(--markbg);box-shadow:0 0 0 5px var(--markbg);border-radius:2px;
  margin:5px 0;position:relative}
.sv .sv-v{background:var(--line);border-radius:3px;padding:0 3px;color:var(--ink);
  font-size:12px;white-space:nowrap}
.sv .sv-tip{margin:9px 0 0;padding:6px 9px;border-left:2px solid var(--mark);
  background:var(--markbg);color:var(--mark);font-size:11px;line-height:1.45;border-radius:0 5px 5px 0}

.sv .sv-naver{margin-top:34px;padding-top:20px;border-top:2px solid var(--line)}
.sv .sv-h2{margin:0 0 4px;font-size:17px;font-weight:800;letter-spacing:-.01em;
  display:flex;flex-wrap:wrap;align-items:baseline;gap:9px}
.sv .sv-h2 span{font-size:12px;font-weight:400;color:var(--dim)}
.sv .sv-h3{margin:18px 0 9px;font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--forest)}
.sv .sv-grid2{display:grid;gap:12px}
@media (min-width:760px){ .sv .sv-grid2{grid-template-columns:repeat(2,1fr);align-items:start} }
.sv .sv-npcard{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.sv .sv-nphd{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:9px 12px;border-bottom:1px solid var(--line);border-left:4px solid var(--forest)}
.sv .sv-nphd h4{margin:0;font-size:14px;font-weight:800;color:var(--ink)}
.sv .sv-pre{margin:0;padding:13px;font-family:inherit;font-size:12.5px;line-height:1.6;
  white-space:pre-wrap;word-break:keep-all;color:var(--ink);background:var(--paper)}
.sv .sv-cp{border:1px solid var(--forest);background:var(--forest);color:var(--on-accent);
  border-radius:7px;padding:5px 13px;font-size:12px;font-weight:700;cursor:pointer;
  font-family:inherit;white-space:nowrap}
.sv .sv-cp:hover{filter:brightness(1.1)}
.sv .sv-cp-done{background:var(--card);color:var(--forest)}
.sv .sv-cp:focus-visible{outline:2px solid var(--forest);outline-offset:2px}
.sv .sv-ft{margin-top:26px;padding-top:16px;border-top:1px solid var(--line);
  color:var(--dim);font-size:12.5px;line-height:1.7}
.sv .sv-ft p{margin:0}

.sv.sv-gate{display:flex;align-items:center;justify-content:center;padding:24px}
.sv .sv-gatebox{width:100%;max-width:340px;background:var(--card);border:1px solid var(--line);
  border-radius:16px;padding:26px 22px;display:flex;flex-direction:column;gap:10px}
.sv .sv-gatebox h1{font-size:21px;margin:0}
.sv .sv-code{margin-top:6px;padding:13px;font-size:22px;text-align:center;letter-spacing:.32em;
  font-variant-numeric:tabular-nums;border:1px solid var(--line);border-radius:10px;
  background:var(--paper);color:var(--ink)}
.sv .sv-code:focus{outline:2px solid var(--forest);outline-offset:1px}
.sv .sv-gatebox button{padding:12px;border:0;border-radius:10px;background:var(--forest);color:var(--on-accent);
  font-size:14.5px;font-weight:700;cursor:pointer}
.sv .sv-gatebox button:hover{filter:brightness(1.08)}
.sv .sv-err{margin:0;color:#c0392b;font-size:12.5px}
@media (prefers-color-scheme:dark){ .sv .sv-err{color:#f08b7d} }
@media (prefers-reduced-motion:reduce){ .sv *{transition:none!important} }
`;
