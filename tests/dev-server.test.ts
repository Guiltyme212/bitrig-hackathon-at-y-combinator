import assert from 'node:assert/strict';
import { test } from 'node:test';
import { devServer } from '../src/devServer';

test('QA service selection works in native and browser runtimes', () => {
  const g = globalThis as any;
  const before = { dev: g.__DEV__, window: g.window, location: g.location };
  try {
    g.__DEV__ = true;
    g.window = g;
    delete g.location;
    assert.equal(devServer(), null, 'native window has no browser location');
    g.location = { origin: 'http://localhost:8090', search: '?duo=openLandscape' };
    assert.equal(devServer(), 'http://localhost:8090');
    g.location.search = '?qa=1&offline=1';
    assert.equal(devServer(), null, 'browser QA never calls live services');
    g.location.search = '';
    assert.equal(devServer(), null, 'QA remains offline after router navigation');
    g.__DEV__ = false;
    assert.equal(devServer(), null, 'production has no development backend');
  } finally {
    for (const [key, value] of Object.entries({ __DEV__: before.dev, window: before.window, location: before.location })) {
      if (value === undefined) delete g[key]; else g[key] = value;
    }
  }
});
