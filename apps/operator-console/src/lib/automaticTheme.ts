export function getScheduledTheme(date: Date): 'light' | 'dark' {
  const minute = date.getHours() * 60 + date.getMinutes();
  return minute < 360 || minute >= 1110 ? 'dark' : 'light';
}

export function nextThemeBoundaryDelay(date: Date): number {
  const next = new Date(date);
  const minute = date.getHours() * 60 + date.getMinutes();
  if (minute < 360) next.setHours(6, 0, 0, 0);
  else if (minute < 1110) next.setHours(18, 30, 0, 0);
  else { next.setDate(next.getDate() + 1); next.setHours(6, 0, 0, 0); }
  return Math.max(1, next.getTime() - date.getTime());
}
