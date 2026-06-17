/**
 * Tests for the sensitive-data redaction helpers in lib/utils.mjs.
 * Run with: npm test (node --test)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redactSensitive, scrubUrlCreds } from '../lib/utils.mjs';

test('redacts a nested project.credentialSecret while preserving siblings', () => {
  const input = {
    version: '4.1.8',
    project: { credentialSecret: 'AES-KEY', name: 'node-red-flows' }
  };
  const out = redactSensitive(input);

  assert.equal(out.project.credentialSecret, '[REDACTED]');
  assert.equal(out.project.name, 'node-red-flows'); // sibling preserved
  assert.equal(out.version, '4.1.8'); // top-level benign field preserved
});

test('preserves the benign credentialsFile filename', () => {
  const out = redactSensitive({
    project: { paths: { credentialsFile: 'flows_cred.json', flowFile: 'flows.json' } }
  });

  assert.equal(out.project.paths.credentialsFile, 'flows_cred.json');
  assert.equal(out.project.paths.flowFile, 'flows.json');
});

test('matches case, underscore, and dash key variants', () => {
  const out = redactSensitive({
    API_KEY: 'a',
    'private-key': 'b',
    authToken: 'c',
    Password: 'd',
    passphrase: 'e'
  });

  assert.equal(out.API_KEY, '[REDACTED]');
  assert.equal(out['private-key'], '[REDACTED]');
  assert.equal(out.authToken, '[REDACTED]');
  assert.equal(out.Password, '[REDACTED]');
  assert.equal(out.passphrase, '[REDACTED]');
});

test('redacts an entire object when its key is sensitive', () => {
  const out = redactSensitive({ secret: { nested: 'value' } });
  assert.equal(out.secret, '[REDACTED]');
});

test('recurses through arrays of objects', () => {
  const out = redactSensitive({ items: [{ token: 'a' }, { ok: 1 }] });

  assert.equal(out.items[0].token, '[REDACTED]');
  assert.equal(out.items[1].ok, 1);
});

test('does not mutate the input object', () => {
  const input = { project: { credentialSecret: 'AES-KEY' } };
  const snapshot = structuredClone(input);

  redactSensitive(input);

  assert.deepEqual(input, snapshot);
});

test('passes primitives and null through unchanged', () => {
  assert.equal(redactSensitive(null), null);
  assert.equal(redactSensitive(42), 42);
  assert.equal(redactSensitive(true), true);
  assert.equal(redactSensitive('hello'), 'hello');
  assert.equal(redactSensitive(undefined), undefined);
});

test('survives circular references without crashing', () => {
  const a = { name: 'a' };
  a.self = a;

  const out = redactSensitive(a);

  assert.equal(out.name, 'a');
  assert.equal(out.self, '[Circular]');
});

test('scrubs credentials embedded in URL strings', () => {
  assert.equal(
    scrubUrlCreds('https://user:tok@github.com/owner/repo.git'),
    'https://[REDACTED]@github.com/owner/repo.git'
  );
  // Bare token as userinfo is also scrubbed.
  assert.equal(
    scrubUrlCreds('https://ghp_abc123@github.com/owner/repo.git'),
    'https://[REDACTED]@github.com/owner/repo.git'
  );
});

test('leaves clean URLs (and ordinary strings) unchanged', () => {
  const clean = 'https://github.com/CamSoper/node-red-flows.git';
  assert.equal(scrubUrlCreds(clean), clean);
  assert.equal(scrubUrlCreds('just a string'), 'just a string');

  // And via the full redactor, on a nested git-remote field.
  const out = redactSensitive({ project: { remotes: { origin: { fetch: clean } } } });
  assert.equal(out.project.remotes.origin.fetch, clean);
});

test('scrubs URL credentials nested inside the object tree', () => {
  const out = redactSensitive({
    project: { remotes: { origin: { push: 'https://user:tok@github.com/owner/repo.git' } } }
  });
  assert.equal(
    out.project.remotes.origin.push,
    'https://[REDACTED]@github.com/owner/repo.git'
  );
});
