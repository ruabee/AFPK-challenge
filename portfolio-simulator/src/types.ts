export type Mode = 'accumulate' | 'withdraw';

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

/** 금액 단위는 만원, 비중은 % (0~100) */
export interface SimulationInput {
  currentAge: number;
  initialAssets: number;
  years: number;
  annualAmount: number;
  mode: Mode;
  stockWeight: number;
  bondWeight: number;
}

export interface YearPercentiles {
  year: number;
  age: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface DepletionStats {
  /** 투자 기간 안에 자산이 고갈된 시나리오 비율 (0~1) */
  probability: number;
  /** 자산이 유지된 연수의 중앙값 (기간 전체 유지 시 투자 기간과 같음) */
  sustainedYearsP50: number;
  /** 하위 10% 시나리오 기준 유지 연수 */
  sustainedYearsP10: number;
}

export interface SimulationResult {
  input: SimulationInput;
  runs: number;
  datasetName: string;
  /** 실제로 사용된 역사적 연도 수 */
  observations: number;
  returnType: 'nominal' | 'real';
  initialAssets: number;
  /** 적립 모드: 총 적립금, 인출 모드: 총 인출 계획액 */
  totalFlow: number;
  final: { p10: number; p50: number; p90: number };
  series: YearPercentiles[];
  depletion?: DepletionStats;
}
