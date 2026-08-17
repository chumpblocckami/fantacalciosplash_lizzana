import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { loadRegistrationCount } from '../../js/api.js';

describe('loadRegistrationCount', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('reads { count } from a deployment that supports count=1', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ count: 11 }), { status: 200 });
    assert.equal(await loadRegistrationCount(), 11);
  });

  test('falls back to the list length when count=1 is ignored', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify([{}, {}, {}]), { status: 200 });
    assert.equal(await loadRegistrationCount(), 3);
  });

  test('returns null when the backend cannot be reached in time', async () => {
    globalThis.fetch = async () => {
      throw new DOMException('The operation was aborted.', 'TimeoutError');
    };
    assert.equal(await loadRegistrationCount(), null);
  });
});
