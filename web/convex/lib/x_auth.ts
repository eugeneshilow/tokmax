// "Sign in with X" (web-confidential OAuth2) — чистые хелперы и константы.
//
// Pure-модуль: крипто на Web Crypto (доступна и в convex-рантайме, и в Next
// route handler), плюс фиксированные эндпоинты/скоупы. X client secret сюда не
// попадает — он читается из env только внутри action xAuth.complete. Канон зон
// data_/biz_ таблиц — docs/2-product/db/README.md.

// ---------------------------------------------------------------------------
// Фиксированные параметры X-приложения (НЕ менять — совпадают с регистрацией)
// ---------------------------------------------------------------------------

/** redirect_uri ДОЛЖЕН байт-в-байт совпадать с зарегистрированным в X. */
export const X_REDIRECT_URI = 'https://tokmax.vibecoding.tech/api/auth/x/callback'

export const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
export const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token'
export const X_IDENTITY_URL =
  'https://api.x.com/2/users/me?user.fields=username,name,profile_image_url'

// Только identity-чтение. offline.access НЕ запрашиваем: X access/refresh токены
// не храним и не переиспользуем — identity читается один раз при логине.
export const X_SCOPE = 'users.read tweet.read'

// TTL короткоживущих артефактов.
export const X_SESSION_TTL_MS = 10 * 60 * 1000 // авторизация (state/PKCE)
export const X_EXCHANGE_TTL_MS = 30 * 1000 // одноразовый exchange_code для loopback

// Loopback CLI: только 127.0.0.1, порт в непривилегированном диапазоне.
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
// Крипто (Web Crypto — детерминированный API в обоих рантаймах)
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

/** Высокоэнтропийный URL-safe токен (по умолчанию 256 бит). */
export function randomToken(byteLength = 32): string {
  const arr = new Uint8Array(byteLength)
  crypto.getRandomValues(arr)
  return base64Url(arr)
}

/** Hex-строка из CSPRNG (для state — >=128 бит при byteLength>=16). */
export function randomHex(byteLength = 32): string {
  const arr = new Uint8Array(byteLength)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** PKCE code_verifier: 32 байта base64url = 43 символа (валидно для S256). */
export function makeCodeVerifier(): string {
  return randomToken(32)
}

/** PKCE code_challenge: base64url(SHA-256(verifier)). S256 only. */
export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/** Строит URL авторизации X со всеми обязательными параметрами (S256). */
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

/** Нормализует X-username в ник для роутинга/ключей (case-insensitive). */
export function handleToNick(username: string): string {
  return username.trim().toLowerCase()
}
