"use client";

import { useSyncExternalStore } from "react";
import { getDict, type Locale } from "@/i18n";
import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";
export const THEME_KEY = "tsv-theme";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Module scope: the React Compiler lint forbids mutating globals from inside a component. */
function setTheme(v: Theme) {
  document.documentElement.dataset.theme = v;
  try {
    localStorage.setItem(THEME_KEY, v);
  } catch {
    // storage blocked: the choice lasts for this page view
  }
}

/** Header icon: moon in the light theme, sun in the dark one. A toggle button ("Dark theme", pressed or not). */
export function ThemeToggle({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label={t.nav.darkTheme}
      title={t.nav.darkTheme}
      aria-pressed={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-11 place-items-center"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
