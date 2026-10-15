package kr.or.compassion.giftwrap.game;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import kr.or.compassion.giftwrap.common.ApiException;
import kr.or.compassion.giftwrap.config.GameProperties;

/**
 * 서버 기준 점수 계산기. 클라이언트는 탭 타임스탬프만 보내고 점수는 서버가 계산한다.
 * 프론트엔드 js/scoring.js 와 동일한 공식을 사용한다.
 *
 * <pre>
 * 점수 = 탭수 × 100                     (기본: 얼마나 많이)
 *      + 최고 순간속도(1초 최다 탭) × 150  (폭발력)
 *      + 최대 콤보 × 30                  (0.25초 이내 연속 탭 유지력)
 *      + 리듬 안정도(0~100) × 10          (일정한 박자)
 *      + 포장 완성 보너스 2000 + 남은 시간(ms) ÷ 2   (목표 탭 도달 시)
 * </pre>
 */
@Component
public class ScoreCalculator {

    static final int COMBO_WINDOW_MS = 250;
    static final int PEAK_WINDOW_MS = 1000;

    private final GameProperties props;

    public ScoreCalculator(GameProperties props) {
        this.props = props;
    }

    public ScoreResult calculate(List<Integer> rawTaps) {
        int duration = props.durationMs();
        int[] taps = normalize(rawTaps, duration);
        int n = taps.length;

        if (n > props.maxTaps()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TAPS",
                    "사람의 손으로는 불가능한 속도예요! 다시 도전해 주세요.");
        }

        int peak = 0;
        for (int i = 0, j = 0; i < n; i++) {
            while (taps[i] - taps[j] >= PEAK_WINDOW_MS) {
                j++;
            }
            peak = Math.max(peak, i - j + 1);
        }

        int maxCombo = 0;
        int combo = 0;
        for (int i = 0; i < n; i++) {
            combo = (i > 0 && taps[i] - taps[i - 1] <= COMBO_WINDOW_MS) ? combo + 1 : 1;
            maxCombo = Math.max(maxCombo, combo);
        }

        int steadiness = 0;
        if (n >= 5) {
            double sum = 0;
            for (int i = 1; i < n; i++) {
                sum += taps[i] - taps[i - 1];
            }
            double mean = sum / (n - 1);
            double var = 0;
            for (int i = 1; i < n; i++) {
                double d = (taps[i] - taps[i - 1]) - mean;
                var += d * d;
            }
            double cv = mean > 0 ? Math.sqrt(var / (n - 1)) / mean : 1;
            steadiness = (int) Math.round(Math.max(0, Math.min(1, 1 - cv)) * 100);
        }

        Integer completionMs = n >= props.targetTaps() ? taps[props.targetTaps() - 1] : null;

        int score = n * 100 + peak * 150 + maxCombo * 30 + steadiness * 10;
        if (completionMs != null) {
            score += 2000 + (duration - completionMs) / 2;
        }

        double avgTps = Math.round(n * 10_000.0 / duration) / 10.0;
        return new ScoreResult(score, n, avgTps, peak, maxCombo, steadiness, completionMs, grade(score));
    }

    static String grade(int score) {
        if (score >= 22_000) return "S";
        if (score >= 16_000) return "A";
        if (score >= 11_000) return "B";
        return "C";
    }

    /** 범위/순서 검증 후, 최소 간격보다 촘촘한 입력은 하나로 합친다. */
    private int[] normalize(List<Integer> raw, int duration) {
        int[] kept = new int[raw.size()];
        int count = 0;
        int prev = -1;
        int lastKept = Integer.MIN_VALUE / 2;
        for (Integer t : raw) {
            if (t == null || t < 0 || t > duration || t < prev) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TAPS", "탭 기록이 올바르지 않아요.");
            }
            prev = t;
            if (t - lastKept >= props.minTapIntervalMs()) {
                kept[count++] = t;
                lastKept = t;
            }
        }
        int[] result = new int[count];
        System.arraycopy(kept, 0, result, 0, count);
        return result;
    }
}
