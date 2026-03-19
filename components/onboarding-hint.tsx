"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const keyPrefix = "enrich-aged-care-hint-";
const hintChangeEvent = "enrich-aged-care-hintchange";

function isDismissed(id: string): boolean {
  try {
    return window.localStorage.getItem(`${keyPrefix}${id}`) === "1";
  } catch {
    return false;
  }
}

function dismiss(id: string) {
  try {
    window.localStorage.setItem(`${keyPrefix}${id}`, "1");
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(hintChangeEvent));
}

function subscribe(callback: () => void) {
  window.addEventListener(hintChangeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(hintChangeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

type OnboardingHintProps = {
  children: React.ReactNode;
  id: string;
};

export function OnboardingHint({ children, id }: OnboardingHintProps) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => isDismissed(id),
    () => true, // SSR: treat as dismissed to avoid flash
  );

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(timer);
    }
  }, [dismissed]);

  if (dismissed || !visible) {
    return null;
  }

  return (
    <div className="onboarding-hint" role="status">
      <p className="onboarding-hint__text">{children}</p>
      <button
        aria-label="Dismiss hint"
        className="onboarding-hint__dismiss"
        onClick={() => dismiss(id)}
        type="button"
      >
        Got it
      </button>
    </div>
  );
}
