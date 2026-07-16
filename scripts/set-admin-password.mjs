#!/usr/bin/env node
// 관리자 비밀번호 설정 — 이 PC에서 직접 실행한다.
//
//   node scripts/set-admin-password.mjs [이메일]
//   (기본 이메일: choho140@naver.com)
//
// 입력한 비밀번호는 화면에 찍히지 않고, 어디에도 저장·전송되지 않는다.
// D1에는 scrypt 해시만 들어간다 (해시로는 원문을 되돌릴 수 없음).
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_EMAIL = "choho140@naver.com";

// .env.local 로드 (D1 접속정보) — 값에 = 가 들어가도 안전하게 첫 = 만 분리
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const { hashPassword } = await import("../lib/auth.js");
const { queryOne, execute } = await import("../lib/d1.js");

/** 입력을 화면에 표시하지 않고 받는다 */
function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.stdoutMuted = true;
    rl._writeToOutput = function (s) {
      // 프롬프트만 출력하고 입력 문자는 버린다
      if (!rl.stdoutMuted || s.includes(prompt)) rl.output.write(s);
    };
    rl.question(prompt, (answer) => {
      rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();

console.log(`\n관리자 비밀번호 설정 — ${email}`);
console.log("입력은 화면에 표시되지 않습니다. 취소하려면 Ctrl+C.\n");

const pw1 = await askHidden("새 비밀번호: ");
if (pw1.length < 10) {
  console.error("\n❌ 10자 이상이어야 합니다. 아무것도 변경하지 않았습니다.");
  process.exit(1);
}
const pw2 = await askHidden("한 번 더 입력: ");
if (pw1 !== pw2) {
  console.error("\n❌ 두 입력이 다릅니다. 아무것도 변경하지 않았습니다.");
  process.exit(1);
}

const hash = hashPassword(pw1);
const existing = await queryOne(`SELECT id FROM admins WHERE email = ?`, [email]);

if (existing) {
  await execute(`UPDATE admins SET password_hash = ?, is_active = 1 WHERE email = ?`, [hash, email]);
  console.log(`\n✅ 비밀번호가 변경되었습니다 — ${email}`);
} else {
  await execute(
    `INSERT INTO admins (email, password_hash, is_active, created_at) VALUES (?, ?, 1, ?)`,
    [email, hash, new Date().toISOString()],
  );
  console.log(`\n✅ 관리자 계정이 생성되었습니다 — ${email}`);
}

const check = await queryOne(`SELECT email, is_active, length(password_hash) len FROM admins WHERE email = ?`, [email]);
console.log(`   저장 확인: ${check.email} · 활성 ${check.is_active} · 해시 ${check.len}자`);
console.log("   (비밀번호 원문은 저장되지 않았습니다)\n");
