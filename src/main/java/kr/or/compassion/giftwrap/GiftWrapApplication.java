package kr.or.compassion.giftwrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class GiftWrapApplication {

    public static void main(String[] args) {
        SpringApplication.run(GiftWrapApplication.class, args);
    }
}
