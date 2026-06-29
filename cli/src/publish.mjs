// Thin POST wrapper for /api/tmx/publish. Returns { status, json } and never
// throws on non-2xx — the CLI decides how to present each documented reason.

export async function publish(apiBase, body, bearer = null) {
  const headers = { 'content-type': 'application/json' };
  // "Sign in with X": authenticated publish. The server resolves the account by
  // SHA-256(token) and publishes under the account handle (no capability secret).
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  const res = await fetch(`${apiBase}/api/tmx/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}
