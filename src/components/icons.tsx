/** Íconos de línea (24×24, trazo 2) dibujados aquí para no sumar dependencias. */
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  bus: 'M5 16V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v10M5 16h14M5 16v3h2v-3M17 16v3h2v-3M5 11h14M8.5 13.5h.01M15.5 13.5h.01',
  pin: 'M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 17.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  signal: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  play: 'M8 5.5v13l10.5-6.5zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
