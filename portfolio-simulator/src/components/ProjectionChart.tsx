import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SimulationResult } from '../types';
import { formatAxis, formatKRW } from '../utils/format';

interface Row {
  age: number;
  year: number;
  p10: number;
  p50: number;
  p90: number;
  band: [number, number];
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="tip">
      <b>
        {row.age}세 ({row.year}년차)
      </b>
      <div>P90 {formatKRW(row.p90)}</div>
      <div className="tip-mid">P50 {formatKRW(row.p50)}</div>
      <div>P10 {formatKRW(row.p10)}</div>
    </div>
  );
}

export function ProjectionChart({ result }: { result: SimulationResult }) {
  const data: Row[] = result.series.map((s) => ({ ...s, band: [s.p10, s.p90] }));
  return (
    <section className="panel chart" aria-label="자산 추이 그래프">
      <header>
        <h2>자산 추이</h2>
        <p>
          {result.runs.toLocaleString('ko-KR')}회 시뮬레이션의 P10~P90 범위와 중앙값. 금액은 {result.returnType === 'real' ? '실질' : '명목'} 기준입니다.
        </p>
      </header>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="age" tickFormatter={(v) => `${v}세`} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={formatAxis} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<ChartTooltip />} />
            <Area dataKey="band" stroke="none" fill="var(--band)" fillOpacity={0.28} isAnimationActive={false} />
            <Line dataKey="p90" stroke="var(--p90)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="p10" stroke="var(--p10)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="p50" stroke="var(--p50)" strokeWidth={3} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend">
        <li><i className="k p90" />낙관적 (P90)</li>
        <li><i className="k p50" />예상 (P50)</li>
        <li><i className="k p10" />보수적 (P10)</li>
      </ul>
    </section>
  );
}
