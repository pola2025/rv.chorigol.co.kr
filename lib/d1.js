// D1 데이터 접근 계층 — Cloudflare D1 HTTP API (서버 전용)
// 토큰은 서버 환경변수에서만 읽는다. 클라이언트 번들에 절대 포함 금지.
// (Phase 6에서 api.chorigol.co.kr Worker 프록시로 승격 가능)

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.D1_DATABASE_ID;
// 우선순위: 스코프 토큰(Bearer) → Global API Key(X-Auth-*)
const API_TOKEN = process.env.CLOUDFLARE_D1_TOKEN;
const GLOBAL_KEY = process.env.CLOUDFLARE_GLOBAL_API_KEY;
const EMAIL = process.env.CLOUDFLARE_EMAIL;

function authHeaders() {
  if (API_TOKEN) return { Authorization: `Bearer ${API_TOKEN}` };
  if (GLOBAL_KEY && EMAIL) return { "X-Auth-Email": EMAIL, "X-Auth-Key": GLOBAL_KEY };
  throw new Error("D1 인증 정보 없음 (CLOUDFLARE_D1_TOKEN 또는 GLOBAL_API_KEY+EMAIL 필요)");
}

/**
 * 파라미터 정규화 — **불리언을 반드시 0/1 로 바꾼다.**
 *
 * ⚠️ D1 HTTP API 는 JS `false` 를 **문자열 "false"** 로 저장한다(실측 2026-07-17).
 *    SQLite 는 동적 타입이라 INTEGER 컬럼에도 그 문자열이 그대로 들어간다 → 조용히 오염된다:
 *      · `WHERE is_active = 1` → "false" 는 안 걸려서 목록에서 빠지는데
 *      · 역매퍼 `!!r.is_active` → `!!"false"` = **true** → 화면엔 활성으로 보인다
 *    즉 "목록엔 없는데 화면엔 활성"인 유령 상태가 된다. 호출부마다 막기엔 너무 쉬운 실수라
 *    바인딩 계층 한 곳에서 정규화한다. (SQLite 엔 불리언 타입이 없다 — 0/1 이 정답)
 */
const normParams = (params) =>
  params.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v));

/**
 * D1에 파라미터 바인딩 쿼리 실행.
 * @param {string} sql  - ? 플레이스홀더 사용
 * @param {any[]} params
 * @returns {Promise<{results: any[], meta: object}>}
 */
export async function query(sql, params = []) {
  if (!ACCOUNT_ID || !DATABASE_ID) throw new Error("CLOUDFLARE_ACCOUNT_ID / D1_DATABASE_ID 미설정");
  params = normParams(params);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const json = await res.json();
  if (!json.success) {
    const msg = (json.errors || []).map((e) => e.message).join("; ") || "D1 query 실패";
    throw new Error(msg);
  }
  const r = json.result[0];
  return { results: r.results || [], meta: r.meta || {} };
}

/** 단일 행 조회 (없으면 null) */
export async function queryOne(sql, params = []) {
  const { results } = await query(sql, params);
  return results[0] || null;
}

/** 쓰기 실행 (변경 행 수 반환) */
export async function execute(sql, params = []) {
  const { meta } = await query(sql, params);
  return meta.changes ?? 0;
}
