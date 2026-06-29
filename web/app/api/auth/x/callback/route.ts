import { NextRequest } from 'next/server'
import { authErrorResponse, getConvexClient, xAuthComplete } from '@/lib/x-auth-client'

export const dynamic = 'force-dynamic'

// GET /api/auth/x/callback?code=...&state=...
// X редиректит сюда после согласия. Просим Convex (xAuth.complete) атомарно
// потребить сессию, обменять code на токен X (Basic auth), прочитать identity,
// апсёртнуть аккаунт и выдать одноразовый exchange_code. Затем 302 на loopback
// CLI. Host/scheme захардкожены; PORT берём из СОХРАНЁННОЙ сессии (не из query).
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  // X может вернуть error (например, отказ пользователя).
  const oauthError = searchParams.get('error')
  if (oauthError) {
    return authErrorResponse(400, 'Вход через X не завершён.')
  }
  if (!code || !state) {
    return authErrorResponse(400, 'Не хватает параметров ответа.')
  }

  try {
    const convex = getConvexClient()
    const { port, exchange_code } = await convex.action(xAuthComplete, { code, state })

    // P1: в URL уходит ТОЛЬКО одноразовый exchange_code — ни X-токена, ни
    // cli_nonce, ни redeem_secret. Связку redeem обеспечивает redeem_secret
    // (PKCE-style), который CLI предъявляет server-to-server и который НИКОГДА
    // не попадает в URL, поэтому перехват этого loopback-URL бесполезен. Host+
    // scheme захардкожены; PORT строго из сохранённой сессии, не из query.
    const loopback = new URL(`http://127.0.0.1:${port}/cb`)
    loopback.searchParams.set('code', exchange_code)
    return Response.redirect(loopback.toString(), 302)
  } catch {
    // Никогда не логируем code/state и не кладём их в ответ.
    return authErrorResponse(400, 'Не удалось завершить вход.')
  }
}
