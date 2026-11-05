import type { SimulationResult } from '../types';
import { formatKRW } from '../utils/format';

export function ResultSummary({ result }: { result: SimulationResult }) {
  const withdraw = result.input.mode === 'withdraw';
  return (
    <section className="summary" aria-label="결과 요약">
      <dl className="facts">
        <div>
          <dt>초기 자산</dt>
          <dd>{formatKRW(result.initialAssets)}</dd>
        </div>
        <div>
          <dt>{withdraw ? '총 인출금' : '총 적립금'}</dt>
          <dd>{formatKRW(result.totalFlow)}</dd>
        </div>
        <div>
          <dt>투자 기간 후 나이</dt>
          <dd>{result.input.currentAge + result.input.years}세</dd>
        </div>
      </dl>

      <div className="outcomes">
        <div className="outcome conservative">
          <span className="o-label">보수적 결과 (P10)</span>
          <strong>{formatKRW(result.final.p10)}</strong>
          <span className="o-note">10%의 시나리오는 이보다 낮음</span>
        </div>
        <div className="outcome expected">
          <span className="o-label">예상 결과 (P50)</span>
          <strong>{formatKRW(result.final.p50)}</strong>
          <span className="o-note">시나리오의 중앙값</span>
        </div>
        <div className="outcome optimistic">
          <span className="o-label">낙관적 결과 (P90)</span>
          <strong>{formatKRW(result.final.p90)}</strong>
          <span className="o-note">10%의 시나리오는 이보다 높음</span>
        </div>
      </div>
    </section>
  );
}
