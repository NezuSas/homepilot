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

/** Only describe evidence present in the finding; never fill in midnight or inactivity. */
export const getFindingDescription = (
  finding: { type: string; metadata: Record<string, unknown> },
  translate: (key: string, values: Record<string, unknown>) => string,
): string => {
  const metadata = getSafeFindingMetadata(finding.metadata);
  if (finding.type === 'habit_pattern_detected') {
    const window = metadata.timeWindow;
    const validWindow = typeof window === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(window);
    return translate(validWindow ? 'assistant.evidence.habit_window' : 'assistant.evidence.habit', metadata);
  }
  if (finding.type === 'optimization_opportunity') {
    if (metadata.reasonKey === 'long_duration_on' && typeof metadata.hoursOn === 'number') {
      return translate('assistant.evidence.long_duration', metadata);
    }
    if (typeof metadata.daysInactive === 'number' && metadata.daysInactive > 0) {
      return translate('assistant.evidence.inactivity', metadata);
    }
    return translate('assistant.generic_finding_description', metadata);
  }
  if (hasTechnicalFindingMetadata(finding.metadata)) return translate('assistant.generic_finding_description', metadata);
  const description = metadata.displayDescription || metadata.description;
  return typeof description === 'string' && description.trim()
    ? description
    : translate(`assistant.types.${finding.type}_description`, metadata);
};
