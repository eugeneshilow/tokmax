// "Sign in with X" — CLI side (web-confidential OAuth2).
//
// SECURITY MODEL: the X client secret NEVER touches this machine. The CLI only
//   1) starts a loopback server bound strictly to 127.0.0.1 on a random port,
//   2) opens the browser to the web /start route (which drives the OAuth dance
//      in Convex), and
//   3) receives a one-time exchange_code on the loopback, then POSTs it
//      server-to-server to /api/auth/x/redeem to get the account token back in
//      the RESPONSE BODY (never via a URL).
// The X access token is never seen here and is discarded server-side.

import http from 'node:http';
import { randomBytes } from 'node:crypto';
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
// GET /cb with a matching nonce, then resolves. Retries a few ports on collision.
function startLoopback(cliNonce) {
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
      const nonce = parsed.searchParams.get('nonce');
      // P1: nonce must match our own — reject mismatched/cross-site callbacks.
      if (!code || nonce !== cliNonce) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('bad request');
        return;
      }
      answered = true;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><meta charset="utf-8"><title>tokmax</title>' +
          '<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;text-align:center;padding-top:80px">' +
          '<h2>Готово — вернись в терминал</h2><p>Эту вкладку можно закрыть.</p></body>',
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
          rejectResult(new Error('Время ожидания входа истекло.'));
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

/** Full login flow. Returns { handle, file } on success; throws on failure. */
export async function login(apiBase) {
  const cliNonce = randomBytes(32).toString('hex');
  const { server, port, resultPromise } = await startLoopback(cliNonce);

  const startUrl = `${WEB_BASE}/api/auth/x/start?port=${port}&nonce=${encodeURIComponent(cliNonce)}`;
  console.log('Открываю браузер для входа через X…');
  console.log(`Если не открылось — открой вручную:\n  ${startUrl}\n`);
  openBrowser(startUrl);

  let exchange;
  try {
    exchange = await resultPromise; // { code }
  } finally {
    server.close();
  }

  // Server-to-server: exchange_code → account token (in the response BODY).
  const res = await fetch(`${apiBase}/api/auth/x/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ exchange_code: exchange.code, cli_nonce: cliNonce }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || !json || !json.ok || typeof json.token !== 'string') {
    throw new Error(`Не удалось завершить вход (HTTP ${res.status}).`);
  }

  const file = await saveAuth({
    token: json.token,
    handle: typeof json.handle === 'string' ? json.handle : null,
    createdAt: Date.now(),
  });
  return { handle: json.handle, file };
}

/** Logout: delete local auth.json + best-effort server-side revoke. */
export async function logout(apiBase, token) {
  if (token) {
    try {
      await fetch(`${apiBase}/api/auth/x/revoke`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      // Best-effort — local delete below is what actually logs this machine out.
    }
  }
  return deleteAuth();
}
