import { NextRequest } from 'next/server'
import { authErrorResponse, getConvexClient, xAuthComplete } from '@/lib/x-auth-client'

export const dynamic = 'force-dynamic'

// GET /api/auth/x/callback?code=...&state=...
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const oauthError = searchParams.get('error')
  if (oauthError) {
    return authErrorResponse(400, 'X sign-in was not completed.')
  }
  if (!code || !state) {
    return authErrorResponse(400, 'Missing response parameters.')
  }

  try {
    const convex = getConvexClient()
    const { port, exchange_code } = await convex.action(xAuthComplete, { code, state })

    const loopback = new URL(`http://127.0.0.1:${port}/cb`)
    loopback.searchParams.set('code', exchange_code)
    return Response.redirect(loopback.toString(), 302)
  } catch {
    return authErrorResponse(400, 'Could not complete sign-in.')
  }
}
