import { useCallback, useState } from 'react';
import { runSimulation } from '../engine/simulationEngine';
import type { MarketDataset, SimulationInput, SimulationResult } from '../types';

export function useSimulation(dataset: MarketDataset) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (input: SimulationInput) => {
      setRunning(true);
      setError(null);
      // 로딩 상태가 먼저 그려지도록 한 틱 양보한다.
      await new Promise((resolve) => setTimeout(resolve, 30));
      try {
        setResult(runSimulation(input, dataset));
      } catch (e) {
        setError(e instanceof Error ? e.message : '시뮬레이션 중 오류가 발생했습니다.');
      } finally {
        setRunning(false);
      }
    },
    [dataset],
  );

  return { result, running, error, run };
}
