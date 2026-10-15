package kr.or.compassion.giftwrap.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import kr.or.compassion.giftwrap.common.ApiException;
import kr.or.compassion.giftwrap.config.GameProperties;

class NicknamePolicyTest {

    private final NicknamePolicy policy = new NicknamePolicy(
            new GameProperties(10_000, 60, 250, 20, 120, "Asia/Seoul", List.of("badword", "관리자"), null));

    @Test
    void acceptsKoreanEnglishDigits() {
        assertThat(policy.sanitize("  산타  요정 7 ")).isEqualTo("산타 요정 7");
        assertThat(policy.sanitize("Rudolph_2")).isEqualTo("Rudolph_2");
    }

    @Test
    void rejectsMarkupAndControlCharacters() {
        assertThatThrownBy(() -> policy.sanitize("<script>")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> policy.sanitize("a\nb")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> policy.sanitize("a")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> policy.sanitize("열세글자넘는닉네임입니다요")).isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsBannedWordsIgnoringSpacesAndCase() {
        assertThatThrownBy(() -> policy.sanitize("Bad Word")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> policy.sanitize("관 리 자")).isInstanceOf(ApiException.class);
    }
}
