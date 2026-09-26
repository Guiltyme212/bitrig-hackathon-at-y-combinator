import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessFrom, configurationProblem } from '../src/billing/policy';

test('only the active Kokoro entitlement grants access', () => {
  assert.equal(accessFrom({ entitlements: { active: {} } }).hasPro, false);
  assert.equal(accessFrom({ entitlements: { active: { other: { isActive: true, periodType: 'NORMAL', isSandbox: false } } } }).hasPro, false);
  assert.equal(accessFrom({ entitlements: { active: { kokoro_pro: { isActive: false, periodType: 'NORMAL', isSandbox: true } } } }).hasPro, false);
  assert.deepEqual(accessFrom({ entitlements: { active: { kokoro_pro: { isActive: true, periodType: 'TRIAL', isSandbox: true } } } }), { hasPro: true, isTrial: true, isSandbox: true });
});
test('Expo Go, web, secret keys, and Test Store release builds cannot initialize purchases', () => {
  assert.ok(configurationProblem('ios', true, true, 'test_example'));
  assert.ok(configurationProblem('web', false, true, 'test_example'));
  assert.ok(configurationProblem('ios', false, false, 'test_example'));
  assert.ok(configurationProblem('ios', false, true, 'sk_example'));
  assert.ok(configurationProblem('ios', false, true, ''));
  assert.equal(configurationProblem('ios', false, true, 'test_example'), null);
  assert.equal(configurationProblem('ios', false, false, 'appl_example'), null);
});
