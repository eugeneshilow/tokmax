import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The event outgrew the board: /fable-5 is the launch-week hub
      // (board + stack math + how-to-enter). Old links keep working.
      {
        source: '/leaderboard/fable-5',
        destination: '/fable-5',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
