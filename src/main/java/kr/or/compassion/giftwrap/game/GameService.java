package kr.or.compassion.giftwrap.game;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import kr.or.compassion.giftwrap.common.ApiException;
import kr.or.compassion.giftwrap.common.LogSanitizer;
import kr.or.compassion.giftwrap.config.GameProperties;
import kr.or.compassion.giftwrap.game.GameDtos.FinishRequest;
import kr.or.compassion.giftwrap.game.GameDtos.FinishResponse;
import kr.or.compassion.giftwrap.game.GameDtos.RankResponse;
import kr.or.compassion.giftwrap.game.GameDtos.ShareResponse;
import kr.or.compassion.giftwrap.game.GameDtos.StartRequest;
import kr.or.compassion.giftwrap.game.GameDtos.StartResponse;
import kr.or.compassion.giftwrap.leaderboard.LeaderboardService;
import kr.or.compassion.giftwrap.leaderboard.LeaderboardService.Period;

/**
 * 게임 세션 수명주기.
 * 서버가 발급한 세션으로만 결과를 제출할 수 있고(1회), 서버 시각으로 플레이 시간을 검증하며,
 * 점수는 서버에서 탭 기록으로 재계산한다 (클라이언트 점수 신뢰하지 않음).
 */
@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);

    private final GameSessionRepository games;
    private final ScoreCalculator calculator;
    private final NicknamePolicy nicknamePolicy;
    private final LeaderboardService leaderboard;
    private final GameProperties props;

    public GameService(GameSessionRepository games, ScoreCalculator calculator, NicknamePolicy nicknamePolicy,
                       LeaderboardService leaderboard, GameProperties props) {
        this.games = games;
        this.calculator = calculator;
        this.nicknamePolicy = nicknamePolicy;
        this.leaderboard = leaderboard;
        this.props = props;
    }

    @Transactional
    public StartResponse start(StartRequest req) {
        String nickname = nicknamePolicy.sanitize(req.nickname());
        GameSession game = new GameSession(UUID.randomUUID().toString(), req.clientId().toLowerCase(),
                nickname, req.gift(), Instant.now());
        games.save(game);
        return new StartResponse(game.getId(), props.durationMs(), props.targetTaps());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public FinishResponse finish(String gameId, FinishRequest req) {
        GameSession game = games.findById(gameId.toLowerCase())
                .filter(g -> g.getClientId().equals(req.clientId().toLowerCase()))
                .orElseThrow(GameService::notFound);

        if (game.getStatus() != GameSession.Status.STARTED) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_FINISHED", "이미 제출된 게임이에요.");
        }

        Instant now = Instant.now();
        long elapsed = Duration.between(game.getStartedAt(), now).toMillis();
        if (elapsed > props.sessionTtlSeconds() * 1000L) {
            game.reject(now);
            throw new ApiException(HttpStatus.GONE, "EXPIRED", "게임 시간이 만료되었어요. 다시 시작해 주세요.");
        }
        if (elapsed < props.durationMs()) {
            game.reject(now);
            log.warn("Early finish rejected game={} elapsed={}ms", LogSanitizer.clean(gameId), elapsed);
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TIMING", "게임 기록이 올바르지 않아요.");
        }

        ScoreResult result;
        try {
            result = calculator.calculate(req.taps());
        } catch (ApiException e) {
            game.reject(now);
            log.warn("Tap record rejected game={} code={}", LogSanitizer.clean(gameId), e.code());
            throw e;
        }

        game.finish(result, now);
        games.save(game);
        leaderboard.record(game);

        return new FinishResponse(game.getId(), game.getNickname(), game.getGift(), result,
                leaderboard.rankOf(Period.ALL, game.getStartedAt(), result.score()),
                leaderboard.rankOf(Period.TODAY, game.getStartedAt(), result.score()));
    }

    @Transactional(readOnly = true)
    public RankResponse rank(String gameId) {
        GameSession game = finished(gameId);
        return new RankResponse(
                leaderboard.rankOf(Period.ALL, game.getStartedAt(), game.getScore()),
                leaderboard.rankOf(Period.TODAY, game.getStartedAt(), game.getScore()));
    }

    @Transactional(readOnly = true)
    public ShareResponse share(String gameId) {
        GameSession game = finished(gameId);
        ScoreResult r = game.toResult();
        return new ShareResponse(game.getNickname(), game.getGift(), r.score(), r.grade(), r.tapCount(), r.peakTps(),
                leaderboard.rankOf(Period.ALL, game.getStartedAt(), r.score()));
    }

    @Transactional
    public void adminRemove(String gameId) {
        GameSession game = games.findById(gameId.toLowerCase()).orElseThrow(GameService::notFound);
        game.reject(Instant.now());
        leaderboard.removeGame(game.getId());
        log.info("Admin removed game={}", LogSanitizer.clean(gameId));
    }

    private GameSession finished(String gameId) {
        return games.findById(gameId.toLowerCase())
                .filter(g -> g.getStatus() == GameSession.Status.FINISHED)
                .orElseThrow(GameService::notFound);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "GAME_NOT_FOUND", "게임 기록을 찾을 수 없어요.");
    }
}
