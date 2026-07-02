import { NextRequest } from 'next/server'
import { authErrorResponse, getConvexClient, xAuthBegin } from '@/lib/x-auth-client'

export const dynamic = 'force-dynamic'

// GET /api/auth/x/start?port=PORT&rsh=REDEEM_SECRET_HASH
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl
  const portRaw = searchParams.get('port')
  const rsh = searchParams.get('rsh')

  if (!portRaw || !rsh) {
    return authErrorResponse(400, 'Missing request parameters.')
  }
  const port = Number(portRaw)
  if (!Number.isInteger(port)) {
    return authErrorResponse(400, 'Invalid port.')
  }

  try {
    const convex = getConvexClient()
    const { url } = await convex.action(xAuthBegin, { port, redeem_secret_hash: rsh })
    return Response.redirect(url, 302)
  } catch {
    return authErrorResponse(400, 'Could not start sign-in. Check the X app settings.')
  }
}
