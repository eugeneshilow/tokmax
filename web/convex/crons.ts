import { cronJobs, makeFunctionReference } from 'convex/server'


const purgeExpiredAuthSessions = makeFunctionReference<'mutation', Record<string, never>, { deleted: number }>(
  'tables/data_raw_tmx_auth_sessions:purgeExpired'
)

const crons = cronJobs()

crons.interval('purge expired x-auth sessions', { minutes: 10 }, purgeExpiredAuthSessions, {})

export default crons
