# Operations — retired

Updated: 2026-09-20.

Tokmax is retired. Do not restart deployments, releases, scheduled uploads, or
launch work without an explicit new decision from the owner.

- Vercel project `tokenmax`: keep paused, including all production and preview URLs.
- Convex project `tokenmax`: keep production `gallant-wildcat-346` and
  development `chatty-boar-479` paused. Function calls fail and cron jobs are skipped.
- npm package `tokmax`: deprecate every published version; preserve package history.
- GitHub `eugeneshilow/tokmax`: archive after merging retirement documentation.
- Scheduled uploads: disable `tech.vibecoding.tokmax.daily` on Pro and Air.
- Preserve source, stored data, and domain ownership. Pausing is reversible;
  it does not claim that storage or domain renewal costs are zero.

The separate `ru.vibecoding.token-maxing.air` job feeds the internal compute
accounting in vibecoding.ru. It is not this public service and remains in place.

[Decision record](journal.md) · [Historical release procedure](release.md).
