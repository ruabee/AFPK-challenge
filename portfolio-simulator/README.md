# 포트폴리오 시뮬레이터

주식·채권 역사적 수익률(NYU Stern / Damodaran, 1928~2025)을 10,000번 다시 뽑아, **매월 적립한 자산**이 앞으로 어디까지 갈 수 있는지 P10·P50·P90 범위로 보여주는 몬테카를로 시뮬레이터입니다. React + TypeScript + Vite + Recharts로 만들었습니다.

- 전략 A(주식 20/채권 80), B(40/60), C(60/40)와 사용자 지정 비중을 **같은 시장 시나리오**로 동시 비교
- 월말 납입, 월 복리 환산, 연 1회 리밸런싱, 원금손실 확률(명목·실질), 물가상승률 반영(기본 연 2%)
- 난수 시드 입력 시 같은 결과 재현

---

## 1. 내 컴퓨터(Windows)에서 실행하기

### 준비물 (처음 한 번만)
1. **Node.js LTS** 설치: https://nodejs.org 에서 LTS 버전(18.18 이상, 20 또는 22 권장)을 받아 설치합니다.
2. PowerShell을 새로 열고 확인합니다.
   ```powershell
   node -v
   npm -v
   ```
   버전 숫자가 나오면 준비 완료입니다.

### 실행
ZIP을 풀면 `portfolio-simulator` 폴더가 나옵니다. 그 폴더 안에서 PowerShell을 엽니다
(폴더 빈 곳에서 **Shift + 마우스 오른쪽 클릭 → "여기에 PowerShell 창 열기"** 또는 "터미널에서 열기").

```powershell
cd portfolio-simulator      # 이미 폴더 안이라면 생략
npm install
npm run dev
```

터미널에 `http://localhost:5173` 이 표시되면 브라우저에서 그 주소를 엽니다. 종료는 `Ctrl + C` 입니다.

### 기타 명령어
```powershell
npm run build      # 배포용 파일을 dist 폴더에 생성 (타입 검사 포함)
npm run preview    # 빌드 결과를 로컬에서 미리 보기 (http://localhost:4173)
npm run typecheck  # TypeScript 타입 검사만 실행
npm run verify     # 계산 검증 (해석해 비교, 시드 재현, P10≤P50≤P90, 물가 0% 일치 등)
```

### 자주 나는 오류
| 증상 | 해결 |
| --- | --- |
| `npm : 이 시스템에서 스크립트를 실행할 수 없으므로 ... npm.ps1 ...` | PowerShell에서 한 번 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 실행 후 재시도. 또는 `npm.cmd install`, `npm.cmd run dev` 로 실행 |
| `node` 또는 `npm`을 찾을 수 없음 | Node.js 설치 후 **PowerShell을 완전히 닫고 다시 열기** |
| `ENOENT: Could not read package.json` | `package.json`이 있는 `portfolio-simulator` 폴더 안에서 실행하고 있는지 확인 (`dir` 로 `package.json`이 보여야 함). ZIP을 풀 때 폴더가 한 겹 더 생겼다면 안쪽 폴더로 `cd` |
| `vite` 을(를) 찾을 수 없음 / `vite: command not found` | 먼저 `npm install` 을 실행했는지 확인 |
| 5173 포트가 이미 사용 중 | 다른 터미널의 `npm run dev` 를 `Ctrl + C` 로 종료하거나 Vite가 안내하는 다른 포트 주소를 사용 |

---

## 2. GitHub에 올리기

1. https://github.com 에서 새 저장소(New repository)를 만듭니다. 이름은 예: `portfolio-simulator`, **README/.gitignore 추가 옵션은 끄세요**(이미 포함돼 있습니다).
2. Git for Windows(https://git-scm.com)를 설치하지 않았다면 설치합니다.
3. `portfolio-simulator` 폴더에서 PowerShell로 실행합니다. (`<내계정>`을 본인 GitHub 아이디로 바꾸세요)

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<내계정>/portfolio-simulator.git
git push -u origin main
```

`.gitignore` 덕분에 `node_modules`, `dist`는 올라가지 않습니다. 처음 push 시 GitHub 로그인 창이 열리면 로그인하세요.

> 코드를 수정한 뒤에는 `git add .` → `git commit -m "수정 내용"` → `git push` 만 하면 Vercel이 자동으로 다시 배포합니다.

---

## 3. Vercel로 공개 웹사이트 배포하기

1. https://vercel.com 에 **GitHub 계정으로 가입/로그인**합니다.
2. **Add New… → Project** 를 누르고, 위에서 만든 `portfolio-simulator` 저장소를 **Import** 합니다.
3. 설정 화면에서 아래와 같이 되어 있는지 확인합니다. (프로젝트에 `vercel.json`이 있어 자동으로 채워집니다)

   | 항목 | 값 |
   | --- | --- |
   | Framework Preset | **Vite** |
   | Root Directory | `./` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |

4. **Deploy** 를 누릅니다. 1~2분 뒤 `https://<프로젝트이름>.vercel.app` 주소가 생깁니다.

### 배포 후 404 NOT_FOUND 가 뜬다면
- **Root Directory** 가 `./` 인지 확인하세요. 저장소 안에 `portfolio-simulator` 폴더가 한 겹 더 있게 올렸다면, Root Directory를 `portfolio-simulator` 로 지정하거나 `package.json`이 저장소 최상위에 오도록 다시 올려야 합니다.
- **Output Directory** 가 `dist` 인지 확인하세요.
- 설정을 고쳤다면 Deployments 탭에서 **Redeploy** 하세요.

---

## 4. 프로젝트 구조

```
portfolio-simulator/
├─ package.json / package-lock.json
├─ index.html · vite.config.ts · tsconfig.json · vercel.json
├─ .gitignore
├─ scripts/verify.ts, verify.mjs     계산 검증 (npm run verify)
└─ src/
   ├─ main.tsx · App.tsx · styles.css · types.ts · vite-env.d.ts
   ├─ data/marketData.ts              NYU Stern 1928~2025 주식·채권 연간 수익률과 데이터 검증
   ├─ engine/simulationEngine.ts      순수 계산 로직 (React 의존 없음)
   ├─ hooks/useSimulation.ts          엔진 호출과 상태 관리
   ├─ components/                     InputForm, ResultControls, ResultSummary, LossPanel,
   │                                  ProjectionChart, ComparisonTable
   └─ utils/format.ts                 금액(만원)·퍼센트 표시
```

## 5. 계산 가정
- 월 적립액은 매월 말 납입하는 고정 명목 금액. 총 납입 원금 = 초기 투자금 + 월 적립액 × 12 × 투자기간
- 매 가상 연도마다 역사적 연도 하나를 복원추출해 그 해의 (주식, 채권) 쌍을 함께 사용하며, 모든 전략이 같은 추출 경로를 공유
- 연 수익률은 월 수익률 `(1+r)^(1/12)-1` 로 바꿔 주식·채권에 각각 12개월 적용. 월 수익 반영 후 월말에 적립금을 목표 비중대로 납입하고, 연 1회(12월 말) 목표 비중으로 리밸런싱
- 실질 자산 = 명목 자산 ÷ (1+물가상승률)^경과연수. 실질 환산 납입 원금 = 초기 투자금 + Σ 월 적립액 ÷ (1+물가상승률)^(납입월/12)
- 원금손실 확률 = 만기 자산 < 납입 원금인 경로 수 ÷ 전체 경로 수 × 100 (명목·실질 구분)
- 수수료, 세금은 반영하지 않습니다. **과거 수익률은 미래 수익을 보장하지 않으며, 이 결과는 투자 권유가 아닙니다.**
