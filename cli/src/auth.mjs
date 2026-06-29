// "Sign in with X" — CLI side (web-confidential OAuth2).
//
// SECURITY MODEL: the X client secret NEVER touches this machine. The CLI only
//   1) starts a loopback server bound strictly to 127.0.0.1 on a random port,
//   2) opens the browser to the web /start route (which drives the OAuth dance
//      in Convex), and
//   3) receives a one-time exchange_code on the loopback, then POSTs it
//      together with a redeem_secret server-to-server to /api/auth/x/redeem to
//      get the account token back in the RESPONSE BODY (never via a URL).
// The X access token is never seen here and is discarded server-side.
//
// REDEEM SECRET (PKCE-style proof, closes loopback-URL interception): the CLI
// generates a high-entropy redeem_secret and sends ONLY sha256(redeem_secret)
// to /start (so it can be bound to the session). The raw secret never enters
// any URL — not the /start URL, not the loopback redirect. It is presented only
// in the server-to-server /redeem POST body. So a leaked loopback URL (which
// carries just the exchange_code) is useless to a remote attacker without the
// redeem_secret that lives only inside this CLI process.

import os from 'node:os';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

import { saveAuth, deleteAuth } from './secrets.mjs';

const WEB_BASE = 'https://tokmax.vibecoding.tech';
const LOOPBACK_TIMEOUT_MS = 5 * 60 * 1000;

function openBrowser(url) {
  let cmd;
  let args;
  if (process.platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (process.platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    // Browser may be unavailable (headless) — the user can open the URL by hand.
  }
}

function randomPort() {
  // Strictly the unprivileged range [1024, 65535].
  return 1024 + Math.floor(Math.random() * (65535 - 1024 + 1));
}

// Start an HTTP server on 127.0.0.1:<random port> that answers exactly one
// GET /cb carrying the one-time exchange_code, then resolves. Retries a few
// ports on collision. The callback URL no longer carries a nonce: the redeem
// step is bound by redeem_secret (presented only over the s2s POST), and this
// loopback still rejects any cross-site request that carries an Origin header.
function startLoopback() {
  return new Promise((resolveStart, rejectStart) => {
    let answered = false;
    let resolveResult;
    let rejectResult;
    const resultPromise = new Promise((res, rej) => {
      resolveResult = res;
      rejectResult = rej;
    });

    const server = http.createServer((req, res) => {
      // P1 login-CSRF: ignore any request that carries an Origin header — the
      // real browser top-level redirect from X has none; a cross-site fetch does.
      if (req.headers.origin) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        res.end('forbidden');
        return;
      }
      let parsed;
      try {
        parsed = new URL(req.url || '/', 'http://127.0.0.1');
      } catch {
        res.writeHead(400);
        res.end('bad request');
        return;
      }
      if (parsed.pathname !== '/cb') {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      // Answer only once, then the server closes (no replay).
      if (answered) {
        res.writeHead(409);
        res.end('already used');
        return;
      }
      const code = parsed.searchParams.get('code');
      if (!code) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('bad request');
        return;
      }
      answered = true;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><meta charset="utf-8"><title>tokmax</title>' +
          '<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;text-align:center;padding-top:80px">' +
          '<h2>Signed in — back to your terminal</h2><p>You can close this tab.</p></body>',
      );
      resolveResult({ code });
    });

    let attempts = 0;
    const tryListen = () => {
      attempts += 1;
      const port = randomPort();
      server.listen(port, '127.0.0.1');
      server.once('listening', () => {
        const timer = setTimeout(() => {
          rejectResult(new Error('Login timed out.'));
        }, LOOPBACK_TIMEOUT_MS);
        // Stop the timer once we have a result either way.
        resultPromise.finally(() => clearTimeout(timer));
        resolveStart({ server, port, resultPromise });
      });
    };
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && attempts < 20) {
        tryListen();
      } else {
        rejectStart(err);
      }
    });
    tryListen();
  });
}

/**
 * Full login flow. Returns { handle, file } on success; throws on failure.
 * machineLabel (best-effort hostname) is stored server-side on this machine's
 * token row so the owner can recognise the device; multi-machine login is
 * additive — a new login never invalidates another machine's token.
 */
export async function login(apiBase, machineLabel = os.hostname()) {
  // High-entropy redeem_secret (256-bit). Only its SHA-256 travels in the /start
  // URL; the raw secret stays in this process and is shown only to /redeem s2s.
  const redeemSecret = randomBytes(32).toString('hex');
  const redeemSecretHash = createHash('sha256').update(redeemSecret).digest('hex');
  const { server, port, resultPromise } = await startLoopback();

  const startUrl = `${WEB_BASE}/api/auth/x/start?port=${port}&rsh=${encodeURIComponent(redeemSecretHash)}`;
  console.log('Opening your browser to sign in with X…');
  console.log(`If it did not open, paste this URL manually:\n  ${startUrl}\n`);
  openBrowser(startUrl);

  let exchange;
  try {
    exchange = await resultPromise; // { code }
  } finally {
    server.close();
  }

  // Server-to-server: exchange_code + redeem_secret → account token (in the
  // response BODY). The redeem_secret (not its hash) is sent here, and only
  // here — it never touches a URL, so a leaked loopback URL can't redeem.
  const res = await fetch(`${apiBase}/api/auth/x/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      exchange_code: exchange.code,
      redeem_secret: redeemSecret,
      machine_label: machineLabel || null,
    }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || !json || !json.ok || typeof json.token !== 'string') {
    throw new Error(`Could not complete sign-in (HTTP ${res.status}).`);
  }

  const file = await saveAuth({
    token: json.token,
    handle: typeof json.handle === 'string' ? json.handle : null,
    createdAt: Date.now(),
  });
  return { handle: json.handle, file };
}

/**
 * Logout: delete local auth.json + best-effort server-side revoke.
 * @param {boolean} all - true → revoke EVERY machine's token for the account;
 *                        false → revoke only this machine's token.
 */
export async function logout(apiBase, token, all = false) {
  if (token) {
    try {
      await fetch(`${apiBase}/api/auth/x/revoke`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ all: Boolean(all) }),
      });
    } catch {
      // Best-effort — local delete below is what actually logs this machine out.
    }
  }
  return deleteAuth();
}
