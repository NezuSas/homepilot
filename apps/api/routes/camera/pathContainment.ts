import * as path from 'path';

/**
 * True when `candidate` is `directory` itself or lives inside it. A bare prefix test is not
 * enough: `/data/hls-other` starts with `/data/hls` without being inside it.
 */
export function isInsideDirectory(candidate: string, directory: string): boolean {
  const relative = path.relative(path.resolve(directory), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
