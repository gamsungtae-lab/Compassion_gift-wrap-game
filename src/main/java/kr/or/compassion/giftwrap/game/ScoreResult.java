package kr.or.compassion.giftwrap.game;

/**
 * 점수 계산 결과.
 *
 * @param completionMs 목표 탭 수에 도달한 시각(ms). 도달하지 못했으면 null
 * @param steadiness   리듬 안정도 (0~100)
 */
public record ScoreResult(
        int score,
        int tapCount,
        double avgTps,
        int peakTps,
        int maxCombo,
        int steadiness,
        Integer completionMs,
        String grade) {
}
