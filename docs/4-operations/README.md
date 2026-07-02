# Operations

Operational notes for tokmax.

Deployment:

- Web app: Next.js.
- Backend: Convex.
- CLI: npm package.

Security-sensitive areas:

- Public publish endpoint.
- Rate limits and value caps.
- Capability token handling.
- X sign-in token handling.
- Leaderboard poisoning controls.

Operational defaults:

- Keep payload sizes bounded.
- Keep publish failure messages concise and English-only.
- Keep production links and public contact links intentional.
