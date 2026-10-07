/** A standalone teaching adaptation; not the private Book Writer runtime. */
export const original = `## Restore a document

Keep the original section until its replacement is ready for review. Preserve the examples so a wording change cannot silently remove the runnable steps.

\`\`\`python
print("restore original")
\`\`\`

### Verify the result

Check the result before accepting it. Structure checks help detect lost content, while a person still reviews meaning and technical correctness.

\`\`\`python
assert 2 + 2 == 4
\`\`\``;

export function protect(text) {
  const blocks = [];
  const masked = text.replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, block => {
    blocks.push(block);
    return `__CODE_${blocks.length - 1}__`;
  });
  return { masked, blocks };
}

/** Demo policy: exact marker sequence, heading levels, and >=50% masked length. */
export function review(source, candidate) {
  const { masked, blocks } = protect(source);
  const expected = blocks.map((_, i) => `__CODE_${i}__`);
  const actual = candidate.match(/__CODE_\d+__/g) ?? [];
  const headings = text => [...text.matchAll(/^(#{1,6})\s+.+$/gm)].map(m => m[1]);
  const checks = [
    { name: 'Code markers occur once, in order', passed: JSON.stringify(actual) === JSON.stringify(expected) },
    { name: 'Heading levels and count are retained', passed: JSON.stringify(headings(candidate)) === JSON.stringify(headings(masked)) },
    { name: 'At least 50% of the masked section remains', passed: candidate.trim().length >= masked.trim().length * 0.5 },
    { name: 'No new code fences bypass the markers', passed: !candidate.includes('```') }
  ];
  const accepted = checks.every(c => c.passed);
  return { accepted, checks, output: accepted ? candidate.replace(/__CODE_(\d+)__/g, (_, n) => blocks[Number(n)]) : source };
}

const masked = protect(original).masked;
export const scenarios = [
  { id: 'valid', label: 'Wording edit', expected: true, candidate: masked.replace('Keep the original section', 'Retain the original section'), lesson: 'Code is restored unchanged. The wording still needs author review.' },
  { id: 'missing', label: 'Missing code', expected: false, candidate: masked.replace('__CODE_0__', ''), lesson: 'A missing example rejects the entire candidate section and retains the original.' },
  { id: 'heading', label: 'Missing heading', expected: false, candidate: masked.replace('### Verify the result', 'Verify the result'), lesson: 'The heading-level sequence changes, so the original section stays available.' },
  { id: 'duplicate', label: 'Duplicated marker', expected: false, candidate: masked + '\n__CODE_0__', lesson: 'This demo checks exact marker sequence, a stricter rule than the reviewed source’s missing-marker check.' },
  { id: 'short', label: 'Truncated reply', expected: false, candidate: '## Restore a document\n__CODE_0__\n### Verify the result\n__CODE_1__', lesson: 'Markers alone cannot detect a lost explanation. The demo’s length heuristic catches this example.' },
  { id: 'meaning', label: 'Meaning changed', expected: true, candidate: masked.replace('a person still reviews meaning and technical correctness', 'a person never needs to review meaning or technical correctness'), lesson: 'Blind spot: this incorrect claim passes structural checks. A pass only means ready for human review.' }
];
