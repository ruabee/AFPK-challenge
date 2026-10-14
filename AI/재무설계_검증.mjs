// 결정적 검사로 확인할 수 있는 범위만 검증합니다. 의미·개인 적합성은 전문가 검토가 필요합니다.
export const REGULATION =
  /세액|세율|공제|법정|수급.?조건|가입.?조건|수령.?나이|규정|납입.?한도|보험금.?지급|DSR|DTI|법률|세금/iu;
const labels = {
  netWorth: "순자산",
  totalAssets: "총자산",
  totalDebts: "총부채",
  monthlySurplus: "잉여현금흐름",
  monthlyExpenses: "월 지출",
  afterSavings: "저축 후 잔액",
  shortage: "은퇴자금 부족액",
};
export function numericClaims(text) {
  return [
    ...text.matchAll(
      /(-?\d[\d,]*(?:\.\d+)?)\s*(천\s*만\s*원|억\s*원|만\s*원|천\s*원|원|%)/g,
    ),
  ].map((m) => ({
    text: m[0],
    decimals: (m[1].split(".")[1] || "").length,
    value:
      Number(m[1].replaceAll(",", "")) *
      (/^천\s*만/.test(m[2]) ? 1e7 : m[2].startsWith("억")
        ? 1e8
        : m[2].startsWith("만")
          ? 1e4
          : m[2].startsWith("천")
            ? 1000
            : 1),
    unit: m[2] === "%" ? "percent" : "KRW",
  }));
}
function resultNumbers(value, out = [], key = "") {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (
      ![
        "months",
        "age",
        "currentAge",
        "retirementAge",
        "endAge",
        "startAge",
        "emergencyMonths",
      ].includes(key)
    )
      out.push({
        value,
        unit: [
          "annualRate",
          "annualGrowth",
          "beforeReturn",
          "afterReturn",
          "inflation",
          "savingsRate",
          "debtRatio",
          "rate",
        ].includes(key)
          ? "percent"
          : "KRW",
      });
  } else if (Array.isArray(value))
    value.forEach((v) => resultNumbers(v, out, key));
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([k, v]) => resultNumbers(v, out, k));
  return out;
}
export function validateAnswer(
  answer,
  { profile, calculations = [], sources = [], question = "", asOf, messages = [] } = {},
) {
  const issues = [];
  const allowed = [
    // 원문 금액의 재진술은 저장 도구 성공 여부와 무관하다. 계산 결과는 별도 검증한다.
    ...messages.filter(m => m.role === "user").flatMap(m => numericClaims(m.content)),
    ...Object.values(profile?.facts || {}).filter(
      (f) => typeof f.value === "number" && ["KRW", "percent"].includes(f.unit),
    ),
    ...resultNumbers(calculations.map((c) => c.result)),
  ];
  const ids = [...answer.matchAll(/\[(R[^\]\s]*)\]/g)].map((m) => m[1]);
  for (const match of answer.matchAll(/\[(R[^\]]*)\]/g)) {
    if (!/^R[a-f0-9]{12}$/.test(match[1])) issues.push({code:"malformed_source",message:"출처 ID는 [R해시] 형식만 허용합니다.",blocking:true});
  }
  for (const id of ids)
    if (!sources.some((s) => s.id === id))
      issues.push({
        code: "unknown_source",
        message: "검색하지 않은 출처가 인용되었습니다.",
        blocking: true,
      });
  for (const url of answer.match(/https?:\/\/[^\s)\]>]+/g) || [])
    if (!sources.some((s) => s.metadata.sourceUrl === url))
      issues.push({
        code: "unknown_url",
        message: "확인되지 않은 URL입니다.",
        blocking: true,
      });
  for (const claim of numericClaims(answer)) {
    const quotedSource = sources.some(
      (s) =>
        ids.includes(s.id) &&
        numericClaims(s.text).some(
          (n) => n.value === claim.value && n.unit === claim.unit,
        ),
    );
    if (
      !allowed.some(
        (n) =>
          n.unit === claim.unit &&
          (n.unit === "percent"
            ? Number(n.value.toFixed(Math.min(10, claim.decimals))) ===
              claim.value
            : Math.abs(n.value - claim.value) <= 1),
      ) &&
      !quotedSource
    )
      issues.push({
        code: "unverified_number",
        message: `도구 결과 또는 사용자 정보에 없는 수치: ${claim.text}`,
        blocking: true,
      });
  }
  for (const c of calculations) {
    for (const [key, label] of Object.entries(labels)) {
      const expected = c.result.metrics?.[key];
      if (typeof expected !== "number") continue;
      for (const line of answer
        .replace(/[|*`#]/g, " ")
        .split("\n")
        .filter((l) => l.includes(label))) {
        const match = line
          .slice(line.indexOf(label) + label.length)
          .match(
            /^\s*(?:은|는|:|=)?\s*(-?\d[\d,]*(?:\.\d+)?\s*(?:천\s*만\s*원|억\s*원|만\s*원|천\s*원|원))/,
          );
        if (match) {
          const val = numericClaims(match[1])[0]?.value;
          if (Math.abs(val - expected) > 1)
            issues.push({
              code: "metric_mismatch",
              message: `${label} 설명과 계산 결과가 다릅니다.`,
              blocking: true,
            });
        }
      }
    }
  }
  for (const c of calculations) {
    const m = c.result.metrics;
    if (
      m &&
      m.monthlySurplus !== m.afterSavings &&
      /저축\s*후[^\n.!?]{0,25}기준/.test(answer) &&
      answer.includes("잉여현금흐름")
    )
      issues.push({
        code: "cashflow_definition",
        message:
          "잉여현금흐름은 저축 차감 전입니다. 저축 후 잔액과 구분해 설명해주세요.",
        blocking: true,
      });
  }
  for (const s of sources)
    if (
      s.metadata.effectiveFrom > (s.searchedAsOf || asOf) ||
      s.metadata.effectiveTo < (s.searchedAsOf || asOf)
    )
      issues.push({
        code: "source_date",
        message: "자료 적용 기간이 기준일과 다릅니다.",
        blocking: true,
      });
  if (
    (REGULATION.test(question) ||
      REGULATION.test(
        answer
          .replace(
            /세금[^\n.!?]{0,60}(?:미반영|제외|반영하지 않음|반영하지 않습니다)/g,
            "",
          )
          .replace(/DSR[^\n.!?]{0,40}(?:아님|아닙니다|다릅니다)/g, ""),
      )) &&
    (!sources.length || !ids.length)
  )
    issues.push({
      code: "regulation_unverified",
      message: "공식 규정의 적용 문서를 확인하지 못했습니다.",
      blocking: !/(확인.*필요|자료.*없|확인.*못|단정.*없|확인되지)/s.test(
        answer,
      ),
    });
  return {
    status: issues.some((i) => i.blocking)
      ? "blocked"
      : issues.length
        ? "needs_review"
        : "checks_passed",
    issues,
    scope:
      "수치·출처 ID·적용 기간의 자동 검사입니다. 모든 환각이나 개인별 적용 적합성을 보증하지 않습니다.",
  };
}
export function citations(sources) {
  return sources.map((s) => ({
    id: s.id,
    searchedAsOf: s.searchedAsOf,
    title: s.metadata.title,
    url: s.metadata.sourceUrl,
    publisher: s.metadata.publisher,
    page: s.page,
    effectiveFrom: s.metadata.effectiveFrom,
    effectiveTo: s.metadata.effectiveTo,
    reviewedAt: s.metadata.reviewedAt,
    appliesTo: s.metadata.appliesTo,
    excerpt: s.text.slice(0, 1000),
  }));
}
