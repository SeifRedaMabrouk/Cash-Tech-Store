import test from 'node:test';
import assert from 'node:assert/strict';
import { toPg } from '../server/storage.mjs';
test('toPg converts ? placeholders to $n and ignores ? inside quotes', () => {
  assert.equal(toPg('SELECT * FROM t WHERE a=? AND b=?'), 'SELECT * FROM t WHERE a=$1 AND b=$2');
  assert.equal(toPg("SELECT '?' AS q, x FROM t WHERE y=?"), "SELECT '?' AS q, x FROM t WHERE y=$1");
  assert.equal(toPg("INSERT INTO login_limits(key,attempts,expires) VALUES(?,1,?)"), "INSERT INTO login_limits(key,attempts,expires) VALUES($1,1,$2)");
});
