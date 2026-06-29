import { NextRequest } from 'next/server'
import { authErrorResponse, getConvexClient, xAuthBegin } from '@/lib/x-auth-client'

export const dynamic = 'force-dynamic'

// GET /api/auth/x/start?port=PORT&nonce=CLI_NONCE
// CLI loopback открывает этот URL в браузере. Читаем port+nonce, просим Convex
// (xAuth.begin) создать OAuth2-сессию (state + PKCE S256) и 302-редиректим на
// X authorize. port валидируется внутри begin (целое 1024–65535).
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl
  const portRaw = searchParams.get('port')
  const nonce = searchParams.get('nonce')

  if (!portRaw || !nonce) {
    return authErrorResponse(400, 'Не хватает параметров запроса.')
  }
  const port = Number(portRaw)
  if (!Number.isInteger(port)) {
    return authErrorResponse(400, 'Некорректный порт.')
  }

  try {
    const convex = getConvexClient()
    const { url } = await convex.action(xAuthBegin, { port, nonce })
    return Response.redirect(url, 302)
  } catch {
    // Без секретов в ответе.
    return authErrorResponse(400, 'Не удалось начать вход. Проверь настройки приложения X.')
  }
}
