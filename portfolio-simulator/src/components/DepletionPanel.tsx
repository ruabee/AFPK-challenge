import type { SimulationResult } from '../types';
import { formatPercent } from '../utils/format';

export function DepletionPanel({ result }: { result: SimulationResult }) {
  const d = result.depletion;
  if (!d) return null;
  const years = result.input.years;
  const label = (y: number) => (y >= years ? `${years}년 전체 유지` : `${y}년`);
  const tone = d.probability >= 0.5 ? 'high' : d.probability >= 0.1 ? 'mid' : 'low';
  return (
    <section className={`panel depletion ${tone}`} aria-label="자산 고갈 분석">
      <h2>자산 고갈 분석</h2>
      <div className="dep-grid">
        <div>
          <span className="o-label">자산 고갈 확률</span>
          <strong>{formatPercent(d.probability)}</strong>
          <span className="o-note">{years}년 안에 자산이 0이 되는 시나리오 비율</span>
        </div>
        <div>
          <span className="o-label">예상 자산 유지기간 (중앙값)</span>
          <strong>{label(d.sustainedYearsP50)}</strong>
          <span className="o-note">{result.input.currentAge + Math.min(d.sustainedYearsP50, years)}세까지 인출 가능</span>
        </div>
        <div>
          <span className="o-label">보수적 유지기간 (P10)</span>
          <strong>{label(d.sustainedYearsP10)}</strong>
          <span className="o-note">운이 나쁜 10% 시나리오 기준</span>
        </div>
      </div>
    </section>
  );
}
