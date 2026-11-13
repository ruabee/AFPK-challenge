# 포트폴리오 시뮬레이터

React + TypeScript + Recharts. 주식·채권 역사적 수익률을 부트스트랩하는 Monte Carlo(10,000회) 시뮬레이터.

## 실행
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## 구조
```
src/
  types.ts                      공용 타입 (금액 단위: 만원, 비중: %)
  data/marketData.ts            시장 데이터. 현재는 비어 있음 → 여기만 교체
  engine/simulationEngine.ts    순수 계산 로직 (React 의존 없음, dataset을 인자로 받음)
  hooks/useSimulation.ts        엔진 호출과 상태 관리
  components/                   InputForm, ResultSummary, ProjectionChart, DepletionPanel
  utils/format.ts               금액·퍼센트 표시
```

## 실제 데이터 연결
`src/data/marketData.ts`의 `returns` 배열에 `{ year, stock, bond }`(연 수익률, 소수) 를 채우거나
`getMarketDataset()`가 CSV/API에서 읽어 오도록 바꾸세요. `returnType`(명목/실질)도 함께 맞춰 주세요.
엔진과 UI는 수정할 필요가 없습니다.

## 계산 가정
- 매년 초 적립/인출 → 그해 수익률 적용, 매년 목표 비중으로 리밸런싱
- 역사적 연수익률을 복원추출 (연도 간 독립)
- 자산이 0 이하가 되면 고갈로 보고 이후 0으로 유지
