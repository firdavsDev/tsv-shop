"use client";

/** Runs before first paint: saved choice, else the system setting. No light flash for dark-mode users. */
const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem('tsv-theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t})()`;

/**
 * Inline script per Next's "preventing flash before hydration" guide: executable in the server HTML,
 * inert (text/plain) when React renders it on the client, which also silences React's <script> warning.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
