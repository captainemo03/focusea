const quoteForm = document.querySelector("#insuranceQuoteForm");
const quoteOutput = document.querySelector("#quoteOutput");
const coverageOutput = document.querySelector("#coverageOutput");
const claimOutput = document.querySelector("#claimOutput");
const glossaryOutput = document.querySelector("#insuranceGlossary");
const premiumStatus = document.querySelector("#premiumStatus");
const premiumStatusNote = document.querySelector("#premiumStatusNote");
const riskStatus = document.querySelector("#riskStatus");
const riskStatusNote = document.querySelector("#riskStatusNote");
const deductibleStatus = document.querySelector("#deductibleStatus");
const deductibleStatusNote = document.querySelector("#deductibleStatusNote");
const decisionStatus = document.querySelector("#decisionStatus");
const decisionStatusNote = document.querySelector("#decisionStatusNote");
const exportStatus = document.querySelector("#exportStatus");
const downloadQuoteTxt = document.querySelector("#downloadQuoteTxt");
const downloadQuotePdf = document.querySelector("#downloadQuotePdf");
const downloadEmailDraft = document.querySelector("#downloadEmailDraft");
const downloadInsuranceReportTop = document.querySelector("#downloadInsuranceReportTop");

let lastQuote = null;

const cargoProfiles = {
  coal: { label: "Coal", risk: 48, multiplier: 1.16, note: "Moisture, self-heating, hold cleanliness and rain evidence matter." },
  grain: { label: "Grain", risk: 44, multiplier: 1.1, note: "Shifting, fumigation, shortage and weather exposure must be checked." },
  ironOre: { label: "Iron ore", risk: 56, multiplier: 1.22, note: "Density, tanktop stress, TML and liquefaction exposure matter." },
  container: { label: "Container", risk: 42, multiplier: 1.12, note: "Stack, reefer, IMDG and transshipment risks should be reviewed." },
  crudeOil: { label: "Crude oil", risk: 68, multiplier: 1.42, note: "Pollution, vetting, terminal acceptance and pumping risk are key." },
  lng: { label: "LNG", risk: 72, multiplier: 1.5, note: "Boil-off, terminal compatibility and high-value exposure are material." },
  chemicals: { label: "Chemicals", risk: 78, multiplier: 1.58, note: "MSDS, coating, segregation and pollution exposure drive underwriting." },
  projectCargo: { label: "Project cargo", risk: 82, multiplier: 1.72, note: "Heavy-lift, lashing, center of gravity and survey evidence matter." }
};

const coverageProfiles = {
  "Hull & Machinery": { baseRate: 0.0065, risk: 22, note: "Physical loss/damage to hull, machinery and equipment, subject to class and survey conditions." },
  "P&I": { baseRate: 0.0042, risk: 18, note: "Third-party liabilities, crew, pollution and collision exposures normally reviewed under club rules." },
  "Cargo Insurance": { baseRate: 0.0038, risk: 20, note: "Cargo loss/damage terms depend on Institute Cargo Clauses, packaging, stowage and transit risk." },
  "War Risk": { baseRate: 0.0085, risk: 36, note: "War, piracy and hostile act exposure. Breach areas and additional premium must be checked." },
  "Kidnap & Ransom": { baseRate: 0.0078, risk: 34, note: "Security-focused extension for piracy/kidnap exposure; route and BMP compliance matter." },
  "Charterers Liability": { baseRate: 0.0028, risk: 16, note: "Charterer exposures: cargo, bunkers, port damage, demurrage disputes and indemnities." },
  "Freight, Demurrage & Defence": { baseRate: 0.0019, risk: 14, note: "Legal cost support for freight, demurrage, charter party and claim disputes." },
  "Pollution Liability": { baseRate: 0.0055, risk: 30, note: "Pollution exposure depends on cargo, bunker quantity, trading area and local regulation." },
  "Port Risk Cover": { baseRate: 0.0035, risk: 18, note: "Useful for port stay, repair period, lay-up or restricted movement exposure." }
};

function money(value, digits = 0) {
  return `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function collectFormValues(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => {
    const numberValue = Number(value);
    return [key, value !== "" && Number.isFinite(numberValue) ? numberValue : value];
  }));
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

function downloadPdfLikeFile(filename, title, body) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:28px;line-height:1.5;color:#102133}pre{white-space:pre-wrap}</style></head><body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(body)}</pre></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.pdf$/i, ".html");
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function riskZoneProfile(zone = "") {
  const text = String(zone).toLowerCase();
  if (text.includes("sanctions")) return { multiplier: 1.9, score: 34, note: "Sanctions-sensitive route: compliance review and counterparty screening required." };
  if (text.includes("war") || text.includes("piracy")) return { multiplier: 1.75, score: 32, note: "War/piracy watch: underwriter referral likely." };
  if (text.includes("weather")) return { multiplier: 1.28, score: 18, note: "Weather-exposed voyage: routing, lashing and delay evidence matter." };
  if (text.includes("congested") || text.includes("strait")) return { multiplier: 1.18, score: 14, note: "Congested strait/port exposure: collision, delay and port damage risk." };
  return { multiplier: 1, score: 6, note: "Normal trading area based on user input." };
}

function vesselTypeMultiplier(type = "") {
  const text = String(type).toLowerCase();
  if (text.includes("lng")) return 1.45;
  if (text.includes("tanker")) return 1.32;
  if (text.includes("container")) return 1.14;
  if (text.includes("ro-ro")) return 1.12;
  if (text.includes("general")) return 1.08;
  return 1;
}

function calculateQuote(values = {}) {
  const coverage = coverageProfiles[values.coverageType] || coverageProfiles["Hull & Machinery"];
  const cargo = cargoProfiles[values.cargoType] || cargoProfiles.grain;
  const zone = riskZoneProfile(values.riskZone);
  const age = Math.max(new Date().getFullYear() - (Number(values.buildYear) || new Date().getFullYear()), 0);
  const ageMultiplier = age > 25 ? 1.42 : age > 18 ? 1.24 : age > 10 ? 1.1 : 1;
  const typeMultiplier = vesselTypeMultiplier(values.vesselType);
  const claimMultiplier = 1 + Math.min(Number(values.claims) || 0, 5) * 0.12;
  const deductibleRatio = (Number(values.deductible) || 0) / Math.max(Number(values.insuredValue) || 1, 1);
  const deductibleCredit = deductibleRatio >= 0.02 ? 0.88 : deductibleRatio >= 0.01 ? 0.94 : 1;
  const premium = (Number(values.insuredValue) || 0) * coverage.baseRate * zone.multiplier * ageMultiplier * typeMultiplier * cargo.multiplier * claimMultiplier * deductibleCredit;
  const riskScore = clamp(Math.round(coverage.risk + zone.score + cargo.risk * 0.26 + age * 0.9 + (Number(values.claims) || 0) * 8), 0, 100);
  const decision = riskScore >= 78 ? "Refer to Underwriter" : riskScore >= 62 ? "High / senior review" : riskScore >= 42 ? "Medium / review terms" : "Low / quoteable";
  const recommendedDeductible = Math.max(Number(values.deductible) || 0, (Number(values.insuredValue) || 0) * (riskScore >= 70 ? 0.012 : riskScore >= 45 ? 0.008 : 0.005));
  return { coverage, cargo, zone, age, premium, riskScore, decision, recommendedDeductible, ageMultiplier, typeMultiplier, claimMultiplier, deductibleCredit };
}

function claimRisks(values, quote) {
  const cargo = quote.cargo.label;
  return [
    { name: "Cargo damage", score: clamp(quote.riskScore * 0.62 + (cargo === "Project cargo" ? 24 : 8), 0, 100), note: "Packaging, stowage, survey and cargo nature drive exposure." },
    { name: "Delay / demurrage exposure", score: clamp(24 + quote.riskScore * 0.36, 0, 100), note: "FDD or charterers liability may be relevant for dispute cost." },
    { name: "Weather damage", score: /weather|war|piracy|congested/i.test(values.riskZone || "") ? 68 : 34, note: "Routing, lashing, sea state and port delay evidence matter." },
    { name: "Pollution", score: /tanker|lng/i.test(values.vesselType || "") || ["Crude oil", "Chemicals", "LNG"].includes(cargo) ? 76 : 34, note: "Cargo/bunker pollution exposure and local law sensitivity." },
    { name: "Machinery breakdown", score: clamp(quote.age * 3 + (values.vesselType === "LNG" ? 18 : 10), 0, 100), note: "Age, maintenance records and class status must be checked." },
    { name: "General average", score: clamp(30 + quote.riskScore * 0.42, 0, 100), note: "High-value cargo and casualty response can trigger GA contributions." }
  ];
}

function quoteText(values = collectFormValues(quoteForm), quote = calculateQuote(values)) {
  const risks = claimRisks(values, quote);
  return [
    "FOCUSEA MARINE INSURANCE QUOTE",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "ASSURED / VESSEL",
    `Vessel: ${values.vesselName || "-"} / IMO ${values.imo || "-"}`,
    `Type: ${values.vesselType || "-"} / Flag: ${values.flag || "-"} / Class: ${values.classSociety || "-"}`,
    `Build year: ${values.buildYear || "-"} / Age: ${quote.age} years / DWT: ${values.dwt || "-"} / GT: ${values.gt || "-"}`,
    "",
    "VOYAGE / COVER",
    `Load port: ${values.loadPort || "-"}`,
    `Discharge port: ${values.dischargePort || "-"}`,
    `Route: ${values.route || "-"}`,
    `Cargo: ${quote.cargo.label}`,
    `Coverage: ${values.coverageType || "-"}`,
    `Risk zone: ${values.riskZone || "-"}`,
    "",
    "INDICATION",
    `Insured value: ${money(values.insuredValue || 0)}`,
    `Estimated premium: ${money(quote.premium)}`,
    `Recommended deductible: ${money(quote.recommendedDeductible)}`,
    `Risk score: ${quote.riskScore}/100`,
    `Decision: ${quote.decision}`,
    "",
    "UNDERWRITER NOTES",
    quote.coverage.note,
    quote.zone.note,
    `Cargo note: ${quote.cargo.note}`,
    `Broker / underwriter note: ${values.underwriterNote || "-"}`,
    "",
    "CLAIM RISK PANEL",
    ...risks.map((risk) => `- ${risk.name}: ${Math.round(risk.score)}/100 - ${risk.note}`),
    "",
    "DISCLAIMER",
    "This is an educational indication only. Binding insurance terms require licensed insurer/underwriter approval."
  ].join("\n");
}

function emailDraft(values = collectFormValues(quoteForm), quote = calculateQuote(values)) {
  return [
    `Subject: Marine insurance indication - ${values.vesselName || "Vessel"} / ${values.coverageType || "Cover"}`,
    "",
    "Dear Underwriting Team,",
    "",
    "Please find below an indicative marine insurance quote request generated in Focusea:",
    "",
    `Vessel: ${values.vesselName || "-"} / IMO ${values.imo || "-"}`,
    `Type / flag / class: ${values.vesselType || "-"} / ${values.flag || "-"} / ${values.classSociety || "-"}`,
    `Voyage: ${values.loadPort || "-"} to ${values.dischargePort || "-"} (${values.route || "-"})`,
    `Cargo: ${quote.cargo.label}`,
    `Coverage: ${values.coverageType || "-"}`,
    `Insured value: ${money(values.insuredValue || 0)}`,
    `Deductible: ${money(values.deductible || 0)} / suggested ${money(quote.recommendedDeductible)}`,
    `Estimated premium indication: ${money(quote.premium)}`,
    `Risk result: ${quote.decision} (${quote.riskScore}/100)`,
    "",
    `Broker / underwriter note: ${values.underwriterNote || "Please review terms, exclusions and subjectivities."}`,
    "",
    "Subject to underwriter review, sanctions screening, claims record, class confirmation and final policy wording.",
    "",
    "Best regards,"
  ].join("\n");
}

function renderGlossary() {
  const terms = [
    ["Institute Cargo Clauses", "Standard cargo insurance wording sets for cargo risks."],
    ["Deductible", "Amount retained by assured before insurer pays."],
    ["Total Loss", "Actual loss where ship or cargo is completely lost or irrecoverable."],
    ["Constructive Total Loss", "Loss where recovery/repair cost may exceed insured value threshold."],
    ["General Average", "Shared contribution after extraordinary sacrifice or expenditure for common safety."],
    ["Salvage", "Reward/cost related to saving ship or cargo from peril."],
    ["Subrogation", "Insurer's right to recover from responsible third parties after paying claim."],
    ["Sue and Labour", "Assured's duty/costs to minimize loss after casualty."],
    ["Breach Area", "War-risk area requiring notice or additional premium."]
  ];
  glossaryOutput.innerHTML = terms.map(([term, detail]) => `<div><strong>${escapeHtml(term)}</strong><span>${escapeHtml(detail)}</span></div>`).join("");
}

function renderQuote() {
  if (!quoteForm) return;
  const values = collectFormValues(quoteForm);
  const quote = calculateQuote(values);
  lastQuote = { values, quote, text: quoteText(values, quote), email: emailDraft(values, quote) };

  premiumStatus.textContent = money(quote.premium);
  premiumStatusNote.textContent = `${(quote.coverage.baseRate * 100).toFixed(2)}% base rate`;
  riskStatus.textContent = `${quote.riskScore}/100`;
  riskStatusNote.textContent = quote.zone.note;
  deductibleStatus.textContent = money(quote.recommendedDeductible);
  deductibleStatusNote.textContent = "Suggested retention";
  decisionStatus.textContent = quote.decision;
  decisionStatusNote.textContent = quote.riskScore >= 78 ? "Senior approval required" : "Quote indication";

  quoteOutput.innerHTML = `
    <div class="metric-grid">
      <div><span>Estimated premium</span><strong>${money(quote.premium)}</strong></div>
      <div><span>Risk score</span><strong>${quote.riskScore}/100</strong></div>
      <div><span>Decision</span><strong>${escapeHtml(quote.decision)}</strong></div>
      <div><span>Recommended deductible</span><strong>${money(quote.recommendedDeductible)}</strong></div>
      <div><span>Cargo</span><strong>${escapeHtml(quote.cargo.label)}</strong></div>
      <div><span>Coverage rate</span><strong>${(quote.coverage.baseRate * 100).toFixed(2)}%</strong></div>
    </div>
  `;

  coverageOutput.innerHTML = `
    <div class="coverage-list">
      <div><span>${escapeHtml(values.coverageType || "Coverage")}</span><strong>${escapeHtml(quote.coverage.note)}</strong></div>
      <div><span>Route watch</span><strong>${escapeHtml(quote.zone.note)}</strong></div>
      <div><span>Broker / underwriter note</span><strong>${escapeHtml(values.underwriterNote || "No note entered.")}</strong></div>
      <div><span>Exclusions to review</span><strong>War breach, sanctions, wear and tear, unseaworthiness, improper packing, late notice, undeclared dangerous cargo.</strong></div>
    </div>
  `;

  claimOutput.innerHTML = `<div class="risk-bars">${claimRisks(values, quote).map((risk) => `
    <div><span>${escapeHtml(risk.name)}</span><strong>${Math.round(risk.score)}/100</strong><em style="width:${clamp(risk.score, 0, 100)}%"></em><small>${escapeHtml(risk.note)}</small></div>
  `).join("")}</div>`;

  renderGlossary();
}

quoteForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  renderQuote();
});
quoteForm?.addEventListener("input", renderQuote);
quoteForm?.addEventListener("change", renderQuote);

function ensureQuote() {
  if (!lastQuote) renderQuote();
  return lastQuote;
}

downloadQuoteTxt?.addEventListener("click", () => {
  const quote = ensureQuote();
  downloadTextFile("focusea-marine-insurance-quote.txt", quote.text);
  exportStatus.textContent = "Downloaded quote TXT.";
});

downloadQuotePdf?.addEventListener("click", () => {
  const quote = ensureQuote();
  downloadPdfLikeFile("focusea-marine-insurance-quote.pdf", "Focusea Marine Insurance Quote", quote.text);
  exportStatus.textContent = "Downloaded printable quote file.";
});

downloadEmailDraft?.addEventListener("click", () => {
  const quote = ensureQuote();
  downloadTextFile("focusea-marine-insurance-email-draft.txt", quote.email);
  exportStatus.textContent = "Downloaded underwriter email draft.";
});

downloadInsuranceReportTop?.addEventListener("click", () => {
  const quote = ensureQuote();
  downloadTextFile("focusea-marine-insurance-report.txt", quote.text);
});

renderQuote();
