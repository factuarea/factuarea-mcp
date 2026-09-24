// Checks what `npm publish` would ship: the executable with its shebang, and nothing
// that belongs only in the repository.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' }));
const files = pack.files.map((file) => file.path).sort();
const problems = [];

for (const required of ['dist/index.js', 'LICENSE', 'README.md', 'package.json']) {
  if (!files.includes(required)) problems.push(`missing ${required}`);
}
for (const file of files) {
  if (/^(src|tests|scripts|\.github)\//.test(file) || file.endsWith('.ts')) problems.push(`should not ship ${file}`);
}
if (!readFileSync('dist/index.js', 'utf8').startsWith('#!/usr/bin/env node'))
  problems.push('dist/index.js lacks its shebang');

if (problems.length > 0) {
  console.error(`verify:package\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`verify:package: ok (${files.length} files, ${pack.size} bytes)\n  ${files.join('\n  ')}`);
