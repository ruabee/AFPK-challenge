/**
 * 한 해의 수익률. 반드시 소수 표기입니다 (10% → 0.10, -35% → -0.35, 2.5% → 0.025).
 * 같은 해의 주식·채권 값은 한 행에 함께 넣으며, 시뮬레이션에서도 같은 해끼리 함께 뽑힙니다.
 */
export interface HistoricalReturn {
  /** 수익률이 속한 연도 (정수, 중복 불가). 계산에는 쓰이지 않고 검증·표시용 */
  year: number;
  /** 주식 연간 총수익률 (배당 재투자 포함 권장), 소수 */
  stock: number;
  /** 채권 연간 총수익률 (이자 재투자 포함 권장), 소수 */
  bond: number;
}

export interface MarketDataset {
  name: string;
  source: string;
  /** 데이터가 명목 수익률인지 실질 수익률인지. 결과 금액의 해석 기준이 된다. */
  returnType: 'nominal' | 'real';
  /** 각 수익률 계열이 어떤 지수·자산인지 (표시용, 계산에는 쓰이지 않음) */
  series: { stock: string; bond: string };
  /** 이 데이터셋이 채워져야 하는 기간. 비어 있는 연도를 경고하는 데 쓰이며 임의 값으로 채우지 않는다 */
  expectedPeriod?: { start: number; end: number };
  returns: HistoricalReturn[];
}

/** 금액 단위는 만원, 비중과 물가상승률은 % */
export interface SimulationInput {
  currentAge: number;
  /** 초기 투자금 (0 가능) */
  initialAssets: number;
  years: number;
  /** 월 적립액. 매월 말 납입하며 물가에 연동하지 않는 고정 명목 금액 */
  monthlyAmount: number;
  /** 연 물가상승률 (%). 명목 자산을 현재 구매력 기준 실질 자산으로 바꿀 때 사용 */
  inflationRate: number;
  /** 사용자 지정 전략의 주식 비중 (0~100) */
  stockWeight: number;
  /** 사용자 지정 전략의 채권 비중 (0~100) */
  bondWeight: number;
  /** 난수 시드. null이면 자동 생성하며, 실제 사용된 값은 결과의 seed에 기록된다 */
  seed: number | null;
}

export type StrategyId = 'A' | 'B' | 'C' | 'custom';

export interface Strategy {
  id: StrategyId;
  label: string;
  /** % (0~100) */
  stockWeight: number;
  bondWeight: number;
}

export interface YearPercentiles {
  /** 투자 경과 연수 (0 = 투자 시작 시점) */
  year: number;
  age: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface Percentiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface StrategyResult extends Strategy {
  /** 만기 명목 자산 (series 마지막 값과 동일) */
  final: Percentiles;
  /** 만기 실질 자산 (현재 구매력 기준, realSeries 마지막 값과 동일) */
  finalReal: Percentiles;
  /** 만기 명목 최종 자산 < 총 납입 원금 인 경로의 비율 (0~1) */
  lossProbability: number;
  /** 만기 실질 최종 자산 < 실질 환산 납입 원금 인 경로의 비율 (0~1) */
  realLossProbability: number;
  /** 연도별 명목 자산 분위수 */
  series: YearPercentiles[];
  /** 연도별 실질 자산 분위수 (명목 ÷ (1+물가상승률)^경과연수) */
  realSeries: YearPercentiles[];
}

export interface SimulationResult {
  input: SimulationInput;
  runs: number;
  /** 실제로 사용된 난수 시드. 같은 입력과 시드는 같은 결과를 재현한다 */
  seed: number;
  datasetName: string;
  /** 실제로 사용된 역사적 연도 수 */
  observations: number;
  returnType: 'nominal' | 'real';
  initialAssets: number;
  /** 총 납입 원금 = 초기 투자금 + 월 적립금 × 12 × 투자기간 */
  totalContributed: number;
  /** 연도별(0..years) 누적 납입 원금 (명목) */
  principalSeries: number[];
  /** 연도별 누적 납입 원금을 현재 구매력으로 환산한 값 */
  realPrincipalSeries: number[];
  /** 만기 실질 환산 납입 원금 (= realPrincipalSeries 마지막 값) */
  realTotalContributed: number;
  /** 만기까지 누적 물가 배수 (1+물가상승률)^기간 */
  inflationFactor: number;
  /** 같은 시장 시나리오가 적용된 전략들 (A, B, C, 사용자 지정 순) */
  strategies: StrategyResult[];
}
