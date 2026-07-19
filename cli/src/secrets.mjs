// Capability-token storage at ~/.config/tokenmax/<nick>.json.
// The secret is the only credential that lets a nick be updated later. We store
// it 0600 in a 0700 directory. No prompts, files, or keys ever go here.

import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile, chmod, rm, readdir, rmdir } from 'node:fs/promises';

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

// Small persisted preferences (e.g. the chosen start day `since`) so re-runs and the
// daily job keep the user's curation. Lives at ~/.config/tokenmax/prefs.json (0600).
function prefsFile() {
  return path.join(configDir(), 'prefs.json');
}

/** Load prefs ({ since?: 'YYYY-MM-DD' }), or {} if none. */
export async function loadPrefs() {
  try {
    return JSON.parse(await readFile(prefsFile(), 'utf8')) || {};
  } catch {
    return {};
  }
}

/** Merge-save prefs. Pass { since: null } to clear `since`. */
export async function savePrefs(patch) {
  const cur = await loadPrefs();
  const next = { ...cur, ...patch };
  for (const k of Object.keys(next)) if (next[k] == null) delete next[k];
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  await writeFile(prefsFile(), JSON.stringify(next), { mode: 0o600 });
  return next;
}

/**
 * Per-machine label that survives hostname changes. macOS silently bumps the
 * hostname on network name collisions (MacBook-Pro-4.local → MacBook-Pro-5.local),
 * so a label recomputed from the hostname splits one machine into two "machines"
 * whose full histories then double-count on the board. First run pins the
 * computed label into prefs.json; every later run (including the daily job)
 * reuses the pinned value no matter what the hostname says.
 */
export async function stableMachineLabel(compute) {
  const prefs = await loadPrefs();
  if (typeof prefs.machineLabel === 'string' && prefs.machineLabel) return prefs.machineLabel;
  const label = compute();
  await savePrefs({ machineLabel: label });
  return label;
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

/**
 * Wipe ALL local tokmax files: the X auth.json + every per-nick capability secret
 * (*.json) + the daily-job log. We touch ONLY tokmax's own files (anything that is
 * not *.json or daily.log is left alone — the config dir may be shared). The
 * directory is removed too if it ends up empty. Returns the list of removed names.
 */
export async function wipeLocal() {
  const dir = configDir();
  const removed = [];
  let names = [];
  try {
    names = await readdir(dir);
  } catch {
    return removed; // no dir → nothing local
  }
  for (const name of names) {
    if (name.endsWith('.json') || name === 'daily.log') {
      try {
        await rm(path.join(dir, name), { force: true });
        removed.push(name);
      } catch {
        // ignore
      }
    }
  }
  // Remove the dir only if it is now empty (clean slate for normal installs).
  try {
    await rmdir(dir);
  } catch {
    // not empty (e.g. unrelated logs share the dir) or already gone → leave it
  }
  return removed;
}
