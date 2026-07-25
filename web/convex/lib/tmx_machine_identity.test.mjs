import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isTmxShadowMachineMatch,
  resolveTmxMachineLabel,
} from './tmx_machine_identity.mjs'

test('authenticated publish keeps the server-side machine identity', async () => {
  assert.equal(
    await resolveTmxMachineLabel('machine-a1b2c3', 'machine-d4e5f6', {
      authenticated: true,
    }),
    'machine-a1b2c3'
  )
})

test('legacy raw hostnames are hashed before becoming authoritative', async () => {
  assert.equal(
    await resolveTmxMachineLabel('Eugenes-MacBook-Pro.local', 'machine-d4e5f6', {
      authenticated: true,
      hashLabel: async () => 'abcdef0123456789',
    }),
    'machine-abcdef'
  )
})

test('legacy and anonymous publishes fall back to the submitted label', async () => {
  assert.equal(await resolveTmxMachineLabel(null, 'machine-client'), 'machine-client')
})

test('empty labels fall back without leaking unbounded client input', async () => {
  assert.equal(await resolveTmxMachineLabel(null, '   '), 'this machine')
  assert.equal(await resolveTmxMachineLabel(null, 'x'.repeat(80)), 'x'.repeat(60))
})

test('shadow matching floors the discrete 80% threshold', () => {
  assert.equal(isTmxShadowMachineMatch(34, 43), true)
  assert.equal(isTmxShadowMachineMatch(33, 43), false)
  assert.equal(isTmxShadowMachineMatch(2, 2), false)
})
