// Auto-detect the user's AI-coding subscription plans from LOCAL config — no asking.
//
// We read only the plan TIER (a short label like "max_20x"/"pro") that the tools
// already store on this machine, and map it to an approximate retail $/mo. The
// auth tokens themselves are NEVER read out or sent — only the derived plan label
// and dollar figure leave (same boundary as the rest of the aggregate).
//
//   Claude Code: ~/.claude.json → oauthAccount.organizationRateLimitTier / userRateLimitTier
//   Codex:       ~/.codex/auth.json → id_token JWT → "https://api.openai.com/auth".chatgpt_plan_type
//
// Prices are a snapshot (plans/prices change). Override anytime with `--sub <usd>`.

import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();

// Approximate retail USD/mo by plan tier.
const CLAUDE = {
  default_claude_pro: { usd: 20, label: 'Claude Pro' },
  default_claude_max_5x: { usd: 100, label: 'Claude Max 5×' },
  default_claude_max_20x: { usd: 200, label: 'Claude Max 20×' },
  default_claude_team: { usd: 30, label: 'Claude Team' },
};
const CODEX = {
  plus: { usd: 20, label: 'ChatGPT Plus' },
  pro: { usd: 200, label: 'ChatGPT Pro' },
  team: { usd: 30, label: 'ChatGPT Team' },
  business: { usd: 30, label: 'ChatGPT Business' },
};

async function detectClaude() {
  try {
    const d = JSON.parse(await readFile(path.join(HOME, '.claude.json'), 'utf8'));
    const acct = d.oauthAccount || {};
    const tier = acct.organizationRateLimitTier || acct.userRateLimitTier;
    const hit = tier && CLAUDE[tier];
    if (hit && hit.usd > 0) return { tool: 'claude', tier, usd: hit.usd, label: hit.label };
  } catch {
    // no Claude config / unreadable → just skip
  }
  return null;
}

async function detectCodex() {
  try {
    const d = JSON.parse(await readFile(path.join(HOME, '.codex', 'auth.json'), 'utf8'));
    const tok = d && d.tokens && (d.tokens.id_token || d.tokens.access_token);
    if (typeof tok !== 'string' || tok.split('.').length !== 3) return null;
    let payload = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    payload += '='.repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    const auth = claims['https://api.openai.com/auth'] || {};
    const plan = auth.chatgpt_plan_type;
    const hit = plan && CODEX[plan];
    if (hit && hit.usd > 0) return { tool: 'codex', tier: plan, usd: hit.usd, label: hit.label };
  } catch {
    // no Codex auth / unreadable → just skip
  }
  return null;
}

/**
 * Detect the total monthly subscription the user pays for AI coding, from local
 * config. Returns null if nothing detectable.
 * @returns {Promise<null | { totalUsd:number, parts:Array<{tool,tier,usd,label}>, label:string }>}
 */
export async function detectSubscription() {
  const parts = (await Promise.all([detectClaude(), detectCodex()])).filter(Boolean);
  if (!parts.length) return null;
  const totalUsd = parts.reduce((s, p) => s + p.usd, 0);
  if (totalUsd <= 0) return null;
  const label = parts.map((p) => `${p.label} ($${p.usd})`).join(' + ');
  return { totalUsd, parts, label };
}
