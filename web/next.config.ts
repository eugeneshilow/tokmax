import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The Fable 5 launch-week event (July 1-7, 2026) is over and its hub is
      // retired — old shared links land on the evergreen leaderboard.
      {
        source: '/fable-5',
        destination: '/leaderboard',
        permanent: true,
      },
      {
        source: '/leaderboard/fable-5',
        destination: '/leaderboard',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
