package kr.or.compassion.giftwrap.leaderboard;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

@RestController
@RequestMapping("/api/leaderboard")
@Validated
public class LeaderboardController {

    private final LeaderboardService service;

    public LeaderboardController(LeaderboardService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<LeaderboardService.Board> top(
            @RequestParam(defaultValue = "all") @Pattern(regexp = "^(all|today)$") String period,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit) {
        LeaderboardService.Period p = "today".equals(period) ? LeaderboardService.Period.TODAY : LeaderboardService.Period.ALL;
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.top(p, limit));
    }
}
