import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { action } from './_generated/server'
import {
  buildAuthorizeUrl,
  codeChallengeS256,
  handleToNick,
  isValidLoopbackPort,
  makeCodeVerifier,
  randomHex,
  randomToken,
  sha256Hex,
  X_IDENTITY_URL,
  X_REDIRECT_URI,
  X_TOKEN_URL,
} from './lib/x_auth'

// ===========================================================================
// ===========================================================================

const createSession = makeFunctionReference<
  'mutation',
  { state: string; code_verifier: string; port: number; redeem_secret_hash: string },
  null
>('tables/data_raw_tmx_auth_sessions:createSession')

const consumeSession = makeFunctionReference<
  'mutation',
  { state: string },
  { ok: true; code_verifier: string; port: number } | { ok: false }
>('tables/data_raw_tmx_auth_sessions:consumeSession')

const attachExchange = makeFunctionReference<
  'mutation',
  { state: string; exchange_code_hash: string; account_x_user_id: string },
  null
>('tables/data_raw_tmx_auth_sessions:attachExchange')

const upsertAccount = makeFunctionReference<
  'mutation',
  { x_user_id: string; handle: string; name: string; avatar_url: string },
  null
>('tables/biz_tmx_accounts:upsertAccount')

/**
 */
export const begin = action({
  args: { port: v.number(), redeem_secret_hash: v.string() },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    if (!isValidLoopbackPort(args.port)) {
      throw new Error('invalid_port')
    }
    if (!/^[0-9a-f]{64}$/.test(args.redeem_secret_hash)) {
      throw new Error('invalid_redeem_secret_hash')
    }

    const clientId = process.env.X_CLIENT_ID
    if (!clientId) throw new Error('x_oauth_not_configured')

    const state = randomHex(32) // 256-bit CSPRNG state
    const codeVerifier = makeCodeVerifier()
    const codeChallenge = await codeChallengeS256(codeVerifier)

    await ctx.runMutation(createSession, {
      state,
      code_verifier: codeVerifier,
      port: args.port,
      redeem_secret_hash: args.redeem_secret_hash,
    })

    const url = buildAuthorizeUrl({ clientId, state, codeChallenge })
    return { url }
  },
})

/**
 */
export const complete = action({
  args: { code: v.string(), state: v.string() },
  returns: v.object({
    port: v.number(),
    exchange_code: v.string(),
  }),
  handler: async (ctx, args) => {
    const clientId = process.env.X_CLIENT_ID
    const clientSecret = process.env.X_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('x_oauth_not_configured')

    const session = await ctx.runMutation(consumeSession, { state: args.state })
    if (!session.ok) throw new Error('invalid_state')

    const basic = btoa(`${clientId}:${clientSecret}`)
    const tokenRes = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: args.code,
        redirect_uri: X_REDIRECT_URI,
        code_verifier: session.code_verifier,
      }).toString(),
    })
    if (!tokenRes.ok) {
      throw new Error(`token_exchange_failed_${tokenRes.status}`)
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string }
    const accessToken = tokenJson.access_token
    if (!accessToken) throw new Error('token_exchange_no_access_token')

    const meRes = await fetch(X_IDENTITY_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!meRes.ok) throw new Error(`identity_failed_${meRes.status}`)
    const meJson = (await meRes.json()) as {
      data?: { id?: string; username?: string; name?: string; profile_image_url?: string }
    }
    const me = meJson.data
    if (!me?.id || !me.username) throw new Error('identity_incomplete')

    const handle = handleToNick(me.username)
    await ctx.runMutation(upsertAccount, {
      x_user_id: me.id,
      handle,
      name: me.name ?? me.username,
      avatar_url: me.profile_image_url ?? '',
    })

    const exchangeCode = randomToken(32)
    const exchangeCodeHash = await sha256Hex(exchangeCode)
    await ctx.runMutation(attachExchange, {
      state: args.state,
      exchange_code_hash: exchangeCodeHash,
      account_x_user_id: me.id,
    })

    return { port: session.port, exchange_code: exchangeCode }
  },
})
