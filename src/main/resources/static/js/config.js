// 배포 설정. GitHub Pages 배포 시 GitHub Actions 가 저장소 변수 SHEETS_URL 로 이 파일을 다시 생성한다.
// - SHEETS_URL 이 있으면: 구글 스프레드시트(Apps Script) 랭킹 사용
// - 비어 있으면: 같은 주소의 Spring 서버 → 없으면 오프라인(기기 저장) 모드
export const SHEETS_URL = '';
