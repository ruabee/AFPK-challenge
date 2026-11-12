import { useEffect, useMemo, useState } from 'react';
import { ComparisonTable } from './components/ComparisonTable';
import { InputForm } from './components/InputForm';
import { LossPanel } from './components/LossPanel';
import { ProjectionChart } from './components/ProjectionChart';
import { ResultControls, type Basis } from './components/ResultControls';
import { ResultSummary } from './components/ResultSummary';
import { getMarketDataset, MIN_OBSERVATIONS, validateDataset } from './data/marketData';
import { DEFAULT_INFLATION_RATE, DEFAULT_RUNS, validateInput } from './engine/simulationEngine';
import { useSimulation } from './hooks/useSimulation';
import type { SimulationInput, StrategyId } from './types';
import { formatKRW } from './utils/format';

const defaultInput: SimulationInput = {
  currentAge: 35,
  initialAssets: 0,
  years: 20,
  monthlyAmount: 30,
  inflationRate: DEFAULT_INFLATION_RATE,
  stockWeight: 60,
  bondWeight: 40,
  seed: null,
};

export default function App() {
  const dataset = useMemo(() => getMarketDataset(), []);
  const issues = useMemo(() => validateDataset(dataset), [dataset]);
  const dataReady = issues.errors.length === 0;
  const [input, setInput] = useState<SimulationInput>(defaultInput);
  const [strategyId, setStrategyId] = useState<StrategyId>('B');
  const [basis, setBasis] = useState<Basis>('nominal');
  const { result, running, error, run } = useSimulation(dataset);
  const errors = validateInput(input);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      if (event.data?.type === 'askyes-portfolio-busy') {
        window.alert('챗봇 답변이 끝난 뒤 다시 눌러주세요.');
        return;
      }
      if (event.data?.type !== 'askyes-consultation') return;
      const incoming = event.data.input;
      if (!incoming || typeof incoming !== 'object') return;

      const patch: Partial<SimulationInput> = {};
      for (const key of ['currentAge', 'initialAssets', 'years', 'inflationRate'] as const) {
        const value = incoming[key];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) patch[key] = value;
      }
      if (typeof incoming.monthlyAmount === 'number' && Number.isFinite(incoming.monthlyAmount) && incoming.monthlyAmount >= 0) {
        patch.monthlyAmount = incoming.monthlyAmount;
      } else if (typeof incoming.annualAmount === 'number' && Number.isFinite(incoming.annualAmount) && incoming.annualAmount >= 0) {
        // AskYES profile sends annual savings in 만원; the simulator now accepts monthly savings.
        patch.monthlyAmount = incoming.annualAmount / 12;
      }
      setInput((previous) => ({ ...previous, ...patch }));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 물가상승률만 바뀌면 직전 실행 조건과 같은 시드로 바로 다시 계산한다 (명목 결과는 그대로, 실질 결과만 갱신).
  useEffect(() => {
    if (!result || running || !dataReady) return;
    if (result.input.inflationRate === input.inflationRate) return;
    const next: SimulationInput = { ...result.input, inflationRate: input.inflationRate, seed: result.seed };
    if (validateInput(next).length > 0) return;
    const timer = setTimeout(() => run(next), 300);
    return () => clearTimeout(timer);
  }, [input.inflationRate, result, running, dataReady, run]);

  const currentResult = result && JSON.stringify(result.input) === JSON.stringify(input) ? result : null;
  const strategy = currentResult?.strategies.find((s) => s.id === strategyId) ?? currentResult?.strategies[0];

  return (
    <div className="app">
      <header className="top">
        <h1>포트폴리오 시뮬레이터</h1>
        <p>주식·채권 역사적 수익률을 {DEFAULT_RUNS.toLocaleString('ko-KR')}번 다시 뽑아, 매월 적립한 자산이 앞으로 어디까지 갈 수 있는지 범위로 보여줍니다.</p>
      </header>

      {dataset.returns.length === 0 ? (
        <div className="notice" role="status">
          <b>시장 데이터가 아직 연결되지 않았습니다.</b> 실행하려면 <code>src/data/marketData.ts</code>에 연도별 주식·채권 수익률을 {MIN_OBSERVATIONS}개 이상 채워 주세요.
        </div>
      ) : (
        !dataReady && (
          <div className="notice" role="alert">
            <b>시장 데이터를 확인해 주세요.</b>
            <ul>{issues.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )
      )}
      {dataReady && issues.warnings.length > 0 && (
        <div className="notice" role="status">
          <b>데이터 형식을 한 번 더 확인해 주세요.</b>
          <ul>{issues.warnings.slice(0, 5).map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <main className="layout">
        <InputForm value={input} onChange={setInput} onSubmit={() => run(input)} errors={errors} running={running} dataReady={dataReady} />

        <div className="results">
          {error && <div className="notice error" role="alert">{error}</div>}
          {currentResult && strategy ? (
            <>
              <div className="results-head">
                <h2>분석 결과</h2>
                <p>
                  월 {formatKRW(currentResult.input.monthlyAmount)} · {currentResult.input.years}년 적립 · 물가상승률 연 {currentResult.input.inflationRate}%
                </p>
              </div>
              <ResultControls result={currentResult} strategyId={strategy.id} basis={basis} onStrategy={setStrategyId} onBasis={setBasis} />
              <ResultSummary result={currentResult} strategy={strategy} basis={basis} />
              <LossPanel result={currentResult} strategy={strategy} />
              <ProjectionChart result={currentResult} strategy={strategy} basis={basis} />
              <ComparisonTable result={currentResult} basis={basis} selectedId={strategy.id} onSelect={setStrategyId} />
              <section className="panel assumptions" aria-label="주요 가정">
                <h2>주요 가정</h2>
                <ul>
                  <li>데이터: {currentResult.datasetName} ({currentResult.observations}개 연도, 명목 수익률). 시나리오 {currentResult.runs.toLocaleString('ko-KR')}회, 난수 시드 {currentResult.seed} (같은 조건과 시드는 같은 결과를 재현합니다).</li>
                  <li>매 가상 연도마다 같은 역사적 연도의 주식·채권 수익률 쌍을 복원추출하고, 네 전략에 같은 추출 결과를 적용합니다.</li>
                  <li>추출한 연 수익률은 월 수익률 (1+r)^(1/12)−1 로 바꿔 12개월에 걸쳐 적용합니다. 월 수익을 반영한 뒤 월말에 적립금을 목표 비중대로 납입하고, 연 1회(12월 말) 목표 비중으로 리밸런싱합니다.</li>
                  <li>총 납입 원금 = 초기 투자금 + 월 적립액 × 12 × 투자기간. 월 적립액은 물가에 따라 늘리지 않는 고정 금액입니다.</li>
                  <li>실질 자산 = 명목 자산 ÷ (1+물가상승률)^경과연수 로, 현재 구매력 기준입니다. 실질 원금손실은 각 납입금을 현재 구매력으로 환산한 원금과 비교합니다.</li>
                  <li>원금손실은 만기 시점 자산이 납입 원금보다 적은 경우입니다. 수수료, 세금, 환율은 반영하지 않았습니다.</li>
                </ul>
                <p className="fineprint">과거 수익률은 미래 수익을 보장하지 않으며, 이 결과는 투자 권유가 아닙니다.</p>
              </section>
              {window.parent !== window && (
                <button
                  type="button"
                  className="primary chat-result"
                  onClick={() => window.parent.postMessage({
                    type: 'askyes-portfolio',
                    text: `포트폴리오 시뮬레이션 조건을 함께 검토해주세요. 현재 ${input.currentAge}세, 초기 투자금 ${input.initialAssets}만원, 월 적립액 ${input.monthlyAmount}만원, 기간 ${input.years}년, 주식 ${strategy.stockWeight}%, 채권 ${strategy.bondWeight}% 비중입니다. 물가상승률은 연 ${input.inflationRate}%로 설정했습니다. ${strategy.label} 결과는 명목 P10 ${formatKRW(strategy.final.p10)}, P50 ${formatKRW(strategy.final.p50)}, P90 ${formatKRW(strategy.final.p90)}이며, 실질 P50은 ${formatKRW(strategy.finalReal.p50)}입니다. 과거 수익률 기반 시나리오이며 미래 수익 보장이 아닙니다. 이 계획의 위험과 목표 적합성을 검토해주세요.`,
                  }, location.origin)}
                >
                  이 조건으로 YES와 상담하기
                </button>
              )}
            </>
          ) : (
            <div className="panel empty">
              <h2>조건을 입력하고 실행하세요</h2>
              <p>왼쪽에서 투자 조건을 정한 뒤 “시뮬레이션 실행”을 누르면 전략 A·B·C와 사용자 지정 전략의 P10, P50, P90 결과와 원금손실 확률, 자산 추이가 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
