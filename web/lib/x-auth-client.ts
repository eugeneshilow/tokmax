import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'


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

export function authErrorResponse(status: number, message: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign-in failed — tokmax</title><style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}main{max-width:440px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{color:#a3a3a3;font-size:14px;line-height:1.5}</style></head><body><main><h1>Could not sign in with X</h1><p>${message}</p><p>Close this window and try <code>npx tokmax login</code> again.</p></main></body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
