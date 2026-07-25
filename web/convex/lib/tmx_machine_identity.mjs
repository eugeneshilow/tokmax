const TMX_MACHINE_LABEL_MAX = 60
const TMX_CANONICAL_MACHINE_LABEL = /^machine-[0-9a-f]{6}$/
const TMX_SHADOW_MIN_MATCHED_DAYS = 3
const TMX_SHADOW_MATCH_FRACTION = 0.8

/** @param {unknown} raw */
function normalizeMachineLabel(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  return raw.slice(0, TMX_MACHINE_LABEL_MAX)
}

/**
 * Authenticated publishes are tied to one server-side token row per machine.
 * Its label is the durable identity: a client-computed hostname hash may drift,
 * but the token that belongs to this installation does not. Pre-privacy token
 * rows may contain a raw hostname; hash it into the same public shape instead
 * of ever restoring PII to machineLabels.
 *
 * @param {string | null} accountMachineLabel
 * @param {unknown} submittedMachineLabel
 * @param {{
 *   authenticated?: boolean,
 *   hashLabel?: (label: string) => Promise<string>
 * }} [options]
 * @returns {Promise<string>}
 */
export async function resolveTmxMachineLabel(
  accountMachineLabel,
  submittedMachineLabel,
  { authenticated = false, hashLabel } = {}
) {
  const submitted = normalizeMachineLabel(submittedMachineLabel)
  if (!authenticated) return submitted ?? 'this machine'

  const durable = normalizeMachineLabel(accountMachineLabel) ?? submitted
  if (!durable) return 'this machine'
  if (TMX_CANONICAL_MACHINE_LABEL.test(durable)) return durable
  if (!hashLabel) return 'this machine'

  const digest = String(await hashLabel(durable))
    .toLowerCase()
    .replace(/[^0-9a-f]/g, '')
  return digest.length >= 6 ? `machine-${digest.slice(0, 6)}` : 'this machine'
}

/**
 * Daily matches are discrete observations. Floor the percentage threshold so
 * one fractional day cannot make a strong historical match fail (34/43 was
 * the production regression: 79.07% vs a raw 34.4-day threshold).
 *
 * @param {number} matchedDays
 * @param {number} historicalDays
 * @returns {boolean}
 */
export function isTmxShadowMachineMatch(matchedDays, historicalDays) {
  if (!Number.isInteger(matchedDays) || !Number.isInteger(historicalDays)) return false
  if (matchedDays < TMX_SHADOW_MIN_MATCHED_DAYS || historicalDays <= 0) return false
  return matchedDays >= Math.floor(historicalDays * TMX_SHADOW_MATCH_FRACTION)
}
