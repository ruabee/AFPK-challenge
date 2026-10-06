const $ = (s) => document.querySelector(s);
let comparison = false;

export function settings() {
  return {
    initial: Math.max(0, Math.min(1000000, Number($("#initial").value) || 0)),
    monthly: Number($("#monthly").value),
    years: Number($("#years").value),
    rate: Number($("#rate").value),
  };
}
export function calculate(s) {
  let value = s.initial;
  const points = [value];
  for (let month = 1; month <= s.years * 12; month++) {
    value = value * (1 + s.rate / 1200) + s.monthly;
    if (month % 12 === 0) points.push(value);
  }
  return { value, principal: s.initial + s.monthly * s.years * 12, points };
}
export const money = (n) => Math.round(n).toLocaleString("ko-KR") + "만 원";
function update() {
  const s = settings(),
    r = calculate(s);
  for (const key of ["monthly", "years", "rate"])
    $("#" + key + "Out").textContent = s[key];
  $("#yearsLabel").textContent = s.years;
  $("#endYear").textContent = s.years + "년 뒤";
  $("#resultValue").innerHTML =
    Math.round(r.value).toLocaleString("ko-KR") + "<small>만 원</small>";
  $("#principal").textContent = money(r.principal);
  $("#profit").textContent = money(r.value - r.principal);
  $("#gain").textContent = r.principal
    ? (((r.value - r.principal) / r.principal) * 100).toFixed(1) + "%"
    : "—";
  const max = Math.max(...r.points, r.principal, 1) * 1.1;
  const path = (points) =>
    points
      .map(
        (v, i) =>
          (i ? "L" : "M") +
          ((i / (points.length - 1)) * 320).toFixed(2) +
          " " +
          (118 - (v / max) * 108).toFixed(2),
      )
      .join(" ");
  const line = path(r.points);
  $("#growthPath").setAttribute("d", line);
  $("#areaPath").setAttribute("d", line + " L320 125 L0 125 Z");
  $("#principalPath").setAttribute(
    "d",
    path(r.points.map((_, i) => s.initial + s.monthly * i * 12)),
  );
  $("#chart").setAttribute(
    "aria-label",
    s.years +
      "년 후 예상 평가액 " +
      money(r.value) +
      ", 납입 원금 " +
      money(r.principal),
  );
  if (comparison) renderComparison();
}
function renderComparison() {
  const s = settings();
  $("#comparison").innerHTML =
    '<div class="sim-description">수익률 가정만 바꾼 비교 · 예측 확률이 아닙니다.</div>' +
    [-2, 3, 7]
      .map(
        (rate) =>
          '<div class="compare-row"><span>연 ' +
          rate +
          "% 가정</span><strong>" +
          money(calculate({ ...s, rate }).value) +
          "</strong></div>",
      )
      .join("");
}
function showSim() {
  const panel = $("#simPanel");
  panel.classList.add("mobile-open");
  panel.classList.remove("pulse");
  void panel.offsetWidth;
  panel.classList.add("pulse");
  if (innerWidth < 981) panel.scrollIntoView({ behavior: "smooth" });
  $("#monthly").focus({ preventScroll: true });
}
function setComparison(enabled) {
  comparison = enabled;
  $("#comparison").hidden = !enabled;
  $("#compareTab").classList.toggle("active", enabled);
  $("#basicTab").classList.toggle("active", !enabled);
  if (enabled) renderComparison();
}
for (const id of ["initial", "monthly", "years", "rate"])
  $("#" + id).addEventListener("input", update);
$("#resetSim").onclick = () => {
  $("#initial").value = 0;
  $("#monthly").value = 50;
  $("#years").value = 10;
  $("#rate").value = 5;
  update();
};
$("#compareTab").onclick = () => setComparison(true);
$("#basicTab").onclick = () => setComparison(false);
$("#compareButton").onclick = () => {
  setComparison(true);
  showSim();
};
for (const id of ["simNav", "mobileSim"]) $("#" + id).onclick = showSim;

update();
