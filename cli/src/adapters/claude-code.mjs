// Claude Code adapter.
//
// Reads ~/.claude*/projects/**/*.jsonl. Each line is a JSON event; assistant
// messages carry message.usage and message.model plus a top-level ISO
// timestamp. We extract ONLY numeric token counts + the model id + the day.
//
// SAFETY INVARIANT: this module never reads, stores, or transmits prompt text,
// tool output, file contents, or keys. It pulls four integers and a model name
// out of `message.usage` / `message.model` and discards everything else.

import os from 'node:os';
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { num, isoDay, walkJsonl, lines } from '../util.mjs';

/** All ~/.claude* directories that contain a projects/ tree. */
async function claudeProjectRoots() {
  const home = os.homedir();
  let entries;
  try {
    entries = await readdir(home, { withFileTypes: true });
  } catch {
    return [];
  }
  const roots = [];
  for (const e of entries) {
    // Match the .claude directory and any sibling like .claude-foo, but not
    // files such as .claude.json.
    if (e.isDirectory() && e.name.startsWith('.claude')) {
      roots.push(path.join(home, e.name, 'projects'));
    }
  }
  return roots;
}

/**
 * @returns {Promise<{ tool:'claude-code', sessionCount:number, records:Array }>}
 * records: { tool, model, date, input, output, cacheCreate, cacheRead, reasoning }
 */
export async function scanClaudeCode() {
  const records = [];
  let sessionCount = 0;
  // Dedup assistant turns by message.id: Claude Code resume/branch/continue
  // replays prior turns (with their original usage) into new session files, so
  // summing every file's assistant lines double-counts. message.id is unique per
  // API response, so one id == one billed turn no matter how many files replay it.
  const seenIds = new Set();
  let duplicates = 0;

  for (const root of await claudeProjectRoots()) {
    for await (const file of walkJsonl(root)) {
      let text;
      try {
        text = await readFile(file, 'utf8');
      } catch {
        continue;
      }
      sessionCount++;
      for (const line of lines(text)) {
        let d;
        try {
          d = JSON.parse(line);
        } catch {
          continue; // skip malformed lines defensively
        }
        if (!d || d.type !== 'assistant') continue;
        const msg = d.message;
        const usage = msg && msg.usage;
        if (!usage) continue;

        const model = String((msg && msg.model) || 'unknown');
        if (model === '<synthetic>') continue; // not a real billed turn

        const date = isoDay(d.timestamp);
        if (!date) continue;

        const id = msg.id;
        if (id) {
          if (seenIds.has(id)) {
            duplicates++;
            continue; // already counted this billed turn (replayed in another file)
          }
          seenIds.add(id);
        }

        records.push({
          tool: 'claude-code',
          model,
          date,
          input: num(usage.input_tokens),
          output: num(usage.output_tokens),
          cacheCreate: num(usage.cache_creation_input_tokens),
          cacheRead: num(usage.cache_read_input_tokens),
          reasoning: 0,
        });
      }
    }
  }

  return { tool: 'claude-code', sessionCount, records, duplicates };
}
