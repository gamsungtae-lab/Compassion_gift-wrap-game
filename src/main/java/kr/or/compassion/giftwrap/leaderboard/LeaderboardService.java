package kr.or.compassion.giftwrap.leaderboard;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import kr.or.compassion.giftwrap.config.GameProperties;
import kr.or.compassion.giftwrap.game.GameSession;
import kr.or.compassion.giftwrap.game.GiftType;

@Service
public class LeaderboardService {

    public enum Period { ALL, TODAY }

    public record Entry(int rank, String nickname, int score, String grade, GiftType gift, String gameId) {
    }

    public record Board(String period, long total, List<Entry> entries, Instant updatedAt) {
    }

    public record Rank(long rank, long total) {
    }

    private static final String ALL_KEY = "ALL";

    private final BestScoreRepository repository;
    private final GameProperties props;

    public LeaderboardService(BestScoreRepository repository, GameProperties props) {
        this.repository = repository;
        this.props = props;
    }

    String periodKey(Period period, Instant at) {
        return period == Period.ALL ? ALL_KEY : LocalDate.ofInstant(at, props.zone()).toString();
    }

    /** 플레이어의 기간별 최고 기록 갱신. 단일 인스턴스 기준 동기화 + DB 유니크 제약으로 중복 방지. */
    @Transactional
    public synchronized void record(GameSession game) {
        Instant at = game.getFinishedAt();
        for (Period period : Period.values()) {
            String key = periodKey(period, game.getStartedAt());
            BestScore best = repository.findByPeriodKeyAndClientId(key, game.getClientId())
                    .orElseGet(() -> new BestScore(key, game.getClientId()));
            if (best.isNew() || game.getScore() > best.getScore()) {
                best.update(game.getId(), game.getNickname(), game.getGift(), game.getScore(), game.getGrade(), at);
                repository.save(best);
            }
        }
    }

    @Transactional(readOnly = true)
    public Board top(Period period, int limit) {
        Instant now = Instant.now();
        String key = periodKey(period, now);
        List<BestScore> rows = repository.findByPeriodKeyOrderByScoreDescAchievedAtAsc(key, PageRequest.of(0, limit));
        List<Entry> entries = new ArrayList<>(rows.size());
        int rank = 0;
        Integer prevScore = null;
        for (int i = 0; i < rows.size(); i++) {
            BestScore b = rows.get(i);
            if (prevScore == null || b.getScore() != prevScore) {
                rank = i + 1;
                prevScore = b.getScore();
            }
            entries.add(new Entry(rank, b.getNickname(), b.getScore(), b.getGrade(), b.getGift(), b.getGameId()));
        }
        return new Board(period.name().toLowerCase(), repository.countByPeriodKey(key), entries, now);
    }

    /** 주어진 점수가 현재 해당 기간 순위표에서 몇 등인지 (동점은 같은 등수). */
    @Transactional(readOnly = true)
    public Rank rankOf(Period period, Instant playedAt, int score) {
        String key = periodKey(period, playedAt);
        return new Rank(repository.countByPeriodKeyAndScoreGreaterThan(key, score) + 1,
                repository.countByPeriodKey(key));
    }

    @Transactional
    public synchronized void removeGame(String gameId) {
        repository.deleteAll(repository.findByGameId(gameId));
    }
}
