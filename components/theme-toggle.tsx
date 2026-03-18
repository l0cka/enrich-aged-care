"use client";

import { useSyncExternalStore } from "react";

const storageKey = "enrich-aged-care-theme";
const themeChangeEvent = "enrich-aged-care-themechange";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(storageKey, theme);
  window.dispatchEvent(new Event(themeChangeEvent));
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(callback: () => void) {
  window.addEventListener(themeChangeEvent, callback);
  return () => window.removeEventListener(themeChangeEvent, callback);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      className="theme-toggle"
      onClick={() => {
        applyTheme(nextTheme);
      }}
      type="button"
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
      <span className="theme-toggle__label">{theme === "dark" ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}
