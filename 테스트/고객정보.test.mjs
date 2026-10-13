import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProfile,
  emptyProfile,
  updateProfile,
  profileSummary,
} from "../AI/고객정보/고객정보.mjs";
import { executeTool } from "../AI/재무설계_도구.mjs";
const messages = [
  {
    role: "user",
    content: "월 실수령액은 300만원입니다. 목표는 내 집 마련입니다.",
  },
  { role: "assistant", content: "소득은 400만원입니다." },
  { role: "user", content: "정정합니다. 월 실수령액은 350만원입니다." },
];
const change = {
  path: "monthlyIncome",
  value: 3000000,
  quote: "월 실수령액은 300만원",
  messageIndex: 0,
};
test("사용자 원문 근거·만원→원·정정 후 재질문 목록 제외", () => {
  const p = emptyProfile();
  updateProfile(p, [change], messages);
  assert.equal(p.facts.monthlyIncome.value, 3000000);
  assert.ok(!profileSummary(p).missing.includes("monthlyIncome"));
  updateProfile(
    p,
    [
      {
        ...change,
        value: 3500000,
        quote: "월 실수령액은 350만원",
        messageIndex: 2,
      },
    ],
    messages,
  );
  assert.throws(() => updateProfile(p, [change], messages));
  assert.equal(
    normalizeProfile(p, messages).facts.monthlyIncome.value,
    3500000,
  );
});
test("assistant 발언·추측 금액·단위 누락·위조 profile 거절", () => {
  for (const c of [
    { ...change, value: 4000000, quote: "소득은 400만원", messageIndex: 1 },
    { ...change, value: 4000000 },
    { ...change, quote: "월 실수령액은 300" },
    { ...change, path: "__proto__" },
  ])
    assert.throws(() => updateProfile(emptyProfile(), [c], messages));
  assert.throws(() =>
    normalizeProfile(
      { facts: { monthlyIncome: { ...change, value: 999 } } },
      messages,
    ),
  );
});
test("계산은 저장된 사실 경로만 사용·다른 고객정보 섞이지 않음", () => {
  const profile = emptyProfile();
  updateProfile(profile, [change], messages);
  const ctx = {
    profile,
    messages,
    index: { chunks: [] },
    calculations: [],
    sources: [],
    asOf: "2026-10-08",
  };
  const result = executeTool("calculate_financial_status", {}, ctx);
  assert.equal(result.result.metrics.monthlyIncome, 3000000);
  assert.equal(result.result.metrics.netWorth, null);
  assert.throws(() =>
    executeTool(
      "calculate_goal_funding",
      { operation: "fv", bindings: { amount: 3000000 } },
      ctx,
    ),
  );
  assert.equal(Object.keys(emptyProfile().facts).length, 0);
});
test("목표·연금·보험·위험성향 구조화와 단계 근거", () => {
  const ms = [
    {
      role: "user",
      content:
        "목표는 은퇴입니다. 국민연금은 65세부터 90세까지 월 100만원, 증가율 0%로 가정합니다. 보험은 없음. 보수적입니다. 상담을 시작하겠습니다.",
    },
  ];
  const p = emptyProfile();
  updateProfile(
    p,
    [
      { path: "goal", value: "은퇴", quote: "목표는 은퇴", messageIndex: 0 },
      {
        path: "pensions.nps.monthlyAmount",
        value: 1000000,
        quote: "월 100만원",
        messageIndex: 0,
      },
      {
        path: "pensions.nps.startAge",
        value: 65,
        quote: "65세부터",
        messageIndex: 0,
      },
      {
        path: "insuranceStatus",
        value: "없음",
        quote: "보험은 없음",
        messageIndex: 0,
      },
      {
        path: "riskTolerance",
        value: "보수적",
        quote: "보수적입니다",
        messageIndex: 0,
      },
    ],
    ms,
  );
  const ctx = { profile: p, messages: ms, calculations: [] };
  assert.equal(
    executeTool(
      "set_consultation_stage",
      { stage: 2, quote: "상담을 시작하겠습니다.", messageIndex: 0 },
      ctx,
    ).stage,
    2,
  );
  assert.throws(() =>
    executeTool(
      "set_consultation_stage",
      { stage: 4, quote: "목표는 은퇴", messageIndex: 0 },
      ctx,
    ),
  );
});
test("목표·은퇴 계산 도구가 확인한 고객정보와 시나리오를 사용", () => {
  const text =
    "현재 60세, 은퇴 60세, 종료 62세, 은퇴생활비 200만원, 은퇴자산 1000만원, 적립액 0원, 기타소득 0원, 월소득 0원, 월생활비 200만원, 월상환 0원, 연비정기 0원, 연금 없음, 수익률 0%, 물가 0%, 목표 120만원, 현재자금 0원, 기간 12개월입니다.";
  const messages = [{ role: "user", content: text }],
    profile = emptyProfile();
  const values = {
    currentAge: 60,
    retirementAge: 60,
    endAge: 62,
    monthlyExpenseToday: 2000000,
    retirementAssets: 10000000,
    monthlyRetirementSaving: 0,
    otherMonthlyIncome: 0,
    monthlyIncome: 0,
    monthlyLivingExpenses: 2000000,
    monthlyDebtPayments: 0,
    annualIrregularExpenses: 0,
    pensionStatus: "없음",
    "assumptions.base.beforeReturn": 0,
    "assumptions.base.afterReturn": 0,
    "assumptions.base.inflation": 0,
    "assumptions.base.annualRate": 0,
    "goals.home.targetAmount": 1200000,
    "goals.home.currentAmount": 0,
    "goals.home.months": 12,
  };
  updateProfile(
    profile,
    Object.entries(values).map(([path, value]) => ({
      path,
      value,
      quote: text,
      messageIndex: 0,
    })),
    messages,
  );
  const ctx = { profile, messages, calculations: [] };
  const goal = executeTool(
    "calculate_goal_funding",
    {
      operation: "monthlySaving",
      bindings: {
        months: "goals.home.months",
        annualRate: "assumptions.base.annualRate",
        targetAmount: "goals.home.targetAmount",
        currentAmount: "goals.home.currentAmount",
      },
    },
    ctx,
  );
  assert.equal(goal.result.value, 100000);
  assert.equal(goal.inputs.currentAmount, 0);
  const retire = executeTool(
    "calculate_retirement_funding",
    { scenarioIds: ["base"] },
    ctx,
  );
  assert.equal(retire.result.scenarios[0].requiredAtRetirement, 48000000);
  assert.equal(retire.result.scenarios[0].shortage, 38000000);
});

test("년 단위 목표기간은 정확히 개월로 환산하되 임의 기간은 거절", async () => {
 const {numberInQuote}=await import('../AI/고객정보/고객정보.mjs');
 assert.equal(numberInQuote(60,'months','5년 후'),true);
 assert.equal(numberInQuote(61,'months','5년 후'),false);
});
