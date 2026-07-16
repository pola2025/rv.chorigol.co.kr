# 초호펜션 예약관리시스템 — Firebase → Vercel + Cloudflare D1 마이그레이션

> 세션 핸드오프 · 2026-07-16 작성

## 복사용 요청문
```
초호펜션 예약관리시스템 마이그레이션 진행 중. Phase 1(D1 스키마) 완료, Phase 2(데이터 이관) 진행 중.
NEXT_SESSION_choho-migration.md 에 전체 컨텍스트. 계획서: 아래 아티팩트 링크.
```

계획서 아티팩트: https://claude.ai/code/artifact/84c4a8c2-5770-4966-9404-aa70a3b82164

---

## 오늘 세션 요약 (2026-07-16)

원래 "문자 자동발송이 왜 안되나"로 시작 → **문자는 정상 발송 중이었고, 콘솔을 다른 SENS 계정으로 보고 있었음**을
밝혀냄. 진짜 버그는 따로 있었고(예약확정 문자 템플릿 깨짐) 수정·배포 완료. 이후 인프라 개편으로 확장.

### A. 문자 버그 (해결 완료)
- **증상**: 예약확정 문자가 `{고객명}님, 예약이 확정되었습니다` 처럼 변수 미치환 상태로 발송됨 (2026-03-02 트리거 배포 이후 ~116건)
- **원인**: `functions/src/reservationTriggers.js`가 영문 변수(`{customerName}`)로 치환 시도. 실제 템플릿은 전부 **한글 변수**(`{고객명}`, `{체크인}`, `{인원}`, `{금액}`, `{주소}`)
- **수정**: `reservationTriggers.js`에 `applyTemplateVars()` 추가 (한글 치환 + 미치환 검사). 배포 완료
- **주소 통일**: `smsScheduler.js`의 입실안내 주소 `138-17` → `경기도 파주시 법원읍 초리골길 134` 수정·배포 완료
- **김태연님**: 정상 문자 재발송 완료 (7/17 체크인 Forest)
- 커밋 안 함 (working tree에 수정만 존재) — **커밋 필요**

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
| marketing_stats_v2 | 4 | (보류 — 마케팅 통계, 우선순위 낮음) |
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
- **marketing_stats_v2 4건**: 우선순위 낮아 보류 (마케팅 통계, 필요 시 이관)
- 덤프 위치(임시): `scratchpad/dump/*.json` (세션 종료 시 삭제됨 — 재덤프는 `dump-all.mjs`)
- 로더 스크립트: `scratchpad/load-core.mjs`, `load-logs.mjs`, `extract-secrets.mjs`, `verify-migration.mjs`

### 시크릿 (.env.local, D1 미저장)
- SENS: choho/shelter **동일 계정 chohopark**, 발신번호만 다름 (choho 01079320029 / shelter 01058710038)
- 텔레그램 봇토큰 양쪽 동일, chatId만 다름 (choho -1002484830636 / shelter -1002863320782)
- `.env.local`은 gitignore 적용됨. Vercel/Worker에도 동일 env 주입 필요 (컷오버 전)

### 다음 액션 (Phase 3 시작 전 확인)
- marketing_stats_v2 이관 여부 결정

---

## Phase 3 진행 중 — Next.js + D1 (브랜치: migrate/nextjs-d1)

### 프로젝트 경로 정리 (중요 — 혼동 주의)
- **F:\rv-chorigol.co.kr** = 예약시스템 (이식 대상, 지금 여기). Next.js 앱을 **이 repo 안에** 신규 구축
- **F:\choho_2025** = 초호펜션 공개 홈페이지 (Next.js+D1, 구 계정 pola2025/choho). 무관
- **F:\chohopark** = 별개 .net 브랜드사이트. **무관 — 건드리지 말 것**
- admin = 기존 경로 없음 → 이 repo에서 신규 생성. admin.chorigol.co.kr (새 계정 chohopark134에 연결됨)
- 라이브 Vite 앱은 main 브랜치 유지. Next.js 작업은 migrate/nextjs-d1 브랜치에 격리

### 완료 (검증됨)
- **D1 접근 계층**: `lib/d1.js` (HTTP API 클라이언트, 파라미터 바인딩, 서버 전용 — 토큰 클라이언트 노출 0)
  - 인증 우선순위: CLOUDFLARE_D1_TOKEN(Bearer) → GLOBAL_API_KEY+EMAIL(X-Auth)
- **예약 조회 계층**: `lib/reservations.js` — listByCheckIn/listByRange/listByStatus/getById/statusSummary
  - 옵션 join은 IN 절 청크(90개)로 D1 변수한도(100) 회피 — 검증 중 발견·수정
- `.env.local`에 `D1_DATABASE_ID=d9bf20dc-68cf-4077-b238-f1efc7e0ab3b` 추가
- 검증: 실제 이관 데이터 읽기·옵션/현장결제 구분·범위 106건 정상

### 완료 추가 (2026-07-16 이어서)
- **marketing_stats_v2 이관 완료** → D1 marketing_stats 4건. **Firestore 12컬렉션 전량 이관 끝**
- **Next.js 15 도입** (React 19 호환. Next 14는 React19 미지원이라 15 사용). `app/` App Router, Vite `src/`와 공존
- **조회 계층 추가**: `lib/rooms.js`(listRooms/getRoomByName/businessOf/listOptions), `lib/notifications.js`(getSmsConfig/getTemplate/renderTemplate)
  - `renderTemplate()`: 한글 변수 치환 **단일 소스** + 미치환 검사 내장 (오늘 버그 근본해결)
- **app/reservations/page.jsx**: D1 서버 컴포넌트 예약목록. `next build` 성공 + `next start` 실데이터 렌더 HTTP 200 검증
- **src/pages → src/legacy-pages 이름변경**: Next가 레거시를 Pages Router로 오인하는 문제 해결 (VITE_ env 참조로 빌드 실패했었음)
- `next.config.mjs`: eslint.ignoreDuringBuilds (Vite eslint 설정이 Next 서버코드와 충돌 — 컷오버 시 Next용으로 교체)
- 커밋: `5629f77` (브랜치 migrate/nextjs-d1)

### 검증 스크립트 (scratchpad, 세션종료 시 삭제됨)
- verify-d1lib.mjs, verify-notif.mjs, load-marketing.mjs — 재실행 시 dump 먼저 필요(dump-all.mjs)

## Phase 4 완료 — 예약 쓰기 API + 알림 통합 (트리거 대체)

**커밋**: 브랜치 migrate/nextjs-d1 (쓰기 API)

- `app/api/reservations/route.js`: POST(생성)/PATCH(수정·취소)/GET. 상태전환·객실변경 감지 → 알림
- `lib/reservations.js`: create/update/cancel/delete + Firestore스타일 ID + 옵션 replace
- `lib/reservation-notify.js`: 알림 오케스트레이션 (막기 스킵, 취소는 텔레그램만, 미치환 차단, notification_log 기록)
- `lib/sms.js`(SENS, env시크릿) / `lib/telegram.js`(env봇토큰, 업체별채널) / `lib/messages.js`(TG 포맷터)
- 검증: CRUD·SMS실발송(테스트번호)·봇토큰·막기스킵 전부 통과. D1 원상복구(540건)

### ⚠️ 테스트 규칙 (중요)
- **테스트 문자는 01098979834 번호로만** (사용자 지정)
- **실제 텔레그램 채널로 테스트 발송 금지** — 봇토큰 getMe로 유효성만 확인. 스팸되면 deleteMessage로 삭제
- **한글 payload는 curl 금지** (Windows 콘솔 UTF-8 깨짐 → source="막기" 깨져 스킵 실패한 사고). node로 테스트
- 텔레그램 봇: 양쪽 업체 동일 `@mkt251102_bot`, chatId만 다름 (choho -1002484830636 / shelter -1002863320782)

### 다음 액션 (Phase 3 화면 이식 이어서)
1. 컴포넌트 전면 재작성 (결정됨): 캘린더/객실/옵션/알림 → Next 서버컴포넌트 + API Route
   - 쓰기는 전부 `fetch('/api/...')` → API Route → lib/ (Firestore 직접쓰기 145곳 대체)
2. 나머지 조회 계층: customers, inventory_overrides, marketing_stats, pricing
3. 리스너 7곳(onSnapshot) → 폴링/revalidate, Airtable 제거
4. 인증: Firebase Auth → JWT admin_token 쿠키 (Phase 5)
5. Vite→Next 완전 전환 후 eslint를 Next용으로 교체, Vite 스크립트/의존성 제거

### D1 접근 참고
- `lib/d1.js` 인증: CLOUDFLARE_D1_TOKEN(Bearer) 우선 → 없으면 GLOBAL_API_KEY+EMAIL
- 스코프 토큰 발급되면 `.env.local`에 `CLOUDFLARE_D1_TOKEN=` 추가만 하면 자동 전환
- 로컬 Next 실행: `set -a && source .env.local && set +a && npx next start` (또는 next dev)

## 이후 Phase (계획서 참조)
- Phase 3(계속): Vite→Next.js 화면 이식, 리스너→폴링, Airtable 제거
- Phase 4: 알림 트리거 2개 → API Route 쓰기 경로 통합 (최대 난관, D1엔 트리거 없음)
- Phase 5: Firebase Auth → JWT admin_token 쿠키
- Phase 6: api.chorigol.co.kr Worker 7-Layer 보안
- Phase 7: 검증 + 컷오버 (심야, rv CNAME 교체, Firebase 2주 보존)
