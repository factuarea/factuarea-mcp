// Boots the built server over stdio with no credentials and checks what a user would see:
// it must answer the handshake, and refuse a call with a message that says how to fix it.
// CI and the release run this same file, so both check the same thing.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const env = { ...process.env };
delete env.FACTUAREA_API_KEY;

const child = spawn(process.execPath, ['dist/index.js'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', (chunk) => (stderr += chunk));

const pending = new Map();
createInterface({ input: child.stdout }).on('line', (line) => {
  const message = JSON.parse(line);
  pending.get(message.id)?.(message);
});

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
  if (message.id === undefined) return Promise.resolve();
  return new Promise((resolve) => pending.set(message.id, resolve));
}

function fail(reason) {
  console.error(`smoke: ${reason}\n--- stderr ---\n${stderr}`);
  child.kill();
  process.exit(1);
}

const timer = setTimeout(() => fail('timed out waiting for the server'), 10_000);

const init = await send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } },
});
if (init.result?.serverInfo?.name !== 'factuarea') fail(`unexpected initialize answer: ${JSON.stringify(init)}`);
await send({ jsonrpc: '2.0', method: 'notifications/initialized' });

const list = await send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
if (!list.error?.message?.includes('FACTUAREA_API_KEY'))
  fail(`tools/list should explain the missing key: ${JSON.stringify(list)}`);
if (!stderr.includes('FACTUAREA_API_KEY is not set')) fail('the missing key should be reported on stderr');

clearTimeout(timer);
child.stdin.end();
child.on('exit', (code) => {
  if (code !== 0) fail(`exited with code ${code} after stdin closed`);
  console.log(`smoke: ok (factuarea ${init.result.serverInfo.version}, protocol ${init.result.protocolVersion})`);
});
