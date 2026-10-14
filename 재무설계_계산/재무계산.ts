/** 모든 금액은 원, 연율은 %(5 = 5%), 기간은 개월. 투자 시뮬레이터와 독립된 상담용 계산입니다. */
export type Values = Record<string, unknown>;
export class CalculationError extends Error {}
function number(v: unknown, name: string, min = 0, max = 1e15): number {
  if (v === null || v === undefined)
    throw new CalculationError(
      `${name}: 값이 필요합니다. 0으로 가정하지 않습니다.`,
    );
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new CalculationError(
      `${name}: ${min}~${max} 범위의 숫자가 필요합니다.`,
    );
  return v;
}
function months(v: unknown, name = "months"): number {
  const n = number(v, name, 0, 1200);
  if (!Number.isInteger(n))
    throw new CalculationError(`${name}: 정수 개월이 필요합니다.`);
  return n;
}
function rate(v: unknown, name = "annualRate"): number {
  return Math.pow(1 + number(v, name, -99, 100) / 100, 1 / 12) - 1;
}
function money(v: number): number {
  if (!Number.isFinite(v) || Math.abs(v) > 1e18)
    throw new CalculationError("계산 범위를 초과했습니다.");
  return Math.round(v);
}
function sum(v: unknown, name: string): number {
  if (!Array.isArray(v) || v.length > 200)
    throw new CalculationError(`${name}: 금액 배열이 필요합니다.`);
  return v.reduce((a: number, b: unknown) => a + number(b, name), 0);
}
const base = {
  unit: "KRW",
  rateConvention: "연 실효율을 월 실효율로 환산",
  timing: "월말",
  rounding: "최종 금액을 원 단위 반올림",
  excludes: ["세금", "수수료", "확률적 시장변동"],
};
export function financialStatus(input: Values) {
  const required = [
    "assets",
    "debts",
    "monthlyIncome",
    "monthlyLivingExpenses",
    "monthlyDebtPayments",
    "annualIrregularExpenses",
    "monthlySavings",
    "emergencyFunds",
    "monthlyEssentialExpenses",
  ];
  const missing = required.filter(
    (k) => input[k] === null || input[k] === undefined,
  );
  const n = (k: string) => (missing.includes(k) ? null : number(input[k], k));
  const assets = missing.includes("assets")
    ? null
    : sum(input.assets, "assets");
  const debts = missing.includes("debts") ? null : sum(input.debts, "debts");
  const income = n("monthlyIncome"),
    living = n("monthlyLivingExpenses"),
    debt = n("monthlyDebtPayments"),
    annual = n("annualIrregularExpenses"),
    savings = n("monthlySavings"),
    emergency = n("emergencyFunds"),
    essential = n("monthlyEssentialExpenses");
  const expenses =
    living === null || debt === null || annual === null
      ? null
      : living + debt + annual / 12;
  const surplus =
    income === null || expenses === null ? null : income - expenses;
  return {
    ...base,
    missing,
    metrics: {
      totalAssets: assets === null ? null : money(assets),
      totalDebts: debts === null ? null : money(debts),
      netWorth:
        assets === null || debts === null ? null : money(assets - debts),
      monthlyIncome: income,
      monthlyLivingExpenses: living,
      monthlyDebtPayments: debt,
      monthlyIrregularExpenses: annual === null ? null : money(annual / 12),
      monthlyExpenses: expenses === null ? null : money(expenses),
      monthlySurplus: surplus === null ? null : money(surplus),
      afterSavings:
        surplus === null || savings === null ? null : money(surplus - savings),
      savingsRate:
        income === null || income === 0 || savings === null
          ? null
          : (savings / income) * 100,
      debtRatio:
        assets === null || assets === 0 || debts === null
          ? null
          : (debts / assets) * 100,
      emergencyMonths:
        essential === null || essential === 0 || emergency === null
          ? null
          : emergency / essential,
    },
    definitions: {
      savingsRate: "명시한 월 저축액 / 월 실수령액 × 100",
      debtRatio: "총부채 / 총자산 × 100 (DSR·DTI 아님)",
      monthlySurplus:
        "저축 차감 전 잉여현금흐름 = 소득 − 지출; 저축을 여기에서 차감하지 않음",
      afterSavings: "저축 후 잔액 = 잉여현금흐름 − 월 저축액",
      monthlyExpenses: "생활비 + 대출상환액 + 연 비정기지출/12; 저축은 별도",
      emergencyMonths: "비상자금 / 대출 필수상환을 포함한 월 필수지출",
    },
    warnings: [
      ...(missing.length
        ? ["누락 항목과 분모가 0인 비율은 null로 표시합니다."]
        : []),
      ...(surplus !== null && savings !== null && savings > surplus
        ? ["월 저축액이 잉여현금흐름을 초과합니다."]
        : []),
    ],
  };
}
export function goalFunding(input: Values) {
  const operation = input.operation;
  const n = months(input.months),
    r = rate(input.annualRate),
    growth = Math.pow(1 + r, n);
  let value: number;
  if (operation === "pv") value = number(input.amount, "amount") / growth;
  else if (operation === "fv" || operation === "inflation")
    value = number(input.amount, "amount") * growth;
  else if (operation === "monthlySaving") {
    const target = number(input.targetAmount, "targetAmount"),
      current = number(input.currentAmount, "currentAmount");
    if (n === 0) {
      if (current < target)
        throw new CalculationError(
          "남은 기간이 0개월이고 목표자금이 부족합니다.",
        );
      value = 0;
    } else
      value = Math.max(
        0,
        (target - current * growth) /
          (Math.abs(r) < 1e-12 ? n : (growth - 1) / r),
      );
  } else
    throw new CalculationError(
      "operation: pv, fv, inflation, monthlySaving 중 선택해주세요.",
    );
  return {
    ...base,
    operation,
    months: n,
    annualRate: input.annualRate,
    value: money(value),
    formula:
      operation === "pv"
        ? "PV = FV / (1+r)^n"
        : operation === "monthlySaving"
          ? "PMT = max(0, (목표 − 현재자금×(1+r)^n) / (((1+r)^n−1)/r)); r=0이면 n으로 나눔"
          : "FV = PV × (1+r)^n",
    interpretation:
      operation === "inflation"
        ? "annualRate는 물가상승률; amount는 현재 구매력 기준 금액"
        : "수익률은 명시적으로 제공된 가정이며 보장되지 않음",
  };
}
type Pension = {
  monthlyAmount: number;
  startAge: number;
  endAge: number;
  annualGrowth: number;
};
export function retirementFunding(input: Values) {
  const age = months(input.currentAge, "currentAge"),
    retire = months(input.retirementAge, "retirementAge"),
    end = months(input.endAge, "endAge");
  if (age > retire || retire >= end || end > 120)
    throw new CalculationError(
      "현재나이 ≤ 은퇴나이 < 종료나이 ≤ 120이어야 합니다.",
    );
  const cost = number(input.monthlyExpenseToday, "monthlyExpenseToday"),
    assets = number(input.retirementAssets, "retirementAssets"),
    saving = number(input.monthlySaving, "monthlySaving"),
    other = number(input.otherMonthlyIncome, "otherMonthlyIncome");
  const beforeIncome = number(
      input.currentMonthlyIncome,
      "currentMonthlyIncome",
    ),
    beforeExpenses = number(
      input.currentMonthlyExpenses,
      "currentMonthlyExpenses",
    );
  if (!Array.isArray(input.pensions) || input.pensions.length > 20)
    throw new CalculationError(
      "pensions: 예상 연금액·개시·종료·증가율 배열이 필요합니다. 연금 없음은 []로 명시하세요.",
    );
  const pensions = input.pensions.map((p: Pension) => {
    if (!p || typeof p !== "object")
      throw new CalculationError("연금 항목이 올바르지 않습니다.");
    const start = months(p.startAge, "startAge"),
      finish = months(p.endAge, "endAge");
    if (start >= finish || finish > 120)
      throw new CalculationError(
        "연금 개시나이 < 종료나이 ≤ 120이어야 합니다.",
      );
    return {
      monthlyAmount: number(p.monthlyAmount, "monthlyAmount"),
      startAge: start,
      endAge: finish,
      annualGrowth: number(p.annualGrowth, "annualGrowth", -99, 100),
    };
  });
  if (
    !Array.isArray(input.scenarios) ||
    input.scenarios.length === 0 ||
    input.scenarios.length > 5
  )
    throw new CalculationError(
      "scenarios: 명시된 수익률·물가 가정 1~5개가 필요합니다.",
    );
  const scenarios = input.scenarios.map((s: Values) => {
    if (!s || typeof s !== "object")
      throw new CalculationError("시나리오가 올바르지 않습니다.");
    const beforeRate = rate(s.beforeReturn, "beforeReturn"),
      afterRate = rate(s.afterReturn, "afterReturn"),
      inflation = rate(s.inflation, "inflation");
    const beforeMonths = (retire - age) * 12,
      afterMonths = (end - retire) * 12;
    let projected = assets;
    for (let m = 0; m < beforeMonths; m++)
      projected = projected * (1 + beforeRate) + saving;
    const flows: Array<{
      age: number;
      expense: number;
      pension: number;
      otherIncome: number;
      shortfall: number;
    }> = [];
    for (let m = 0; m < afterMonths; m++) {
      const attainedAge = retire + m / 12;
      const expense = cost * Math.pow(1 + inflation, beforeMonths + m);
      const pension = pensions.reduce(
        (total, p) =>
          total +
          (attainedAge >= p.startAge && attainedAge < p.endAge
            ? p.monthlyAmount *
              Math.pow(
                1 + rate(p.annualGrowth),
                (attainedAge - p.startAge) * 12,
              )
            : 0),
        0,
      );
      flows.push({
        age: attainedAge,
        expense,
        pension,
        otherIncome: other,
        shortfall: expense - pension - other,
      });
    }
    let required = 0;
    for (let i = flows.length - 1; i >= 0; i--)
      required = Math.max(0, (required + flows[i].shortfall) / (1 + afterRate));
    const shortage = Math.max(0, required - projected);
    return {
      assumptions: s,
      retirementAssets: money(projected),
      requiredAtRetirement: money(required),
      shortage: money(shortage),
      firstMonth: Object.fromEntries(
        Object.entries(flows[0]).map(([k, v]) => [
          k,
          k === "age" ? v : money(v),
        ]),
      ),
      annualCashflows: Array.from({ length: end - retire }, (_, i) => {
        const year = flows.slice(i * 12, (i + 1) * 12);
        return {
          age: retire + i,
          expense: money(year.reduce((t, f) => t + f.expense, 0)),
          pension: money(year.reduce((t, f) => t + f.pension, 0)),
          otherIncome: money(other * 12),
          shortfall: money(year.reduce((t, f) => t + f.shortfall, 0)),
        };
      }),
    };
  });
  return {
    ...base,
    beforeRetirement: {
      monthlyIncome: beforeIncome,
      monthlyExpenses: beforeExpenses,
      monthlySaving: saving,
      remaining: money(beforeIncome - beforeExpenses - saving),
    },
    pensions,
    scenarios,
    assumptions: [
      "연금액은 사용자 제공 예상액이며 법정 연금 산식으로 추정하지 않음",
      "연금 월액은 개시 시점 명목금액; 개시나이 포함·종료나이 미포함",
      "생활비는 현재 구매력에서 월별 물가 반영; 기타 은퇴소득은 은퇴 시점 고정 명목액",
      "월말 현금흐름, 은퇴자산 외 자산의 처분·상속·사망확률 미반영",
      "연금이 생활비를 초과하는 달의 잉여는 이후 부족분에 재투입",
      "가정별 결과이며 수익률·물가는 전망 또는 보장이 아님",
    ],
  };
}

/** 단순 차액: 승인한도·세액·장기 필요자금과 구분한다. */
export function fundingGap(input: Values) {
  const requiredAmount = number(input.requiredAmount, "requiredAmount");
  const availableAmount = number(input.availableAmount, "availableAmount");
  return { unit: "KRW", rounding: "원 단위 반올림", excludes: ["세금", "수수료", "물가"], difference: money(requiredAmount - availableAmount), shortage: money(Math.max(0, requiredAmount - availableAmount)), interpretation: "같은 시점·단위의 단순 차액. 대출 승인액이나 장기 필요자금이 아님" };
}
/** 고정금리·월말 원리금균등, 명목 연이율/12. 수수료·거치 없음. */
export function loanPayment(input: Values) {
  const principal = number(input.principal, "principal");
  const term = months(input.months);
  if (!term) throw new CalculationError("상환기간은 1개월 이상이어야 합니다.");
  const annualRate = number(input.annualRate, "annualRate", 0, 100);
  const r = annualRate / 1200;
  const payment = r === 0 ? principal / term : principal * r / (1 - Math.pow(1 + r, -term));
  return { ...base, rateConvention:"명목 연이율/12", monthlyPayment: money(payment), totalPayment: money(payment * term), totalInterest: money(payment * term - principal), interpretation:"고정금리·거치 없는 월말 원리금균등 가정. 은행별 원단위 처리로 차이 가능. 승인한도·DSR 심사 아님" };
}

/** 이자·투자손익을 포함하지 않는 납입 원금 비교. 수익률 예측이 아니다. */
export function savingsPrincipal(input: Values) {
  const currentAmount = number(input.currentAmount, 'currentAmount');
  const monthlySaving = number(input.monthlySaving, 'monthlySaving');
  const term = months(input.months);
  const targetAmount = number(input.targetAmount, 'targetAmount');
  const accumulated = money(currentAmount + monthlySaving * term);
  return { accumulated, shortage: money(Math.max(0, targetAmount - accumulated)),
    requiredMonthlySaving: term ? money(Math.max(0, targetAmount-currentAmount)/term) : null,
    unit:'KRW', basis:'이자·투자손익·물가·취득비용·대출을 제외한 납입 원금 비교이며 수익률 예측이 아닙니다.' };
}
