# 배포 가이드

구성: **Nginx (HTTPS)** → **Spring Boot 앱** (컨테이너, 비루트, 읽기전용 파일시스템) → **PostgreSQL** (내부망 전용)

```
인터넷 ──443──▶ nginx ──▶ app:8080 ──▶ db:5432   (db/app 포트는 외부 미노출)
```

## 1. 준비물

- Docker + Docker Compose 가 설치된 리눅스 서버 1대 (권장 2 vCPU / 2GB RAM 이상)
- 도메인 (예: `gift.compassion.or.kr`) 의 DNS A 레코드 → 서버 IP
- 방화벽: 80, 443 만 개방

## 2. 설정

```bash
cp .env.example .env
chmod 600 .env
```

`.env` 를 열어 값을 채운다.

| 항목 | 설명 |
|---|---|
| `PUBLIC_BASE_URL` | `https://gift.compassion.or.kr` (끝에 `/` 없이). 카카오톡 등 공유 미리보기 이미지 주소에 사용 |
| `SERVER_NAME` | `gift.compassion.or.kr` |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` 로 생성한 값 |
| `GAME_ADMIN_*` | 선택. 아래 "운영자 계정" 참고 |

> `.env`, 인증서(`deploy/certs/`)는 `.gitignore` 에 포함되어 있다. 절대 커밋하지 않는다.

### 운영자 계정 (선택)

부적절한 닉네임 기록을 지울 때 사용한다. BCrypt 해시를 만든다:

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbBC 12 "" '사용할비밀번호' | tr -d ':\n'
```

출력된 `$2y$12$...` 앞에 `{bcrypt}` 를 붙이고, **`.env` 안에서는 `$` 를 `$$` 로 바꿔** 적는다 (Compose 변수 치환 때문).

```
GAME_ADMIN_USERNAME=giftadmin
GAME_ADMIN_PASSWORD_HASH={bcrypt}$$2y$$12$$....
```

## 3. HTTPS 인증서 (Let's Encrypt)

최초 1회, nginx 를 띄우기 전에 발급한다.

```bash
docker run --rm -p 80:80 -v "$PWD/deploy/certs-le:/etc/letsencrypt" certbot/certbot \
  certonly --standalone -d gift.compassion.or.kr --agree-tos -m 담당자이메일 --no-eff-email
cp deploy/certs-le/live/gift.compassion.or.kr/fullchain.pem deploy/certs/
cp deploy/certs-le/live/gift.compassion.or.kr/privkey.pem  deploy/certs/
```

기관 인증서가 있다면 같은 파일명(`fullchain.pem`, `privkey.pem`)으로 `deploy/certs/` 에 두면 된다.
갱신은 90일마다 필요하다 (cron 으로 `certbot renew` 후 파일 복사 → `docker compose restart nginx`).

## 4. 실행

```bash
docker compose up -d --build
docker compose ps          # app 이 healthy 인지 확인
docker compose logs -f app
```

확인:
- `https://도메인/` 접속 → 게임 화면
- 카카오톡에 링크 붙여넣기 → 미리보기 카드 이미지 확인 (캐시 초기화: 카카오 개발자 "공유 디버거")

## 5. 운영

| 작업 | 명령 |
|---|---|
| 업데이트 배포 | `git pull && docker compose up -d --build app` |
| DB 백업 | `docker compose exec db pg_dump -U giftwrap giftwrap > backup_$(date +%F).sql` |
| 기록 삭제(운영자) | 아래 참고 |
| 로그 | `docker compose logs --since 1h app` |

기록 삭제 (CSRF 토큰이 필요하므로 쿠키를 유지한다):

```bash
T=$(curl -s -c c.txt https://도메인/api/csrf | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -b c.txt -u giftadmin -H "X-XSRF-TOKEN: $T" -X DELETE https://도메인/api/admin/games/{gameId}
```

`gameId` 는 DB `best_score` 테이블에서 닉네임으로 조회한다.

## 6. 오픈 전 체크리스트

- [ ] `.env` 의 모든 `CHANGE_ME` 교체, 파일 권한 600
- [ ] HTTPS 접속 및 http → https 리다이렉트 확인
- [ ] 실제 휴대폰(iOS Safari, Android Chrome, 카카오톡 인앱 브라우저)에서 1판 플레이
- [ ] 공유 버튼 → 카카오톡/문자로 전달 → 도전장 링크가 열리는지
- [ ] 첫 기동으로 테이블 생성 확인 후 `.env` 에 `DDL_AUTO=validate` 추가하고 `docker compose up -d app`
- [ ] DB 백업 cron 등록
- [ ] 금칙어 목록(`application.yml` → `game.banned-words`) 검토

## 알아둘 제약

- **단일 인스턴스 기준**입니다. 요청 제한(rate limit)과 랭킹 동기화가 메모리 기반이라, 서버를 여러 대로 늘리려면 Redis 기반 제한기로 바꿔야 합니다. 이벤트 규모(동시 수천 명)라면 이 구성 1대로 충분합니다.
- 폰트는 Google Fonts 에서 받습니다. 외부 요청을 없애려면 폰트를 `static/` 에 내려받아 두고 `index.html`·CSP 를 수정합니다.
- 카카오톡 "공유하기" 전용 버튼(카카오 SDK)은 카카오 앱 키 발급과 CSP 변경이 필요해 포함하지 않았습니다. 현재는 휴대폰 기본 공유창(카카오톡 포함)과 링크 복사로 공유합니다.
- `?debug` 주소는 개발 확인용(스크립트 탭 허용)이며, 서버 검증은 동일하게 적용되어 점수 조작에는 쓸 수 없습니다.
