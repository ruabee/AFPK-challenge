import type { SimulationResult, StrategyResult } from '../types';
import { formatKRW, formatPercent } from '../utils/format';

function tone(p: number) {
  return p >= 0.5 ? 'high' : p >= 0.1 ? 'mid' : 'low';
}

/** 만기 시점 원금손실 확률 (명목 / 실질 구분) */
export function LossPanel({ result, strategy }: { result: SimulationResult; strategy: StrategyResult }) {
  const years = result.input.years;
  const worst = Math.max(strategy.lossProbability, strategy.realLossProbability);
  return (
    <section className={`panel loss ${tone(worst)}`} aria-label="원금손실 확률">
      <h2>원금손실 확률 (만기 {years}년 시점)</h2>
      <div className="loss-grid">
        <div className={tone(strategy.lossProbability)}>
          <span className="o-label">명목 기준</span>
          <strong>{formatPercent(strategy.lossProbability)}</strong>
          <span className="o-note">만기 명목 자산이 총 납입 원금 {formatKRW(result.totalContributed)}보다 적은 시나리오 비율</span>
        </div>
        <div className={tone(strategy.realLossProbability)}>
          <span className="o-label">실질 구매력 기준</span>
          <strong>{formatPercent(strategy.realLossProbability)}</strong>
          <span className="o-note">만기 실질 자산이 현재 구매력으로 환산한 납입 원금 {formatKRW(result.realTotalContributed)}보다 적은 시나리오 비율</span>
        </div>
      </div>
      <p className="o-note loss-def">원금손실 확률 = 원금손실 경로 수 ÷ 전체 {result.runs.toLocaleString('ko-KR')}개 경로 × 100. 만기 시점만 비교하며 중간에 평가액이 원금 아래였는지는 포함하지 않습니다.</p>
    </section>
  );
}
