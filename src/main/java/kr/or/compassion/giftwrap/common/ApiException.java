package kr.or.compassion.giftwrap.common;

import org.springframework.http.HttpStatus;

/** 사용자에게 그대로 보여줘도 안전한 메시지만 담는 예외. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String safeMessage) {
        super(safeMessage);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
