import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'

// "Sign in with X" — server-side мост Next route handler → Convex actions.
// Сами действия (обмен токена X, identity) исполняются в Convex, где живёт
// X_CLIENT_SECRET; этот модуль только вызывает их по deployment URL.

export const xAuthBegin = makeFunctionReference<
  'action',
  { port: number; redeem_secret_hash: string },
  { url: string }
>('xAuth:begin')

export const xAuthComplete = makeFunctionReference<
  'action',
  { code: string; state: string },
  { port: number; exchange_code: string }
>('xAuth:complete')

export function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

/** Простая HTML-страница ошибки (без секретов и без кода в URL/логах). */
export function authErrorResponse(status: number, message: string): Response {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ошибка входа — tokmax</title><style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}main{max-width:440px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{color:#a3a3a3;font-size:14px;line-height:1.5}</style></head><body><main><h1>Не удалось войти через X</h1><p>${message}</p><p>Закрой это окно и попробуй <code>npx tokmax login</code> ещё раз.</p></main></body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
