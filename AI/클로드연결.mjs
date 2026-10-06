import { readFile } from "node:fs/promises";
const system = await readFile(
  new URL("./상담지침.md", import.meta.url),
  "utf8",
);

// 민감한 원문 오류 대신 사용자 안내만 반환합니다.
export function upstreamError(status, detail = "") {
  if (/not scoped to a workspace|anthropic-workspace-id/i.test(detail))
    return "이 API 키는 워크스페이스 ID가 필요합니다. .env에 ANTHROPIC_WORKSPACE_ID=wrkspc_...를 설정해주세요.";
  if (/credit balance|billing|purchase credits/i.test(detail))
    return "Anthropic API 크레딧이 부족합니다. Console에서 결제·크레딧을 확인해주세요.";
  if (
    [401, 403].includes(status) ||
    /api.?key|authentication|credential/i.test(detail)
  )
    return "API 키 인증에 실패했습니다. 프로젝트 .env의 ANTHROPIC_API_KEY를 Anthropic Console에서 발급한 키로 확인해주세요.";
  if (status === 404 || /model/i.test(detail))
    return "설정된 Claude 모델을 사용할 수 없습니다. .env의 ANTHROPIC_MODEL을 확인해주세요.";
  if (status === 429)
    return "API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.";
  return "Claude 연결에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

export async function askClaude({
  config,
  messages,
  simulation,
  signal,
  fetchImpl = fetch,
}) {
  const outgoing = messages.map((m) => ({ ...m }));
  if (simulation)
    outgoing[outgoing.length - 1].content +=
      "\n\n[시뮬레이터 입력과 서버 계산 결과 / 금액 단위 만 원]\n" +
      JSON.stringify(simulation);
  const upstream = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.key,
      "anthropic-version": "2023-06-01",
      ...(config.workspace
        ? { "anthropic-workspace-id": config.workspace }
        : {}),
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1800,
      system: system,
      messages: outgoing,
    }),
    signal: signal,
  });
  const result = await upstream.json();
  if (!upstream.ok)
    return {
      status: 502,
      body: { error: upstreamError(upstream.status, result.error?.message) },
    };
  const reply = result.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!reply)
    return {
      status: 502,
      body: { error: "답변을 받지 못했습니다. 다시 시도해주세요." },
    };
  return {
    status: 200,
    body: { reply, truncated: result.stop_reason === "max_tokens" },
  };
}
