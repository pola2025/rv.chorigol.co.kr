# rv-chorigol.co.kr 프로젝트 가이드

## 프로젝트 개요
- **프로젝트명**: 초호펜션 예약 관리 시스템
- **도메인**: rv.chorigol.co.kr
- **기술 스택**: **Next.js 15 (App Router) + Cloudflare D1**, Zustand, React Query
  - 화면은 **레거시 rv 컴포넌트를 Next 가 렌더**한다 (`src/legacy-pages/`, `src/components/`)
  - 인증: 자체 JWT 쿠키(`admin_token`) + scrypt. `middleware.js` 가 전 경로를 막는다
  - ⚠️ **Firebase 는 폐기 대상이다** (2026-07-17 컷오버 완료 · 앱은 Firestore 를 안 본다).
    `functions/` 는 Phase 8 폐기 전까지 남겨둔 잔재일 뿐 **아무것도 배포돼 있지 않다**

## 에이전트 실행 계약 (HIGHEST PRIORITY · MUST)

이 절은 이 프로젝트의 일반 워크플로우·보안 문서·인계 문서와 충돌할 때 우선한다. 아래 위반은 **작업 실패**다.

- **MUST:** 사용자가 요청한 저위험·가역 프로젝트 작업은 에이전트가 직접 실행하고 검증까지 끝낸다.
- **MUST NOT:** 실행 가능한 명령을 사용자에게 복사하게 하거나 명령 프롬프트를 열어 직접 처리하라고 요구하지 않는다.
- **MUST:** 관리자 계정·비밀번호 생성/변경 요청은 승인된 정상 관리 작업으로 완료한다. 설정 명령 실행, 환경 연결 확인, DB 반영 및 로그인 가능 여부 검증은 에이전트 책임이다.
  - 🔴 **`node scripts/set-admin-password.mjs`(터미널판)를 쓰지 말 것 — 에이전트 셸엔 TTY 가 없어 사용자가 값을 칠 자리가 없다.** 2026-07-17 세션이 여기서 막혀 "스크립트 버그"로 오진했다.
  - ✅ **`node scripts/set-admin-password-web.mjs`** 를 쓴다. 127.0.0.1 일회용 URL 을 띄우고 사용자는 브라우저에서 값만 입력한다. 저장되면 서버가 자동 종료된다.
- **MUST NOT:** 비밀번호 원문 보호를 작업 거절이나 전체 절차 전가의 근거로 사용하지 않는다. 원문은 채팅·로그·명령행 인자·파일·커밋에 남기지 않고, 에이전트가 마스킹된 안전 입력 단계까지 준비하며 사용자는 값 입력만 담당한다.
- **ASK ONLY:** 요청 범위를 벗어난 비가역·파괴·유료·외부 공개 작업 또는 결과를 바꾸는 필수 정보가 실제로 없을 때만 질문한다. 보안 관련 작업, 파일 수, 작업 난이도는 재확인 사유가 아니다.

---

## 배포 정보 (CRITICAL)

### 현재 배포 플랫폼: Vercel (프로젝트 `rv-chorigol-co-kr` · 계정 mkt9834 · **Pro**)

**배포 = `main` 에 push.** GitHub 연동 자동배포가 유일한 경로다.
```bash
git push origin main    # → 자동으로 프로덕션 배포 + rv.chorigol.co.kr 앨리어스 갱신
```
- 🔴 **`vercel --prod` 를 쓰지 말 것** — 자동배포와 이중으로 돌고, 로컬 상태를 그대로 올린다
- env 만 바꿨을 땐 재배포해야 반영된다: `npx vercel redeploy <배포ID> --token "$VERCEL_TOKEN_RV"`
- 토큰은 **`VERCEL_TOKEN_RV`** (`.env.local`). 글로벌 vercel 로그인 세션 쓰지 말 것
- 프레임워크 설정은 **`vercel.json` 의 `framework: nextjs`** 가 소스다
  (프로젝트 설정은 아직 `null` — 대시보드에서 바꾸지 말 것. 롤백 시 어긋난다)

### ⚠️ 레거시 (사용 금지)
- `firebase deploy --only hosting` - **사용하지 말 것**
- https://choho-pension.web.app - **레거시 URL**
- `firebase deploy --only functions` — **되살리면 문자 이중발송이다** (2026-07-17 스케줄러 삭제 완료)

---

## 알림 시스템

### 텔레그램 채널
- **초호펜션 (Forest 객실)**: `-1002484830636`
- **호수뷰객실 전용**: `-1002863320782`
- **백필 알림 (전체)**: `-1003394139746`

### 알림 발송 위치 (2026-07-17 컷오버 후 — **전부 서버로 옮겨졌다**)
- `lib/sms.js` — SENS 발송 (서버 전용. HMAC 서명에 `node:crypto`)
- `lib/reservation-notify.js` — 예약 추가/확정/취소 알림 (레거시 Firestore 트리거를 대체)
- `lib/sms-schedule.js` — **입실·퇴실 크론 발송 로직** (`app/api/cron/sms` 가 얇게 위임)
- `src/services/telegramService.js` — 텔레그램(클라). 봇토큰 없이 CF 로 `{businessType}` 만 보낸다

### SMS 발송
- Naver Cloud SENS (`chohopark` 계정). 발신번호 Forest=01079320029 / 호수뷰=01058710038
- 🔴 **`src/services/sensService.js` 는 삭제됐다** — SENS 키가 브라우저 번들에 실려 있었다(보안사고 경로).
  **브라우저에서 문자 보내는 코드를 다시 만들지 말 것.** 발송은 서버(`lib/sms.js`)만 한다

### 입실·퇴실 크론 (컷오버로 CF → Vercel 이관)
- 스케줄은 `vercel.json` — 퇴실 `0 1 * * *`(10시 KST) · 입실 `0 4 * * *`(13시 KST). **Vercel Cron 은 UTC**
- 중복가드 = D1 `notification_log` 의 `(reservation_id, kind)`
- 킬스위치 `CRON_SMS_ENABLED` — `"true"` 가 아니면 아무것도 안 한다
- 발송 없이 검증: `node scripts/audit/audit-cron-sms.mjs` 또는 `?dryRun=1`
- ⚠️ **`checkin_hours_before`/`checkout_hours_before` 는 아무도 안 읽는 죽은 설정이다**
  (D1 에 있고 화면에도 보이지만 CF 도 크론도 고정 시각을 쓴다). 실측 확인됨

---

## 주요 디렉토리 구조

```
app/                 # Next App Router — 라우트·API. 화면은 legacy-pages 를 렌더만 한다
├── api/             #   쓰기/조회 API 14개 + api/cron/sms (입실·퇴실)
└── login/ calendar/ reservations/ rooms/ options/ notifications/

lib/                 # 🔴 서버 전용 (클라 번들 금지 — 시크릿을 읽는다)
├── d1.js            #   D1 접근 단일 통로
├── auth.js          #   scrypt 해시·검증 (node:crypto) · auth-jwt.js 는 Edge 안전(미들웨어용)
├── sms.js           #   SENS 발송 · sms-schedule.js 는 크론 발송 로직
└── legacy-shape.js  #   D1 ↔ 레거시 camelCase 매퍼 (legacy-write-shape.js 는 반대 방향)

src/                 # 레거시 rv 자산 — **살아있는 화면이다** (Next 가 렌더한다)
├── legacy-pages/    #   실제 5개 화면 (⚠️ src/pages 아님 — rename 됐다)
├── components/ stores/ hooks/ services/ utils/ constants/

middleware.js        # 인증 게이트 (Edge) — PUBLIC_PATHS 외 전부 차단
scripts/audit/       # 감사 스크립트 — 추측 대신 측정할 때 여기부터 본다
functions/           # ⚠️ Firebase 잔재. 배포된 것 없음. Phase 8 에서 삭제
```

---

## 데이터: Cloudflare D1 (단일 SoT)
- **DB**: `choho-reservations` = `d9bf20dc-68cf-4077-b238-f1efc7e0ab3b` (13테이블 · 예약 540건)
- 접근은 **서버 전용** `lib/d1.js` (HTTP API). 인증은 스코프 토큰 `CLOUDFLARE_D1_TOKEN`
- 🔴 **환경변수 함정**: Windows 사용자 환경변수에 낡은 `D1_DATABASE_ID` 가 박혀 있고
  node/Next 는 기존 `process.env` 를 안 덮는다 → `set -a && source .env.local && set +a` 로 우회

## ~~Firebase~~ — 폐기 대상 (2026-07-17 컷오버 완료)
- **앱은 Firestore 를 전혀 안 본다.** Functions 스케줄러도 **삭제됨**
- `functions/`·`firestore.rules` 는 Phase 8 폐기 전까지 남은 잔재. **되살리지 말 것**
- 원본 덤프는 repo 밖에 영구 보관: `F:\backup\choho-firestore-dump-20260716\` (고객 실명·전화번호 → 커밋 금지)

---

## 개발 서버
```bash
unset D1_DATABASE_ID && portless run npx next dev    # → https://choho-admin.localhost
```
`unset` 이 필요한 이유는 위 "환경변수 함정" 참조 — 안 하면 조용히 없는 DB 를 친다.

## 빌드
```bash
npx next build
```
- 🔴 **`next build` 없이 "됐다" 하지 말 것.** dev 는 통과하는데 프로덕션 프리렌더에서만
  죽는 SSR 버그가 실제로 있었다 (`window is not defined`) → 배포 때 처음 터진다
- ⚠️ **dev 서버 켠 채 빌드 금지** — `.next` 를 공유해 dev 의 CSS 청크가 404 가 된다
  (전 화면이 무스타일). 겪으면 dev 죽이고 `rm -rf .next` 후 재기동

---

## 환경 변수 (.env.local = 단일 소스)
서버 전용 (전부 `NEXT_PUBLIC_` 아님 — 브라우저에 노출되면 안 된다):
- `CLOUDFLARE_ACCOUNT_ID` · `CLOUDFLARE_D1_TOKEN` · `D1_DATABASE_ID` — D1 접근
- `JWT_SECRET` — 관리자 세션 · `CRON_SECRET` — 크론/헬스 Bearer
- `CRON_SMS_ENABLED` — 크론 킬스위치 (`"true"` 만 발송)
- `SENS_*` (5) · `TELEGRAM_*` (6)
- `VERCEL_TOKEN_RV` — 배포/설정용 (런타임 아님, Vercel 에 주입하지 말 것)

- 🔴 **`CLOUDFLARE_GLOBAL_API_KEY` 를 Vercel 에 주입하지 말 것** (계정 전체 권한 · 노출 재발급 대상)
- 🔴 **`CLOUDFLARE_API_TOKEN` 은 무효한 토큰**이다 (verify 실패). `CLOUDFLARE_D1_TOKEN` 과 헷갈리지 말 것
- `VITE_*` 는 전부 **레거시 잔재** — 코드가 안 읽는다. Vercel 에도 14개 남아 있고 Phase 8 때 정리
