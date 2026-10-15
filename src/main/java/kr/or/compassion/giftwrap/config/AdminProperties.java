package kr.or.compassion.giftwrap.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 운영자 계정. 값은 반드시 환경변수로 주입하며 소스에 하드코딩하지 않는다.
 * passwordHash 는 "{bcrypt}$2a$..." 형식의 해시만 허용한다.
 */
@ConfigurationProperties(prefix = "admin")
public record AdminProperties(String username, String passwordHash) {

    public boolean enabled() {
        return username != null && !username.isBlank()
                && passwordHash != null && passwordHash.startsWith("{bcrypt}");
    }
}
