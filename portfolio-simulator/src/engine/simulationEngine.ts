import type { MarketDataset, Percentiles, SimulationInput, SimulationResult, Strategy, StrategyResult, YearPercentiles } from '../types';

export const DEFAULT_RUNS = 10_000;
export const MONTHS_PER_YEAR = 12;
export const DEFAULT_INFLATION_RATE = 2;

/** 비교 기본 전략. 같은 시장 시나리오에 함께 적용된다. */
export const PRESET_STRATEGIES: readonly Strategy[] = [
  { id: 'A', label: '전략 A', stockWeight: 20, bondWeight: 80 },
  { id: 'B', label: '전략 B', stockWeight: 40, bondWeight: 60 },
  { id: 'C', label: '전략 C', stockWeight: 60, bondWeight: 40 },
];

export interface RunOptions {
  runs?: number;
  /** 지정하면 같은 입력에서 같은 결과를 재현한다 */
  seed?: number;
}

export function validateInput(i: SimulationInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(i.currentAge) || i.currentAge < 0 || i.currentAge > 120) errors.push('현재 나이는 0~120 사이로 입력하세요.');
  if (!Number.isFinite(i.initialAssets) || i.initialAssets < 0) errors.push('초기 투자금은 0 이상이어야 합니다.');
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > 80) errors.push('투자 기간은 1~80년 사이의 정수로 입력하세요.');
  if (!Number.isFinite(i.monthlyAmount) || i.monthlyAmount < 0) errors.push('월 적립액은 0 이상이어야 합니다.');
  if (Number.isFinite(i.initialAssets) && Number.isFinite(i.monthlyAmount) && i.initialAssets === 0 && i.monthlyAmount === 0) {
    errors.push('초기 투자금과 월 적립액이 모두 0이면 계산할 수 없습니다.');
  }
  if (!Number.isFinite(i.inflationRate) || i.inflationRate < 0 || i.inflationRate > 30) errors.push('물가상승률은 0~30% 사이로 입력하세요.');
  if (!Number.isFinite(i.stockWeight) || !Number.isFinite(i.bondWeight) || i.stockWeight < 0 || i.bondWeight < 0) {
    errors.push('주식·채권 비중은 0 이상의 숫자여야 합니다.');
  } else if (Math.abs(i.stockWeight + i.bondWeight - 100) > 1e-9) {
    errors.push('주식 비중과 채권 비중의 합은 100%여야 합니다.');
  }
  if (i.seed !== null && (!Number.isInteger(i.seed) || i.seed < 0 || i.seed > 0xffffffff)) errors.push('난수 시드는 0~4294967295 사이의 정수이거나 비워 두세요.');
  return errors;
}

/** 재현 가능한 난수 생성기 (mulberry32) */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(sorted: Float64Array, p: number): number {
  return sorted[Math.round(p * (sorted.length - 1))];
}

/** 연 수익률 → 월 복리 수익률. 12개월 복리로 곱하면 정확히 연 수익률이 된다. */
export function toMonthlyReturn(annualReturn: number): number {
  return (1 + annualReturn) ** (1 / MONTHS_PER_YEAR) - 1;
}

/** 사용자 지정 비중이 기본 전략(A/B/C)과 같은지 여부 (표시용) */
export function matchingPreset(stockWeight: number, bondWeight: number): Strategy | undefined {
  return PRESET_STRATEGIES.find((s) => s.stockWeight === stockWeight && s.bondWeight === bondWeight);
}

/**
 * 역사적 연간 수익률을 복원추출(부트스트랩)하는 월 적립식 Monte Carlo 시뮬레이션.
 *
 * 시장 시나리오
 * - 매 가상 연도마다 역사적 연도 하나를 뽑아 그 해의 (stock, bond) 쌍을 함께 사용한다.
 *   주식과 채권을 따로 뽑지 않으므로 같은 해의 주식·채권 관계가 보존된다.
 * - 추출된 경로(연도 인덱스)는 모든 전략이 공유한다. 전략마다 다시 뽑지 않으므로
 *   전략 간 차이는 비중 때문일 뿐 운 때문이 아니다.
 *
 * 월 단위 계산 (모든 전략 공통)
 * - 한 해의 주식·채권 연 수익률을 각각 월 복리 수익률 (1+r)^(1/12)-1 로 바꿔 12개월에 걸쳐 적용한다.
 * - 연 중에는 주식과 채권이 각자 굴러간다(월별 리밸런싱 없음). 그래서 12개월 뒤 각 자산의 성장률은
 *   정확히 그 해의 연 수익률이다. 포트폴리오 연 수익률을 12로 나누지 않는다.
 * - 매월 말에 수익을 먼저 반영한 뒤 월 적립금을 목표 비중대로 주식·채권에 나눠 넣는다.
 * - 연 1회, 12월 말 납입 직후에 목표 비중으로 리밸런싱한다.
 *   (적립이 없다면 연말 자산은 V × (ws·(1+주식) + wb·(1+채권)) 로 연 1회 리밸런싱 포트폴리오와 일치한다.)
 *
 * 원금과 물가
 * - 총 납입 원금 = 초기 투자금 + 월 적립금 × 12 × 투자기간. 월 적립액은 물가에 연동하지 않는 고정 명목 금액이다.
 * - 실질 자산 = 명목 자산 ÷ (1+물가상승률)^경과연수 (현재 구매력 기준).
 * - 실질 환산 납입 원금 = 초기 투자금 + Σ 월 적립금 ÷ (1+물가상승률)^(납입월/12).
 *   납입 시점이 다른 돈을 모두 현재 구매력으로 맞춰 실질 자산과 비교한다.
 * - 원금손실: 만기 자산이 납입 원금보다 적은 경로. 명목은 명목 자산 vs 총 납입 원금,
 *   실질은 실질 자산 vs 실질 환산 납입 원금으로 따로 센다.
 * - 수수료, 세금은 반영하지 않는다.
 */
export function runSimulation(
  input: SimulationInput,
  dataset: MarketDataset,
  options: RunOptions = {},
): SimulationResult {
  const runs = options.runs ?? DEFAULT_RUNS;
  const n = dataset.returns.length;
  if (n === 0) throw new Error('시장 데이터가 비어 있습니다.');
  if (dataset.returnType !== 'nominal') {
    throw new Error('이 시뮬레이터는 명목 수익률 데이터가 필요합니다. 실질 수익률 데이터에는 물가상승률을 다시 적용할 수 없습니다.');
  }

  const { years, initialAssets, monthlyAmount } = input;
  const seed = (options.seed ?? input.seed ?? Date.now() & 0xffffffff) >>> 0;
  const rand = createRng(seed);

  // 역사적 연도별 월 성장 배수 (1 + 월 수익률)
  const stockGrowth = new Float64Array(n);
  const bondGrowth = new Float64Array(n);
  dataset.returns.forEach((r, k) => {
    if (!(1 + r.stock > 0) || !(1 + r.bond > 0)) throw new Error(`${r.year}년 수익률이 -100% 이하여서 월 수익률로 바꿀 수 없습니다.`);
    stockGrowth[k] = 1 + toMonthlyReturn(r.stock);
    bondGrowth[k] = 1 + toMonthlyReturn(r.bond);
  });

  // 공통 시장 시나리오: 경로 r의 y번째 해에 쓸 역사적 연도 인덱스
  const draws = new Uint32Array(runs * years);
  for (let i = 0; i < draws.length; i++) draws[i] = Math.floor(rand() * n);

  // 원금·물가 기준선
  const inflation = input.inflationRate / 100;
  const deflator: number[] = [];
  const principalSeries: number[] = [];
  const realPrincipalSeries: number[] = [];
  let discountSum = 0;
  for (let y = 0; y <= years; y++) {
    if (y > 0) {
      for (let m = (y - 1) * MONTHS_PER_YEAR + 1; m <= y * MONTHS_PER_YEAR; m++) discountSum += (1 + inflation) ** (-m / MONTHS_PER_YEAR);
    }
    deflator.push((1 + inflation) ** y);
    principalSeries.push(initialAssets + monthlyAmount * MONTHS_PER_YEAR * y);
    realPrincipalSeries.push(initialAssets + monthlyAmount * discountSum);
  }
  const totalContributed = principalSeries[years];
  const realTotalContributed = realPrincipalSeries[years];
  const inflationFactor = deflator[years];

  const strategies: Strategy[] = [
    ...PRESET_STRATEGIES,
    { id: 'custom', label: '사용자 지정', stockWeight: input.stockWeight, bondWeight: input.bondWeight },
  ];

  const stride = years + 1;
  const paths = new Float64Array(runs * stride);
  const column = new Float64Array(runs);

  const strategyResults: StrategyResult[] = strategies.map((st) => {
    const ws = st.stockWeight / 100;
    const wb = st.bondWeight / 100;
    const contribStock = monthlyAmount * ws;
    const contribBond = monthlyAmount * wb;
    let lossCount = 0;
    let realLossCount = 0;

    for (let r = 0; r < runs; r++) {
      const base = r * stride;
      let stock = initialAssets * ws;
      let bond = initialAssets * wb;
      paths[base] = initialAssets;
      for (let y = 1; y <= years; y++) {
        const k = draws[r * years + y - 1];
        const gs = stockGrowth[k];
        const gb = bondGrowth[k];
        for (let m = 0; m < MONTHS_PER_YEAR; m++) {
          stock = stock * gs + contribStock; // 월 수익 반영 → 월말 납입
          bond = bond * gb + contribBond;
        }
        const total = stock + bond;
        stock = total * ws; // 연 1회 리밸런싱
        bond = total * wb;
        paths[base + y] = total;
      }
      const finalValue = paths[base + years];
      if (finalValue < totalContributed) lossCount++;
      if (finalValue / inflationFactor < realTotalContributed) realLossCount++;
    }

    const series: YearPercentiles[] = [];
    const realSeries: YearPercentiles[] = [];
    for (let y = 0; y <= years; y++) {
      for (let r = 0; r < runs; r++) column[r] = paths[r * stride + y];
      column.sort();
      const p10 = pick(column, 0.1);
      const p50 = pick(column, 0.5);
      const p90 = pick(column, 0.9);
      const age = input.currentAge + y;
      const d = deflator[y];
      series.push({ year: y, age, p10, p50, p90 });
      realSeries.push({ year: y, age, p10: p10 / d, p50: p50 / d, p90: p90 / d });
    }
    const pct = (s: YearPercentiles): Percentiles => ({ p10: s.p10, p50: s.p50, p90: s.p90 });
    return {
      ...st,
      final: pct(series[years]),
      finalReal: pct(realSeries[years]),
      lossProbability: lossCount / runs,
      realLossProbability: realLossCount / runs,
      series,
      realSeries,
    };
  });

  return {
    input,
    runs,
    seed,
    datasetName: dataset.name,
    observations: n,
    returnType: dataset.returnType,
    initialAssets,
    totalContributed,
    principalSeries,
    realPrincipalSeries,
    realTotalContributed,
    inflationFactor,
    strategies: strategyResults,
  };
}
