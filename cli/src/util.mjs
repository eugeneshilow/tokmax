// Shared, dependency-free helpers used by the adapters and aggregator.
// SAFETY: nothing here ever touches prompt text, file contents, or keys —
// only numbers, model id strings, and ISO timestamps.

import { readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Anonymized, per-machine-stable label. Raw hostnames often contain the
 * owner's real name (e.g. "Johns-MacBook-Pro.local") and machine labels are
 * shown on the public board — so the default label must never leak them.
 * Hash is stable per machine so multi-device merging keeps working.
 */
export function anonymousMachineLabel() {
  const hash = createHash('sha256').update(os.hostname()).digest('hex').slice(0, 6);
  return `machine-${hash}`;
}

/** Coerce any value into a finite, non-negative integer token count. */
export function num(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/** Extract the YYYY-MM-DD day from an ISO timestamp, or null if unusable. */
export function isoDay(ts) {
  if (typeof ts !== 'string' || ts.length < 10) return null;
  const day = ts.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** Recursively yield every *.jsonl file under dir (missing dir => nothing). */
export async function* walkJsonl(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkJsonl(p);
    } else if (e.isFile() && e.name.endsWith('.jsonl')) {
      yield p;
    }
  }
}

/** Iterate non-empty trimmed lines of a string. */
export function* lines(text) {
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t) yield t;
  }
}
