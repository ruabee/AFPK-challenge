import { cp, mkdir } from 'node:fs/promises';
const root = new URL('../',import.meta.url);
await mkdir(new URL('FE/portfolio/',root),{recursive:true});
await cp(new URL('portfolio-simulator/dist/',root),new URL('FE/portfolio/',root),{recursive:true});
console.log('새 포트폴리오 시뮬레이터 빌드 반영 완료');
