//

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const X_REDIRECT_URI = 'https://tokmax.vibecoding.tech/api/auth/x/callback'

export const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
export const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token'
export const X_IDENTITY_URL =
  'https://api.x.com/2/users/me?user.fields=username,name,profile_image_url'

export const X_SCOPE = 'users.read tweet.read'

export const X_SESSION_TTL_MS = 10 * 60 * 1000 // auth state/PKCE
export const X_EXCHANGE_TTL_MS = 30 * 1000 // one-time loopback exchange code

export const LOOPBACK_PORT_MIN = 1024
export const LOOPBACK_PORT_MAX = 65535

export function isValidLoopbackPort(port: unknown): port is number {
  return (
    typeof port === 'number' &&
    Number.isInteger(port) &&
    port >= LOOPBACK_PORT_MIN &&
    port <= LOOPBACK_PORT_MAX
  )
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomToken(byteLength = 32): string {
  const arr = new Uint8Array(byteLength)
  crypto.getRandomValues(arr)
  return base64Url(arr)
}

export function randomHex(byteLength = 32): string {
  const arr = new Uint8Array(byteLength)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function makeCodeVerifier(): string {
  return randomToken(32)
}

/** PKCE code_challenge: base64url(SHA-256(verifier)). S256 only. */
export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function buildAuthorizeUrl(params: {
  clientId: string
  state: string
  codeChallenge: string
}): string {
  const u = new URL(X_AUTHORIZE_URL)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', params.clientId)
  u.searchParams.set('redirect_uri', X_REDIRECT_URI)
  u.searchParams.set('scope', X_SCOPE)
  u.searchParams.set('state', params.state)
  u.searchParams.set('code_challenge', params.codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  return u.toString()
}

export function handleToNick(username: string): string {
  return username.trim().toLowerCase()
}
