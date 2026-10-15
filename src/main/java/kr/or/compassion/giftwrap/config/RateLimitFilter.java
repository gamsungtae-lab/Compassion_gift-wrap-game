package kr.or.compassion.giftwrap.config;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * IP 단위 고정 윈도우(1분) 요청 제한. 단일 인스턴스용 간이 구현이며,
 * 다중 인스턴스 운영 시 Redis 기반 제한기나 API Gateway 로 교체한다.
 * 프록시 뒤에서는 server.forward-headers-strategy 설정으로 실제 IP 를 신뢰 가능하게 받는다
 * (X-Forwarded-For 를 직접 파싱하지 않음 → 위조 방지).
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 60_000L;
    private static final int MAX_TRACKED_KEYS = 100_000;

    private final GameProperties.RateLimit limits;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(GameProperties.RateLimit limits) {
        this.limits = limits;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean write = !HttpMethod.GET.matches(request.getMethod());
        int limit = write ? limits.writePerMinute() : limits.readPerMinute();
        String key = (write ? "w:" : "r:") + request.getRemoteAddr();
        long now = System.currentTimeMillis();

        if (windows.size() > MAX_TRACKED_KEYS) {
            windows.entrySet().removeIf(e -> now - e.getValue().start > WINDOW_MS);
        }
        Window window = windows.compute(key, (k, w) -> (w == null || now - w.start > WINDOW_MS) ? new Window(now) : w);

        if (window.count.incrementAndGet() > limit) {
            long retryAfter = Math.max(1, (WINDOW_MS - (now - window.start)) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"error\":\"TOO_MANY_REQUESTS\",\"message\":\"요청이 너무 많아요. 잠시 후 다시 시도해 주세요.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private static final class Window {
        final long start;
        final AtomicInteger count = new AtomicInteger();

        Window(long start) {
            this.start = start;
        }
    }
}
