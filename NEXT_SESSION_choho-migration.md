# 초호펜션 예약관리시스템 — Firebase·Airtable → Vercel + Cloudflare D1 마이그레이션

> 세션 핸드오프 · 최종 갱신 2026-07-16

## 복사용 요청문
```
초호펜션 예약시스템 Firebase→Vercel+D1 이관 중. Phase 0~4 완료 + Phase3 화면 5/5 완료.
다음: 예약 편집UI(캘린더 수정/확정/취소 모달) → 인증(Phase5).
F:\rv-chorigol.co.kr\NEXT_SESSION_choho-migration.md 전체 컨텍스트. 브랜치 migrate/nextjs-d1.
테스트: 문자는 01098979834로만, 예약 알림봇 실채널 발송금지, 한글 payload curl금지(node).
```

**계획서**: https://claude.ai/code/artifact/84c4a8c2-5770-4966-9404-aa70a3b82164
**브랜치**: `migrate/nextjs-d1` (라이브 Vite 앱은 `main`, 무영향)

## 한눈에 보는 진행률

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 계정·SSH·DNS(Cloudflare)·admin 도메인 | ✅ |
| 1 | D1 생성 + 스키마 13테이블 | ✅ |
| 2 | 데이터 2,067건 전량 이관 + 검증 + 시크릿 env 분리 | ✅ |
| 3 | Next.js 15 + 화면 이식 **5/5** (캘린더·예약목록·객실·옵션·알림설정) | ✅ |
| 4 | 쓰기 API + 알림 통합 (트리거 대체) | ✅ |
| — | 인프라봇 헬스체크 분리 | ✅ |
| 5 | 인증 (Firebase Auth → JWT 쿠키) | ⬜ |
| 6 | api.chorigol.co.kr Worker 보안 | ⬜ |
| 7 | 컷오버 (rv CNAME) → 병렬운영 2주 | ⬜ |
| 8 | Firebase·Airtable 폐기 | ⬜ |

**운영은 100% 기존 Firebase에서 가동 중.** 신규 스택(D1/Next)은 아직 아무도 안 씀.

## 다음 세션 첫 액션
1. **예약 편집 UI** — 캘린더에 수정/확정/취소 모달 (API PATCH는 이미 준비됨).
   확정 버튼 → PATCH status=예약확정 (→ 문자+텔레그램), 취소 버튼 → cancel (→ 텔레그램만)
2. **Phase 5 인증** — Firebase Auth → JWT admin_token 쿠키
3. 조회 계층 잔여: customers, inventory_overrides, marketing_stats, pricing

## ⚠️ 정리 필요 (사소)
- **`NEXT_SESSION_REQUEST.md`** (untracked): 2026-03-02 Firebase 시절 문서. 내용이 낡아
  새 세션이 이 파일을 먼저 읽고 혼동함. 삭제 권장 — 현행 핸드오프는 이 파일 하나.
- 루트에 수정된 레거시 Vite 파일 12개(`src/`, `functions/src/index.js`)가 커밋 안 된 채 방치.
  이관과 무관한 예전 작업물 — 정체 확인 후 커밋하거나 되돌릴 것.

---

## 오늘 세션 요약 (2026-07-16)

원래 "문자 자동발송이 왜 안되나"로 시작 → **문자는 정상 발송 중이었고, 콘솔을 다른 SENS 계정으로 보고 있었음**을
밝혀냄. 진짜 버그는 따로 있었고(예약확정 문자 템플릿 깨짐) 수정·배포 완료. 이후 인프라 개편으로 확장.

### A. 문자 버그 (해결 완료 · 커밋됨 `9ece739`)
- **증상**: 예약확정 문자가 `{고객명}님, 예약이 확정되었습니다` 처럼 변수 미치환 상태로 발송됨 (2026-03-02 트리거 배포 이후 ~116건)
- **원인**: `functions/src/reservationTriggers.js`가 영문 변수(`{customerName}`)로 치환 시도. 실제 템플릿은 전부 **한글 변수**(`{고객명}`, `{체크인}`, `{인원}`, `{금액}`, `{주소}`)
- **수정**: `reservationTriggers.js`에 `applyTemplateVars()` 추가 (한글 치환 + 미치환 검사). 배포 완료
- **주소 통일**: `smsScheduler.js`의 입실안내 주소 `138-17` → `경기도 파주시 법원읍 초리골길 134` 수정·배포 완료
- **김태연님**: 정상 문자 재발송 완료 (7/17 체크인 Forest)
- ✅ 커밋 확인됨 (`9ece739`) — 이전 핸드오프의 "커밋 필요" 메모는 해소됨

### B. SENS 계정 혼선 (해결 — 착오였음)
- 앱은 `ncp:sms:kr:358452632058:chohopark` 사용 (정상 발송 중)
- 사장님이 처음 본 콘솔은 `ncp:sms:kr:267034679194:choho` (다른 계정) → 그래서 내역이 없어 보였음
- **결정: chohopark 유지. 코드 변경 없음.** 발신번호 Forest=01079320029 / 호수뷰=01058710038

### C. 결정된 사항
1. SENS: `chohopark` 유지 (변경 없음)
2. 취소 문자: **의도적으로 안 보냄** (텔레그램만). 마이그레이션에도 발송 코드 추가 안 함
3. 도메인 대상: **`chorigol.co.kr` 하나** (`choho.co.kr`은 타사 소유 — Cafe24, 범위 제외)
4. Firebase 폐기: 검증 완료 + 최소 2주 보존 후

### D. 미결 확인 필요
- **초호쉼터(호수뷰객실) 실제 주소** — 현재 `smsScheduler.js`는 전 객실 공통 `134`. 비활성 코드에 초호쉼터용 `138-20` 잔존. 호수뷰 예약 잡히기 전 확정 필요 (7/17~20 체크인은 전부 Forest라 급하진 않음)
- 노출된 키 재발급: Cloudflare Global API Key, Gmail refresh token (채팅 평문 노출)

---

## 보안 점검 결과 (실측, 계획서 03절)

| 항목 | 위치 | 상태 |
|---|---|---|
| 공개 함수 인증 부재 | sendTelegram, sendSENSSMS, testTelegramConnection, checkIPBlock | 위험 — 누구나 POST로 텔레그램/문자 발송 가능 |
| CORS `*` | setCorsHeaders | 위험 |
| 시크릿 body 수신 + 로그 평문 | sendSENSSMS (`console.log(request.body)`) | 위험 |
| Airtable 키 클라이언트 노출 경로 | VITE_AIRTABLE_API_KEY | 주의 (현 배포본엔 트리셰이킹으로 빠짐) |
| 관리자 이메일 하드코딩 | firestore.rules 9-12행 | 주의 |
| **Firestore 규칙** | firestore.rules | **안전** — isAdmin() + 기본거부 있음 |

→ 3-tier(`api.` / `admin.` / `rv.`)로 구조적 해결 예정

---

## 인프라 사전작업 (완료)

### 계정
- **Vercel**: `chohopark/chohopark` (team_dRQbvedrBJ4kxHtMAg59xpZo, chohopark134@gmail.com). 프로젝트 비어있음
- **GitHub**: `chohopark134-ctrl/chohopark` (SSH 인증 확인됨: `Hi chohopark134-ctrl!`)
- **Cloudflare**: account 2ea720244c6ecbcd6c33292bfcf05087
- 모든 키: `.env.local` (gitignore 적용 확인). **Global API Key는 X-Auth-Email + X-Auth-Key 헤더로 사용** (Bearer 아님)

### SSH
- 키: `~/.ssh/id_ed25519_chohopark`
- config: `Host github.com-chohopark` → `git@github.com-chohopark:chohopark134-ctrl/chohopark.git`

### DNS (Cloudflare로 이전 완료)
- NS: `donald.ns.cloudflare.com`, `poppy.ns.cloudflare.com` — **전파 완료, 존 active**
- zone_id: `f872a5b1e99b41bc5af303a8b57bdeac`
- 레코드 (전부 DNS-only / proxied=false):
  - `chorigol.co.kr` A 216.150.1.1
  - `www` CNAME 15a8398f15498751.vercel-dns-016.com
  - `rv` CNAME 112b9bbbabb2c41e.vercel-dns-016.com (구 Vercel 계정 — 컷오버 시 소유권 이전 필요)
  - `admin` CNAME cname.vercel-dns.com → **Vercel 연결 완료 (misconfigured:false)**. 단 앱은 아직 없음
  - `_vercel` TXT (소유권 인증), `chorigol.co.kr` TXT (google 인증)
- **주의**: `chorigol.co.kr`이 구 Vercel 계정 소유. `rv` 컷오버 시 구 계정에서 도메인 떼고 새 계정에 붙이는 타이밍 필요

---

## Phase 1 완료 — D1 스키마

- **D1**: `choho-reservations`, uuid `d9bf20dc-68cf-4077-b238-f1efc7e0ab3b`
- **스키마 파일**: `d1/0001_initial_schema.sql` (프로젝트 저장됨)
- **테이블 12개**: reservations, reservation_options, notification_log, rooms, customers, options, pricing_rules, inventory_overrides, sms_config, room_templates, admins, login_attempts
- 정규화: 한글컬럼→영문, phone/customerPhone·guests/guestCount 통합, smsStatus/notificationStatus MAP→notification_log, business 컬럼, settings→sms_config+room_templates

### D1 쿼리 방법 (참고)
```bash
set -a && source .env.local && set +a
CF=(-H "X-Auth-Email: $CLOUDFLARE_EMAIL" -H "X-Auth-Key: $CLOUDFLARE_GLOBAL_API_KEY" -H "Content-Type: application/json")
curl -s "${CF[@]}" -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/d9bf20dc-68cf-4077-b238-f1efc7e0ab3b/query" \
  --data '{"sql":"SELECT ..."}'
```
※ 한글이 들어가는 쿼리는 curl 금지 (Windows 콘솔 UTF-8 깨짐) → node로 `lib/d1.js` import

---

## Firestore 원본 (이관 대상, 2,084건)
| 컬렉션 | 건수 | → D1 |
|---|---|---|
| reservations | 540 | reservations + reservation_options |
| customers | 402 | customers |
| notification_logs | 819 | notification_log |
| sms_logs | 267 | notification_log |
| inventory_overrides | 26 | inventory_overrides |
| settings | 7 | sms_config + room_templates |
| rooms | 7 | rooms |
| options | 4 | options |
| pricing_rules | 4 | pricing_rules |
| marketing_stats_v2 | 4 | marketing_stats (이관 완료) |
| message_templates | 2 | room_templates (레거시, 확인) |
| login_attempts | 2 | login_attempts |

Firestore 접근: firebase-tools refresh_token (`C:/Users/flame/.config/configstore/firebase-tools.json`) → OAuth → REST API. 계정 mkt9834@gmail.com (프로젝트 소유자)

---

## Phase 2 완료 — 데이터 이관 (2026-07-16)

### 결정됨
- **시크릿: 환경변수 분리** (D1 미저장). `.env.local`에 `SENS_*`, `TELEGRAM_*` 블록 추가됨
- **로그: 통계조회용으로 이관** (notification_log 1,086건)

### 이관 결과 (검증 통과 — 금액 합계 1원도 안 틀림)
| D1 테이블 | 건수 |
|---|---|
| reservations | 540 (금액합계 98,105,000원 일치) |
| reservation_options | 366 |
| notification_log | 1086 (notification_logs 819 + sms_logs 267) |
| customers | 402 |
| rooms | 7 (choho 4 / shelter 3) |
| options | 4 |
| pricing_rules | 4 |
| inventory_overrides | 26 |
| room_templates | 28 |
| sms_config | 2 (발신번호·채널ID만, 시크릿 컬럼 NULL 확인됨) |
| marketing_stats | 4 |
- **Firestore 12컬렉션 전량 이관 완료**
- 덤프 위치(임시): `scratchpad/dump/*.json` (세션 종료 시 삭제됨 — 재덤프는 `dump-all.mjs`)
- 로더 스크립트: `scratchpad/load-core.mjs`, `load-logs.mjs`, `extract-secrets.mjs`, `verify-migration.mjs`

### 시크릿 (.env.local, D1 미저장)
- SENS: choho/shelter **동일 계정 chohopark**, 발신번호만 다름 (choho 01079320029 / shelter 01058710038)
- 텔레그램 봇토큰 양쪽 동일, chatId만 다름 (choho -1002484830636 / shelter -1002863320782)
- `.env.local`은 gitignore 적용됨. Vercel/Worker에도 동일 env 주입 필요 (컷오버 전)

---

## Phase 3 완료 — Next.js + D1 화면 이식 5/5 (브랜치: migrate/nextjs-d1)

### 프로젝트 경로 정리 (중요 — 혼동 주의)
- **F:\rv-chorigol.co.kr** = 예약시스템 (이식 대상, 지금 여기). Next.js 앱을 **이 repo 안에** 신규 구축
- **F:\choho_2025** = 초호펜션 공개 홈페이지 (Next.js+D1, 구 계정 pola2025/choho). 무관
- **F:\chohopark** = 별개 .net 브랜드사이트. **무관 — 건드리지 말 것**
- admin = 기존 경로 없음 → 이 repo에서 신규 생성. admin.chorigol.co.kr (새 계정 chohopark134에 연결됨)
- 라이브 Vite 앱은 main 브랜치 유지. Next.js 작업은 migrate/nextjs-d1 브랜치에 격리

### 완료 화면 (전부 D1 서버컴포넌트, 빌드+실데이터 렌더 HTTP 200 검증)
- `app/calendar` — 월 그리드 + 날짜별 예약 + **신규예약 생성**(fetch→/api/reservations). CalendarClient.jsx + BookingForm
- `app/reservations` — 예약목록 + 상태요약
- `app/rooms` — 객실관리 (업체/요금/재고)
- `app/options` — 옵션설정
- `app/notifications` — **알림설정** (아래 상세)
- `app/nav.jsx` 공용네비 (layout 적용), `app/page.jsx` / → /calendar 리다이렉트

### 알림 설정 화면 (2026-07-16 완료, 커밋 `a3e82e1`)
- `app/notifications/page.jsx` + `NotificationsClient.jsx` — 업체 발신설정 2 + 객실별 템플릿 7
- `app/api/notifications/route.js` — PATCH `template` | `roomFlags` | `smsConfig`
- `lib/notifications.js` — listSmsConfigs/listTemplates/updateTemplateContent/setRoomFlags/updateSmsConfig 추가

**설계 결정 3가지 (다음 세션이 알아야 할 것):**
1. **`lib/template-vars.js` 신규 분리** — 치환 로직만 떼어낸 순수 모듈(D1 의존 0).
   발송부와 편집화면이 **같은 renderTemplate()** 을 써야 미리보기가 의미 있는데,
   `notifications.js`는 `d1.js`를 물고 있어 클라이언트 번들에 못 넣는다. 그래서 분리.
   `TEMPLATE_VARS`도 치환 맵에서 파생 → 지원변수 목록이 두 벌이 될 수 없음.
   기존 import(`from "./notifications.js"`)는 재수출로 그대로 동작 — reservation-notify.js 무수정.
2. **저장 시점 미지원 변수 차단** (`findUnknownVars`) — 3월 사고는 **발송 시점** 검사만 있어
   4개월간 안 잡혔다. 편집 시점에 막으면 애초에 DB에 안 들어간다. UI도 미리보기에 즉시 경고.
3. **객실 플래그는 4개 kind 행에 함께 적용** — 플래그(enabled/confirmation_enabled/
   checkin_enabled/checkout_enabled)는 의미상 **객실 단위**인데 이관 때 kind 행마다 복제됐다
   (28행 전부 값 일치 확인). 행별로 따로 쓰면 발송부가 읽는 confirmation 행만 우연히 맞는
   상태가 되므로 `setRoomFlags`가 4행을 함께 갱신. UI는 confirmation 행 값을 기준 표시.

**⚠️ 미이관 — 입실·퇴실 안내 스케줄러**: `checkin_enabled`/`checkout_enabled` 플래그는 저장되지만
신규 스택엔 스케줄러가 없어 **아직 아무 동작도 안 한다** (레거시 `functions/src/smsScheduler.js`가
Firestore 보고 발송 중). 화면에 그렇게 명시해둠. 컷오버 전 이관 필요.

**검증**: 쓰기 API 21건 통과(검증·차단·정규화·복구) → D1 원상복구 확인(28행 유지) /
클라 번들 D1토큰·CF흔적 0(grep) / 브라우저 `{customerName}` 입력 → 미리보기 경고 + 서버 400 + D1 미변경

### 기타 완료
- **Next.js 15 도입** (React 19 호환. Next 14는 React19 미지원). `app/` App Router, Vite `src/`와 공존
- **src/pages → src/legacy-pages 이름변경**: Next가 레거시를 Pages Router로 오인하는 문제 해결
- `next.config.mjs`: eslint.ignoreDuringBuilds (Vite eslint가 Next 서버코드와 충돌 — 컷오버 시 교체)

## Phase 4 완료 — 예약 쓰기 API + 알림 통합 (트리거 대체)

- `app/api/reservations/route.js`: POST(생성)/PATCH(수정·취소)/GET. 상태전환·객실변경 감지 → 알림
- `lib/reservations.js`: create/update/cancel/delete + Firestore스타일 ID + 옵션 replace
- `lib/reservation-notify.js`: 알림 오케스트레이션 (막기 스킵, 취소는 텔레그램만, 미치환 차단, notification_log 기록)
- `lib/sms.js`(SENS, env시크릿) / `lib/telegram.js`(env봇토큰, 업체별채널) / `lib/messages.js`(TG 포맷터)
- 검증: CRUD·SMS실발송(테스트번호)·봇토큰·막기스킵 전부 통과. D1 원상복구(540건)

### 발송 게이트 (헷갈리기 쉬움 — 정리)
| 무엇 | 게이트 |
|---|---|
| 신규·확정 **텔레그램** | `sms_config.use_reservation` |
| 취소 **텔레그램** | `sms_config.use_cancellation` |
| 확정 **문자(SMS)** | `room_templates.enabled` **AND** `confirmation_enabled` (confirmation 행) |
| 입실·퇴실 문자 | `checkin_enabled`/`checkout_enabled` — **신규 스택 미동작** (스케줄러 미이관) |
| 취소 문자 | 없음 — **의도적 미발송** (정책) |
| 막기(`source="막기"`) | 전부 스킵 |

## 텔레그램 봇 2개 — 용도 분리

| 봇 | 용도 | chat_id | 토큰 env |
|---|---|---|---|
| 예약 알림봇 `@mkt251102_bot` | 고객/스태프 예약 알림 (신규·확정·취소·객실변경) | choho `-1002484830636` / shelter `-1002863320782` | TELEGRAM_BOT_TOKEN_CHOHO / _SHELTER |
| **인프라봇** `@bas263thBot` | **헬스체크 전용** (문자발송 성공여부, 예약체크) | `-1004487628453` | TELEGRAM_INFRA_BOT_TOKEN / TELEGRAM_INFRA_CHAT_ID |

- `lib/infra-alert.js`: infraAlert(route, text) — 첫줄 네임태그 `[rv-chorigol/route]` 필수
  - `reportSmsResult` — 문자발송 성공/실패+reqId. **미치환 변수 발송차단 시 즉시 경보** (reservation-notify에 연결됨)
  - `reportReservationCheck` — DB·오늘입퇴실·24h문자집계
- `app/api/health` — 헬스체크 API. **CRON_SECRET Bearer 인증 필수** (무인증 401 확인됨). Vercel Cron 연결 예정
- ⚠️ **슈퍼그룹 chat_id는 `-100` 프리픽스 필요**. web.telegram URL(#-4487628453)은 축약형 → 실제 `-1004487628453`. getChat으로 검증할 것

### ⚠️ 테스트 규칙 (중요)
- **테스트 문자는 01098979834 번호로만** (사용자 지정)
- **실제 텔레그램 채널로 테스트 발송 금지** — 봇토큰 getMe로 유효성만 확인. 스팸되면 deleteMessage로 삭제
- **한글 payload는 curl 금지** (Windows 콘솔 UTF-8 깨짐 → source="막기" 깨져 스킵 실패한 사고). node로 테스트
- **D1 쓰기 테스트는 원본 캡처 → 테스트 → 복구 → 복구검증** 순으로 (운영 데이터임)

### ⚠️ 편집 규칙 (2026-07-16 사고)
- **한글 포함 파일은 Write 도구만 사용.** Edit로 `lib/notifications.js` 수정 중 파일이 0바이트로
  잘림 (git에 있어 `git checkout --`로 복구). CLAUDE.md 규칙대로 Write 쓸 것

### lib/ 계층 현황
- `d1.js` — HTTP API 클라이언트, 파라미터 바인딩, **서버 전용** (토큰 클라 노출 0)
  - 인증 우선순위: CLOUDFLARE_D1_TOKEN(Bearer) → GLOBAL_API_KEY+EMAIL(X-Auth)
  - 스코프 토큰 발급되면 `.env.local`에 `CLOUDFLARE_D1_TOKEN=` 추가만 하면 자동 전환
- `template-vars.js` — **순수 모듈(D1 의존 0)**. renderTemplate/TEMPLATE_VARS/findUnknownVars.
  서버·클라 공용. 여기가 지원변수 단일 소스
- `reservations.js` — 조회(listByCheckIn/listByRange/listByStatus/getById/statusSummary) + 쓰기(create/update/cancel/delete)
  - 옵션 join은 IN 절 청크(90개)로 D1 변수한도(100) 회피
- `rooms.js`(listRooms/getRoomByName/businessOf/listOptions)
- `notifications.js` — 설정·템플릿 조회/쓰기 + template-vars 재수출
- `sms.js`, `telegram.js`, `messages.js`, `reservation-notify.js`, `infra-alert.js`
- `app/api/`: reservations(POST/PATCH/GET), notifications(PATCH), health(GET)

### 로컬 실행/빌드
- 빌드: `set -a && source .env.local && set +a && npx next build`
- 실행: `PORT=3900 npx next start` (또는 next dev)
- 정리: Git Bash에 `pkill` 없음 → PowerShell
  `Get-NetTCPConnection -LocalPort 3900 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`
- eslint는 빌드 중 비활성(next.config.mjs) — Vite eslint와 충돌. 컷오버 시 교체

## 이후 Phase (계획서 참조)
- Phase 5: Firebase Auth → JWT admin_token 쿠키
- Phase 6: api.chorigol.co.kr Worker 7-Layer 보안
- Phase 7: 검증 + 컷오버 (심야, rv CNAME 교체, Firebase 2주 보존)
- Phase 8: Firebase·Airtable 폐기
- 잔여: 입실·퇴실 스케줄러 이관, Vite→Next 완전 전환 후 Vite 스크립트/의존성 제거
