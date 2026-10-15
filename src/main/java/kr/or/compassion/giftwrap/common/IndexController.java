package kr.or.compassion.giftwrap.common;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * index.html 의 공유 미리보기 메타태그(og:url, og:image)에 공개 주소를 채워 내려준다.
 * 카카오톡/페이스북 등은 절대 URL 만 인식하기 때문.
 * 값은 설정(PUBLIC_BASE_URL)에서만 오며 형식을 엄격히 검증한다 (요청 Host 헤더를 신뢰하지 않음).
 */
@Controller
public class IndexController {

    private static final Pattern BASE_URL = Pattern.compile("^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$");
    private static final String PLACEHOLDER = "__PUBLIC_BASE_URL__";

    private final String html;

    public IndexController(@Value("${app.public-base-url:}") String baseUrl) throws IOException {
        String base = baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", "");
        if (!base.isEmpty() && !BASE_URL.matcher(base).matches()) {
            throw new IllegalStateException("app.public-base-url 형식이 올바르지 않습니다 (예: https://gift.example.org)");
        }
        String raw = new ClassPathResource("static/index.html").getContentAsString(StandardCharsets.UTF_8);
        this.html = raw.replace(PLACEHOLDER, base);
    }

    @GetMapping(path = {"/", "/index.html"}, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> index() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .body(html);
    }
}
