/** 입력·표시 단위는 모두 만원으로 통일합니다 (예: 12,345만원). 표와 그래프가 같은 함수를 써서 숫자가 일치합니다. */
export function formatKRW(manwon: number): string {
  return `${Math.round(manwon).toLocaleString('ko-KR')}만원`;
}

/** 그래프 축 눈금. 단위(만원)는 그래프 제목에 표시합니다. */
export function formatAxis(manwon: number): string {
  return Math.round(manwon).toLocaleString('ko-KR');
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}

export function formatWeights(stockWeight: number, bondWeight: number): string {
  return `주식 ${stockWeight} · 채권 ${bondWeight}`;
}
