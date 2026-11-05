import type { MarketDataset, SimulationInput, SimulationResult, YearPercentiles } from '../types';

export const DEFAULT_RUNS = 10_000;

export interface RunOptions {
  runs?: number;
  /** 지정하면 같은 입력에서 같은 결과를 재현한다 */
  seed?: number;
}

export function validateInput(i: SimulationInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(i.currentAge) || i.currentAge < 0 || i.currentAge > 120) errors.push('현재 나이는 0~120 사이로 입력하세요.');
  if (!Number.isFinite(i.initialAssets) || i.initialAssets < 0) errors.push('초기 자산은 0 이상이어야 합니다.');
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > 80) errors.push('투자 기간은 1~80년 사이의 정수로 입력하세요.');
  if (!Number.isFinite(i.annualAmount) || i.annualAmount < 0) errors.push('연간 금액은 0 이상이어야 합니다.');
  if (Math.abs(i.stockWeight + i.bondWeight - 100) > 1e-9) errors.push('주식 비중과 채권 비중의 합은 100%여야 합니다.');
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

/**
 * 역사적 연간 수익률을 복원추출(부트스트랩)하는 Monte Carlo 시뮬레이션.
 * - 매년 초에 적립(+)/인출(-)을 반영한 뒤 그 해의 수익률을 적용한다.
 * - 매년 한 해(인덱스 하나)를 뽑아 그 해의 (stock, bond) 쌍을 함께 사용한다.
 *   주식과 채권을 따로 뽑지 않으므로 같은 해의 주식·채권 관계가 보존된다.
 * - 포트폴리오는 매년 목표 비중으로 리밸런싱한다고 가정한다.
 * - 수수료, 세금, 인플레이션 조정은 dataset의 수익률 정의에 따른다.
 */
export function runSimulation(
  input: SimulationInput,
  dataset: MarketDataset,
  options: RunOptions = {},
): SimulationResult {
  const runs = options.runs ?? DEFAULT_RUNS;
  const n = dataset.returns.length;
  if (n === 0) throw new Error('시장 데이터가 비어 있습니다.');

  const ws = input.stockWeight / 100;
  const wb = input.bondWeight / 100;
  const portfolioReturns = dataset.returns.map((r) => ws * r.stock + wb * r.bond);
  const rand = createRng(options.seed ?? (Date.now() & 0xffffffff));

  const { years } = input;
  const stride = years + 1;
  const flow = input.mode === 'accumulate' ? input.annualAmount : -input.annualAmount;
  const paths = new Float64Array(runs * stride);
  const sustained = new Float64Array(runs);
  let depletedCount = 0;

  for (let r = 0; r < runs; r++) {
    const base = r * stride;
    let v = input.initialAssets;
    let depleted = false;
    let sustainedYears = years;
    paths[base] = v;
    for (let y = 1; y <= years; y++) {
      if (!depleted) {
        v += flow;
        if (v <= 0) {
          v = 0;
          depleted = true;
          sustainedYears = y - 1;
        } else {
          v *= 1 + portfolioReturns[Math.floor(rand() * n)];
          if (v <= 0) {
            v = 0;
            depleted = true;
            sustainedYears = y;
          }
        }
      }
      paths[base + y] = v;
    }
    if (depleted) depletedCount++;
    sustained[r] = sustainedYears;
  }

  const series: YearPercentiles[] = [];
  const column = new Float64Array(runs);
  for (let y = 0; y <= years; y++) {
    for (let r = 0; r < runs; r++) column[r] = paths[r * stride + y];
    column.sort();
    series.push({ year: y, age: input.currentAge + y, p10: pick(column, 0.1), p50: pick(column, 0.5), p90: pick(column, 0.9) });
  }

  const last = series[years];
  const result: SimulationResult = {
    input,
    runs,
    datasetName: dataset.name,
    observations: n,
    returnType: dataset.returnType,
    initialAssets: input.initialAssets,
    totalFlow: input.annualAmount * years,
    final: { p10: last.p10, p50: last.p50, p90: last.p90 },
    series,
  };

  if (input.mode === 'withdraw') {
    sustained.sort();
    result.depletion = {
      probability: depletedCount / runs,
      sustainedYearsP50: pick(sustained, 0.5),
      sustainedYearsP10: pick(sustained, 0.1),
    };
  }
  return result;
}
