import { useEffect, useState } from "react";

const MODE_KEY = "usbf.theme";      // "light" | "dark" | "system"

const read = (key, fallback) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
};

/** Light/dark mode. "system" leaves the OS preference in charge; an explicit
 *  choice is stamped on <html data-theme> so it wins over the media query. */
export function useTheme() {
  const [theme, setTheme] = useState(() => read(MODE_KEY, "system"));

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    write(MODE_KEY, theme);
  }, [theme]);

  const isDark = theme === "dark" ||
    (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  return { theme, isDark, toggle: () => setTheme(isDark ? "light" : "dark") };
}

/* Apply a saved light/dark choice before React mounts, so the first paint is correct. */
try {
  const mode = read(MODE_KEY, "system");
  if (mode !== "system") document.documentElement.setAttribute("data-theme", mode);
} catch { /* no storage — the OS preference applies */ }
