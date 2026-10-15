package kr.or.compassion.giftwrap.leaderboard;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BestScoreRepository extends JpaRepository<BestScore, Long> {

    Optional<BestScore> findByPeriodKeyAndClientId(String periodKey, String clientId);

    List<BestScore> findByPeriodKeyOrderByScoreDescAchievedAtAsc(String periodKey, Pageable pageable);

    long countByPeriodKey(String periodKey);

    long countByPeriodKeyAndScoreGreaterThan(String periodKey, int score);

    List<BestScore> findByGameId(String gameId);
}
