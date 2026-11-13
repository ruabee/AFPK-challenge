/** 입력 단위는 만원. 1억 = 10,000만원 */
export function formatKRW(manwon: number): string {
  const abs = Math.abs(manwon);
  if (abs >= 10_000) return `${(manwon / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억원`;
  return `${Math.round(manwon).toLocaleString('ko-KR')}만원`;
}

export function formatAxis(manwon: number): string {
  if (Math.abs(manwon) >= 10_000) return `${(manwon / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`;
  return `${Math.round(manwon).toLocaleString('ko-KR')}만`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}
