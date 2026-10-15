# 무료 배포 가이드 — 구글 스프레드시트 + GitHub Pages(또는 Netlify)

비용 0원. 서버 관리가 필요 없습니다.

```
휴대폰 ──▶ GitHub Pages 또는 Netlify (게임 화면)
               │  점수 제출 / 순위 조회
               ▼
         Google Apps Script (점수 재계산·입력 검증·부정행위 방지)
               │
               ▼
         구글 스프레드시트 (records: 전체 기록, best: 순위표)
```

> ⚠️ 이 방식은 Spring 서버를 쓰지 않으므로 회사 보안 지침("Spring Security 사용")의 **예외 승인**이 필요합니다.

---

## 1단계. 구글 스프레드시트 + Apps Script (약 15분)

1. 회사 구글 계정으로 [새 스프레드시트](https://sheets.new)를 만들고 이름을 정합니다 (예: `선물포장챌린지 랭킹`).
2. 메뉴 **확장 프로그램 → Apps Script** 를 엽니다.
3. 기본 `Code.gs` 의 내용을 모두 지우고, 이 저장소의 [`apps-script/Code.gs`](apps-script/Code.gs) 내용을 **전부** 붙여넣고 저장(💾)합니다.
4. (권장 · 권한 최소화) 왼쪽 **⚙ 프로젝트 설정 → "편집기에서 appsscript.json 매니페스트 파일 표시"** 를 체크하고,
   편집기에 나타난 `appsscript.json` 내용을 [`apps-script/appsscript.json`](apps-script/appsscript.json) 으로 바꿔 저장합니다.
   → 이 스크립트는 **연결된 이 스프레드시트 하나만** 접근할 수 있게 됩니다.
5. 위쪽 함수 선택 상자에서 **`setup`** 을 고르고 **▶ 실행** 합니다.
   - 권한 요청 창 → 계정 선택 → "Google에서 확인하지 않은 앱" 이 나오면 **고급 → (프로젝트 이름)(으)로 이동** → 허용
   - 스프레드시트에 `records`, `best` 시트가 생기면 성공입니다.
6. 오른쪽 위 **배포 → 새 배포** → 톱니바퀴에서 **웹 앱** 선택
   - 설명: `v1` / 다음 사용자 인증 정보로 실행: **나** / 액세스 권한이 있는 사용자: **모든 사용자**
   - **배포** → 표시되는 **웹 앱 URL**(`https://script.google.com/macros/s/…/exec`)을 복사해 둡니다.
7. 확인: 브라우저 주소창에 `웹앱URL?action=ping` 을 입력 → `{"ok":true,"data":{"pong":true}}` 가 보이면 완료.

---

## 2단계. 게임 화면 공개 — 아래 A 또는 B 중 하나

### A. GitHub Pages

> 무료 GitHub Pages 는 **공개(Public) 저장소**에서만 동작합니다. 코드에는 비밀번호·키가 없지만, 코드를 비공개로 두고 싶다면 B(Netlify)를 쓰세요.

1. [GitHub](https://github.com) 에 가입/로그인 → 오른쪽 위 **+ → New repository**
   - 이름: `gift-wrap-game` / **Public** / README 추가 **안 함** → Create
2. 코드 올리기 (이 폴더에서 터미널 실행, 첫 push 때 GitHub 로그인 창이 뜹니다):
   ```bash
   git remote add origin https://github.com/<내아이디>/gift-wrap-game.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. 저장소 **Settings → Secrets and variables → Actions → Variables 탭 → New repository variable**
   - Name: `SHEETS_URL` / Value: 1단계에서 복사한 웹 앱 URL
5. **Actions 탭 → Deploy to GitHub Pages → Run workflow** (이후에는 push 할 때마다 자동 배포)
6. 1~2분 뒤 `https://<내아이디>.github.io/gift-wrap-game/` 에서 게임이 열립니다.

### B. Netlify (저장소 비공개 가능 · 보안 헤더 적용)

1. 위 A의 1~2번처럼 GitHub 저장소에 코드를 올립니다 (**Private** 가능).
2. [Netlify](https://www.netlify.com) 에 GitHub 계정으로 가입 → **Add new site → Import an existing project → GitHub** → 저장소 선택
3. 빌드 설정은 `netlify.toml` 이 자동으로 채웁니다. **Environment variables** 에 `SHEETS_URL` = 웹 앱 URL 추가
4. **Deploy** → `https://<사이트이름>.netlify.app` 에서 열립니다. (사이트 이름은 Site configuration 에서 변경 가능)

---

## 3단계. 오픈 전 확인

- [ ] 휴대폰(아이폰 Safari, 안드로이드 Chrome, **카카오톡 인앱 브라우저**)에서 1판 플레이 → 결과 화면에 순위가 나오는지
- [ ] 스프레드시트 `records`, `best` 시트에 기록이 쌓이는지
- [ ] 결과 공유 → 카카오톡으로 받은 링크에 미리보기 이미지와 "도전장" 문구가 나오는지
- [ ] 회사 보안 지침 예외 승인

---

## 운영 방법

| 하고 싶은 일 | 방법 |
|---|---|
| 순위표 보기 / 당첨자 뽑기 | `best` 시트에서 `period` 가 `ALL` 인 행을 `score` 내림차순 정렬 |
| 부적절한 닉네임 제거 | `best` 시트에서 해당 행 삭제 (약 15초 안에 게임 화면 반영) |
| 금칙어 추가 | Apps Script **⚙ 프로젝트 설정 → 스크립트 속성 → `BANNED_WORDS`** = `단어1,단어2` |
| 기록 초기화 | 두 시트의 2행부터 아래를 모두 삭제 (머리글 1행은 유지) |
| Code.gs 수정 반영 | **배포 → 배포 관리 → ✏ 편집 → 버전: 새 버전 → 배포** (URL 유지). ⚠ "새 배포"를 누르면 URL 이 바뀌어 `SHEETS_URL` 도 바꿔야 함 |
| 게임 화면 수정 반영 | 코드 수정 → `git push` → 자동 배포 |

## 알아둘 제약

- **동시 처리량**: Apps Script 는 동시에 처리하는 요청 수에 한도가 있습니다(무료 계정 기준 약 30개). 수백 명이 같은 순간에 몰리면 일부가 "잠시 후 다시 시도" 안내를 볼 수 있습니다. 하루 수천 판이 나눠서 들어오는 정도는 문제없을 것으로 예상하지만, 대규모 이벤트 전에는 미리 여러 명이 동시에 시험해 보세요. 한도는 구글 정책에 따라 바뀔 수 있습니다.
- **응답 속도**: 점수 제출·순위 조회에 1~3초가 걸릴 수 있고, 결과 화면의 순위는 20초마다 갱신됩니다.
- **스프레드시트 공유**: 시트는 외부에 공유하지 마세요. 웹 앱은 스크립트를 통해서만 시트에 접근합니다.
- **같은 기록을 이 저장소의 Spring 서버로 옮길 때**: [DEPLOY.md](DEPLOY.md) (Docker) 를 참고하세요. 게임 화면은 `js/config.js` 의 `SHEETS_URL` 이 비어 있으면 자동으로 Spring 서버를 사용합니다.

## 로컬 검증

`apps-script/test/harness.html` 은 구글 서비스를 흉내 낸 모의 객체로 `Code.gs` 를 브라우저에서 실행해 30개 항목(입력 검증, 시간 검증, 중복/타인 제출, 매크로 차단, 순위 계산, 프론트 연동)을 검사합니다. 저장소 루트를 정적 서버로 띄우고 해당 페이지를 열면 됩니다.
