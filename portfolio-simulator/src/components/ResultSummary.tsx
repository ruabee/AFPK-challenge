import type { SimulationResult, StrategyResult } from '../types';
import { formatKRW, formatWeights } from '../utils/format';
import type { Basis } from './ResultControls';

interface Props {
  result: SimulationResult;
  strategy: StrategyResult;
  basis: Basis;
}

export function ResultSummary({ result, strategy, basis }: Props) {
  const real = basis === 'real';
  const main = real ? strategy.finalReal : strategy.final;
  const other = real ? strategy.final : strategy.finalReal;
  const otherLabel = real ? '명목' : '실질';
  const { input } = result;
  const principal = real ? result.realTotalContributed : result.totalContributed;
  const cards = [
    { cls: 'conservative', label: '보수적 결과 (P10)', note: '10%의 시나리오는 이보다 낮음', key: 'p10' },
    { cls: 'expected', label: '예상 결과 (P50)', note: '시나리오의 중앙값', key: 'p50' },
    { cls: 'optimistic', label: '낙관적 결과 (P90)', note: '10%의 시나리오는 이보다 높음', key: 'p90' },
  ] as const;

  return (
    <section className="summary" aria-label="결과 요약">
      <h3 className="sub-title">
        {strategy.label} <span>{formatWeights(strategy.stockWeight, strategy.bondWeight)}</span>
        <em>{real ? '실질 (현재 구매력 기준)' : '명목'}</em>
      </h3>
      <dl className="facts">
        <div>
          <dt>총 납입 원금{real ? ' (현재 구매력 환산)' : ''}</dt>
          <dd>{formatKRW(principal)}</dd>
          {real && <dd className="fact-note">명목 {formatKRW(result.totalContributed)}</dd>}
        </div>
        <div>
          <dt>초기 투자금 / 월 적립액</dt>
          <dd>
            {formatKRW(input.initialAssets)} / {formatKRW(input.monthlyAmount)}
          </dd>
        </div>
        <div>
          <dt>투자 기간 후 나이</dt>
          <dd>
            {input.currentAge + input.years}세 <span className="fact-note">({input.years}년)</span>
          </dd>
        </div>
      </dl>

      <div className="outcomes">
        {cards.map((c) => (
          <div key={c.key} className={`outcome ${c.cls}`}>
            <span className="o-label">{c.label}</span>
            <strong>{formatKRW(main[c.key])}</strong>
            <span className="o-note">
              {c.note} · {otherLabel} {formatKRW(other[c.key])}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
