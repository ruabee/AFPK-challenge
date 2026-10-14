// 새로고침 시 초기화되는 탭 메모리. localStorage·서버 DB에는 저장하지 않습니다.
let profile = { version: 1, facts: {}, stage: 1, stageEvidence: null };
const stages = [
  "관계정립",
  "정보 수집",
  "분석·평가",
  "제안",
  "실행 지원",
  "재평가",
];
const labels = {
  goals: "재무목표",
  assets: "자산",
  debts: "부채",
  pensions: "연금",
  insurance: "보험",
  assumptions: "계산 가정",
  actions: "실행계획",
  name: "이름",
  amount: "금액",
  targetAmount: "목표금액",
  currentAmount: "현재금액",
  months: "기간",
  priority: "우선순위",
  liquid: "유동성",
  annualRate: "연율",
  monthlyPayment: "월 상환액",
  endDate: "종료일",
  monthlyAmount: "예상 월 수령액",
  startAge: "개시나이",
  endAge: "설계 종료나이",
  annualGrowth: "연 증가율",
  monthlyPremium: "월 보험료",
  coverage: "보장 내용",
  beforeReturn: "은퇴 전 연 수익률",
  afterReturn: "은퇴 후 연 수익률",
  inflation: "연 물가상승률",
  task: "할 일",
  status: "진행 상태",
  dueDate: "예정일",
  monthlyIncome: "월 실수령액",
  monthlyLivingExpenses: "월 생활비(저축·대출상환 제외)",
  monthlyDebtPayments: "월 대출상환액",
  annualIrregularExpenses: "연 비정기지출",
  monthlySavings: "월 저축액",
  totalAssets: "총자산",
  totalDebts: "총부채",
  emergencyFunds: "즉시 사용 가능한 비상자금",
  monthlyEssentialExpenses: "월 필수지출(필수 대출상환 포함)",
  currentAge: "현재나이",
  retirementAge: "은퇴나이",
  retirementAssets: "은퇴용 현재자산",
  monthlyExpenseToday: "현재 구매력 기준 은퇴 월생활비",
  monthlyRetirementSaving: "은퇴 전 월 적립액",
  otherMonthlyIncome: "은퇴 후 기타 월소득",
  riskTolerance: "손실 감내 수준",
  scope: "상담 범위",
  consent: "상담 동의",
  reviewDate: "재평가 예정일",
  pensionStatus: "연금 유무",
  insuranceStatus: "보험 유무",
  assetStatus: "자산 유무",
  debtStatus: "부채 유무",
  goal: "주요 재무목표",
};
function label(path) {
  return path
    .split(".")
    .map((x) => labels[x] || x)
    .join(" · ");
}
export function getProfile() {
  return profile;
}
export function resetProfile() {
  profile = { version: 1, facts: {}, stage: 1, stageEvidence: null };
  renderStage();
}
export function acceptPlanning(data) {
  if (data.customerProfile) profile = data.customerProfile;
  renderStage();
}
function renderStage() {
  let strip = document.getElementById("planningStage");
  if (!strip) {
    strip = document.createElement("div");
    strip.id = "planningStage";
    strip.className = "planning-stage";
    document.getElementById("messages").before(strip);
  }
  strip.textContent = `재무설계 ${profile.stage}/6 · ${stages[profile.stage - 1]} · 확인한 정보 ${Object.keys(profile.facts).length}개`;
}
export function showProfile() {
  const modal = document.getElementById("modal"),
    body = document.getElementById("modalBody");
  document.getElementById("modalTitle").textContent = "확인한 재무정보";
  body.replaceChildren();
  const note = document.createElement("p");
  note.textContent =
    "현재 탭에서만 유지됩니다. 금액은 원 단위입니다. 아래 버튼에서 수정하거나 대화에서 정정해주세요. 새 상담·새로고침 시 초기화됩니다.";
  body.append(note);
  for (const [key, fact] of Object.entries(profile.facts)) {
    const item = document.createElement("div");
    item.className = "profile-fact";
    const title = document.createElement("strong");
    title.textContent = label(key);
    const value = document.createElement("p");
    value.textContent = `${typeof fact.value === "number" ? fact.value.toLocaleString("ko-KR") : fact.value} ${fact.unit === "KRW" ? "원" : fact.unit === "percent" ? "%" : fact.unit === "age" ? "세" : fact.unit === "months" ? "개월" : ""}`;
    const evidence = document.createElement("small");
    evidence.textContent = "입력 근거: " + fact.quote;
    item.append(title, value, evidence);
    body.append(item);
  }
  if (!Object.keys(profile.facts).length) {
    const empty = document.createElement("p");
    empty.textContent =
      "아직 확인한 정보가 없습니다. 목표와 현재 상황을 대화로 알려주세요.";
    body.append(empty);
  }
  const edit = document.createElement("button");
  edit.className = "intake-primary";
  edit.textContent = "기본 재무정보 입력·수정";
  edit.onclick = () => { modal.close(); showIntake(); };
  body.prepend(edit);
  modal.showModal();
}
export function appendEvidence(container, data) {
  if (data.sources?.length) {
    const details = document.createElement("details"),
      summary = document.createElement("summary");
    summary.textContent = "참고한 공식 자료 · " + data.sources.length + "건";
    details.append(summary);
    for (const s of data.sources) {
      const p = document.createElement("p"),
        a = document.createElement("a");
      try {
        const url = new URL(s.url);
        if (url.protocol !== "https:") continue;
        a.href = url.href;
      } catch {
        continue;
      }
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `[${s.id}] ${s.title}`;
      p.append(
        a,
        document.createTextNode(
          ` · ${s.publisher} · 위치 ${s.page} · 검색 기준 ${s.searchedAsOf || data.rag?.asOf || "미확인"} · 검색 허용 ${s.effectiveFrom}~${s.effectiveTo} · 검수 ${s.reviewedAt}\n적용 대상: ${s.appliesTo}`,
        ),
      );
      details.append(p);
    }
    container.append(details);
  }
  if (data.calculations?.length) {
    const details = document.createElement("details"),
      summary = document.createElement("summary");
    summary.textContent = "계산 입력·결과 확인";
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(data.calculations, null, 2);
    details.append(summary, pre);
    container.append(details);
  }
  const status = document.createElement("small");
  status.className = "validation-note";
  status.textContent = data.sources?.length
    ? "답변에 인용한 자료 · 아래 출처에서 원문과 확인일을 볼 수 있습니다."
    : "일반 안내 · 이 답변에는 등록된 공식 자료의 인용이 없습니다.";
  container.append(status);
}
export function setupPlanning() {
  renderStage();
  document.querySelector(".disclaimer").textContent =
    "대화는 Anthropic으로 전송됩니다. 공식 자료가 없는 주제는 규정을 단정하지 않습니다.";
}

let sendIntake;
const intakeFields = [
  ["goal", "재무목표 (여러 목표를 함께 적어도 돼요)", "text"],
  ["currentAge", "현재 나이", "age"],
  ["monthlyIncome", "월 세후 소득", "KRW"],
  ["monthlyLivingExpenses", "월 생활비 (저축·대출상환 제외)", "KRW"],
  ["monthlyDebtPayments", "월 대출상환액", "KRW"],
  ["monthlySavings", "월 저축액", "KRW"],
  ["totalAssets", "총자산", "KRW"],
  ["totalDebts", "총부채", "KRW"],
];
export function showIntake() {
  const modal = document.getElementById("modal");
  const body = document.getElementById("modalBody");
  document.getElementById("modalTitle").textContent = "나의 상황부터, 편하게 알려주세요";
  body.replaceChildren();
  const note = document.createElement("p");
  note.textContent = "모르는 항목은 비워두세요. 빈칸은 새 정보로 보내지 않으며, 기존 정보도 지우지 않습니다. 금액은 만원 단위입니다. 예를 들어 월 소득 200만원은 200을 입력하세요. 0도 직접 입력할 수 있어요. 전송한 내용은 상담을 위해 Anthropic에 전달되며 현재 탭에서만 유지됩니다.";
  body.append(note);
  const form = document.createElement("form");
  form.className = "intake-form";
  const inputs = [];
  for (const [key, title, unit] of intakeFields) {
    const label = document.createElement("label");
    label.textContent = title + (unit === "KRW" ? " (만원)" : unit === "age" ? " (세)" : "");
    const input = document.createElement("input");
    input.type = unit === "text" ? "text" : "number";
    input.maxLength = 300;
    if (unit !== "text") { input.min = "0"; input.max = unit === "age" ? "120" : "100000000000"; input.step = unit === "KRW" ? "0.0001" : "1"; }
    const saved = profile.facts[key]?.value;
    input.value = saved == null ? "" : unit === "KRW" ? saved / 10000 : saved;
    input.placeholder = "모름 / 건너뛰기";
    label.append(input); form.append(label); inputs.push({key,title,unit,input});
  }
  const scope = document.createElement("label"); scope.textContent = "금액의 기준";
  const select = document.createElement("select");
  for (const value of ["선택해주세요", "본인 기준", "가구 전체 기준"]) { const option = document.createElement("option"); option.textContent = value; select.append(option); }
  scope.append(select); form.append(scope);
  const family = document.createElement("label"); family.textContent = "가구 구성 (선택)";
  const familyInput = document.createElement("input"); familyInput.maxLength = 200; familyInput.placeholder = "예: 배우자와 자녀 1명"; family.append(familyInput); form.append(family);
  const error = document.createElement("p"); error.setAttribute("role", "alert"); form.append(error);
  const submit = document.createElement("button"); submit.type = "submit"; submit.className = "intake-primary"; submit.textContent = "이 정보로 상담하기";
  form.append(submit);
  form.onsubmit = (event) => {
    event.preventDefault();
    const filled = inputs.filter(x => x.input.value.trim() !== "");
    if (!filled.length && !familyInput.value.trim()) { error.textContent = "알려주실 정보를 입력하거나 바로 대화하기를 선택해주세요."; return; }
    if (filled.some(x => x.unit === "KRW") && select.selectedIndex === 0) { error.textContent = "금액이 본인 기준인지 가구 전체 기준인지 선택해주세요."; return; }
    const lines = filled.map(x => `${x.title}: ${x.unit === "KRW" ? Math.round(Number(x.input.value) * 10000) : x.input.value.trim()}${x.unit === "KRW" ? "원" : x.unit === "age" ? "세" : ""}`);
    if (select.selectedIndex) lines.push("입력 금액 기준: " + select.value);
    if (familyInput.value.trim()) lines.push("가구 구성: " + familyInput.value.trim());
    const text = "제가 입력·수정한 재무정보입니다. 이번 입력을 우선 반영해주세요. 빈칸은 미제공이며 기존 정보 삭제나 0원을 뜻하지 않습니다.\n" + lines.join("\n") + "\n필요한 정보만 추가로 질문하며 재무계획을 함께 검토해주세요.";
    if (sendIntake(text) !== false) modal.close();
    else error.textContent = "진행 중인 요청을 마친 뒤 다시 전송해주세요.";
  };
  body.append(form);
  const skip = document.createElement("button"); skip.textContent = "바로 대화하기"; skip.className = "retry"; skip.onclick = () => { modal.close(); document.getElementById("prompt").focus(); }; body.append(skip);
  if (!modal.open) modal.showModal();
}
export function setupIntake(sender) {
  sendIntake = sender;
  const panel = document.createElement("section"); panel.className = "intake-banner";
  const text = document.createElement("span"); text.textContent = "아는 만큼만 입력하고, 나머지는 대화로 함께 정리해요.";
  const button = document.createElement("button"); button.textContent = "기본정보 입력·수정"; button.onclick = showIntake;
  panel.append(text, button); document.getElementById("planningStage").after(panel);
  showIntake();
}
