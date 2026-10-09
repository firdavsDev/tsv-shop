/** The parts of window.Telegram.WebApp we use. */
export type WebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: "themeChanged", cb: () => void): void;
  HapticFeedback?: { notificationOccurred(type: "success" | "error" | "warning"): void };
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

/** Telegram.WebApp only when really running inside Telegram (outside it, initData is empty). */
export function getWebApp(): WebApp | null {
  if (typeof window === "undefined") return null;
  const wa = window.Telegram?.WebApp;
  return wa && wa.initData ? wa : null;
}

export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

export function haptic(type: "success" | "error"): void {
  getWebApp()?.HapticFeedback?.notificationOccurred(type);
}
