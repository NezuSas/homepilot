const TECHNICAL_IDENTIFIER_PATTERNS = [
  /\b(?:automation|binary_sensor|button|camera|cover|light|media_player|scene|sensor|switch)\.[a-z0-9_]+\b/i,
  /[a-z0-9]+(?:[_-][a-z0-9]+){2,}/i,
  /\b[a-z0-9]+_[a-z0-9_]+\b/i,
];

const USER_FACING_METADATA_KEYS = [
  'deviceName',
  'friendlyName',
  'name',
  'currentName',
  'displayTitle',
  'displayDescription',
  'description',
];

const isTechnicalIdentifier = (value: string): boolean => {
  const normalized = value.trim();
  return normalized.length === 0 || TECHNICAL_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const hasTechnicalFindingMetadata = (metadata: Record<string, unknown>): boolean => {
  return USER_FACING_METADATA_KEYS.some((key) => {
    const value = metadata[key];
    return typeof value === 'string' && value.trim().length > 0 && isTechnicalIdentifier(value);
  });
};

export const getSafeFindingMetadata = (metadata: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (
        USER_FACING_METADATA_KEYS.includes(key)
        && typeof value === 'string'
        && isTechnicalIdentifier(value)
      ) {
        return [key, ''];
      }

      return [key, value];
    })
  );
};
