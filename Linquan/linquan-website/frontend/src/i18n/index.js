import { ref } from "vue";
import zh from "./zh.js";
import en from "./en.js";

const STORAGE_KEY = "linquan_locale";
const SUPPORTED_LOCALES = ["zh", "en"];

const messages = { zh, en };

function getMessage(localeCode, key) {
  const parts = key.split(".");
  let current = messages[localeCode];
  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = current[part];
  }
  return typeof current === "string" ? current : null;
}

function formatMessage(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      return String(params[name]);
    }
    return match;
  });
}

const isBrowser = typeof window !== "undefined";
const storedLocale = isBrowser
  ? window.localStorage.getItem(STORAGE_KEY)
  : null;
const locale = ref(
  SUPPORTED_LOCALES.includes(storedLocale) ? storedLocale : "zh"
);

function applyLocaleToDocument(nextLocale) {
  if (!isBrowser) {
    return;
  }
  document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  document.title = getMessage(nextLocale, "app.clubName") || "NJU林泉钢琴社";
}

applyLocaleToDocument(locale.value);

export function translateImslpLabel(category, value) {
  if (!value) return value;
  const str = String(value);
  const lower = str.toLowerCase();
  // Build candidate keys. Most i18n maps (instruments/types/modes/categories)
  // use fully lowercase keys, but tones use capital-first form like "C-sharp".
  const candidates = [lower];
  const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
  if (capitalized !== lower) candidates.push(capitalized);
  if (str !== lower && str !== capitalized) candidates.push(str);
  for (const cand of candidates) {
    const key = `imslp.${category}.${cand}`;
    const localized = getMessage(locale.value, key) || getMessage("en", key);
    if (localized) return localized;
  }
  return value;
}

function translateKey(key) {
  if (!key) return key;
  const lower = key.toLowerCase().trim();

  const fullKey = `imslp.keys.${lower.replace(/[^a-z0-9]/g, "_")}`;
  const localized = getMessage(locale.value, fullKey);
  if (localized) return localized;

  if (lower === "modal") {
    return getMessage(locale.value, "imslp.keys.modal") || key;
  }

  if (lower.includes("major") && lower.includes("minor")) {
    const toneMatch = lower.match(/^([a-g](?:-flat|-sharp)?)/);
    if (toneMatch) {
      let toneMsg = getMessage(locale.value, `imslp.tones.${toneMatch[1]}`);
      if (!toneMsg) {
        const capitalized = toneMatch[1].charAt(0).toUpperCase() + toneMatch[1].slice(1);
        toneMsg = getMessage(locale.value, `imslp.tones.${capitalized}`);
      }
      const toneTranslated = toneMsg || toneMatch[1].toUpperCase();
      return `${toneTranslated}大调/小调`;
    }
    return key;
  }

  const parts = lower.split(/\s+/);
  if (parts.length >= 2) {
    const tonePart = parts[0];
    const modePart = parts[parts.length - 1];
    let toneMsg = getMessage(locale.value, `imslp.tones.${tonePart}`);
    if (!toneMsg) {
      const capitalized = tonePart.charAt(0).toUpperCase() + tonePart.slice(1);
      toneMsg = getMessage(locale.value, `imslp.tones.${capitalized}`);
    }
    const modeMsg = getMessage(locale.value, `imslp.modes.${modePart}`);
    const toneTranslated = toneMsg || tonePart.toUpperCase();
    const modeTranslated = modeMsg || modePart;
    if (toneMsg || modeMsg) {
      return `${toneTranslated}${modeTranslated}`;
    }
  }

  return key;
}

function translatePieceStyle(style) {
  if (!style) return style;
  const lower = style.toLowerCase().trim();
  const key = `imslp.pieceStyles.${lower.replace(/[^a-z0-9]/g, "_")}`;
  return getMessage(locale.value, key) || style;
}

function translateInstrumentation(instr) {
  if (!instr) return instr;
  const normalized = instr.toLowerCase().trim();
  // Try exact match first with the original normalized string as key
  const exactKey = `imslp.instrumentations.${normalized}`;
  const exactLocalized = getMessage(locale.value, exactKey);
  if (exactLocalized) return exactLocalized;
  // Fallback to underscore-normalized key for safety-net lookups
  const fullKey = `imslp.instrumentations.${normalized.replace(/[^a-z0-9]/g, "_")}`;
  const localized = getMessage(locale.value, fullKey);
  if (localized) return localized;

  let result = instr;

  const allInstruments = [];
  for (const loc of ["zh", "en"]) {
    const instMap = messages[loc]?.imslp?.instruments;
    if (instMap) {
      for (const k of Object.keys(instMap)) {
        if (!allInstruments.includes(k)) allInstruments.push(k);
        const plural = k + "s";
        if (!allInstruments.includes(plural)) allInstruments.push(plural);
      }
    }
  }
  allInstruments.sort((a, b) => b.length - a.length);

  for (const ik of allInstruments) {
    const pattern = new RegExp(`\\b${ik}\\b`, "gi");
    if (pattern.test(result)) {
      const lookupKey = ik.replace(/s$/, "");
      const replacement = getMessage(locale.value, `imslp.instruments.${lookupKey}`) || ik;
      result = result.replace(pattern, replacement);
    }
  }

  const extraParts = messages[locale.value]?.imslp?.instrumentationParts;
  if (extraParts) {
    for (const [enKey, zhVal] of Object.entries(extraParts)) {
      const pattern = new RegExp(`\\b${enKey}\\b`, "gi");
      result = result.replace(pattern, zhVal);
    }
  }

  return result;
}

function translateMovements(movements) {
  if (!movements) return movements;
  const parts = messages[locale.value]?.imslp?.movementTerms;
  if (!parts) return movements;
  let result = movements;
  for (const [en, zh] of Object.entries(parts)) {
    result = result.replace(new RegExp(`\\b${en}\\b`, "gi"), zh);
  }
  return result;
}

function translateDuration(duration) {
  if (!duration) return duration;
  const units = messages[locale.value]?.imslp?.durationTerms;
  if (!units) return duration;
  let result = duration;
  for (const [en, zh] of Object.entries(units)) {
    result = result.replace(new RegExp(`\\b${en}\\b\\.?`, "gi"), zh);
  }
  return result;
}

export function translatePageMetadata(field, value) {
  if (!value || locale.value === "en") return value;

  switch (field) {
    case "key":
      return translateKey(value);
    case "piece_style":
      return translatePieceStyle(value);
    case "instrumentation":
      return translateInstrumentation(value);
    case "movements":
      return translateMovements(value);
    case "avg_duration":
      return translateDuration(value);
    default:
      return value;
  }
}

export function setLocale(nextLocale) {
  if (!SUPPORTED_LOCALES.includes(nextLocale)) {
    return;
  }
  locale.value = nextLocale;
  if (isBrowser) {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  }
  applyLocaleToDocument(nextLocale);
}

export function useI18n() {
  function t(key, params = {}) {
    const current =
      getMessage(locale.value, key) || getMessage("zh", key) || key;
    return formatMessage(current, params);
  }

  return {
    locale,
    t,
    setLocale,
    supportedLocales: SUPPORTED_LOCALES,
  };
}
