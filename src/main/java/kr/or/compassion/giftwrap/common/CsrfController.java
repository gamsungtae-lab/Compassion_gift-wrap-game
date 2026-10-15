package kr.or.compassion.giftwrap.common;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * SPA 가 CSRF 토큰을 받아가는 엔드포인트.
 * 원본 토큰은 HttpOnly 쿠키에 저장되고, 응답 본문에는 요청마다 마스킹(XOR)된 값이 전달된다 (BREACH 완화).
 */
@RestController
public class CsrfController {

    @GetMapping("/api/csrf")
    public ResponseEntity<Map<String, String>> csrf(CsrfToken token) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(Map.of("headerName", token.getHeaderName(), "token", token.getToken()));
    }
}
