import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// The treasurer's email signature is this one picture, loaded by address from every email the club sends.
// Moving, renaming or deleting it breaks the banner in every email already sent, so it stays put.
const file = new URL('../app/treasurer-signature.png', import.meta.url);

test('the email signature picture is on the site as a PNG', () => {
  assert.ok(existsSync(file), 'app/treasurer-signature.png is missing');
  const head = readFileSync(file).subarray(0, 8);
  assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'not a PNG file');
});
