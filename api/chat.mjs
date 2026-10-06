// Vercel이 인식하는 API 진입점. 실제 구현은 BE·AI에서 관리합니다.
import { makeHandler } from '../BE/서버.mjs';

const allowedOrigins = [
  'https://askyes.vercel.app',
  process.env.APP_ORIGIN,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
].filter(Boolean);

export default makeHandler({ deployed: true, allowedOrigins });
