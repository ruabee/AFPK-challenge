/**
 * 계산 검증 스크립트: npm run verify
 * 실제 NYU Stern 데이터와, 정답을 손으로 계산할 수 있는 합성 데이터로 엔진을 점검합니다.
 */
import { getMarketDataset, validateDataset } from '../src/data/marketData';
import { PRESET_STRATEGIES, runSimulation, toMonthlyReturn, validateInput } from '../src/engine/simulationEngine';
import type { MarketDataset, SimulationInput } from '../src/types';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
}
const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

const base: SimulationInput = { currentAge: 35, initialAssets: 1000, years: 20, monthlyAmount: 30, inflationRate: 2, stockWeight: 60, bondWeight: 40, seed: null };
const real = getMarketDataset();
const issues = validateDataset(real);
check('시장 데이터 검증 통과 (1928~2025, 오류 없음)', issues.errors.length === 0 && real.returns.length === 98, `${real.returns.length}개 연도`);

// 합성 데이터: 한 해만 있으면 매년 같은 수익률이므로 해석해와 비교할 수 있다.
const synth = (stock: number, bond: number): MarketDataset => ({ name: 'synthetic', source: 'test', returnType: 'nominal', series: { stock: 's', bond: 'b' }, returns: [{ year: 2000, stock, bond }] });

// 1. 월 납입·월 복리: 주식=채권=연 8%일 때 FV = P(1+r)^T + c·((1+m)^(12T)−1)/m
{
  const r = 0.08, T = 20, c = 30, P = 1000;
  const m = toMonthlyReturn(r);
  const expected = P * (1 + r) ** T + (c * ((1 + m) ** (12 * T) - 1)) / m;
  const res = runSimulation({ ...base, years: T, monthlyAmount: c, initialAssets: P }, synth(r, r), { runs: 50, seed: 1 });
  const got = res.strategies[0].final.p50;
  check('월말 납입 + 월 복리 해석해 일치 (연 8%)', close(got, expected), `엔진 ${got.toFixed(4)} / 해석해 ${expected.toFixed(4)}`);
  check('월 수익률 변환 (1+r)^(1/12)-1 을 12번 곱하면 연 수익률', close((1 + m) ** 12, 1 + r, 1e-12));
}
// 2. 주식·채권 수익률이 다를 때: 적립 없이 연 1회 리밸런싱 → V·(ws(1+s)+wb(1+b))^T
{
  const s = 0.2, b = 0.04, T = 10;
  const res = runSimulation({ ...base, years: T, monthlyAmount: 0, initialAssets: 1000 }, synth(s, b), { runs: 50, seed: 1 });
  const ok = res.strategies.every((st) => close(st.final.p50, 1000 * ((st.stockWeight / 100) * (1 + s) + (st.bondWeight / 100) * (1 + b)) ** T));
  check('적립 없는 경우 연 1회 리밸런싱 포트폴리오 수익률과 일치 (월 수익률을 12로 나누지 않음)', ok);
}
// 3. 월별·총 납입 원금: 수익률 0이면 최종 자산 = 총 납입 원금
{
  const res = runSimulation({ ...base, years: 7, monthlyAmount: 33.3, initialAssets: 123.4 }, synth(0, 0), { runs: 20, seed: 1 });
  const expectedPrincipal = 123.4 + 33.3 * 12 * 7;
  check('총 납입 원금 = 초기 투자금 + 월 적립금 × 12 × 기간', close(res.totalContributed, expectedPrincipal) && res.strategies.every((s) => close(s.final.p50, expectedPrincipal)), `${res.totalContributed}`);
  check('연도별 누적 원금 계열이 매년 월 적립금 × 12 만큼 증가', res.principalSeries.every((v, y) => close(v, 123.4 + 33.3 * 12 * y)));
}
// 4. 같은 시드 → 같은 결과, 다른 시드 → 다른 결과
{
  const a = runSimulation({ ...base }, real, { seed: 42 });
  const b = runSimulation({ ...base, seed: 42 }, real, {});
  const c = runSimulation({ ...base }, real, { seed: 43 });
  const same = JSON.stringify(a.strategies) === JSON.stringify(b.strategies);
  check('같은 시드에서 완전히 같은 결과 재현 (options.seed / input.seed 모두)', same && a.seed === 42 && b.seed === 42);
  check('다른 시드에서는 결과가 다름', JSON.stringify(a.strategies) !== JSON.stringify(c.strategies));
  check('시뮬레이션 횟수 기본값 10,000회', a.runs === 10_000);
}
// 5. 동일 시장 시나리오: 사용자 지정 비중과 무관하게 A/B/C가 같고, 사용자 지정=A 비중이면 A와 같다
{
  const x = runSimulation({ ...base, stockWeight: 20, bondWeight: 80 }, real, { seed: 7 });
  const y = runSimulation({ ...base, stockWeight: 90, bondWeight: 10 }, real, { seed: 7 });
  const abcSame = [0, 1, 2].every((i) => JSON.stringify(x.strategies[i]) === JSON.stringify(y.strategies[i]));
  const customEqualsA = JSON.stringify({ ...x.strategies[3], id: 0, label: 0 }) === JSON.stringify({ ...x.strategies[0], id: 0, label: 0 });
  check('A/B/C 결과가 사용자 지정 비중과 무관 (같은 추출 경로)', abcSame);
  check('사용자 지정 20/80 = 전략 A 결과와 완전히 동일 (같은 시나리오)', customEqualsA);
  check('전략 구성 A 20/80, B 40/60, C 60/40', PRESET_STRATEGIES.map((s) => `${s.stockWeight}/${s.bondWeight}`).join() === '20/80,40/60,60/40');
}
// 6. P10 ≤ P50 ≤ P90, 손실확률 0~100%
{
  const cases: SimulationInput[] = [base, { ...base, initialAssets: 0, years: 10 }, { ...base, initialAssets: 0, years: 30, monthlyAmount: 100 }, { ...base, years: 1 }, { ...base, inflationRate: 8 }];
  let ordered = true, ranged = true;
  for (const inp of cases) {
    const res = runSimulation(inp, real, { seed: 5 });
    for (const s of res.strategies) {
      for (const ser of [s.series, s.realSeries]) for (const p of ser) if (!(p.p10 <= p.p50 && p.p50 <= p.p90)) ordered = false;
      for (const p of [s.lossProbability, s.realLossProbability]) if (!(p >= 0 && p <= 1)) ranged = false;
    }
  }
  check('모든 연도·전략·기준에서 P10 ≤ P50 ≤ P90', ordered);
  check('원금손실 확률이 0~100% 범위', ranged);
}
// 7. 물가상승률 0%: 명목 = 실질
{
  const res = runSimulation({ ...base, inflationRate: 0 }, real, { seed: 9 });
  const same = res.strategies.every((s) => JSON.stringify(s.series) === JSON.stringify(s.realSeries) && JSON.stringify(s.final) === JSON.stringify(s.finalReal) && s.lossProbability === s.realLossProbability);
  check('물가상승률 0%일 때 명목·실질 자산, 원금, 손실확률 일치', same && res.totalContributed === res.realTotalContributed);
}
// 8. 물가상승률 효과: 실질 = 명목 ÷ (1.02)^20, 시드 같으면 명목은 물가와 무관
{
  const a = runSimulation({ ...base, inflationRate: 2 }, real, { seed: 11 });
  const b = runSimulation({ ...base, inflationRate: 5 }, real, { seed: 11 });
  const s = a.strategies[1];
  check('실질 최종 자산 = 명목 ÷ (1+2%)^20', close(s.finalReal.p50, s.final.p50 / 1.02 ** 20));
  check('물가상승률을 바꿔도 같은 시드의 명목 결과는 동일', JSON.stringify(a.strategies.map((x) => x.series)) === JSON.stringify(b.strategies.map((x) => x.series)));
  check('물가상승률이 높을수록 실질 손실확률이 같거나 커짐', b.strategies.every((x, i) => x.realLossProbability >= a.strategies[i].realLossProbability));
  check('실질 환산 납입 원금 < 명목 납입 원금 (물가 > 0)', a.realTotalContributed < a.totalContributed);
  // 실질 환산 원금 직접 계산
  let sum = 1000;
  for (let m = 1; m <= 240; m++) sum += 30 / 1.02 ** (m / 12);
  check('실질 환산 납입 원금 직접 합산과 일치', close(a.realTotalContributed, sum), `${a.realTotalContributed.toFixed(3)}`);
}
// 9. 입력 검증
{
  check('유효한 입력은 오류 없음', validateInput(base).length === 0);
  check('비중 합 ≠ 100 오류', validateInput({ ...base, stockWeight: 70, bondWeight: 40 }).length > 0);
  check('월 적립액 음수 오류', validateInput({ ...base, monthlyAmount: -1 }).length > 0);
  check('초기 0원 + 월 0원 오류', validateInput({ ...base, initialAssets: 0, monthlyAmount: 0 }).length > 0);
  check('초기 0원 + 월 적립 허용', validateInput({ ...base, initialAssets: 0 }).length === 0);
  check('물가상승률 범위 오류', validateInput({ ...base, inflationRate: -1 }).length > 0 && validateInput({ ...base, inflationRate: NaN }).length > 0);
  let threw = false;
  try { runSimulation(base, { ...real, returns: [] }); } catch { threw = true; }
  check('빈 데이터는 오류', threw);
}

// 참고 출력: 실제 데이터 (월 30만원, 초기 0원, 연 2% 물가)
console.log('\n[참고] 월 30만원 · 초기 0원 · seed 2026 · 단위 만원');
for (const years of [10, 20, 30]) {
  const res = runSimulation({ ...base, initialAssets: 0, years }, real, { seed: 2026 });
  console.log(`${years}년 납입원금 ${res.totalContributed} / 실질환산 ${res.realTotalContributed.toFixed(0)}`);
  for (const s of res.strategies) console.log(`  ${s.id.padEnd(6)} ${s.stockWeight}/${s.bondWeight}  P10 ${s.final.p10.toFixed(0)}  P50 ${s.final.p50.toFixed(0)}  P90 ${s.final.p90.toFixed(0)}  손실(명목) ${(s.lossProbability * 100).toFixed(1)}%  손실(실질) ${(s.realLossProbability * 100).toFixed(1)}%`);
}

if (failed > 0) throw new Error(`${failed}개 검증 실패`);
console.log('\n모든 검증 통과');
