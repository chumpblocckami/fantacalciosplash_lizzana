/**
 * Run one of the scripts/ entry points against a scratch working directory.
 *
 * Every script resolves assets/ and data/ relative to the working directory, so pointing it
 * at a throwaway tree is all that is needed to test it without touching committed data.
 */

import { spawnSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

import { ROOT, tmpDir } from './paths.js';

/**
 * Create an empty scratch working directory.
 *
 * @param {string} name - Directory name under tests/.tmp
 * @returns {string} Absolute path
 */
export function workspace(name) {
  const dir = tmpDir(name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Run a script from scripts/ and return its exit status and output.
 *
 * @param {string} script - File name, e.g. 'compute-scores.js'
 * @param {string} cwd    - Working directory to run it in
 * @param {Object} [env]  - Extra environment variables, typically YEAR
 */
export function runScript(script, cwd, env = {}) {
  return spawnSync('node', [join(ROOT, 'scripts', script)], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
  });
}

/** Read a JSON file from a workspace, or null when the script did not write it. */
export function readOutput(cwd, ...segments) {
  const path = join(cwd, ...segments);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null;
}
