package kr.or.compassion.giftwrap.game;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import kr.or.compassion.giftwrap.leaderboard.LeaderboardService.Rank;

/** 게임 API 요청/응답 DTO. 모든 입력은 Bean Validation 으로 1차 검증한다. */
public final class GameDtos {

    public static final String UUID_REGEX =
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private GameDtos() {
    }

    public record StartRequest(
            @NotBlank @Size(min = 2, max = 12) @Pattern(regexp = NicknamePolicy.REGEX) String nickname,
            @NotNull @Pattern(regexp = UUID_REGEX) String clientId,
            @NotNull GiftType gift) {
    }

    public record StartResponse(String gameId, int durationMs, int targetTaps) {
    }

    public record FinishRequest(
            @NotNull @Pattern(regexp = UUID_REGEX) String clientId,
            @NotNull @Size(max = 600) List<@NotNull @Min(0) @Max(60_000) Integer> taps) {
    }

    public record FinishResponse(
            String gameId,
            String nickname,
            GiftType gift,
            ScoreResult result,
            Rank allRank,
            Rank todayRank) {
    }

    public record RankResponse(Rank allRank, Rank todayRank) {
    }

    public record ShareResponse(
            String nickname,
            GiftType gift,
            int score,
            String grade,
            int tapCount,
            int peakTps,
            Rank allRank) {
    }
}
