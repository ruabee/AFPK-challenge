import type { SimulationInput } from '../types';

interface Props {
  value: SimulationInput;
  onChange: (next: SimulationInput) => void;
  onSubmit: () => void;
  errors: string[];
  running: boolean;
  dataReady: boolean;
}

const YEAR_PRESETS = [10, 20, 30];

function NumberField(props: { label: string; unit: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <input type="number" inputMode="decimal" min={0} step={props.step ?? 1} value={Number.isNaN(props.value) ? '' : props.value} onChange={(e) => props.onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
        <span className="unit">{props.unit}</span>
      </span>
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
  );
}

export function InputForm({ value, onChange, onSubmit, errors, running, dataReady }: Props) {
  const set = (patch: Partial<SimulationInput>) => onChange({ ...value, ...patch });
  const disabled = running || !dataReady || errors.length > 0;

  return (
    <form
      className="panel form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <h2>입력 조건</h2>

      <NumberField label="현재 나이" unit="세" value={value.currentAge} onChange={(v) => set({ currentAge: v })} />
      <NumberField label="초기 투자금" unit="만원" value={value.initialAssets} onChange={(v) => set({ initialAssets: v })} hint="0원도 가능합니다." />
      <NumberField label="월 적립액" unit="만원" value={value.monthlyAmount} onChange={(v) => set({ monthlyAmount: v })} hint="매월 말 납입, 물가에 따라 늘리지 않는 고정 금액" />
      <div className="field">
        <NumberField label="투자 기간" unit="년" value={value.years} onChange={(v) => set({ years: v })} />
        <div className="segmented" role="group" aria-label="투자 기간 바로 선택">
          {YEAR_PRESETS.map((y) => (
            <button key={y} type="button" className={value.years === y ? 'on' : ''} aria-pressed={value.years === y} onClick={() => set({ years: y })}>
              {y}년
            </button>
          ))}
        </div>
      </div>
      <NumberField label="물가상승률 (연)" unit="%" step={0.1} value={value.inflationRate} onChange={(v) => set({ inflationRate: v })} hint="바꾸면 실질 자산이 자동으로 다시 계산됩니다." />

      <fieldset className="weights">
        <legend>사용자 지정 자산배분</legend>
        <p className="field-hint">전략 A(20/80)·B(40/60)·C(60/40)는 항상 함께 비교됩니다. 여기 비중은 네 번째 ‘사용자 지정’ 전략으로 같은 시장 시나리오에 계산됩니다.</p>
        <NumberField label="주식 비중" unit="%" value={value.stockWeight} onChange={(v) => set({ stockWeight: v, bondWeight: Number.isNaN(v) ? NaN : Math.round((100 - v) * 100) / 100 })} />
        <NumberField label="채권 비중" unit="%" value={value.bondWeight} onChange={(v) => set({ bondWeight: v, stockWeight: Number.isNaN(v) ? NaN : Math.round((100 - v) * 100) / 100 })} />
        <div className="weight-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, value.stockWeight || 0))}%` }} />
        </div>
      </fieldset>

      <label className="field">
        <span className="field-label">난수 시드 (선택)</span>
        <span className="field-input">
          <input type="number" inputMode="numeric" min={0} step={1} placeholder="비우면 자동" value={value.seed ?? ''} onChange={(e) => set({ seed: e.target.value === '' ? null : Number(e.target.value) })} />
        </span>
        <span className="field-hint">같은 조건과 시드는 항상 같은 결과를 냅니다.</span>
      </label>

      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <button type="submit" className="primary" disabled={disabled}>
        {running ? '10,000회 계산 중…' : '시뮬레이션 실행'}
      </button>
    </form>
  );
}
