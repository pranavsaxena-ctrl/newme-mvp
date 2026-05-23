const API_BASE = window.JA_API_BASE || "";
const app = document.querySelector("#app");

const state = {
  view: "today",
  userId: window.localStorage.getItem("jaUserId") || "demo",
  dashboard: null,
  saving: false
};

const icons = {
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`,
  pulse: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M22 12h-4l-3 8L9 4l-3 8H2"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`,
  leaf: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z"/><path d="M4 13c4 0 7 1 11 5"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>`,
  report: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>`
};

const uiCopy = {
  en: {
    briefingFor: "briefing for",
    morningHealthIntelligence: "Morning Health Intelligence",
    vitalitySignal: "vitality signal",
    nudge: "Nudge",
    today: "Today",
    profile: "Profile",
    timeline: "Timeline",
    remedies: "Remedies",
    safety: "Safety",
    complete: "complete",
    remedyPlanTitle: "90-day remedy plan",
    remedyPlanBody: "Mantra, diet, lifestyle, dana, ritual, Ayurvedic, and expert-review actions are separated so users do the safe next step, not the dramatic one.",
    duration: "Duration",
    products: "Products",
    checked: "Checked",
    days: "days",
    safetyGate: "Safety gate",
    pharmeasySearch: "PharmEasy search",
    reviewSource: "Review source",
    openPharmeasy: "Open PharmEasy",
    priceCheck: "Price check",
    sla: "SLA"
  },
  hi: {
    briefingFor: "के लिए ब्रीफिंग",
    morningHealthIntelligence: "सुबह की स्वास्थ्य बुद्धिमत्ता",
    vitalitySignal: "वाइटैलिटी संकेत",
    nudge: "नज",
    today: "आज",
    profile: "प्रोफाइल",
    timeline: "टाइमलाइन",
    remedies: "उपाय",
    safety: "सुरक्षा",
    complete: "पूर्ण",
    remedyPlanTitle: "90-दिन उपाय योजना",
    remedyPlanBody: "मंत्र, आहार, जीवनशैली, दान, अनुष्ठान, आयुर्वेदिक और विशेषज्ञ-समीक्षा कदम अलग रखे गए हैं ताकि उपयोगकर्ता सुरक्षित अगला कदम करें।",
    duration: "अवधि",
    products: "उत्पाद",
    checked: "जांच",
    days: "दिन",
    safetyGate: "सुरक्षा गेट",
    pharmeasySearch: "PharmEasy खोज",
    reviewSource: "स्रोत देखें",
    openPharmeasy: "PharmEasy खोलें",
    priceCheck: "कीमत जांच",
    sla: "SLA"
  },
  ta: {
    briefingFor: "க்கான சுருக்கம்",
    morningHealthIntelligence: "காலை ஆரோக்கிய நுண்ணறிவு",
    vitalitySignal: "உயிர்சக்தி சிக்னல்",
    nudge: "நினைவூட்டல்",
    today: "இன்று",
    profile: "சுயவிவரம்",
    timeline: "காலவரிசை",
    remedies: "பரிகாரங்கள்",
    safety: "பாதுகாப்பு",
    complete: "முடிந்தது",
    remedyPlanTitle: "90 நாள் பரிகார திட்டம்",
    remedyPlanBody: "மந்திரம், உணவு, வாழ்க்கைமுறை, தானம், சடங்கு, ஆயுர்வேதம் மற்றும் நிபுணர் மதிப்பீடு பிரிக்கப்பட்டுள்ளன; பயனர் பாதுகாப்பான அடுத்த படியை செய்வதற்காக.",
    duration: "காலம்",
    products: "பொருட்கள்",
    checked: "சரிபார்ப்பு",
    days: "நாட்கள்",
    safetyGate: "பாதுகாப்பு வாயில்",
    pharmeasySearch: "PharmEasy தேடல்",
    reviewSource: "மூலத்தை பார்க்க",
    openPharmeasy: "PharmEasy திற",
    priceCheck: "விலை சோதனை",
    sla: "SLA"
  },
  te: {
    briefingFor: "కోసం బ్రీఫింగ్",
    morningHealthIntelligence: "ఉదయ ఆరోగ్య ఇంటెలిజెన్స్",
    vitalitySignal: "వైటాలిటీ సంకేతం",
    nudge: "నజ్",
    today: "ఈరోజు",
    profile: "ప్రొఫైల్",
    timeline: "టైమ్‌లైన్",
    remedies: "పరిహారాలు",
    safety: "భద్రత",
    complete: "పూర్తి",
    remedyPlanTitle: "90 రోజుల పరిహార ప్రణాళిక",
    remedyPlanBody: "మంత్రం, ఆహారం, జీవనశైలి, దానం, ఆచారం, ఆయుర్వేదం మరియు నిపుణుల సమీక్ష చర్యలు వేరు చేయబడ్డాయి; వినియోగదారు సురక్షిత తదుపరి అడుగు వేయేందుకు.",
    duration: "వ్యవధి",
    products: "ఉత్పత్తులు",
    checked: "తనిఖీ",
    days: "రోజులు",
    safetyGate: "భద్రత గేట్",
    pharmeasySearch: "PharmEasy శోధన",
    reviewSource: "మూలాన్ని చూడండి",
    openPharmeasy: "PharmEasy తెరవండి",
    priceCheck: "ధర తనిఖీ",
    sla: "SLA"
  }
};

function ui(data, key, fallback) {
  const code = data?.localization?.code || "en";
  return uiCopy[code]?.[key] || uiCopy.en[key] || fallback || key;
}

async function fetchJSON(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(`Request failed: ${path}`);
  return response.json();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function toast(message) {
  let node = document.querySelector(".toast");
  if (!node) {
    node = document.createElement("div");
    node.className = "toast";
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("show"), 2400);
}

function render() {
  const data = state.dashboard;
  if (!data) return;
  app.innerHTML = `
    ${renderTopbar(data)}
    ${renderHero(data)}
    ${renderTabs(data)}
    <main class="content">${renderView(data)}</main>
    ${renderBottomNav(data)}
  `;
  bindEvents();
}

function renderTopbar(data) {
  return `
    <header class="topbar">
      <div class="identity">
        <div class="brand-mark" aria-hidden="true">JA</div>
        <div>
          <h1>Jyotish Arogya</h1>
          <p>${escapeHTML(data.profile.language)} ${escapeHTML(ui(data, "briefingFor"))} ${escapeHTML(data.profile.name)}</p>
        </div>
      </div>
      <button class="icon-button" data-action="notify" aria-label="Open notification preferences" title="Notification preferences">
        ${icons.bell}
      </button>
    </header>
  `;
}

function renderHero(data) {
  const style = `--score:${data.hvi.score}`;
  return `
    <section class="hero">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">${escapeHTML(ui(data, "morningHealthIntelligence"))}</p>
          <h2>${escapeHTML(data.hvi.label)} ${escapeHTML(ui(data, "vitalitySignal"))}</h2>
          <p>${escapeHTML(data.nudge.body)}</p>
        </div>
        <div class="score-ring" style="${style}" aria-label="Health Vulnerability Index ${data.hvi.score} out of 100">
          <div>
            <strong>${data.hvi.score}</strong>
            <span>HVI</span>
          </div>
        </div>
      </div>
      <div class="hero-actions">
        <div class="metric-tile"><span>DRS</span><strong>${data.dasha.score}</strong></div>
        <div class="metric-tile"><span>TIA</span><strong>${data.tia.score}/10</strong></div>
        <div class="metric-tile"><span>${escapeHTML(ui(data, "nudge"))}</span><strong>${escapeHTML(data.nudge.scheduledFor)}</strong></div>
      </div>
    </section>
  `;
}

function renderTabs(data) {
  const tabs = [
    ["today", ui(data, "today")],
    ["profile", ui(data, "profile")],
    ["timeline", ui(data, "timeline")],
    ["remedies", ui(data, "remedies")],
    ["safety", ui(data, "safety")]
  ];
  return `
    <nav class="segmented" aria-label="Dashboard views">
      ${tabs.map(([id, label]) => `
        <button data-view="${id}" aria-selected="${state.view === id}">${label}</button>
      `).join("")}
    </nav>
  `;
}

function renderBottomNav(data) {
  const items = [
    ["today", ui(data, "today"), icons.pulse],
    ["profile", ui(data, "profile"), icons.user],
    ["timeline", ui(data, "timeline"), icons.calendar],
    ["remedies", ui(data, "remedies"), icons.leaf],
    ["safety", ui(data, "safety"), icons.shield]
  ];
  return `
    <nav class="bottom-nav" aria-label="Primary">
      ${items.map(([id, label, icon]) => `
        <button data-view="${id}" aria-current="${state.view === id ? "page" : "false"}">
          ${icon}<span>${label}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderView(data) {
  if (state.view === "profile") return renderProfile(data);
  if (state.view === "timeline") return renderTimeline(data);
  if (state.view === "remedies") return renderRemedies(data);
  if (state.view === "safety") return renderSafety(data);
  return renderToday(data);
}

function renderToday(data) {
  return `
    <section class="section">
      <div class="panel">
        <span class="tag ${data.hvi.tone}">${escapeHTML(data.dashboardSummary.status)}</span>
        <h3>${escapeHTML(data.dashboardSummary.headline)}</h3>
        <p>${escapeHTML(data.dashboardSummary.body)}</p>
        <div class="schema-grid">
          <div><span>HVI</span><strong>${data.dashboardSummary.today.hvi}</strong></div>
          <div><span>DRS</span><strong>${data.dashboardSummary.currentDasha.score}</strong></div>
          <div><span>TIA</span><strong>${data.dashboardSummary.today.tia}/10</strong></div>
          <div><span>Next</span><strong>${escapeHTML(data.dashboardSummary.nextCriticalWindow.risk)}</strong></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="nudge-card">
        <div class="nudge-meta">
          <span class="tag ${data.hvi.tone}">${escapeHTML(data.nudge.intensity)} nudge</span>
          <span class="tag">${escapeHTML(data.nudge.modules.hora.planet)} hora</span>
        </div>
        <h3>${escapeHTML(data.nudge.title)}</h3>
        <p>${escapeHTML(data.nudge.action)}</p>
        <div class="nudge-intel">
          <div><span>Weekday</span><strong>${escapeHTML(data.nudge.weekday)} · ${escapeHTML(data.nudge.modules.weekday.ruler)}</strong></div>
          <div><span>Nakshatra</span><strong>${escapeHTML(data.nudge.modules.nakshatra.name)}</strong></div>
          <div><span>Dasha</span><strong>${escapeHTML(data.nudge.modules.dashaModifier.score)}</strong></div>
          <div><span>Streak</span><strong>${data.nudge.engagement.streakDays} day</strong></div>
        </div>
        <div class="checklist">
          ${data.nudge.checklist.map((item) => `
            <label class="check-item">
              <input type="checkbox" data-checklist="${escapeHTML(item.id)}" ${item.completed ? "checked" : ""}>
              <span>${escapeHTML(item.label)}</span>
            </label>
          `).join("")}
        </div>
        <div class="action-row">
          <button class="primary-button" data-action="complete-nudge">${icons.check}Mark done</button>
          <button class="secondary-button" data-action="rate-nudge">Helpful</button>
        </div>
        <div class="engagement-meter" aria-label="Nudge completion ${data.nudge.engagement.completionPercent}%">
          <i style="--width:${data.nudge.engagement.completionPercent}%"></i>
        </div>
      </div>
    </section>

    ${data.nudge.doctorNudge ? `
      <section class="section">
        <div class="panel doctor-panel">
          <span class="tag advisory">${escapeHTML(data.nudge.doctorNudge.trigger)}</span>
          <h3>${escapeHTML(data.nudge.doctorNudge.title)}</h3>
          <p>${escapeHTML(data.nudge.doctorNudge.body)}</p>
        </div>
      </section>
    ` : ""}

    <section class="section">
      <div class="panel">
        <h3>Nudge preferences</h3>
        <form id="nudge-preferences-form" class="profile-grid">
          <div class="field"><label>Time</label><input name="nudgeTime" type="time" value="${escapeHTML(data.profile.notificationPreferences?.nudgeTime || data.profile.nudgeTime)}"></div>
          <div class="field"><label>Detail</label><select name="detailLevel">${renderOptions(["Brief", "Balanced", "Detailed"], data.profile.notificationPreferences?.detailLevel || "Balanced")}</select></div>
          <div class="field"><label>Channel</label><select name="channel">${renderOptions(["push", "email", "in-app"], data.profile.notificationPreferences?.channel || "push")}</select></div>
          <div class="field"><label>Language</label><select name="language">${renderOptions(data.safety.languageRollout.primary.concat(data.safety.languageRollout.next, data.safety.languageRollout.later), data.profile.notificationPreferences?.language || data.profile.language)}</select></div>
          <div class="field full"><button class="secondary-button" type="submit">${icons.bell}Save reminders</button></div>
        </form>
      </div>
    </section>

    <section class="section">
      <div class="panel dasha-panel">
        <div>
          <span class="tag ${data.dasha.score > 70 ? "critical" : "advisory"}">${escapeHTML(data.dasha.label)}</span>
          <h3>${escapeHTML(data.dasha.currentPeriod)}</h3>
          <p>${escapeHTML(data.dasha.healthDomain)}</p>
        </div>
        <div class="drs-meter" aria-label="Dasha Risk Score ${data.dasha.score} out of 100">
          <strong>${data.dasha.score}</strong>
          <span>DRS</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>HVI breakdown</h3>
          <p>Risk is weighted from natal, Dasha, and transit factors.</p>
        </div>
        <span class="tag ${data.hvi.tone}">${escapeHTML(data.hvi.label)}</span>
      </div>
      <div class="panel">
        <div class="hvi-breakdown">
          ${data.hvi.breakdown.map((item) => `
            <div class="bar-row">
              <span><b>${escapeHTML(item.label)}</b><em>${item.value}/${item.max}</em></span>
              <div class="bar"><i style="--width:${Math.round((item.value / item.max) * 100)}%"></i></div>
              <small>${escapeHTML(item.insight)}</small>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Active transit alerts</h3>
          <p>Tiered Gochara signals for the next few weeks.</p>
        </div>
      </div>
      <div class="alert-list">
        ${data.transits.slice(0, 3).map(renderAlert).join("")}
      </div>
      <div class="safety-band">${escapeHTML(data.nudge.safetyNote)}</div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Next critical window</h3>
          <p>Preparation calendar for the next 3 months.</p>
        </div>
      </div>
      ${renderWindowCard(data.dashboardSummary.nextCriticalWindow)}
    </section>
  `;
}

function renderAlert(alert) {
  const tone = alert.tier === "critical" ? "critical" : alert.tier === "positive" ? "positive" : "advisory";
  return `
    <article class="list-card">
      <header>
        <h4>${escapeHTML(alert.title)}</h4>
        <span class="tag ${tone}">${escapeHTML(alert.tierLabel || alert.tier)}</span>
      </header>
      <p>${escapeHTML(alert.body)}</p>
      <div class="meta">
        <span>${escapeHTML(alert.planet)}</span>
        <span>${escapeHTML(alert.window)}</span>
        <span>${escapeHTML(alert.cta)}</span>
      </div>
    </article>
  `;
}

function renderWindowCard(item) {
  const tone = item.tier === "critical" ? "critical" : item.tier === "positive" ? "positive" : "advisory";
  return `
    <article class="list-card window-card">
      <div class="window-date">
        <strong>${formatDate(item.date).split(" ")[0]}</strong>
        <span>${formatDate(item.date).split(" ").slice(1).join(" ")}</span>
      </div>
      <div>
        <header>
          <h4>${escapeHTML(item.title)}</h4>
          <span class="tag ${tone}">${escapeHTML(item.phase)}</span>
        </header>
        <p>${escapeHTML(item.action)}</p>
        <div class="meta">
          <span>${escapeHTML(item.source)}</span>
          <span>${escapeHTML(item.domains.join(" · "))}</span>
        </div>
      </div>
    </article>
  `;
}

function renderOptions(options, selected) {
  return options.map((option) => `
    <option value="${escapeHTML(option)}" ${option === selected ? "selected" : ""}>${escapeHTML(option)}</option>
  `).join("");
}

function renderDoshaQuestions(data) {
  const questions = data.onboarding.options.doshaQuestions;
  const answers = data.profile.dosha?.answers || {};
  return questions.map((question) => `
    <fieldset class="dosha-question">
      <legend>${escapeHTML(question.label)}</legend>
      <div class="dosha-options">
        ${question.options.map((option) => `
          <label class="choice-pill">
            <input type="radio" name="dosha.${escapeHTML(question.id)}" value="${escapeHTML(option.value)}" ${answers[question.id] === option.value ? "checked" : ""}>
            <span>
              <b>${escapeHTML(option.value)}</b>
              <small>${escapeHTML(option.label)}</small>
            </span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `).join("");
}

function renderProfile(data) {
  const options = data.onboarding.options;
  const contract = data.profileContract;
  return `
    <section class="section">
      <div class="panel">
        <span class="tag ${contract.onboarding.complete ? "positive" : "advisory"}">${contract.onboarding.complete ? "Complete" : "Needs birth data"}</span>
        <h3>Birth profile</h3>
        <p>Capture birth date, exact time, place, timezone, and Lahiri ayanamsha for all premium health astrology features.</p>
        <div class="schema-grid">
          <div><span>Privacy</span><strong>${contract.privacy.birthDataEncrypted ? "Encrypted" : "Plain"}</strong></div>
          <div><span>Analytics</span><strong>Separated</strong></div>
          <div><span>Precision</span><strong>${options.timePrecisionMinutes} min</strong></div>
          <div><span>Dosha</span><strong>${escapeHTML(data.profile.dominantDosha)}</strong></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="form-panel panel">
        <h3>Onboarding details</h3>
        <form id="profile-form" class="profile-grid">
          <div class="field full"><label>Name</label><input name="name" required value="${escapeHTML(data.profile.name)}"></div>
          <div class="field"><label>Birth date</label><input name="birthDate" required type="date" value="${escapeHTML(data.profile.birthDate)}"></div>
          <div class="field"><label>Exact time</label><input name="birthTime" required type="time" value="${escapeHTML(data.profile.birthTime)}"></div>
          <div class="field full"><label>Birth place</label><input name="birthPlace" required value="${escapeHTML(data.profile.birthPlace)}" placeholder="City, Country"></div>
          <div class="field"><label>Timezone</label><select name="timezone">${renderOptions(options.timezoneOptions, data.profile.timezone)}</select></div>
          <div class="field"><label>Ayanamsha</label><select name="ayanamsha">${renderOptions(options.ayanamshaOptions, data.profile.ayanamsha)}</select></div>
          <div class="field"><label>Lagna</label><select name="lagna">${renderOptions(options.zodiacSigns, data.profile.lagna)}</select></div>
          <div class="field"><label>Moon sign</label><select name="moonSign">${renderOptions(options.zodiacSigns, data.profile.moonSign)}</select></div>
          <div class="field"><label>Language</label><select name="language">${renderOptions(data.safety.languageRollout.primary.concat(data.safety.languageRollout.next, data.safety.languageRollout.later), data.profile.language)}</select></div>
          <div class="field"><label>Nudge time</label><input name="nudgeTime" type="time" value="${escapeHTML(data.profile.nudgeTime)}"></div>
          <div class="field full action-row profile-actions">
            <button class="primary-button" type="submit">${icons.user}Save birth profile</button>
            <button class="secondary-button" type="button" data-action="save-generate-kundli">${icons.report}Save & Generate New Kundli</button>
          </div>
        </form>
        <div class="safety-band">Changing birth date, exact time, birth place, timezone, or ayanamsha creates a new Kundli chart ID after saving.</div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Dosha cross-check</h3>
          <p>Questionnaire result is cross-checked against Lagna and Moon sign.</p>
        </div>
        <span class="tag ${data.profile.dosha?.crossCheck === "aligned" ? "positive" : "monitoring"}">${escapeHTML(data.profile.dosha?.crossCheck || "mixed")}</span>
      </div>
      <div class="form-panel panel">
        <form id="dosha-form" class="dosha-form">
          ${renderDoshaQuestions(data)}
          <button class="secondary-button" type="submit">${icons.check}Update dosha answers</button>
        </form>
      </div>
    </section>

    <section class="section">
      <div class="panel">
        <h3>Partner-safe profile payload</h3>
        <p><b>Profile schema:</b> ${escapeHTML(contract.schemaVersion)} · <b>Analytics ID:</b> ${escapeHTML(contract.analytics.analyticsId)}</p>
        <div class="safety-band">Birth data is stored encrypted in the prototype server store and is not used for advertising. Partner analytics receives a separate non-birth identifier.</div>
      </div>
    </section>
  `;
}

function renderTimeline(data) {
  const healthKundliUrl = data.healthKundli?.svgUrl || `/api/health-kundli.svg?userId=${encodeURIComponent(data.profile.id)}`;
  const healthKundliAnalysisUrl = data.healthKundli?.analysisUrl || `/health-kundli.html?userId=${encodeURIComponent(data.profile.id)}`;
  return `
    <section class="section">
      <div class="panel">
        <span class="tag positive">Health Kundli</span>
        <h3>Health-focused D1 chart</h3>
        <p>Creates a Kundli image and health analysis from birth profile, HVI, DRS, and health-sensitive houses.</p>
        <img class="kundli-preview" src="${healthKundliUrl}" alt="Health Kundli chart for ${escapeHTML(data.profile.name)}">
        <div class="safety-band">Chart ID ${escapeHTML(data.healthKundli?.chartId || "pending")} updates when saved birth inputs change.</div>
        <div class="action-row">
          <a class="primary-button" href="${escapeHTML(healthKundliAnalysisUrl)}">${icons.report}Open analysis</a>
          <a class="secondary-button" href="${healthKundliUrl}">${icons.code}SVG</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="panel">
        <span class="tag ${data.dasha.score > 70 ? "critical" : "advisory"}">${escapeHTML(data.dasha.label)}</span>
        <h3>${escapeHTML(data.dasha.mahadasha)}-${escapeHTML(data.dasha.antardasha)} Dasha</h3>
        <p>${escapeHTML(data.dasha.summary)}</p>
        <div class="action-row">
          <button class="primary-button" data-view="today">${icons.pulse}Today signal</button>
          <button class="secondary-button" data-action="report">${icons.report}Report</button>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Critical window calendar</h3>
          <p>3-month lookahead combining Dasha and transit alerts.</p>
        </div>
      </div>
      <div class="timeline-list">
        ${data.criticalWindows.map(renderWindowCard).join("")}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Weekly forecast</h3>
          <p>Designed for quick Monday planning.</p>
        </div>
      </div>
      <div class="panel">
        <p><b>Focus:</b> ${data.weeklyForecast.focusAreas.map(escapeHTML).join(", ")}</p>
        <p><b>Sensitive days:</b> ${data.weeklyForecast.highSensitivityDays.map(escapeHTML).join(", ")}</p>
        <p><b>Practice:</b> ${escapeHTML(data.weeklyForecast.practice)}</p>
      </div>
    </section>
  `;
}

function renderProductModule(item, data) {
  const product = item.productRecommendation;
  if (!product) return "";
  const isBlocked = product.status === "blocked";
  const actionLabel = isBlocked ? ui(data, "reviewSource") : ui(data, "openPharmeasy");
  return `
    <div class="product-module ${isBlocked ? "blocked" : ""}">
      <div class="product-topline">
        <span class="tag ${isBlocked ? "critical" : "positive"}">${escapeHTML(isBlocked ? ui(data, "safetyGate") : ui(data, "pharmeasySearch"))}</span>
        <strong>${escapeHTML(product.price?.display || ui(data, "priceCheck"))}</strong>
      </div>
      <h5>${escapeHTML(product.name)}</h5>
      <p>${escapeHTML(product.reason)}</p>
      <div class="sla-line">
        <span>${escapeHTML(ui(data, "sla"))}: ${escapeHTML(product.sla?.label || "Pincode-dependent")}</span>
        <span>${escapeHTML(product.sla?.dataFreshness || "Refresh before checkout")}</span>
      </div>
      <small>${escapeHTML(product.sla?.promise || "Live ETA requires pincode and stock check.")}</small>
      <small>${escapeHTML(product.dosageGuardrail || item.safety)}</small>
      ${product.sourceUrl ? `<a class="inline-link" href="${escapeHTML(product.sourceUrl)}" target="_blank" rel="noopener noreferrer">${actionLabel}</a>` : ""}
    </div>
  `;
}

function renderRemedies(data) {
  const plan = data.remedyPlan || {
    durationDays: 90,
    summary: {
      totalRemedies: data.remedies.length,
      completed: data.remedies.filter((item) => item.completed).length,
      recommendedProducts: data.remedies.length,
      blockedProducts: 0,
      priceLastChecked: "prototype"
    },
    productPolicy: { fulfillmentSla: "Live ETA requires pincode and stock check." },
    phases: []
  };
  const completed = data.remedies.filter((item) => item.completed).length;
  return `
    <section class="section">
      <div class="panel">
        <span class="tag positive">${completed}/${data.remedies.length} ${escapeHTML(ui(data, "complete"))}</span>
        <h3>${escapeHTML(ui(data, "remedyPlanTitle"))}</h3>
        <p>${escapeHTML(ui(data, "remedyPlanBody"))}</p>
        <div class="schema-grid">
          <div><span>${escapeHTML(ui(data, "duration"))}</span><strong>${plan.durationDays} ${escapeHTML(ui(data, "days"))}</strong></div>
          <div><span>${escapeHTML(ui(data, "products"))}</span><strong>${plan.summary.recommendedProducts}/${plan.summary.totalRemedies}</strong></div>
          <div><span>${escapeHTML(ui(data, "sla"))}</span><strong>${escapeHTML(plan.summary.slaMode || "Pincode")}</strong></div>
          <div><span>${escapeHTML(ui(data, "checked"))}</span><strong>${escapeHTML(plan.summary.priceLastChecked)}</strong></div>
        </div>
        <div class="safety-band">${escapeHTML(plan.productPolicy.fulfillmentSla)} Prices and availability must be refreshed before checkout.</div>
      </div>
    </section>

    ${plan.phases.length ? `
      <section class="section">
        <div class="remedy-phases">
          ${plan.phases.map((phase) => `
            <div>
              <span>${escapeHTML(phase.range)}</span>
              <strong>${escapeHTML(phase.focus)}</strong>
            </div>
          `).join("")}
        </div>
      </section>
    ` : ""}

    <section class="section">
      <div class="remedy-list">
        ${data.remedies.map((item) => `
          <article class="list-card remedy-card">
            <div class="remedy-copy">
              <span class="tag">${escapeHTML(item.category)} · ${escapeHTML(item.planet)}</span>
              <h4>${escapeHTML(item.title)}</h4>
              <p>${escapeHTML(item.detail)}</p>
              <span class="meta">${escapeHTML(item.phase || "Active")} · ${escapeHTML(item.dayRange || item.cadence)} · ${escapeHTML(item.effort || "Habit")}</span>
              <span class="meta">${escapeHTML(item.cadence)} · ${escapeHTML(item.safety)}</span>
              <span class="meta">${escapeHTML(item.disclaimer)}</span>
              ${renderProductModule(item, data)}
            </div>
            <input type="checkbox" data-remedy="${escapeHTML(item.id)}" ${item.completed ? "checked" : ""} aria-label="Mark ${escapeHTML(item.title)} complete">
          </article>
        `).join("")}
      </div>
      <div class="safety-band">Gemstones require qualified Jyotishi review. Remedies complement wellness and do not replace medical diagnosis, treatment, or emergency care.</div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Planet organ map</h3>
          <p>From the PRD's Jyotish health framework.</p>
        </div>
      </div>
      <div class="alert-list">
        ${data.organMap.slice(0, 5).map((item) => `
          <article class="list-card">
            <header>
              <h4>${escapeHTML(item.planet)}</h4>
              <span class="tag">${escapeHTML(item.dosha)}</span>
            </header>
            <p>${escapeHTML(item.organ)} · ${escapeHTML(item.system)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSafety(data) {
  const origin = window.location.origin;
  const snippet = `<script src="${origin}/embed.js" defer></script>\n<jyotish-arogya-app user-id="${data.profile.id}" api-base="${origin}"></jyotish-arogya-app>`;
  const endpoints = [
    ["GET", "/api/safety"],
    ["GET", "/api/schemas"],
    ["POST", "/api/content/validate"],
    ["GET", "/api/onboarding/options"],
    ["GET", `/api/profile/${data.profile.id}`],
    ["POST", "/api/onboarding"],
    ["GET", `/api/dashboard?userId=${data.profile.id}`],
    ["GET", `/api/dashboard-summary?userId=${data.profile.id}`],
    ["GET", `/api/critical-windows?userId=${data.profile.id}`],
    ["GET", `/api/hvi/${data.profile.id}`],
    ["GET", `/api/dasha/${data.profile.id}`],
    ["GET", `/api/transits?userId=${data.profile.id}`],
    ["GET", `/api/nudges/today?userId=${data.profile.id}`],
    ["GET", `/api/remedies/plan?userId=${data.profile.id}`],
    ["GET", `/api/remedies/products?userId=${data.profile.id}`],
    ["POST", "/api/remedies/checkin"],
    ["GET", `/api/reports/remedy-plan?userId=${data.profile.id}`],
    ["GET", `/api/reports/physician-summary?userId=${data.profile.id}`],
    ["GET", "/api/embed/manifest"],
    ["GET", "/api/openapi.json"]
  ];
  const safety = data.safety;
  const rollout = safety.languageRollout;
  return `
    <section class="section">
      <div class="panel">
        <span class="tag ${data.contentSafety.status === "passed" ? "positive" : "critical"}">${escapeHTML(data.contentSafety.status)}</span>
        <h3>Safety foundation</h3>
        <p>Policy ${escapeHTML(safety.policyVersion)} is active across nudges, alerts, remedies, reports, and partner APIs.</p>
        <div class="schema-grid">
          <div><span>API</span><strong>${escapeHTML(data.apiVersion)}</strong></div>
          <div><span>HVI</span><strong>${escapeHTML(data.hvi.schemaVersion)}</strong></div>
          <div><span>DRS</span><strong>${escapeHTML(data.dasha.schemaVersion)}</strong></div>
          <div><span>TIA</span><strong>${escapeHTML(data.tia.schemaVersion)}</strong></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Non-negotiables</h3>
          <p>Converted from the PRD's ethical guidelines.</p>
        </div>
      </div>
      <div class="foundation-grid">
        ${safety.principles.map((item) => `
          <article class="list-card">
            <header>
              <h4>${escapeHTML(item.title)}</h4>
              <span class="tag">${escapeHTML(item.id)}</span>
            </header>
            <p>${escapeHTML(item.rule)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Escalation rules</h3>
          <p>High-risk signals must stay calm and care-forward.</p>
        </div>
      </div>
      <div class="alert-list">
        ${safety.escalationRules.map((item) => `
          <article class="list-card">
            <header><h4>${escapeHTML(item.trigger)}</h4><span class="tag advisory">Rule</span></header>
            <p>${escapeHTML(item.action)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section">
      <div class="panel">
        <h3>Language rollout</h3>
        <p><b>Launch:</b> ${rollout.primary.map(escapeHTML).join(", ")}</p>
        <p><b>Next:</b> ${rollout.next.map(escapeHTML).join(", ")}</p>
        <p><b>Later:</b> ${rollout.later.map(escapeHTML).join(", ")}</p>
        <div class="safety-band">${escapeHTML(rollout.localizationRule)}</div>
      </div>
    </section>

    <section class="section">
      <div class="form-panel panel">
        <h3>Host-app embed</h3>
        <p>Drop the widget into another app with one script. It runs in shadow DOM, calls the same REST APIs, and accepts host-provided user IDs.</p>
        <code class="code-block">${escapeHTML(snippet)}</code>
        <div class="action-row">
          <button class="primary-button" data-action="copy-embed">${icons.code}Copy snippet</button>
          <a class="secondary-button" href="/embed-demo.html">Open demo</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h3>Foundation APIs</h3>
          <p>Safety, schemas, and embedded dashboard contracts.</p>
        </div>
      </div>
      <div class="panel api-list">
        ${endpoints.map(([method, path]) => `
          <div class="api-item">
            <span class="method">${method}</span>
            <span class="path">${escapeHTML(path)}</span>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="section">
      <div class="form-panel panel">
        <h3>Safety copy validator</h3>
        <p>Partner apps can preflight draft nudges and alerts before they are shown to users.</p>
        <form id="validator-form" class="validator-form">
          <textarea name="content" rows="4">A high Mars day may raise inflammation tendencies. Rest, hydrate, and consult a physician for persistent symptoms.</textarea>
          <button class="primary-button" type="submit">${icons.shield}Validate copy</button>
        </form>
      </div>
    </section>

  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelector("[data-action='notify']")?.addEventListener("click", async () => {
    await saveNudgePreferences({ nudgeTime: "05:30", language: state.dashboard.profile.language });
    toast("Daily health nudge is set for 5:30 AM.");
  });

  document.querySelector("[data-action='complete-nudge']")?.addEventListener("click", async () => {
    const ids = state.dashboard.nudge.checklist.map((item) => item.id);
    await saveNudgeChecklist(ids);
    toast("Nice. Today's nudge is complete.");
  });

  document.querySelector("[data-action='rate-nudge']")?.addEventListener("click", async () => {
    const result = await fetchJSON("/api/nudges/rate", {
      method: "POST",
      body: JSON.stringify({ userId: state.dashboard.profile.id, nudgeId: state.dashboard.nudge.id, rating: "helpful" })
    });
    state.dashboard.nudge = result.nudge;
    render();
    toast("Feedback saved for personalization.");
  });

  document.querySelectorAll("[data-checklist]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const ids = Array.from(document.querySelectorAll("[data-checklist]:checked")).map((item) => item.dataset.checklist);
      await saveNudgeChecklist(ids);
      toast("Nudge checklist updated.");
    });
  });

  document.querySelectorAll("[data-remedy]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      if (!checkbox.checked) return;
      await fetchJSON("/api/remedies/checkin", {
        method: "POST",
        body: JSON.stringify({ userId: state.dashboard.profile.id, remedyId: checkbox.dataset.remedy })
      });
      await loadDashboard(false);
      toast("Remedy check-in updated.");
    });
  });

  document.querySelector("[data-action='copy-embed']")?.addEventListener("click", async () => {
    const code = document.querySelector(".code-block")?.textContent || "";
    try {
      await navigator.clipboard.writeText(code);
      toast("Embed snippet copied.");
    } catch {
      toast("Snippet is ready to copy.");
    }
  });

  document.querySelector("[data-action='report']")?.addEventListener("click", async () => {
    const payload = await fetchJSON(`/api/reports/constitution?userId=${encodeURIComponent(state.dashboard.profile.id)}`);
    toast(`${payload.report.title} is ${payload.report.status}.`);
  });

  document.querySelector("[data-action='save-generate-kundli']")?.addEventListener("click", async () => {
    await saveProfile({ openKundli: true });
  });

  document.querySelector("#profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile();
  });

  document.querySelector("#dosha-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = profilePayloadFromForms();
    payload.id = state.dashboard.profile.id;
    const result = await fetchJSON("/api/onboarding", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.dashboard = result.dashboard;
    state.view = "profile";
    render();
    toast("Dosha cross-check updated.");
  });

  document.querySelector("#validator-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await fetchJSON("/api/content/validate", {
      method: "POST",
      body: JSON.stringify({ content: form.get("content") })
    });
    toast(result.ok ? "Copy passed safety validation." : `Safety review needed: ${result.issueCount} issue(s).`);
  });

  document.querySelector("#nudge-preferences-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await saveNudgePreferences(payload);
    toast("Reminder preferences saved.");
  });
}

async function saveProfile({ openKundli = false } = {}) {
  const payload = profilePayloadFromForms();
  payload.id = state.dashboard.profile.id;
  const result = await fetchJSON("/api/onboarding", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.dashboard = result.dashboard;
  state.userId = result.dashboard.profile.id;
  window.localStorage.setItem("jaUserId", state.userId);
  state.view = "profile";
  render();
  toast(openKundli ? "Birth profile saved. Generating new Kundli." : "Birth profile saved and encrypted.");
  if (openKundli) {
    window.location.href = state.dashboard.healthKundli?.analysisUrl || `/health-kundli.html?userId=${encodeURIComponent(state.userId)}`;
  }
}

async function saveNudgeChecklist(completedIds) {
  const result = await fetchJSON("/api/nudges/checklist", {
    method: "POST",
    body: JSON.stringify({
      userId: state.dashboard.profile.id,
      date: state.dashboard.nudge.date,
      completedIds
    })
  });
  state.dashboard.nudge = result.nudge;
  render();
}

async function saveNudgePreferences(payload) {
  const result = await fetchJSON("/api/notifications/preferences", {
    method: "POST",
    body: JSON.stringify({ userId: state.dashboard.profile.id, ...payload })
  });
  state.dashboard.profile.notificationPreferences = result.preferences;
  state.dashboard.nudge = result.nudge;
  render();
}

function profilePayloadFromForms() {
  const profileForm = document.querySelector("#profile-form");
  const doshaForm = document.querySelector("#dosha-form");
  const payload = profileForm ? Object.fromEntries(new FormData(profileForm).entries()) : {};
  const doshaAnswers = {};
  if (doshaForm) {
    for (const [key, value] of new FormData(doshaForm).entries()) {
      if (key.startsWith("dosha.")) doshaAnswers[key.replace("dosha.", "")] = value;
    }
  } else if (state.dashboard.profile.dosha?.answers) {
    Object.assign(doshaAnswers, state.dashboard.profile.dosha.answers);
  }
  payload.doshaAnswers = doshaAnswers;
  return payload;
}

async function loadDashboard(showError = true) {
  try {
    state.dashboard = await fetchJSON(`/api/dashboard?userId=${encodeURIComponent(state.userId)}`);
    render();
  } catch (error) {
    if (!showError) throw error;
    app.innerHTML = `
      <div class="loading-state">
        <div class="brand-mark" aria-hidden="true">JA</div>
        <p>Could not reach the Jyotish Arogya API. Start the local server with node server.mjs.</p>
      </div>
    `;
  }
}

loadDashboard();
