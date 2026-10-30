/* Inline 16px stroke icons — no icon dependency, inherit currentColor. */
const base = {
  width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true, focusable: false,
};

export const IconShield = (p) => (
  <svg {...base} {...p}><path d="M12 3l7 3v6c0 4.2-2.8 7.6-7 9-4.2-1.4-7-4.8-7-9V6l7-3z" /><path d="M9.2 12.2l2 2 3.6-4" /></svg>
);
export const IconGrid = (p) => (
  <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
);
export const IconList = (p) => (
  <svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
);
export const IconUsb = (p) => (
  <svg {...base} {...p}><path d="M12 21V7" /><path d="M9.5 9.5L12 7l2.5 2.5" /><rect x="9" y="2.5" width="6" height="4" rx="1" /><path d="M12 15l4-2.5V10" /><circle cx="16" cy="9" r="1.4" /><path d="M12 17.5L8 15v-2.5" /><rect x="6.6" y="10.6" width="2.8" height="2.8" rx="0.6" /></svg>
);
export const IconSearch = (p) => (
  <svg {...base} width="14" height="14" {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></svg>
);
export const IconSun = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></svg>
);
export const IconMoon = (p) => (
  <svg {...base} {...p}><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" /></svg>
);
export const IconRefresh = (p) => (
  <svg {...base} {...p}><path d="M20 11A8 8 0 006.3 6.3L4 8.5" /><path d="M4 4.5v4h4" /><path d="M4 13a8 8 0 0013.7 4.7L20 15.5" /><path d="M20 19.5v-4h-4" /></svg>
);
export const IconFile = (p) => (
  <svg {...base} {...p}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5" /></svg>
);
export const IconLink = (p) => (
  <svg {...base} {...p}><path d="M10.5 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1" /><path d="M13.5 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1" /></svg>
);
export const IconAlert = (p) => (
  <svg {...base} {...p}><path d="M12 4.5l8.5 15H3.5L12 4.5z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>
);
export const IconClock = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconDownload = (p) => (
  <svg {...base} {...p}><path d="M12 3v11" /><path d="M8 10.5l4 4 4-4" /><path d="M4.5 19.5h15" /></svg>
);
export const IconChevron = (p) => (
  <svg {...base} width="14" height="14" {...p}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconHelp = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.4a2.5 2.5 0 014.4 1.5c0 1.7-2 2-2 3.3" /><path d="M12 17.2h.01" /></svg>
);
export const IconPalette = (p) => (
  <svg {...base} {...p}><path d="M12 3.5a8.5 8.5 0 000 17c1 0 1.6-.7 1.6-1.5 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.8.7-1.5 1.5-1.5h1.3A4.6 4.6 0 0020.5 11c0-4.2-3.8-7.5-8.5-7.5z" /><circle cx="8.2" cy="10.2" r="1.1" /><circle cx="12" cy="7.8" r="1.1" /><circle cx="15.8" cy="10.2" r="1.1" /></svg>
);
