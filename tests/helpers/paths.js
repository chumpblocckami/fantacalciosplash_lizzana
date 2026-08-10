/**
 * Repository paths for the test suite.
 *
 * import.meta.dirname only exists from Node 21, and package.json still supports Node 20,
 * so the directory is derived from the module URL instead.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));

export const ROOT = join(HERE, '..', '..');
export const TMP = join(ROOT, 'tests', '.tmp');

/** Path to a scratch directory under tests/.tmp, which is never committed. */
export function tmpDir(name) {
  return join(TMP, name);
}
