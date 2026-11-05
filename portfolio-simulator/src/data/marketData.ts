 import type { HistoricalReturn, MarketDataset } from '../types';

/**
 * 시장 데이터 모듈. 실제 역사적 데이터는 이 파일의 RETURNS와 META만 채우면 됩니다.
 * simulationEngine은 이 파일을 import하지 않고 dataset을 인자로 받으므로 엔진과 UI는 수정할 필요가 없습니다.
 *
 * ── 입력 규칙 ──────────────────────────────────────────
 * 1. 수익률은 소수입니다: 10% → 0.10, -35% → -0.35, 2.5% → 0.025 (10으로 쓰면 1000%로 계산됩니다)
 * 2. 한 해에 한 행: 주식과 채권을 같은 연도의 같은 행에 넣습니다.
 * 3. 연간 총수익률(배당·이자 재투자 포함) 사용을 권장합니다. 가격지수만 쓰면 수익이 과소평가됩니다.
 * 4. 주식과 채권은 같은 기준(통화, 명목/실질)이어야 하고, META.returnType과 일치해야 합니다.
 * 5. 연도는 중복되면 안 되며, 순서는 상관없습니다 (자동 정렬).
 */

// NYU Stern / Aswath Damodaran 실제 연간 수익률, 1928–2025.
// stock = S&P 500 (includes dividends)
// bond  = US T. Bond (10-year)
// 원본 퍼센트를 소수로 변환했습니다. 예: 43.81% → 0.4381
const RETURNS: HistoricalReturn[] = [
  { year: 1928, stock: 0.4381, bond: 0.0084 },
  { year: 1929, stock: -0.0830, bond: 0.0420 },
  { year: 1930, stock: -0.2512, bond: 0.0454 },
  { year: 1931, stock: -0.4384, bond: -0.0256 },
  { year: 1932, stock: -0.0864, bond: 0.0879 },
  { year: 1933, stock: 0.4998, bond: 0.0186 },
  { year: 1934, stock: -0.0119, bond: 0.0796 },
  { year: 1935, stock: 0.4674, bond: 0.0447 },
  { year: 1936, stock: 0.3194, bond: 0.0502 },
  { year: 1937, stock: -0.3534, bond: 0.0138 },
  { year: 1938, stock: 0.2928, bond: 0.0421 },
  { year: 1939, stock: -0.0110, bond: 0.0441 },
  { year: 1940, stock: -0.1067, bond: 0.0540 },
  { year: 1941, stock: -0.1277, bond: -0.0202 },
  { year: 1942, stock: 0.1917, bond: 0.0229 },
  { year: 1943, stock: 0.2506, bond: 0.0249 },
  { year: 1944, stock: 0.1903, bond: 0.0258 },
  { year: 1945, stock: 0.3582, bond: 0.0380 },
  { year: 1946, stock: -0.0843, bond: 0.0313 },
  { year: 1947, stock: 0.0520, bond: 0.0092 },
  { year: 1948, stock: 0.0570, bond: 0.0195 },
  { year: 1949, stock: 0.1830, bond: 0.0466 },
  { year: 1950, stock: 0.3081, bond: 0.0043 },
  { year: 1951, stock: 0.2368, bond: -0.0030 },
  { year: 1952, stock: 0.1815, bond: 0.0227 },
  { year: 1953, stock: -0.0121, bond: 0.0414 },
  { year: 1954, stock: 0.5256, bond: 0.0329 },
  { year: 1955, stock: 0.3260, bond: -0.0134 },
  { year: 1956, stock: 0.0744, bond: -0.0226 },
  { year: 1957, stock: -0.1046, bond: 0.0680 },
  { year: 1958, stock: 0.4372, bond: -0.0210 },
  { year: 1959, stock: 0.1206, bond: -0.0265 },
  { year: 1960, stock: 0.0034, bond: 0.1164 },
  { year: 1961, stock: 0.2664, bond: 0.0206 },
  { year: 1962, stock: -0.0881, bond: 0.0569 },
  { year: 1963, stock: 0.2261, bond: 0.0168 },
  { year: 1964, stock: 0.1642, bond: 0.0373 },
  { year: 1965, stock: 0.1240, bond: 0.0072 },
  { year: 1966, stock: -0.0997, bond: 0.0291 },
  { year: 1967, stock: 0.2380, bond: -0.0158 },
  { year: 1968, stock: 0.1081, bond: 0.0327 },
  { year: 1969, stock: -0.0824, bond: -0.0501 },
  { year: 1970, stock: 0.0356, bond: 0.1675 },
  { year: 1971, stock: 0.1422, bond: 0.0979 },
  { year: 1972, stock: 0.1876, bond: 0.0282 },
  { year: 1973, stock: -0.1431, bond: 0.0366 },
  { year: 1974, stock: -0.2590, bond: 0.0199 },
  { year: 1975, stock: 0.3700, bond: 0.0361 },
  { year: 1976, stock: 0.2383, bond: 0.1598 },
  { year: 1977, stock: -0.0698, bond: 0.0129 },
  { year: 1978, stock: 0.0651, bond: -0.0078 },
  { year: 1979, stock: 0.1852, bond: 0.0067 },
  { year: 1980, stock: 0.3174, bond: -0.0299 },
  { year: 1981, stock: -0.0470, bond: 0.0820 },
  { year: 1982, stock: 0.2042, bond: 0.3281 },
  { year: 1983, stock: 0.2234, bond: 0.0320 },
  { year: 1984, stock: 0.0615, bond: 0.1373 },
  { year: 1985, stock: 0.3124, bond: 0.2571 },
  { year: 1986, stock: 0.1849, bond: 0.2428 },
  { year: 1987, stock: 0.0581, bond: -0.0496 },
  { year: 1988, stock: 0.1654, bond: 0.0822 },
  { year: 1989, stock: 0.3148, bond: 0.1769 },
  { year: 1990, stock: -0.0306, bond: 0.0624 },
  { year: 1991, stock: 0.3023, bond: 0.1500 },
  { year: 1992, stock: 0.0749, bond: 0.0936 },
  { year: 1993, stock: 0.0997, bond: 0.1421 },
  { year: 1994, stock: 0.0133, bond: -0.0804 },
  { year: 1995, stock: 0.3720, bond: 0.2348 },
  { year: 1996, stock: 0.2268, bond: 0.0143 },
  { year: 1997, stock: 0.3310, bond: 0.0994 },
  { year: 1998, stock: 0.2834, bond: 0.1492 },
  { year: 1999, stock: 0.2089, bond: -0.0825 },
  { year: 2000, stock: -0.0903, bond: 0.1666 },
  { year: 2001, stock: -0.1185, bond: 0.0557 },
  { year: 2002, stock: -0.2197, bond: 0.1512 },
  { year: 2003, stock: 0.2836, bond: 0.0038 },
  { year: 2004, stock: 0.1074, bond: 0.0449 },
  { year: 2005, stock: 0.0483, bond: 0.0287 },
  { year: 2006, stock: 0.1561, bond: 0.0196 },
  { year: 2007, stock: 0.0548, bond: 0.1021 },
  { year: 2008, stock: -0.3655, bond: 0.2010 },
  { year: 2009, stock: 0.2594, bond: -0.1112 },
  { year: 2010, stock: 0.1482, bond: 0.0846 },
  { year: 2011, stock: 0.0210, bond: 0.1604 },
  { year: 2012, stock: 0.1589, bond: 0.0297 },
  { year: 2013, stock: 0.3215, bond: -0.0910 },
  { year: 2014, stock: 0.1352, bond: 0.1075 },
  { year: 2015, stock: 0.0138, bond: 0.0128 },
  { year: 2016, stock: 0.1177, bond: 0.0069 },
  { year: 2017, stock: 0.2161, bond: 0.0280 },
  { year: 2018, stock: -0.0423, bond: -0.0002 },
  { year: 2019, stock: 0.3121, bond: 0.0964 },
  { year: 2020, stock: 0.1802, bond: 0.1133 },
  { year: 2021, stock: 0.2847, bond: -0.0442 },
  { year: 2022, stock: -0.1804, bond: -0.1783 },
  { year: 2023, stock: 0.2606, bond: 0.0388 },
  { year: 2024, stock: 0.2488, bond: -0.0164 },
  { year: 2025, stock: 0.1778, bond: 0.0780 },
];

const META: Omit<MarketDataset, 'returns'> = {
  name: 'S&P 500 · 미국 10년 국채 (Damodaran)',
  source:
    'Aswath Damodaran, NYU Stern, Historical Returns on Stocks, Bonds and Bills — https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html',
  returnType: 'nominal',
  series: {
    stock: 'S&P 500 총수익 (가격 상승 + 배당)',
    bond: '미국 10년 국채 총수익 (쿠폰 + 가격 변동)',
  },
  expectedPeriod: { start: 1928, end: 2025 },
};

/** 이보다 적으면 부트스트랩 결과를 신뢰하기 어려워 실행을 막는 최소 연도 수 */
export const MIN_OBSERVATIONS = 10;
/** 연 수익률 절댓값이 이 값(=200%)을 넘으면 퍼센트 값을 그대로 넣은 실수로 의심해 경고 */
const SUSPICIOUS_ABS_RETURN = 2;

export interface DatasetIssues {
  /** 실행을 막는 문제 */
  errors: string[];
  /** 실행은 가능하지만 확인이 필요한 문제 */
  warnings: string[];
}

export function getMarketDataset(): MarketDataset {
  return { ...META, returns: [...RETURNS].sort((a, b) => a.year - b.year) };
}

export function validateDataset(d: MarketDataset): DatasetIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const years = new Set<number>();

  if (d.returns.length < MIN_OBSERVATIONS) {
    errors.push(`수익률 데이터가 ${d.returns.length}개 연도입니다. 최소 ${MIN_OBSERVATIONS}개 연도가 필요합니다.`);
  }
  for (const r of d.returns) {
    if (!Number.isInteger(r.year)) errors.push(`연도가 정수가 아닙니다: ${r.year}`);
    if (years.has(r.year)) errors.push(`${r.year}년이 중복되었습니다.`);
    years.add(r.year);
    for (const [label, v] of [['주식', r.stock], ['채권', r.bond]] as const) {
      if (!Number.isFinite(v)) errors.push(`${r.year}년 ${label} 수익률이 숫자가 아닙니다.`);
      else if (v <= -1) errors.push(`${r.year}년 ${label} 수익률 ${v}은(는) -100% 이하입니다. 소수 형식인지 확인하세요 (-35% → -0.35).`);
      else if (Math.abs(v) > SUSPICIOUS_ABS_RETURN) warnings.push(`${r.year}년 ${label} 수익률 ${v}은(는) ${v * 100}%입니다. 퍼센트 값을 그대로 넣지 않았는지 확인하세요.`);
    }
  }
  const period = d.expectedPeriod;
  if (period) {
    const missing: number[] = [];
    for (let y = period.start; y <= period.end; y++) if (!years.has(y)) missing.push(y);
    const outside = [...years].filter((y) => y < period.start || y > period.end);
    if (missing.length > 0 && missing.length < period.end - period.start + 1) {
      warnings.push(`${period.start}~${period.end}년 중 ${missing.length}개 연도가 없습니다: ${formatRanges(missing)}`);
    }
    if (outside.length > 0) warnings.push(`기준 기간(${period.start}~${period.end}) 밖의 연도가 있습니다: ${formatRanges(outside)}`);
  } else {
    const sorted = [...years].sort((a, b) => a - b);
    if (sorted.length > 1 && sorted[sorted.length - 1] - sorted[0] + 1 !== sorted.length) {
      warnings.push('연도 사이에 빠진 해가 있습니다. 의도한 것이 아니라면 누락 여부를 확인하세요.');
    }
  }
  return { errors, warnings };
}

/** [1928, 1929, 1930, 1935] → "1928–1930, 1935" */
function formatRanges(values: number[]): string {
  const sorted = [...values].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (
      j + 1 < sorted.length &&
      sorted[j + 1] === sorted[j] + 1
    ) {
      j++;
    }
    parts.push(
      j > i
        ? `${sorted[i]}–${sorted[j]}`
        : `${sorted[i]}`
    );
    i = j + 1;
  }
  return parts.join(', ');
}