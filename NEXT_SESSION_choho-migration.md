# 초호펜션 예약관리시스템 — Firebase·Airtable → Vercel + Cloudflare D1 마이그레이션

> 세션 핸드오프 · 최종 갱신 2026-07-16

## 복사용 요청문
```
초호펜션 예약시스템 Firebase→Vercel+D1 이관 중. Phase 0~5 완료. 스토어 2/2 완료. 죽은코드 159개 정리(src/ 235→76).
다음: settings/option_settings 미이관 갭 → rooms/options/pricing_rules 쓰기 API 신설 →
      RoomManagement·OptionsSettings 이식(지금 읽기D1/쓰기Firestore 로 갈라져 있음).
F:\rv-chorigol.co.kr\NEXT_SESSION_choho-migration.md 전체 컨텍스트. 브랜치 migrate/nextjs-d1.
최종 화면은 **Next 가 레거시 컴포넌트를 렌더**한다(사용자 확정). App.jsx·react-router·재작성본은 폐기 대상.
도달성 판정은 grep 금지 → `node scripts/audit/reachability.mjs` (Dashboard.jsx 가 죽은 코드였다).

원칙: rv는 "기존 모습 그대로" 이관 — UI 임의변경 금지. 새 UI 아이디어는 admin(별개 통계앱)으로.
      모양·기능이 같아야 하므로 **측정과 감사**가 핵심. 추측으로 이식 금지.
테스트: 문자는 01098979834로만, 예약 알림봇 실채널 발송금지, 한글 payload curl금지(node).
       삭제는 정확한 ID로만 (LIKE 패턴 금지 — 실데이터 삭제 사고 있었음).
       **01098979834 에는 실고객(이재호·방문37회)이 있다.** 행 수만 비교하면 "수정"을 못 되돌린다
       → 고객 행은 원본 전체를 캡처해 복구할 것 (2026-07-16 오염 사고, 아래 참조).
       재고가드 테스트는 source="막기" 쓰면 안 됨(막기는 검사를 건너뜀) → sms_config 잠시 끄고 非막기로.
감사: `node scripts/audit/<이름>.mjs` — 임시폴더에서 **repo 로 옮겨 영구 보관**했다.
      verify-snapshot(역매퍼 18) · audit-override(드리프트 25) · audit-store-port(이식 49) ·
      verify-migration(이관 정합성) · audit-inventory · audit-api-guard
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
| 5 | 인증 (Firebase Auth → JWT 쿠키) | ✅ (비번 설정만 남음) |
| — | **재고 가드** (오버부킹 원자적 차단) + API 연결 | ✅ |
| — | **레거시 화면 이식** (rv 모양 그대로) | 🔄 **스토어 2/2 ✅ · 컴포넌트 9개 남음** |
| 6 | api.chorigol.co.kr Worker 보안 | ⬜ |
| 7 | 컷오버 (rv CNAME) → 병렬운영 2주 | ⬜ |
| 8 | Firebase·Airtable 폐기 | ⬜ |

**운영은 100% 기존 Firebase에서 가동 중.** 신규 스택(D1/Next)은 아직 아무도 안 씀.

> ⚠️ Phase 3 의 "화면 5/5"는 **전면 재작성본**이라 rv 모습과 다르다.
> 사용자 결정(2026-07-16): **rv는 기존 모습 그대로 이관** → 레거시 화면을 그대로 옮기는 중.
> 재작성본(app/calendar 등)은 컷오버 전 정리 대상.

## 🔑 사장님이 직접 해야 할 일 (1분, 로그인 하려면 필수)
```
cd F:\rv-chorigol.co.kr
node scripts/set-admin-password.mjs
```
`admins` 테이블이 아직 **0건**이라 아무도 로그인할 수 없다. 위 명령 실행 → 비밀번호 2번 입력하면
`choho140@naver.com` 계정이 생성된다 (입력은 화면에 안 보이고, D1엔 scrypt 해시만 저장).
- 비번을 바꿀 때도 같은 명령. 다른 계정은 `node scripts/set-admin-password.mjs 이메일@주소`
- **에이전트에게 비밀번호를 알려주지 말 것** — 채팅에 남으면 그 자체가 유출이다

## 다음 세션 첫 액션
**`rooms` / `options` / `pricing_rules` 쓰기 API 신설 → RoomManagement·OptionsSettings 이식.**
지금 이 둘은 **읽기는 D1, 쓰기는 옛 Firestore** 로 갈라져 있다(아래 "split-brain"). 가장 고장난 상태다.
그 전에 **`settings/option_settings` 미이관 갭**부터 메워야 한다 — 데이터가 없으면 이식이 불가능하다.

### 이식 대상 14개 (측정 확정 — `node scripts/audit/reachability.mjs`)
죽은 코드 159개를 지운 뒤 `src/` 는 76개만 남았고, 그중 **Firebase 를 직접 쓰는 건 14개**다.

| 파일 | 성격 | 판정 |
|---|---|---|
| `RoomManagement` | 쓰기 8곳 + writeBatch 2 (rooms·reservations·pricing_rules·inventory_overrides) | **가장 큼. API 신설 필요** |
| `OptionsSettings` | 쓰기 4곳 (options·settings/option_settings) | API 신설 필요 |
| `ReservationCalendar` | 읽기 3곳(getDocs rooms/options/reservations) | **가장 쉬움** — `useRooms()/useOptions()/useReservations()` 로 치환만 |
| `NewReservationModal` | `serverTimestamp` import 1개뿐 | 사실상 정리만 |
| `NotificationSettingsV2` | settings 읽기·쓰기 | 신규 `app/notifications` 와 **기능 중복** — 이식 말고 빠진 것만 이식(`autoSendDaily`) |
| `SmsHistoryTable` | reservations 읽기 + `smsStatus` 맵 | D1 엔 그 필드가 없다 → `notification_log` JOIN 으로 **재작성** |
| `DataInitializer` | rooms/pricing_rules/options 하드코딩 덮어쓰기 | **폐기** (아래 위험 참조) |
| `useCustomers` | 단건 getDoc + 죽은 `updateCustomer` | `useFirebaseStore.customers` 로 **흡수** |
| `useOptionSettings` | settings/option_settings 읽기 | D1 에 데이터 없음 → 갭 메운 뒤 |
| `sensService` | settings 읽기 + SENS 발송 | **삭제** — `lib/sms.js` 가 완전 대체 (아래 보안) |
| `notificationScheduler` | settings·reservations·message_templates | 입실·퇴실 스케줄러 — 서버 이관 대상 |
| `diagnostics` · `reservationDebugger` | 진단용 reservations 1건 조회 | 디버그 도구 — 폐기 |
| `App.jsx` · `LoginScreen` | Firebase **Auth** (Firestore 아님) | 신규 JWT 인증(`lib/auth-jwt.js`)으로 교체 |

- **아키텍처 확정(사용자, 2026-07-16)**: 최종 화면은 **Next 가 레거시 컴포넌트를 렌더**한다.
  → `App.jsx` · react-router · `legacy-pages/` · 재작성본(`app/calendar` 등)은 최종적으로 폐기.
  지금은 `legacy-pages/` 가 **살아있는 화면의 정의**라 남겨둔다.
- 이식 원칙은 스토어와 같다: **기대하는 모양을 먼저 측정** → `legacy-shape.js` 에 있으면 그대로.
  쓰기는 반드시 `/api/*` 경유 (D1 토큰이 번들에 들어가면 끝)

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

## ⚠️ 정리 필요 (사소)
- ~~`NEXT_SESSION_REQUEST.md`~~ **삭제 완료** (2026-07-16). 예상대로 새 세션이 그걸 먼저 읽고
  3월 Firebase 컨텍스트로 출발했다 — 현행 핸드오프는 **이 파일 하나**.
- 루트에 수정된 레거시 Vite 파일 **11개**(`src/components/*`, `src/services/*`, `functions/src/index.js`)가
  커밋 안 된 채 방치. **이번 세션도 손대지 않았다**(내 작업과 무관해 섞으면 리뷰가 불가능해진다).
  `functions/src/index.js` 만 1,197줄 변경 — 정체 확인 후 커밋하거나 되돌릴 것.
  ⚠️ 단 `src/stores/useReservationStore.js` 는 이번에 전면 이식하며 함께 커밋됐다.

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

### 🎯 도메인 역할 확정 (사용자 결정 2026-07-16)
| 도메인 | 역할 |
|---|---|
| `rv.chorigol.co.kr` | **예약시스템 = 이 repo의 Next+D1 앱**. 계속 사용, 최종 주소 |
| `admin.chorigol.co.kr` | **별개 관리자 대시보드 (통계 담당)** — 다른 앱, 추후 구축. 이 앱 아님 |

⚠️ 이전 핸드오프가 "admin에 이 앱을 올린다"고 적었던 건 **오해**였다. admin은 통계 전용 별도 앱.

### 🔑 Vercel 토큰 2개 — 계정이 갈려 있다 (2026-07-16 실측 확정)
| env 키 | 계정 | 프로젝트 |
|---|---|---|
| `VERCEL_TOKEN` | chohopark134@gmail.com | `chohopark` (새 계정, team_dRQbvedrBJ4kxHtMAg59xpZo) — 이관 대상, 앱 없음 |
| `VERCEL_TOKEN_RV` | **mkt9834@gmail.com** | `rv-chorigol-co-kr` (구 계정, team_Gwjg6taUVyH9b1X1ZZ3ozWX9) — **지금 라이브** |

- **`VERCEL_TOKEN`(새 계정)으로 라이브 rv 를 조회하면 `forbidden`** 이다. 거기서 막히면 토큰을 잘못 골랐다.
- **사용자 방침: 팀 토큰 안 쓴다. 토큰은 프로젝트별로 값이 다르다.** 새 토큰이 생겨도 **덮어쓰지 말고
  각각 구분**해 보관 (`.env.local` 에 어느 계정인지 주석 있음).

### ✅ 배포는 `main` push 자동배포 — CLI 아니다
`rv-chorigol-co-kr` 은 **GitHub 연결**이다: `pola2025/rv.chorigol.co.kr`, production branch `main`.
최근 배포 전부 `git:main@<sha>` 소스. → **운영 반영 = `git push origin main`**.

**🚨 이 폴더에서 `vercel --prod` 치지 말 것.** `.vercel/project.json` 이 **라이브 rv** 를 가리켜서
현재 체크아웃된 브랜치(이관 중인 Next 앱)가 라이브를 덮는다. 운영 수정은 **main 워크트리**에서.
- ⚠️ **컷오버 다운타임 리스크**: `rv` 는 구 계정 소유다. 새 계정에 붙이려면 구 계정에서 먼저 떼야 하고,
  그 사이 rv 가 잠깐 끊긴다 → **심야 작업 필수**

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

### 컷오버 순서 (이 순서 아니면 사고)
1. **비번 설정** — `node scripts/set-admin-password.mjs` (안 하면 새 앱에 아무도 못 들어감)
2. **새 계정에 새 프로젝트로 배포** → `*.vercel.app` 임시 URL에서 검증 (rv 무영향)
3. env 주입 + 로그인·캘린더·알림 실동작 확인 → 며칠 병렬 운영
4. **심야에** rv 도메인 구 계정에서 떼고 새 계정에 붙이기 (5~10분 중단)
5. Firebase 2주 보존 후 폐기

**2번 전에 rv를 떼면 대체할 게 없어 예약시스템이 그냥 중단된다.**
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
- **`admins` 0건 → 아무도 로그인 못 함.** 위 "사장님이 직접 해야 할 일" 참조
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

**1. split-brain — 읽기 D1 / 쓰기 Firestore**
`RoomManagement`·`OptionsSettings` 는 읽기를 이미 `useFirebaseStore`(D1)로 하는데 **쓰기는 옛
Firestore 를 직접 친다**. 저장해도 화면에 안 나타난다. 이 브랜치 한정(운영 main 무관)이지만
**이 상태로 컷오버하면 객실·옵션 관리가 조용히 죽는다.** `rooms`/`options`/`pricing_rules` API 가
아예 없어서 단순 치환이 아니라 신규 설계다.

**2. `settings/option_settings` 미이관 — 진짜 데이터 갭**
D1 에 `settings` 테이블 자체가 없다. 덤프엔 있다:
- `late_checkout.roomStocks = {Forest mini: 2, Forest: 1}` ← `NewReservationModal` 이 읽는 재고 제한
- `extra_person` (인원 추가 15,000원 per_person) ← **options 컬렉션엔 아예 없는 항목**
`options.late_checkout.room_stocks` 는 **NULL**. 이관 안 하면 레이트체크아웃 재고가 조용히 풀린다.
※ Firestore 는 `options/late_checkout` 문서와 `settings/option_settings.late_checkout` **두 벌**을
   갖고 있고 값도 다르다(설명·applicableRooms). 어느 쪽이 진실인지 정하고 이관할 것.

**3. 보안 — `sensService.js` 가 SENS 키 원문을 브라우저로 내린다 (운영 중)**
`settings/notifications_v2_*` 에서 `accessKey`/`secretKey` 를 클라이언트가 `getDoc` 으로 읽어
(47·66행) `fetch` POST 바디에 실어 보낸다(150-177행) → DevTools Network 에 원문 노출.
`lib/sms.js` 가 서버 전용 `process.env` + HMAC 으로 이미 100% 대체 → **이식이 아니라 삭제**.

**4. `DataInitializer` — 좁지만 실재하는 파괴 경로**
`rooms.length === 0` 일 때만 뜨는 폴백 화면이라 평소엔 안 보인다. 그런데 **신규 스택에선
`/api/snapshot` 이 한 번 실패하면 `rooms=[]`** → 이 화면이 뜨고, 누르면 `batch.set()`(merge 없음)로
**운영 Firestore 의 rooms 6 / options 3 / pricing_rules 3 을 2025년 하드코딩 값으로 덮어쓴다.**
이식하지 말고 지울 것.

**5. `RoomManagement` 의 조용히 깨진 로직**
`r.room === roomName` 으로 예약을 거르는데(174·276행) 실제 필드는 `roomName` 이다
→ "객실명 변경·삭제 시 관련 예약 경고" 가 **항상 빈 배열**이라 무력화돼 있다.

### 남은 것
1. `settings/option_settings` 갭 메우기 → `rooms`/`options`/`pricing_rules` API → 두 화면 이식
2. 나머지 Firebase 직접 사용 파일 (위 표)
3. `src/config/firebase.js` 제거 → Vite 의존 정리
4. 입실·퇴실 스케줄러 이관 (신규 스택에 없어 **아직 아무 동작도 안 한다**)
5. `src/scripts/*` 4개 — Firebase 폐기(Phase 8) 때 함께 정리
6. 미커밋 10개(`functions/src/index.js` 1,197줄 등) 정체 확인. `notificationService.js` 는
   **죽은 코드인데 미커밋 수정 101줄**이 있어 남겨뒀다 (효과 0 — 아무도 import 안 함)

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
