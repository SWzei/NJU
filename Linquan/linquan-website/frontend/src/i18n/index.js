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
  const key = `imslp.${category}.${value.toLowerCase()}`;
  const localized = getMessage(locale.value, key) || getMessage("en", key) || value;
  return localized;
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
