const base = process.env.BASE_URL || "http://localhost:4174";

const checks = [
  ["/api/health", "ok"],
  ["/api/config", "colors"],
  ["/api/safety", "safety"],
  ["/api/localization?language=Hindi", "planets"],
  ["/api/schemas", "schemas"],
  ["/api/onboarding/options", "options"],
  ["/api/provider/status", "provider"],
  ["/api/health-kundli?userId=demo", "analysis"],
  ["/api/dashboard-summary?userId=demo", "dashboardSummary"],
  ["/api/critical-windows?userId=demo", "criticalWindows"],
  ["/api/dashboard?userId=demo", "hvi"],
  ["/api/nudges/today?userId=demo", "nudge"],
  ["/api/nudges/streak?userId=demo", "engagement"],
  ["/api/remedies/plan?userId=demo", "remedies"],
  ["/api/remedies/products?userId=demo", "recommendations"],
  ["/api/reports/remedy-plan?userId=demo", "report"],
  ["/api/reports/physician-summary?userId=demo", "report"],
  ["/api/openapi.json", "paths"]
];

for (const [path, key] of checks) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const payload = await response.json();
  if (!(key in payload)) throw new Error(`${path} missing ${key}`);
  if (path.startsWith("/api/dashboard?") && payload.contentSafety.status !== "passed") {
    throw new Error("dashboard failed safety validation");
  }
  if (path.startsWith("/api/dashboard-summary") && !payload.dashboardSummary.acceptance.criticalWindowCalendar) {
    throw new Error("dashboard summary missing critical-window acceptance");
  }
  if (path.startsWith("/api/critical-windows") && payload.criticalWindows.length < 3) {
    throw new Error("critical windows should include at least 3 entries");
  }
  if (path.startsWith("/api/nudges/today") && !payload.nudge.modules.nakshatra) {
    throw new Error("daily nudge missing nakshatra module");
  }
  if (path.startsWith("/api/localization") && payload.planets.Saturn !== "शनि") {
    throw new Error("Hindi localization should include localized Saturn");
  }
  if (path.startsWith("/api/remedies/plan")) {
    if (payload.summary.slaMode !== "pincode-dependent") throw new Error("remedy plan missing pincode-dependent SLA");
    const missingProduct = payload.remedies.find((item) => !item.productRecommendation?.price || !item.productRecommendation?.sla);
    if (missingProduct) throw new Error(`remedy missing product recommendation: ${missingProduct.id}`);
    const gemstone = payload.remedies.find((item) => item.id === "gemstone-review");
    if (!gemstone || gemstone.productRecommendation.status !== "blocked") throw new Error("gemstone recommendation should be safety gated");
  }
  if (path.startsWith("/api/remedies/products") && payload.recommendations.length < 7) {
    throw new Error("product recommendation feed should include every remedy");
  }
  console.log(`ok ${path}`);
}

const safeCopy = await fetch(`${base}/api/content/validate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ content: "This is a preparation nudge. Seek medical care for persistent symptoms." })
}).then((response) => response.json());

if (!safeCopy.ok) throw new Error("safe copy should pass validation");
console.log("ok /api/content/validate safe");

const unsafeCopy = await fetch(`${base}/api/content/validate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ content: "The chart says the user will die on a fixed date." })
}).then((response) => response.json());

if (unsafeCopy.ok || unsafeCopy.issueCount < 1) throw new Error("unsafe copy should be blocked");
console.log("ok /api/content/validate unsafe");

const userId = `smoke-${Date.now()}`;
const onboarding = await fetch(`${base}/api/onboarding`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: userId,
    name: "Meera Smoke",
    language: "Hindi",
    birthDate: "1992-11-08",
    birthTime: "05:25",
    birthPlace: "Pune, India",
    timezone: "Asia/Kolkata",
    ayanamsha: "Lahiri",
    lagna: "Virgo",
    moonSign: "Cancer",
    nudgeTime: "05:45",
    doshaAnswers: {
      body_frame: "Vata",
      skin_temperature: "Pitta",
      digestion: "Pitta",
      stress_response: "Vata",
      sleep: "Vata",
      energy: "Pitta"
    }
  })
}).then((response) => response.json());

if (onboarding.profile.id !== userId) throw new Error("onboarding did not preserve user id");
if (!onboarding.profileContract.privacy.birthDataEncrypted) throw new Error("birth data should be encrypted at rest");
if (!onboarding.profileContract.analytics.analyticsId.startsWith("an_")) throw new Error("analytics id missing");
console.log("ok /api/onboarding create profile");

const profile = await fetch(`${base}/api/profile/${userId}`).then((response) => response.json());
if (profile.profile.birthPlace !== "Pune, India") throw new Error("profile read failed");
if (JSON.stringify(profile).includes("ciphertext")) throw new Error("profile response leaked encrypted ciphertext");
console.log("ok /api/profile/:userId");

const createdDashboard = await fetch(`${base}/api/dashboard?userId=${userId}`).then((response) => response.json());
if (createdDashboard.profile.language !== "Hindi") throw new Error("dashboard did not render created profile");
if (createdDashboard.localization.locale !== "hi-IN") throw new Error("dashboard should include Hindi localization envelope");
if (createdDashboard.transits[0].planet !== "शनि") throw new Error("transit planet should be localized for Hindi");
if (!createdDashboard.transits[0].tierLabel) throw new Error("transit alert should include localized tier label");
if (createdDashboard.remedies[0].title !== "सूर्य ग्राउंडिंग") throw new Error("remedy title should be localized for Hindi");
if (!createdDashboard.disclaimers.global.includes("टेली-मानस")) throw new Error("safety disclaimer should be localized and include Tele-MANAS");
if (!createdDashboard.profileContract.onboarding.complete) throw new Error("created profile should be onboarding complete");
if (!createdDashboard.dashboardSummary.acceptance.hviBreakdown) throw new Error("sprint 2 dashboard summary missing HVI acceptance");
if (!createdDashboard.criticalWindows.length) throw new Error("created dashboard missing critical windows");
if (!createdDashboard.remedyPlan || createdDashboard.remedyPlan.summary.recommendedProducts < 6) {
  throw new Error("created dashboard missing sprint 4 PharmEasy recommendations");
}
console.log("ok /api/dashboard created user");

const nudgeBefore = await fetch(`${base}/api/nudges/today?userId=${userId}`).then((response) => response.json());
if (!nudgeBefore.nudge.modules.hora || !nudgeBefore.nudge.modules.dashaModifier) {
  throw new Error("nudge modules missing hora or dasha modifier");
}
if (!nudgeBefore.nudge.doctorNudge) throw new Error("doctor nudge should appear when TIA is high");
console.log("ok /api/nudges/today modules");

const completedIds = nudgeBefore.nudge.checklist.map((item) => item.id);
const checklist = await fetch(`${base}/api/nudges/checklist`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ userId, date: nudgeBefore.nudge.date, completedIds })
}).then((response) => response.json());
if (checklist.nudge.engagement.completionPercent !== 100) throw new Error("nudge checklist did not complete");
console.log("ok /api/nudges/checklist");

const rating = await fetch(`${base}/api/nudges/rate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ userId, nudgeId: nudgeBefore.nudge.id, rating: "helpful" })
}).then((response) => response.json());
if (rating.nudge.engagement.latestRating !== "helpful") throw new Error("nudge rating was not reflected");
console.log("ok /api/nudges/rate reflects rating");

const prefs = await fetch(`${base}/api/notifications/preferences`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ userId, nudgeTime: "06:10", language: "Hindi", detailLevel: "Detailed", channel: "in-app" })
}).then((response) => response.json());
if (prefs.preferences.nudgeTime !== "06:10" || prefs.preferences.detailLevel !== "Detailed") {
  throw new Error("notification preferences failed");
}
console.log("ok /api/notifications/preferences");

const kundli = await fetch(`${base}/api/health-kundli?userId=${userId}`).then((response) => response.json());
if (kundli.schemaVersion !== "health-kundli.v1") throw new Error("health kundli schema missing");
if (!kundli.chart.houses || kundli.chart.houses.length !== 12) throw new Error("health kundli should include 12 houses");
if (!kundli.analysis.recommendedActions.length) throw new Error("health kundli analysis missing actions");
if (!kundli.chartId || !kundli.svgUrl.includes("chartId=")) throw new Error("health kundli should include cache-busting chart id");
if (!/^\d+$/.test(String(kundli.chartId))) throw new Error("health kundli chart id should be numeric");
if (kundli.provider.message?.includes("KUNDLI_API_KEY")) throw new Error("health kundli provider message should be user-facing");
console.log("ok /api/health-kundli created user");

await fetch(`${base}/api/profile`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: userId,
    birthDate: "1993-12-09",
    birthTime: "22:10",
    birthPlace: "Mumbai, India",
    timezone: "Asia/Dubai",
    ayanamsha: "Lahiri"
  })
}).then((response) => response.json());

const recalculatedKundli = await fetch(`${base}/api/health-kundli?userId=${userId}`).then((response) => response.json());
if (recalculatedKundli.chartId === kundli.chartId) {
  throw new Error("health kundli chart id should change when birth date/time/place/timezone changes");
}
if (!/^\d+$/.test(String(recalculatedKundli.chartId))) {
  throw new Error("recalculated health kundli chart id should be numeric");
}
if (JSON.stringify(recalculatedKundli.chart.houses) === JSON.stringify(kundli.chart.houses)) {
  throw new Error("health kundli houses should recalculate after birth profile changes");
}
console.log("ok /api/health-kundli recalculates after birth profile changes");

const svgResponse = await fetch(`${base}/api/health-kundli.svg?userId=${userId}`);
const svgText = await svgResponse.text();
if (!svgResponse.ok || !svgText.includes("<svg")) throw new Error("health kundli svg failed");
console.log("ok /api/health-kundli.svg");

const remedyPlan = await fetch(`${base}/api/remedies/plan?userId=${userId}`).then((response) => response.json());
if (remedyPlan.durationDays !== 90) throw new Error("remedy plan should cover 90 days");
if (!remedyPlan.productPolicy.pincodeRequired) throw new Error("remedy plan should require pincode before fulfillment SLA");
if (remedyPlan.localization.locale !== "hi-IN") throw new Error("remedy plan should preserve user locale");
if (remedyPlan.remedies.find((item) => item.id === "gemstone-review").category !== "विशेषज्ञ समीक्षा") {
  throw new Error("gemstone category should be localized");
}
if (remedyPlan.remedies.some((item) => !item.productRecommendation.price.display || !item.productRecommendation.sla.label)) {
  throw new Error("every remedy should include price display and SLA label");
}
console.log("ok /api/remedies/plan created user");
