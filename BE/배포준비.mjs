import { mkdir, copyFile } from 'node:fs/promises';

// 공개 화면만 복사합니다. .env·BE·AI 파일은 웹 배포 폴더에 넣지 않습니다.
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/', root), { recursive: true });
for (const [source, target] of [
  ['화면.html', 'index.html'],
  ['디자인.css', 'style.css'],
  ['대화.js', 'app.js'],
  ['투자시뮬레이터.js', 'simulator.js'],
]) await copyFile(new URL(`FE/${source}`, root), new URL(`public/${target}`, root));
console.log('AskYES 배포용 화면 준비 완료');
