// Writes the package version into the two manifests that carry it: server.json (twice:
// the registry entry and its npm package) and plugin.json. Runs as part of
// `npm run version`, right after `changeset version` bumps package.json, so the Version
// Packages pull request always contains manifests that agree with the release.
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('server.json', 'utf8'));

manifest.version = version;
for (const pkg of manifest.packages ?? []) pkg.version = version;

writeFileSync('server.json', `${JSON.stringify(manifest, null, 2)}\n`);

const plugin = JSON.parse(readFileSync('plugin.json', 'utf8'));
plugin.version = version;
writeFileSync('plugin.json', `${JSON.stringify(plugin, null, 2)}\n`);

console.log(`server.json, plugin.json → ${version}`);
