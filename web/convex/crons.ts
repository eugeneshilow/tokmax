import { cronJobs, makeFunctionReference } from 'convex/server'

// tokenmax (L2) кроны. Уборка протухших X-auth сессий: state/PKCE/exchange_code
// одноразовы и коротко живут, но отказавшие/брошенные логины оставляют ряды —
// крон чистит их по expires_at (bounded). Внутренняя мутация через
// makeFunctionReference (без зависимости от codegen).

const purgeExpiredAuthSessions = makeFunctionReference<'mutation', Record<string, never>, { deleted: number }>(
  'tables/data_raw_tmx_auth_sessions:purgeExpired'
)

const crons = cronJobs()

crons.interval('purge expired x-auth sessions', { minutes: 10 }, purgeExpiredAuthSessions, {})

export default crons
