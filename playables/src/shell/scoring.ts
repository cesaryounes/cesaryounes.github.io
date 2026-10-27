/** Stars for a clear: 3 under par, 2 under 1.5× par, 1 for any clear. */
export function starsFor(elapsedMs: number, parMs: number): 1 | 2 | 3 {
  if (elapsedMs <= parMs) return 3;
  if (elapsedMs <= parMs * 1.5) return 2;
  return 1;
}

/** "12.3s" or "1:05.2" for the HUD and result screens. */
export function formatTime(ms: number): string {
  const totalTenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  if (minutes === 0) return `${seconds}.${tenths}s`;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}
