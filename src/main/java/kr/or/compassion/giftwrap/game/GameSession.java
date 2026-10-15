package kr.or.compassion.giftwrap.game;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "game_session", indexes = @Index(name = "ix_game_client", columnList = "clientId"))
public class GameSession {

    public enum Status { STARTED, FINISHED, REJECTED }

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 36)
    private String clientId;

    @Column(nullable = false, length = 24)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private GiftType gift;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant finishedAt;
    private Integer score;
    private Integer tapCount;
    private Double avgTps;
    private Integer peakTps;
    private Integer maxCombo;
    private Integer steadiness;
    private Integer completionMs;

    @Column(length = 2)
    private String grade;

    @Version
    private Long version;

    protected GameSession() {
    }

    public GameSession(String id, String clientId, String nickname, GiftType gift, Instant startedAt) {
        this.id = id;
        this.clientId = clientId;
        this.nickname = nickname;
        this.gift = gift;
        this.startedAt = startedAt;
        this.status = Status.STARTED;
    }

    public void finish(ScoreResult r, Instant now) {
        this.status = Status.FINISHED;
        this.finishedAt = now;
        this.score = r.score();
        this.tapCount = r.tapCount();
        this.avgTps = r.avgTps();
        this.peakTps = r.peakTps();
        this.maxCombo = r.maxCombo();
        this.steadiness = r.steadiness();
        this.completionMs = r.completionMs();
        this.grade = r.grade();
    }

    public void reject(Instant now) {
        this.status = Status.REJECTED;
        this.finishedAt = now;
    }

    public ScoreResult toResult() {
        return new ScoreResult(score, tapCount, avgTps, peakTps, maxCombo, steadiness, completionMs, grade);
    }

    public String getId() { return id; }
    public String getClientId() { return clientId; }
    public String getNickname() { return nickname; }
    public GiftType getGift() { return gift; }
    public Status getStatus() { return status; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public Integer getScore() { return score; }
    public String getGrade() { return grade; }
}
