package kr.or.compassion.giftwrap.admin;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.constraints.Pattern;
import kr.or.compassion.giftwrap.game.GameDtos;
import kr.or.compassion.giftwrap.game.GameService;

/** 운영자 전용: 부적절한 닉네임/기록을 순위표에서 제거. ROLE_ADMIN 필요 (SecurityConfig). */
@RestController
@RequestMapping("/api/admin")
@Validated
public class AdminController {

    private final GameService gameService;

    public AdminController(GameService gameService) {
        this.gameService = gameService;
    }

    @DeleteMapping("/games/{gameId}")
    public ResponseEntity<Void> remove(@PathVariable @Pattern(regexp = GameDtos.UUID_REGEX) String gameId) {
        gameService.adminRemove(gameId);
        return ResponseEntity.noContent().build();
    }
}
