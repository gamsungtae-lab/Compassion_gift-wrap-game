package kr.or.compassion.giftwrap.game;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "game.duration-ms=300",
        "game.target-taps=5",
        "spring.datasource.url=jdbc:h2:mem:test;DB_CLOSE_DELAY=-1",
        "app.public-base-url=https://gift.example.org"
})
@AutoConfigureMockMvc
class GameApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private String startGame(String clientId, String nickname) throws Exception {
        String body = mvc.perform(post("/api/games").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"" + nickname + "\",\"clientId\":\"" + clientId + "\",\"gift\":\"BEAR\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("gameId").asText();
    }

    @Test
    void fullGameFlowRanksPlayer() throws Exception {
        String clientId = UUID.randomUUID().toString();
        String gameId = startGame(clientId, "테스트요정");
        Thread.sleep(350);

        String body = mvc.perform(post("/api/games/" + gameId + "/finish").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":\"" + clientId + "\",\"taps\":[0,40,80,120,160,200,240]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.tapCount").value(7))
                .andExpect(jsonPath("$.allRank.rank").isNumber())
                .andReturn().getResponse().getContentAsString();
        JsonNode res = json.readTree(body);
        int score = res.get("result").get("score").asInt();

        mvc.perform(get("/api/leaderboard").param("period", "today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.gameId=='" + gameId + "')].score").value(score));

        // 같은 게임은 두 번 제출할 수 없다
        mvc.perform(post("/api/games/" + gameId + "/finish").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":\"" + clientId + "\",\"taps\":[0]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void rejectsFinishBeforeGameDuration() throws Exception {
        String clientId = UUID.randomUUID().toString();
        String gameId = startGame(clientId, "급한요정");
        mvc.perform(post("/api/games/" + gameId + "/finish").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":\"" + clientId + "\",\"taps\":[0,50]}"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void otherClientCannotFinishSomeoneElsesGame() throws Exception {
        String gameId = startGame(UUID.randomUUID().toString(), "주인요정");
        Thread.sleep(350);
        mvc.perform(post("/api/games/" + gameId + "/finish").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":\"" + UUID.randomUUID() + "\",\"taps\":[0]}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void postWithoutCsrfTokenIsForbidden() throws Exception {
        mvc.perform(post("/api/games").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"요정\",\"clientId\":\"" + UUID.randomUUID() + "\",\"gift\":\"BEAR\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void invalidNicknameIsRejected() throws Exception {
        mvc.perform(post("/api/games").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"<img src=x>\",\"clientId\":\"" + UUID.randomUUID() + "\",\"gift\":\"BEAR\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
    }

    @Test
    void invalidLeaderboardParamsAreRejected() throws Exception {
        mvc.perform(get("/api/leaderboard").param("period", "x' OR 1=1"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/leaderboard").param("limit", "1000"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminApiRequiresAuthentication() throws Exception {
        mvc.perform(delete("/api/admin/games/" + UUID.randomUUID()).with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void indexHasAbsoluteShareImageAndHealthIsPublic() throws Exception {
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .string(org.hamcrest.Matchers.containsString("https://gift.example.org/assets/og-image.png")));
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }

    @Test
    void unknownPathsAreDeniedAndSecurityHeadersPresent() throws Exception {
        mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/leaderboard"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().exists("Content-Security-Policy"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }
}
