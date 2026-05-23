const page = document.querySelector("#health-kundli-page");
const params = new URLSearchParams(window.location.search);
const userId = params.get("userId") || window.localStorage.getItem("jaUserId") || "demo";
const requestedChartId = params.get("chartId") || "";

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function renderProviderSignals(signals = {}) {
  const rows = [
    ["Source", signals.source],
    ["Nakshatra", signals.nakshatra],
    ["Moon rasi", signals.chandraRasi],
    ["Sun rasi", signals.sooryaRasi],
    ["Dasha", signals.dasha?.name],
    ["Sade Sati", signals.sadeSati?.description || signals.sadeSati?.phase],
    ["Mangal Dosha", signals.mangalDosha?.description]
  ].filter(([, value]) => value);
  if (!rows.length) return "";
  return `
    <div class="provider-signal-grid" aria-label="External Kundli signals">
      ${rows.map(([label, value]) => `
        <div>
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

async function loadHealthKundli() {
  const query = new URLSearchParams({ userId });
  if (requestedChartId) query.set("chartId", requestedChartId);
  const response = await fetch(`/api/health-kundli?${query.toString()}`);
  if (!response.ok) throw new Error("Could not create Health Kundli");
  const payload = await response.json();
  page.innerHTML = `
    <header class="topbar">
      <div class="identity">
        <div class="brand-mark" aria-hidden="true">JA</div>
        <div>
          <h1>Health Kundli</h1>
          <p>${escapeHTML(payload.profile.name)} · ${escapeHTML(payload.provider.source)}</p>
        </div>
      </div>
      <a class="icon-button" href="/" aria-label="Back to app">Back</a>
    </header>
    <main class="content">
      <section class="section">
        <div class="panel">
          <span class="tag ${payload.provider.configured ? "positive" : "monitoring"}">${payload.provider.configured ? "API connected" : "Local calculator"}</span>
          <h3>Created Health Kundli</h3>
          <p>${escapeHTML(payload.analysis.summary)}</p>
          <div class="schema-grid">
            <div><span>Chart ID</span><strong>${escapeHTML(payload.chartId)}</strong></div>
            <div><span>Mode</span><strong>${escapeHTML(payload.chart.calculationMode)}</strong></div>
            <div><span>Lagna</span><strong>${escapeHTML(payload.chart.lagna)}</strong></div>
            <div><span>Moon</span><strong>${escapeHTML(payload.chart.moonSign)}</strong></div>
            <div><span>Birth date</span><strong>${escapeHTML(payload.profile.birthDate)}</strong></div>
            <div><span>Exact time</span><strong>${escapeHTML(payload.profile.birthTime)}</strong></div>
            <div><span>Birth place</span><strong>${escapeHTML(payload.profile.birthPlace)}</strong></div>
            <div><span>Timezone</span><strong>${escapeHTML(payload.profile.timezone)}</strong></div>
          </div>
          <div class="kundli-chart-block">
            <div class="kundli-chart-header">
              <div>
                <span>Health Kundli Chart</span>
                <strong>${escapeHTML(payload.profile.name)}</strong>
                <small>${escapeHTML(payload.profile.birthPlace)} · ${escapeHTML(payload.profile.ayanamsha)} · Chart ${escapeHTML(payload.chartId)}</small>
              </div>
              <div class="kundli-chart-score">
                <span>HVI</span>
                <strong>${escapeHTML(payload.analysis.hvi.score)}</strong>
              </div>
            </div>
            <img class="kundli-preview" src="${escapeHTML(payload.svgUrl)}" alt="Health Kundli chart">
          </div>
          ${renderProviderSignals(payload.analysis.providerSignals)}
          <div class="safety-band">${escapeHTML(payload.provider.message || "External provider returned chart data.")}</div>
        </div>
      </section>
      <section class="section">
        <div class="section-header">
          <div>
            <h3>Health-related Kundli analysis</h3>
            <p>Focused on Lagna, 6th, 8th, 12th houses, Dasha, HVI and dosha.</p>
          </div>
        </div>
        <div class="alert-list">
          ${payload.analysis.houseHighlights.map((item) => `
            <article class="list-card">
              <header>
                <h4>House ${item.house}: ${escapeHTML(item.focus)}</h4>
                <span class="tag advisory">${escapeHTML(item.planets.join(", "))}</span>
              </header>
              <p>${escapeHTML(item.interpretation)}</p>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="section">
        <div class="panel">
          <h3>Plain-language guidance</h3>
          ${payload.analysis.recommendedActions.map((item) => `<p>${escapeHTML(item)}</p>`).join("")}
          <div class="safety-band">${payload.disclaimers.map(escapeHTML).join(" ")}</div>
        </div>
      </section>
    </main>
  `;
}

loadHealthKundli().catch((error) => {
  page.innerHTML = `
    <div class="loading-state">
      <div class="brand-mark" aria-hidden="true">JA</div>
      <p>${escapeHTML(error.message)}</p>
    </div>
  `;
});
