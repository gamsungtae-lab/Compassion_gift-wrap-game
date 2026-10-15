package kr.or.compassion.giftwrap.game;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import kr.or.compassion.giftwrap.game.GameDtos.FinishRequest;
import kr.or.compassion.giftwrap.game.GameDtos.FinishResponse;
import kr.or.compassion.giftwrap.game.GameDtos.RankResponse;
import kr.or.compassion.giftwrap.game.GameDtos.ShareResponse;
import kr.or.compassion.giftwrap.game.GameDtos.StartRequest;
import kr.or.compassion.giftwrap.game.GameDtos.StartResponse;

@RestController
@RequestMapping("/api/games")
@Validated
public class GameController {

    private final GameService service;

    public GameController(GameService service) {
        this.service = service;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StartResponse> start(@Valid @RequestBody StartRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.start(request));
    }

    @PostMapping(path = "/{gameId}/finish", consumes = MediaType.APPLICATION_JSON_VALUE)
    public FinishResponse finish(@PathVariable @Pattern(regexp = GameDtos.UUID_REGEX) String gameId,
                                 @Valid @RequestBody FinishRequest request) {
        return service.finish(gameId, request);
    }

    @GetMapping("/{gameId}/rank")
    public ResponseEntity<RankResponse> rank(@PathVariable @Pattern(regexp = GameDtos.UUID_REGEX) String gameId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.rank(gameId));
    }

    @GetMapping("/{gameId}/share")
    public ShareResponse share(@PathVariable @Pattern(regexp = GameDtos.UUID_REGEX) String gameId) {
        return service.share(gameId);
    }
}
