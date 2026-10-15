# 컴패션 크리스마스 선물 포장 챌린지

10초 동안 화면을 빠르게 탭해 선물을 포장하고, 실시간 순위에 도전하는 3D 웹 게임.

- **프론트엔드**: Three.js r160 (`static/vendor` 에 고정 포함), 외부 이미지/음원 없이 코드로 생성한 3D 모델·텍스처·효과음
- **백엔드**: Spring Boot 3.3 + Spring Security, JPA (기본 H2 파일 DB, 운영은 PostgreSQL)

## 실행

```powershell
./run-local.ps1          # http://localhost:8080
```

배포 방법은 두 가지:
- **무료**: [FREE_DEPLOY.md](FREE_DEPLOY.md) — GitHub Pages/Netlify + 구글 스프레드시트(Apps Script)
- **서버**: [DEPLOY.md](DEPLOY.md) — Docker Compose (Nginx HTTPS + Spring 앱 + PostgreSQL)

JDK 21 + Maven 이 필요하다. `../.tools` 에 휴대용 JDK/Maven 이 있으면 스크립트가 자동으로 사용한다.
테스트: `mvn test`

## 게임 흐름

닉네임 → 선물 선택(6종) → 3·2·1 → 10초 탭 → 결과(등급/점수/순위) → 공유

포장 단계(진행도 0~100%, 60탭에 완성): 선물 넣기 → 뚜껑 → 포장지 깔기 → 양옆 접기 → 앞/뒤 감싸기 → 테이프 → 리본 → 나비매듭 → 카드.
10초 안에 완성하지 못하면 요정들이 마무리를 도와준다(점수와는 무관).

## 점수 (서버에서 계산)

| 항목 | 점수 |
|---|---|
| 탭 1회 | 100 |
| 최고 순간 속도 (1초간 최다 탭) | × 150 |
| 최대 콤보 (0.25초 이내 연속 탭) | × 30 |
| 리듬 안정도 (탭 간격 변동계수 기반 0~100) | × 10 |
| 포장 완성(60탭) 보너스 | 2,000 + 남은 ms ÷ 2 |

등급: S ≥ 22,000 · A ≥ 16,000 · B ≥ 11,000 · C

클라이언트는 **탭 타임스탬프만** 보내고 점수는 서버가 재계산한다 (`ScoreCalculator.java`, 화면 미리보기용 `js/scoring.js` 와 동일 공식).

## 보안 (OWASP 기준)

- Spring Security: 허용 목록 외 경로 기본 거부, 무상태 세션, CSRF 토큰(HttpOnly 쿠키 + 마스킹 헤더) 필수
- 보안 헤더: CSP(`script-src 'self'`, 외부 스크립트 없음), X-Frame-Options DENY, HSTS, Referrer-Policy, Permissions-Policy
- 입력 검증: Bean Validation + 닉네임 허용 문자 정규식, 제어문자 거부, 금칙어 필터(`application.yml`), 화면 출력은 `textContent` 만 사용
- 부정행위 방지: 서버 발급 게임 세션(1회 제출, 본인 clientId 만), 서버 시각으로 플레이 시간 검증, 사람 한계 초과(초당 25회) 기록 거부, IP 단위 요청 제한
- 오류 응답에 스택트레이스/내부 메시지 미노출, 로그 인젝션 방지
- 비밀값 하드코딩 없음: DB/관리자 계정은 환경변수로만 주입

### 환경변수

| 변수 | 설명 |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | 운영 DB (예: `jdbc:postgresql://...`) |
| `GAME_ADMIN_USERNAME`, `GAME_ADMIN_PASSWORD_HASH` | 운영자 계정 (`{bcrypt}$2a$...`). 미설정 시 관리자 API 비활성 |
| `FORWARD_HEADERS_STRATEGY` | 프록시 뒤에서 실제 IP 사용 시 `NATIVE` |
| `PORT` | 기본 8080 |

운영자: `DELETE /api/admin/games/{gameId}` (HTTP Basic + CSRF) 로 부적절한 기록 제거.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/csrf` | CSRF 토큰 |
| POST | `/api/games` | 게임 시작 `{nickname, clientId, gift}` |
| POST | `/api/games/{id}/finish` | 결과 제출 `{clientId, taps:[ms...]}` |
| GET | `/api/games/{id}/rank` | 현재 순위 (결과 화면 5초 폴링) |
| GET | `/api/games/{id}/share` | 공유 링크(도전장) 정보 |
| GET | `/api/leaderboard?period=all\|today&limit=20` | 순위표 |

## 커스터마이징

- 선물 추가/변경: `static/js/items.js` 의 `GIFTS` + 서버 `GiftType` enum
- 포장지 무늬: `static/js/textures.js` 의 `PAPER_STYLES`
- 컴패션 곰돌이: `static/js/bear.js` (절차적 모델, 셸 퍼 털). Blender 등으로 만든 GLB 로 교체 가능
- `?debug` 파라미터: 개발 확인용(스크립트 탭 허용). 서버 검증은 그대로 적용됨
