import type { Mode, SimulationInput } from '../types';

interface Props {
  value: SimulationInput;
  onChange: (next: SimulationInput) => void;
  onSubmit: () => void;
  errors: string[];
  running: boolean;
  dataReady: boolean;
}

function NumberField(props: { label: string; unit: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <input type="number" inputMode="decimal" min={0} step={props.step ?? 1} value={Number.isNaN(props.value) ? '' : props.value} onChange={(e) => props.onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
        <span className="unit">{props.unit}</span>
      </span>
    </label>
  );
}

export function InputForm({ value, onChange, onSubmit, errors, running, dataReady }: Props) {
  const set = (patch: Partial<SimulationInput>) => onChange({ ...value, ...patch });
  const setMode = (mode: Mode) => set({ mode });
  const amountLabel = value.mode === 'accumulate' ? '연간 적립액' : '연간 인출액';
  const disabled = running || !dataReady || errors.length > 0;

  return (
    <form
      className="panel form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <h2>투자 조건</h2>

      <div className="segmented" role="group" aria-label="시뮬레이션 모드">
        <button type="button" className={value.mode === 'accumulate' ? 'on' : ''} aria-pressed={value.mode === 'accumulate'} onClick={() => setMode('accumulate')}>
          적립
        </button>
        <button type="button" className={value.mode === 'withdraw' ? 'on' : ''} aria-pressed={value.mode === 'withdraw'} onClick={() => setMode('withdraw')}>
          인출
        </button>
      </div>

      <NumberField label="현재 나이" unit="세" value={value.currentAge} onChange={(v) => set({ currentAge: v })} />
      <NumberField label="초기 자산" unit="만원" value={value.initialAssets} onChange={(v) => set({ initialAssets: v })} />
      <NumberField label="투자 기간" unit="년" value={value.years} onChange={(v) => set({ years: v })} />
      <NumberField label={amountLabel} unit="만원" value={value.annualAmount} onChange={(v) => set({ annualAmount: v })} />

      <fieldset className="weights">
        <legend>자산 배분</legend>
        <NumberField label="주식 비중" unit="%" value={value.stockWeight} onChange={(v) => set({ stockWeight: v, bondWeight: Number.isNaN(v) ? NaN : Math.round((100 - v) * 100) / 100 })} />
        <NumberField label="채권 비중" unit="%" value={value.bondWeight} onChange={(v) => set({ bondWeight: v, stockWeight: Number.isNaN(v) ? NaN : Math.round((100 - v) * 100) / 100 })} />
        <div className="weight-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, value.stockWeight || 0))}%` }} />
        </div>
      </fieldset>

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
