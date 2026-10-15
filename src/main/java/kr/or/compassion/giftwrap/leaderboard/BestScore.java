package kr.or.compassion.giftwrap.leaderboard;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import kr.or.compassion.giftwrap.game.GiftType;

/**
 * 기간(전체 "ALL" / 일자 "yyyy-MM-dd")별 플레이어 최고 기록.
 * 한 플레이어(clientId)는 기간마다 한 줄만 가진다.
 */
@Entity
@Table(name = "best_score",
        uniqueConstraints = @UniqueConstraint(name = "uk_best_period_client", columnNames = {"periodKey", "clientId"}),
        indexes = @Index(name = "ix_best_period_score", columnList = "periodKey, score"))
public class BestScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String periodKey;

    @Column(nullable = false, length = 36)
    private String clientId;

    @Column(nullable = false, length = 36)
    private String gameId;

    @Column(nullable = false, length = 24)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private GiftType gift;

    @Column(nullable = false)
    private int score;

    @Column(nullable = false, length = 2)
    private String grade;

    @Column(nullable = false)
    private Instant achievedAt;

    protected BestScore() {
    }

    public BestScore(String periodKey, String clientId) {
        this.periodKey = periodKey;
        this.clientId = clientId;
    }

    public void update(String gameId, String nickname, GiftType gift, int score, String grade, Instant at) {
        this.gameId = gameId;
        this.nickname = nickname;
        this.gift = gift;
        this.score = score;
        this.grade = grade;
        this.achievedAt = at;
    }

    public boolean isNew() { return id == null; }
    public String getPeriodKey() { return periodKey; }
    public String getGameId() { return gameId; }
    public String getNickname() { return nickname; }
    public GiftType getGift() { return gift; }
    public int getScore() { return score; }
    public String getGrade() { return grade; }
    public Instant getAchievedAt() { return achievedAt; }
}
