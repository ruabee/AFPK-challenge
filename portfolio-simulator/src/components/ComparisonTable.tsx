import { matchingPreset } from '../engine/simulationEngine';
import type { SimulationResult, StrategyId } from '../types';
import { formatKRW, formatPercent, formatWeights } from '../utils/format';
import type { Basis } from './ResultControls';

interface Props {
  result: SimulationResult;
  basis: Basis;
  selectedId: StrategyId;
  onSelect: (id: StrategyId) => void;
}

export function ComparisonTable({ result, basis, selectedId, onSelect }: Props) {
  const real = basis === 'real';
  const principal = real ? result.realTotalContributed : result.totalContributed;
  return (
    <section className="panel compare" aria-label="포트폴리오 비교">
      <header>
        <h2>포트폴리오 비교</h2>
        <p>
          네 전략에 같은 시장 시나리오(시드 {result.seed})를 적용했습니다. 금액은 {real ? '실질(현재 구매력)' : '명목'} 기준이며 행을 누르면 위 요약과 그래프가 바뀝니다.
        </p>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">전략</th>
              <th scope="col">총 납입 원금</th>
              <th scope="col">P10</th>
              <th scope="col">P50</th>
              <th scope="col">P90</th>
              <th scope="col">원금손실 확률 (명목)</th>
              <th scope="col">원금손실 확률 (실질)</th>
            </tr>
          </thead>
          <tbody>
            {result.strategies.map((s) => {
              const f = real ? s.finalReal : s.final;
              const same = s.id === 'custom' ? matchingPreset(s.stockWeight, s.bondWeight) : undefined;
              return (
                <tr key={s.id} className={selectedId === s.id ? 'selected' : ''} onClick={() => onSelect(s.id)}>
                  <th scope="row">
                    <button type="button" className="row-btn" aria-pressed={selectedId === s.id} onClick={() => onSelect(s.id)}>
                      {s.label}
                    </button>
                    <span className="row-sub">{formatWeights(s.stockWeight, s.bondWeight)}</span>
                    {same && <span className="row-sub">({same.label}와 같은 비중)</span>}
                  </th>
                  <td>{formatKRW(principal)}</td>
                  <td>{formatKRW(f.p10)}</td>
                  <td className="mid">{formatKRW(f.p50)}</td>
                  <td>{formatKRW(f.p90)}</td>
                  <td>{formatPercent(s.lossProbability)}</td>
                  <td>{formatPercent(s.realLossProbability)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
