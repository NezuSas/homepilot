/** Placeholder the API sends instead of a secret; the same string that masks the camera password. */
export const MASKED_SECRET = '••••••••';

const SECRET_PARAMETER = /^(user(name)?|usr|login|pass(word|wd)?|pwd|token|access_?token|api_?key|key|secret|auth|sig(nature)?)$/i;

function splitQuery(path: string): { base: string; pairs: string[] } {
  const at = path.indexOf('?');
  if (at < 0) return { base: path, pairs: [] };
  return { base: path.slice(0, at), pairs: path.slice(at + 1).split('&') };
}

const nameOf = (pair: string): string => {
  const equals = pair.indexOf('=');
  return equals < 0 ? pair : pair.slice(0, equals);
};

const valueOf = (pair: string): string => {
  const equals = pair.indexOf('=');
  return equals < 0 ? '' : pair.slice(equals + 1);
};

const join = (base: string, pairs: string[]): string => (pairs.length > 0 ? `${base}?${pairs.join('&')}` : base);

/** Replaces the value of every credential-looking query parameter so a stream path can be shown or sent safely. */
export function maskStreamPathSecrets(path: string): string {
  const { base, pairs } = splitQuery(path);
  if (pairs.length === 0) return path;
  return join(base, pairs.map((pair) => (pair.includes('=') && SECRET_PARAMETER.test(nameOf(pair)) ? `${nameOf(pair)}=${MASKED_SECRET}` : pair)));
}

/**
 * A path coming back from the console still carries the placeholder for secrets the user did not retype.
 * Each placeholder takes the stored value of the same parameter; one with no stored value is dropped.
 */
export function restoreMaskedStreamPathSecrets(incoming: string, stored: string): string {
  const { base, pairs } = splitQuery(incoming);
  if (!pairs.some((pair) => valueOf(pair) === MASKED_SECRET)) return incoming;
  const known = new Map(splitQuery(stored).pairs.map((pair) => [nameOf(pair).toLowerCase(), valueOf(pair)] as const));
  const restored = pairs.flatMap((pair) => {
    if (valueOf(pair) !== MASKED_SECRET) return [pair];
    const original = known.get(nameOf(pair).toLowerCase());
    return original === undefined ? [] : [`${nameOf(pair)}=${original}`];
  });
  return join(base, restored);
}
