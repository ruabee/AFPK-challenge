import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SimulationResult, StrategyResult } from '../types';
import { formatAxis, formatKRW, formatWeights } from '../utils/format';
import type { Basis } from './ResultControls';

interface Row {
  age: number;
  year: number;
  p10: number;
  p50: number;
  p90: number;
  principal: number;
  band: [number, number];
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="tip">
      <b>
        {row.year}년차 ({row.age}세)
      </b>
      <div>P90 {formatKRW(row.p90)}</div>
      <div className="tip-mid">P50 {formatKRW(row.p50)}</div>
      <div>P10 {formatKRW(row.p10)}</div>
      <div className="tip-principal">총 납입 원금 {formatKRW(row.principal)}</div>
    </div>
  );
}

interface Props {
  result: SimulationResult;
  strategy: StrategyResult;
  basis: Basis;
}

export function ProjectionChart({ result, strategy, basis }: Props) {
  const real = basis === 'real';
  const series = real ? strategy.realSeries : strategy.series;
  const principal = real ? result.realPrincipalSeries : result.principalSeries;
  const data: Row[] = series.map((s, i) => ({ ...s, principal: principal[i], band: [s.p10, s.p90] }));
  return (
    <section className="panel chart" aria-label="자산 추이 그래프">
      <header>
        <h2>투자기간별 자산 추이 (단위: 만원)</h2>
        <p>
          {strategy.label} ({formatWeights(strategy.stockWeight, strategy.bondWeight)}) · {result.runs.toLocaleString('ko-KR')}회 시뮬레이션의 P10~P90 범위와 중앙값 · {real ? '실질(현재 구매력)' : '명목'} 기준
        </p>
      </header>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="year" tickFormatter={(v) => `${v}년`} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={formatAxis} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip content={<ChartTooltip />} />
            <Area dataKey="band" stroke="none" fill="var(--band)" fillOpacity={0.28} isAnimationActive={false} />
            <Line dataKey="p90" stroke="var(--p90)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="p10" stroke="var(--p10)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="principal" stroke="var(--muted)" strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" dot={false} isAnimationActive={false} />
            <Line dataKey="p50" stroke="var(--p50)" strokeWidth={3} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend">
        <li><i className="k p90" />낙관적 (P90)</li>
        <li><i className="k p50" />예상 (P50)</li>
        <li><i className="k p10" />보수적 (P10)</li>
        <li><i className="k principal" />총 납입 원금{real ? ' (현재 구매력 환산)' : ''}</li>
      </ul>
    </section>
  );
}
