# AskYES

> 나의 재무 고민에 답하는 AI 재무설계 파트너

**재무 고민은 YES에게 물어보세요.** 팀명 **YES**는 **Y(onsei) + E(wha) + S(ungshin)**을 뜻합니다. 챗봇 YES와의 대화가 중심이며, 투자 시뮬레이터는 재무계획 검토를 돕습니다.

챗봇과 재무계획을 검토하고, 투자 시뮬레이터로 조건별 예상 금액을 비교하는 로컬 개발 프로젝트입니다.

## 폴더 구성

```text
AFPK-challenge/
├── FE/                      화면
│   ├── 화면.html            화면 구성
│   ├── 디자인.css           색상·배치·모바일 스타일
│   ├── 대화.js              대화 전송·로딩·오류 처리
│   └── 투자시뮬레이터.js    투자 계산·그래프·시나리오 비교
├── BE/                      서버
│   ├── 서버.mjs             실행 시작점·API 경로·화면 파일 제공
│   ├── 환경설정.mjs         .env 읽기·포트·모델 설정
│   └── 요청검증.mjs         대화 검증·투자 결과 재계산
├── AI/                      인공지능
│   ├── 클로드연결.mjs       Claude 호출·오류 안내
│   └── 상담지침.md          재무설계 챗봇의 답변 기준
├── 테스트/
│   └── 서버.test.mjs        계산·API·보안 동작 검증
├── .env                     실제 API 키 (Git 제외)
├── .env.example             키 없이 공유하는 설정 예시
├── .gitignore               Git 제외 목록
├── package.json             실행 명령어
└── README.md                프로젝트 안내
```

`package.json`, `README.md`, `.env` 등 표준 파일명은 유지합니다. 파일명은 한국어로 정리하고 코드의 함수·변수 이름은 일반적인 개발 관례를 유지합니다.

## 실행

Node.js **22.16 이상**이 필요합니다. 추가 패키지 설치는 필요 없습니다.

1. 처음 내려받았다면 `.env.example`을 `.env`로 복사합니다. **이미 `.env`가 있으면 덮어쓰지 마세요.**
2. `.env`의 `ANTHROPIC_API_KEY`에 Anthropic Console에서 발급한 키를 입력합니다.
3. 프로젝트 최상위 폴더에서 실행합니다.

```bash
npm start
```

화면: http://127.0.0.1:4174/

```bash
npm run dev  # 서버 코드 변경 시 자동 재시작
npm test     # 모의 API 테스트 (실제 API 호출 없음)
```

## 설정

| 항목 | 설명 |
| --- | --- |
| `ANTHROPIC_API_KEY` | 실제 API 키. GitHub에 올리지 않습니다. |
| `ANTHROPIC_MODEL` | 기본 모델 `claude-sonnet-4-6` |
| `ANTHROPIC_WORKSPACE_ID` | 워크스페이스 지정이 필요한 키에만 입력 |
| `PORT` | 기본 포트 `4174` |

키·모델·워크스페이스 ID는 요청마다 다시 읽습니다. 포트나 상담지침을 수정했다면 서버를 재시작하세요.

## 수정할 곳

- 화면·색상: `FE/화면.html`, `FE/디자인.css`
- 채팅 전송·오류 처리: `FE/대화.js`
- 투자 계산·그래프: `FE/투자시뮬레이터.js`
- API 경로·서버 동작: `BE/서버.mjs`
- 입력 검증·서버 계산: `BE/요청검증.mjs`
- 챗봇 말투·상담 기준: `AI/상담지침.md`
- Claude 요청·오류 처리: `AI/클로드연결.mjs`

브라우저 요청 경로 `/app.js`, `/simulator.js`, `/style.css`는 서버가 한국어 파일명으로 매핑합니다. HTML을 직접 열지 말고 `npm start`로 실행하세요. FE 계산을 수정하면 BE 재계산과의 일치도 확인해야 합니다.

## 구현 범위

- Claude 실제 대화, 현재 탭의 대화 맥락, 오류 재시도
- 투자금·기간·수익률 조절, 시나리오 비교, 계산 조건을 대화로 전달
- API 키 서버 보관, 입력·요청 출처 검증, 허용된 화면 파일만 제공
- **미구현:** RAG·웹 검색·파일 분석·프로필 저장·로그인·대화 영구 저장

대화와 연결한 투자 조건은 Anthropic API로 전송되며 호출에 사용료가 발생할 수 있습니다. 대화는 새로고침 또는 새 대화에서 초기화됩니다. 최대 20회 왕복, 요청당 출력 1,800토큰, 60초 타임아웃입니다.

투자 계산은 월말 납입, 연 수익률 ÷ 12 월 복리입니다. 세금·수수료·물가는 반영하지 않으며 예상 수익을 보장하지 않습니다.

이 서버는 `127.0.0.1`에서 실행하는 로컬 개발용입니다. 외부 공개용 사용자 인증은 포함하지 않습니다.

## GitHub에 올리기

`.env`는 제외하고 `.env.example`만 공유합니다. 파일을 올리기 전에 `git status --short`로 변경 목록을 확인하세요.

```bash
git add FE BE AI 테스트 package.json README.md .env.example .gitignore
git commit -m "재무설계 챗봇과 투자 시뮬레이터 구성"
git push -u origin junhee
```

API 문서: https://platform.claude.com/docs/en/api/messages/create
