import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { root, loadConfig } from "./환경설정.mjs";
import { ClientError, validatePayload } from "./요청검증.mjs";
import { normalizeProfile } from "../AI/고객정보/고객정보.mjs";
import { loadIndex } from "../AI/재무설계_RAG/문서검색.mjs";
import { askClaude } from "../AI/클로드연결.mjs";

function json(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(data));
}
const assets = new Map([
  ["/", ["화면.html", "text/html"]],
  ["/index.html", ["화면.html", "text/html"]],
  ["/app.js", ["대화.js", "text/javascript"]],
  ["/planning-profile.js", ["고객정보.js", "text/javascript"]],
  ["/simulator.js", ["투자시뮬레이터.js", "text/javascript"]],
  ["/style.css", ["디자인.css", "text/css"]],
]);
export function makeHandler({
  getConfig = loadConfig,
  fetchImpl = fetch,
  deployed = false,
  allowedOrigins = [],
} = {}) {
  let active = false,
    starts = [];
  return async (req, res) => {
    try {
      const host = req.headers.host;
      const origins = deployed ? allowedOrigins : [`http://${host}`];
      const allowedHost = deployed
        ? origins.some((origin) => {
            try {
              return new URL(origin).host === host;
            } catch {
              return false;
            }
          })
        : /^(127\.0\.0\.1|localhost):\d+$/.test(host || "");
      if (!allowedHost)
        return json(res, 403, { error: "허용되지 않은 서비스 주소입니다." });
      if (req.headers.origin && !origins.includes(req.headers.origin))
        return json(res, 403, { error: "허용되지 않은 요청입니다." });
      if (req.headers["sec-fetch-site"] === "cross-site")
        return json(res, 403, { error: "허용되지 않은 요청입니다." });
      const path = new URL(req.url, "http://localhost").pathname;
      if (req.method === "GET" && path === "/api/health") {
        const c = await getConfig();
        return json(res, 200, {
          configured: !!c.key,
          model: c.model,
          rag: (await loadIndex()).documents?.length > 0,
          planning: true,
        });
      }
      if (req.method === "GET" && assets.has(path)) {
        const [name, type] = assets.get(path);
        const file = await readFile(new URL("FE/" + name, root));
        res.writeHead(200, {
          "content-type": type + "; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        });
        return res.end(file);
      }
      if (req.method !== "POST" || path !== "/api/chat")
        return json(res, 404, { error: "찾을 수 없습니다." });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new ClientError(415, "JSON 요청이 필요합니다.");
      let body;
      if (req.body !== undefined) {
        // Vercel 함수에서는 JSON 요청이 이미 해석되어 전달될 수 있습니다.
        const raw =
          typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        if (Buffer.byteLength(raw) > 400000)
          throw new ClientError(413, "메시지가 너무 큽니다.");
        try {
          body = JSON.parse(raw);
        } catch {
          throw new ClientError(400, "요청 형식을 확인해주세요.");
        }
      } else {
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 400000)
            throw new ClientError(413, "메시지가 너무 큽니다.");
          chunks.push(chunk);
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          throw new ClientError(400, "요청 형식을 확인해주세요.");
        }
      }
      const { messages, simulation } = validatePayload(body);
      let customerProfile;
      try {
        customerProfile = normalizeProfile(body.customerProfile, messages);
      } catch (error) {
        throw new ClientError(400, error.message);
      }
      const c = await getConfig();
      if (!c.key)
        throw new ClientError(
          503,
          "서버 환경변수 ANTHROPIC_API_KEY를 설정해주세요.",
        );
      if (active)
        throw new ClientError(
          429,
          "이전 답변을 생성하고 있습니다. 잠시 기다려주세요.",
        );
      starts = starts.filter((t) => Date.now() - t < 60000);
      if (starts.length >= 10)
        throw new ClientError(
          429,
          "요청이 많습니다. 1분 뒤 다시 시도해주세요.",
        );
      active = true;
      starts.push(Date.now());
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 80000);
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        const response = await askClaude({
          config: c,
          messages,
          simulation,
          customerProfile,
          signal: controller.signal,
          fetchImpl,
        });
        json(res, response.status, response.body);
      } catch (e) {
        if (!res.destroyed)
          json(res, 504, {
            error: controller.signal.aborted
              ? "응답 시간이 초과되었습니다. 다시 시도해주세요."
              : "Claude 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.",
          });
      } finally {
        clearTimeout(timer);
        active = false;
      }
    } catch (e) {
      if (!res.destroyed && !res.headersSent)
        json(res, e.status || 500, {
          error:
            e instanceof ClientError ? e.message : "서버 설정을 확인해주세요.",
        });
    }
  };
}

export function makeServer(options) {
  return createServer(makeHandler(options));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = await loadConfig();
  const server = makeServer();
  server.requestTimeout = 85000;
  server.on("error", (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? "포트가 사용 중입니다. .env의 PORT를 변경해주세요."
        : "서버를 시작할 수 없습니다.",
    );
    process.exitCode = 1;
  });
  server.listen(config.port, "127.0.0.1", () =>
    console.log(
      `AskYES: http://127.0.0.1:${config.port} (API key ${config.key ? "configured" : "missing"})`,
    ),
  );
}
