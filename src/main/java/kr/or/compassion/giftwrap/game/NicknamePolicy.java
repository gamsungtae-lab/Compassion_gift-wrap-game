package kr.or.compassion.giftwrap.game;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import kr.or.compassion.giftwrap.common.ApiException;
import kr.or.compassion.giftwrap.config.GameProperties;

/** 닉네임 정규화 및 허용 목록(allow-list) 기반 검증, 금칙어 필터. */
@Component
public class NicknamePolicy {

    /** 한글 완성형, 영문, 숫자, 공백, 밑줄만 허용 */
    public static final String REGEX = "^[가-힣a-zA-Z0-9_ ]{2,12}$";
    private static final Pattern ALLOWED = Pattern.compile(REGEX);

    private final List<String> bannedWords;

    public NicknamePolicy(GameProperties props) {
        this.bannedWords = props.bannedWords().stream()
                .map(w -> w.toLowerCase(Locale.ROOT).replace(" ", ""))
                .filter(w -> !w.isEmpty())
                .toList();
    }

    public String sanitize(String input) {
        if (input == null || input.chars().anyMatch(Character::isISOControl)) {
            throw invalid();
        }
        String nick = Normalizer.normalize(input, Normalizer.Form.NFC).trim().replaceAll(" {2,}", " ");
        if (!ALLOWED.matcher(nick).matches()) {
            throw invalid();
        }
        String compact = nick.toLowerCase(Locale.ROOT).replace(" ", "").replace("_", "");
        for (String banned : bannedWords) {
            if (compact.contains(banned)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "NICKNAME_NOT_ALLOWED", "사용할 수 없는 닉네임이에요.");
            }
        }
        return nick;
    }

    private ApiException invalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_NICKNAME",
                "닉네임은 한글/영문/숫자 2~12자로 입력해 주세요.");
    }
}
