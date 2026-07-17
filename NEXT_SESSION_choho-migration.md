# 초호펜션 예약관리시스템 — Firebase·Airtable → Vercel + Cloudflare D1 마이그레이션

> 세션 핸드오프 · 최종 갱신 2026-07-17

## 복사용 요청문
```
초호펜션 예약시스템 Firebase→Vercel+D1 이관. **🎉 컷오버 완료 (2026-07-17 13:30 KST)**.
**rv.chorigol.co.kr = Next.js 15 + D1 이 라이브다.** 브랜치 아니라 **main 이 현행**이다.
  머지 7c6d129 · 배포 dpl_2EMKwW9Y… · 도메인 이동 없어 무중단이었다
**문자 발송자가 CF → Vercel Cron 으로 넘어갔다** (autoSendSMSScheduler **삭제됨**, 목록 0개).
  CRON_SMS_ENABLED=true · 크론 3개 등록·활성(disabledAt:null)
  퇴실 0 1 * * * (10시 KST) · 입실 0 4 * * * (13시 KST) · health 0 0 * * *

🔴 **다음 세션 0순위 — 첫 실발송을 확인해라 (2026-07-18 10:00 KST 퇴실)**
   이관 후 **크론이 실제로 문자를 보낸 적이 아직 없다**. 드라이런만 통과했다.
   확인: `firebase functions:log` 는 이제 없다 → **Vercel 런타임 로그** 또는
        `node -e` 로 D1 `notification_log` 에 (reservation_id, 'checkOut') 행이 생겼는지.
   못 나갔으면 고객이 퇴실 안내를 못 받는다. **이게 이번 이관의 유일한 미검증 지점이다.**

남은 일: ① 위 첫 발송 확인 → ② Phase 6 api.chorigol.co.kr Worker 보안
        → ③ Phase 8 Firebase·Airtable 폐기(2주 보존 후 = 2026-07-31 이후)

**Phase 8 전 반드시 알아둘 것**: Firestore 를 지우면 **과거 발송이력이 사라진다**.
  CF 는 smsStatus 를 Firestore 에 썼고 D1 notification_log 에는 **오늘(7/17) 13시 발송분이 없다**
  (백필은 7/16 까지만). 지금은 무해하다 — 크론은 날짜 기준으로 오늘 것만 보니까.

컷오버 때 실증한 것 (다음 세션이 의심하면 이 근거를 봐라):
  · 프리뷰에서 **실제 로그인 성공** (login_attempts id=28, IP 182.214.41.78 = 로컬 아님)
  · 예약목록 **540건** 렌더 = D1 실건수 일치 · `/api/health` dbOk:true
  · 크론 인증: 무인증·틀린시크릿 **401**, 정상 200
  · 머지 결과 트리가 브랜치와 **diff 0** → 프리뷰에서 검증한 코드 그대로 배포됨

빌드는 **반드시 `npx next build` 로 확인**할 것 — dev 는 통과하는데 프로덕션 프리렌더에서
죽는 SSR 버그가 실제로 있었다(`window is not defined`). dev 만 보면 배포 때 처음 터진다.
F:\rv-chorigol.co.kr\NEXT_SESSION_choho-migration.md 전체 컨텍스트. **브랜치 main**.
최종 화면은 **Next 가 레거시 컴포넌트를 렌더**한다(사용자 확정, 7/17 이행 완료).
도달성 판정은 grep 금지 → `node scripts/audit/reachability.mjs` (Dashboard.jsx 가 죽은 코드였다).

🔴 **환경변수 함정 (이거 모르면 엉뚱한 DB 를 친다)**
Windows **사용자 환경변수에 낡은 `D1_DATABASE_ID=a10f8ed6…` 가 박혀 있다**(이 계정에 없는 DB).
node 의 `--env-file` 과 Next 는 **이미 있는 process.env 를 덮지 않는다** → 조용히 그 값을 쓴다.
  · 스크립트: `set -a && source .env.local && set +a && node ...` (이건 덮는다) 또는
    .env.local 을 직접 파싱 (scripts/migration/*.mjs 가 쓰는 방식 — 그래서 얘들은 안전했다)
  · dev 서버: `unset D1_DATABASE_ID && portless run npx next dev` → https://choho-admin.localhost
정답 DB = `d9bf20dc-68cf-4077-b238-f1efc7e0ab3b` (choho-reservations)

🔑 **D1 인증이 바뀌었다 (2026-07-17 컷오버)** — 스코프 토큰 `CLOUDFLARE_D1_TOKEN` 이 정답이다.
   `lib/d1.js` 는 이게 있으면 Bearer 로 쓰고, 없을 때만 Global API Key 로 폴백한다.
   · 토큰 이름 `choho-d1-vercel` (D1 Read+Write 만 · Zone 접근 불가 확인). Vercel 에 주입된 건 **이것**
   · **Global API Key 를 Vercel 에 넣지 말 것** — 계정 전체 권한이고 채팅 평문 노출된 재발급 대상이다
   · `CLOUDFLARE_API_TOKEN` 은 **무효한 토큰**이다 (verify 실패). 헷갈리지 말 것

⚠️ **`next build` 를 dev 서버 켜둔 채 돌리지 말 것** — `.next` 를 공유해서 dev 의 CSS 청크가
   404 가 된다(전 화면이 무스타일로 보임). 겪으면: dev 죽이고 `rm -rf .next` 후 재기동.

✅ **문자 이중발송 위험은 끝났다** (CF 삭제 완료). 아래 옛 순서는 **이미 실행됐다** — 다시 하지 말 것:
   ① `firebase functions:delete autoSendSMSScheduler` ✅ 2026-07-17 실행 (목록 0개 확인)
   ② `CRON_SMS_ENABLED=true` ✅ 주입 + 재배포 완료
   CF 를 되살리려면 소스가 남아 있다 (`functions/src/index.js:752`) — 단 되살리면 **이중발송**이다.

원칙: rv는 "기존 모습 그대로" 이관 — UI 임의변경 금지. 새 UI 아이디어는 admin(별개 통계앱)으로.
      모양·기능이 같아야 하므로 **측정과 감사**가 핵심. 추측으로 이식 금지.
      단 **시크릿 UI 는 예외**(사용자 확정 7/17): 보안과 양립 불가라 "서버에서 관리" 표시로 대체했다.
테스트: 문자는 01098979834로만, 예약 알림봇 실채널 발송금지, 한글 payload curl금지(node).
       삭제는 정확한 ID로만 (LIKE 패턴 금지 — 실데이터 삭제 사고 있었음).
       **01098979834 에는 실고객(이재호·방문37회)이 있다.** 행 수만 비교하면 "수정"을 못 되돌린다
       → 고객 행은 원본 전체를 캡처해 복구할 것 (2026-07-16 오염 사고, 아래 참조).
       재고가드 테스트는 source="막기" 쓰면 안 됨(막기는 검사를 건너뜀) → sms_config 잠시 끄고 非막기로.
감사: `node scripts/audit/<이름>.mjs` — 임시폴더에서 **repo 로 옮겨 영구 보관**했다.
      verify-snapshot(역매퍼 18) · audit-override(드리프트 25) · audit-store-port(이식 49) ·
      **audit-notification-doc(알림설정 역·정매퍼 124)** · verify-migration · audit-inventory · audit-api-guard ·
      **audit-sms-history(신호등 1454/1620)** · **audit-cron-sms(입실퇴실 드라이런 — 발송 없이 문구 검증)**
포매터 훅 주의: Edit/Write 는 파일 전체를 재포맷한다(1글자 고쳐도 400줄 diff).
      최소 diff 가 필요하면 **bash 의 python 으로 패치**하면 훅이 안 돈다.
```

**계획서**: https://claude.ai/code/artifact/84c4a8c2-5770-4966-9404-aa70a3b82164
**브랜치**: `migrate/nextjs-d1` (라이브 Vite 앱은 `main`, 무영향)

## 한눈에 보는 진행률

| Phase | 내용 | 상태 |
|---|---|---|
| — | **죽은 코드 159개 삭제** (src/ 235 → 76) + 도달성 그래프 도구 | ✅ |
| — | **운영 핫픽스** (예약목록 수정 저장 불가) → main push 배포 완료 | ✅ |
| 0 | 계정·SSH·DNS(Cloudflare)·admin 도메인 | ✅ |
| 1 | D1 생성 + 스키마 13테이블 | ✅ |
| 2 | 데이터 2,067건 전량 이관 + 검증 + 시크릿 env 분리 | ✅ |
| 3 | Next.js 15 + 화면 이식 **5/5** (캘린더·예약목록·객실·옵션·알림설정) | ✅ |
| 4 | 쓰기 API + 알림 통합 (트리거 대체) | ✅ |
| — | 인프라봇 헬스체크 분리 | ✅ |
| 5 | 인증 (Firebase Auth → JWT 쿠키) | ✅ **완료 — 비번 설정·로그인 실증됨 (7/17 밤)** |
| — | **Vite 진입점 폐기** (App·LoginScreen·main·index.html·vite.config) → **Firebase 접점 0** | ✅ |
| — | **재고 가드** (오버부킹 원자적 차단) + API 연결 | ✅ |
| — | **레거시 화면 이식** (rv 모양 그대로) | ✅ **5/5 + 셸(MainLayout)** · **Firebase 소비자 3개 남음** |
| — | option_settings 갭 복구 + rooms/options/pricing_rules 쓰기 API + 두 화면 이식 | ✅ |
| — | **알림설정 갭 5개 복구 + 역·정매퍼 + NotificationSettingsV2 이식** (감사 124/124) | ✅ **브라우저 검증 5/5 통과** |
| — | **🔒 보안 0순위 — sensService 삭제** (SENS 키 브라우저 노출 제거) | ✅ |
| — | **smsStatus 갭 복구(여섯 번째) + SmsHistoryTable D1 이관** (신호등 1454/1620) | ✅ |
| — | **재작성본 폐기** (NotificationsClient·CalendarClient·EditReservationModal·nav.jsx) | ✅ |
| — | ~~9시 리포트 크론~~ → **폐기 결정** (사용자 2026-07-17) | ✅ |
| — | 크론 이관 (**입실·퇴실 안내만**) — 코드 완성, **킬스위치로 꺼둠** | 🔄 |
| — | **인프라 확정** — Vercel 계정 이관 폐기(구 Pro 그대로) · 신규는 CF 뿐 · choho-admin 삭제 | ✅ |
| — | **컷오버 사전준비** — D1 스코프토큰 발급 · Vercel env 17개 주입 · 프리뷰 실증 | ✅ |
| **7** | **컷오버** — main 머지 → rv.chorigol.co.kr = Next+D1 (**무중단**, DNS 이동 없음) | ✅ **2026-07-17 13:30 KST** |
| — | **크론 이관 완료** — CF autoSendSMSScheduler **삭제** → Vercel Cron 이 유일한 발송자 | ✅ **첫 실발송은 7/18 10:00 미검증** |
| 6 | api.chorigol.co.kr Worker 보안 | ⬜ |
| 8 | Firebase·Airtable 폐기 (2주 보존 → 2026-07-31 이후) | ⬜ |

**🎉 운영이 신규 스택으로 넘어왔다.** `rv.chorigol.co.kr` = Next.js 15 + D1 (Vercel Pro, mkt9834).
Firebase 는 **더 이상 아무것도 안 한다** — Functions 스케줄러 삭제됨, 앱은 Firestore 를 안 본다.
남은 건 폐기(Phase 8)뿐이고, 그 전에 **7/18 10:00 첫 크론 발송 확인**이 0순위다.

> ⚠️ Phase 3 의 "화면 5/5"는 **전면 재작성본**이라 rv 모습과 다르다.
> 사용자 결정(2026-07-16): **rv는 기존 모습 그대로 이관** → 레거시 화면을 그대로 옮기는 중.
> 재작성본(app/calendar 등)은 컷오버 전 정리 대상.

## ✅ 관리자 비밀번호 설정 — **완료** (2026-07-17, 로그인 실증됨)

`admins` id=19 · `choho140@naver.com` · 활성 1 · scrypt 해시 178자.
**사용자 실제 로그인 성공 확인** (`login_attempts` id=27 `success=1` @ 2026-07-17T03:30:07Z).
→ **컷오버 블로커 해소.** 이 섹션은 이제 "다시 할 일"이 아니라 **재설정 방법 안내**다.

### 비번을 다시 설정해야 하면 — **웹 입력판을 쓴다**

```
node scripts/set-admin-password-web.mjs [이메일]
```
127.0.0.1 임의포트에 일회용 URL 을 띄운다 → 브라우저에서 입력 → 저장되면 서버 자동 종료.
(다른 계정: `node scripts/set-admin-password-web.mjs 이메일@주소`)

**🔴 `scripts/set-admin-password.mjs`(터미널판)는 에이전트 셸에서 쓸 수 없다.**
TTY 가 없어서 **사용자가 값을 칠 자리가 자체가 없다.** 2026-07-17 세션이 막힌 게 정확히 이것이고,
그 세션이 "스크립트 버그"로 오진해 버그 2개를 고쳤지만(`c9b3113`) **원인은 스크립트가 아니라
입력 표면이었다.** 사람이 진짜 터미널에서 직접 칠 때만 터미널판이 의미가 있다.
→ **교훈: "안 된다"가 아니라 입력 표면을 옮기면 된다.** (사용자 지시: "무조건 안된단 소리 하지 말고 방법을 찾아")

### 🔴 내가 낸 사고 — INSERT 파라미터 순서 (복구 완료, 같은 세션)

웹 입력판을 처음 쓸 때 컬럼과 값이 **어긋나게** 들어갔다:
```
INSERT INTO admins (email, password_hash, is_active, created_at) VALUES (?, ?, 1, ?)
전달값: [hash, email, ts]   ← 뒤집힘. email 칸에 해시가, password_hash 칸에 이메일이 박혔다
```
- **원본 터미널판은 맞게 돼 있었다**(`[email, hash, ts]`). 옮겨 적으며 뒤바꾼 것이다
- 증상: 저장은 "성공"인데 `SELECT … WHERE email=?` 가 **null** → 로그인 영영 불가
- **`len: 18` 이 결정적 증거였다** — `choho140@naver.com` 의 글자 수. 해시라면 178 이어야 한다
- **복구**: 사용자가 입력한 비밀번호의 해시가 email 칸에 온전히 살아 있어서
  `UPDATE admins SET email = password_hash, password_hash = email WHERE id = 19` 로 되돌렸다
  (SQLite 는 UPDATE 의 RHS 를 **원본 행 값**으로 평가한다 → 한 문장으로 교환된다).
  **사용자가 비번을 다시 입력할 필요가 없었다.** created_at 불변 확인
- 스크립트는 고쳤다: 순서 주석 + **저장 확인을 응답 전에** + `res.headersSent` 가드
  (확인 실패가 `json(500)` 을 또 보내 `ERR_HTTP_HEADERS_SENT` 로 프로세스가 죽었다)

> 교훈: **"저장했다" 는 성공이 아니다.** 되읽어서 같은 행이 나와야 성공이다.
> 이 사고는 되읽기가 null 을 뱉어서 잡혔다 — 그 확인이 없었으면 조용히 넘어갔다.

## 다음 세션 첫 액션

### 0) ✅ 이식은 끝났다 — **Firebase 접점 0 · react-router 0 · src/ 죽은코드 0**
화면 5/5 + 셸 + 진입점까지 전부 정리됐다. 이제 이 브랜치는 **Next 전용 앱**이다.
남은 건 **① 크론(입실·퇴실) ② Phase 6 Worker 보안 ③ 컷오버** 뿐이다.

| 실측 (grep 아님 — `node scripts/audit/reachability.mjs`) | |
|---|---|
| Firebase 소비자 | **0** (`src/config/firebase.js` 삭제됨) |
| react-router 사용처 | **0** (App.jsx 삭제로 소멸) |
| src/ 죽은 코드 | **0** (60개 전부 살아있음) |
| `npx next build` | Compiled successfully · static 10/10 |

**Vite 는 완전히 걷혔다**: `index.html`·`main.jsx`·`App.jsx`·`LoginScreen.jsx`·`vite.config.js`·
`src/scripts/`(4)·`src/utils/errorHandler.js` 삭제. `package.json` 은 `dev`/`build` = **next**,
firebase·react-router-dom·vite·@vitejs/plugin-react·react-query-devtools 의존성 제거.
`deploy`·`deploy:all`(= firebase hosting) 스크립트도 삭제 — CLAUDE.md 금지 경로였고
`build` 가 next 로 바뀌어 말이 안 되게 됐다.

> ✅ **로그인 된다** (7/17 밤 실증). `admins` id=19 · `choho140@naver.com` · 활성.
>   dev 서버는 `unset D1_DATABASE_ID && portless run npx next dev` → `https://choho-admin.localhost`
>   (비번을 모르는 채로 화면만 열려면 `signToken('choho140@naver.com')` → `document.cookie = "admin_token=<jwt>; path=/"`)

### 1) App.jsx 에서 건져낸 것 3개 (지웠으면 조용히 사라졌을 것들)
| 레거시 | 옮긴 곳 |
|---|---|
| ErrorBoundary (App.jsx:54-86) | `app/error.jsx` — Next 규약이 같은 일을 한다 |
| LoadingScreen (App.jsx:44-51) | `app/loading.jsx` — Suspense 폴백 |
| `<div className="app">` | `app/providers.jsx` 래퍼. **없으면 배경이 어두워진다** (App.css:13 의 `#f8f9fa` 가 theme.css 의 어두운 body 를 덮는 구조) |

### 1-1) ✅ 결정됨 — **로그아웃 UI 는 안 만든다** (사용자, 2026-07-17: "로그아웃 필요 없고")
셸을 rv 원본(MainLayout)으로 되돌리면서 구 `app/nav.jsx` 의 로그아웃 버튼이 사라졌다.
**rv 에는 원래 로그아웃 UI 가 없다** — `MainLayout({user, onLogout})` 이 두 prop 을 받고도
한 번도 안 쓴다(죽은 prop). App.jsx 의 `handleLogout` 은 아무 버튼에도 안 붙어 있었다.
→ **원본 그대로 유지. 다시 꺼내지 말 것.** 세션은 30일 JWT 로 굴러간다.
   (개발 중 세션이 필요하면 `signToken()` 으로 발급해 쿠키에 넣는다 — 위 1) 참조)

### 1-2) ✅ 결정됨 — 레이트 체크아웃 **14시 표기는 무시한다** (사용자, 2026-07-17: "그냥 무시해 12시야")
D1 **데이터**에 14시 표기가 남아 있다(코드 아님 — grep 이 안 닿는다):
| 출처 | 현재 값 |
|---|---|
| `options.late_checkout.description` | `Forest, Forest mini 객실만 가능 (14:00까지)` |
| `option_settings.late_checkout.data.description` | `오후 2시 체크아웃` |
- **이관 버그 아니다** — Firestore 원본이 그렇다. 라이브 rv 도 지금 "2시"로 보인다
- **실제 정책은 12시다.** 위 문구는 표시용 설명일 뿐이고 로직은 `late_checkout` id 로 동작한다
- **결정: 안 고친다.** D1 UPDATE 하지 말 것. 다음 세션이 "버그다" 하고 또 파지 말 것

### 2) 🔴 컷오버 블로커 — 크론 이관 (**입실·퇴실만** 남았다)

#### ✅ 9시 일일현황 — **폐기됨** (사용자, 2026-07-17: "9시 일일현황 안띄워도 되")
`src/services/notificationScheduler.js` 삭제 + App.jsx 배선 제거 (커밋 `655bb3a`).
**유일한 발송자가 브라우저였으므로 이제 아무도 안 띄운다.** 크론으로 이관하지 말 것.

#### 🔴 입실·퇴실 안내 — 이게 진짜 블로커다 (실고객에게 나가는 문자)
**발송자 실측 (핸드오프 옛 서술보다 이게 정확하다)**:
| 함수 | 배포 | 실제 동작 |
|---|---|---|
| **`autoSendSMSScheduler`** (`functions/src/smsScheduler.js`) | ✅ `index.js:752` 로 **배포됨** | 🔴 **이게 지금 입실·퇴실 문자를 보내는 놈이다.** Firestore 를 읽는다 (`Asia/Seoul`, `asia-northeast3`) |
| `notificationScheduler` (`functions/src/notificationScheduler.js`) | `index.js:751` 로 배포됨 | **죽어 있다** — 본문 첫 줄이 `return null` (2025-12-19 "smsScheduler 로 대체됨") |
| `telegram-scheduler.js` · `notifications.js` V2 | ❌ export 안 됨 | 미배포. 일일현황용이었으니 이제 **무관** |

→ **컷오버(Firestore 폐기) 순간 입실·퇴실 문자가 조용히 멈춘다.** 이게 남은 유일한 크론 블로커다.
- **CF 로 새로 배포하지 말 것** — Phase 8 에서 폐기할 시스템이다
- **제자리는 Vercel Cron → `/api/cron/*` → D1 → `lib/sms.js`**. 근거: env 에 이미 `CRON_SECRET` 이
  있고(원래 크론 전제 설계), `lib/sms.js`·`lib/reservation-notify.js` 가 서버 전용 시크릿으로 완성돼 있다
- `checkin_hours_before`·`checkout_hours_before` 는 D1 에 들어 있다 (독자가 이 크론이 된다).
  **Forest 패밀리만 2, 나머지 3** — 기본값으로 뭉개지 말 것
- 중복발송 가드가 필요하다: 레거시는 `smsStatus.{type}Sent` 로 막았다. 신규는 그 자리에
  **`notification_log` 가 있다**(이번 세션 백필로 과거분까지 채워짐) → `(reservation_id, kind)` 존재 확인으로 막으면 된다
- ⚠️ **별건(기존 동작)**: 퇴실 템플릿이 레이트체크아웃 여부로 분기하지 않는다 → 12시 결제 고객도
  "퇴실시간 오전 11시" 문자를 받는다. 크론 이관 때 같이 볼지 판단할 것

### 3) 그 외
- `src/scripts/` 4개 — 도달성 실측상 **죽은 코드**(reachability: src/ 71개 중 죽음 4 = 전부 이것들).
  Firebase 폐기(Phase 8) 때 함께 정리
- `lib/refund-policy.js` — **죽은 코드가 됐다**. 유일한 소비자였던 `app/calendar/EditReservationModal.jsx`
  (재작성본)를 폐기했기 때문. 레거시 CancelReservationModal 은 `src/constants/refundPolicy.js` 를 쓴다.
  "src/ 는 컷오버 후 삭제"를 전제로 만든 파일인데 **아키텍처가 뒤집혀(레거시가 산다) 전제가 사라졌다**.
  크론/서버측 환불계산이 필요하면 살릴 것, 아니면 삭제. **판단 보류**

---

## 📌 최신 세션 요약 (2026-07-17 낮 13:30) — **🎉 컷오버 완료**

**한 줄**: 남은 블로커였던 비번을 풀고(입력 표면을 바꿔서), 그대로 컷오버까지 완주했다.
**핸드오프가 "컷오버 = 평소 배포"라고 한 건 틀렸다** — 그대로 머지했으면 라이브가 죽었다.

### 🔴 컷오버 직전에 잡은 지뢰 3개 (전부 핸드오프가 몰랐던 것)
1. **Vercel env 가 0개였다.** 신규 스택 env(`JWT_SECRET`·D1 접속정보 등)가 **하나도 주입돼 있지
   않았다** — 옛 `VITE_*` 14개뿐. 그대로 머지했으면 **로그인 500 · 전 화면 500**.
2. **`framework: null`** (Vite 시절 값). Next 빌더가 안 돌아 배포가 깨진다.
   → **대시보드에서 바꾸지 않고 `vercel.json` 에 넣었다** — 프로젝트 설정은 코드와 분리돼 있어
     롤백하면 어긋난다(머지를 되돌려도 framework 는 nextjs 로 남아 Vite 배포본이 깨진다).
     vercel.json 에 두니 코드와 한 커밋에 묶여 함께 가고 함께 돌아온다.
3. **머지가 충돌한다.** main 의 핫픽스(`96af26b`)와 브랜치의 같은 수정(`b3d2752`)이 만났다.
   **코드는 동일하고 주석만 달랐다** → 브랜치 채택. `src/pages`·Vite 진입점 부활은 없었다(rename 인식됨).

### 실증으로 깐 것 (추측 0)
| 무엇 | 근거 |
|---|---|
| Vercel 런타임 → D1 | **프리뷰에서 실제 로그인 성공** · `login_attempts` id=28 IP `182.214.41.78`(로컬 ::1 아님) |
| 배포될 코드 = 검증된 코드 | 머지 결과 트리 vs 브랜치 **diff 0** |
| Vercel 이 Next 로 빌드 | `vercel inspect` 에 `λ index`·`calendar.rsc` (REST API 는 `builds:[]` 로 **거짓말**했다) |
| 크론 방어 | 무인증·틀린시크릿 **401** · 정상 200 · 킬스위치 OFF 때 `{"skipped":"CRON_SMS_ENABLED 아님"}` |
| 크론 동등성 | dryRun `checkIn` 계획 8명 = CF 가 13:00 에 실제 보낸 8명과 **완전 일치** |
| 13:00 CF 발송 | `functions:log` 04:00:04Z **8/8 성공** → 그 다음에 컷오버(21시간 여유 확보) |

### 🔑 D1 인증을 바꿨다 — Global Key 를 Vercel 에 넣지 않으려고
`lib/d1.js` 는 `CLOUDFLARE_D1_TOKEN`(Bearer) → 없으면 Global API Key 폴백 구조인데,
**로컬이 폴백으로 돌고 있었고 `CLOUDFLARE_API_TOKEN` 은 무효한 토큰이었다**(verify 실패).
→ **스코프 토큰 `choho-d1-vercel` 신규 발급** (D1 Read+Write 만, Zone 접근 불가 확인) → Vercel 엔 이것만.
Global Key 는 계정 전체 권한 + 채팅 평문 노출된 재발급 대상이라 넣으면 안 된다.

### 🐞 내가 낸 사고 2건 (둘 다 복구 완료 · 같은 뿌리)
1. **INSERT 파라미터 뒤집힘** — `admins` 의 email 칸에 해시가, password_hash 칸에 이메일이 박혔다.
   `len:18`(= `choho140@naver.com` 글자수)이 증거. `UPDATE SET email=password_hash,
   password_hash=email` 로 복구(SQLite 는 RHS 를 원본 행 값으로 평가) — **재입력 없이** 살렸다.
2. **토큰 값 소실** — CF 토큰을 발급하고 **검증부터 하다 죽어서** 저장 전에 값을 잃었다.
   토큰 값은 발급 응답에서 1회만 보인다. 고아 토큰 삭제 후 **발급 → 저장 → 검증** 순으로 재발급.
   (실패 원인은 토큰이 아니라 **전파 지연**이었다 — 5초 뒤 재시도하니 됐다)

> **공통 교훈: 순서가 전부다.** "저장했다"는 성공이 아니고 **되읽어야** 성공이다.
> 그리고 **되돌릴 수 없는 값은 검증보다 먼저 저장**해야 한다. 두 사고가 정확히 이 두 축이었다.

### 🐞 내 판정 코드가 두 번 거짓말했다 (도구 출력을 곧이곧대로 믿지 말 것)
- **`if (j.skipped)`** — `skipped: []` 는 **빈 배열이라 truthy** → 크론이 켜졌는데 "꺼졌다"고 찍었다
- **REST `builds: []`** 를 보고 "Next 가 아니다 → 머지하면 라이브가 깨진다"고 결론냈는데,
  **CLI 로 보니 λ 함수가 멀쩡히 있었다.** API 가 데이터를 안 준 것이었다.
  → **없는 것과 안 보이는 것은 다르다.** 교차확인 없이 단정하지 말 것

### 커밋
| 커밋 | 내용 |
|---|---|
| `1a895ec` | 비번 설정 완료 — TTY 없는 셸을 **브라우저 입력판**으로 우회 (`set-admin-password-web.mjs`) |
| `1c8a720` | `vercel.json` 에 framework=nextjs — 컷오버를 원자적으로 |
| `7c6d129` | **Merge — 컷오버**. rv.chorigol.co.kr = Next + D1 |

---

## 📌 지난 세션 요약 (2026-07-17 밤) — **이식 완주 + 인프라 확정**

**한 줄**: 핸드오프 첫 액션이 **선행조건 때문에 불가능**했다. 그걸 풀다 로더의 **여섯 번째 갭**이
나왔고, 화면 5/5 → 셸 → Vite 진입점까지 다 걷어내 **Firebase 접점 0**이 됐다. 마지막에
사용자가 **Vercel 계정 이관을 폐기**해 컷오버가 무중단으로 단순해졌다.

| 커밋 | 내용 |
|---|---|
| `2059ea3` | **SmsHistoryTable D1 이관 + smsStatus 갭 복구** (635행 백필 · 신호등 1454/1620) |
| `afc17af` | 예약 캘린더 레거시 이식 + **Vite-ism 제거**(import.meta.env) |
| `5ee8a52` | **레거시 전역 CSS 로드** — 수정 모달이 뼈대만 나오던 문제 |
| `0a66c75` | **rv 원본 셸(MainLayout) 채택** — nav.jsx 폐기 + react-router 제거 |
| `170a686` | 알림설정 레거시 이식 + 재작성본 3개 폐기 + **0순위 브라우저 검증 5/5** |
| `006d2e4` | 남은 3화면(예약목록·객실관리·옵션설정) 이식 → **5/5 완성** |
| `655bb3a` | 9시 일일현황 제거(사용자) + **SSR 가드 3곳 — 프로덕션 빌드 복구** |
| `cb23779` | **Vite 진입점 폐기** → Firebase 접점 0 · react-router 0 |
| `c82c6d8` | 죽은 파일 2개 정리 → **src/ 죽은코드 0** |
| `ca8d755` | **입실·퇴실 크론 이식**(킬스위치 OFF) + **인프라 확정** + vercel.json 지뢰 제거 |
| `54f73a1` | `choho-admin` Vercel 프로젝트 삭제(사용자 지시) |
| `2bbb137` | **크론 발송로직 분리 + 드라이런 감사** — 문자 없이 CF 동등성 증명 |
| `c9b3113` | set-admin-password 버그 2개(낡은 env 로 엉뚱한 DB · 입력이 안 보임) |
| (이번) | **비번 설정 완료 — 웹 입력판 신설**. TTY 부재를 브라우저 입력으로 우회 → **로그인 실증** |

### ✅ 비번 설정 블로커 — **해소됨** (2026-07-17 밤, 로그인 실증)
`admins` id=19 활성 · 사용자 실제 로그인 성공(`login_attempts` id=27 `success=1`).
원인은 스크립트 버그가 아니라 **TTY 부재**였다 → 입력을 브라우저로 옮겨 해결
(`scripts/set-admin-password-web.mjs`). 위 "관리자 비밀번호 설정 — 완료" 참조.

### 🎯 인프라 확정 — 계획이 뒤집혔다 (사용자, 세션 말미)
> "vercel 이관은 하지말고 클라우드플레어만 신규로 쓰자 / 그 구계정플랜을 그대로 쓰잔말임"

**실측이 이 결정을 강하게 뒷받침한다:**
| 계정 | 플랜 | 크론 | chorigol 도메인 |
|---|---|---|---|
| 구 mkt9834 (라이브 rv) | **Pro** | 제한 없음 | ✅ 보유 |
| 신규 chohopark134 | Hobby | 2개·하루1회 | ❌ 없음 |

- **다운타임 소멸**: 도메인을 뗄 일이 없다 → 컷오버 = `main` 머지 = 평소 배포
- **`.vercel/project.json` 은 원래 맞았다** — 지난 세션에 내가 "지뢰"라고 적은 건 **오판**. 고치지 말 것
- 신규 계정엔 chorigol 도메인이 없다 → 핸드오프의 "admin 은 새 계정에 연결됨"은 **사실이 아니었다**
- `choho-admin` 프로젝트 삭제(사용자: "내가 만든거니깐 지워도 된다"). `auto.polaai.co.kr` 도 같이 죽음
- **`admin.chorigol.co.kr` 은 이관 후 신규 구축** — 지금 404 인 게 정상이다

### 🔴 vercel.json 에 배포를 깨뜨릴 지뢰가 있었다
`{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}` — Vite SPA 리라이트인데
그 `index.html` 을 이번 세션에 삭제했다. **그대로 배포했으면 전 경로가 깨졌다.**
crons 가 원래 없어서 `/api/health` 는 **스케줄된 적조차 없었다**(핸드오프는 "Vercel Cron이 주기 호출"이라 적어둠).

### 🐞 프로덕션 빌드가 죽고 있었다 (dev 는 통과 → 배포 때 처음 터질 뻔)
`/reservations` 를 레거시로 바꾸며 **정적 프리렌더 대상**이 됐는데(재작성본은 force-dynamic 이었다)
`initialData: window.innerWidth` 가 **렌더 중** 평가돼 `window is not defined` 로 export 실패.
dev 가 멀쩡했던 건 migrationDebugger 가드가 `DEBUG_MODE`(=development) 라 프로덕션에선 안 타서다.
→ **`npx next build` 없이 "됐다" 하지 말 것.**

### 🔴 핸드오프가 또 틀렸다 (이번엔 2개 + 순서 1개)
1. **"① 브라우저 검증 → ② SmsHistoryTable" 순서가 거꾸로였다.**
   `NotificationSettingsV2:280` 이 `SmsHistoryTable` 을 **품고 있다** → 그게 Firebase 를 물고 있는 한
   알림설정 화면을 Next 에 올릴 수 없다. **②가 ①의 선행조건**이었다.
2. **"smsStatus 는 notification_log 로 정규화됐으니 JOIN 으로 재작성"** → **틀렸다.**
   로더(`load-logs.mjs`)는 `notification_logs`·`sms_logs` 두 컬렉션만 넣었다.
   **예약 문서의 smsStatus MAP 은 아무도 안 옮겼다**(스키마 주석은 "흡수한다"고 선언해 놓고).
   실측: D1 에 `confirmation`·`checkOut` kind 행 **0건** → 신호등 3종 중 2종은 JOIN 할 소스가 없었다.
   그냥 재작성했으면 **590칸이 조용히 회색**이 됐다.
3. **"재작성본이 폐기 대상"은 맞았지만 아무도 실행 안 하고 있었다** — 사용자가 캘린더를 보고 지적.

### 측정이 또 구해냈다
- **smsStatus 255건 vs 기존 checkIn 로그 166건은 거의 서로소**(겹침 1건) — 다른 시대의 기록이다.
  백필 충돌 0
- **신호등 차이 166칸은 전부 표시창(최근30일+미래) 밖** → 화면 출력은 레거시와 동일함을 증명하고 이식
- **컷오프를 KST 로** — 레거시는 브라우저(KST), 신규는 UTC 서버. `toISOString()` 이면 하루 어긋난다
- **옵션 칸은 원래 항상 ✓ 다** (`options || addons` 인데 `[]` 도 truthy) — 레거시 버그. 그대로 뒀다

### 🐞 Vite → Next 이식 함정 3종 (다음에 화면 올릴 때 이것부터 봐라)
| 함정 | 증상 | 처방 |
|---|---|---|
| `import.meta.env.*` | Next(webpack)에선 `import.meta.env` 가 undefined → `.DEV` 읽다 즉사 | `process.env.NODE_ENV` (양쪽 다 정적 치환) |
| 모듈스코프 `window` | Next 는 클라이언트 컴포넌트도 **SSR** → `window is not defined` 500 | `typeof window !== 'undefined'` 가드 |
| 진입점 전역 CSS 누락 | 컴포넌트 CSS 는 붙는데 `:root` 토큰이 없어 **뼈대만 남음** | 루트 레이아웃에서 theme.css·index.css·App.css import |
> 남은 `import.meta` 는 `LoginScreen.jsx`·`config/firebase.js` 2곳뿐 — 둘 다 폐기 대상이라 무해.
> `body` 인라인 스타일도 지웠다 — **인라인이 스타일시트를 이겨서** theme.css 의 body 규칙을 덮고 있었다.

### 🔴 크론 이식 — CF 를 실측해서 맞춘 것 (핸드오프 가정이 또 틀렸다)
**`checkin_hours_before` 를 실제 발송자는 안 읽는다.** 핸드오프는 "독자가 이 크론이 된다"고 했지만
CF `autoSendSMSScheduler` 는 **고정 10시/13시 KST** 를 쓴다. hours_before 로 구현했으면
Forest 패밀리(=2)만 발송 시각이 달라져 **동작이 바뀔 뻔했다.** D1 에 컬럼이 있고 화면에도
보이지만 **아무도 안 읽는 죽은 설정**이다.

| 항목 | CF 실측 | 크론 이식 |
|---|---|---|
| 시각 | 고정 10시(퇴실)/13시(입실) KST | 동일 (UTC 01:00 / 04:00 로 등록) |
| 대상 | `check_in\|check_out = 오늘` + `status='예약확정'` | 동일 |
| **주소 자동추가** | 치환 후 주소도 '주소' 글자도 없으면 끝에 붙임 → **퇴실 템플릿 7개 전부 걸린다** | 동일 (안 옮겼으면 퇴실 문구가 바뀐다) |
| subject | 없음 (`sendSMS(to, content)`) | 없음 (넣으면 LMS 제목이 새로 생긴다) |
| `{금액}`·`{인원}` | 원 붙임 / 기본값 2 | **무의미**: 템플릿에 `{금액}` 사용 0개, guests 는 NOT NULL DEFAULT 2 |
| `source='막기'` | **안 거른다**(더미번호라 실패할 뿐) | 🔸 **일부러 스킵**. notifyReservation 규약과 일치. 실측 막기 16건 전부 더미·미래 0건 → 과거영향 0 |
| 중복가드 | `smsStatus.{type}Sent` | `notification_log` (백필로 과거 이력 이어짐) |

### 알아둘 사실
- **rv 에 로그아웃 UI 가 없다** → 사용자 결정: **안 만든다** (위 1-1)
- **레이트 체크아웃 14시가 D1 데이터에 남아 있다** → 사용자 결정: **무시한다** (위 1-2).
  다만 교훈은 남는다 — **grep 은 데이터에 안 닿는다.** 지난 세션의 "repo 전체 확인" 이 그래서 반쪽이었다
- 재작성본은 전부 **읽기 전용**이었다 → 이식으로 기능이 오히려 돌아왔다
  (예약목록 50건 표 → 540건 + 검색·필터·수정/확정/취소)

### 이번 세션의 D1 쓰기 (전부 검증·복구 완료)
| 무엇 | 결과 |
|---|---|
| smsStatus 백필 | notification_log **1087 → 1722** (+635). 롤백앵커 `id > 1087` + 원본 JSON 캡처 |
| 알림설정 저장 테스트 | 입실 2→5→2. **room_templates 28/28 전필드 원상복구** |
| 단체예약 upsert 테스트 | 4행 생성 → **정확한 값으로 삭제**(LIKE 금지) → 28행 복귀 |

---

## 📌 지난 세션 요약 (2026-07-17 낮)

**한 줄**: 핸드오프 첫 액션을 그대로 진행했는데, **핸드오프의 판단이 4곳에서 틀렸다**.
전부 측정으로 잡아 고쳤고, **보안 0순위가 해소**됐다. Firebase 소비자 **8 → 4**.

| 커밋 | 내용 |
|---|---|
| `ec38455` | diagnostics 폐기 + reservationDebugger Firebase 접점 제거 (소비자 8 → 6) |
| `e79dd3b` | notificationScheduler 죽은 입실/퇴실 경로 제거 + 일일현황 중복가드 |
| `80ecfc2` `70add23` | notificationService WIP 101줄 **보존 커밋** 후 죽은 파일 삭제 |
| `9e22f28` | 레이트 체크아웃 표기 14:00 → **12:00** (사용자 확인) |
| `d6fab5b` `0a836f2` | 알림설정 갭 **5개** D1 복구 + 덤프 실값 백필 |
| `e4c1bdc` | 알림설정 역매퍼·정매퍼 + GET/PATCH API (**감사 124/124**) |
| `fcd5337` | **NotificationSettingsV2 D1 이관** + 시크릿 브라우저 노출 차단 |
| `11f06d7` | **sensService.js 삭제 — 보안 0순위 해소** |

### 🔴 핸드오프가 틀렸던 것 4가지 (다음 세션도 표를 곧이곧대로 믿지 말 것)
1. **"diagnostics·reservationDebugger 둘 다 폐기"** → reservationDebugger 를 지우면 **예약 생성이 깨진다**.
   NewReservationModal:472 가 `validateReservationData()` 로 제출을 막고 `analyzeError()` 가
   사용자에게 보이는 에러 문구를 만든다. Firebase 접점(2개 메서드)만 제거했다.
2. **"notificationScheduler 가 CF 와 중복"** → **절반만 맞았다**. 입실/퇴실 문자는 코드상 중복이지만
   **실제 발송 0건**이었다(Firestore `!=` 쿼리가 필드 없는 문서를 제외 → 영원히 빈 집합.
   실측: 예약 540건 중 마커 0건 / smsStatus 255건). 반대로 **9시 일일현황은 브라우저가 유일한 발송자**였다.
3. **"NotificationSettingsV2 폐기하고 재작성본 사용"** → **아키텍처 확정과 정면 충돌**이었다.
   확정은 "재작성본이 폐기 대상". 사용자 재확인 → **이식**으로 진행.
4. **"빠진 건 autoSendDaily 뿐"** → **5개**였다 (autoSendDaily, cancellationEnabled,
   checkInHoursBefore, checkOutHoursBefore, **title**). 재작성본이 이 필드들을 **안 쓰는 화면**이라
   재작성본 기준으로 보면 갭이 없어 보였던 것이다.

### 측정이 구해낸 값
- **Forest 패밀리의 checkInHoursBefore = 2** (나머지는 3) — 기본값으로 채웠으면 조용히 3이 됐다
- **템플릿 title 28개** — 컬럼 자체가 없어 저장이 유실될 뻔했다

### 알아둘 사실
- **SENS `testConnection()` 은 위약이었다** — 필드가 비었는지만 보고 true 를 반환한다. 문자도 안 보낸다.
  그래서 버튼을 지워도 잃는 게 없었다 (sensService.js:259-286, 삭제됨).
- **telegramService 는 봇토큰이 필요 없다** — CF 에 `{businessType}` 만 보내고 토큰은 서버가 쥔다.
  `initialize()` 는 no-op. Firebase import 0. 그래서 텔레그램 연결 테스트 버튼은 살아남았다.
- **레이트 체크아웃은 12시다** (사용자 확인). 고객 문자는 무사했다 — 배포된 CF 는 시각을 코드로
  계산하지 않고 템플릿을 쓰는데, 퇴실 템플릿 8종이 전부 "11시"였다.
  ⚠️ **별건**: 퇴실 템플릿이 레이트 체크아웃 여부로 분기하지 않는다 → 12시 결제 고객도
  "퇴실시간 오전 11시" 문자를 받는다. 기존 동작이라 손대지 않았다. **판단 필요.**
- **"알림 2번" 은 중복이 아니었다** — 신규예약·신규등록 **서로 다른 메시지 2개**였고
  사장님이 인프라봇 채널로 분리해 해결했다("신규등록"은 이 repo 에 없다 = 다른 시스템).

### ✅ 완료 — split-brain 해소 + option_settings 갭 (커밋 `4e5a1ee` `2730e27` `33665e6`)
- **`settings/option_settings` 미이관 갭 복구**: D1 에 `settings` 테이블 자체가 없어
  `late_checkout.roomStocks{Forest:1, Forest mini:2}` 와 `extra_person`(15,000원/인)이 유실돼 있었다.
  이게 없으면 **예약화면에서 레이트체크아웃이 통째로 사라진다**(NewReservationModal:845 —
  `isAvailableForRoom` 이 참일 때만 체크박스가 뜬다). `option_settings` 테이블 + `/api/option-settings`.
  → `options` 테이블과 **합치지 않았다**: id(late_checkout)가 겹치고 **독자가 다르다**
    (`options` → 옵션 목록 · `option_settings` → 노출 여부). 합치면 한쪽이 죽는다.
- **쓰기 API 신설**: `/api/rooms` `/api/options` `/api/pricing-rules` (POST/PATCH/DELETE/GET)
- **두 화면 이식**: RoomManagement(쓰기 8곳)·OptionsSettings(4곳) → Firestore 호출 0
- **객실명 변경 차단** (사용자 결정): 폼 읽기전용 + 서버 400. 이름이 7곳의 사실상 FK 이고
  레거시 연쇄는 어차피 깨져 있었다(예약 고아화 + 접두사 오염)
- **`/api/getDoc` 이 없어서 죽어 있던 로드 경로**를 `/api/option-settings` 로 고쳤다
  (OptionsSettings 는 저장된 기본옵션을 초기 커밋 이래 한 번도 못 불러왔다)

### ~~이식 대상 14개~~ → **4개** (2026-07-17 기준)
> 이 자리에 있던 14개 표는 **삭제했다.** 그 표의 판정 4개가 틀렸고(위 "핸드오프가 틀렸던 것" 참조)
> 다음 세션이 그걸 근거로 레거시를 지우려 들 위험이 실제로 있었다.
> **현재 남은 4개는 위 "다음 세션 첫 액션 → 1) 남은 Firebase 소비자 4개" 표가 유일한 진실이다.**
> 도달성은 항상 `node scripts/audit/reachability.mjs` 로 판정할 것.

### ✅ `useReservationStore` 이식 완료 (커밋 `b638879`)
쓰기 7개 → API. **API 표면 14/14 동일**(HEAD 대조) → Dashboard·useReservations 등 호출부 무수정.
순수함수 5개(`getAvailableStock` `getStatistics` `normalizePhone` `calculateCustomerGrade`
`checkAvailabilityForRange`)는 예고대로 **손대지 않았다**.

| 메서드 | 대응 |
|---|---|
| `addReservation` / `createReservationWithInventoryCheck` | `POST /api/reservations` (가드 연결됨) |
| `updateReservation` / `confirmReservation` | `PATCH /api/reservations` |
| `cancelReservation` | `PATCH { cancel:true }` · **막기면 `DELETE ?id=`** |
| `updateInventoryOverride` | `PATCH /api/inventory-override` (신규) |
| `updateCustomerInfo` | `PATCH /api/customers { op:"visit"\|"cancel" }` (신규) |

- 쓰기 후 `refresh()` 를 **await** 한 뒤 로딩을 푼다 — 방금 넣은 예약이 안 보이면 관리자가 다시 넣는다
- **`lib/legacy-write-shape.js` 신규**: Firestore camelCase → API snake_case. 순수 모듈(D1 의존 0).
  `legacy-shape.js` 의 반대 방향인데 그건 `d1.js` 를 물어 클라 번들에 못 넣는다(template-vars 와 같은 이유).
  모르는 키는 **경고 후 버린다** — 조용한 유실이 이관 버그의 주범이었다
- **`lib/customers.js` 신규**: 방문·등급 계산을 서버로. 레거시는 브라우저에서 계산했고
  `addReservation` 에 같은 코드가 복제돼 있었다 → 등급 기준 단일 소스

**의도적 동작 변경 1건 (유일) — ✅ 사용자 승인됨 (2026-07-16)**: `addReservation` 의
**클라이언트 재고 선검사를 뺐다.** 레거시는 onSnapshot 으로 항상 최신이라 브라우저 검사가
맞았지만, D1 스냅샷은 최대 30초 낡아 **빈 방을 거절**할 수 있다. 서버 가드는 단일 문장이라
낡지 않고 막힌 날짜까지 짚어준다 → 판단을 서버로 일원화.
거절 문구가 `선택한 날짜에…` → `{날짜}에 예약 가능한 객실이 없습니다…` 로 바뀐다
(둘 다 레거시에 있던 문구 — 후자가 트랜잭션 경로 문구였다).

> 📌 **"UI 임의변경 금지" 의 범위** (사용자 확인): 대상은 **디자인·UI** — 레이아웃, 화면 구성,
> CSS, 컴포넌트 배치, 조작 흐름. **에러/안내 문구 같은 텍스트는 대상이 아니다.**
> 사용자 표현: *"그건 괜찮아, 디자인이나 UI가 바뀌지 않아야 하는 걸 이야기했던 거라."*
> → 정확성·안전성을 위한 동작/문구 개선은 막지 않는다. 막는 건 **화면이 달라 보이는 것**.

**Vercel 배포 시 주입할 env**: `JWT_SECRET`, `CLOUDFLARE_*`, `D1_DATABASE_ID`,
`SENS_*`, `TELEGRAM_*`, `CRON_SECRET` (로컬 `.env.local`이 단일 소스)

## 📌 이번 세션 요약 (2026-07-16 밤 ~ 07-17)

**한 줄**: 0순위 드리프트 → 스토어 이식 → 죽은 코드 정리 → 측정 → 갭 복구 → 쓰기 API → 화면 5개 이식.
그 과정에서 **운영 버그 1건을 발견·배포**했고, **핸드오프의 전제 몇 개가 틀렸다는 것**을 밝혔다.

### 끝낸 것
| | 커밋 |
|---|---|
| inventory_overrides 드리프트 차단 (`stock` 단일 소스) + `useReservationStore` 쓰기 7개 이식 | `b638879` |
| 덤프·감사 스크립트 **영구 보관** (임시폴더 소실 위험 제거) | `a783377` |
| **죽은 코드 159개 삭제** (src/ 235 → 74) + `App.jsx` 깨진 import 수정 | `eb87704` |
| **운영 핫픽스 배포** — 예약목록 수정 저장 불가 | `96af26b` (main) |
| `settings/option_settings` 미이관 갭 복구 | `4e5a1ee` |
| rooms/options/pricing_rules 쓰기 API + **D1 불리언 버그** 수정 | `2730e27` |
| RoomManagement·OptionsSettings 이식 (**split-brain 해소**) | `33665e6` |
| 이전 세션 미커밋 WIP 보존 + functions 포맷 분리 | `a501178` `fe2c343` |
| ReservationCalendar · NewReservationModal · useCustomers 이식 | `bf2b132` `e713a1e` |
| **DataInitializer 삭제** (운영 데이터 파손 경로) | `8bf57f7` |

→ **Firebase 소비자 14 → 8** · src/ 235 → 74 · 감사 9종 전부 통과

### 틀렸던 전제 (다음 세션도 조심)
- **`Dashboard.jsx` 가 죽은 코드였다.** 이전 세션들이 이걸 살아있는 화면으로 알고 분석했다.
  실제 화면은 `App.jsx → legacy-pages` 5개 라우트다. **grep 으로 도달성을 세면 안 된다**
  (죽은 뿌리가 서브트리를 살려 보이게 한다) → `node scripts/audit/reachability.mjs`
- **이식 대상 "9개"가 아니라 14개**였고, 대신 **죽은 코드가 159개**였다
- 이 브랜치의 `vite build` 가 **아예 깨져 있었다** (`./pages` → `legacy-pages` rename 누락)
- `AI_COMPONENTS_GUIDE.md` 는 **30개 중 20개가 삭제된 파일** — 경고 헤더를 붙였다

### 이 세션에서 발견한 버그 (전부 레거시 기존 문제)
1. **예약목록 수정 저장 불가** — 호출부는 객체 1개, 훅은 인자 2개. **운영 배포로 수정 완료**
2. **취소 알림 중복** — 이미 취소된 예약 재취소 시 텔레그램 2번 (레거시 트리거는 전환에만 반응)
3. **객실명 변경 연쇄가 전부 깨짐** — 예약이 안 따라가 고아 + 부분일치로 다른 객실 오염 → **차단**
4. **객실 삭제 가드 무력** — `r.room`(없는 필드) → 예약 84건짜리도 삭제됐다 → 서버가 막는다
5. **OptionsSettings 로드가 404** — `/api/getDoc` 이 없어 저장값을 한 번도 못 불러왔다
6. **DataInitializer** — snapshot 1회 실패 → 초기화 버튼 노출 → 요금표 파손 경로
7. **D1 이 `false` 를 문자열 "false" 로 저장** — 유령 상태 유발. 바인딩 계층에서 정규화

### 내가 낸 사고 (복구 완료)
테스트 번호에 **실고객(이재호)** 이 있었는데 감사가 그 행을 덮어썼다. 덤프에서 9필드 전건 복원.
→ **`COUNT(*)` 복구검증은 "생성"만 잡고 "수정"을 못 잡는다.** 행 원본 캡처 후 행 단위 복구할 것.

## ⚠️ 정리 필요 (사소)
- ~~`NEXT_SESSION_REQUEST.md`~~ **삭제 완료** (2026-07-16). 예상대로 새 세션이 그걸 먼저 읽고
  3월 Firebase 컨텍스트로 출발했다 — 현행 핸드오프는 **이 파일 하나**.
- ~~레거시 Vite 파일 11개 미커밋 방치~~ **해소 (2026-07-17)**. 정체를 확인하고 셋으로 갈라 커밋:
  - `a501178` **취소모달+수동환불+텔레그램** (8파일 526줄) — 이전 세션의 **실제 기능 작업**이었다.
    운영(main)엔 없는 WIP. 되돌리면 영구 소실이라 사용자 결정으로 **있는 그대로 보존 커밋**.
    ⚠️ 내가 쓴 코드가 아니라 **동작 미검증**(컴파일만 확인). `telegramService` 경유 발송은
    신규 스택(서버 발송)과 충돌하므로 재작업 대상
  - `fe2c343` `functions/src/index.js` — **의미 변경 0의 prettier 재포맷**임을 검증하고 분리 커밋
    (따옴표·공백·화살표 괄호 정규화 후 대조 → 차이 70구간 전부 공백/괄호)
  - `src/services/notificationService.js` — **죽은 코드인데 미커밋 수정 101줄**. 내가 만든 게 아니고
    효과도 0(아무도 import 안 함)이라 **유일하게 남겨뒀다**. 지울지 커밋할지만 정하면 된다

## 🔴 사고 기록 — D1 실데이터 삭제 (2026-07-16, 복구 완료)
테스트 데이터를 지우려고 `DELETE ... WHERE customer_name LIKE '테스트%'` 를 실행 →
**이관된 실데이터 2건이 함께 삭제됨** (`BXDS80zPDSfoqDQYWMUR`, `wAYSl9O91aQMP1Z6wD2V`.
둘 다 고객명이 정확히 "테스트"인 예전 예약. 540 → 538).

- **복구**: 이전 세션 Firestore 덤프(`.../efb75902-.../scratchpad/dump/reservations.json`)에서
  최초 로더(`load-core.mjs`)와 동일한 매핑으로 재삽입. 옵션 3건도 CASCADE 삭제돼 함께 복구.
- **검증**: `verify-migration.mjs` 전 항목 통과 (540건 / 98,105,000원 / 옵션 366 / 상태분포 일치)
- **교훈 (반드시 지킬 것)**:
  1. **삭제는 정확한 ID로만.** 이름·패턴(LIKE) 기반 삭제 절대 금지 — 실데이터에 "테스트"라는
     이름이 실제로 존재한다
  2. 테스트 데이터는 **생성 시 받은 ID를 변수에 들고 있다가** 그 ID로만 삭제
  3. ~~덤프는 임시폴더에 있어 세션 종료 시 사라진다~~ → **영구 보관 완료 (2026-07-16)**:
     `F:\backup\choho-firestore-dump-20260716\` (12컬렉션 1.6MB).
     **repo 밖**에 둔 이유 = 고객 실명·전화번호가 들어 있어 커밋되면 그 자체가 유출.
     Firebase 폐기(Phase 8) 이후엔 재덤프가 **불가능**하니 이 폴더를 지우지 말 것.
     감사 스크립트도 `scripts/audit/` 로 옮겨 이 경로를 보도록 고쳤다.

## 🔴 사고 기록 — 실고객 행 오염 (2026-07-16, 복구 완료)
`audit-store-port.mjs` 가 테스트 번호 **01098979834** 로 고객 API 를 검증했는데, 그 번호엔
**실고객(이재호·방문 37회·누적 814만원)** 이 이미 있었다. 정리 로직이 "행 수가 늘었으면 삭제"
라서 **기존 행을 수정한 경우**를 되돌리지 못했다 → 이름이 `테스트예약` 으로 덮이고
방문 37→38 · 누적 +18만원 · 취소 36→37 · 예약배열에 테스트 ID 가 남았다.

- **복구**: 위 영구 덤프에서 전필드 복원 후 매퍼 출력과 **9필드 대조 전건 일치** 확인.
  덮어쓰기 전에 "현재 배열 − 테스트ID == 덤프" 를 먼저 검사해 **내 감사 외 변경이 없음**을
  확인하고 진행했다(아니면 중단하도록 짜뒀다)
- **교훈**: `COUNT(*)` 복구검증은 **생성만** 잡고 **수정을 못 잡는다.**
  D1 쓰기 테스트는 건드릴 행의 **원본 전체를 캡처 → 테스트 → 행 단위 복구 → 복구검증**.
  테스트 전용 번호라도 **실데이터가 있다고 가정**할 것 (이번이 정확히 그 경우였다)
- 감사 스크립트는 이 방식으로 고쳐 커밋됨 (`cust0Row` 캡처 → finally 복구 → 복구 검증 통과)

---

## 세션 기록 — 문자 버그·SENS 계정 혼선 (2026-07-16 오전, 이전 세션)

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

### 🎯 인프라 확정 (사용자 결정 2026-07-17) — **Vercel 은 기존 것 그대로, Cloudflare 만 신규**
> 이전 계획(=신규 Vercel 계정으로 이관)은 **폐기**했다. Vercel 계정 이관 안 한다.
> **신규는 Cloudflare(D1) 뿐이다.** 도메인 구조는 3-tier 그대로 간다.

| 도메인 | 역할 | 지금 붙은 Vercel 프로젝트 (구/Pro 계정 실측) |
|---|---|---|
| `chorigol.co.kr` + `www` | 메인 홈페이지 | `choho` |
| `rv.chorigol.co.kr` | **예약시스템 = 이 repo**. 최종 주소 | **`rv-chorigol-co-kr`** ← 지금 라이브 |
| `admin.chorigol.co.kr` | 별개 관리자 대시보드(통계) — 추후 구축. **이 앱 아님** | 🔴 **어느 프로젝트에도 안 붙어 있다** (DNS 는 `cname.vercel-dns.com` 만 떠 있어 지금 열면 404) |
| `api.chorigol.co.kr` | CF Worker (Phase 6) | 🔴 **DNS 자체가 없다** |

⚠️ `chorigol.**net**` 계열(`chohopark`·`admin-chohopark` 프로젝트)은 **별개 브랜드사이트다 — 건드리지 말 것.**

✅ `choho-admin` 프로젝트 **삭제 완료** (2026-07-17, 사용자 지시 "내가 만든거니깐 지워도 된다").
   `auto.polaai.co.kr` 도 같이 죽었다(사용자 확인: "죽어도 되"). 이름이 이 repo 의
   `package.json` name(`choho-admin`)과 같아 혼동을 유발하던 유령 프로젝트였다.

📌 **`admin.chorigol.co.kr` 은 이관이 끝난 뒤 새로 만든다** (사용자 결정 2026-07-17).
   지금은 어느 프로젝트에도 안 붙어 있다(범용 CNAME 만 떠 있어 404). **이 repo 와 무관** —
   통계 대시보드 전용 별도 앱이다. 지금 건드릴 것 없다.

### 🔑 Vercel — **구 계정(Pro) 하나만 쓴다** (2026-07-17 실측 확정)
| env 키 | 계정 | 플랜 | 용도 |
|---|---|---|---|
| **`VERCEL_TOKEN_RV`** | **mkt9834@gmail.com** (team_Gwjg6taUVyH9b1X1ZZ3ozWX9 = `mkt9834-4301s-projects`) | **Pro** | ✅ **이게 유일한 배포 경로다** |
| `VERCEL_TOKEN` | chohopark134@gmail.com (team `chohopark`) | Hobby | ❌ **안 쓴다** (이관 폐기). chorigol 도메인 자체가 없다 |

- **`.vercel/project.json` 은 이미 맞다** — `rv-chorigol-co-kr` @ 구 계정. 고치지 말 것
- **Pro 라서 Vercel Cron 제한이 없다**(Hobby 는 2개·하루1회). 크론 3개 등록 가능 → `vercel.json` 참조
- **`VERCEL_TOKEN`(새 계정)으로 라이브 rv 를 조회하면 `forbidden`** — 거기서 막히면 토큰을 잘못 골랐다
- **사용자 방침: 팀 토큰 안 쓴다. 토큰은 프로젝트별로 값이 다르다.** 덮어쓰지 말고 각각 구분해 보관

### ✅ 배포는 `main` push 자동배포 — CLI 아니다
`rv-chorigol-co-kr` 은 **GitHub 연결**이다: `pola2025/rv.chorigol.co.kr`, production branch `main`.
최근 배포 전부 `git:main@<sha>` 소스. → **운영 반영 = `git push origin main`**.

**🚨 이 폴더에서 `vercel --prod` 치지 말 것.** `.vercel/project.json` 이 **라이브 rv** 를 가리켜서
현재 체크아웃된 브랜치(이관 중인 Next 앱)가 라이브를 덮는다. 운영 수정은 **main 워크트리**에서.

> ✅ **다운타임 리스크는 사라졌다** (2026-07-17 인프라 확정). 계정 이관을 안 하므로 rv 도메인을
> 떼었다 붙일 일이 없다. **컷오버 = `main` 머지 = 평소 배포와 동일**하다.

⚠️ **프로젝트 설정 하나는 컷오버 전에 반드시 바꿔야 한다** (실측):
`rv-chorigol-co-kr` 은 **framework 미설정**(= Vite 정적 빌드 전제)이고 `buildCommand` 도 기본이다.
main 에 Next 코드가 들어가는 순간 **framework 를 `nextjs` 로 바꿔야** 정상 빌드된다.
`package.json` 의 `build` 는 이미 `next build` 로 바꿔뒀다. nodeVersion 은 24.x 라 문제없다.

## 🚑 운영 핫픽스 배포됨 (2026-07-16, `96af26b`) — 예약목록 수정 저장 불가
**증상**: 예약목록 화면에서 예약을 수정·저장하면 "예약 수정에 실패했습니다" — **캘린더에선 정상**.
```
ReservationsPage:34  await updateReservation({ id, ...data })   ← 객체 1개
useReservations.js:52 mutateAsync: (id, data) => ...            ← 인자 2개
→ 스토어가 reservationId={객체}, updates=undefined → doc(db,'reservations',{객체}) 에서 던짐
```
확정·취소는 시그니처가 맞아 정상이라 **이 증상만 고립**돼 있었다. 라이브 커밋
c3b1510("예약 수정 기능 구현 및 버그 수정")은 이 파일을 건드리지도 않았다 — **버그는 그보다 오래됐다.**

- 이관과 무관한 기존 운영 버그 → **main 에 직접 수정 후 push → 자동배포 완료**
- **검증**: 배포 READY(production=96af26b) / rv.chorigol.co.kr 200 /
  **라이브 번들에서 두 호출부 모두 `await n(u,h)` 두 인자 확인** (깨진 `{id:` 스프레드 소멸)
- 같은 수정을 이 브랜치에도 적용(`b3d2752`, 경로만 `legacy-pages`)
- 교훈: 운영 핫픽스는 **최소 diff**. 포매터 훅이 파일 전체를 재포맷해(30+/14-) 다시 만들었다
  → Edit/Write 대신 bash(python)로 패치하면 훅이 안 돈다. 최종 diff 3+/1-
- **함께 올라간 것**: `9ece739`(이전 세션 미푸시 — functions/·d1/·문서. 화면 영향 0, Functions 는 별도 배포됨)

### 컷오버 순서 (2026-07-17 개정 — **계정 이관 폐기로 단순해졌다**)
1. **비번 설정** — `node scripts/set-admin-password.mjs` (안 하면 새 앱에 아무도 못 들어감)
2. **`rv-chorigol-co-kr` 프로젝트 설정: framework → `nextjs`** (지금은 미설정 = Vite 전제)
3. **env 주입** (구/Pro 계정 `rv-chorigol-co-kr` 에): D1·SENS·TELEGRAM·JWT_SECRET·CRON_SECRET.
   **`CRON_SMS_ENABLED` 는 아직 넣지 말 것** (5번 참조)
4. **미리보기 배포로 검증** — 브랜치를 push 하면 Vercel 이 preview URL 을 준다.
   rv 무영향. 로그인·캘린더·알림 실동작 확인
5. 🔴 **문자 이중발송 차단 — 순서 절대 지킬 것**
   ① CF 스케줄러부터 죽인다: `firebase functions:delete autoSendSMSScheduler --project choho-pension`
   ② **그 다음** Vercel 에 `CRON_SMS_ENABLED=true` 주입
   → 순서를 바꾸면 고객이 입실·퇴실 문자를 **두 번** 받는다 (CF 는 Firestore, 크론은 D1 을 본다.
     서로의 발송 이력을 모른다 → 중복가드가 안 통한다)
6. **`main` 머지 = 컷오버.** 도메인 이동 없음 → **무중단**
7. Firebase 2주 보존 후 폐기 (Phase 8)

**되돌리기**: main 을 이전 커밋으로 되돌리면 Vite 앱이 다시 뜬다(같은 프로젝트라 도메인 그대로).
단 5번 ①을 이미 했으면 CF 스케줄러는 재배포해야 한다.
- 폴더명 `F:\rv-chorigol.co.kr`(하이픈)과 도메인 `rv.chorigol.co.kr`(서브도메인)은 다르다.
  `rv-chorigol.co.kr`(하이픈)이라는 도메인은 존재하지 않음 — 폴더 이름일 뿐

### DNS 실측 (2026-07-16 확인)
| 도메인 | 상태 | 소유 |
|---|---|---|
| `rv.chorigol.co.kr` | **HTTP 200 · "펜션 관리자"** — 현재 라이브(Vite+Firebase) | 구 Vercel 계정 |
| `admin.chorigol.co.kr` | **HTTP 404** — DNS·소유권 인증 완료, 앱 미배포 | 새 계정 chohopark134 |
| `chorigol.co.kr` | HTTP 307 | — |
| `www.chorigol.co.kr` | HTTP 200 | — |

**신규 Next+D1 앱은 아직 어디에도 배포되지 않았다.**

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
- **덤프 위치(영구)**: `F:\backup\choho-firestore-dump-20260716\*.json` — 12컬렉션 1.6MB.
  **repo 밖**이다(고객 실명·전화번호 = PII. 커밋되면 그 자체가 유출).
  Firebase 폐기 후엔 재덤프 불가 → **이 폴더를 지우지 말 것**
- 로더/복구 스크립트: `scripts/migration/` (load-core·load-logs·dump-all·restore-deleted·fix-overrides).
  전부 위 영구 덤프 경로를 보도록 고쳐 두었다 — 실데이터 삭제 사고 때 복구에 쓴 것들이다
- 감사 스크립트: `scripts/audit/` (verify-snapshot·verify-migration·audit-override·audit-store-port·
  audit-inventory·audit-api-guard)

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

### 예약 편집 UI (2026-07-16 완료, 커밋 `22dc95b` + `b447fc9`)
캘린더 날짜별 목록에서 예약을 누르면 모달 → 수정 / 확정 / 취소.
- `app/calendar/EditReservationModal.jsx` (수정폼 / 확정확인 / 취소+환불계산 3단)
- `lib/refund-policy.js` — 레거시 `src/constants/refundPolicy.js` 이식.
  요율 그대로 (2일전 20% / 3~4일 50% / 5~6일 70% / 7일+ 90% / 당일·1일전 0%).
  레거시와 95케이스 출력 완전 일치 확인. `src/`는 컷오버 후 삭제라 신규 스택이 참조 안 하게 옮김

**설계 결정:**
- **status는 폼에서 직접 못 바꾼다.** 확정/취소는 실제 문자·텔레그램이 나가므로 전용 버튼 +
  확인 단계로만. 폼 저장하다 실수로 알림이 나가는 경로를 아예 없앰
- **미저장 변경이 있으면 확정/취소 비활성** — 낡은 값으로 문자가 나가는 것 방지
- 확정 확인 화면에 **수신번호를 명시**. 막기 예약이면 "알림 없음"으로 문구 분기
- `window.confirm` 미사용 — 브라우저 모달은 자동화·UX 양쪽에 나쁨. 인앱 확인 단계로

**주의**: 확정 = 실제 고객에게 문자 발송. 테스트는 **반드시 `source="막기"`** 로만
(`notifyReservation` 첫 줄에서 스킵). 비-막기로 POST 하면 즉시 실채널 텔레그램이 나간다 —
알림 없이 픽스처가 필요하면 API 말고 `lib/reservations.js`의 `createReservation` 직접 호출

### 기타 완료
- **Next.js 15 도입** (React 19 호환. Next 14는 React19 미지원). `app/` App Router, Vite `src/`와 공존
- **src/pages → src/legacy-pages 이름변경**: Next가 레거시를 Pages Router로 오인하는 문제 해결
- `next.config.mjs`: eslint.ignoreDuringBuilds (Vite eslint가 Next 서버코드와 충돌 — 컷오버 시 교체)

## Phase 5 완료 — 인증 (2026-07-16, 커밋 `77ed3a4`)

**결정 (사용자 지정)**: 관리자 `choho140@naver.com` 1개 · 세션 **30일** · 비번은 사장님이 직접 설정

| 파일 | 역할 |
|---|---|
| `middleware.js` | 전 경로 차단. 공개는 `/login`, `/api/auth/*` 뿐. API는 리다이렉트 대신 **401** |
| `lib/auth-jwt.js` | jose HS256 발급·검증 + `requireAuth`. **Edge 안전** |
| `lib/auth.js` | scrypt 해싱·검증(timing-safe), 계정조회, 로그인시도, IP rate limit |
| `app/api/auth/login` · `logout` | 로그인/로그아웃 (login은 `runtime="nodejs"` 고정) |
| `app/login` · `app/nav.jsx` | 로그인 화면 / 로그아웃 버튼 (로그인 화면에선 nav 숨김) |
| `scripts/set-admin-password.mjs` | **사장님 전용** 비번 설정 |

### ⚠️ 런타임 경계 (반드시 지킬 것)
**미들웨어는 Edge라 `node:crypto`가 없다.** 그래서 JWT(jose)와 비번(scrypt)을 파일로 갈랐다.
- `middleware.js`는 **`lib/auth-jwt.js`만** import. `lib/auth.js`를 import하면 미들웨어가 통째로 깨진다
- 비번을 다루는 라우트는 `export const runtime = "nodejs"` 필수

### 쿠키 (web-architecture.md 준수 — 검증됨)
`Domain 생략(호스트한정)` / `HttpOnly` / `SameSite=Strict` / `Secure는 운영에서만` / `Max-Age=2592000`
- **부모도메인(.chorigol.co.kr) 쿠키 절대 금지** — 메인 XSS 1번에 admin 세션이 털린다
- 로컬(http)에서 Secure 쿠키가 안 붙는 문제 때문에 `NODE_ENV==='production'` 조건부

### 보안 처리
- JWT_SECRET 없으면 **던진다** (조건부 인증 스킵 금지). 유출 시 교체하면 전 세션 무효화
- alg 화이트리스트 `["HS256"]` — alg=none/RS256 혼동 공격 차단 (테스트로 확인)
- 열거 방지: 계정없음/비번틀림 **같은 메시지** + 계정 없어도 비교 수행
- rate limit: 같은 IP 15분내 실패 5회 → 429 (맞는 비번도 차단)
- **쓰기 API는 미들웨어 + `requireAuth` 이중 방어** (security.md 2번)

### 남은 것
- **`admins` 0건 → 아무도 로그인 못 함.** 위 "에이전트가 완료해야 할 관리자 비밀번호 설정" 참조
- 레거시 `src/utils/authSecurity.js`의 `ALLOWED_ADMINS`는 플레이스홀더(`admin@choho-pension.com`)라
  사실상 죽은 코드. 실제 관리자 목록은 `firestore.rules` 9-12행 (3개)
- Firebase Auth 비번 해시는 이관 안 함 — 신규 스택은 새 비번 (스키마 주석대로)

## 🔄 레거시 화면 이식 (진행중) — "rv 모양 그대로"

### 측정된 범위 (추측 아님 — 의존성 폐포 실측)
5개 화면 + MainLayout 에서 도달하는 것: **41 파일** (컴포넌트 23 / 로직 18) · CSS 16
**Firebase 접점은 14개뿐** → 나머지 27개는 손 안 대고 옮긴다.

### 핵심 이음새: 컴포넌트는 Firestore 모양을 기대한다
`useFirebaseStore` 가 7개 컬렉션을 실시간으로 받아 **모든 컴포넌트에 뿌리는 허브**다.
컴포넌트들은 그 모양을 그대로 쓴다 — `rooms`는 **한글필드**(`객실명`·`재고`), `reservations`는
**camelCase**(`roomName`·`checkIn`), `overrides`는 **doc.id 맵**.
→ **스토어만 갈아끼우면 컴포넌트 23개는 무수정.** 이게 이식 전략의 전부다.

### ✅ 완료
| | 커밋 | 검증 |
|---|---|---|
| `lib/legacy-shape.js` — D1 → Firestore 역매퍼 | `1905864` | **18/18** 원본 덤프와 전건 대조 |
| `/api/snapshot` + `/api/version` heartbeat | `3fd219b` | 10/10 |
| `useFirebaseStore` — onSnapshot 7개 제거 | `18a629c` | **18/18** API 표면 동등성 |
| 재고 가드 → 쓰기 API 연결 | `18a629c` | **19/19** 동시 8건→2건만 |
| override 드리프트 차단 (`stock` 단일 소스) | `b638879` | **25/25** 쓰기 후 가드==매퍼 |
| `useReservationStore` — 쓰기 7개 → API | `b638879` | **49/49** + API 표면 14/14 |

**역매퍼 검증이 이식의 전제였다**: rooms 7 / reservations 540 / options 4 / pricingRules 4 /
customers 402 / overrides 26 를 원본 Firestore 덤프와 **전필드 대조** + 레거시 orderBy 재현 확인.

### 폴링을 "번역"하지 않고 없앴다 (실측 근거)
```
1초 폴링(매번 전부 읽기)  68,688,000 rows/일 → 무료한도(5M)의 1374% ❌
스냅샷 + 30초 heartbeat        2,400 rows/일 →              0.05% ✅
```
**변경을 만드는 사람이 관리자 본인**이라 물어볼 이유가 거의 없다. 로드 1회 + 쓰기 후 `refresh()`.
`idx_res_updated` 인덱스로 `MAX(updated_at)` **rows_read 540 → 1** (없으면 heartbeat 가 무의미).

### 🐞 이 과정에서 발견·수정한 이관 버그 (전부 로더의 체계적 결함)
| 버그 | 증상 | 수정 |
|---|---|---|
| `inventory_overrides.date/stock` 26건 NULL | **막아둔 날 19건이 통째로 무시** (9/1~9/3 전객실 차단이 안 먹힘) | ID에서 파싱 복원 (9/9) |
| `options.applicable_rooms` 타입 혼동 | 로더가 `selectedRooms \|\| applicableRooms` 로 **모드+목록을 한 컬럼에 뭉갬** → OptionsSettings 화면이 깨짐 | `selected_rooms` 컬럼 추가 후 분리 (`f2cf246`) |
| 예약 5건 옵션 유실 | 원본이 `["숯불바베큐"]` **문자열배열**인데 로더가 `if(!o.name) continue` 로 걸름 | 덤프에서 복구. **price=0** (레거시가 문자열을 0으로 읽음 — 표준가 넣으면 `{현장결제}` 금액이 달라짐) |
| `customers.marketingConsent` | 원본 `false` → SQLite 에 `0` 저장 → 매퍼가 그대로 반환 | `!!` 변환 |
| `customers.reservations` 미이관 | 예약ID 배열. 읽는 화면은 없으나 `useReservationStore` 가 append 함 | 컬럼 추가 + 402건 백필 |

### ⚠️ 무해 확인된 유실 (복구 불필요 — 근거 있음)
- `selectedOptions` → 모달이 `options` 에서 **역산**한다(NewReservationModal:170-183). `options` 가 있으면 DB값을 덮어씀
- `dailyPrices` → 모달이 **로컬 계산**하는 출력값. initialData 에서 읽지 않음
- `confirmedAt` → **쓰기 전용**, 읽는 곳 없음

### ✅ inventory_overrides 드리프트 해소 (커밋 `b638879`) — `stock` 이 단일 소스
재고 override 를 읽는 곳이 **두 군데**였다(가드는 `stock` 컬럼, 매퍼는 `data.available`).
백필 덕에 우연히 일치할 뿐이라 `updateInventoryOverride` 를 그대로 이식하면 어긋날 상황이었다.

**측정 결과** — 키형식 23행은 이미 `stock == data.available`(드리프트 0), 불일치 3건은 전부
`stock`=NULL 인 **랜덤 id 죽은 행**뿐이었다 → 폴백만 남기면 출력이 한 값도 안 변한다.

- 매퍼: `SELECT id, stock, data` → `o.stock ?? data.available` (폴백 = 랜덤 id 3건 전용)
- 쓰기(`setOverride`): `stock`+`date`+`room_name`+`data` **동시 갱신**. data 는 `json_patch` 머지
  (레거시 `setDoc(...,{merge:true})` 동등 — createdAt 등 보존)
- **증명**: `audit-override.mjs` 25/25 — 쓰기 후 **가드 == 매퍼** 대조. 갱신·삭제·머지 전부.
  역매퍼 18/18 유지 확인

> `date`·`room_name` 을 반드시 채울 것. 비면 가드가 `WHERE room_name=? AND date=?` 로 못 찾아
> **막아둔 날이 통째로 무시**된다 (이관 버그가 정확히 그거였다).

### 🚨 측정으로 드러난 것 (2026-07-16 · 전부 실측)

**1. ~~split-brain~~ → ✅ 해소** (`33665e6`). RoomManagement·OptionsSettings 쓰기가 `/api/*` 로 갔다.

**2. ~~`settings/option_settings` 미이관~~ → ✅ 복구** (`4e5a1ee`).
"어느 쪽이 진실이냐"의 답: **둘 다 진실이고 독자가 다르다** — `options/late_checkout` 은 useOptions →
옵션 목록(이름·가격), `option_settings/late_checkout` 은 useLateCheckoutSettings → **노출 여부**(roomStocks).
합치면 한쪽이 죽고, id 가 같아 한 테이블에 넣을 수도 없다 → 별도 테이블로 미러.

**2-1. 🐞 D1 이 JS `false` 를 문자열 "false" 로 저장한다** (`2730e27` 에서 수정)
SQLite 는 동적 타입이라 INTEGER 컬럼에 그대로 들어간다 → `WHERE is_active=1` 은 안 걸리는데
역매퍼 `!!"false"` = true → **"목록엔 없는데 화면엔 활성"** 인 유령 상태. `lib/d1.js` 바인딩 계층에서
0/1 로 정규화했다. 기존 데이터 전수 검사 → 오염 0건. **새 코드에서 불리언을 넘길 때 주의.**

**3. ~~보안 — `sensService.js` 가 SENS 키 원문을 브라우저로 내린다~~ → ✅ 삭제** (`11f06d7`, 2026-07-17)
`settings/notifications_v2_*` 에서 `accessKey`/`secretKey` 를 클라이언트가 `getDoc` 으로 읽어
`fetch` POST 바디에 실어 보냈다 → DevTools Network 에 원문 노출. **4개월간 0순위였던 항목.**
NotificationSettingsV2 이식(`fcd5337`)으로 마지막 소비자가 사라져 죽은 파일이 됐고 삭제했다.
`lib/sms.js` 가 서버 전용 `process.env` + HMAC 으로 100% 대체한다.

**4. ~~`DataInitializer` 파괴 경로~~ → ✅ 삭제** (`8bf57f7`)
시드값이 이미 틀려 있었다: `Forest` 기본요금을 **180,000 → 150,000** 으로 되돌리고 지금은 없는
`단체예약` 객실을 만든다. "일시적 snapshot 실패 → rooms=[] → 초기화 버튼 노출 → 클릭 → 요금표 파손"
이 성립했다. 컴포넌트째 삭제.

**5. ~~`RoomManagement` 의 조용히 깨진 로직~~ → ✅ 해소** (`33665e6`)
`r.room`(없는 필드) 가드 2개를 걷어내고 서버가 판정한다. 삭제 가드는 이제 실제로 걸린다
(Forest 활성예약 84건 → 409).

**6. ⚠️ `AI_COMPONENTS_GUIDE.md` 는 낡았다** — 언급하는 30개 중 **20개가 삭제된 파일**이다.
이런 문서를 근거로 판단해서 이전 세션들이 Dashboard.jsx(죽은 코드)를 살아있는 화면으로 알았다.
경고 헤더를 붙여뒀다. **살아있음의 근거는 `node scripts/audit/reachability.mjs` 뿐이다.**

### 남은 것 (2026-07-17 갱신 — 맨 위 "다음 세션 첫 액션" 이 정본)
1. ~~option_settings 갭~~ / ~~알림설정 갭 5개~~ / ~~sensService 삭제~~ ✅ 완료
2. **Firebase 소비자 4개** — App · LoginScreen · SmsHistoryTable · notificationScheduler
3. `src/config/firebase.js` 제거 → Vite 의존 정리 (위 4개가 다 빠진 뒤)
4. **입실·퇴실 스케줄러 + 9시 리포트 → Vercel Cron 으로 한 번에** (🔴 컷오버 블로커).
   ~~중복인지 확인~~ → **확인 완료**: 입실/퇴실은 실제 발송 0건이었고(제거함),
   9시 리포트는 **브라우저가 유일한 발송자**다. 상세는 맨 위 "2) 컷오버 블로커" 참조
5. `src/scripts/*` 4개 — Firebase 폐기(Phase 8) 때 함께 정리
6. ~~`notificationService.js` 미커밋 101줄~~ ✅ 보존 커밋(`80ecfc2`) 후 삭제(`70add23`)
7. 재작성본 `app/notifications`·`app/calendar` 등 정리 — 레거시 화면을 Next 로 올릴 때 대체된다

## 🧹 죽은 코드 159개 삭제 완료 (커밋 `eb87704`) — src/ 235 → 76

**`grep` 으로 "import 0" 을 세면 안 된다.** 실제로 겪은 함정:
- **`Dashboard.jsx` 자체가 죽은 코드**였는데 컴포넌트 20여 개를 import 해서, 그것들이
  "누가 import 하니 살아있다"로 오판된다. **죽은 뿌리가 서브트리를 살려 보이게 한다.**
  (이전 세션이 Dashboard 를 살아있는 화면으로 알고 분석했다 — 실제 화면은 `App.jsx → legacy-pages` 5개)
- 주석 속 언급이 import 로 오인된다
- 동명이인: `ReservationList` 4종, `NotificationSettings` v1/v2, `marketing/` 과 `marketing-v2/` 에
  같은 파일명 `MarketingStatsV2.jsx` 두 벌

→ `scripts/audit/reachability.mjs` — 진짜 진입점(index.html→main.jsx, Next 규약 app/**/page|route|layout,
middleware.js)에서 BFS. 정적·동적 import, require, **re-export**, **CSS `@import`** 까지 따라간다.

**CSS 구멍**: 1차 그래프는 JS 만 봐서 `index.css` 의 `@import './styles/ui-enhancements.css'` 와
`App.css` 의 `@import './styles/*-optimization.css'` 를 놓쳐 CSS 3개를 지웠다 → **빌드가 깨져서 발견**.
CSS→CSS 연쇄를 추가하고 전량 복구 후 재삭제했다. **빌드 검증이 없었으면 스타일이 조용히 깨졌다.**

**검증**: 삭제 전후 Vite 번들이 **완전히 동일**(889.45 kB, 해시 D_AA_jaL 까지) → 159개가 빌드에
1바이트도 기여하지 않았다는 증거. Next 빌드 통과. 전부 git 추적 파일이라 복구 가능.

**부수 수정**: `src/App.jsx` 가 `./pages` 를 import 하는데 그 폴더는 `legacy-pages` 로 이름이 바뀌어
있었다(커밋 5629f77 이 import 를 안 고침) → **이 브랜치의 `vite build` 가 아예 실패 중**이었다. 1줄 수정.

## 🔒 재고 가드 완료 (2026-07-16, 커밋 `c3d2257` + API연결 `18a629c`) — `lib/inventory.js`

> ⚠️ **가드는 만드는 것보다 모든 쓰기 경로에 꿰는 것이 핵심.** 처음엔 `lib/inventory.js` 를
> 만들어놓고 API 는 무가드 `createReservation` 을 쓰고 있어서 **화면에서 예약하면 오버부킹이 났다**.
> 새 쓰기 경로를 추가할 때마다 가드를 탔는지 확인할 것.

### 발견: 현행(Firestore)은 오버부킹을 못 막고 있다
`useReservationStore.js:509-518`이 예약목록을 `runTransaction` **밖**에서 `getDocs`로 읽고,
안에서는 그 **낡은 배열**로 센다. `transaction.get`은 override 문서 하나뿐 → 충돌 감지 없음.
**동시 예약이 같은 스냅샷을 보고 둘 다 통과하는 TOCTOU.** 540건에 오버부킹 0건인 건
트랜잭션 덕이 아니라 **동시성이 낮아서**(관리자 1~2명 수기 입력).

### 해법: 단일 문장 원자성
D1엔 대화형 트랜잭션이 없지만 **한 문장은 원자적**이고, D1은 쓰기를 단일 primary로 직렬화한다.
재고검사를 INSERT/UPDATE의 `WHERE`에 넣어 통과할 때만 쓰이게 했다 → **레거시보다 엄격**.
- `insertGuarded` / `updateGuarded` / `diagnose` / `availableStock`
- **UPDATE도 반드시 가드** — INSERT만 막으면 취소→확정 되돌리기·날짜수정으로 점유가 되살아남
- `x.id != ?4` **자기제외 필수** — 없으면 재고 1짜리 방이 자기가 자기를 막는다
- 숙박 **60박 상한** — CTE가 쓰기락 잡은 채 폭주하는 사고 차단

### 재고 규칙 (레거시 이식 + override만 교정)
```
1) rooms에 객실 없으면 → 0            (override보다 먼저 — 레거시 순서)
2) 정원 = override.stock ?? rooms.stock ?? 0
3) 남은재고 = max(0, 정원 - 점유예약수)
4) 점유: check_in <= d < check_out · 취소 제외 · 막기도 점유로 셈
5) source='막기' → 검사 스킵 (레거시 동일)
```
- `재고` = D1 **`stock`** 컬럼 (`base_stock`=`기본재고`는 별개). **`base_stock` 폴백 넣으면 틀림**

### ⚠️ override 의미 교정 (사용자 결정 B안 · 레거시와 유일하게 달라지는 점)
레거시는 override를 "남은 재고 **절대값**"으로 읽어 **예약수를 차감하지 않았다** →
`2025-08-15 호수뷰객실`(ov=6·예약=6·만실)을 "6실 남음"으로 판단해 **계속 받던 버그**.
→ override = **정원**으로 해석해 차감. 저장값 4건이 전부 `rooms.stock`과 같아 **데이터 변환 불필요**.
- 달라지는 날: `2025-08-15 Forest 패밀리`, `2025-08-15 호수뷰객실` (둘 다 만실 → 이제 막힘). 그 외 전건 동일

### 🐞 inventory_overrides 이관 버그 (수정 완료)
`date`·`stock`이 **26건 전부 NULL**이었고 실값은 `data` JSON에만 → **막아둔 날 19건이 통째로 무시**됨
(9/1~9/3 전객실 차단이 D1에선 예약을 받는 상태였음). ID(`{date}_{room}`)에서 파싱해 복구, 9/9 검증 통과.
- **레거시는 override를 문서 ID로 조회**하므로 **ID가 진실**. json.roomName은 낡을 수 있음(단체예약→단체-워크샵)
- 랜덤 id 3건은 레거시가 `doc(id)`로 못 읽는 **죽은 데이터** → NULL 유지해 동일하게 무시

### 감사 (23건 통과) — `scripts/audit/audit-inventory.mjs`
- 동등성 **2,940건 대조**(5객실×420일) — 가드SQL == 확정규칙 불일치 0
- **동시 8건 → 정확히 2건만 성공, 실점유 2, 오버부킹 0** ← 레거시가 못 하던 것
- 없는 객실 거절 / 막기 통과 / 진단 날짜특정 / UPDATE 자기제외 / D1 원상복구

### fable 교차검증에서 나온 미반영 권고 (다음 세션 검토)
- **`calendar` 유틸 테이블**(2020~2035 날짜)로 CTE 대체 → 트리거에서 CTE 금지라 트리거화의 전제
- **BEFORE INSERT/UPDATE 트리거**로 가드를 DB 제약화 → 모든 쓰기 경로 자동 커버 (백필 후에 생성할 것)
- 스키마 보강: `UNIQUE(rooms.name)`, `UNIQUE(inventory_overrides.room_name,date)`,
  `CHECK(check_out >= check_in)`, `status NOT NULL DEFAULT '입금대기'`,
  `INDEX(reservations.room_name, status, check_in, check_out)`
- **REST `/query`는 control-plane API** — 글로벌 rate limit(~1200req/5분) 공유, 지연 큼.
  `web-architecture.md`대로 **D1 Proxy Worker** 뒤로 옮길 것 (Phase 6)
- HTTP 재시도 중복: 클라 생성 `id`를 멱등키로 — PK 충돌은 성공으로 처리

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
| **이미 취소된 예약 재취소** | 스킵 (`{skipped:"already_cancelled"}`) — 아래 참조 |

> 🐞 **취소 알림 중복 (2026-07-16 수정, `b638879`)**: PATCH 가 `status='예약취소'` 를 보기만 하면
> 무조건 취소 텔레그램을 보냈다 → 중복 클릭·재시도 시 고객에게 **두 번** 나간다.
> 레거시 트리거는 `statusChanged && after.status==='예약취소'` 로 **상태 전환에만** 반응했다
> (`reservationTriggers.js:627`) → 동일하게 `before.status` 를 보고 스킵하도록 고침.

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
- `inventory.js` — 재고 가드(insert/updateGuarded·diagnose·availableStock) + **override 쓰기**(setOverride/deleteOverride)
- `customers.js` — 방문·등급·취소 카운트 (**등급 기준 단일 소스**)
- `legacy-shape.js` — D1 → Firestore 원형 (읽기, 서버 전용)
- `legacy-write-shape.js` — Firestore 원형 → API (쓰기, **순수 모듈** — 스토어가 브라우저에서 쓴다)
- `app/api/`: reservations(POST/PATCH/GET/**DELETE**), notifications(PATCH), health(GET),
  snapshot·version(GET), **inventory-override(PATCH)**, **customers(PATCH)**

### DELETE 는 막기 전용 (의도된 제약)
레거시 `cancelReservation` 은 `source='막기'` 만 완전 삭제하고 일반 예약은 취소 상태로 남긴다
(매출·환불 이력이 사라지면 안 되므로). 그 규칙을 **서버에서 강제**한다 — 클라 버그가 실예약을
지우는 경로 자체를 없앴다. 일반 예약 DELETE 는 400.
- 레거시에서 무제한 `deleteDoc` 을 하던 `ReservationModal.jsx` 는 **import 하는 곳이 0인 죽은 코드**라
  이 제약으로 잃는 기능이 없다 (확인함). 살아있는 모달은 `BookingModal`

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
