#!/usr/bin/env node
// 관리자 비밀번호 설정 (브라우저 입력판) — 이 PC에서 직접 실행한다.
//
//   node scripts/set-admin-password-web.mjs [이메일]
//   (기본 이메일: choho140@naver.com)
//
// set-admin-password.mjs 와 하는 일이 같다. 다른 건 **입력 표면** 하나다:
// 저쪽은 터미널 TTY 로 받는데, 에이전트 셸처럼 TTY 가 없는 환경에선 아무도 값을 칠 수 없다
// (2026-07-17 세션이 정확히 여기서 막혔다). 그래서 입력만 브라우저로 옮겼다.
//
// 원문 비밀번호는 127.0.0.1 로컬 요청 본문으로만 들어와 메모리에서 해시로 바뀐다.
// 화면·로그·명령행·파일 어디에도 남지 않고, D1 에는 scrypt 해시만 저장된다.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_EMAIL = "choho140@naver.com";

// .env.local 로드 (D1 접속정보) — 값에 = 가 들어가도 안전하게 첫 = 만 분리
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  // **??= 쓰면 안 된다** — Windows 사용자 환경변수에 낡은 D1_DATABASE_ID(a10f8ed6…, 없는 DB)가
  // 박혀 있어서 기존 값이 이기면 엉뚱한 DB 를 친다. .env.local 이 이 프로젝트의 단일 소스다.
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const { hashPassword } = await import("../lib/auth.js");
const { queryOne, execute } = await import("../lib/d1.js");

const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
// 일회용 경로 토큰 — 이 URL 을 받은 사람만 제출할 수 있다
const TOKEN = randomBytes(16).toString("hex");
const MIN_LEN = 10;

const page = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>관리자 비밀번호 설정</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #f8f9fa; color: #212529;
         font-family: -apple-system, "Malgun Gothic", sans-serif; }
  .card { width: 100%; max-width: 420px; padding: 32px; background: #fff;
          border: 1px solid #e5e7eb; border-radius: 12px; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .sub { margin: 0 0 24px; color: #6b7280; font-size: 14px; }
  label { display: block; margin: 16px 0 6px; font-size: 14px; font-weight: 600; }
  input { width: 100%; padding: 11px 12px; font-size: 15px;
          border: 1px solid #d1d5db; border-radius: 8px; }
  input:focus { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
  button { width: 100%; margin-top: 24px; padding: 12px; font-size: 15px; font-weight: 600;
           color: #fff; background: #2563eb; border: 0; border-radius: 8px; cursor: pointer; }
  button:disabled { background: #9ca3af; cursor: default; }
  .hint { margin-top: 10px; color: #6b7280; font-size: 13px; }
  .msg { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: 14px; display: none; }
  .msg.err { display: block; background: #fef2f2; color: #b91c1c; }
  .msg.ok { display: block; background: #f0fdf4; color: #15803d; }
</style></head><body>
<div class="card">
  <h1>관리자 비밀번호 설정</h1>
  <p class="sub">${email}</p>
  <form id="f" autocomplete="off">
    <label for="p1">새 비밀번호</label>
    <input id="p1" type="password" autocomplete="new-password" autofocus>
    <label for="p2">한 번 더 입력</label>
    <input id="p2" type="password" autocomplete="new-password">
    <button id="b" type="submit">설정하기</button>
    <p class="hint">${MIN_LEN}자 이상. 붙여넣기(Ctrl+V)도 됩니다.</p>
  </form>
  <div id="m" class="msg"></div>
</div>
<script>
  const $ = (id) => document.getElementById(id);
  const show = (cls, text) => { $("m").className = "msg " + cls; $("m").textContent = text; };
  $("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const p1 = $("p1").value, p2 = $("p2").value;
    if (p1.length < ${MIN_LEN}) return show("err", "${MIN_LEN}자 이상이어야 합니다.");
    if (p1 !== p2) return show("err", "두 입력이 다릅니다.");
    $("b").disabled = true;
    show("ok", "저장 중…");
    try {
      const res = await fetch("/${TOKEN}/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: p1 }),
      });
      const j = await res.json();
      if (!res.ok) { $("b").disabled = false; return show("err", j.error || "실패"); }
      $("f").remove();
      show("ok", j.message + "\\n이 창을 닫으셔도 됩니다.");
    } catch (err) {
      $("b").disabled = false;
      show("err", "요청 실패: " + err.message);
    }
  });
</script>
</body></html>`;

let done = false;

const server = http.createServer(async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
  };

  // 토큰 없는 경로는 전부 거절 (같은 PC 의 다른 프로세스가 눌러도 안 열린다)
  if (req.method === "GET" && req.url === `/${TOKEN}`) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page);
  }
  if (req.method !== "POST" || req.url !== `/${TOKEN}/submit`) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("not found");
  }
  if (done) return json(409, { error: "이미 설정이 완료됐습니다." });
  if (!req.headers["content-type"]?.includes("application/json"))
    return json(415, { error: "Content-Type 오류" });

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) return json(413, { error: "입력이 너무 깁니다." });
  }

  let password;
  try {
    password = JSON.parse(body).password;
  } catch {
    return json(400, { error: "잘못된 요청 본문" });
  }
  if (typeof password !== "string" || password.length < MIN_LEN)
    return json(400, { error: `${MIN_LEN}자 이상이어야 합니다.` });

  try {
    const hash = hashPassword(password);
    const existing = await queryOne(`SELECT id FROM admins WHERE email = ?`, [email]);
    if (existing) {
      await execute(`UPDATE admins SET password_hash = ?, is_active = 1 WHERE email = ?`, [hash, email]);
    } else {
      // ⚠️ 순서 주의 — 컬럼은 (email, password_hash, …) 다. 뒤집으면 email 칸에 해시가 박히고
      //    password_hash 칸에 이메일이 들어가 로그인이 영영 안 된다 (2026-07-17 실제로 냈던 사고).
      await execute(
        `INSERT INTO admins (email, password_hash, is_active, created_at) VALUES (?, ?, 1, ?)`,
        [email, hash, new Date().toISOString()],
      );
    }
    // 저장 확인을 **응답 전에** 한다 — 확인이 실패하면 성공이라고 말하면 안 된다
    const check = await queryOne(
      `SELECT email, is_active, length(password_hash) len FROM admins WHERE email = ?`,
      [email],
    );
    if (!check) throw new Error("저장 확인 실패 — 저장 직후 행을 찾을 수 없습니다");

    done = true;
    const verb = existing ? "비밀번호가 변경되었습니다" : "관리자 계정이 생성되었습니다";
    json(200, { ok: true, message: `✅ ${verb} — ${email}` });

    console.log(`\n✅ ${verb} — ${email}`);
    console.log(`   저장 확인: ${check.email} · 활성 ${check.is_active} · 해시 ${check.len}자`);
    console.log("   (비밀번호 원문은 저장되지 않았습니다)\n");
    setTimeout(() => server.close(() => process.exit(0)), 300);
  } catch (err) {
    // err.message 에 비밀번호가 섞일 수 있는 경로가 없도록 D1/해시 오류만 그대로 노출한다
    console.error(`\n❌ 저장 실패: ${err.message}\n`);
    // 이미 200 을 보낸 뒤라면 헤더를 또 쓸 수 없다 (ERR_HTTP_HEADERS_SENT 로 프로세스가 죽는다)
    if (!res.headersSent) json(500, { error: `저장 실패: ${err.message}` });
  }
});

// 127.0.0.1 전용 — 외부 네트워크에서 접근 불가
server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  console.log(`\n관리자 비밀번호 설정 — ${email}`);
  console.log("─".repeat(46));
  console.log("아래 주소를 브라우저에서 열고 비밀번호를 입력하세요.");
  console.log("(이 PC 에서만 열립니다 · 설정되면 서버는 자동 종료)\n");
  console.log(`   http://127.0.0.1:${port}/${TOKEN}\n`);
  console.log("취소는 Ctrl+C.");
  console.log("─".repeat(46));
});
