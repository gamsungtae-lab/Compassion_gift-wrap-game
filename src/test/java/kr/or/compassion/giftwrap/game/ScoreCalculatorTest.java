package kr.or.compassion.giftwrap.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import kr.or.compassion.giftwrap.common.ApiException;
import kr.or.compassion.giftwrap.config.GameProperties;

class ScoreCalculatorTest {

    private final GameProperties props = new GameProperties(10_000, 60, 250, 20, 120, "Asia/Seoul", List.of(), null);
    private final ScoreCalculator calculator = new ScoreCalculator(props);

    private static List<Integer> steady(int count, int intervalMs) {
        List<Integer> taps = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            taps.add(i * intervalMs);
        }
        return taps;
    }

    @Test
    void noTapsScoresZero() {
        ScoreResult r = calculator.calculate(List.of());
        assertThat(r.score()).isZero();
        assertThat(r.grade()).isEqualTo("C");
        assertThat(r.completionMs()).isNull();
    }

    @Test
    void steadyTenTapsPerSecondCompletesWrap() {
        ScoreResult r = calculator.calculate(steady(100, 100));
        assertThat(r.tapCount()).isEqualTo(100);
        assertThat(r.peakTps()).isEqualTo(10);
        assertThat(r.maxCombo()).isEqualTo(100);
        assertThat(r.steadiness()).isEqualTo(100);
        assertThat(r.completionMs()).isEqualTo(5_900);
        // 100*100 + 10*150 + 100*30 + 100*10 + 2000 + (10000-5900)/2
        assertThat(r.score()).isEqualTo(10_000 + 1_500 + 3_000 + 1_000 + 2_000 + 2_050);
        assertThat(r.grade()).isEqualTo("A");
    }

    @Test
    void fasterTappingScoresHigher() {
        int slow = calculator.calculate(steady(40, 250)).score();
        int fast = calculator.calculate(steady(120, 80)).score();
        assertThat(fast).isGreaterThan(slow);
    }

    @Test
    void duplicateEventsWithinMinIntervalAreMerged() {
        ScoreResult r = calculator.calculate(List.of(0, 5, 10, 100, 105, 200));
        assertThat(r.tapCount()).isEqualTo(3);
    }

    @Test
    void rejectsOutOfOrderOrOutOfRangeTaps() {
        assertThatThrownBy(() -> calculator.calculate(List.of(100, 50))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> calculator.calculate(List.of(-1))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> calculator.calculate(List.of(10_001))).isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsInhumanTapCount() {
        assertThatThrownBy(() -> calculator.calculate(steady(300, 30)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code()).isEqualTo("INVALID_TAPS");
    }
}
