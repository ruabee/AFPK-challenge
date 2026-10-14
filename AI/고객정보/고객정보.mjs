// 고객정보는 현재 탭에서 왕복 전달됩니다. 서버 전역·로그·DB에 보관하지 않습니다.
export const STAGES = [
  "고객과의 관계정립",
  "고객 관련 정보 수집",
  "고객 재무상태 분석 및 평가",
  "재무설계 제안서 작성 및 제시",
  "재무설계안 실행 지원",
  "모니터링 및 재평가",
];
export const FIELDS = {
  monthlyIncome: "월 실수령액",
  monthlyLivingExpenses: "월 생활비(저축·대출상환 제외)",
  monthlyDebtPayments: "월 대출상환액",
  annualIrregularExpenses: "연 비정기지출",
  monthlySavings: "월 저축액",
  totalAssets: "총자산",
  totalDebts: "총부채",
  emergencyFunds: "즉시 사용 가능한 비상자금",
  monthlyEssentialExpenses: "월 필수지출(필수 대출상환 포함)",
  currentAge: "현재나이",
  retirementAge: "은퇴나이",
  endAge: "설계 종료나이",
  retirementAssets: "은퇴용 현재자산",
  monthlyExpenseToday: "현재 구매력 기준 은퇴 월생활비",
  monthlyRetirementSaving: "은퇴 전 월 적립액",
  otherMonthlyIncome: "은퇴 후 기타 월소득",
  riskTolerance: "손실 감내 수준",
  scope: "상담 범위",
  consent: "상담 동의",
  reviewDate: "재평가 예정일",
  pensionStatus: "연금 유무",
  insuranceStatus: "보험 유무",
  assetStatus: "자산 유무",
  debtStatus: "부채 유무",
  goal: "주요 재무목표",
};
const collections = {
  goals: ["name", "targetAmount", "currentAmount", "months", "priority"],
  pensions: ["name", "monthlyAmount", "startAge", "endAge", "annualGrowth"],
  insurance: ["name", "monthlyPremium", "coverage"],
  assets: ["name", "amount", "liquid"],
  debts: ["name", "amount", "annualRate", "monthlyPayment", "endDate"],
  assumptions: [
    "annualRate",
    "months",
    "amount",
    "targetAmount",
    "currentAmount",
    "beforeReturn",
    "afterReturn",
    "inflation",
  ],
  actions: ["task", "status", "dueDate"],
};
const strings = new Set([
  "riskTolerance",
  "scope",
  "consent",
  "reviewDate",
  "pensionStatus",
  "insuranceStatus",
  "assetStatus",
  "debtStatus",
  "goal",
  "name",
  "coverage",
  "liquid",
  "priority",
  "endDate",
  "task",
  "status",
  "dueDate",
]);
const rates = new Set([
  "annualRate",
  "annualGrowth",
  "beforeReturn",
  "afterReturn",
  "inflation",
]);
const ages = new Set(["currentAge", "retirementAge", "endAge", "startAge"]);
export function fieldType(path) {
  if (typeof path !== "string" || path.length > 100)
    throw new Error("정보 경로를 확인해주세요.");
  const parts = path.split("."),
    last = parts.at(-1);
  if (
    !(parts.length === 1 && Object.hasOwn(FIELDS, path)) &&
    !(
      parts.length === 3 &&
      collections[parts[0]]?.includes(last) &&
      /^[a-zA-Z0-9_-]{1,32}$/.test(parts[1])
    )
  )
    throw new Error("지원하지 않는 고객정보 항목입니다.");
  return strings.has(last)
    ? "text"
    : rates.has(last)
      ? "percent"
      : ages.has(last)
        ? "age"
        : last === "months"
          ? "months"
          : "KRW";
}
export function emptyProfile() {
  return { version: 1, facts: {}, stage: 1, stageEvidence: null };
}
export function numberInQuote(value, unit, quote) {
  if (unit === "KRW") {
    const matches = [
      ...quote.matchAll(
        /(-?\d[\d,]*(?:\.\d+)?)\s*(천\s*만\s*원|억\s*원|만\s*원|천\s*원|원)/g,
      ),
    ];
    return matches.some(
      (m) =>
        Math.abs(
          Number(m[1].replaceAll(",", "")) *
            (/^천\s*만/.test(m[2]) ? 1e7 : m[2].startsWith("억")
              ? 1e8
              : m[2].startsWith("만")
                ? 1e4
                : m[2].startsWith("천")
                  ? 1000
                  : 1) -
            value,
        ) < 0.001,
    );
  }
  if (unit === "months" && [...quote.matchAll(/(\d+(?:\.\d+)?)\s*년/g)].some(m => Number(m[1]) * 12 === value)) return true;
  const suffix =
    unit === "percent"
      ? "%"
      : unit === "age"
        ? "(?:세|살)"
        : unit === "months"
          ? "개월"
          : "";
  return [
    ...quote.matchAll(
      new RegExp("(-?\\d[\\d,]*(?:\\.\\d+)?)\\s*" + suffix, "g"),
    ),
  ].some((m) => Number(m[1].replaceAll(",", "")) === value);
}
export function checkedFact(path, entry, messages) {
  const unit = fieldType(path);
  if (
    !entry ||
    typeof entry !== "object" ||
    typeof entry.quote !== "string" ||
    entry.quote.length < 1 ||
    entry.quote.length > 1200 ||
    !Number.isInteger(entry.messageIndex)
  )
    throw new Error("정보의 사용자 발언 근거가 필요합니다.");
  const message = messages[entry.messageIndex];
  if (message?.role !== "user" || !message.content.includes(entry.quote))
    throw new Error("사용자 발언에서 정보의 근거를 확인할 수 없습니다.");
  if (unit === "text") {
    if (
      typeof entry.value !== "string" ||
      !entry.value ||
      entry.value.length > 500 ||
      !entry.quote.includes(entry.value)
    )
      throw new Error("문자 정보는 사용자 표현 그대로 기록해주세요.");
  } else {
    if (
      typeof entry.value !== "number" ||
      !Number.isFinite(entry.value) ||
      entry.value > (unit === "KRW" ? 1e15 : unit === "months" ? 1200 : 120) ||
      entry.value < (unit === "percent" ? -99 : 0) ||
      (["age", "months"].includes(unit) && !Number.isInteger(entry.value))
    )
      throw new Error("정보의 수치 또는 단위를 확인해주세요.");
    if (!numberInQuote(entry.value, unit, entry.quote))
      throw new Error(
        "사용자 발언의 금액·단위와 입력한 값이 일치하지 않습니다. 원/만원, 세, 개월, %를 명시해 다시 확인해주세요.",
      );
  }
  return {
    value: entry.value,
    unit,
    quote: entry.quote,
    messageIndex: entry.messageIndex,
    source: "user",
    confirmed: true,
  };
}
export function normalizeProfile(input, messages) {
  if (input === undefined || input === null) return emptyProfile();
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !input.facts ||
    typeof input.facts !== "object" ||
    Array.isArray(input.facts) ||
    Object.keys(input.facts).length > 150
  )
    throw new Error("고객정보 형식이 올바르지 않습니다.");
  const result = emptyProfile();
  for (const [path, value] of Object.entries(input.facts))
    result.facts[path] = checkedFact(path, value, messages);
  if (input.stage !== undefined) {
    if (!Number.isInteger(input.stage) || input.stage < 1 || input.stage > 6)
      throw new Error("상담 단계가 올바르지 않습니다.");
    if (input.stage > 1) {
      const e = input.stageEvidence;
      if (
        !e ||
        messages[e.messageIndex]?.role !== "user" ||
        typeof e.quote !== "string" ||
        !e.quote ||
        !messages[e.messageIndex].content.includes(e.quote)
      )
        throw new Error("상담 단계 변경의 사용자 근거가 필요합니다.");
      result.stage = input.stage;
      result.stageEvidence = { messageIndex: e.messageIndex, quote: e.quote };
    }
  }
  return result;
}
export function updateProfile(profile, changes, messages) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 30)
    throw new Error("한 번에 1~30개 정보만 기록할 수 있습니다.");
  const next = { ...profile.facts };
  for (const change of changes) {
    const fact = checkedFact(change.path, change, messages);
    if (next[change.path] && next[change.path].messageIndex > fact.messageIndex)
      throw new Error("이전 발언으로 더 최근 정보를 덮어쓸 수 없습니다.");
    next[change.path] = fact;
  }
  if (Object.keys(next).length > 150)
    throw new Error("고객정보 항목 한도를 초과했습니다.");
  profile.facts = next;
  return profile;
}
export function profileSummary(profile) {
  const missing = [
    "goal",
    "monthlyIncome",
    "monthlyLivingExpenses",
    "monthlyDebtPayments",
    "annualIrregularExpenses",
    "totalAssets",
    "totalDebts",
    "riskTolerance",
  ].filter((k) => !Object.hasOwn(profile.facts, k));
  return {
    ...profile,
    stageName: STAGES[profile.stage - 1],
    missing,
    known: Object.keys(profile.facts),
    instructions:
      "known은 다시 질문하지 말고 최신 발언이 정정이면 갱신. missing 중 현재 질문에 필요한 것 1~2개만 질문. 누락은 0이 아님.",
  };
}
