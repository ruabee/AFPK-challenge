import test from "node:test";
import assert from "node:assert/strict";
import {
  financialStatus,
  goalFunding,
  retirementFunding,
} from "../재무설계_계산/생성/재무계산.js";
const status = {
  assets: [10000000, 20000000],
  debts: [5000000],
  monthlyIncome: 3000000,
  monthlyLivingExpenses: 1500000,
  monthlyDebtPayments: 300000,
  annualIrregularExpenses: 2400000,
  monthlySavings: 500000,
  emergencyFunds: 6000000,
  monthlyEssentialExpenses: 2000000,
};
test("순자산·현금흐름·비율의 정의와 금액 일치", () => {
  const { metrics: m } = financialStatus(status);
  assert.equal(m.totalAssets, 30000000);
  assert.equal(m.netWorth, 25000000);
  assert.equal(m.monthlyExpenses, 2000000);
  assert.equal(m.monthlySurplus, 1000000);
  assert.equal(m.afterSavings, 500000);
  assert.equal(m.emergencyMonths, 3);
  assert.ok(Math.abs(m.savingsRate - 100 / 6) < 1e-9);
  assert.ok(Math.abs(m.debtRatio - 100 / 6) < 1e-9);
});
test("누락값을 0으로 추정하지 않음·분모 0·음수 거절", () => {
  assert.equal(financialStatus({}).metrics.netWorth, null);
  assert.equal(
    financialStatus({ ...status, monthlyIncome: 0, assets: [] }).metrics
      .savingsRate,
    null,
  );
  assert.equal(
    financialStatus({ ...status, assets: [] }).metrics.debtRatio,
    null,
  );
  assert.throws(() => financialStatus({ ...status, assets: [-1] }));
  assert.throws(() => financialStatus({ ...status, monthlyIncome: NaN }));
});
test("PV FV 독립 공식 및 연 실효율 환산", () => {
  assert.equal(
    goalFunding({
      operation: "fv",
      amount: 1000000,
      annualRate: 10,
      months: 12,
    }).value,
    1100000,
  );
  assert.equal(
    goalFunding({
      operation: "pv",
      amount: 1100000,
      annualRate: 10,
      months: 12,
    }).value,
    1000000,
  );
  assert.equal(
    goalFunding({
      operation: "inflation",
      amount: 1000000,
      annualRate: 3,
      months: 24,
    }).value,
    1060900,
  );
  assert.equal(
    goalFunding({
      operation: "fv",
      amount: 1000000,
      annualRate: -10,
      months: 12,
    }).value,
    900000,
  );
});
test("필요 저축액 영금리·목표 초과·기간 0·누락", () => {
  assert.equal(
    goalFunding({
      operation: "monthlySaving",
      targetAmount: 1200000,
      currentAmount: 0,
      annualRate: 0,
      months: 12,
    }).value,
    100000,
  );
  assert.equal(
    goalFunding({
      operation: "monthlySaving",
      targetAmount: 100,
      currentAmount: 200,
      annualRate: 0,
      months: 0,
    }).value,
    0,
  );
  assert.throws(() =>
    goalFunding({
      operation: "monthlySaving",
      targetAmount: 100,
      currentAmount: 0,
      annualRate: 0,
      months: 0,
    }),
  );
  assert.throws(() =>
    goalFunding({ operation: "fv", amount: 100, months: 12 }),
  );
  assert.throws(() =>
    goalFunding({ operation: "fv", amount: 100, months: 12.2, annualRate: 0 }),
  );
});
const retirement = {
  currentAge: 60,
  retirementAge: 60,
  endAge: 62,
  monthlyExpenseToday: 2000000,
  retirementAssets: 10000000,
  monthlySaving: 0,
  otherMonthlyIncome: 0,
  currentMonthlyIncome: 0,
  currentMonthlyExpenses: 2000000,
  pensions: [
    { monthlyAmount: 1000000, startAge: 61, endAge: 62, annualGrowth: 0 },
  ],
  scenarios: [{ beforeReturn: 0, afterReturn: 0, inflation: 0 }],
};
test("연금 개시/종료 경계와 은퇴 필요자금·부족액", () => {
  const s = retirementFunding(retirement).scenarios[0];
  assert.equal(s.requiredAtRetirement, 36000000);
  assert.equal(s.shortage, 26000000);
  assert.equal(s.annualCashflows[0].pension, 0);
  assert.equal(s.annualCashflows[1].pension, 12000000);
  const ended = retirementFunding({ ...retirement, endAge: 63 }).scenarios[0];
  assert.equal(ended.annualCashflows[2].pension, 0);
});
test("명시된 복수 시나리오와 은퇴 전 적립·초과 연금", () => {
  const r = retirementFunding({
    ...retirement,
    currentAge: 59,
    monthlySaving: 100000,
    scenarios: [
      { beforeReturn: 0, afterReturn: 0, inflation: 0 },
      { beforeReturn: 5, afterReturn: 2, inflation: 3 },
    ],
  });
  assert.equal(r.scenarios.length, 2);
  assert.equal(r.scenarios[0].retirementAssets, 11200000);
  assert.notEqual(
    r.scenarios[0].requiredAtRetirement,
    r.scenarios[1].requiredAtRetirement,
  );
  assert.equal(
    retirementFunding({
      ...retirement,
      pensions: [
        { monthlyAmount: 3000000, startAge: 60, endAge: 62, annualGrowth: 0 },
      ],
    }).scenarios[0].requiredAtRetirement,
    0,
  );
});
test("은퇴 연금 누락·나이 역전·가정 누락을 거절", () => {
  assert.throws(() =>
    retirementFunding({ ...retirement, pensions: undefined }),
  );
  assert.throws(() => retirementFunding({ ...retirement, currentAge: 63 }));
  assert.throws(() =>
    retirementFunding({
      ...retirement,
      scenarios: [{ beforeReturn: 0, afterReturn: 0 }],
    }),
  );
});
