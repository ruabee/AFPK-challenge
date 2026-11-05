import { useEffect, useMemo, useState } from 'react';
import { DepletionPanel } from './components/DepletionPanel';
import { InputForm } from './components/InputForm';
import { ProjectionChart } from './components/ProjectionChart';
import { ResultSummary } from './components/ResultSummary';
import { getMarketDataset, MIN_OBSERVATIONS, validateDataset } from './data/marketData';
import { DEFAULT_RUNS, validateInput } from './engine/simulationEngine';
import { useSimulation } from './hooks/useSimulation';
import type { SimulationInput } from './types';

const defaultInput: SimulationInput = {
  currentAge: NaN,
  initialAssets: NaN,
  years: NaN,
  annualAmount: NaN,
  mode: 'accumulate',
  stockWeight: NaN,
  bondWeight: NaN,
};

export default function App() {
  useEffect(() => { const listener = (e: MessageEvent) => { if(e.origin === location.origin && e.source === window.parent && e.data?.type === 'askyes-portfolio-busy') alert('챗봇 답변이 끝난 뒤 다시 눌러주세요.'); }; window.addEventListener('message',listener); return () => window.removeEventListener('message',listener); }, []);
  const dataset = useMemo(() => getMarketDataset(), []);
  const issues = useMemo(() => validateDataset(dataset), [dataset]);
  const dataReady = issues.errors.length === 0;
  const [input, setInput] = useState<SimulationInput>(defaultInput);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'askyes-consultation') return;
      const incoming = event.data.input;
      if (!incoming || typeof incoming !== 'object') return;
      const next = {...defaultInput};
      for (const key of ['currentAge','initialAssets','years','annualAmount'] as const) {
        if(typeof incoming[key] === 'number' && Number.isFinite(incoming[key]) && incoming[key] >= 0) next[key] = incoming[key];
      }
      setInput(next);
    };
    window.addEventListener('message',listener);
    return () => window.removeEventListener('message',listener);
  }, []);
  const { result: lastResult, running, error, run } = useSimulation(dataset);
  const result = lastResult && JSON.stringify(lastResult.input) === JSON.stringify(input) ? lastResult : null;
  const errors = validateInput(input);

  return (
    <div className="app">
      <header className="top">
        <h1>포트폴리오 시뮬레이터</h1>
        <p>주식·채권 역사적 수익률을 {DEFAULT_RUNS.toLocaleString('ko-KR')}번 다시 뽑아, 앞으로의 자산이 어디까지 갈 수 있는지 범위로 보여줍니다.</p>
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
          {result ? (
            <>
              <ResultSummary result={result} />
              {window.parent !== window && <button onClick={() => {
                const i = result.input;
                window.parent.postMessage({type:'askyes-portfolio',text:`포트폴리오 시뮬레이션 입력 조건으로 상담해주세요. 현재 ${i.currentAge}세, 초기자금 ${i.initialAssets}만원, 기간 ${i.years}년, 연간 ${i.mode === 'accumulate' ? '적립' : '인출'} ${i.annualAmount}만원, 주식 ${i.stockWeight}%, 채권 ${i.bondWeight}%입니다. 역사적 수익률 기반 시나리오이며 미래 수익 보장이 아닙니다. 이 계획의 위험과 제 목표에 맞는지 함께 검토해주세요.`},window.location.origin);
              }}>이 조건으로 YES와 상담하기</button>}
              <ProjectionChart result={result} />
              <DepletionPanel result={result} />
              <p className="fineprint">
                데이터: {result.datasetName} ({result.observations}개 연도). 매년 초 {result.input.mode === 'accumulate' ? '적립' : '인출'} 후 수익률을 적용하고 매년 목표 비중으로 리밸런싱한다고 가정합니다. 과거 수익률은 미래 수익을 보장하지 않으며, 이 결과는 투자 권유가 아닙니다.
              </p>
            </>
          ) : (
            <div className="panel empty">
              <h2>조건을 입력하고 실행하세요</h2>
              <p>왼쪽에서 모드와 투자 조건을 정한 뒤 “시뮬레이션 실행”을 누르면 P10, P50, P90 결과와 자산 추이가 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
