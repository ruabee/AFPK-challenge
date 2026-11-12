// esbuild(vite에 포함)로 verify.ts를 묶어 Node에서 실행합니다. 별도 의존성이 필요 없습니다.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'verify-'));
const out = join(dir, 'verify.mjs');
try {
  await build({ entryPoints: ['scripts/verify.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
  await import(pathToFileURL(out).href);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
