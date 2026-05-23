import { createServer } from "node:http";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const PORT = Number(process.env.PORT || 4174);

const profiles = new Map();
const checkins = new Map();
const nudgeRatings = [];
const nudgeCompletions = new Map();
const notificationPreferences = new Map();

const configuredAstrologyProvider = process.env.ASTROLOGY_PROVIDER || "Prokerala";
const astrologyProviderKind = /kundliapi|api-key|legacy/i.test(configuredAstrologyProvider)
  ? "api-key"
  : "prokerala";
const prokeralaEndpoints = {
  kundli: process.env.PROKERALA_KUNDLI_ENDPOINT || "/astrology/kundli",
  advancedKundli: process.env.PROKERALA_ADVANCED_KUNDLI_ENDPOINT || "/astrology/kundli/advanced",
  birthChart: process.env.PROKERALA_CHART_ENDPOINT || "/astrology/chart",
  planetPositions: process.env.PROKERALA_PLANETS_ENDPOINT || "/astrology/planet-position",
  mahaDasha: process.env.PROKERALA_DASHA_ENDPOINT || "/astrology/dasha-periods",
  sadeSati: process.env.PROKERALA_SADHESATI_ENDPOINT || "/astrology/sade-sati",
  mangalDosha: process.env.PROKERALA_MANGAL_DOSHA_ENDPOINT || "/astrology/mangal-dosha"
};
const legacyKundliEndpoints = {
  lagnaChart: process.env.KUNDLI_LAGNA_CHART_ENDPOINT || "/api/charts/lagna_chart",
  planetPositions: process.env.KUNDLI_PLANETS_ENDPOINT || "/api/planets/all",
  mahaDasha: process.env.KUNDLI_DASHA_ENDPOINT || "/api/dasha/maha_dasha",
  sadeSati: process.env.KUNDLI_SADHESATI_ENDPOINT || "/api/dosha/sadhesati"
};
const astrologyProvider = {
  name: configuredAstrologyProvider,
  kind: astrologyProviderKind,
  baseUrl: astrologyProviderKind === "prokerala"
    ? (process.env.PROKERALA_API_BASE_URL || "https://api.prokerala.com/v2")
    : (process.env.KUNDLI_API_BASE_URL || "https://kundliapi.com"),
  tokenUrl: process.env.PROKERALA_TOKEN_URL || "https://api.prokerala.com/token",
  clientId: process.env.PROKERALA_CLIENT_ID || "",
  clientSecret: process.env.PROKERALA_CLIENT_SECRET || "",
  clientType: process.env.PROKERALA_CLIENT_TYPE || "Web Application",
  apiKey: process.env.KUNDLI_API_KEY || "",
  ayanamsa: process.env.PROKERALA_AYANAMSA || "",
  endpoints: astrologyProviderKind === "prokerala" ? prokeralaEndpoints : legacyKundliEndpoints,
  legacyEndpoints: legacyKundliEndpoints
};
let prokeralaTokenCache = { accessToken: "", expiresAt: 0 };

const contractVersions = Object.freeze({
  api: "0.4.0-sprint4",
  profile: "profile.v1",
  healthKundli: "health-kundli.v1",
  dashboard: "dashboard.v1",
  localization: "localization.v1",
  remedyPlan: "remedy-plan.v1",
  nudge: "nudge.v1",
  hvi: "hvi.v1",
  drs: "drs.v1",
  tia: "tia.v1",
  safety: "safety.v1"
});

const profileEncryptionKey = createHash("sha256")
  .update(process.env.JYOTISH_PROFILE_KEY || "jyotish-arogya-local-prototype-key")
  .digest();

const defaultProfile = {
  id: "demo",
  name: "Aarav Sharma",
  language: "English",
  birthDate: "1990-05-12",
  birthTime: "06:42",
  birthPlace: "Varanasi, India",
  timezone: "Asia/Kolkata",
  ayanamsha: "Lahiri",
  lagna: "Leo",
  moonSign: "Capricorn",
  dominantDosha: "Pitta-Vata",
  tier: "Premium",
  nudgeTime: "05:30"
};

const onboardingOptions = {
  schemaVersion: contractVersions.profile,
  requiredBirthFields: ["birthDate", "birthTime", "birthPlace", "timezone", "ayanamsha"],
  timePrecisionMinutes: 15,
  defaultAyanamsha: "Lahiri",
  ayanamshaOptions: ["Lahiri", "Raman", "Krishnamurti"],
  timezoneOptions: ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney"],
  zodiacSigns: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"],
  doshaQuestions: [
    {
      id: "body_frame",
      label: "Body frame",
      options: [
        { value: "Vata", label: "Light, lean, quick to change" },
        { value: "Pitta", label: "Medium, warm, sharp appetite" },
        { value: "Kapha", label: "Solid, steady, gains easily" }
      ]
    },
    {
      id: "skin_temperature",
      label: "Skin and temperature",
      options: [
        { value: "Vata", label: "Dry or cool" },
        { value: "Pitta", label: "Warm or sensitive" },
        { value: "Kapha", label: "Cool, soft, or oily" }
      ]
    },
    {
      id: "digestion",
      label: "Digestion pattern",
      options: [
        { value: "Vata", label: "Irregular appetite" },
        { value: "Pitta", label: "Strong appetite" },
        { value: "Kapha", label: "Slow but steady" }
      ]
    },
    {
      id: "stress_response",
      label: "Stress response",
      options: [
        { value: "Vata", label: "Restless or anxious" },
        { value: "Pitta", label: "Irritable or intense" },
        { value: "Kapha", label: "Withdrawn or heavy" }
      ]
    },
    {
      id: "sleep",
      label: "Sleep rhythm",
      options: [
        { value: "Vata", label: "Light or broken" },
        { value: "Pitta", label: "Moderate, heat-sensitive" },
        { value: "Kapha", label: "Deep or long" }
      ]
    },
    {
      id: "energy",
      label: "Energy curve",
      options: [
        { value: "Vata", label: "Bursts of energy" },
        { value: "Pitta", label: "Focused and driven" },
        { value: "Kapha", label: "Slow, stable endurance" }
      ]
    }
  ]
};

const signDosha = {
  Aries: "Pitta",
  Taurus: "Kapha",
  Gemini: "Vata",
  Cancer: "Kapha",
  Leo: "Pitta",
  Virgo: "Vata",
  Libra: "Vata",
  Scorpio: "Pitta",
  Sagittarius: "Pitta",
  Capricorn: "Vata",
  Aquarius: "Vata",
  Pisces: "Kapha"
};

const knownPlaces = {
  "varanasi, india": { lat: 25.3176, lon: 82.9739, tzone: 5.5 },
  "pune, india": { lat: 18.5204, lon: 73.8567, tzone: 5.5 },
  "delhi, india": { lat: 28.6139, lon: 77.209, tzone: 5.5 },
  "mumbai, india": { lat: 19.076, lon: 72.8777, tzone: 5.5 },
  "bengaluru, india": { lat: 12.9716, lon: 77.5946, tzone: 5.5 },
  "bangalore, india": { lat: 12.9716, lon: 77.5946, tzone: 5.5 },
  "kolkata, india": { lat: 22.5726, lon: 88.3639, tzone: 5.5 },
  "chennai, india": { lat: 13.0827, lon: 80.2707, tzone: 5.5 },
  "hyderabad, india": { lat: 17.385, lon: 78.4867, tzone: 5.5 }
};

function encryptJSON(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", profileEncryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64")
  };
}

function decryptJSON(encrypted) {
  const decipher = createDecipheriv("aes-256-gcm", profileEncryptionKey, Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

function normalizeDoshaAnswers(input = {}) {
  const answers = {};
  for (const question of onboardingOptions.doshaQuestions) {
    const value = input[question.id];
    answers[question.id] = ["Vata", "Pitta", "Kapha"].includes(value) ? value : "Pitta";
  }
  return answers;
}

function scoreDosha(answers = {}, lagna = "Leo", moonSign = "Capricorn") {
  const normalized = normalizeDoshaAnswers(answers);
  const questionnaireScores = { Vata: 0, Pitta: 0, Kapha: 0 };
  Object.values(normalized).forEach((value) => {
    questionnaireScores[value] += 1;
  });
  const questionnaireDominant = Object.entries(questionnaireScores).sort((a, b) => b[1] - a[1])[0][0];
  const chartScores = { Vata: 0, Pitta: 0, Kapha: 0 };
  chartScores[signDosha[lagna] || "Pitta"] += 2;
  chartScores[signDosha[moonSign] || "Vata"] += 1;
  const chartDominant = Object.entries(chartScores).sort((a, b) => b[1] - a[1])[0][0];
  const dominantDosha = questionnaireDominant === chartDominant
    ? questionnaireDominant
    : `${questionnaireDominant}-${chartDominant}`;
  return {
    answers: normalized,
    questionnaireScores,
    questionnaireDominant,
    chartDominant,
    dominantDosha,
    crossCheck: questionnaireDominant === chartDominant ? "aligned" : "mixed"
  };
}

function normalizeProfile(input = {}, current = {}) {
  const id = input.id || input.userId || current.id || `user-${Date.now()}`;
  const lagna = input.lagna || current.lagna || defaultProfile.lagna;
  const moonSign = input.moonSign || current.moonSign || defaultProfile.moonSign;
  const dosha = scoreDosha(input.doshaAnswers || current.dosha?.answers, lagna, moonSign);
  const existingPreferences = notificationPreferences.get(id) || current.notificationPreferences || {};
  const notificationPreference = {
    nudgeTime: input.nudgeTime || existingPreferences.nudgeTime || current.nudgeTime || defaultProfile.nudgeTime,
    language: input.language || existingPreferences.language || current.language || defaultProfile.language,
    detailLevel: input.detailLevel || existingPreferences.detailLevel || current.detailLevel || "Balanced",
    channel: input.channel || existingPreferences.channel || "push",
    enabled: input.enabled ?? existingPreferences.enabled ?? true
  };
  notificationPreferences.set(id, notificationPreference);
  return {
    id,
    name: input.name || current.name || defaultProfile.name,
    language: input.language || current.language || defaultProfile.language,
    lagna,
    moonSign,
    dominantDosha: dosha.dominantDosha,
    dosha,
    tier: input.tier || current.tier || defaultProfile.tier,
    nudgeTime: notificationPreference.nudgeTime,
    notificationPreferences: notificationPreference,
    birthDate: input.birthDate || current.birthDate || defaultProfile.birthDate,
    birthTime: input.birthTime || current.birthTime || defaultProfile.birthTime,
    birthPlace: input.birthPlace || current.birthPlace || defaultProfile.birthPlace,
    timezone: input.timezone || current.timezone || defaultProfile.timezone,
    ayanamsha: input.ayanamsha || current.ayanamsha || onboardingOptions.defaultAyanamsha
  };
}

function analyticsIdFor(id) {
  return `an_${createHash("sha256").update(`analytics:${id}`).digest("hex").slice(0, 18)}`;
}

function createProfileRecord(input = {}, existingRecord) {
  const currentProfile = existingRecord ? profileFromRecord(existingRecord) : {};
  const profile = normalizeProfile(input, currentProfile);
  const now = new Date().toISOString();
  const birthData = {
    birthDate: profile.birthDate,
    birthTime: profile.birthTime,
    birthPlace: profile.birthPlace,
    timezone: profile.timezone,
    ayanamsha: profile.ayanamsha,
    precisionMinutes: onboardingOptions.timePrecisionMinutes
  };
  return {
    schemaVersion: contractVersions.profile,
    id: profile.id,
    analyticsId: existingRecord?.analyticsId || analyticsIdFor(profile.id),
    publicProfile: {
      id: profile.id,
      name: profile.name,
      language: profile.language,
      lagna: profile.lagna,
      moonSign: profile.moonSign,
      dominantDosha: profile.dominantDosha,
      dosha: profile.dosha,
      tier: profile.tier,
      nudgeTime: profile.nudgeTime,
      notificationPreferences: profile.notificationPreferences
    },
    encryptedBirthData: encryptJSON(birthData),
    privacy: {
      birthDataEncrypted: true,
      encryption: "AES-256-GCM",
      analyticsIdSeparated: true,
      advertisingUse: "never",
      storage: "in-memory prototype store"
    },
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now
  };
}

function profileFromRecord(record) {
  if (!record) return defaultProfile;
  if (!record.encryptedBirthData) return normalizeProfile(record);
  const birthData = decryptJSON(record.encryptedBirthData);
  return {
    ...record.publicProfile,
    ...birthData,
    schemaVersion: record.schemaVersion,
    analyticsId: record.analyticsId,
    privacy: record.privacy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function profileEnvelope(userId = "demo") {
  const record = profiles.get(userId) || profiles.get("demo");
  const profile = profileFromRecord(record);
  return {
    schemaVersion: contractVersions.profile,
    profile,
    analytics: {
      subjectId: profile.id,
      analyticsId: record.analyticsId,
      containsBirthData: false
    },
    privacy: record.privacy,
    encryptedBirthData: {
      stored: true,
      algorithm: record.encryptedBirthData.algorithm
    },
    onboarding: {
      complete: onboardingOptions.requiredBirthFields.every((field) => Boolean(profile[field])),
      requiredBirthFields: onboardingOptions.requiredBirthFields,
      timePrecisionMinutes: onboardingOptions.timePrecisionMinutes
    }
  };
}

profiles.set("demo", createProfileRecord({
  ...defaultProfile,
  doshaAnswers: {
    body_frame: "Pitta",
    skin_temperature: "Pitta",
    digestion: "Pitta",
    stress_response: "Vata",
    sleep: "Vata",
    energy: "Pitta"
  }
}));

const languageMetadata = {
  English: { code: "en", locale: "en-IN", script: "Latin", nativeName: "English", status: "production-ready" },
  Hindi: { code: "hi", locale: "hi-IN", script: "Devanagari", nativeName: "हिन्दी", status: "production-ready" },
  Tamil: { code: "ta", locale: "ta-IN", script: "Tamil", nativeName: "தமிழ்", status: "pilot-ready" },
  Telugu: { code: "te", locale: "te-IN", script: "Telugu", nativeName: "తెలుగు", status: "pilot-ready" }
};

function languageProfile(language = "English") {
  const match = Object.keys(languageMetadata).find((item) => item.toLowerCase() === String(language).toLowerCase());
  const name = match || "English";
  return { name, ...languageMetadata[name] };
}

const localizationCatalog = {
  en: {
    planets: {
      Sun: "Sun",
      Moon: "Moon",
      Mars: "Mars",
      Mercury: "Mercury",
      Jupiter: "Jupiter",
      Venus: "Venus",
      Saturn: "Saturn",
      Rahu: "Rahu",
      Ketu: "Ketu"
    },
    weekdays: {
      Sunday: "Sunday",
      Monday: "Monday",
      Tuesday: "Tuesday",
      Wednesday: "Wednesday",
      Thursday: "Thursday",
      Friday: "Friday",
      Saturday: "Saturday"
    },
    severity: {
      critical: "Critical",
      advisory: "Advisory",
      positive: "Positive",
      monitoring: "Monitoring",
      High: "High",
      Medium: "Medium",
      Positive: "Positive",
      "90-day preparation": "90-day preparation",
      "30-day watch": "30-day watch",
      "7-day precision check": "7-day precision check",
      "Active alert": "Active alert",
      Monitoring: "Monitoring",
      "Steady monitoring": "Steady monitoring",
      Heightened: "Heightened",
      Advisory: "Advisory",
      Critical: "Critical",
      Balanced: "Balanced",
      "Advisory Alert": "Advisory Alert",
      "Critical Health Window": "Critical Health Window"
    },
    disclaimers: {
      global: "Jyotish Arogya shows astrology-based wellness tendencies, not diagnosis. Seek qualified medical care for symptoms, pain, distress, or urgent concerns. In India, call 112 for immediate danger or Tele-MANAS 14416 / 1800-89-14416 for 24/7 mental-health support.",
      highRiskAlert: "High-risk windows are preparation prompts, not medical predictions. Consult a qualified physician for persistent, severe, new, or worrying symptoms.",
      remedy: "Remedies are complementary wellness practices and do not replace diagnosis, medication, emergency care, or professional treatment.",
      gemstone: "Consult a qualified Jyotishi before wearing gemstones. Incorrect gemstones can amplify problems and do not guarantee treatment outcomes.",
      mentalHealth: "If distress, self-harm thoughts, panic, or severe mood symptoms appear, seek emergency care. In India call 112 for immediate danger, Tele-MANAS 14416 / 1800-89-14416 for 24/7 support, KIRAN 1800-599-0019, or iCALL +91 9152987821.",
      report: "Reports are designed for integrative discussion and should be reviewed alongside clinical history, symptoms, and physician advice."
    },
    categories: {
      Mantra: "Mantra",
      Lifestyle: "Lifestyle",
      Dietary: "Dietary",
      Ayurvedic: "Ayurvedic",
      Ritual: "Ritual",
      Dana: "Dana",
      "Expert Review": "Expert Review"
    },
    transits: {
      "saturn-8th": {
        title: "Saturn pressure on chronic-health houses",
        body: "Lower vitality and joint stiffness may show up during this window. Keep a medical check-up on the calendar if symptoms persist.",
        window: "30 days",
        cta: "Open Sade Sati protocol"
      },
      "mars-6th": {
        title: "Mars activates the 6th house",
        body: "A short inflammatory spike is possible. Avoid excessive heat, rushed workouts, and self-medication.",
        window: "3 days",
        cta: "View cooling diet"
      },
      "jupiter-moon": {
        title: "Jupiter supports the natal Moon",
        body: "A supportive emotional recovery signal. Good day to restart a sustainable health practice.",
        window: "7 days",
        cta: "Start routine"
      }
    },
    weekdayGuidance: {
      Sunday: { ruler: "Sun", title: "Cardio clarity day", body: "Keep the morning light and movement gentle. Favor eye rest, hydration, and a lighter dinner.", action: "Take a 20 minute walk before noon.", domain: "Heart and eyes" },
      Monday: { ruler: "Moon", title: "Mind and fluids reset", body: "Reduce processed sugar and give your nervous system a quieter start. Emotional weather can feel louder today.", action: "Do 7 minutes of slow breathing after breakfast.", domain: "Mind, lungs, lymph" },
      Tuesday: { ruler: "Mars", title: "Inflammation watch", body: "Mars is the loudest health signal today. Cooling foods, patient driving, and clean exercise form matter.", action: "Add coconut water, cucumber, or coriander to one meal.", domain: "Blood and muscles" },
      Wednesday: { ruler: "Mercury", title: "Gut and nerve tuning", body: "Mercury favors clean information and clean digestion. Screen breaks will help your sleep later.", action: "Protect one screen-free hour before bed.", domain: "Nerves and gut" },
      Thursday: { ruler: "Jupiter", title: "Metabolic steadiness", body: "Good day to begin a health routine, but avoid over-indulgence. The liver prefers simplicity.", action: "Choose a warm, light lunch and pause snacks after sunset.", domain: "Liver and metabolism" },
      Friday: { ruler: "Venus", title: "Hydration and hormones", body: "Venus brings attention to kidney, throat, and reproductive balance. Soft routines work better than force.", action: "Track 8 glasses of water and reduce excess salt.", domain: "Kidney and hormones" },
      Saturday: { ruler: "Saturn", title: "Joint care protocol", body: "Saturn rewards structure. Warmth, mobility, and measured effort protect the joints today.", action: "Do 12 minutes of slow mobility with warm oil self-massage.", domain: "Bones and joints" }
    },
    remedies: {},
    remedyPlan: {
      objective: "Create a safe, engaging 90-day remedy habit loop that connects Jyotish guidance with practical wellness nudges and reviewed marketplace recommendations.",
      phases: {
        foundation: "Morning mantra, light exposure, sleep wind-down, and Saturn mobility baseline",
        stabilize: "Add digestive rhythm, high-Mars cooling plate, and weekly dana",
        deepen: "Maintain adherence, review sensitive windows, and escalate clinician/Jyotishi gates when needed"
      },
      productSafety: "Products are optional support items. The remedy still works as a habit nudge even when a product is skipped.",
      partnerRefresh: "Partner apps must re-check price, pincode delivery ETA, stock, warnings, and substitutions before checkout.",
      slaMode: "pincode-dependent",
      maintainCadence: "Maintain cadence",
      nextActionPrefix: "Do next",
      priceSla: "Refresh product price and availability within 24 hours before showing a buy CTA.",
      fulfillmentSla: "Live delivery ETA requires user's pincode and current PharmEasy stock check.",
      checkoutRule: "Open PharmEasy before checkout for stock, substitutions, discounts, and delivery time."
    },
    nudge: {
      hydrate: "Hydrate before caffeine",
      remedy: "Complete today's remedy step",
      bodySignal: "Log one body signal",
      doctorReview: "Schedule or confirm a health review",
      doctorTitle: "Doctor review nudge",
      doctorBody: "TIA is above 7 today. If symptoms are persistent, new, severe, or worrying, schedule a qualified medical review.",
      highDasha: "Nudge intensity increased because DRS is high.",
      monitoringDasha: "Dasha remains in monitoring mode.",
      transitCritical: "Transit alert raises care-forward priority.",
      transitMonitoring: "Transit signal supports steady monitoring.",
      horaAdvice: (planet) => `${planet} hora is active; keep the health action aligned with ${planet.toLowerCase()} energy.`
    },
    weeklyForecast: {
      focusAreas: ["Joints and recovery", "Gut and sleep rhythm"],
      highSensitivityDays: ["Tuesday", "Saturday"],
      practice: "Alternate-nostril breathing for 7 minutes before sleep.",
      remedyUpdate: "Continue Saturn mobility ritual; add Mars cooling plate on Tuesday."
    }
  },
  hi: {
    planets: {
      Sun: "सूर्य",
      Moon: "चंद्र",
      Mars: "मंगल",
      Mercury: "बुध",
      Jupiter: "गुरु",
      Venus: "शुक्र",
      Saturn: "शनि",
      Rahu: "राहु",
      Ketu: "केतु"
    },
    weekdays: {
      Sunday: "रविवार",
      Monday: "सोमवार",
      Tuesday: "मंगलवार",
      Wednesday: "बुधवार",
      Thursday: "गुरुवार",
      Friday: "शुक्रवार",
      Saturday: "शनिवार"
    },
    severity: {
      critical: "गंभीर",
      advisory: "सलाह",
      positive: "सहायक",
      monitoring: "निगरानी",
      High: "उच्च",
      Medium: "मध्यम",
      Positive: "सकारात्मक",
      "90-day preparation": "90 दिन की तैयारी",
      "30-day watch": "30 दिन की निगरानी",
      "7-day precision check": "7 दिन की सटीक जांच",
      "Active alert": "सक्रिय अलर्ट",
      Monitoring: "निगरानी",
      "Steady monitoring": "स्थिर निगरानी",
      Heightened: "बढ़ा हुआ",
      Advisory: "सलाह",
      Critical: "गंभीर",
      Balanced: "संतुलित",
      "Advisory Alert": "सलाह अलर्ट",
      "Critical Health Window": "महत्वपूर्ण स्वास्थ्य अवधि"
    },
    disclaimers: {
      global: "ज्योतिष आरोग्य ज्योतिष-आधारित स्वास्थ्य प्रवृत्तियां दिखाता है, निदान नहीं। लक्षण, दर्द, मानसिक परेशानी या आपात चिंता में योग्य चिकित्सक से संपर्क करें। भारत में तुरंत खतरे पर 112, और 24/7 मानसिक-स्वास्थ्य सहायता के लिए टेली-मानस 14416 / 1800-89-14416 पर कॉल करें।",
      highRiskAlert: "उच्च-जोखिम अवधियां तैयारी के संकेत हैं, चिकित्सा भविष्यवाणी नहीं। लगातार, गंभीर, नए या चिंताजनक लक्षणों में योग्य चिकित्सक से सलाह लें।",
      remedy: "उपाय पूरक वेलनेस अभ्यास हैं; वे निदान, दवा, आपात सेवा या पेशेवर उपचार की जगह नहीं लेते।",
      gemstone: "रत्न पहनने से पहले योग्य ज्योतिषी से सलाह लें। गलत रत्न समस्या बढ़ा सकते हैं और उपचार की गारंटी नहीं देते।",
      mentalHealth: "यदि गहरी परेशानी, स्वयं को नुकसान पहुंचाने के विचार, घबराहट या गंभीर मनोदशा लक्षण हों, तो आपात सहायता लें। भारत में तुरंत खतरे पर 112, 24/7 सहायता के लिए टेली-मानस 14416 / 1800-89-14416, किरण 1800-599-0019 या iCALL +91 9152987821 पर संपर्क करें।",
      report: "रिपोर्ट समग्र चर्चा के लिए है और इसे चिकित्सकीय इतिहास, लक्षणों तथा चिकित्सक की सलाह के साथ देखा जाना चाहिए।"
    },
    categories: {
      Mantra: "मंत्र",
      Lifestyle: "जीवनशैली",
      Dietary: "आहार",
      Ayurvedic: "आयुर्वेदिक",
      Ritual: "अनुष्ठान",
      Dana: "दान",
      "Expert Review": "विशेषज्ञ समीक्षा"
    },
    transits: {
      "saturn-8th": {
        title: "दीर्घकालिक स्वास्थ्य भावों पर शनि का दबाव",
        body: "इस अवधि में ऊर्जा कम और जोड़ों में जकड़न महसूस हो सकती है। लक्षण बने रहें तो मेडिकल चेक-अप कैलेंडर में रखें।",
        window: "30 दिन",
        cta: "साढ़ेसाती प्रोटोकॉल खोलें"
      },
      "mars-6th": {
        title: "मंगल छठे भाव को सक्रिय करता है",
        body: "सूजन की छोटी लहर संभव है। अधिक गर्मी, जल्दबाजी वाले व्यायाम और स्वयं दवा लेने से बचें।",
        window: "3 दिन",
        cta: "शीतल आहार देखें"
      },
      "jupiter-moon": {
        title: "गुरु जन्म चंद्र को सहारा देता है",
        body: "भावनात्मक रिकवरी के लिए सहायक संकेत है। टिकाऊ स्वास्थ्य अभ्यास फिर शुरू करने के लिए अच्छा दिन है।",
        window: "7 दिन",
        cta: "रूटीन शुरू करें"
      }
    },
    weekdayGuidance: {
      Sunday: { ruler: "Sun", title: "हृदय स्पष्टता दिवस", body: "सुबह की रोशनी और चाल को हल्का रखें। आंखों को आराम, जल सेवन और हल्का रात्रि भोजन चुनें।", action: "दोपहर से पहले 20 मिनट टहलें।", domain: "हृदय और आंखें" },
      Monday: { ruler: "Moon", title: "मन और द्रव संतुलन", body: "प्रोसेस्ड चीनी कम करें और तंत्रिका तंत्र को शांत शुरुआत दें। भावनाएं आज अधिक तीव्र लग सकती हैं।", action: "नाश्ते के बाद 7 मिनट धीमी सांस लें।", domain: "मन, फेफड़े, लसीका" },
      Tuesday: { ruler: "Mars", title: "सूजन पर नजर", body: "आज मंगल स्वास्थ्य संकेत को तेज करता है। शीतल भोजन, धैर्यपूर्ण ड्राइविंग और साफ व्यायाम तकनीक महत्वपूर्ण हैं।", action: "एक भोजन में नारियल पानी, खीरा या धनिया जोड़ें।", domain: "रक्त और मांसपेशियां" },
      Wednesday: { ruler: "Mercury", title: "आंत और नस संतुलन", body: "बुध साफ जानकारी और साफ पाचन को सहारा देता है। स्क्रीन ब्रेक रात की नींद में मदद करेंगे।", action: "सोने से पहले एक घंटा स्क्रीन-मुक्त रखें।", domain: "नसें और आंत" },
      Thursday: { ruler: "Jupiter", title: "मेटाबॉलिक स्थिरता", body: "स्वास्थ्य रूटीन शुरू करने का अच्छा दिन है, पर अति से बचें। यकृत सादगी पसंद करता है।", action: "गरम हल्का दोपहर भोजन लें और सूर्यास्त के बाद स्नैक्स रोकें।", domain: "यकृत और मेटाबॉलिज्म" },
      Friday: { ruler: "Venus", title: "जल और हार्मोन संतुलन", body: "शुक्र किडनी, गले और प्रजनन संतुलन पर ध्यान लाता है। नरम रूटीन बल से बेहतर है।", action: "8 गिलास पानी ट्रैक करें और अतिरिक्त नमक घटाएं।", domain: "किडनी और हार्मोन" },
      Saturday: { ruler: "Saturn", title: "जोड़ों की देखभाल", body: "शनि संरचना को पुरस्कृत करता है। गर्माहट, गतिशीलता और नपा-तुला प्रयास जोड़ों की रक्षा करते हैं।", action: "गरम तेल स्व-मालिश के साथ 12 मिनट धीमी मोबिलिटी करें।", domain: "हड्डियां और जोड़" }
    },
    remedies: {
      "sun-mantra": { title: "सूर्य ग्राउंडिंग", cadence: "हर सुबह", detail: "सूर्योदय के बाद 21 बार ओम सूर्य नमः जपें। इसे सुरक्षित सुबह की रोशनी के साथ जोड़ें।", safety: "यह देखभाल का पूरक है; यह हृदय उपचार नहीं है।", phase: "आधार", effort: "4 मिनट" },
      "saturn-mobility": { title: "जोड़ों की गरमाहट विधि", cadence: "शनिवार और उच्च शनि दिनों में", detail: "गरम तिल तेल से स्व-मालिश के बाद हल्की मोबिलिटी करें। ठंड और नमी से बचें।", safety: "तेज दर्द देने वाली गतिविधि रोक दें।", phase: "स्थिरता", effort: "12 मिनट" },
      "mars-diet": { title: "शीतल पित्त थाली", cadence: "उच्च मंगल दिनों में", detail: "खीरा, धनिया, नारियल पानी और हल्दी चुनें। अधिक मसाला और शराब कम करें।", safety: "आहार सलाह सामान्य है और चिकित्सकीय प्रतिबंधों का सम्मान करना चाहिए।", phase: "शीतलता", effort: "भोजन चयन" },
      "mercury-gut-reset": { title: "आंत लय रीसेट", cadence: "बुध दिनों या धीमे पाचन के समय", detail: "रात का भोजन जल्दी रखें, जल सेवन स्थिर रखें, और केवल हल्के गैर-आपात लक्षणों में आयुर्वेदिक पाचन समर्थन की समीक्षा करें।", safety: "तेज दर्द, रक्तस्राव, निर्जलीकरण, बुखार, गर्भावस्था चिंता या अस्पष्ट वजन घटने में जड़ी-बूटी का उपयोग न करें।", phase: "पाचन लय", effort: "चिकित्सक समीक्षा" },
      "moon-sleep-ritual": { title: "चंद्र नींद विराम", cadence: "हर रात भोजन के बाद", detail: "रोशनी कम करें, एक चिंता लिखें, और सोने से पहले 7 मिनट अनुलोम-विलोम करें।", safety: "लगातार अनिद्रा, घबराहट या उदासी में मानसिक-स्वास्थ्य या चिकित्सा सहायता जरूरी है।", phase: "नींद सुधार", effort: "10 मिनट" },
      "jupiter-dana-kit": { title: "गुरुवार पोषण दान", cadence: "गुरुवार या गुरु होरा", detail: "किसी जरूरतमंद को सरल पोषण-सहायता किट दें या भरोसेमंद स्थानीय माध्यम से पैंट्री सामग्री प्रायोजित करें।", safety: "दान उपाय स्वैच्छिक, किफायती और चिकित्सा दावों से मुक्त होने चाहिए।", phase: "सेवा", effort: "साप्ताहिक कार्य" },
      "gemstone-review": { title: "रत्न उपयुक्तता जांच", cadence: "कोई भी रत्न पहनने से पहले", detail: "नीलम और समान रत्नों के लिए योग्य ज्योतिषी की समीक्षा और स्वास्थ्य-सुरक्षा अस्वीकरण जरूरी है।", safety: "गलत रत्न समस्याएं बढ़ा सकते हैं; इन्हें इलाज की तरह कभी न लें।", phase: "सुरक्षा गेट", effort: "परामर्श" }
    },
    remedyPlan: {
      objective: "ज्योतिष मार्गदर्शन को व्यावहारिक वेलनेस नज, सुरक्षित आदतों और समीक्षा किए गए marketplace सुझावों से जोड़ने वाला 90 दिन का उपाय लूप बनाना।",
      phases: {
        foundation: "सुबह मंत्र, प्रकाश, नींद विराम और शनि मोबिलिटी आधार",
        stabilize: "पाचन लय, उच्च-मंगल शीतल थाली और साप्ताहिक दान जोड़ें",
        deepen: "पालन बनाए रखें, संवेदनशील अवधियां देखें और चिकित्सक/ज्योतिषी गेट पर आगे बढ़ें"
      },
      productSafety: "उत्पाद वैकल्पिक सहायक वस्तुएं हैं। उत्पाद छोड़े जाने पर भी उपाय आदत नज की तरह काम करता है।",
      partnerRefresh: "पार्टनर ऐप checkout से पहले कीमत, पिनकोड डिलीवरी ETA, स्टॉक, चेतावनी और विकल्प फिर जांचें।",
      slaMode: "पिनकोड-आधारित",
      maintainCadence: "लय बनाए रखें",
      nextActionPrefix: "अगला कदम करें",
      priceSla: "Buy CTA दिखाने से 24 घंटे के भीतर उत्पाद कीमत और उपलब्धता फिर जांचें।",
      fulfillmentSla: "लाइव डिलीवरी ETA के लिए उपयोगकर्ता का पिनकोड और PharmEasy का मौजूदा स्टॉक जांचना जरूरी है।",
      checkoutRule: "स्टॉक, विकल्प, छूट और डिलीवरी समय के लिए checkout से पहले PharmEasy खोलें।"
    },
    nudge: {
      hydrate: "कैफीन से पहले पानी पिएं",
      remedy: "आज का उपाय कदम पूरा करें",
      bodySignal: "शरीर का एक संकेत दर्ज करें",
      doctorReview: "स्वास्थ्य समीक्षा शेड्यूल या पुष्टि करें",
      doctorTitle: "डॉक्टर समीक्षा नज",
      doctorBody: "आज TIA 7 से ऊपर है। लक्षण लगातार, नए, गंभीर या चिंताजनक हों तो योग्य चिकित्सक से समीक्षा कराएं।",
      highDasha: "DRS ऊंचा है, इसलिए नज की तीव्रता बढ़ाई गई है।",
      monitoringDasha: "दशा निगरानी मोड में है।",
      transitCritical: "गोचर अलर्ट care-forward प्राथमिकता बढ़ाता है।",
      transitMonitoring: "गोचर संकेत स्थिर निगरानी को सहारा देता है।",
      horaAdvice: (planet) => `${planet} होरा सक्रिय है; स्वास्थ्य कदम को ${planet} ऊर्जा के साथ संतुलित रखें।`
    },
    weeklyForecast: {
      focusAreas: ["जोड़ और रिकवरी", "आंत और नींद लय"],
      highSensitivityDays: ["मंगलवार", "शनिवार"],
      practice: "सोने से पहले 7 मिनट अनुलोम-विलोम।",
      remedyUpdate: "शनि मोबिलिटी विधि जारी रखें; मंगलवार को मंगल शीतल थाली जोड़ें।"
    }
  },
  ta: {
    planets: {
      Sun: "சூரியன்",
      Moon: "சந்திரன்",
      Mars: "செவ்வாய்",
      Mercury: "புதன்",
      Jupiter: "குரு",
      Venus: "சுக்கிரன்",
      Saturn: "சனி",
      Rahu: "ராகு",
      Ketu: "கேது"
    },
    weekdays: {
      Sunday: "ஞாயிறு",
      Monday: "திங்கள்",
      Tuesday: "செவ்வாய்",
      Wednesday: "புதன்",
      Thursday: "வியாழன்",
      Friday: "வெள்ளி",
      Saturday: "சனி"
    },
    severity: {
      critical: "முக்கியம்",
      advisory: "ஆலோசனை",
      positive: "ஆதரவு",
      monitoring: "கண்காணிப்பு",
      High: "உயர்",
      Medium: "நடுத்தரம்",
      Positive: "நல்ல",
      "90-day preparation": "90 நாள் தயாரிப்பு",
      "30-day watch": "30 நாள் கவனம்",
      "7-day precision check": "7 நாள் துல்லிய சோதனை",
      "Active alert": "செயலில் உள்ள எச்சரிக்கை",
      Monitoring: "கண்காணிப்பு",
      "Steady monitoring": "நிலையான கண்காணிப்பு",
      Heightened: "அதிகரித்தது",
      Advisory: "ஆலோசனை",
      Critical: "முக்கியம்",
      Balanced: "சமநிலை",
      "Advisory Alert": "ஆலோசனை எச்சரிக்கை",
      "Critical Health Window": "முக்கிய ஆரோக்கிய காலம்"
    },
    disclaimers: {
      global: "ஜ்யோதிஷ் ஆரோக்கியா ஜோதிட அடிப்படையிலான நலப் போக்குகளை காட்டுகிறது; இது நோயறிதல் அல்ல. அறிகுறி, வலி, மனஅழுத்தம் அல்லது அவசர கவலை இருந்தால் தகுதி பெற்ற மருத்துவரை அணுகவும். இந்தியாவில் உடனடி ஆபத்தில் 112, 24/7 மனநல உதவிக்கு Tele-MANAS 14416 / 1800-89-14416 அழைக்கவும்.",
      highRiskAlert: "உயர் அபாய காலங்கள் தயாரிப்பு நினைவூட்டல்கள்; மருத்துவ கணிப்பு அல்ல. நீடித்த, கடுமையான, புதிய அல்லது கவலை தரும் அறிகுறிகளுக்கு மருத்துவரை அணுகவும்.",
      remedy: "பரிகாரங்கள் துணை நலப் பயிற்சிகள்; அவை நோயறிதல், மருந்து, அவசர சிகிச்சை அல்லது தொழில்முறை சிகிச்சையை மாற்றாது.",
      gemstone: "ரத்தினம் அணிவதற்கு முன் தகுதி பெற்ற ஜோதிடரை அணுகவும். தவறான ரத்தினங்கள் பிரச்சினையை அதிகரிக்கலாம்; சிகிச்சை முடிவை உறுதி செய்யாது.",
      mentalHealth: "மிகுந்த மனஅழுத்தம், தன்னைத்தீங்குசெய்யும் எண்ணம், பயம் அல்லது கடுமையான மனநிலை அறிகுறிகள் இருந்தால் அவசர உதவி பெறவும். இந்தியாவில் உடனடி ஆபத்தில் 112, 24/7 உதவிக்கு Tele-MANAS 14416 / 1800-89-14416, KIRAN 1800-599-0019 அல்லது iCALL +91 9152987821.",
      report: "அறிக்கைகள் ஒருங்கிணைந்த விவாதத்திற்காக; மருத்துவ வரலாறு, அறிகுறிகள் மற்றும் மருத்துவர் ஆலோசனையுடன் பார்க்க வேண்டும்."
    },
    categories: {
      Mantra: "மந்திரம்",
      Lifestyle: "வாழ்க்கைமுறை",
      Dietary: "உணவு",
      Ayurvedic: "ஆயுர்வேதம்",
      Ritual: "சடங்கு",
      Dana: "தானம்",
      "Expert Review": "நிபுணர் மதிப்பீடு"
    },
    transits: {
      "saturn-8th": { title: "நீண்டகால ஆரோக்கிய வீடுகளில் சனி அழுத்தம்", body: "இந்த காலத்தில் உயிர்சக்தி குறைவு மற்றும் மூட்டு பிடிப்பு தோன்றலாம். அறிகுறிகள் நீடித்தால் மருத்துவ பரிசோதனையை திட்டமிடவும்.", window: "30 நாள்", cta: "சடே சதி நடைமுறையைத் திற" },
      "mars-6th": { title: "செவ்வாய் 6ஆம் வீட்டை செயலில் கொண்டுவருகிறது", body: "சிறிய அழற்சி உயர்வு சாத்தியம். அதிக வெப்பம், அவசர உடற்பயிற்சி மற்றும் சுயமருந்தைத் தவிர்க்கவும்.", window: "3 நாள்", cta: "குளிர்ச்சி உணவைப் பார்க்க" },
      "jupiter-moon": { title: "குரு பிறப்பு சந்திரனை ஆதரிக்கிறது", body: "உணர்ச்சி மீட்புக்கு ஆதரவான சிக்னல். நிலையான ஆரோக்கிய பழக்கத்தை மீண்டும் தொடங்க நல்ல நாள்.", window: "7 நாள்", cta: "ரூட்டீன் தொடங்கு" }
    },
    remedies: {
      "sun-mantra": { title: "சூரிய நிலைநிறுத்தல்", cadence: "தினமும் காலை", detail: "சூரியோதயத்திற்கு பின் ஓம் சூர்ய நமஹ 21 முறை ஜபிக்கவும். பாதுகாப்பான காலை வெளிச்சத்துடன் இணைக்கவும்.", safety: "இது பராமரிப்புக்கு துணை; இதய சிகிச்சை அல்ல.", phase: "அடித்தளம்", effort: "4 நிமிடம்" },
      "saturn-mobility": { title: "மூட்டு வெப்ப வழக்கம்", cadence: "சனி மற்றும் சனி உணர்வு நாட்களில்", detail: "வெதுவெதுப்பான எள் எண்ணெய் சுய மசாஜுக்குப் பிறகு மென்மையான இயக்கம் செய்யவும். குளிர், ஈரப்பதம் தவிர்க்கவும்.", safety: "கூர்மையான வலி தரும் இயக்கத்தை நிறுத்தவும்.", phase: "நிலைத்தன்மை", effort: "12 நிமிடம்" },
      "mars-diet": { title: "குளிர்ச்சி பித்த தட்டு", cadence: "உயர் செவ்வாய் நாட்களில்", detail: "வெள்ளரி, கொத்தமல்லி, இளநீர், மஞ்சள் தேர்வு செய்யவும். அதிக காரம் மற்றும் மதுபானம் குறைக்கவும்.", safety: "உணவு வழிகாட்டல் பொதுவானது; மருத்துவ கட்டுப்பாடுகளை மதிக்க வேண்டும்.", phase: "குளிர்ச்சி", effort: "உணவு தேர்வு" },
      "mercury-gut-reset": { title: "குடல் ரிதம் மீளமைப்பு", cadence: "புதன் நாட்கள் அல்லது மந்த ஜீரண நேரங்களில்", detail: "இரவு உணவை சீக்கிரம் முடிக்கவும், நீர் அருந்தலை சீராக வைத்துக் கொள்ளவும்; லேசான அவசரமற்ற அறிகுறிகளில் மட்டுமே ஆயுர்வேத ஜீரண ஆதரவை மதிப்பீடு செய்யவும்.", safety: "கடுமையான வலி, இரத்தப்போக்கு, நீரிழப்பு, காய்ச்சல், கர்ப்பம் சார்ந்த கவலை அல்லது காரணமற்ற எடை குறைவு இருந்தால் மூலிகை பயன்படுத்த வேண்டாம்.", phase: "ஜீரண ரிதம்", effort: "மருத்துவர் மதிப்பீடு" },
      "moon-sleep-ritual": { title: "சந்திர உறக்க தளர்வு", cadence: "தினமும் இரவு உணவுக்குப் பிறகு", detail: "விளக்கை குறைக்கவும், ஒரு கவலையை எழுதவும், உறங்கும் முன் 7 நிமிடம் மாற்று நாசி சுவாசம் செய்யவும்.", safety: "தொடரும் தூக்கமின்மை, பயம் அல்லது மனச்சோர்வு இருந்தால் மனநல அல்லது மருத்துவ உதவி தேவை.", phase: "உறக்க திருத்தம்", effort: "10 நிமிடம்" },
      "jupiter-dana-kit": { title: "வியாழன் ஊட்டச்சத்து தானம்", cadence: "வியாழன் அல்லது குரு ஹோரா", detail: "தேவையுள்ள ஒருவருக்கு எளிய ஊட்டச்சத்து ஆதரவு கிட்டை வழங்கவும் அல்லது நம்பகமான உள்ளூர் வழியில் உணவுப்பொருட்களை ஆதரிக்கவும்.", safety: "தான பரிகாரங்கள் விருப்பமானது, செலவுக்கேற்றது மற்றும் மருத்துவக் கோரிக்கையற்றது ஆக வேண்டும்.", phase: "சேவை", effort: "வாராந்த செயல்" },
      "gemstone-review": { title: "ரத்தின பொருத்தம் சோதனை", cadence: "எந்த ரத்தினமும் அணிவதற்கு முன்", detail: "நீல சபையர் போன்ற ரத்தினங்களுக்கு தகுதி பெற்ற ஜோதிடரின் மதிப்பீடும் ஆரோக்கிய பாதுகாப்பு விளக்கமும் அவசியம்.", safety: "தவறான ரத்தினங்கள் பிரச்சினையை அதிகரிக்கலாம்; சிகிச்சையாக பயன்படுத்த வேண்டாம்.", phase: "பாதுகாப்பு வாயில்", effort: "ஆலோசனை" }
    },
    remedyPlan: {
      objective: "ஜோதிட வழிகாட்டலை நடைமுறை நல நினைவூட்டல்கள், பாதுகாப்பான பழக்கங்கள் மற்றும் மதிப்பாய்வு செய்யப்பட்ட marketplace பரிந்துரைகளுடன் இணைக்கும் 90 நாள் பரிகார பழக்கத்தை உருவாக்குதல்.",
      phases: { foundation: "காலை மந்திரம், வெளிச்சம், உறக்க தளர்வு, சனி இயக்க அடித்தளம்", stabilize: "ஜீரண ரிதம், உயர் செவ்வாய் குளிர்ச்சி உணவு, வாராந்த தானம் சேர்க்கவும்", deepen: "பின்பற்றலை தொடரவும், உணர்வு காலங்களை பார்க்கவும், மருத்துவர்/ஜோதிடர் பாதுகாப்பு வாயில்களை உயர்த்தவும்" },
      productSafety: "பொருட்கள் விருப்ப துணை பொருட்கள். பொருள் தவிர்க்கப்பட்டாலும் பரிகாரம் பழக்க நினைவூட்டலாக தொடரும்.",
      partnerRefresh: "பார்ட்னர் ஆப்கள் checkout முன் விலை, பின்கோடு டெலிவரி ETA, இருப்பு, எச்சரிக்கை, மாற்று பொருட்களை மீண்டும் சரிபார்க்க வேண்டும்.",
      slaMode: "பின்கோடு சார்ந்தது",
      maintainCadence: "ரிதத்தை தொடரவும்",
      nextActionPrefix: "அடுத்த படி செய்யவும்",
      priceSla: "Buy CTA காட்டுவதற்கு 24 மணி நேரத்திற்குள் பொருள் விலை மற்றும் கிடைப்பை மீண்டும் சரிபார்க்கவும்.",
      fulfillmentSla: "நேரடி டெலிவரி ETAக்கு பயனரின் பின்கோடு மற்றும் தற்போதைய PharmEasy இருப்பு தேவை.",
      checkoutRule: "இருப்பு, மாற்று, தள்ளுபடி, டெலிவரி நேரத்திற்காக checkout முன் PharmEasy திறக்கவும்."
    },
    nudge: {
      hydrate: "காஃபீனுக்கு முன் நீர் அருந்தவும்",
      remedy: "இன்றைய பரிகார படியை முடிக்கவும்",
      bodySignal: "ஒரு உடல் சிக்னலை பதிவு செய்யவும்",
      doctorReview: "ஆரோக்கிய மதிப்பீட்டை திட்டமிடவும் அல்லது உறுதிசெய்யவும்",
      doctorTitle: "மருத்துவர் மதிப்பீடு நினைவூட்டல்",
      doctorBody: "இன்று TIA 7க்கு மேல் உள்ளது. அறிகுறிகள் நீடித்தால், புதியதாக, கடுமையாக அல்லது கவலையாக இருந்தால் தகுதி பெற்ற மருத்துவரை அணுகவும்.",
      highDasha: "DRS உயர்ந்ததால் நினைவூட்டல் தீவிரம் அதிகரிக்கப்பட்டது.",
      monitoringDasha: "தசை கண்காணிப்பு நிலையில் உள்ளது.",
      transitCritical: "கோச்சார எச்சரிக்கை care-forward முன்னுரிமையை உயர்த்துகிறது.",
      transitMonitoring: "கோச்சார சிக்னல் நிலையான கண்காணிப்பை ஆதரிக்கிறது.",
      horaAdvice: (planet) => `${planet} ஹோரா செயலில் உள்ளது; ஆரோக்கிய செயலை ${planet} சக்தியுடன் சமநிலைப்படுத்தவும்.`
    },
    weeklyForecast: {
      focusAreas: ["மூட்டு மற்றும் மீட்பு", "குடல் மற்றும் உறக்க ரிதம்"],
      highSensitivityDays: ["செவ்வாய்", "சனி"],
      practice: "உறங்கும் முன் 7 நிமிடம் மாற்று நாசி சுவாசம்.",
      remedyUpdate: "சனி இயக்க வழக்கத்தைத் தொடரவும்; செவ்வாய்க்கிழமை குளிர்ச்சி உணவைச் சேர்க்கவும்."
    }
  },
  te: {
    planets: {
      Sun: "సూర్యుడు",
      Moon: "చంద్రుడు",
      Mars: "కుజుడు",
      Mercury: "బుధుడు",
      Jupiter: "గురుడు",
      Venus: "శుక్రుడు",
      Saturn: "శని",
      Rahu: "రాహు",
      Ketu: "కేతు"
    },
    weekdays: {
      Sunday: "ఆదివారం",
      Monday: "సోమవారం",
      Tuesday: "మంగళవారం",
      Wednesday: "బుధవారం",
      Thursday: "గురువారం",
      Friday: "శుక్రవారం",
      Saturday: "శనివారం"
    },
    severity: {
      critical: "కీలకం",
      advisory: "సూచన",
      positive: "సానుకూలం",
      monitoring: "పర్యవేక్షణ",
      High: "అధిక",
      Medium: "మధ్యస్థ",
      Positive: "సానుకూలం",
      "90-day preparation": "90 రోజుల సిద్ధత",
      "30-day watch": "30 రోజుల గమనిక",
      "7-day precision check": "7 రోజుల ఖచ్చిత తనిఖీ",
      "Active alert": "సక్రియ హెచ్చరిక",
      Monitoring: "పర్యవేక్షణ",
      "Steady monitoring": "స్థిర పర్యవేక్షణ",
      Heightened: "పెరిగిన",
      Advisory: "సూచన",
      Critical: "కీలకం",
      Balanced: "సమతుల్యం",
      "Advisory Alert": "సూచన హెచ్చరిక",
      "Critical Health Window": "కీలక ఆరోగ్య కాలం"
    },
    disclaimers: {
      global: "జ్యోతిష్ ఆరోగ్య జ్యోతిష్య ఆధారిత వెల్‌నెస్ ధోరణులను చూపుతుంది; ఇది నిర్ధారణ కాదు. లక్షణాలు, నొప్పి, మానసిక ఇబ్బంది లేదా అత్యవసర ఆందోళన ఉంటే అర్హత కలిగిన వైద్యుడిని సంప్రదించండి. భారతదేశంలో తక్షణ ప్రమాదానికి 112, 24/7 మానసిక ఆరోగ్య సహాయానికి Tele-MANAS 14416 / 1800-89-14416 కు కాల్ చేయండి.",
      highRiskAlert: "అధిక ప్రమాద కాలాలు సిద్ధత గుర్తింపులు మాత్రమే; వైద్య భవిష్యవాణి కాదు. కొనసాగుతున్న, తీవ్రమైన, కొత్త లేదా ఆందోళనకర లక్షణాలకు వైద్యుడిని సంప్రదించండి.",
      remedy: "పరిహారాలు పూరక వెల్‌నెస్ పద్ధతులు; అవి నిర్ధారణ, మందులు, అత్యవసర సంరక్షణ లేదా వృత్తిపరమైన చికిత్సను భర్తీ చేయవు.",
      gemstone: "రత్నాలు ధరించే ముందు అర్హత కలిగిన జ్యోతిష్యుడిని సంప్రదించండి. తప్పు రత్నాలు సమస్యలను పెంచవచ్చు; చికిత్స ఫలితాలను హామీ ఇవ్వవు.",
      mentalHealth: "తీవ్ర మానసిక ఇబ్బంది, స్వీయహాని ఆలోచనలు, పానిక్ లేదా తీవ్రమైన మూడ్ లక్షణాలు ఉంటే అత్యవసర సహాయం పొందండి. భారతదేశంలో తక్షణ ప్రమాదానికి 112, 24/7 సహాయానికి Tele-MANAS 14416 / 1800-89-14416, KIRAN 1800-599-0019 లేదా iCALL +91 9152987821.",
      report: "రిపోర్టులు సమగ్ర చర్చ కోసం; వైద్య చరిత్ర, లక్షణాలు మరియు వైద్యుడి సలహాతో కలిసి సమీక్షించాలి."
    },
    categories: {
      Mantra: "మంత్రం",
      Lifestyle: "జీవనశైలి",
      Dietary: "ఆహారం",
      Ayurvedic: "ఆయుర్వేదం",
      Ritual: "ఆచారం",
      Dana: "దానం",
      "Expert Review": "నిపుణుల సమీక్ష"
    },
    transits: {
      "saturn-8th": { title: "దీర్ఘకాల ఆరోగ్య భావాలపై శని ఒత్తిడి", body: "ఈ సమయంలో శక్తి తగ్గడం మరియు కీళ్ల గట్టితనం కనిపించవచ్చు. లక్షణాలు కొనసాగితే వైద్య పరీక్షను క్యాలెండర్‌లో పెట్టుకోండి.", window: "30 రోజులు", cta: "సాడే సతి ప్రోటోకాల్ తెరవండి" },
      "mars-6th": { title: "కుజుడు 6వ భావాన్ని సక్రియం చేస్తున్నాడు", body: "చిన్న ఇన్‌ఫ్లమేషన్ పెరుగుదల సాధ్యం. అధిక వేడి, తొందరపాటు వ్యాయామం మరియు స్వయంగా మందులు వాడటం నివారించండి.", window: "3 రోజులు", cta: "చల్లని ఆహారం చూడండి" },
      "jupiter-moon": { title: "గురుడు జన్మ చంద్రుడికి మద్దతు ఇస్తున్నాడు", body: "భావోద్వేగ రికవరీకి మద్దతు ఇచ్చే సంకేతం. స్థిర ఆరోగ్య అలవాటును మళ్లీ మొదలుపెట్టడానికి మంచి రోజు.", window: "7 రోజులు", cta: "రూటీన్ ప్రారంభించండి" }
    },
    remedies: {
      "sun-mantra": { title: "సూర్య స్థిరీకరణ", cadence: "ప్రతి ఉదయం", detail: "సూర్యోదయం తర్వాత ఓం సూర్య నమః 21 సార్లు జపించండి. సురక్షితమైన ఉదయ కాంతితో కలపండి.", safety: "ఇది సంరక్షణకు పూరకం; ఇది హృదయ చికిత్స కాదు.", phase: "పునాది", effort: "4 నిమిషాలు" },
      "saturn-mobility": { title: "కీళ్ల వేడి ఆచారం", cadence: "శనివారం మరియు అధిక శని రోజుల్లో", detail: "వెచ్చని నువ్వుల నూనెతో స్వీయ మసాజ్ తర్వాత మృదువైన మొబిలిటీ చేయండి. చలి, తడి వాతావరణం నివారించండి.", safety: "తీవ్ర నొప్పి కలిగించే కదలికను ఆపండి.", phase: "స్థిరత్వం", effort: "12 నిమిషాలు" },
      "mars-diet": { title: "చల్లని పిత్త తాళి", cadence: "అధిక కుజ రోజుల్లో", detail: "దోసకాయ, కొత్తిమీర, కొబ్బరి నీరు, పసుపు ఎంచుకోండి. అధిక మసాలా మరియు మద్యం తగ్గించండి.", safety: "ఆహార మార్గదర్శనం సాధారణం; వైద్య పరిమితులను గౌరవించాలి.", phase: "చల్లదనం", effort: "ఆహార ఎంపిక" },
      "mercury-gut-reset": { title: "గట్ రిథమ్ రీసెట్", cadence: "బుధ రోజులు లేదా మందగించిన జీర్ణ సమయంలో", detail: "రాత్రి భోజనం త్వరగా చేయండి, నీరు స్థిరంగా తాగండి, మరియు స్వల్ప అత్యవసరంకాని లక్షణాల్లో మాత్రమే ఆయుర్వేద జీర్ణ సహాయాన్ని సమీక్షించండి.", safety: "తీవ్ర నొప్పి, రక్తస్రావం, డీహైడ్రేషన్, జ్వరం, గర్భధారణ ఆందోళన లేదా తెలియని బరువు తగ్గుదల ఉంటే మూలికలు వాడకండి.", phase: "జీర్ణ రిథమ్", effort: "వైద్య సమీక్ష" },
      "moon-sleep-ritual": { title: "చంద్ర నిద్ర విశ్రాంతి", cadence: "ప్రతి రాత్రి భోజనం తర్వాత", detail: "లైట్లు తగ్గించండి, ఒక ఆందోళనను రాయండి, నిద్రకు ముందు 7 నిమిషాలు ప్రత్యామ్నాయ నాసికా శ్వాస చేయండి.", safety: "కొనసాగే నిద్రలేమి, పానిక్ లేదా తక్కువ మూడ్‌కు మానసిక ఆరోగ్య లేదా వైద్య సహాయం అవసరం.", phase: "నిద్ర పునరుద్ధరణ", effort: "10 నిమిషాలు" },
      "jupiter-dana-kit": { title: "గురువారం పోషణ దానం", cadence: "గురువారం లేదా గురు హోరా", detail: "అవసరంలో ఉన్నవారికి సరళమైన పోషణ కిట్ ఇవ్వండి లేదా నమ్మదగిన స్థానిక మార్గంలో ప్యాంట్రీ వస్తువులను స్పాన్సర్ చేయండి.", safety: "దాన పరిహారాలు స్వచ్ఛందం, అందుబాటులో ఉండేవి మరియు వైద్య దావాల్లేనివి కావాలి.", phase: "సేవ", effort: "వారాంత చర్య" },
      "gemstone-review": { title: "రత్న అనుకూలత తనిఖీ", cadence: "ఏ రత్నం ధరించే ముందు", detail: "నీలం వంటి రత్నాలకు అర్హత కలిగిన జ్యోతిష్యుడి సమీక్ష మరియు ఆరోగ్య భద్రత వివరణ అవసరం.", safety: "తప్పు రత్నాలు సమస్యలు పెంచవచ్చు; చికిత్సగా ఎప్పుడూ వాడకండి.", phase: "భద్రత గేట్", effort: "సలహా" }
    },
    remedyPlan: {
      objective: "జ్యోతిష్య మార్గదర్శకాన్ని ఆచరణాత్మక వెల్‌నెస్ నజ్‌లు, సురక్షిత అలవాట్లు మరియు సమీక్షించిన marketplace సూచనలతో కలిపే 90 రోజుల పరిహార అలవాటు లూప్‌ను నిర్మించడం.",
      phases: { foundation: "ఉదయం మంత్రం, కాంతి, నిద్ర విశ్రాంతి మరియు శని మొబిలిటీ పునాది", stabilize: "జీర్ణ రిథమ్, అధిక కుజ చల్లని ఆహారం మరియు వారాంత దానం జోడించండి", deepen: "అనుసరణ కొనసాగించండి, సున్నిత కాలాలను సమీక్షించండి, వైద్యుడు/జ్యోతిష్యుడు గేట్లను ఎస్కలేట్ చేయండి" },
      productSafety: "ఉత్పత్తులు ఐచ్చిక సహాయక వస్తువులు. ఉత్పత్తిని వదిలినా పరిహారం అలవాటు నజ్‌గా పనిచేస్తుంది.",
      partnerRefresh: "పార్ట్నర్ యాప్స్ checkout ముందు ధర, పిన్‌కోడ్ డెలివరీ ETA, స్టాక్, హెచ్చరికలు మరియు ప్రత్యామ్నాయాలను మళ్లీ తనిఖీ చేయాలి.",
      slaMode: "పిన్‌కోడ్ ఆధారితం",
      maintainCadence: "రిథమ్ కొనసాగించండి",
      nextActionPrefix: "తదుపరి అడుగు చేయండి",
      priceSla: "Buy CTA చూపించే ముందు 24 గంటలలో ఉత్పత్తి ధర మరియు లభ్యతను మళ్లీ తనిఖీ చేయండి.",
      fulfillmentSla: "లైవ్ డెలివరీ ETAకు వినియోగదారుని పిన్‌కోడ్ మరియు ప్రస్తుత PharmEasy స్టాక్ తనిఖీ అవసరం.",
      checkoutRule: "స్టాక్, ప్రత్యామ్నాయాలు, డిస్కౌంట్లు, డెలివరీ సమయానికి checkout ముందు PharmEasy తెరవండి."
    },
    nudge: {
      hydrate: "కాఫీన్‌కు ముందు నీరు తాగండి",
      remedy: "ఈరోజు పరిహార అడుగును పూర్తి చేయండి",
      bodySignal: "ఒక శరీర సంకేతాన్ని నమోదు చేయండి",
      doctorReview: "ఆరోగ్య సమీక్షను షెడ్యూల్ లేదా నిర్ధారించండి",
      doctorTitle: "వైద్య సమీక్ష నజ్",
      doctorBody: "ఈరోజు TIA 7 కంటే ఎక్కువ. లక్షణాలు కొనసాగితే, కొత్తగా, తీవ్రంగా లేదా ఆందోళనగా ఉంటే అర్హత కలిగిన వైద్యుడిని సంప్రదించండి.",
      highDasha: "DRS ఎక్కువగా ఉండటం వల్ల నజ్ తీవ్రత పెరిగింది.",
      monitoringDasha: "దశ పర్యవేక్షణ మోడ్‌లో ఉంది.",
      transitCritical: "గోచార హెచ్చరిక care-forward ప్రాధాన్యతను పెంచుతుంది.",
      transitMonitoring: "గోచార సంకేతం స్థిర పర్యవేక్షణకు మద్దతు ఇస్తుంది.",
      horaAdvice: (planet) => `${planet} హోరా సక్రియంగా ఉంది; ఆరోగ్య చర్యను ${planet} శక్తితో సమతుల్యం చేయండి.`
    },
    weeklyForecast: {
      focusAreas: ["కీళ్లు మరియు రికవరీ", "గట్ మరియు నిద్ర రిథమ్"],
      highSensitivityDays: ["మంగళవారం", "శనివారం"],
      practice: "నిద్రకు ముందు 7 నిమిషాలు ప్రత్యామ్నాయ నాసికా శ్వాస.",
      remedyUpdate: "శని మొబిలిటీ ఆచారం కొనసాగించండి; మంగళవారం కుజ చల్లని ఆహారం జోడించండి."
    }
  }
};

function copyForLanguage(language = "English") {
  const profile = languageProfile(language);
  return localizationCatalog[profile.code] || localizationCatalog.en;
}

function localizePlanet(planet, language = "English") {
  return copyForLanguage(language).planets?.[planet] || localizationCatalog.en.planets[planet] || planet;
}

function localizeSeverity(value, language = "English") {
  return copyForLanguage(language).severity?.[value] || localizationCatalog.en.severity[value] || value;
}

function localizeDisclaimer(key, language = "English") {
  return copyForLanguage(language).disclaimers?.[key] || localizationCatalog.en.disclaimers[key] || disclaimerLibrary[key] || "";
}

function localizedDisclaimers(language = "English") {
  return Object.fromEntries(Object.keys(disclaimerLibrary).map((key) => [key, localizeDisclaimer(key, language)]));
}

function localizationEnvelope(language = "English") {
  const meta = languageProfile(language);
  const copy = copyForLanguage(language);
  return {
    schemaVersion: contractVersions.localization,
    language: meta.name,
    locale: meta.locale,
    code: meta.code,
    script: meta.script,
    nativeName: meta.nativeName,
    status: meta.status,
    coverage: ["planet-names", "weekday-nudges", "remedies", "safety-copy", "transit-alerts", "critical-windows", "product-guardrails"],
    planets: copy.planets,
    disclaimers: copy.disclaimers,
    contentReview: "Clinical and human-linguist review is required before production launch in each locale."
  };
}

const planetMatrix = [
  {
    planet: "Sun",
    organ: "Heart, spine, eyes",
    system: "Cardiovascular and immune regulation",
    dosha: "Pitta",
    color: "#ffb020"
  },
  {
    planet: "Moon",
    organ: "Mind, lungs, fluids",
    system: "Mental health, lymphatic and endocrine",
    dosha: "Kapha / Vata",
    color: "#6f8cff"
  },
  {
    planet: "Mars",
    organ: "Blood, muscles, marrow",
    system: "Inflammatory, muscular and surgical risk",
    dosha: "Pitta",
    color: "#ef5b5b"
  },
  {
    planet: "Mercury",
    organ: "Nerves, skin, intestines",
    system: "Neurological, gut and speech",
    dosha: "Vata / Pitta",
    color: "#12a297"
  },
  {
    planet: "Jupiter",
    organ: "Liver, fat tissue, arteries",
    system: "Endocrine, metabolic and arterial health",
    dosha: "Kapha",
    color: "#d89a00"
  },
  {
    planet: "Venus",
    organ: "Kidneys, throat, reproductive organs",
    system: "Renal, hormonal and reproductive health",
    dosha: "Kapha / Vata",
    color: "#c2619f"
  },
  {
    planet: "Saturn",
    organ: "Bones, joints, teeth, nerves",
    system: "Musculoskeletal and chronic disease",
    dosha: "Vata",
    color: "#3d5363"
  },
  {
    planet: "Rahu",
    organ: "Atypical disease patterns",
    system: "Neurological anomaly and addiction tendency",
    dosha: "Vata",
    color: "#7d6fd8"
  },
  {
    planet: "Ketu",
    organ: "Fever, parasites, immune mystery",
    system: "Spiritual crisis and immune irregularity",
    dosha: "Pitta / Vata",
    color: "#a66f3f"
  }
];

const weekdayGuidance = {
  Sunday: {
    ruler: "Sun",
    title: "Cardio clarity day",
    body: "Keep the morning light and movement gentle. Favor eye rest, hydration, and a lighter dinner.",
    action: "Take a 20 minute walk before noon.",
    domain: "Heart and eyes"
  },
  Monday: {
    ruler: "Moon",
    title: "Mind and fluids reset",
    body: "Reduce processed sugar and give your nervous system a quieter start. Emotional weather can feel louder today.",
    action: "Do 7 minutes of slow breathing after breakfast.",
    domain: "Mind, lungs, lymph"
  },
  Tuesday: {
    ruler: "Mars",
    title: "Inflammation watch",
    body: "Mars is the loudest health signal today. Cooling foods, patient driving, and clean exercise form matter.",
    action: "Add coconut water, cucumber, or coriander to one meal.",
    domain: "Blood and muscles"
  },
  Wednesday: {
    ruler: "Mercury",
    title: "Gut and nerve tuning",
    body: "Mercury favors clean information and clean digestion. Screen breaks will help your sleep later.",
    action: "Protect one screen-free hour before bed.",
    domain: "Nerves and gut"
  },
  Thursday: {
    ruler: "Jupiter",
    title: "Metabolic steadiness",
    body: "Good day to begin a health routine, but avoid over-indulgence. The liver prefers simplicity.",
    action: "Choose a warm, light lunch and pause snacks after sunset.",
    domain: "Liver and metabolism"
  },
  Friday: {
    ruler: "Venus",
    title: "Hydration and hormones",
    body: "Venus brings attention to kidney, throat, and reproductive balance. Soft routines work better than force.",
    action: "Track 8 glasses of water and reduce excess salt.",
    domain: "Kidney and hormones"
  },
  Saturday: {
    ruler: "Saturn",
    title: "Joint care protocol",
    body: "Saturn rewards structure. Warmth, mobility, and measured effort protect the joints today.",
    action: "Do 12 minutes of slow mobility with warm oil self-massage.",
    domain: "Bones and joints"
  }
};

const horaSequence = ["Sun", "Venus", "Mercury", "Moon", "Saturn", "Jupiter", "Mars"];
const weekdayLord = {
  Sunday: "Sun",
  Monday: "Moon",
  Tuesday: "Mars",
  Wednesday: "Mercury",
  Thursday: "Jupiter",
  Friday: "Venus",
  Saturday: "Saturn"
};

const nakshatraHealth = [
  { name: "Ashwini", ruler: "Ketu", note: "Healing and quick recovery; good for starting gentle care." },
  { name: "Bharani", ruler: "Venus", note: "Reproductive and digestive sensitivity; avoid overindulgence." },
  { name: "Krittika", ruler: "Sun", note: "Heat and inflammatory sensitivity; keep meals light." },
  { name: "Rohini", ruler: "Moon", note: "Nourishing day; good for steady Kapha-balanced routines." },
  { name: "Mrigashira", ruler: "Mars", note: "Restlessness and nervous tension; meditation helps." },
  { name: "Ardra", ruler: "Rahu", note: "Stormy emotional energy; watch chronic flare-ups." },
  { name: "Punarvasu", ruler: "Jupiter", note: "Renewal and immunity support; restart healthy habits." },
  { name: "Pushya", ruler: "Saturn", note: "Discipline, joints and bone care; structured routine wins." },
  { name: "Ashlesha", ruler: "Mercury", note: "Gut sensitivity; avoid toxins and heavy food." },
  { name: "Magha", ruler: "Ketu", note: "Ancestral body patterns; listen to old signals." },
  { name: "Purva Phalguni", ruler: "Venus", note: "Hormonal and rest balance; avoid excess luxury." },
  { name: "Uttara Phalguni", ruler: "Sun", note: "Vitality and spine support; pace exertion." },
  { name: "Hasta", ruler: "Moon", note: "Hands, nerves and routine care; small actions help." },
  { name: "Chitra", ruler: "Mars", note: "Heat and precision; avoid rushed physical effort." },
  { name: "Swati", ruler: "Rahu", note: "Vata winds rise; breath work and grounding help." },
  { name: "Vishakha", ruler: "Jupiter", note: "Metabolic focus; avoid pushing digestion." },
  { name: "Anuradha", ruler: "Saturn", note: "Circulation and discipline; steady movement is ideal." },
  { name: "Jyeshtha", ruler: "Mercury", note: "Head and ear sensitivity; reduce noise and stress." },
  { name: "Mula", ruler: "Ketu", note: "Deep detox signal; keep food and schedule simple." },
  { name: "Purva Ashadha", ruler: "Venus", note: "Hydration and reproductive balance; soften intensity." },
  { name: "Uttara Ashadha", ruler: "Sun", note: "Strong immunity signal; good for disciplined care." },
  { name: "Shravana", ruler: "Moon", note: "ENT and listening-to-body day; rest and reflection help." },
  { name: "Dhanishtha", ruler: "Mars", note: "Physical energy peak; exercise only if body feels steady." },
  { name: "Shatabhisha", ruler: "Rahu", note: "Hidden conditions may surface; diagnostic clarity day." },
  { name: "Purva Bhadrapada", ruler: "Jupiter", note: "Nervous and spiritual intensity; keep routines grounded." },
  { name: "Uttara Bhadrapada", ruler: "Saturn", note: "Deep rest and Vata care; avoid cold, damp exposure." },
  { name: "Revati", ruler: "Mercury", note: "Gentle recovery; feet, sleep and spiritual healing." }
];

const transitAlerts = [
  {
    id: "saturn-8th",
    tier: "critical",
    planet: "Saturn",
    title: "Saturn pressure on chronic-health houses",
    body: "Lower vitality and joint stiffness may show up during this window. Keep a medical check-up on the calendar if symptoms persist.",
    window: "30 days",
    cta: "Open Sade Sati protocol"
  },
  {
    id: "mars-6th",
    tier: "advisory",
    planet: "Mars",
    title: "Mars activates the 6th house",
    body: "A short inflammatory spike is possible. Avoid excessive heat, rushed workouts, and self-medication.",
    window: "3 days",
    cta: "View cooling diet"
  },
  {
    id: "jupiter-moon",
    tier: "positive",
    planet: "Jupiter",
    title: "Jupiter supports the natal Moon",
    body: "A supportive emotional recovery signal. Good day to restart a sustainable health practice.",
    window: "7 days",
    cta: "Start routine"
  }
];

const pharmeasyPriceLastChecked = "2026-05-23";

const pharmeasySla = Object.freeze({
  label: "Pincode-dependent",
  promise: "Live delivery ETA requires user's pincode and current PharmEasy stock check.",
  fulfillment: "Open PharmEasy before checkout for stock, substitutions, discounts, and delivery time.",
  dataFreshness: "Refresh price and availability within 24 hours before purchase.",
  sourceSignal: "PharmEasy search/category surfaces expose delivery after pincode selection."
});

function pharmeasyRecommendation(input) {
  return {
    provider: "PharmEasy Search",
    status: input.status || "recommended",
    searchQuery: input.searchQuery,
    name: input.name,
    brand: input.brand,
    price: {
      amount: input.amount,
      currency: "INR",
      display: input.amount === null ? "N/A" : `INR ${input.amount.toFixed(2)}`
    },
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType || "product-page",
    priceLastChecked: pharmeasyPriceLastChecked,
    reason: input.reason,
    dosageGuardrail: input.dosageGuardrail,
    sla: {
      ...pharmeasySla,
      label: input.slaLabel || pharmeasySla.label,
      promise: input.slaPromise || pharmeasySla.promise
    }
  };
}

const pharmeasyCatalog = {
  vitaminD3: pharmeasyRecommendation({
    searchQuery: "Pharmeasy Vitamin D3 Supports Bone Health Bottle Of 60",
    name: "Pharmeasy Vitamin D3 - Supports Bone Health - Bottle Of 60",
    brand: "PHARMEASY",
    amount: 218.88,
    sourceUrl: "https://pharmeasy.in/health-care/products/pharmeasy-vitamin-d3--60-capsule-3662023",
    reason: "Optional clinician-reviewed support when low sunlight or vitamin-D status is already being monitored.",
    dosageGuardrail: "Do not start supplements for cardiac, bone, pregnancy, kidney, or medication concerns without clinician advice."
  }),
  sesameOil: pharmeasyRecommendation({
    searchQuery: "Coco Crush Cold Pressed White Sesame Oil 100ml",
    name: "Coco Crush Cold Pressed White Sesame Oil - 100ml",
    brand: "COCO CRUSH",
    amount: 156,
    sourceUrl: "https://pharmeasy.in/health-care/products/coco-crush-cold-pressed-white-sesame-oil---100ml-4533346",
    reason: "Matches the Saturn mobility ritual for external warm self-massage when skin tolerates oil.",
    dosageGuardrail: "Patch test first. Avoid on wounds, rashes, fever, or inflamed skin."
  }),
  amlaJuice: pharmeasyRecommendation({
    searchQuery: "Kapiva Amla Health Juice Bottle Of 1 L",
    name: "Kapiva Amla Health Juice Bottle Of 1 L",
    brand: "KAPIVA",
    amount: 235.2,
    sourceUrl: "https://pharmeasy.in/health-care/products/kapiva-amla-juice-1-l-178890",
    reason: "Fits the Mars cooling diet module as a gentle, vitamin-C rich pantry option.",
    dosageGuardrail: "Avoid if it conflicts with diabetes, acidity, kidney, pregnancy, or medication advice."
  }),
  triphala: pharmeasyRecommendation({
    searchQuery: "Zandu Triphala Tab 30s digestive care",
    name: "Zandu Triphala Tab 30's",
    brand: "ZANDU",
    amount: 37.95,
    sourceUrl: "https://pharmeasy.in/health-care/digestive-care-14422",
    sourceType: "category-search",
    reason: "Supports the Mercury gut-rhythm remedy as an optional Ayurvedic digestive product.",
    dosageGuardrail: "Use only after checking bowel symptoms, pregnancy status, and medication interactions with a clinician."
  }),
  ashwagandha: pharmeasyRecommendation({
    searchQuery: "Zandu Ashwagandha Ayurvedic Veg Capsules Bottle Of 60",
    name: "Zandu Ashwagandha Ayurvedic Veg Capsules Bottle Of 60",
    brand: "ZANDU",
    amount: 180,
    sourceUrl: "https://pharmeasy.in/health-care/products/zandu-ashwagandha-ayurvedic-veg-capsules-bottle-of-60-232189",
    reason: "Maps to the Moon sleep-and-stress ritual as an optional adaptogen with review.",
    dosageGuardrail: "Avoid self-use in pregnancy, thyroid disorders, autoimmune conditions, sedative use, or active psychiatric care."
  }),
  multivitamin: pharmeasyRecommendation({
    searchQuery: "Pharmeasy Multivitamin Multimineral Immunity Booster Bottle Of 60",
    name: "Pharmeasy Multivitamin Multimineral - Immunity Booster - Bottle Of 60",
    brand: "PHARMEASY",
    amount: 266.17,
    sourceUrl: "https://pharmeasy.in/health-care/products/pharmeasy-multivitamin-multimineral---pack-of-60-3491142",
    reason: "Fits the Jupiter dana module as a general wellness-kit option after nutritional review.",
    dosageGuardrail: "Avoid duplicate supplements and check with a clinician for pregnancy, chronic illness, or medication use."
  }),
  noGemstone: pharmeasyRecommendation({
    status: "blocked",
    searchQuery: "blue sapphire gemstone health astrology PharmEasy",
    name: "No PharmEasy product recommended for gemstone remedy",
    brand: "Expert Jyotishi review required",
    amount: null,
    sourceUrl: "https://pharmeasy.in/",
    sourceType: "safety-gated-search",
    reason: "Gemstones are intentionally blocked from marketplace recommendation until a qualified Jyotishi reviews chart suitability.",
    dosageGuardrail: "Do not buy or wear Blue Sapphire, Hessonite, Cat's Eye, or similar gemstones as a health remedy without expert review.",
    slaLabel: "Blocked until review",
    slaPromise: "SLA starts only after expert approval; no product checkout is recommended in-app."
  })
};

const remedyPlan = [
  {
    id: "sun-mantra",
    category: "Mantra",
    planet: "Sun",
    phase: "Foundation",
    dayRange: "Day 1-90",
    durationDays: 90,
    effort: "4 min",
    title: "Surya grounding",
    cadence: "Daily morning",
    detail: "Chant Om Surya Namah 21 times after sunrise. Pair with safe morning light exposure.",
    safety: "Complements care; it is not a cardiac treatment.",
    productRecommendation: pharmeasyCatalog.vitaminD3
  },
  {
    id: "saturn-mobility",
    category: "Lifestyle",
    planet: "Saturn",
    phase: "Stability",
    dayRange: "Day 1-90",
    durationDays: 90,
    effort: "12 min",
    title: "Joint warmth ritual",
    cadence: "Saturday and high Saturn days",
    detail: "Warm sesame oil self-massage followed by gentle mobility. Avoid cold, damp exposure.",
    safety: "Stop movement that causes sharp pain.",
    productRecommendation: pharmeasyCatalog.sesameOil
  },
  {
    id: "mars-diet",
    category: "Dietary",
    planet: "Mars",
    phase: "Cooling",
    dayRange: "Day 1-45",
    durationDays: 45,
    effort: "Meal choice",
    title: "Cooling Pitta plate",
    cadence: "High Mars days",
    detail: "Favor cucumber, coriander, coconut water, and turmeric. Reduce excess spice and alcohol.",
    safety: "Diet guidance is general and should respect clinical restrictions.",
    productRecommendation: pharmeasyCatalog.amlaJuice
  },
  {
    id: "mercury-gut-reset",
    category: "Ayurvedic",
    planet: "Mercury",
    phase: "Digestive Rhythm",
    dayRange: "Day 15-60",
    durationDays: 46,
    effort: "Clinician-reviewed",
    title: "Gut rhythm reset",
    cadence: "Mercury days or sluggish digestion windows",
    detail: "Keep dinner early, hydrate steadily, and review an Ayurvedic digestive support only if symptoms are mild and non-urgent.",
    safety: "Do not use herbs for severe pain, bleeding, dehydration, fever, pregnancy concerns, or unexplained weight loss.",
    productRecommendation: pharmeasyCatalog.triphala
  },
  {
    id: "moon-sleep-ritual",
    category: "Ritual",
    planet: "Moon",
    phase: "Sleep Repair",
    dayRange: "Day 1-90",
    durationDays: 90,
    effort: "10 min",
    title: "Moon sleep wind-down",
    cadence: "Nightly after dinner",
    detail: "Dim lights, journal one worry, and practice 7 minutes of alternate-nostril breathing before sleep.",
    safety: "Persistent insomnia, panic, or low mood needs qualified mental-health or medical support.",
    productRecommendation: pharmeasyCatalog.ashwagandha
  },
  {
    id: "jupiter-dana-kit",
    category: "Dana",
    planet: "Jupiter",
    phase: "Service",
    dayRange: "Weekly",
    durationDays: 90,
    effort: "Weekly act",
    title: "Thursday nutrition dana",
    cadence: "Thursday or Guru hora",
    detail: "Offer a simple nutrition-support kit to someone in need, or sponsor pantry staples through a trusted local channel.",
    safety: "Donation remedies should remain voluntary, affordable, and free of medical claims.",
    productRecommendation: pharmeasyCatalog.multivitamin
  },
  {
    id: "gemstone-review",
    category: "Expert Review",
    planet: "Saturn",
    phase: "Gate",
    dayRange: "Before purchase",
    durationDays: 1,
    effort: "Consultation",
    title: "Gemstone suitability check",
    cadence: "Before wearing any ratna",
    detail: "Blue Sapphire and similar gemstones require a qualified Jyotishi review and health-safety disclaimer.",
    safety: "Incorrect gemstones can amplify problems; never use as a cure.",
    productRecommendation: pharmeasyCatalog.noGemstone
  }
];

localizationCatalog.en.remedies = Object.fromEntries(remedyPlan.map((item) => [item.id, {
  title: item.title,
  cadence: item.cadence,
  detail: item.detail,
  safety: item.safety,
  phase: item.phase,
  effort: item.effort
}]));

const disclaimerLibrary = {
  global: localizationCatalog.en.disclaimers.global,
  highRiskAlert: "High-risk windows are preparation prompts, not medical predictions. Consult a qualified physician for persistent or severe symptoms.",
  remedy: "Remedies are complementary wellness practices and do not replace diagnosis, medication, emergency care, or professional treatment.",
  gemstone: "Consult a qualified Jyotishi before wearing gemstones. Incorrect gemstones can amplify problems and do not guarantee treatment outcomes.",
  mentalHealth: localizationCatalog.en.disclaimers.mentalHealth,
  report: "Reports are designed for integrative discussion and should be reviewed alongside clinical history, symptoms, and physician advice."
};

const languageRollout = {
  primary: ["English", "Hindi"],
  next: ["Tamil", "Telugu"],
  later: ["Bengali", "Kannada"],
  defaultLanguage: "English",
  supported: Object.keys(languageMetadata),
  localeMap: languageMetadata,
  localizationRule: "Planet names, remedy names, alert copy, product guardrails, and disclaimers must be localized together before a language is production-ready."
};

const safetyPolicy = {
  version: contractVersions.safety,
  mode: "medical-complementary-guidance",
  principles: [
    { id: "EG-001", title: "Medical care first", rule: "Never discourage users from seeking qualified medical care." },
    { id: "EG-002", title: "Tendency, not certainty", rule: "Frame astrology as probability windows and tendencies." },
    { id: "EG-003", title: "Gemstone gate", rule: "Gemstone guidance requires qualified Jyotishi review and a clear safety disclaimer." },
    { id: "EG-004", title: "Mental health escalation", rule: "Distress indicators must surface professional support resources." },
    { id: "EG-005", title: "No fear language", rule: "High-risk alerts must remain calm, practical, and empowering." },
    { id: "EG-006", title: "Auditability", rule: "Algorithm outputs must remain versioned and reviewable." },
    { id: "EG-007", title: "No morbid timing", rule: "Do not predict mortality events, terminal timelines, or similar morbid outcomes." }
  ],
  blockedClaims: [
    { id: "mortality-certainty", description: "Mortality certainty or date-setting language" },
    { id: "diagnostic-certainty", description: "Claims that the app diagnoses, treats, or cures disease" },
    { id: "care-avoidance", description: "Advice that replaces clinicians, medication, or urgent care" },
    { id: "fearmongering", description: "Alarmist copy without practical next steps" }
  ],
  disclaimerRules: [
    { surface: "nudge", required: ["global"] },
    { surface: "tier1-alert", required: ["global", "highRiskAlert"] },
    { surface: "remedy", required: ["remedy"] },
    { surface: "gemstone", required: ["gemstone", "remedy"] },
    { surface: "mental-health", required: ["mentalHealth", "global"] },
    { surface: "report", required: ["report", "global"] }
  ],
  escalationRules: [
    { trigger: "Tier 1 transit alert", action: "Show banner, push, email, and physician-care prompt." },
    { trigger: "TIA score above 7", action: "Add doctor nudge and avoid definitive disease labels." },
    { trigger: "Mental distress indicator", action: "Show India-first crisis resources: 112 for immediate danger, Tele-MANAS 14416 / 1800-89-14416, KIRAN 1800-599-0019, and iCALL +91 9152987821." },
    { trigger: "Medication or diagnostic uncertainty", action: "Encourage clinician review or second opinion." }
  ],
  languageRollout
};

const responseSchemas = {
  profile: {
    $id: "jyotish-arogya.schema.profile.v1",
    version: contractVersions.profile,
    type: "object",
    required: ["schemaVersion", "profile", "analytics", "privacy", "encryptedBirthData", "onboarding"],
    properties: {
      profile: "User-facing profile with decrypted birth fields for authorized clients",
      analytics: "Analytics identifier separated from birth details",
      privacy: "Encryption and data-use metadata"
    }
  },
  hvi: {
    $id: "jyotish-arogya.schema.hvi.v1",
    version: contractVersions.hvi,
    type: "object",
    required: ["schemaVersion", "score", "label", "tone", "breakdown", "disclaimers"],
    properties: {
      score: { type: "integer", minimum: 0, maximum: 100 },
      label: { enum: ["Balanced", "Monitoring", "Advisory", "Critical"] },
      breakdown: "Weighted HVI components from Lagna, Trika houses, Dasha, and transits"
    }
  },
  drs: {
    $id: "jyotish-arogya.schema.drs.v1",
    version: contractVersions.drs,
    type: "object",
    required: ["schemaVersion", "mahadasha", "antardasha", "score", "label", "nextWindows", "disclaimers"],
    properties: {
      score: { type: "integer", minimum: 0, maximum: 100 },
      label: { enum: ["Monitoring", "Advisory Alert", "Critical Health Window"] },
      nextWindows: "Preparation windows, not deterministic medical predictions"
    }
  },
  tia: {
    $id: "jyotish-arogya.schema.tia.v1",
    version: contractVersions.tia,
    type: "object",
    required: ["schemaVersion", "score", "label", "components", "doctorNudge", "disclaimers"],
    properties: {
      score: { type: "integer", minimum: 1, maximum: 10 },
      doctorNudge: "Shown when TIA is above 7"
    }
  },
  healthKundli: {
    $id: "jyotish-arogya.schema.health-kundli.v1",
    version: contractVersions.healthKundli,
    type: "object",
    required: ["schemaVersion", "provider", "chart", "analysis", "svgUrl", "disclaimers"],
    properties: {
      provider: "External provider status and fallback metadata",
      chart: "Health-focused D1 Kundli house and planet placements",
      analysis: "Health-domain interpretation derived from 1st, 6th, 8th, 12th houses, HVI, DRS, and planet organ map"
    }
  },
  localization: {
    $id: "jyotish-arogya.schema.localization.v1",
    version: contractVersions.localization,
    type: "object",
    required: ["schemaVersion", "language", "locale", "coverage", "planets", "disclaimers"],
    properties: {
      planets: "Localized display names for grahas while preserving machine-readable planet keys",
      disclaimers: "Localized safety copy for global, high-risk, remedy, gemstone, mental-health, and report contexts",
      coverage: "Localized surfaces ready for host apps"
    }
  },
  nudge: {
    $id: "jyotish-arogya.schema.nudge.v1",
    version: contractVersions.nudge,
    type: "object",
    required: ["schemaVersion", "id", "modules", "checklist", "engagement", "doctorNudge", "disclaimers"],
    properties: {
      modules: "Weekday, hora, nakshatra, Dasha and transit modifiers",
      engagement: "Checklist completion, streak and latest rating",
      doctorNudge: "Shown when TIA is above 7"
    }
  },
  remedyPlan: {
    $id: "jyotish-arogya.schema.remedy-plan.v1",
    version: contractVersions.remedyPlan,
    type: "object",
    required: ["schemaVersion", "durationDays", "summary", "remedies", "productPolicy", "safetyRules"],
    properties: {
      remedies: "90-day remedy steps with category, cadence, adherence, PharmEasy search recommendation, price and SLA",
      productPolicy: "Marketplace source, price freshness, pincode-dependent SLA, and checkout guardrails",
      safetyRules: "Medical-first and gemstone-review rules applied to every remedy"
    }
  }
};

const blockedContentPatterns = [
  { id: "mortality-certainty", pattern: /\b(will\s+die|death\s+date|fatal\s+date|mortality\s+date)\b/i },
  { id: "terminal-timing", pattern: /\b(terminal\s+illness\s+date|terminal\s+timeline)\b/i },
  { id: "diagnostic-certainty", pattern: /\b(we\s+diagnose|diagnosed\s+with|guaranteed\s+treatment|guaranteed\s+cure)\b/i },
  { id: "care-avoidance", pattern: /\b(stop\s+your\s+medication|avoid\s+doctors|skip\s+the\s+doctor|ignore\s+symptoms)\b/i },
  { id: "fearmongering", pattern: /\b(no\s+hope|certain\s+collapse|doomed)\b/i }
];

function currentWeekday() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }).format(new Date());
}

function localDateKey(profile, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: profile.timezone || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function localHour(profile, date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: profile.timezone || "Asia/Kolkata",
    hour: "2-digit",
    hour12: false
  }).format(date));
}

function localizeTransitAlert(item, language = "English") {
  const copy = copyForLanguage(language);
  const localized = copy.transits?.[item.id] || localizationCatalog.en.transits[item.id] || {};
  return {
    ...item,
    planetKey: item.planet,
    planet: localizePlanet(item.planet, language),
    title: localized.title || item.title,
    body: localized.body || item.body,
    window: localized.window || item.window,
    cta: localized.cta || item.cta,
    tierLabel: localizeSeverity(item.tier, language),
    disclaimer: item.tier === "critical" ? localizeDisclaimer("highRiskAlert", language) : localizeDisclaimer("global", language)
  };
}

function localizePlanetMatrix(language = "English") {
  return planetMatrix.map((item) => ({
    ...item,
    planetKey: item.planet,
    planet: localizePlanet(item.planet, language)
  }));
}

function localizedDashaPeriod(mahadasha, antardasha, language = "English") {
  const maha = localizePlanet(mahadasha, language);
  const antar = localizePlanet(antardasha, language);
  const code = languageProfile(language).code;
  if (code === "hi") return `${maha} महादशा / ${antar} अंतर्दशा`;
  if (code === "ta") return `${maha} மகாதசை / ${antar} அந்தர்தசை`;
  if (code === "te") return `${maha} మహాదశ / ${antar} అంతర్దశ`;
  return `${maha} Mahadasha / ${antar} Antardasha`;
}

function activeHora(profile, date = new Date()) {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: profile.timezone || "Asia/Kolkata" }).format(date);
  const lord = weekdayLord[day] || "Sun";
  const startIndex = horaSequence.indexOf(lord);
  const hour = localHour(profile, date);
  const planet = horaSequence[(startIndex + Math.max(0, hour - 6)) % horaSequence.length];
  const planetDisplay = localizePlanet(planet, profile.language);
  const lordDisplay = localizePlanet(lord, profile.language);
  const nudgeCopy = copyForLanguage(profile.language).nudge || localizationCatalog.en.nudge;
  return {
    planet: planetDisplay,
    planetKey: planet,
    weekday: copyForLanguage(profile.language).weekdays?.[day] || day,
    weekdayKey: day,
    weekdayLord: lordDisplay,
    weekdayLordKey: lord,
    hour,
    advice: nudgeCopy.horaAdvice ? nudgeCopy.horaAdvice(planetDisplay) : `${planetDisplay} hora is active.`
  };
}

function activeNakshatra(profile, date = new Date()) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const seed = deterministicScore(`${profile.id}-${profile.birthDate}-${dayOfYear}-nakshatra`, 0, 26);
  const nakshatra = nakshatraHealth[seed];
  return {
    ...nakshatra,
    rulerKey: nakshatra.ruler,
    ruler: localizePlanet(nakshatra.ruler, profile.language)
  };
}

function nudgeKey(userId, dateKey) {
  return `${userId}:${dateKey}`;
}

function getNudgeProgress(userId, dateKey) {
  return nudgeCompletions.get(nudgeKey(userId, dateKey)) || new Set();
}

function setNudgeProgress(userId, dateKey, completedIds) {
  const set = new Set(completedIds);
  nudgeCompletions.set(nudgeKey(userId, dateKey), set);
  return set;
}

function latestNudgeRating(userId, nudgeId) {
  return [...nudgeRatings].reverse().find((item) => item.userId === userId && item.nudgeId === nudgeId)?.rating || null;
}

function nudgeStreak(userId, profile) {
  let streak = 0;
  const today = new Date();
  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = localDateKey(profile, date);
    if (getNudgeProgress(userId, key).size > 0) streak += 1;
    else if (offset > 0) break;
  }
  return streak;
}

function collectTextNodes(value, path = "$", results = []) {
  if (typeof value === "string") {
    results.push({ path, text: value });
    return results;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTextNodes(item, `${path}[${index}]`, results));
    return results;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      collectTextNodes(nested, `${path}.${key}`, results);
    }
  }
  return results;
}

function validateContentPayload(payload) {
  const issues = [];
  for (const node of collectTextNodes(payload)) {
    for (const blocked of blockedContentPatterns) {
      if (blocked.pattern.test(node.text)) {
        issues.push({ id: blocked.id, path: node.path });
      }
    }
  }
  return {
    policyVersion: safetyPolicy.version,
    status: issues.length ? "blocked" : "passed",
    issueCount: issues.length,
    issues
  };
}

function safetyFoundationForClient(payload = {}, language = "English") {
  const validation = validateContentPayload(payload);
  return {
    policyVersion: safetyPolicy.version,
    apiVersion: contractVersions.api,
    validation,
    principles: safetyPolicy.principles,
    disclaimerRules: safetyPolicy.disclaimerRules,
    escalationRules: safetyPolicy.escalationRules,
    languageRollout,
    localization: localizationEnvelope(language),
    localizedDisclaimers: localizedDisclaimers(language),
    schemas: Object.fromEntries(Object.entries(responseSchemas).map(([key, schema]) => [key, schema.version]))
  };
}

function deterministicScore(input, min, max) {
  let hash = 0;
  for (const char of input) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return min + (hash % (max - min + 1));
}

function signSequenceFrom(lagna = "Leo") {
  const signs = onboardingOptions.zodiacSigns;
  const start = Math.max(0, signs.indexOf(lagna));
  return Array.from({ length: 12 }, (_, index) => signs[(start + index) % signs.length]);
}

function kundliSeed(profile) {
  return [
    profile.birthDate,
    profile.birthTime,
    profile.birthPlace,
    profile.timezone,
    profile.ayanamsha
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function kundliChartId(profile) {
  const hex = createHash("sha256").update(`kundli:${profile.id}:${kundliSeed(profile)}`).digest("hex").slice(0, 16);
  return ((BigInt(`0x${hex}`) % 9000000000000000n) + 1000000000000000n).toString();
}

function derivedSign(profile, salt) {
  const signs = onboardingOptions.zodiacSigns;
  return signs[deterministicScore(`${kundliSeed(profile)}:${salt}`, 0, signs.length - 1)];
}

function providerBirthPayload(profile) {
  const [year, month, day] = String(profile.birthDate).split("-").map(Number);
  const [hour, min] = String(profile.birthTime).split(":").map(Number);
  const place = knownPlaces[String(profile.birthPlace || "").trim().toLowerCase()] || knownPlaces["varanasi, india"];
  const tzone = timezoneOffsetHours(profile.timezone, profile.birthDate, profile.birthTime) ?? place.tzone;
  return {
    day,
    month,
    year,
    hour,
    min,
    lat: place.lat,
    lon: place.lon,
    tzone,
    timezone: profile.timezone || defaultProfile.timezone
  };
}

function timezoneOffsetHours(timezone, birthDate, birthTime) {
  if (!timezone || !birthDate || !birthTime) return null;
  try {
    const [year, month, day] = String(birthDate).split("-").map(Number);
    const [hour, minute] = String(birthTime).split(":").map(Number);
    if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(utcGuess));
    const value = (type) => Number(parts.find((part) => part.type === type)?.value);
    const zonedAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    return (zonedAsUtc - utcGuess) / 3600000;
  } catch {
    return null;
  }
}

function offsetLabelFromHours(hours = 0) {
  const sign = hours >= 0 ? "+" : "-";
  const absolute = Math.abs(hours);
  const wholeHours = Math.floor(absolute);
  const minutes = Math.round((absolute - wholeHours) * 60);
  return `${sign}${String(wholeHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function prokeralaLanguageCode(language = "English") {
  const code = languageProfile(language).code;
  return ["en", "hi", "ta", "te", "ml"].includes(code) ? code : "en";
}

function prokeralaAyanamsa(profile) {
  if (astrologyProvider.ayanamsa) return astrologyProvider.ayanamsa;
  const value = String(profile.ayanamsha || profile.ayanamsa || "Lahiri").toLowerCase();
  if (value.includes("raman")) return "3";
  if (value.includes("krishnamurti") || value.includes("kp")) return "5";
  return "1";
}

function prokeralaBirthQuery(profile) {
  const payload = providerBirthPayload(profile);
  const date = `${String(payload.year).padStart(4, "0")}-${String(payload.month).padStart(2, "0")}-${String(payload.day).padStart(2, "0")}`;
  const time = `${String(payload.hour).padStart(2, "0")}:${String(payload.min).padStart(2, "0")}:00`;
  return {
    ayanamsa: prokeralaAyanamsa(profile),
    coordinates: `${payload.lat.toFixed(6)},${payload.lon.toFixed(6)}`,
    datetime: `${date}T${time}${offsetLabelFromHours(payload.tzone)}`,
    la: prokeralaLanguageCode(profile.language)
  };
}

function sanitizedProviderPayload(profile) {
  const payload = providerBirthPayload(profile);
  if (astrologyProvider.kind === "prokerala") {
    return prokeralaBirthQuery(profile);
  }
  return {
    ...payload,
    lat: Number(payload.lat.toFixed(4)),
    lon: Number(payload.lon.toFixed(4))
  };
}

function isAstrologyProviderConfigured() {
  if (astrologyProvider.kind === "prokerala") {
    return Boolean(astrologyProvider.clientId && astrologyProvider.clientSecret);
  }
  return Boolean(astrologyProvider.apiKey);
}

function publicProviderStatus() {
  const configured = isAstrologyProviderConfigured();
  const credentials = astrologyProvider.kind === "prokerala"
    ? {
        mode: "oauth-client-credentials",
        clientType: astrologyProvider.clientType,
        clientIdPresent: Boolean(astrologyProvider.clientId),
        clientSecretPresent: Boolean(astrologyProvider.clientSecret),
        serverSideOnly: true
      }
    : {
        mode: "api-key",
        apiKeyPresent: Boolean(astrologyProvider.apiKey),
        serverSideOnly: true
      };
  return {
    provider: astrologyProvider.name,
    kind: astrologyProvider.kind,
    configured,
    baseUrl: astrologyProvider.baseUrl,
    endpoints: astrologyProvider.endpoints,
    credentials,
    note: configured
      ? "External astrology provider calls are enabled on the server."
      : "External astrology credentials are not configured on the server, so Health Kundli uses the built-in fallback calculator."
  };
}

function providerUrl(endpoint) {
  return `${astrologyProvider.baseUrl.replace(/\/+$/, "")}/${String(endpoint).replace(/^\/+/, "")}`;
}

function compactErrorText(text) {
  return String(text || "").replace(/\s+/g, " ").slice(0, 220);
}

async function getProkeralaAccessToken() {
  const now = Date.now();
  if (prokeralaTokenCache.accessToken && prokeralaTokenCache.expiresAt > now + 60000) {
    return prokeralaTokenCache.accessToken;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: astrologyProvider.clientId,
    client_secret: astrologyProvider.clientSecret
  });
  const response = await fetch(astrologyProvider.tokenUrl, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`Prokerala token request returned ${response.status}: ${compactErrorText(await response.text())}`);
  }
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Prokerala token response did not include an access token.");
  }
  const expiresInSeconds = Number(payload.expires_in || 3600);
  prokeralaTokenCache = {
    accessToken: payload.access_token,
    expiresAt: now + Math.max(60, expiresInSeconds - 60) * 1000
  };
  return prokeralaTokenCache.accessToken;
}

async function callProkeralaEndpoint(endpoint, profile, extraQuery = {}, responseType = "json") {
  const token = await getProkeralaAccessToken();
  const query = new URLSearchParams({ ...prokeralaBirthQuery(profile), ...extraQuery });
  const response = await fetch(`${providerUrl(endpoint)}?${query.toString()}`, {
    headers: {
      "accept": responseType === "svg" ? "image/svg+xml" : "application/json",
      "authorization": `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}: ${compactErrorText(await response.text())}`);
  }
  return responseType === "svg" ? response.text() : response.json();
}

async function settleProviderCall(label, callback) {
  try {
    return [label, { ok: true, value: await callback() }];
  } catch (error) {
    return [label, { ok: false, error: error.message }];
  }
}

async function callLegacyAstrologyEndpoint(endpoint, payload) {
  if (!astrologyProvider.apiKey) return null;
  const response = await fetch(`${astrologyProvider.baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": astrologyProvider.apiKey
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}`);
  }
  return response.json();
}

async function fetchProkeralaAstrology(profile) {
  if (!isAstrologyProviderConfigured()) {
    return {
      configured: false,
      name: astrologyProvider.name,
      kind: astrologyProvider.kind,
      source: "local-fallback",
      message: "Using the built-in Kundli calculator while the Prokerala server credentials are being configured.",
      setupRequired: true,
      credentialMode: "oauth-client-credentials",
      requestedPayload: sanitizedProviderPayload(profile)
    };
  }

  const calls = await Promise.all([
    settleProviderCall("kundli", () => callProkeralaEndpoint(astrologyProvider.endpoints.kundli, profile)),
    settleProviderCall("advancedKundli", () => callProkeralaEndpoint(astrologyProvider.endpoints.advancedKundli, profile)),
    settleProviderCall("birthChartSvg", () => callProkeralaEndpoint(astrologyProvider.endpoints.birthChart, profile, {
      chart_type: "rasi",
      chart_style: "north-indian",
      format: "svg"
    }, "svg")),
    settleProviderCall("planetPositions", () => callProkeralaEndpoint(astrologyProvider.endpoints.planetPositions, profile)),
    settleProviderCall("mahaDasha", () => callProkeralaEndpoint(astrologyProvider.endpoints.mahaDasha, profile)),
    settleProviderCall("sadeSati", () => callProkeralaEndpoint(astrologyProvider.endpoints.sadeSati, profile)),
    settleProviderCall("mangalDosha", () => callProkeralaEndpoint(astrologyProvider.endpoints.mangalDosha, profile))
  ]);
  const providerData = {};
  const endpointErrors = [];
  for (const [label, result] of calls) {
    if (result.ok) providerData[label] = result.value;
    else endpointErrors.push({ endpoint: label, error: result.error });
  }
  if (!Object.keys(providerData).length) {
    throw new Error(endpointErrors[0]?.error || "No Prokerala endpoints returned data.");
  }
  return {
    configured: true,
    name: astrologyProvider.name,
    kind: astrologyProvider.kind,
    source: endpointErrors.length ? "prokerala-api-partial" : "prokerala-api",
    credentialMode: "oauth-client-credentials",
    endpoints: astrologyProvider.endpoints,
    requestedPayload: sanitizedProviderPayload(profile),
    ...providerData,
    diagnostics: endpointErrors.length ? { endpointErrors } : undefined,
    message: endpointErrors.length
      ? "Prokerala returned partial Kundli data; the built-in health view filled the remaining gaps."
      : "Prokerala Kundli data connected. Health analysis is normalized for Jyotish Arogya."
  };
}

async function fetchLegacyKundliAstrology(profile) {
  const payload = providerBirthPayload(profile);
  if (!astrologyProvider.apiKey) {
    return {
      configured: false,
      name: astrologyProvider.name,
      kind: astrologyProvider.kind,
      source: "local-fallback",
      message: "Using the built-in Kundli calculator while the external astrology provider connection is pending.",
      setupRequired: true,
      requestedPayload: sanitizedProviderPayload(profile)
    };
  }
  try {
    const [lagnaChart, planetPositions, mahaDasha, sadeSati] = await Promise.all([
      callLegacyAstrologyEndpoint(astrologyProvider.endpoints.lagnaChart, payload),
      callLegacyAstrologyEndpoint(astrologyProvider.endpoints.planetPositions, payload),
      callLegacyAstrologyEndpoint(astrologyProvider.endpoints.mahaDasha, payload),
      callLegacyAstrologyEndpoint(astrologyProvider.endpoints.sadeSati, payload)
    ]);
    return {
      configured: true,
      name: astrologyProvider.name,
      kind: astrologyProvider.kind,
      source: "external-api",
      endpoints: astrologyProvider.endpoints,
      lagnaChart,
      planetPositions,
      mahaDasha,
      sadeSati
    };
  } catch (error) {
    return {
      configured: true,
      name: astrologyProvider.name,
      kind: astrologyProvider.kind,
      source: "external-api-error-fallback",
      message: "External Kundli provider could not be reached, so the built-in Kundli calculator was used.",
      diagnostics: {
        error: error.message
      }
    };
  }
}

async function fetchExternalAstrology(profile) {
  try {
    return astrologyProvider.kind === "prokerala"
      ? await fetchProkeralaAstrology(profile)
      : await fetchLegacyKundliAstrology(profile);
  } catch (error) {
    return {
      configured: isAstrologyProviderConfigured(),
      name: astrologyProvider.name,
      kind: astrologyProvider.kind,
      source: "external-api-error-fallback",
      message: "External Kundli provider could not be reached, so the built-in Kundli calculator was used.",
      requestedPayload: sanitizedProviderPayload(profile),
      diagnostics: {
        error: error.message
      }
    };
  }
}

function localHealthChart(profile, provider) {
  const chartId = kundliChartId(profile);
  const calculatedLagna = derivedSign(profile, "lagna");
  const calculatedMoonSign = derivedSign(profile, "moon");
  const signs = signSequenceFrom(calculatedLagna);
  const planets = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  const placements = planets.map((planet) => ({
    planet,
    house: deterministicScore(`${kundliSeed(profile)}:${planet}:house`, 1, 12)
  }));
  return {
    style: "North Indian D1 health view",
    chartId,
    calculatedFrom: ["birthDate", "birthTime", "birthPlace", "timezone", "ayanamsha"],
    calculationMode: provider?.source?.startsWith("prokerala-api")
      ? "prokerala-api-health-normalized"
      : (isAstrologyProviderConfigured() ? "provider-fallback-normalized" : "local-birth-fingerprint-fallback"),
    ayanamsha: profile.ayanamsha,
    lagna: calculatedLagna,
    profileLagna: profile.lagna,
    moonSign: calculatedMoonSign,
    profileMoonSign: profile.moonSign,
    houses: Array.from({ length: 12 }, (_, index) => {
      const house = index + 1;
      return {
        house,
        sign: signs[index],
        bodyFocus: houseHealthFocus[house],
        planets: placements.filter((item) => item.house === house).map((item) => item.planet)
      };
    })
  };
}

function localizeHealthChart(chart, language = "English") {
  return {
    ...chart,
    lagnaKey: chart.lagna,
    moonSignKey: chart.moonSign,
    houses: chart.houses.map((house) => ({
      ...house,
      planetKeys: house.planets,
      planets: house.planets.map((planet) => localizePlanet(planet, language))
    }))
  };
}

const houseHealthFocus = {
  1: "constitution, vitality, immunity",
  2: "nutrition, face, mouth, teeth",
  3: "respiration, arms, shoulders",
  4: "chest, lungs, emotional heart",
  5: "stomach, spine, digestion",
  6: "acute illness, infection, metabolic load",
  7: "kidneys, reproductive organs, lower back",
  8: "chronic risk, surgery watch, deep transformation",
  9: "hips, thighs, liver axis",
  10: "knees, joints, work stress",
  11: "calves, ankles, circulation return",
  12: "sleep, feet, hospitalization indicators"
};

function healthSignalsFromProvider(provider = {}) {
  const kundliData = provider.kundli?.data || provider.advancedKundli?.data || {};
  const nakshatraDetails = kundliData.nakshatra_details || {};
  const currentDasha = provider.mahaDasha?.data?.dasha_periods?.[0] || null;
  const signals = {
    source: provider.source || "local-fallback",
    nakshatra: nakshatraDetails.nakshatra?.name || null,
    chandraRasi: nakshatraDetails.chandra_rasi?.name || null,
    sooryaRasi: nakshatraDetails.soorya_rasi?.name || null,
    zodiac: kundliData.zodiac?.name || null,
    dasha: currentDasha ? {
      name: currentDasha.name,
      start: currentDasha.start,
      end: currentDasha.end
    } : null,
    sadeSati: provider.sadeSati?.data ? {
      active: provider.sadeSati.data.is_in_sade_sati,
      phase: provider.sadeSati.data.transit_phase,
      description: provider.sadeSati.data.description
    } : null,
    mangalDosha: provider.mangalDosha?.data ? {
      active: provider.mangalDosha.data.has_dosha,
      description: provider.mangalDosha.data.description
    } : null
  };
  return Object.fromEntries(Object.entries(signals).filter(([, value]) => value !== null && value !== undefined));
}

function analyzeHealthKundli(profile, chart, dashboard, provider = {}) {
  const trikaHouses = chart.houses.filter((item) => [6, 8, 12].includes(item.house));
  const activeTrika = trikaHouses.filter((item) => item.planets.length);
  const providerSignals = healthSignalsFromProvider(provider);
  const healthHighlights = activeTrika.map((item) => ({
    house: item.house,
    sign: item.sign,
    planets: item.planets,
    focus: item.bodyFocus,
    interpretation: healthInterpretationForHouse(item.house, item.planets)
  }));
  const weakSignals = [
    ...healthHighlights,
    {
      house: 7,
      sign: chart.houses[6].sign,
      planets: chart.houses[6].planets,
      focus: chart.houses[6].bodyFocus,
      interpretation: "Saturn in the partnership/kidney-lower-back axis asks for joint, posture, hydration and Vata care."
    }
  ];
  return {
    summary: `${profile.name}'s Health Kundli shows ${dashboard.hvi.label.toLowerCase()} HVI with ${dashboard.dasha.label.toLowerCase()} Dasha support. The health-sensitive 6th, 8th and 12th houses are the main review points.`,
    hvi: dashboard.hvi,
    dasha: dashboard.dasha,
    dominantDosha: profile.dominantDosha,
    focusAreas: [
      "Inflammation and blood heat management",
      "Joint, bone and lower-back care",
      "Sleep, hydration and kidney balance",
      "Digestive rhythm and nervous-system rest"
    ],
    houseHighlights: healthHighlights,
    weakSignals,
    recommendedActions: [
      "Keep a baseline annual health review, especially blood markers, inflammation markers and cardiac basics.",
      "Use cooling Pitta foods on high Mars days: cucumber, coconut water, coriander, and light meals.",
      "Protect Saturn areas with warm mobility, posture care and consistent sleep timing.",
      "Treat this as wellness intelligence only; seek qualified medical care for symptoms or urgent concerns."
    ],
    providerSignals,
    confidence: provider?.source?.startsWith("prokerala-api")
      ? "provider-connected"
      : (dashboard.profileContract.encryptedBirthData.stored ? "profile-complete" : "profile-needs-review")
  };
}

function healthInterpretationForHouse(house, planets) {
  const names = planets.join(", ");
  if (house === 6) return `${names} in the 6th emphasizes daily disease-prevention routines, digestion, infection watch and stress hygiene.`;
  if (house === 8) return `${names} in the 8th asks for careful handling of inflammation, accidents, surgery windows and chronic-risk monitoring.`;
  if (house === 12) return `${names} in the 12th connects sleep, recovery, hospital-expense caution and hidden vitality drain.`;
  return `${names} activates ${houseHealthFocus[house]}.`;
}

function renderHealthKundliSvg(payload) {
  const providerSvg = String(payload.provider?.birthChartSvg || "").trim();
  if (providerSvg.includes("<svg") && !/<script/i.test(providerSvg)) {
    return providerSvg;
  }
  const width = 980;
  const height = 820;
  const houses = payload.chart.houses;
  const chart = { x: 130, y: 96, w: 720, h: 640 };
  const cx = chart.x + chart.w / 2;
  const cy = chart.y + chart.h / 2;
  const houseSlots = {
    1: { x: cx, y: chart.y + 158, anchor: "middle", label: "Body / Physique" },
    2: { x: chart.x + 235, y: chart.y + 76, anchor: "middle", label: "Family / Wealth" },
    3: { x: chart.x + 96, y: chart.y + 158, anchor: "middle", label: "Courage / Siblings" },
    4: { x: chart.x + 225, y: cy, anchor: "middle", label: "Mother / Home" },
    5: { x: chart.x + 96, y: chart.y + 472, anchor: "middle", label: "Study / Child" },
    6: { x: chart.x + 235, y: chart.y + 560, anchor: "middle", label: "Enemies / Disease" },
    7: { x: cx, y: chart.y + 468, anchor: "middle", label: "Partnership" },
    8: { x: chart.x + 485, y: chart.y + 560, anchor: "middle", label: "Age / Chronic" },
    9: { x: chart.x + 624, y: chart.y + 472, anchor: "middle", label: "Luck / Religion" },
    10: { x: chart.x + 495, y: cy, anchor: "middle", label: "Work / Father" },
    11: { x: chart.x + 624, y: chart.y + 158, anchor: "middle", label: "Benefits / Gains" },
    12: { x: chart.x + 485, y: chart.y + 76, anchor: "middle", label: "Expenses / Foreign" }
  };
  const labelForHouse = (house) => {
    const slot = houseSlots[house.house];
    const planets = house.planets.length ? house.planets.join(" · ") : "No planets";
    const sensitive = [1, 6, 8, 12].includes(house.house);
    return `
      <g class="${sensitive ? "sensitive" : ""}">
        <circle cx="${slot.x}" cy="${slot.y - 22}" r="${sensitive ? 30 : 24}" fill="${sensitive ? "#fff4dc" : "#ffffff"}" stroke="${sensitive ? "#d68118" : "#dfb06a"}" stroke-width="2"/>
        <text x="${slot.x}" y="${slot.y - 13}" text-anchor="${slot.anchor}" font-size="25" font-weight="900" fill="#8a4f09">${house.house}</text>
        <text x="${slot.x}" y="${slot.y + 16}" text-anchor="${slot.anchor}" font-size="19" font-weight="800" fill="#0b5f5a">${escapeXml(house.sign)}</text>
        <text x="${slot.x}" y="${slot.y + 42}" text-anchor="${slot.anchor}" font-size="17" font-weight="800" fill="#1f2933">${escapeXml(planets)}</text>
        <text x="${slot.x}" y="${slot.y + 66}" text-anchor="${slot.anchor}" font-size="14" fill="#6d4a00">${escapeXml(slot.label)}</text>
      </g>
    `;
  };
  const innerLines = `
    <rect x="${chart.x}" y="${chart.y}" width="${chart.w}" height="${chart.h}" fill="#fffdf8" stroke="#9d1f1b" stroke-width="4"/>
    <path d="M ${chart.x} ${chart.y} L ${cx} ${cy} L ${chart.x + chart.w} ${chart.y}" fill="none" stroke="#9d1f1b" stroke-width="3"/>
    <path d="M ${chart.x} ${chart.y + chart.h} L ${cx} ${cy} L ${chart.x + chart.w} ${chart.y + chart.h}" fill="none" stroke="#9d1f1b" stroke-width="3"/>
    <path d="M ${chart.x} ${chart.y} L ${chart.x + chart.w} ${chart.y + chart.h}" fill="none" stroke="#9d1f1b" stroke-width="3"/>
    <path d="M ${chart.x + chart.w} ${chart.y} L ${chart.x} ${chart.y + chart.h}" fill="none" stroke="#9d1f1b" stroke-width="3"/>
    <path d="M ${cx} ${chart.y} L ${chart.x + chart.w} ${cy} L ${cx} ${chart.y + chart.h} L ${chart.x} ${cy} Z" fill="none" stroke="#9d1f1b" stroke-width="3"/>
  `;
  const scallopPath = `
    M 490 36
    C 526 84 590 86 654 68
    C 720 50 800 74 832 134
    C 898 144 936 210 912 272
    C 960 328 936 414 872 442
    C 930 508 900 598 826 616
    C 836 686 770 744 700 724
    C 658 776 572 784 520 740
    C 476 784 390 776 348 724
    C 278 744 212 686 222 616
    C 148 598 118 508 176 442
    C 112 414 88 328 136 272
    C 112 210 150 144 216 134
    C 248 74 328 50 394 68
    C 458 86 454 84 490 36 Z
  `;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#fffaf0"/>
    <path d="${scallopPath}" fill="#fffdf8" stroke="#d68118" stroke-width="8"/>
    <path d="${scallopPath}" fill="none" stroke="#9d1f1b" stroke-width="2" opacity="0.55"/>
    ${innerLines}
    <g>${houses.map(labelForHouse).join("")}</g>
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" font-size="26" font-weight="900" fill="#0b5f5a">Lagna</text>
    <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="20" font-weight="800" fill="#1f2933">${escapeXml(payload.chart.lagna)}</text>
  </svg>`;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[char]);
}

async function buildHealthKundli(userId = "demo", req) {
  const dashboard = buildDashboard(userId);
  const profile = dashboard.profile;
  const provider = await fetchExternalAstrology(profile);
  const chart = localizeHealthChart(localHealthChart(profile, provider), profile.language);
  const analysis = analyzeHealthKundli(profile, chart, dashboard, provider);
  const origin = requestOrigin(req);
  return {
    schemaVersion: contractVersions.healthKundli,
    generatedAt: new Date().toISOString(),
    localization: localizationEnvelope(profile.language),
    profile: {
      id: profile.id,
      name: profile.name,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      birthPlace: profile.birthPlace,
      timezone: profile.timezone,
      ayanamsha: profile.ayanamsha,
      lagna: profile.lagna,
      moonSign: profile.moonSign,
      dominantDosha: profile.dominantDosha
    },
    provider,
    chart,
    analysis,
    chartId: chart.chartId,
    svgUrl: `${origin}/api/health-kundli.svg?userId=${encodeURIComponent(profile.id)}&chartId=${encodeURIComponent(chart.chartId)}`,
    disclaimers: [localizeDisclaimer("global", profile.language), localizeDisclaimer("report", profile.language)]
  };
}

function scoreLabel(score) {
  if (score >= 75) return { label: "Critical", tone: "critical" };
  if (score >= 55) return { label: "Advisory", tone: "advisory" };
  if (score >= 35) return { label: "Monitoring", tone: "monitoring" };
  return { label: "Balanced", tone: "positive" };
}

function buildHvi(profile) {
  const seed = `${profile.birthDate}-${profile.birthTime}-${profile.lagna}-${profile.moonSign}`;
  const lagna = deterministicScore(`${seed}-lagna`, 10, 20);
  const sixth = deterministicScore(`${seed}-sixth`, 9, 18);
  const eighth = deterministicScore(`${seed}-eighth`, 7, 14);
  const twelfth = deterministicScore(`${seed}-twelfth`, 4, 9);
  const dasha = deterministicScore(`${seed}-dasha`, 10, 19);
  const transit = deterministicScore(`${seed}-transit`, 4, 9);
  const score = Math.min(100, lagna + sixth + eighth + twelfth + dasha + transit);
  const breakdown = [
    { key: "lagna", label: "Lagna lord strength", value: lagna, max: 25, insight: "Constitution, vitality and baseline immunity.", tone: lagna > 17 ? "advisory" : "monitoring" },
    { key: "sixth", label: "6th house and lord", value: sixth, max: 20, insight: "Acute illness, infection, digestion and metabolic load.", tone: sixth > 14 ? "advisory" : "monitoring" },
    { key: "eighth", label: "8th house analysis", value: eighth, max: 15, insight: "Chronic-risk monitoring, surgery watch and hidden vulnerability.", tone: eighth > 10 ? "advisory" : "monitoring" },
    { key: "twelfth", label: "12th house indicators", value: twelfth, max: 10, insight: "Sleep, recovery, hospitalization indicators and vitality drain.", tone: twelfth > 7 ? "advisory" : "monitoring" },
    { key: "dasha", label: "Dasha risk", value: dasha, max: 20, insight: "Time-period pressure from current Mahadasha and Antardasha.", tone: dasha > 14 ? "critical" : "advisory" },
    { key: "transit", label: "Active transits", value: transit, max: 10, insight: "Real-time Gochara pressure over sensitive natal points.", tone: transit > 7 ? "advisory" : "monitoring" }
  ];
  const labelMeta = scoreLabel(score);
  return {
    schemaVersion: contractVersions.hvi,
    score,
    ...labelMeta,
    label: localizeSeverity(labelMeta.label, profile.language),
    labelKey: labelMeta.label,
    breakdown,
    topDrivers: [...breakdown].sort((a, b) => (b.value / b.max) - (a.value / a.max)).slice(0, 3),
    disclaimers: [localizeDisclaimer("global", profile.language)]
  };
}

function buildDasha(profile) {
  const raw = deterministicScore(`${profile.id}-${profile.birthDate}-dasha`, 52, 82);
  const labelKey = raw > 70 ? "Critical Health Window" : raw > 60 ? "Advisory Alert" : "Monitoring";
  const mahadashaKey = "Saturn";
  const antardashaKey = "Mars";
  const mahadasha = localizePlanet(mahadashaKey, profile.language);
  const antardasha = localizePlanet(antardashaKey, profile.language);
  return {
    schemaVersion: contractVersions.drs,
    mahadasha,
    mahadashaKey,
    antardasha,
    antardashaKey,
    score: raw,
    label: localizeSeverity(labelKey, profile.language),
    labelKey,
    start: "2026-07-14",
    leadTime: "52 days",
    currentPeriod: localizedDashaPeriod(mahadashaKey, antardashaKey, profile.language),
    healthDomain: "joints, inflammation, blood heat, posture and chronic fatigue watch",
    summary: "Natural malefic period with 6th house activation and Mars amplifier. Jupiter buffer keeps the signal actionable rather than alarming.",
    nextWindows: [
      { date: "2026-07-14", title: `${mahadasha}-${antardasha} begins`, risk: localizeSeverity("High", profile.language), riskKey: "High", action: "Baseline blood panel and joint-care plan", disclaimer: localizeDisclaimer("highRiskAlert", profile.language) },
      { date: "2026-09-01", title: `${localizePlanet("Mars", profile.language)} transit over natal ${localizePlanet("Sun", profile.language)}`, risk: localizeSeverity("Medium", profile.language), riskKey: "Medium", action: "Reduce heat exposure and strenuous exertion" },
      { date: "2026-10-20", title: `${localizePlanet("Mercury", profile.language)} retro in 6th`, risk: localizeSeverity("Medium", profile.language), riskKey: "Medium", action: "Double-check prescriptions and diagnostics" }
    ],
    disclaimers: [localizeDisclaimer("global", profile.language), localizeDisclaimer("highRiskAlert", profile.language)]
  };
}

function buildCriticalWindows(profile, dasha, transits) {
  const saturn = localizePlanet("Saturn", profile.language);
  const mars = localizePlanet("Mars", profile.language);
  const mercury = localizePlanet("Mercury", profile.language);
  const sun = localizePlanet("Sun", profile.language);
  const baseWindows = [
    {
      id: "chw-saturn-mars-90",
      date: "2026-07-14",
      phase: localizeSeverity("90-day preparation", profile.language),
      phaseKey: "90-day preparation",
      title: `${saturn}-${mars} Dasha begins`,
      risk: localizeSeverity("High", profile.language),
      riskKey: "High",
      tier: "critical",
      domains: ["Joints", "Inflammation", "Blood markers"],
      action: "Book a baseline health review and start joint-care routine.",
      source: "Dasha"
    },
    {
      id: "chw-mars-sun-30",
      date: "2026-09-01",
      phase: localizeSeverity("30-day watch", profile.language),
      phaseKey: "30-day watch",
      title: `${mars} over natal ${sun}`,
      risk: localizeSeverity("Medium", profile.language),
      riskKey: "Medium",
      tier: "advisory",
      domains: ["Heat", "Heart basics", "Accident watch"],
      action: "Reduce heat exposure and keep workouts controlled.",
      source: "Transit"
    },
    {
      id: "chw-mercury-6th-7",
      date: "2026-10-20",
      phase: localizeSeverity("7-day precision check", profile.language),
      phaseKey: "7-day precision check",
      title: `${mercury} retrograde in 6th`,
      risk: localizeSeverity("Medium", profile.language),
      riskKey: "Medium",
      tier: "advisory",
      domains: ["Medication", "Diagnostics", "Gut"],
      action: "Double-check prescriptions, reports and appointments.",
      source: "Transit"
    }
  ];
  const transitWindows = transits.slice(0, 3).map((item, index) => ({
    id: `active-${item.id}`,
    date: ["2026-05-24", "2026-05-27", "2026-06-02"][index],
    phase: item.tier === "critical" ? localizeSeverity("Active alert", profile.language) : localizeSeverity("Monitoring", profile.language),
    phaseKey: item.tier === "critical" ? "Active alert" : "Monitoring",
    title: item.title,
    risk: item.tier === "critical" ? localizeSeverity("High", profile.language) : item.tier === "positive" ? localizeSeverity("Positive", profile.language) : localizeSeverity("Medium", profile.language),
    riskKey: item.tier === "critical" ? "High" : item.tier === "positive" ? "Positive" : "Medium",
    tier: item.tier,
    domains: [item.planet, item.window],
    action: item.cta,
    source: "Gochara"
  }));
  if (languageProfile(profile.language).code === "hi") {
    baseWindows[0].action = "बेसलाइन स्वास्थ्य समीक्षा बुक करें और जोड़ों की देखभाल रूटीन शुरू करें।";
    baseWindows[1].action = "गर्मी का संपर्क घटाएं और workouts नियंत्रित रखें।";
    baseWindows[2].action = "प्रिस्क्रिप्शन, रिपोर्ट और अपॉइंटमेंट फिर जांचें।";
  }
  if (languageProfile(profile.language).code === "ta") {
    baseWindows[0].action = "அடிப்படை ஆரோக்கிய மதிப்பீட்டை பதிவு செய்து மூட்டு பராமரிப்பு ரூட்டீன் தொடங்கவும்.";
    baseWindows[1].action = "வெப்பத் தொடர்பை குறைத்து உடற்பயிற்சியை கட்டுப்படுத்தவும்.";
    baseWindows[2].action = "மருந்து, அறிக்கை, நேரங்களை மீண்டும் சரிபார்க்கவும்.";
  }
  if (languageProfile(profile.language).code === "te") {
    baseWindows[0].action = "బేస్‌లైన్ ఆరోగ్య సమీక్షను బుక్ చేసి కీళ్ల సంరక్షణ రూటీన్ ప్రారంభించండి.";
    baseWindows[1].action = "వేడి పరిచయాన్ని తగ్గించి workouts నియంత్రించండి.";
    baseWindows[2].action = "ప్రిస్క్రిప్షన్‌లు, రిపోర్టులు, అపాయింట్‌మెంట్‌లను మళ్లీ తనిఖీ చేయండి.";
  }
  return [...transitWindows, ...baseWindows].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildDashboardSummary(profile, hvi, dasha, tia, transits, criticalWindows) {
  const nextCritical = criticalWindows.find((item) => item.tier === "critical") || criticalWindows[0];
  const primaryTransit = transits.find((item) => item.tier === "critical") || transits[0];
  return {
    schemaVersion: contractVersions.dashboard,
    status: hvi.label,
    headline: `${hvi.label} health dashboard`,
    body: `${profile.name}'s current dashboard is driven by ${dasha.currentPeriod}, HVI ${hvi.score}, and a ${tia.label.toLowerCase()} transit score.`,
    currentDasha: {
      period: dasha.currentPeriod,
      score: dasha.score,
      label: dasha.label,
      healthDomain: dasha.healthDomain
    },
    today: {
      hvi: hvi.score,
      tia: tia.score,
      doctorNudge: tia.doctorNudge,
      topFocus: hvi.topDrivers[0]?.label || "Health monitoring"
    },
    nextCriticalWindow: nextCritical,
    topTransit: primaryTransit,
    acceptance: {
      hviBreakdown: true,
      dashaDisplay: true,
      topThreeTransits: transits.length >= 3,
      criticalWindowCalendar: criticalWindows.length >= 3
    }
  };
}

function buildTia(hvi, dasha, profile = defaultProfile) {
  const score = Math.min(10, Math.round((hvi.score + dasha.score) / 15));
  const labelKey = score >= 8 ? "Heightened" : "Steady monitoring";
  return {
    schemaVersion: contractVersions.tia,
    score,
    label: localizeSeverity(labelKey, profile.language),
    labelKey,
    components: ["Transit aspect", "Dasha amplifier", `${localizePlanet("Moon", profile.language)} nakshatra`],
    doctorNudge: score > 7,
    disclaimers: [localizeDisclaimer("global", profile.language), localizeDisclaimer("highRiskAlert", profile.language)]
  };
}

function buildNudge(profile, hvi, dasha, tia, transits) {
  const day = currentWeekday();
  const copy = copyForLanguage(profile.language);
  const nudgeCopy = copy.nudge || localizationCatalog.en.nudge;
  const guidance = copy.weekdayGuidance?.[day] || weekdayGuidance[day];
  const intensity = hvi.score >= 70 || dasha.score >= 70 ? "High" : hvi.score >= 55 ? "Moderate" : "Gentle";
  const dateKey = localDateKey(profile);
  const hora = activeHora(profile);
  const nakshatra = activeNakshatra(profile);
  const id = `${profile.id}-${dateKey}-morning`;
  const topTransit = transits.find((item) => item.tier === "critical") || transits[0];
  const checklist = [
    { id: "hydrate", label: nudgeCopy.hydrate, metric: "water" },
    { id: "remedy", label: nudgeCopy.remedy, metric: "remedy" },
    { id: "body-signal", label: nudgeCopy.bodySignal, metric: "self-check" }
  ];
  if (tia.doctorNudge) {
    checklist.push({ id: "doctor-review", label: nudgeCopy.doctorReview, metric: "care" });
  }
  const completed = getNudgeProgress(profile.id, dateKey);
  return {
    schemaVersion: contractVersions.nudge,
    id,
    date: dateKey,
    scheduledFor: profile.nudgeTime,
    weekday: copy.weekdays?.[day] || day,
    weekdayKey: day,
    planet: localizePlanet(guidance.ruler, profile.language),
    planetKey: guidance.ruler,
    intensity,
    title: guidance.title,
    domain: guidance.domain,
    body: guidance.body,
    action: `${guidance.action} ${nakshatra.note}`,
    modules: {
      weekday: {
        ruler: localizePlanet(guidance.ruler, profile.language),
        rulerKey: guidance.ruler,
        domain: guidance.domain,
        advice: guidance.body
      },
      hora,
      nakshatra,
      dashaModifier: {
        period: dasha.currentPeriod,
        score: dasha.score,
        effect: dasha.score > 70 ? nudgeCopy.highDasha : nudgeCopy.monitoringDasha
      },
      transitModifier: {
        title: topTransit.title,
        tier: topTransit.tier,
        tierLabel: topTransit.tierLabel || localizeSeverity(topTransit.tier, profile.language),
        effect: topTransit.tier === "critical" ? nudgeCopy.transitCritical : nudgeCopy.transitMonitoring
      }
    },
    checklist: checklist.map((item) => ({ ...item, completed: completed.has(item.id) })),
    doctorNudge: tia.doctorNudge ? {
      title: nudgeCopy.doctorTitle,
      body: nudgeCopy.doctorBody,
      trigger: `TIA ${tia.score}/10`,
      urgency: "care-forward"
    } : null,
    engagement: {
      completedCount: completed.size,
      totalCount: checklist.length,
      completionPercent: Math.round((completed.size / checklist.length) * 100),
      streakDays: nudgeStreak(profile.id, profile),
      latestRating: latestNudgeRating(profile.id, id)
    },
    safetyNote: localizeDisclaimer("global", profile.language),
    disclaimers: [localizeDisclaimer("global", profile.language)]
  };
}

function buildWeeklyForecast(profile = defaultProfile) {
  return copyForLanguage(profile.language).weeklyForecast || localizationCatalog.en.weeklyForecast;
}

function buildRemedyPlan(userId = "demo") {
  const profile = profileFromRecord(profiles.get(userId) || profiles.get("demo"));
  const copy = copyForLanguage(profile.language);
  const planCopy = copy.remedyPlan || localizationCatalog.en.remedyPlan;
  const doneIds = checkins.get(userId) || new Set(["sun-mantra"]);
  const generatedAt = new Date();
  const endDate = new Date(generatedAt);
  endDate.setDate(endDate.getDate() + 89);
  const remedies = remedyPlan.map((item) => {
    const product = item.productRecommendation;
    const localized = copy.remedies?.[item.id] || localizationCatalog.en.remedies[item.id] || {};
    const completed = doneIds.has(item.id);
    return {
      ...item,
      categoryKey: item.category,
      category: copy.categories?.[item.category] || item.category,
      planetKey: item.planet,
      planet: localizePlanet(item.planet, profile.language),
      title: localized.title || item.title,
      cadence: localized.cadence || item.cadence,
      detail: localized.detail || item.detail,
      safety: localized.safety || item.safety,
      phase: localized.phase || item.phase,
      effort: localized.effort || item.effort,
      completed,
      adherenceState: completed ? "completed" : "active",
      nextAction: completed ? planCopy.maintainCadence : `${planCopy.nextActionPrefix} ${(localized.effort || item.effort).toLowerCase()} step`,
      disclaimer: item.category === "Expert Review" ? localizeDisclaimer("gemstone", profile.language) : localizeDisclaimer("remedy", profile.language),
      productRecommendation: {
        ...product,
        reason: localized.detail || product.reason,
        dosageGuardrail: localized.safety || product.dosageGuardrail,
        sla: {
          ...product.sla,
          label: product.status === "blocked" ? product.sla.label : planCopy.slaMode || product.sla.label,
          promise: product.status === "blocked" ? product.sla.promise : planCopy.fulfillmentSla,
          fulfillment: planCopy.checkoutRule,
          dataFreshness: planCopy.priceSla
        }
      }
    };
  });
  const completedCount = remedies.filter((item) => item.completed).length;
  const recommendedProductCount = remedies.filter((item) => item.productRecommendation.status !== "blocked").length;
  return {
    schemaVersion: contractVersions.remedyPlan,
    userId,
    generatedAt: generatedAt.toISOString(),
    durationDays: 90,
    startDate: localDateKey(profile, generatedAt),
    endDate: localDateKey(profile, endDate),
    localization: localizationEnvelope(profile.language),
    objective: planCopy.objective,
    summary: {
      totalRemedies: remedies.length,
      completed: completedCount,
      completionPercent: Math.round((completedCount / remedies.length) * 100),
      recommendedProducts: recommendedProductCount,
      blockedProducts: remedies.length - recommendedProductCount,
      slaMode: planCopy.slaMode || "pincode-dependent",
      priceLastChecked: pharmeasyPriceLastChecked
    },
    phases: [
      { id: "foundation", range: "Day 1-14", focus: planCopy.phases.foundation },
      { id: "stabilize", range: "Day 15-45", focus: planCopy.phases.stabilize },
      { id: "deepen", range: "Day 46-90", focus: planCopy.phases.deepen }
    ],
    remedies,
    productPolicy: {
      provider: "PharmEasy Search",
      priceCurrency: "INR",
      priceLastChecked: pharmeasyPriceLastChecked,
      priceSla: planCopy.priceSla,
      fulfillmentSla: planCopy.fulfillmentSla,
      checkoutRule: planCopy.checkoutRule,
      noAutoCheckout: true,
      pincodeRequired: true
    },
    safetyRules: [
      localizeDisclaimer("global", profile.language),
      localizeDisclaimer("remedy", profile.language),
      localizeDisclaimer("gemstone", profile.language),
      planCopy.productSafety,
      planCopy.partnerRefresh
    ],
    reports: [
      {
        id: "remedy-plan",
        title: "90-Day Remedy Plan",
        status: "Ready",
        format: "PDF-ready JSON",
        downloadUrl: `/api/reports/remedy-plan?userId=${encodeURIComponent(userId)}`,
        disclaimer: localizeDisclaimer("report", profile.language)
      },
      {
        id: "physician-summary",
        title: "Physician Safety Summary",
        status: "Ready",
        format: "1-page PDF-ready JSON",
        downloadUrl: `/api/reports/physician-summary?userId=${encodeURIComponent(userId)}`,
        disclaimer: localizeDisclaimer("report", profile.language)
      }
    ]
  };
}

function buildDashboard(userId = "demo") {
  const profile = profileFromRecord(profiles.get(userId) || profiles.get("demo"));
  const chartId = kundliChartId(profile);
  const hvi = buildHvi(profile);
  const dasha = buildDasha(profile);
  const transits = transitAlerts.map((item) => ({
    ...item,
    disclaimer: item.tier === "critical" ? localizeDisclaimer("highRiskAlert", profile.language) : localizeDisclaimer("global", profile.language)
  })).map((item) => localizeTransitAlert(item, profile.language));
  const tia = buildTia(hvi, dasha, profile);
  const nudge = buildNudge(profile, hvi, dasha, tia, transits);
  const criticalWindows = buildCriticalWindows(profile, dasha, transits);
  const remedyPlanPayload = buildRemedyPlan(userId);
  const payload = {
    generatedAt: new Date().toISOString(),
    apiVersion: contractVersions.api,
    localization: localizationEnvelope(profile.language),
    profile,
    profileContract: profileEnvelope(profile.id),
    onboarding: {
      options: onboardingOptions,
      status: profileEnvelope(profile.id).onboarding
    },
    hvi,
    dasha,
    tia,
    dashboardSummary: buildDashboardSummary(profile, hvi, dasha, tia, transits, criticalWindows),
    criticalWindows,
    healthKundli: {
      chartId,
      svgUrl: `/api/health-kundli.svg?userId=${encodeURIComponent(profile.id)}&chartId=${encodeURIComponent(chartId)}`,
      analysisUrl: `/health-kundli.html?userId=${encodeURIComponent(profile.id)}&chartId=${encodeURIComponent(chartId)}`
    },
    nudge,
    transits,
    remedyPlan: remedyPlanPayload,
    remedies: remedyPlanPayload.remedies,
    weeklyForecast: buildWeeklyForecast(profile),
    organMap: localizePlanetMatrix(profile.language),
    reports: [
      { id: "constitution", title: "Health Constitution Report", status: "Ready", format: "PDF", disclaimer: localizeDisclaimer("report", profile.language) },
      { id: "physician-summary", title: "Physician Summary", status: "Draft", format: "1-page PDF", disclaimer: localizeDisclaimer("report", profile.language) },
      { id: "annual-forecast", title: "Annual Health Forecast", status: "Scheduled", format: "PDF", disclaimer: localizeDisclaimer("report", profile.language) },
      ...remedyPlanPayload.reports
    ],
    disclaimers: localizedDisclaimers(profile.language),
    safety: safetyFoundationForClient({}, profile.language)
  };
  payload.safety = safetyFoundationForClient(payload, profile.language);
  payload.contentSafety = payload.safety.validation;
  return payload;
}

const openApi = {
  openapi: "3.1.0",
  info: {
    title: "Jyotish Arogya Embedded Health Astrology API",
    version: contractVersions.api,
    description: "Prototype API contract for a mobile-first, embeddable Jyotish Arogya experience."
  },
  servers: [{ url: "http://localhost:4174" }],
  paths: {
    "/api/health": { get: { summary: "API health check" } },
    "/api/config": { get: { summary: "Return app colors, languages, tiers and safety config" } },
    "/api/safety": { get: { summary: "Return Sprint 0 safety policy, disclaimer rules, escalation rules, and language rollout" } },
    "/api/localization": { get: { summary: "Return localized planet names, safety copy, and coverage metadata for a requested language" } },
    "/api/schemas": { get: { summary: "Return versioned HVI, DRS, and TIA response schemas" } },
    "/api/content/validate": { post: { summary: "Validate draft health copy against blocked safety patterns" } },
    "/api/onboarding/options": { get: { summary: "Return birth profile and dosha questionnaire options" } },
    "/api/provider/status": { get: { summary: "Return external astrology provider configuration status" } },
    "/api/health-kundli": { get: { summary: "Create a health-focused Kundli payload with provider/fallback metadata and analysis" } },
    "/api/health-kundli.svg": { get: { summary: "Render the Health Kundli as an SVG image" } },
    "/api/dashboard-summary": { get: { summary: "Return MVP Health Dashboard status, Dasha summary, next critical window, and acceptance flags" } },
    "/api/critical-windows": { get: { summary: "Return 3-month Critical Health Window calendar" } },
    "/api/profile/{userId}": { get: { summary: "Read a user Jyotish health profile" } },
    "/api/profile": { post: { summary: "Create or update a user profile" } },
    "/api/onboarding": { post: { summary: "Submit birth details and dosha questionnaire answers" } },
    "/api/dashboard": { get: { summary: "Full app dashboard payload for embedded clients" } },
    "/api/hvi/{userId}": { get: { summary: "Health Vulnerability Index and component breakdown" } },
    "/api/dasha/{userId}": { get: { summary: "Dasha-Antardasha risk score and upcoming windows" } },
    "/api/transits": { get: { summary: "Active Gochara health alerts" } },
    "/api/nudges/today": { get: { summary: "Personalized morning health nudge" } },
    "/api/nudges/checklist": { post: { summary: "Update daily nudge checklist completion" } },
    "/api/nudges/streak": { get: { summary: "Return daily nudge streak and completion metrics" } },
    "/api/nudges/rate": { post: { summary: "Capture nudge feedback for personalization" } },
    "/api/weekly-forecast": { get: { summary: "Seven-day health forecast" } },
    "/api/remedies": { get: { summary: "Active remedy plan and adherence status" } },
    "/api/remedies/plan": { get: { summary: "90-day remedy plan with PharmEasy search recommendations, price, SLA, and safety gates" } },
    "/api/remedies/products": { get: { summary: "Product-only PharmEasy recommendation feed for host-app commerce integrations" } },
    "/api/remedies/checkin": { post: { summary: "Mark remedy step complete" } },
    "/api/reports/constitution": { get: { summary: "Generate or retrieve constitution report metadata" } },
    "/api/reports/remedy-plan": { get: { summary: "Generate or retrieve the 90-day remedy plan report metadata and JSON payload" } },
    "/api/reports/physician-summary": { get: { summary: "Generate or retrieve physician-facing remedy safety summary metadata" } },
    "/api/notifications/preferences": { post: { summary: "Update nudge language, time and delivery preferences" } },
    "/api/embed/manifest": { get: { summary: "Embeddable widget manifest and integration snippets" } },
    "/api/openapi.json": { get: { summary: "OpenAPI specification" } }
  }
};

function json(res, status, payload) {
  const validation = validateContentPayload(payload);
  const safePayload = validation.status === "blocked"
    ? { error: "safety_guard_blocked_response", contentSafety: validation }
    : payload;
  const body = JSON.stringify(safePayload, null, 2);
  const safeStatus = validation.status === "blocked" ? 500 : status;
  res.writeHead(safeStatus, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "cache-control": "no-store"
  });
  res.end(body);
}

function text(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*"
  });
  res.end(body);
}

function svg(res, status, body) {
  res.writeHead(status, {
    "content-type": "image/svg+xml; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function apiConfig(language = "English") {
  return {
    appName: "Jyotish Arogya",
    colors: {
      primary: "#10847e",
      primaryDark: "#0b5f5a",
      mint: "#e6f6f3",
      aqua: "#d8fbf7",
      ink: "#1f2933",
      saffron: "#ffb020",
      rose: "#ef5b5b",
      leaf: "#2f9e72"
    },
    languages: [...languageRollout.primary, ...languageRollout.next, ...languageRollout.later],
    languageRollout,
    localization: localizationEnvelope(language),
    tiers: ["Free", "Premium", "Guru"],
    safetyMode: safetyPolicy.mode,
    safetyPolicyVersion: safetyPolicy.version,
    contractVersions,
    onboarding: onboardingOptions,
    astrologyProvider: publicProviderStatus()
  };
}

function requestOrigin(req) {
  const host = req?.headers?.host || `localhost:${PORT}`;
  const forwardedProto = req?.headers?.["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return `${proto || "http"}://${host}`;
}

function embedManifest(req) {
  const origin = requestOrigin(req);
  return {
    version: "0.1.0",
    script: `${origin}/embed.js`,
    element: "jyotish-arogya-app",
    attributes: ["user-id", "api-base", "compact"],
    mountApi: "window.JyotishArogya.mount(selector, { userId, apiBase, compact })",
    snippet: `<script src="${origin}/embed.js" defer></script>\n<jyotish-arogya-app user-id="demo" api-base="${origin}"></jyotish-arogya-app>`
  };
}

function requestedLanguage(url, userId = "demo") {
  const explicit = url.searchParams.get("language") || url.searchParams.get("lang");
  if (explicit) return languageProfile(explicit).name;
  return profileFromRecord(profiles.get(userId) || profiles.get("demo")).language || defaultProfile.language;
}

async function handleApi(req, res, url) {
  const method = req.method || "GET";
  if (method === "OPTIONS") return json(res, 200, { ok: true });

  const userId = url.searchParams.get("userId") || "demo";
  const language = requestedLanguage(url, userId);
  const path = url.pathname;

  if (method === "GET" && path === "/api/health") {
    return json(res, 200, { ok: true, service: "jyotish-arogya-api", generatedAt: new Date().toISOString() });
  }
  if (method === "GET" && path === "/api/config") return json(res, 200, apiConfig(language));
  if (method === "GET" && path === "/api/safety") return json(res, 200, { safety: safetyFoundationForClient({}, language), disclaimers: localizedDisclaimers(language) });
  if (method === "GET" && path === "/api/localization") return json(res, 200, localizationEnvelope(language));
  if (method === "GET" && path === "/api/schemas") return json(res, 200, { versions: contractVersions, schemas: responseSchemas });
  if (method === "GET" && path === "/api/onboarding/options") return json(res, 200, { options: onboardingOptions, privacy: profileEnvelope("demo").privacy });
  if (method === "GET" && path === "/api/provider/status") {
    return json(res, 200, publicProviderStatus());
  }
  if (method === "GET" && path === "/api/health-kundli") return json(res, 200, await buildHealthKundli(userId, req));
  if (method === "GET" && path === "/api/health-kundli.svg") return svg(res, 200, renderHealthKundliSvg(await buildHealthKundli(userId, req)));
  if (method === "GET" && path === "/api/dashboard-summary") {
    const dashboard = buildDashboard(userId);
    return json(res, 200, { userId, dashboardSummary: dashboard.dashboardSummary });
  }
  if (method === "GET" && path === "/api/critical-windows") {
    const dashboard = buildDashboard(userId);
    return json(res, 200, { userId, criticalWindows: dashboard.criticalWindows });
  }
  if (method === "GET" && path === "/api/openapi.json") return json(res, 200, openApi);
  if (method === "GET" && path === "/api/embed/manifest") return json(res, 200, embedManifest(req));
  if (method === "GET" && path === "/api/dashboard") return json(res, 200, buildDashboard(userId));
  if (method === "GET" && path === "/api/transits") return json(res, 200, { userId, transits: buildDashboard(userId).transits });
  if (method === "GET" && path === "/api/nudges/today") return json(res, 200, { userId, nudge: buildDashboard(userId).nudge });
  if (method === "GET" && path === "/api/nudges/streak") {
    const dashboard = buildDashboard(userId);
    return json(res, 200, {
      userId,
      date: dashboard.nudge.date,
      engagement: dashboard.nudge.engagement
    });
  }
  if (method === "GET" && path === "/api/weekly-forecast") return json(res, 200, { userId, weeklyForecast: buildDashboard(userId).weeklyForecast });
  if (method === "GET" && path === "/api/remedies") {
    const plan = buildRemedyPlan(userId);
    return json(res, 200, { userId, remedyPlan: plan, remedies: plan.remedies });
  }
  if (method === "GET" && path === "/api/remedies/plan") return json(res, 200, buildRemedyPlan(userId));
  if (method === "GET" && path === "/api/remedies/products") {
    const plan = buildRemedyPlan(userId);
    return json(res, 200, {
      userId,
      provider: plan.productPolicy.provider,
      priceLastChecked: plan.productPolicy.priceLastChecked,
      fulfillmentSla: plan.productPolicy.fulfillmentSla,
      checkoutRule: plan.productPolicy.checkoutRule,
      recommendations: plan.remedies.map((item) => ({
        remedyId: item.id,
        remedyTitle: item.title,
        planet: item.planet,
        category: item.category,
        productRecommendation: item.productRecommendation
      }))
    });
  }
  if (method === "GET" && path === "/api/reports/constitution") {
    const profile = profileFromRecord(profiles.get(userId) || profiles.get("demo"));
    return json(res, 200, {
      userId,
      report: {
        id: "constitution",
        status: "ready",
        title: "Health Constitution Report",
        summary: "Lifetime HVI, organ map, dominant dosha, weak-planet advisories, and remedy guardrails.",
        downloadUrl: `/api/reports/constitution?userId=${encodeURIComponent(userId)}&format=pdf`,
        disclaimers: [localizeDisclaimer("report", profile.language), localizeDisclaimer("global", profile.language)]
      }
    });
  }
  if (method === "GET" && path === "/api/reports/remedy-plan") {
    const plan = buildRemedyPlan(userId);
    return json(res, 200, {
      userId,
      report: {
        id: "remedy-plan",
        status: "ready",
        title: "90-Day Remedy Plan",
        summary: `${plan.summary.totalRemedies} remedies, ${plan.summary.recommendedProducts} PharmEasy recommendations, ${plan.summary.blockedProducts} safety-gated product.`,
        generatedAt: plan.generatedAt,
        payload: plan,
        disclaimers: plan.safetyRules.slice(0, 3)
      }
    });
  }
  if (method === "GET" && path === "/api/reports/physician-summary") {
    const plan = buildRemedyPlan(userId);
    return json(res, 200, {
      userId,
      report: {
        id: "physician-summary",
        status: "ready",
        title: "Physician Safety Summary",
        summary: "Compact review of remedy categories, optional products, supplement guardrails, and escalation rules.",
        generatedAt: plan.generatedAt,
        productSafety: plan.remedies.map((item) => ({
          remedyId: item.id,
          title: item.title,
          category: item.category,
          product: item.productRecommendation.name,
          price: item.productRecommendation.price.display,
          status: item.productRecommendation.status,
          guardrail: item.productRecommendation.dosageGuardrail
        })),
        disclaimers: [localizeDisclaimer("report", plan.localization.language), localizeDisclaimer("global", plan.localization.language)]
      }
    });
  }

  if (method === "POST" && path === "/api/content/validate") {
    const body = await readBody(req);
    const validation = validateContentPayload(body.content || body);
    return json(res, 200, {
      ok: validation.status === "passed",
      policyVersion: safetyPolicy.version,
      status: validation.status,
      issueCount: validation.issueCount,
      issues: validation.issues
    });
  }

  const profileMatch = path.match(/^\/api\/profile\/([^/]+)$/);
  if (method === "GET" && profileMatch) {
    const record = profiles.get(profileMatch[1]);
    return record ? json(res, 200, profileEnvelope(profileMatch[1])) : json(res, 404, { error: "profile_not_found" });
  }

  const hviMatch = path.match(/^\/api\/hvi\/([^/]+)$/);
  if (method === "GET" && hviMatch) return json(res, 200, { userId: hviMatch[1], hvi: buildDashboard(hviMatch[1]).hvi });

  const dashaMatch = path.match(/^\/api\/dasha\/([^/]+)$/);
  if (method === "GET" && dashaMatch) return json(res, 200, { userId: dashaMatch[1], dasha: buildDashboard(dashaMatch[1]).dasha });

  if (method === "POST" && (path === "/api/profile" || path === "/api/onboarding")) {
    const body = await readBody(req);
    const id = body.id || body.userId || `user-${Date.now()}`;
    const record = createProfileRecord({ ...body, id }, profiles.get(id));
    profiles.set(record.id, record);
    return json(res, 201, {
      profile: profileEnvelope(record.id).profile,
      profileContract: profileEnvelope(record.id),
      dashboard: buildDashboard(record.id)
    });
  }

  if (method === "POST" && path === "/api/remedies/checkin") {
    const body = await readBody(req);
    const id = body.userId || "demo";
    const remedyId = body.remedyId;
    if (!remedyId) return json(res, 400, { error: "remedyId_required" });
    const set = checkins.get(id) || new Set();
    set.add(remedyId);
    checkins.set(id, set);
    return json(res, 200, { ok: true, userId: id, remedyId, completed: Array.from(set), streak: set.size, remedyPlan: buildRemedyPlan(id) });
  }

  if (method === "POST" && path === "/api/nudges/rate") {
    const body = await readBody(req);
    nudgeRatings.push({ ...body, createdAt: new Date().toISOString() });
    return json(res, 200, { ok: true, saved: true, personalizationSignal: "captured", nudge: buildDashboard(body.userId || "demo").nudge });
  }

  if (method === "POST" && path === "/api/nudges/checklist") {
    const body = await readBody(req);
    const id = body.userId || "demo";
    const profile = profileFromRecord(profiles.get(id) || profiles.get("demo"));
    const dateKey = body.date || localDateKey(profile);
    const completedIds = Array.isArray(body.completedIds) ? body.completedIds : [];
    setNudgeProgress(id, dateKey, completedIds);
    return json(res, 200, {
      ok: true,
      userId: id,
      date: dateKey,
      completedIds,
      nudge: buildDashboard(id).nudge
    });
  }

  if (method === "POST" && path === "/api/notifications/preferences") {
    const body = await readBody(req);
    const id = body.userId || "demo";
    const current = profileFromRecord(profiles.get(id) || profiles.get("demo"));
    const record = createProfileRecord({
      ...current,
      nudgeTime: body.nudgeTime || current.nudgeTime,
      language: body.language || current.language,
      detailLevel: body.detailLevel || current.detailLevel || "Balanced",
      channel: body.channel || current.notificationPreferences?.channel || "push",
      enabled: body.enabled ?? current.notificationPreferences?.enabled ?? true
    }, profiles.get(id));
    profiles.set(id, record);
    return json(res, 200, { ok: true, preferences: profileEnvelope(id).profile.notificationPreferences, nudge: buildDashboard(id).nudge });
  }

  return json(res, 404, { error: "not_found", path });
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalized = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) return text(res, 403, "Forbidden");
  try {
    const data = await readFile(filePath);
    const type = mimeTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(data);
  } catch {
    const fallback = await readFile(join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(fallback);
  }
}

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url || "/", requestOrigin(req));
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (error) {
    return json(res, 500, { error: "server_error", message: error.message });
  }
}

export default handleRequest;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`Jyotish Arogya mobile app running at http://localhost:${PORT}`);
  });
}
