import { test } from 'node:test';
import assert from 'node:assert/strict';
import { original, protect, review, scenarios } from './guard.mjs';
for (const s of scenarios) test(s.label, () => {
  const result = review(original, s.candidate);
  assert.equal(result.accepted, s.expected);
  if (!s.expected) assert.equal(result.output, original);
  else assert.deepEqual(protect(result.output).blocks, protect(original).blocks);
});
test('Unknown or reordered markers cannot substitute the examples', () => {
  const masked = protect(original).masked;
  for (const c of [masked.replace('__CODE_0__','__CODE_9__'), masked.replace('__CODE_0__','__CODE_X__').replace('__CODE_1__','__CODE_0__').replace('__CODE_X__','__CODE_1__')]) {
    assert.equal(review(original,c).output,original);
    assert.equal(review(original,c).accepted,false);
  }
});
test('A new code fence is not accepted as generated prose', () => {
  assert.equal(review(original,protect(original).masked+'\n```python\nprint(1)\n```').accepted,false);
});
