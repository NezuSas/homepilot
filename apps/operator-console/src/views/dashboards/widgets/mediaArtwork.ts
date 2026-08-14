function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstText(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function normalizeArtworkSource(value: string): string {
  try {
    const source = new URL(value, 'http://homepilot.local');
    source.searchParams.delete('token');
    return `${source.pathname}${source.search}`;
  } catch {
    return value;
  }
}

export function getMediaArtworkSourceKey(lastKnownState: Record<string, unknown> | null | undefined): string | null {
  const state = asRecord(lastKnownState);
  const attributes = asRecord(state.attributes);
  const source = firstText([
    attributes.entity_picture_local,
    attributes.entity_picture,
    state.entity_picture_local,
    state.entity_picture,
  ]);
  return source ? normalizeArtworkSource(source) : null;
}