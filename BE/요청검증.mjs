// 대화 입력 검증과 서버 투자 계산
export class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function validatePayload(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 41)
    throw new ClientError(
      400,
      "대화는 최대 20회까지 이어집니다. 새 대화를 시작해주세요.",
    );
  let total = 0;
  const clean = messages.map((m, i) => {
    if (
      !m ||
      m.role !== (i % 2 ? "assistant" : "user") ||
      typeof m.content !== "string" ||
      !m.content.trim() ||
      m.content.length > 16000
    )
      throw new ClientError(
        400,
        "대화 형식이 올바르지 않거나 메시지가 너무 깁니다.",
      );
    total += m.content.length;
    return { role: m.role, content: m.content };
  });
  if (clean.at(-1).role !== "user" || total > 100000)
    throw new ClientError(400, "대화가 너무 깁니다. 새 대화를 시작해주세요.");
  let simulation;
  if (body.simulation != null) {
    const s = body.simulation;
    for (const [name, min, max] of [
      ["initial", 0, 1000000],
      ["monthly", 0, 300],
      ["years", 1, 30],
      ["rate", -10, 15],
    ]) {
      if (
        typeof s[name] !== "number" ||
        !Number.isFinite(s[name]) ||
        s[name] < min ||
        s[name] > max
      )
        throw new ClientError(400, "시뮬레이션 입력 범위를 확인해주세요.");
    }
    if (!Number.isInteger(s.years))
      throw new ClientError(400, "투자 기간은 정수로 입력해주세요.");
    let value = s.initial;
    for (let i = 0; i < s.years * 12; i++)
      value = value * (1 + s.rate / 1200) + s.monthly;
    simulation = {
      initial: s.initial,
      monthly: s.monthly,
      years: s.years,
      rate: s.rate,
      principal: s.initial + s.monthly * s.years * 12,
      value: Math.round(value * 100) / 100,
    };
  }
  return { messages: clean, simulation };
}
