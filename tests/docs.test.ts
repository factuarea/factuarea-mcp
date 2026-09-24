import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const READMES = ['README.md', 'README.es.md'];
const DOCUMENTS = [...READMES, 'CONTRIBUTING.md', 'SECURITY.md', 'AGENTS.md', 'CHANGELOG.md'];

/** Relative Markdown links and `href`/`src` attributes: the ones a rename can break silently. */
function relativeLinks(markdown: string): string[] {
  const targets = [
    ...[...markdown.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]!),
    ...[...markdown.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]!),
  ];
  return targets.filter((target) => !/^(?:[a-z]+:|#)/i.test(target)).map((target) => target.split('#')[0]!);
}

describe('repository documents', () => {
  it.each(DOCUMENTS)('%s links only to files that exist', (document) => {
    const missing = relativeLinks(readFileSync(document, 'utf8')).filter(
      (target) => !existsSync(join(dirname(document), target)),
    );
    expect(missing).toEqual([]);
  });

  it.each(READMES)('%s documents every environment variable the bridge reads', (document) => {
    const readme = readFileSync(document, 'utf8');
    const read = new Set(
      [...readFileSync('src/config.ts', 'utf8').matchAll(/env\.(FACTUAREA_[A-Z_]+)/g)].map((match) => match[1]!),
    );
    for (const variable of read) expect(readme).toContain(`\`${variable}\``);
  });

  it('both READMEs link to each other and cover the same sections', () => {
    const english = readFileSync('README.md', 'utf8');
    const spanish = readFileSync('README.es.md', 'utf8');

    expect(english).toContain('href="README.es.md"');
    expect(spanish).toContain('href="README.md"');
    const sections = (markdown: string) => [...markdown.matchAll(/^## /gm)].length;
    expect(sections(spanish)).toBe(sections(english));
  });
});
