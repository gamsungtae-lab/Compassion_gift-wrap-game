package kr.or.compassion.giftwrap.common;

/** 로그 인젝션 방지 (CR/LF 및 제어문자 제거, 길이 제한). */
public final class LogSanitizer {

    private LogSanitizer() {
    }

    public static String clean(String value) {
        if (value == null) {
            return "null";
        }
        String s = value.replaceAll("[\\p{Cntrl}]", "_");
        return s.length() > 100 ? s.substring(0, 100) + "…" : s;
    }
}
