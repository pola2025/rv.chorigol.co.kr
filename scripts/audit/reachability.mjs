// 도달성 그래프 — "이 파일 살아있나?"를 눈이 아니라 **기계로** 판정한다.
//
// 왜 필요한가: 이 저장소엔 동명이인 파일이 많다(ReservationList 4종, NotificationSettings v1/v2,
// marketing/ 과 marketing-v2/ 에 같은 파일명…). grep 으로 세면 **주석 속 언급**이나
// **죽은 파일이 죽은 파일을 import** 하는 것까지 "살아있음"으로 오판한다.
// 실제로 Dashboard.jsx 는 컴포넌트 20여 개를 import 하지만 **자기 자신이 죽은 코드**였다.
//
// 방법: 진짜 진입점에서 BFS. 진입점 = Vite(index.html → src/main.jsx) + Next 규약 파일
// (app/**/page|route|layout, middleware.js). 거기서 도달 못 하면 죽은 코드다.
import fs from "node:fs";
import path from "node:path";

const ROOT = "F:/rv-chorigol.co.kr";
const EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs"];

const norm = (p) => p.replace(/\\/g, "/");
const rel = (p) => norm(path.relative(ROOT, p));

/** import 문에서 경로만 뽑는다 — 정적/동적/require/re-export 전부 */
function extractSpecs(src) {
  const specs = [];
  const push = (re) => {
    let m;
    while ((m = re.exec(src))) specs.push(m[1]);
  };
  push(/\bimport\s+[^'"();]*?\bfrom\s*['"]([^'"]+)['"]/g); // import x from '..'
  push(/\bimport\s*['"]([^'"]+)['"]/g); // import './a.css'
  push(/\bexport\s+[^'"();]*?\bfrom\s*['"]([^'"]+)['"]/g); // export {x} from '..'  ← index.js 재수출
  push(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g); // lazy(() => import('..')), await import('..')
  push(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  return specs;
}

/**
 * CSS 안의 `@import` — **JS 그래프만 보면 놓친다.**
 * 실제로 `src/index.css` 가 `@import "./styles/ui-enhancements.css"` 로 CSS 를 물고 있었고,
 * JS 만 따라간 1차 그래프가 그걸 "죽음"으로 오판해 지웠다가 빌드가 깨졌다(2026-07-16).
 * `@import "x"` / `@import url("x")` / `@import 'x'` 전부 처리.
 */
function extractCssSpecs(src) {
  const specs = [];
  const re = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) specs.push(m[1]);
  return specs;
}

/** 상대경로 → 실제 파일. 확장자 생략·index 해석 지원 */
function resolve(spec, fromFile) {
  if (!spec.startsWith(".")) return null; // 베어 스펙(react, zustand…) = node_modules
  const base = path.resolve(path.dirname(fromFile), spec);
  const cands = [
    base,
    ...EXTS.map((e) => base + e),
    ...EXTS.map((e) => path.join(base, "index" + e)),
  ];
  for (const c of cands) {
    try {
      if (fs.statSync(c).isFile()) return norm(c);
    } catch {}
  }
  return null; // 해석 실패 (깨진 import — 별도 보고)
}

// ── 진입점 ──
const entries = [];
const addIfExists = (p) => {
  const f = norm(path.resolve(ROOT, p));
  if (fs.existsSync(f)) entries.push(f);
};
addIfExists("src/main.jsx"); // Vite (index.html 이 로드)
addIfExists("middleware.js");
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(norm(p));
  }
  return out;
};
// Next 규약: app/ 의 page/route/layout 은 번들러가 자동 진입점으로 삼는다
for (const f of walk(path.resolve(ROOT, "app")))
  if (/\/(page|route|layout|not-found|error)\.(js|jsx|ts|tsx)$/.test(f)) entries.push(f);

// ── BFS ──
const seen = new Set();
const broken = [];
const queue = [...entries];
while (queue.length) {
  const f = queue.shift();
  if (seen.has(f)) continue;
  seen.add(f);
  const isCss = /\.css$/.test(f);
  if (!isCss && !/\.(js|jsx|ts|tsx|mjs)$/.test(f)) continue;
  let src;
  try {
    src = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  // CSS 는 @import 만 따라간다 (CSS → CSS 체인)
  if (isCss) {
    for (const spec of extractCssSpecs(src)) {
      const r = resolve(spec, f);
      if (r) queue.push(r);
      else if (spec.startsWith(".")) broken.push(`${rel(f)} → '${spec}' (css @import)`);
    }
    continue;
  }
  for (const spec of extractSpecs(src)) {
    const r = resolve(spec, f);
    if (r) queue.push(r);
    else if (spec.startsWith(".")) broken.push(`${rel(f)} → '${spec}'`);
  }
}

// ── src/ 전수와 대조 ──
const all = walk(path.resolve(ROOT, "src")).filter((f) =>
  /\.(js|jsx|ts|tsx|css)$/.test(f),
);
const dead = all.filter((f) => !seen.has(f)).sort();
const alive = all.filter((f) => seen.has(f)).sort();

console.log(`진입점 ${entries.length}개:`);
for (const e of entries.slice(0, 4)) console.log("  ", rel(e));
console.log(`   … app/ 규약 파일 포함 총 ${entries.length}\n`);

if (broken.length) {
  console.log(`🔴 해석 실패한 import ${broken.length}건 (깨진 경로 — 빌드 실패 원인):`);
  for (const b of new Set(broken)) console.log("  ", b);
  console.log();
}

console.log(`=== src/ 총 ${all.length}개 | 살아있음 ${alive.length} | 죽음 ${dead.length} ===\n`);
console.log("--- 살아있는 파일 (이식 대상) ---");
for (const f of alive) console.log("  ", rel(f));

const byDir = {};
for (const f of dead) (byDir[path.dirname(rel(f))] ||= []).push(path.basename(f));
console.log("\n--- 죽은 파일 (폴더별) ---");
for (const [d, fs_] of Object.entries(byDir).sort())
  console.log(`  ${d}/  (${fs_.length}) — ${fs_.join(", ")}`);

fs.writeFileSync(
  path.resolve(ROOT, "scripts/audit/.dead-files.txt"),
  dead.map(rel).join("\n") + "\n",
);
console.log(`\n죽은 파일 목록 → scripts/audit/.dead-files.txt (${dead.length}줄)`);
