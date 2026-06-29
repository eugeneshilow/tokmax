// Capability-token storage at ~/.config/tokenmax/<nick>.json.
// The secret is the only credential that lets a nick be updated later. We store
// it 0600 in a 0700 directory. No prompts, files, or keys ever go here.

import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile, chmod, rm } from 'node:fs/promises';

function configDir() {
  return path.join(os.homedir(), '.config', 'tokenmax');
}

function secretFile(nick) {
  return path.join(configDir(), `${nick}.json`);
}

// "Sign in with X": account token lives in a single auth.json (0600), separate
// from per-nick capability secrets. Only its SHA-256 hash is kept server-side.
function authFile() {
  return path.join(configDir(), 'auth.json');
}

/** Return the saved secret for nick, or null if none/unreadable. */
export async function loadSecret(nick) {
  try {
    const text = await readFile(secretFile(nick), 'utf8');
    const data = JSON.parse(text);
    return typeof data.secret === 'string' && data.secret ? data.secret : null;
  } catch {
    return null;
  }
}

/**
 * Persist { nick, secret, url, createdAt } with restrictive permissions.
 * @returns absolute path written
 */
export async function saveSecret(nick, data) {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  const file = secretFile(nick);
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  // mkdir/writeFile mode is umask-masked; force the bits explicitly.
  await chmod(file, 0o600).catch(() => {});
  return file;
}

// ── "Sign in with X" account token (auth.json) ──────────────────────────────

/** Return the saved auth object ({ token, handle, createdAt }) or null. */
export async function loadAuth() {
  try {
    const text = await readFile(authFile(), 'utf8');
    const data = JSON.parse(text);
    return typeof data.token === 'string' && data.token ? data : null;
  } catch {
    return null;
  }
}

/**
 * Persist { token, handle, createdAt } with restrictive permissions
 * (file 0600, dir 0700).
 * @returns absolute path written
 */
export async function saveAuth(data) {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  // mkdir mode is umask-masked; force the dir bits explicitly too.
  await chmod(configDir(), 0o700).catch(() => {});
  const file = authFile();
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  await chmod(file, 0o600).catch(() => {});
  return file;
}

/** Delete auth.json. Returns true if a file was removed. */
export async function deleteAuth() {
  try {
    await rm(authFile());
    return true;
  } catch {
    return false;
  }
}
