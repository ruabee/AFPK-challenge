import type { SimulationResult, StrategyId } from '../types';

export type Basis = 'nominal' | 'real';

interface Props {
  result: SimulationResult;
  strategyId: StrategyId;
  basis: Basis;
  onStrategy: (id: StrategyId) => void;
  onBasis: (b: Basis) => void;
}

/** 요약 카드·그래프·표가 함께 따르는 전략 선택과 명목/실질 기준 전환 */
export function ResultControls({ result, strategyId, basis, onStrategy, onBasis }: Props) {
  return (
    <div className="controls">
      <div className="control">
        <span className="control-label">전략</span>
        <div className="segmented" role="group" aria-label="전략 선택">
          {result.strategies.map((s) => (
            <button key={s.id} type="button" className={strategyId === s.id ? 'on' : ''} aria-pressed={strategyId === s.id} onClick={() => onStrategy(s.id)}>
              {s.id === 'custom' ? '사용자 지정' : s.id}
            </button>
          ))}
        </div>
      </div>
      <div className="control">
        <span className="control-label">금액 기준</span>
        <div className="segmented" role="group" aria-label="금액 기준 선택">
          <button type="button" className={basis === 'nominal' ? 'on' : ''} aria-pressed={basis === 'nominal'} onClick={() => onBasis('nominal')}>
            명목
          </button>
          <button type="button" className={basis === 'real' ? 'on' : ''} aria-pressed={basis === 'real'} onClick={() => onBasis('real')}>
            실질 (현재 구매력)
          </button>
        </div>
      </div>
    </div>
  );
}
