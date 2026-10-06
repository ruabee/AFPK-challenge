import { settings, calculate, money } from "./simulator.js";

const $ = (s) => document.querySelector(s);
let turns = 0;
let history = [],
  pending = null,
  busy = false,
  simulationContext = null;
function addMessage(text, user = false) {
  const row = document.createElement("div");
  row.className = user ? "user-message" : "assistant-message";
  if (!user) {
    const icon = document.createElement("div");
    icon.className = "message-icon";
    icon.textContent = "✳";
    row.append(icon);
  }
  const content = document.createElement("div");
  content.className = user ? "user-bubble" : "answer";
  let p;
  if (user) {
    content.textContent = text;
  } else {
    const sender = document.createElement("div");
    sender.className = "sender";
    sender.textContent = "YES · AskYES";
    p = document.createElement("p");
    p.style.whiteSpace = "pre-wrap";
    p.textContent = text;
    content.append(sender, p);
  }
  row.append(content);
  $("#messages").append(row);
  $("#messages").scrollTop = $("#messages").scrollHeight;
  return { row, content, p };
}
function setBusy(value) {
  busy = value;
  $("#chatForm").setAttribute("aria-busy", String(value));
  document
    .querySelectorAll("#chatForm button,#newChat,#sendSim,[data-topic]")
    .forEach((b) => (b.disabled = value));
  $("#prompt").disabled = value;
}
function setStatus(text) {
  $("#connectionStatus").textContent = text;
}
async function checkConnection() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error();
    const data = await response.json();
    setStatus(data.configured ? "Claude API · 키 설정됨" : "API 키 설정 필요");
  } catch {
    setStatus("API 서버 연결 필요");
  }
}
async function runPending() {
  if (busy || !pending) return;
  setBusy(true);
  const current = pending;
  const loading = addMessage("답변을 생각하고 있어요…");
  loading.row.classList.add("loading");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [...history, { role: "user", content: current.text }],
        simulation: current.simulation,
      }),
      signal: AbortSignal.timeout(65000),
    });
    const data = await response
      .json()
      .catch(() => ({
        error: "API 응답을 확인할 수 없습니다. 배포 상태를 확인해주세요.",
      }));
    if (!response.ok || typeof data.reply !== "string")
      throw new Error(data.error || "답변을 받지 못했습니다.");
    loading.p.textContent =
      data.reply +
      (data.truncated
        ? "\n\n[응답 길이 제한으로 일부 내용이 생략되었습니다. 이어서 질문해주세요.]"
        : "");
    history.push(
      { role: "user", content: current.text },
      { role: "assistant", content: data.reply },
    );
    turns++;
    pending = null;
    setStatus("Claude API · 연결 확인");
  } catch (error) {
    loading.row.classList.add("request-error");
    loading.p.textContent =
      error.name === "TimeoutError"
        ? "답변 시간이 초과되었습니다. 다시 시도해주세요."
        : error instanceof TypeError
          ? "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요."
          : error.message;
    const retry = document.createElement("button");
    retry.className = "retry";
    retry.textContent = "다시 시도";
    retry.onclick = () => {
      if (busy || pending !== current) return;
      loading.row.remove();
      runPending();
    };
    loading.content.append(retry);
    const edit = document.createElement("button");
    edit.className = "retry";
    edit.textContent = "질문 수정";
    edit.onclick = () => {
      if (busy || pending !== current) return;
      current.row.remove();
      loading.row.remove();
      $("#prompt").value = current.text;
      pending = null;
      $("#prompt").focus();
    };
    loading.content.append(edit);
    setStatus("연결 오류 · 다시 시도 가능");
  } finally {
    loading.row.classList.remove("loading");
    setBusy(false);
    $("#messages").scrollTop = $("#messages").scrollHeight;
    $("#prompt").focus({ preventScroll: true });
  }
}
function send(text, simulation = simulationContext) {
  text = text.trim();
  if (!text || busy) return;
  if (pending) {
    modal(
      "이전 질문을 확인해주세요",
      "이전 요청이 실패했습니다. 답변 아래에서 다시 시도하거나 질문을 수정해주세요. 새 대화를 시작할 수도 있습니다.",
    );
    return;
  }
  if (history.length >= 40) {
    modal(
      "새 대화를 시작해주세요",
      "대화 맥락은 최대 20회까지 유지됩니다. 새 대화에서 검토할 내용을 정리해 이어가주세요.",
    );
    return;
  }
  if (text.length > 12000) {
    modal("질문이 너무 깁니다", "질문은 12,000자 이내로 나누어 보내주세요.");
    return;
  }
  const message = addMessage(text, true);
  pending = {
    text,
    simulation: simulation ? { ...simulation } : null,
    row: message.row,
  };
  $("#prompt").value = "";
  runPending();
}
$("#chatForm").onsubmit = (e) => {
  e.preventDefault();
  send($("#prompt").value);
};
$("#prompt").onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send($("#prompt").value);
  }
};
document
  .querySelectorAll("[data-topic]")
  .forEach((b) => (b.onclick = () => send(b.dataset.topic)));
$("#sendSim").onclick = () => {
  if (busy || pending) return;
  const s = settings();
  simulationContext = { ...s };
  send(
    `초기 ${money(s.initial)}, 매월 ${money(s.monthly)}, ${s.years}년, 연 ${s.rate}% 가정으로 이 투자 계획을 검토하고 싶어요.`,
    s,
  );
  if (innerWidth < 981) $(".chat-panel").scrollIntoView({ behavior: "smooth" });
};
$("#newChat").onclick = () => {
  if (busy) return;
  $("#messages").innerHTML = "";
  turns = 0;
  history = [];
  pending = null;
  simulationContext = null;
  addMessage(
    "어떤 재무계획을 함께 살펴볼까요? 목표, 현재 상황, 상담받은 내용을 편하게 적어주세요.",
  );
  $("#prompt").value = "";
  $("#fileInput").value = "";
  $("#attachment").hidden = true;
  $("#prompt").focus();
};
$("#chatNav").onclick = () => {
  $(".chat-panel").scrollIntoView({ behavior: "smooth" });
  $("#prompt").focus({ preventScroll: true });
};
function modal(title, body) {
  $("#modalTitle").textContent = title;
  $("#modalBody").textContent = body;
  $("#modal").showModal();
}
$("#closeModal").onclick = () => $("#modal").close();
$("#profileButton").onclick = () =>
  modal(
    "나의 재무 프로필",
    "재무 프로필에는 월 소득, 고정 지출, 자산·부채, 비상자금, 목표 시점을 담을 예정입니다. 현재 화면의 대화와 금액은 예시 데이터입니다.",
  );
$("#reportButton").onclick = () => {
  const s = settings(),
    r = calculate(s);
  modal(
    "대화 요약",
    `이번에 보낸 메시지 ${turns}건. 현재 시뮬레이션: 초기 ${money(s.initial)}, 월 ${money(s.monthly)}, ${s.years}년, 연 ${s.rate}% 가정. 예상 평가액 ${money(r.value)}. 현재 탭의 대화 기록만 유지됩니다. 새로고침하면 초기화됩니다.`,
  );
};
$("#moreButton").onclick = () =>
  modal(
    "AskYES · 팀 YES",
    "나의 재무 고민에 답하는 AI 재무설계 파트너, AskYES.\n\n팀 YES는 Y(onsei) + E(wha) + S(ungshin)을 뜻합니다.\n\n대화와 연결한 시뮬레이션 조건을 Anthropic Claude API로 전달합니다. RAG·웹 검색·파일 분석은 아직 연결하지 않았습니다. 입력 데이터는 현재 탭에서만 유지되며 새로고침하면 초기화됩니다.",
  );
$("#attachButton").onclick = () =>
  modal(
    "상담자료 분석 준비 중",
    "파일 업로드·분석은 아직 연결되지 않았습니다. 검토할 내용을 개인정보를 제외한 텍스트로 대화에 입력해주세요.",
  );
$("#fileInput").onchange = () => {
  const file = $("#fileInput").files[0];
  if (file) {
    $("#attachment").hidden = false;
    $("#attachment").textContent =
      "선택한 자료: " + file.name + " · 업로드·분석 미연결";
  }
};

$("#messages").innerHTML = "";
addMessage(
  "안녕하세요. AskYES의 AI 재무설계 파트너 YES입니다.\n\n직접 세운 계획이나 상담받은 내용에서 어떤 점이 고민되시나요? 투자 예상 금액은 옆 시뮬레이터에서 확인하고 대화로 가져올 수 있어요.",
);
checkConnection();
