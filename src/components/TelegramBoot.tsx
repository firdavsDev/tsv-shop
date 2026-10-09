"use client";

import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getWebApp, type WebApp } from "@/lib/tg-client";

const FLAG = "tsv-tg";

/** Opened from the bot? (?tg=1 on the first page, then remembered for the session.) */
function detect(): boolean {
  try {
    return (
      new URLSearchParams(window.location.search).has("tg") ||
      window.location.hash.includes("tgWebAppData") ||
      sessionStorage.getItem(FLAG) === "1"
    );
  } catch {
    return false;
  }
}
const noSubscribe = () => () => {};

function applyTheme(wa: WebApp) {
  const theme = wa.colorScheme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  wa.setHeaderColor?.("#121110");
  wa.setBackgroundColor?.(theme === "dark" ? "#121110" : "#ffffff");
}

/** Called once the Telegram SDK has loaded. Module scope: it touches globals (document, sessionStorage). */
function bootWebApp(): boolean {
  const wa = getWebApp();
  if (!wa) return false; // ?tg=1 opened in a normal browser
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    // ignore
  }
  wa.ready();
  wa.expand();
  applyTheme(wa);
  wa.onEvent?.("themeChanged", () => applyTheme(wa));
  return true;
}

/** Turns the site into a Telegram Mini App when opened from the bot. Normal visitors never load the SDK. */
export function TelegramBoot() {
  const wanted = useSyncExternalStore(noSubscribe, detect, () => false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Telegram has no browser back button: show its native one everywhere except the home page.
  useEffect(() => {
    const wa = getWebApp();
    if (!ready || !wa?.BackButton) return;
    const back = () => router.back();
    if (/^\/(ru|uz)\/?$/.test(pathname)) wa.BackButton.hide();
    else wa.BackButton.show();
    wa.BackButton.onClick(back);
    return () => wa.BackButton?.offClick(back);
  }, [ready, pathname, router]);

  if (!wanted) return null;
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onLoad={() => setReady(bootWebApp())}
    />
  );
}
