import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
export const root = new URL("../", import.meta.url);
// 설정은 요청마다 다시 읽으며 키 값은 출력하지 않습니다.
export async function loadConfig() {
  let local = {};
  try {
    local = parseEnv(await readFile(new URL(".env", root), "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return {
    workspace: (
      process.env.ANTHROPIC_WORKSPACE_ID ||
      local.ANTHROPIC_WORKSPACE_ID ||
      ""
    ).trim(),
    key: (
      process.env.ANTHROPIC_API_KEY ||
      local.ANTHROPIC_API_KEY ||
      ""
    ).trim(),
    model:
      process.env.ANTHROPIC_MODEL ||
      local.ANTHROPIC_MODEL ||
      "claude-sonnet-4-6",
    port: Number(process.env.PORT || local.PORT || 4174),
  };
}
