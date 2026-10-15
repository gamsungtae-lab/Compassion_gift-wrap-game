package kr.or.compassion.giftwrap.config;

import java.time.ZoneId;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "game")
public record GameProperties(
        int durationMs,
        int targetTaps,
        int maxTaps,
        int minTapIntervalMs,
        int sessionTtlSeconds,
        String zoneId,
        List<String> bannedWords,
        RateLimit rateLimit) {

    public GameProperties {
        if (durationMs <= 0) durationMs = 10_000;
        if (targetTaps <= 0) targetTaps = 60;
        if (maxTaps <= 0) maxTaps = 250;
        if (minTapIntervalMs <= 0) minTapIntervalMs = 20;
        if (sessionTtlSeconds <= 0) sessionTtlSeconds = 120;
        if (zoneId == null || zoneId.isBlank()) zoneId = "Asia/Seoul";
        bannedWords = bannedWords == null ? List.of() : List.copyOf(bannedWords);
        if (rateLimit == null) rateLimit = new RateLimit(30, 240);
    }

    public ZoneId zone() {
        return ZoneId.of(zoneId);
    }

    public record RateLimit(int writePerMinute, int readPerMinute) {
    }
}
