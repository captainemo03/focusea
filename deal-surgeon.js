const surgeonForm = document.querySelector("#dealSurgeonForm");
const surgeonDecision = document.querySelector("#surgeonDecision");
const surgeonDecisionNote = document.querySelector("#surgeonDecisionNote");
const commercialPulse = document.querySelector("#commercialPulse");
const legalHeat = document.querySelector("#legalHeat");
const opsMood = document.querySelector("#opsMood");
const claimPressure = document.querySelector("#claimPressure");
const lieDetectorResult = document.querySelector("#lieDetectorResult");
const dealDnaResult = document.querySelector("#dealDnaResult");
const whatIfResult = document.querySelector("#whatIfResult");
const negotiationCoachResult = document.querySelector("#negotiationCoachResult");
const cpHeatmapResult = document.querySelector("#cpHeatmapResult");
const disputeSimulatorResult = document.querySelector("#disputeSimulatorResult");
const portMoodResult = document.querySelector("#portMoodResult");
const cargoTroubleResult = document.querySelector("#cargoTroubleResult");
const timelineResult = document.querySelector("#timelineResult");
const blackBoxResult = document.querySelector("#blackBoxResult");
const doctorResult = document.querySelector("#doctorResult");
const recapPoliceResult = document.querySelector("#recapPoliceResult");
const portReadinessResult = document.querySelector("#portReadinessResult");
const clientBriefResult = document.querySelector("#clientBriefResult");
const careerModeResult = document.querySelector("#careerModeResult");
const surgeonExportStatus = document.querySelector("#surgeonExportStatus");
const downloadSurgeonTxt = document.querySelector("#downloadSurgeonTxt");
const downloadSurgeonClient = document.querySelector("#downloadSurgeonClient");
const downloadSurgeonReportTop = document.querySelector("#downloadSurgeonReportTop");
const copySurgeonBrief = document.querySelector("#copySurgeonBrief");

let lastSurgeonReport = null;

const cargoPlaybook = {
  Coal: {
    risk: 18,
    issues: ["self-heating", "moisture declaration", "rain stoppage proof", "hold cleanliness"],
    advice: "Ask for moisture/TML style evidence where relevant, rain letter discipline and clear hold inspection."
  },
  Grain: {
    risk: 16,
    issues: ["shifting", "fumigation", "shortage claim", "rain stoppage"],
    advice: "Protect fumigation, shifting boards/trimmed cargo evidence and clear weather interruption records."
  },
  "Iron ore": {
    risk: 24,
    issues: ["liquefaction", "tanktop stress", "high density loading", "draft margin"],
    advice: "Check IMSBC style moisture evidence, loading rate and tanktop/hold stress before accepting."
  },
  Containers: {
    risk: 14,
    issues: ["rollover delay", "reefer failure", "IMDG segregation", "terminal cut-off"],
    advice: "Protect cut-off, reefer monitoring, IMDG declaration and terminal connection terms."
  },
  "Crude oil": {
    risk: 28,
    issues: ["pollution exposure", "vetting", "pumping claim", "terminal compatibility"],
    advice: "Check vetting, pumping warranty, terminal acceptance and pollution liability wording."
  },
  LNG: {
    risk: 30,
    issues: ["boil-off", "terminal compatibility", "high value exposure", "weather routing"],
    advice: "Protect boil-off, custody transfer, terminal compatibility and delay allocation."
  },
  Chemicals: {
    risk: 34,
    issues: ["tank coating", "segregation", "MSDS", "pollution exposure"],
    advice: "Demand MSDS, coating compatibility, prior cargo history and segregation notes."
  },
  "Project cargo": {
    risk: 36,
    issues: ["lashing design", "heavy lift survey", "center of gravity", "cargo damage"],
    advice: "Require method statement, lifting plan, lashing survey and clear responsibility matrix."
  }
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function money(value, digits = 0) {
  return `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

function formValues() {
  return Object.fromEntries([...new FormData(surgeonForm).entries()].map(([key, value]) => {
    const numberValue = Number(value);
    return [key, value !== "" && Number.isFinite(numberValue) ? numberValue : value];
  }));
}

function has(text, pattern) {
  return new RegExp(pattern, "i").test(String(text || ""));
}

function riskTag(score) {
  if (score >= 72) return { label: "AVOID", className: "red" };
  if (score >= 48) return { label: "WATCH", className: "violet" };
  return { label: "FIX", className: "green" };
}

function detect(values) {
  const text = String(values.dealText || "");
  const cargo = cargoPlaybook[values.cargo] || cargoPlaybook.Coal;
  const revenue = Number(values.freight || 0) * Number(values.quantity || 0);
  const bunkerShock = Number(values.bunker || 0) * 34;
  const delayCost = Number(values.delay || 0) * Number(values.demurrage || 0);
  const laycanRisk = Number(values.laycan || 0) <= 4 ? 18 : Number(values.laycan || 0) <= 6 ? 9 : 2;
  const legalScore =
    (has(text, "wibon|wipon|time lost|reachable on arrival") ? 18 : 5) +
    (has(text, "nor") ? 8 : 16) +
    (has(text, "subject|subjects") ? 9 : 3) +
    (has(text, "demurrage") ? 4 : 14);
  const opsScore = cargo.risk + Number(values.delay || 0) * 7 + (has(text, "port delay|waiting|congestion") ? 14 : 0);
  const claimScore = (has(text, "rain|sof|nor|time bar|claim") ? 20 : 10) + legalScore * 0.55 + cargo.risk * 0.55;
  const counterpartyScore =
    values.counterparty === "Frequent claims" ? 22 :
    values.counterparty === "Slow payer" ? 16 :
    values.counterparty === "Unknown counterparty" ? 14 : 4;
  const commercialScore = clamp((bunkerShock + delayCost) / Math.max(revenue, 1) * 100 + laycanRisk + counterpartyScore, 0, 100);
  const totalScore = clamp(Math.round(commercialScore * 0.28 + legalScore * 0.22 + opsScore * 0.25 + claimScore * 0.25), 0, 100);
  const decision = riskTag(totalScore);
  return { text, cargo, revenue, bunkerShock, delayCost, laycanRisk, legalScore, opsScore, claimScore, counterpartyScore, commercialScore, totalScore, decision };
}

function finding(title, detail, severity = "WATCH") {
  const cls = severity === "AVOID" ? "red" : severity === "FIX" ? "green" : "violet";
  return `<div class="finding"><em class="risk-tag ${cls}">${severity}</em><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
}

function scoreBlock(title, score, detail) {
  return `<div class="dna-card"><strong>${escapeHtml(title)}: ${Math.round(score)}/100</strong><div class="score-bar"><span style="width:${clamp(score, 0, 100)}%"></span></div><span>${escapeHtml(detail)}</span></div>`;
}

function renderLieDetector(values, model) {
  const items = [];
  if (!has(model.text, "commission")) items.push(finding("Commission is missing", "Recap should state brokerage commission clearly before subjects are lifted.", "WATCH"));
  if (!has(model.text, "demurrage")) items.push(finding("Demurrage is not protected", "No clean demurrage rate was detected. Delay exposure may be hidden.", "AVOID"));
  if (has(model.text, "wibon|wipon|time lost")) items.push(finding("NOR wording is aggressive", "WIBON/WIPON or time-lost wording changes who carries berth waiting risk.", "WATCH"));
  if (Number(values.laycan) <= 4) items.push(finding("Laycan is tight", "Small laycan window gives less room for weather, bunkering and port congestion.", "WATCH"));
  if (Number(values.delay) > 1.5) items.push(finding("Port delay is priced into the deal", "Delay exposure is visible and should be reflected in freight or demurrage.", "WATCH"));
  if (!items.length) items.push(finding("No major hidden trap detected", "Main commercial terms look balanced for a first indication.", "FIX"));
  lieDetectorResult.innerHTML = items.join("");
}

function renderDealDna(values, model) {
  const personality =
    model.totalScore >= 72 ? "High profit / high claim exposure" :
    model.commercialScore < 35 && model.legalScore < 35 ? "Clean operational fixture" :
    model.legalScore > model.opsScore ? "Clause-heavy negotiation" :
    model.opsScore > model.legalScore ? "Ops-sensitive voyage" : "Balanced but watchable";
  dealDnaResult.innerHTML = [
    `<div class="dna-card"><strong>${escapeHtml(personality)}</strong><span>${escapeHtml(values.cargo)} from ${escapeHtml(values.loadPort)} to ${escapeHtml(values.dischargePort)}.</span></div>`,
    scoreBlock("Commercial pulse", model.commercialScore, "Freight versus bunker, delay and counterparty pressure."),
    scoreBlock("Legal heat", model.legalScore, "NOR, demurrage, subjects and waiting-time wording."),
    scoreBlock("Ops mood", model.opsScore, "Cargo nature, port delay and operational complexity.")
  ].join("");
}

function renderWhatIf(values, model) {
  const bunkerUp = model.bunkerShock + 30 * 34;
  const oneMoreDelay = model.delayCost + Number(values.demurrage || 0);
  const freightPlus = (Number(values.freight || 0) + 0.75) * Number(values.quantity || 0);
  whatIfResult.innerHTML = [
    scoreBlock("Bunker +30 USD/mt", (bunkerUp / Math.max(model.revenue, 1)) * 100, `Approx extra pressure: ${money(30 * 34)}.`),
    scoreBlock("One more port day", (oneMoreDelay / Math.max(model.revenue, 1)) * 100, `Extra demurrage exposure: ${money(values.demurrage)}.`),
    scoreBlock("Freight +0.75", 100 - model.commercialScore, `Revenue improves by ${money(freightPlus - model.revenue)}.`)
  ].join("");
}

function renderNegotiation(values, model) {
  const freightCounter = Number(values.freight || 0) + (model.totalScore >= 60 ? 1.1 : 0.55);
  const demurrageCounter = Number(values.demurrage || 0) * (model.claimScore >= 55 ? 1.18 : 1.08);
  negotiationCoachResult.innerHTML = [
    finding("Counter freight", `Try ${freightCounter.toFixed(2)} per unit because risk score is ${model.totalScore}/100.`, model.totalScore >= 72 ? "AVOID" : "WATCH"),
    finding("Counter demurrage", `Push demurrage toward ${money(demurrageCounter)} per day or shorten free risk exposure.`, "WATCH"),
    finding("Subject protection", "Ask for subject deadline extension plus receiver/shipper approval wording in writing.", "WATCH")
  ].join("");
}

function renderHeatmap(values, model) {
  const clauses = [
    ["NOR / WIBON / WIPON", has(model.text, "wibon|wipon|nor") ? 72 : 36, "Can shift waiting-time risk."],
    ["Demurrage wording", has(model.text, "demurrage") ? 42 : 78, "Rate, currency and trigger must be clear."],
    ["Subjects", has(model.text, "subject") ? 58 : 32, "Deadline and lifting method should be explicit."],
    ["Weather / rain", has(model.text, "rain|weather") ? 61 : 44, "Rain stoppages need evidence discipline."],
    ["Commission", has(model.text, "commission") ? 25 : 66, "Brokerage must be stated."]
  ];
  cpHeatmapResult.innerHTML = clauses.map(([name, score, note]) => scoreBlock(name, score, note)).join("");
}

function renderDispute(values, model) {
  disputeSimulatorResult.innerHTML = [
    finding("Owner argument", `Owner will rely on NOR/waiting wording and ${money(values.demurrage)} per day demurrage.`, "WATCH"),
    finding("Charterer argument", "Charterer will attack valid NOR, berth readiness, rain periods, port congestion and documentary gaps.", model.legalScore >= 55 ? "WATCH" : "FIX"),
    finding("Likely dispute strength", `Claim pressure is ${Math.round(model.claimScore)}/100. Evidence pack should be prepared before completion.`, model.claimScore >= 70 ? "AVOID" : "WATCH")
  ].join("");
}

function renderPortAndCargo(values, model) {
  const portMood = Number(values.delay || 0) >= 3 ? "Congested / claim-prone" : Number(values.delay || 0) >= 1 ? "Busy but manageable" : "Fast turnaround mood";
  portMoodResult.innerHTML = [
    scoreBlock(values.loadPort, model.opsScore, `Load port mood: ${portMood}.`),
    scoreBlock(values.dischargePort, model.opsScore + 8, "Discharge port should be checked for berth window, draft and documents."),
    finding("Agency note", "Ask local agent for waiting time, holidays, pilot/tug availability and rain letter practice.", "WATCH")
  ].join("");
  cargoTroubleResult.innerHTML = [
    finding(values.cargo, model.cargo.advice, model.cargo.risk >= 30 ? "AVOID" : "WATCH"),
    ...model.cargo.issues.map((issue) => finding(issue, `Specific cargo watch item for ${values.cargo}.`, "WATCH"))
  ].join("");
}

function renderTimelineAndBlackBox(values, model) {
  const steps = [
    ["Offer", "Extract terms", "now"],
    ["Counter", "Freight / demurrage / subjects", "next"],
    ["Recap", "Check missing fields", "before fixed"],
    ["CP", "Clause heatmap", "after recap"],
    ["NOR", "Validity and readiness", "arrival"],
    ["SOF", "Event evidence", "operation"],
    ["Laytime", "Used vs allowed", "completion"],
    ["Claim / Invoice", "Time bar and evidence", "post-voyage"]
  ];
  timelineResult.innerHTML = steps.map((step, index) => `<div class="timeline-step"><span>${index + 1}</span><strong>${escapeHtml(step[0])}</strong><small>${escapeHtml(step[2])}</small><em>${escapeHtml(step[1])}</em></div>`).join("");
  blackBoxResult.innerHTML = [
    finding("Audit event created", `Deal analyzed at ${new Date().toLocaleString()}.`, "FIX"),
    finding("Evidence snapshot", `Decision ${model.decision.label}, score ${model.totalScore}/100, cargo ${values.cargo}.`, "WATCH"),
    finding("Next proof to collect", "Agent line-up, NOR copy, SOF events, rain log and recap final wording.", "WATCH")
  ].join("");
}

function renderDoctorAndPolice(values, model) {
  doctorResult.innerHTML = [
    finding("Diagnosis", model.totalScore >= 72 ? "Deal has claim/commercial fever." : model.totalScore >= 48 ? "Deal is usable but needs treatment." : "Deal looks commercially healthy.", model.decision.label),
    finding("Treatment", "Tighten NOR/demurrage wording, price delay risk, ask agent for port mood and prepare evidence pack.", "WATCH"),
    finding("Follow-up", "Run what-if again after counterparty accepts freight/demurrage counter.", "FIX")
  ].join("");
  const required = ["vessel", "cargo", "quantity", "load", "discharge", "laycan", "freight", "demurrage", "commission", "subjects"];
  const missing = required.filter((item) => !has(model.text, item === "load" ? "load|lp|load port" : item === "discharge" ? "discharge|dp|disport" : item));
  recapPoliceResult.innerHTML = (missing.length ? missing : ["No obvious recap field missing"]).map((item) =>
    finding(item, missing.length ? "Add this field before sending final recap." : "Core recap fields appear covered.", missing.length ? "WATCH" : "FIX")
  ).join("");
}

function renderReadinessClientCareer(values, model) {
  const readyScore = clamp(100 - model.opsScore - (model.legalScore * 0.25), 0, 100);
  portReadinessResult.innerHTML = [
    scoreBlock("Entry readiness", readyScore, "Draft, docs, pilot/tug, berth window and cargo acceptance gate."),
    finding("Before arrival", "Confirm documents, terminal berth, agent line-up, weather, holidays and port dues estimate.", readyScore < 50 ? "WATCH" : "FIX")
  ].join("");
  const clientText = `${values.cargo} voyage ${values.loadPort} to ${values.dischargePort}: ${model.decision.label}. Estimated freight revenue is ${money(model.revenue)}. Main watch items are ${model.cargo.issues.slice(0, 3).join(", ")}, port delay and clause clarity. Recommended action: counter freight/demurrage, tighten recap wording and collect agent evidence.`;
  clientBriefResult.innerHTML = `<div class="client-card"><strong>Client brief</strong><span>${escapeHtml(clientText)}</span></div>`;
  careerModeResult.innerHTML = [
    scoreBlock("Student broker score", 100 - model.totalScore * 0.45, "Higher score means the user spotted and priced the main risks."),
    finding("Lesson unlocked", "Fixture risk is not one thing: it is commercial, legal, operational, claim, cargo and data confidence together.", "FIX")
  ].join("");
  return clientText;
}

function reportText(values, model, clientText) {
  return [
    "FOCUSEA DEAL SURGEON REPORT",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    `Decision: ${model.decision.label} (${model.totalScore}/100)`,
    `Cargo: ${values.cargo}`,
    `Route: ${values.loadPort} -> ${values.dischargePort}`,
    `Freight revenue: ${money(model.revenue)}`,
    `Bunker shock proxy: ${money(model.bunkerShock)}`,
    `Delay exposure: ${money(model.delayCost)}`,
    "",
    "Risk scores",
    `Commercial: ${Math.round(model.commercialScore)}/100`,
    `Legal: ${Math.round(model.legalScore)}/100`,
    `Operations: ${Math.round(model.opsScore)}/100`,
    `Claim: ${Math.round(model.claimScore)}/100`,
    "",
    "Negotiation move",
    `Counter freight around ${(Number(values.freight) + (model.totalScore >= 60 ? 1.1 : 0.55)).toFixed(2)} per unit.`,
    `Counter demurrage around ${money(Number(values.demurrage) * (model.claimScore >= 55 ? 1.18 : 1.08))} per day.`,
    "",
    "Client brief",
    clientText,
    "",
    "Disclaimer",
    "Educational decision support only. Final legal, commercial, insurance and compliance decisions require professional review."
  ].join("\n");
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function runSurgeon() {
  if (!surgeonForm) return;
  const values = formValues();
  const model = detect(values);
  surgeonDecision.textContent = model.decision.label;
  surgeonDecisionNote.textContent = `Composite risk ${model.totalScore}/100`;
  commercialPulse.textContent = `${Math.round(model.commercialScore)}/100`;
  legalHeat.textContent = `${Math.round(model.legalScore)}/100`;
  opsMood.textContent = `${Math.round(model.opsScore)}/100`;
  claimPressure.textContent = `${Math.round(model.claimScore)}/100`;
  renderLieDetector(values, model);
  renderDealDna(values, model);
  renderWhatIf(values, model);
  renderNegotiation(values, model);
  renderHeatmap(values, model);
  renderDispute(values, model);
  renderPortAndCargo(values, model);
  renderTimelineAndBlackBox(values, model);
  renderDoctorAndPolice(values, model);
  const clientText = renderReadinessClientCareer(values, model);
  lastSurgeonReport = { values, model, clientText, text: reportText(values, model, clientText) };
}

function ensureReport() {
  if (!lastSurgeonReport) runSurgeon();
  return lastSurgeonReport;
}

surgeonForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  runSurgeon();
});
surgeonForm?.addEventListener("input", runSurgeon);
surgeonForm?.addEventListener("change", runSurgeon);

downloadSurgeonTxt?.addEventListener("click", () => {
  const report = ensureReport();
  downloadTextFile("focusea-deal-surgeon-report.txt", report.text);
  surgeonExportStatus.textContent = "Deal Surgeon report downloaded.";
});

downloadSurgeonReportTop?.addEventListener("click", () => {
  const report = ensureReport();
  downloadTextFile("focusea-deal-surgeon-report.txt", report.text);
});

downloadSurgeonClient?.addEventListener("click", () => {
  const report = ensureReport();
  downloadTextFile("focusea-client-brief.txt", report.clientText);
  surgeonExportStatus.textContent = "Client brief downloaded.";
});

copySurgeonBrief?.addEventListener("click", async () => {
  const report = ensureReport();
  try {
    await navigator.clipboard.writeText(report.clientText);
    surgeonExportStatus.textContent = "Client brief copied.";
  } catch {
    downloadTextFile("focusea-client-brief.txt", report.clientText);
    surgeonExportStatus.textContent = "Clipboard blocked, downloaded client brief instead.";
  }
});

runSurgeon();
